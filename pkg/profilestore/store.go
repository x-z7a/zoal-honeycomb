// Package profilestore reads, saves and creates Bravo profiles on disk for the
// in-sim configurator.
//
// Profiles live in two sibling folders inside the plugin: "profiles" (shipped
// with the plugin, replaced on update) and "user profiles" (the user's own,
// never touched by updates). Edits and new profiles always go to
// "user profiles".
package profilestore

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/x-z7a/zoal-honeycomb/pkg"
	"gopkg.in/yaml.v3"
)

const (
	FolderName      = "profiles"
	UserFolderName  = "user profiles"
	SourceUser      = "user"
	SourceDefault   = "default"
	DefaultTemplate = "default.yaml"
)

// Status summarizes the last load for the configurator's header.
type Status struct {
	ProfilesDir     string `json:"profilesDir"`
	UserProfilesDir string `json:"userProfilesDir"`
	ProfilesCount   int    `json:"profilesCount"`
	LoadError       string `json:"loadError"`
	ParseErrors     int    `json:"parseErrors"`
}

// ActiveProfile is the profile the plugin has loaded for the current
// aircraft. File matches an entry of Store.Files; both are empty when no
// profile is loaded.
type ActiveProfile struct {
	File string `json:"file"`
	Name string `json:"name"`
}

// Store holds the profiles loaded from one plugin's profile folders. The
// parallel slices describe the same file at the same index. It is safe for
// concurrent use.
type Store struct {
	mu          sync.RWMutex
	profilesDir string
	userDir     string
	profiles    []pkg.Profile
	files       []string
	errors      []string
	sources     []string
	loadErr     string
}

// New returns a store for profilesDir and its sibling "user profiles" folder.
// Call Reload to read them.
func New(profilesDir string) *Store {
	profilesDir = filepath.Clean(profilesDir)
	return &Store{
		profilesDir: profilesDir,
		userDir:     filepath.Join(filepath.Dir(profilesDir), UserFolderName),
	}
}

// Reload rereads both folders. On error the previous profiles are kept and
// the error is reported through Status.
func (s *Store) Reload() error {
	profiles, files, profileErrors, err := ReadDir(s.profilesDir)
	if err != nil {
		s.mu.Lock()
		s.loadErr = err.Error()
		s.mu.Unlock()
		return err
	}

	sources := make([]string, len(profiles))
	for i := range sources {
		sources[i] = SourceDefault
	}

	if info, statErr := os.Stat(s.userDir); statErr == nil && info.IsDir() {
		userProfiles, userFiles, userErrors, userErr := ReadDir(s.userDir)
		if userErr == nil {
			profiles, files, profileErrors, sources = Combine(
				profiles, files, profileErrors,
				userProfiles, userFiles, userErrors,
			)
		}
	}

	s.mu.Lock()
	s.profiles = profiles
	s.files = files
	s.errors = profileErrors
	s.sources = sources
	s.loadErr = ""
	s.mu.Unlock()
	return nil
}

func (s *Store) Status() Status {
	s.mu.RLock()
	defer s.mu.RUnlock()

	parseErrors := 0
	for _, e := range s.errors {
		if e != "" {
			parseErrors++
		}
	}
	return Status{
		ProfilesDir:     s.profilesDir,
		UserProfilesDir: s.userDir,
		ProfilesCount:   len(s.profiles),
		LoadError:       s.loadErr,
		ParseErrors:     parseErrors,
	}
}

func (s *Store) Profiles() []pkg.Profile { return copyOf(&s.mu, s.profiles) }
func (s *Store) Files() []string         { return copyOf(&s.mu, s.files) }
func (s *Store) Errors() []string        { return copyOf(&s.mu, s.errors) }
func (s *Store) Sources() []string       { return copyOf(&s.mu, s.sources) }

// Profile returns the first profile whose metadata name is name, or an empty
// profile.
func (s *Store) Profile(name string) pkg.Profile {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, profile := range s.profiles {
		if profile.Metadata != nil && profile.Metadata.Name == name {
			return profile
		}
	}
	return pkg.Profile{}
}

// Save writes the profile at index into "user profiles", under the same file
// name it was loaded from. A shipped profile that is edited is therefore
// copied, not overwritten, and the copy wins from then on.
func (s *Store) Save(index int, profile pkg.Profile) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.profiles) == 0 {
		return errors.New("no profiles are loaded")
	}
	if index < 0 || index >= len(s.profiles) || index >= len(s.files) {
		return errors.New("profile index out of range")
	}

	cleanProfile, err := sanitizeForSave(profile)
	if err != nil {
		return err
	}
	output, err := yaml.Marshal(cleanProfile)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(s.userDir, 0o755); err != nil {
		return fmt.Errorf("failed to create user profiles folder: %w", err)
	}
	userFilePath := filepath.Join(s.userDir, filepath.Base(s.files[index]))
	if err := os.WriteFile(userFilePath, output, 0o644); err != nil {
		return err
	}

	s.profiles[index] = cleanProfile
	s.files[index] = userFilePath
	s.errors[index] = ""
	s.sources[index] = SourceUser
	return nil
}

// CreateFromDefault copies the shipped default.yaml into "user profiles" as
// filename with the given metadata, reloads, and returns the new file's path.
func (s *Store) CreateFromDefault(filename, profileName, description string, selectors []string) (string, error) {
	normalizedFilename, err := normalizeFilename(filename)
	if err != nil {
		return "", err
	}
	name := strings.TrimSpace(profileName)
	if name == "" {
		return "", errors.New("profile name is required")
	}
	cleanedSelectors := normalizeSelectors(selectors)
	if len(cleanedSelectors) == 0 {
		return "", errors.New("at least one selector is required")
	}

	if err := os.MkdirAll(s.userDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create user profiles folder: %w", err)
	}
	newProfilePath := filepath.Join(s.userDir, normalizedFilename)
	if _, err := os.Stat(newProfilePath); err == nil {
		return "", fmt.Errorf("profile %q already exists in user profiles", normalizedFilename)
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("failed to check existing profile %q: %w", normalizedFilename, err)
	}

	templatePath := filepath.Join(s.profilesDir, DefaultTemplate)
	templateContent, err := os.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to read template %q: %w", templatePath, err)
	}
	var profile pkg.Profile
	if err := yaml.Unmarshal(templateContent, &profile); err != nil {
		return "", fmt.Errorf("failed to parse template %q: %w", templatePath, err)
	}

	if profile.Metadata == nil {
		profile.Metadata = &pkg.Metadata{}
	}
	profile.Metadata.Name = name
	profile.Metadata.Description = strings.TrimSpace(description)
	profile.Metadata.Selectors = cleanedSelectors

	output, err := yaml.Marshal(profile)
	if err != nil {
		return "", fmt.Errorf("failed to render profile yaml: %w", err)
	}
	if err := os.WriteFile(newProfilePath, output, 0o644); err != nil {
		return "", fmt.Errorf("failed to create profile %q: %w", newProfilePath, err)
	}

	if err := s.Reload(); err != nil {
		return "", fmt.Errorf("profile created but reload failed: %w", err)
	}
	return newProfilePath, nil
}

// DeleteUserProfiles removes the given profile files and reloads. Only
// .yaml files directly inside "user profiles" may be deleted; shipped
// profiles are refused, and nothing is removed unless every file is allowed.
// It returns how many files were removed.
func (s *Store) DeleteUserProfiles(files []string) (int, error) {
	if len(files) == 0 {
		return 0, errors.New("no profiles selected")
	}

	userDir := filepath.Clean(s.userDir)
	targets := make([]string, 0, len(files))
	seen := map[string]struct{}{}
	for _, file := range files {
		clean := filepath.Clean(file)
		if filepath.Dir(clean) != userDir || !strings.EqualFold(filepath.Ext(clean), ".yaml") {
			return 0, fmt.Errorf("only files in %q can be deleted: %q", UserFolderName, filepath.Base(file))
		}
		if _, dup := seen[clean]; dup {
			continue
		}
		seen[clean] = struct{}{}
		targets = append(targets, clean)
	}

	deleted := 0
	for _, target := range targets {
		if err := os.Remove(target); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			_ = s.Reload()
			return deleted, fmt.Errorf("failed to delete %q: %w", filepath.Base(target), err)
		}
		deleted++
	}

	if err := s.Reload(); err != nil {
		return deleted, fmt.Errorf("deleted %d profile(s) but reload failed: %w", deleted, err)
	}
	return deleted, nil
}

// ReadDir parses every .yaml file in profilesDir, in name order. A file that
// cannot be read or parsed still gets an entry, with an empty profile and the
// reason in the errors slice.
func ReadDir(profilesDir string) ([]pkg.Profile, []string, []string, error) {
	entries, err := os.ReadDir(profilesDir)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to read profiles folder %q: %w", profilesDir, err)
	}

	yamlFiles := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.EqualFold(filepath.Ext(entry.Name()), ".yaml") {
			yamlFiles = append(yamlFiles, entry.Name())
		}
	}

	sort.Strings(yamlFiles)
	if len(yamlFiles) == 0 {
		return nil, nil, nil, errors.New("profiles folder does not contain any .yaml files")
	}

	profiles := make([]pkg.Profile, 0, len(yamlFiles))
	profileFiles := make([]string, 0, len(yamlFiles))
	profileErrors := make([]string, 0, len(yamlFiles))
	for _, yamlFile := range yamlFiles {
		fileName := filepath.Join(profilesDir, yamlFile)
		content, err := os.ReadFile(fileName)
		if err != nil {
			profiles = append(profiles, pkg.Profile{})
			profileFiles = append(profileFiles, fileName)
			profileErrors = append(profileErrors, fmt.Sprintf("failed to read: %v", err))
			continue
		}

		var profile pkg.Profile
		if err := yaml.Unmarshal(content, &profile); err != nil {
			profiles = append(profiles, pkg.Profile{})
			profileFiles = append(profileFiles, fileName)
			profileErrors = append(profileErrors, fmt.Sprintf("YAML syntax error: %v", err))
			continue
		}

		profiles = append(profiles, profile)
		profileFiles = append(profileFiles, fileName)
		profileErrors = append(profileErrors, "")
	}

	return profiles, profileFiles, profileErrors, nil
}

// Combine merges default and user profiles into one list sorted by file name.
// Both folders may contain the same file name; both entries are kept and told
// apart by their source ("default" or "user").
func Combine(
	defaultProfiles []pkg.Profile, defaultFiles []string, defaultErrors []string,
	userProfiles []pkg.Profile, userFiles []string, userErrors []string,
) ([]pkg.Profile, []string, []string, []string) {
	type entry struct {
		profile pkg.Profile
		file    string
		err     string
		source  string
		sortKey string
	}

	total := len(defaultFiles) + len(userFiles)
	entries := make([]entry, 0, total)
	for i, file := range defaultFiles {
		entries = append(entries, entry{defaultProfiles[i], file, defaultErrors[i], SourceDefault, strings.ToLower(filepath.Base(file))})
	}
	for i, file := range userFiles {
		entries = append(entries, entry{userProfiles[i], file, userErrors[i], SourceUser, strings.ToLower(filepath.Base(file))})
	}

	sort.SliceStable(entries, func(i, j int) bool {
		return entries[i].sortKey < entries[j].sortKey
	})

	profiles := make([]pkg.Profile, 0, total)
	files := make([]string, 0, total)
	errs := make([]string, 0, total)
	sources := make([]string, 0, total)
	for _, e := range entries {
		profiles = append(profiles, e.profile)
		files = append(files, e.file)
		errs = append(errs, e.err)
		sources = append(sources, e.source)
	}
	return profiles, files, errs, sources
}

func normalizeFilename(filename string) (string, error) {
	trimmed := strings.TrimSpace(filename)
	if trimmed == "" {
		return "", errors.New("profile filename is required")
	}
	if filepath.Base(trimmed) != trimmed || strings.Contains(trimmed, "/") || strings.Contains(trimmed, "\\") {
		return "", errors.New("profile filename must not contain path separators")
	}
	if strings.Contains(trimmed, "..") {
		return "", errors.New("profile filename must not contain '..'")
	}

	ext := filepath.Ext(trimmed)
	base := trimmed
	if ext != "" {
		if !strings.EqualFold(ext, ".yaml") {
			return "", errors.New("profile filename must use .yaml extension")
		}
		base = strings.TrimSpace(strings.TrimSuffix(trimmed, ext))
	}
	if base == "" || base == "." || base == ".." {
		return "", errors.New("profile filename is invalid")
	}
	return base + ".yaml", nil
}

func normalizeSelectors(selectors []string) []string {
	cleaned := make([]string, 0, len(selectors))
	seen := map[string]struct{}{}
	for _, selector := range selectors {
		trimmed := strings.TrimSpace(selector)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		cleaned = append(cleaned, trimmed)
	}
	return cleaned
}

// sanitizeForSave round-trips the profile through JSON, which drops the
// runtime-only fields (compiled expressions, LED callbacks) tagged json:"-".
func sanitizeForSave(profile pkg.Profile) (pkg.Profile, error) {
	payload, err := json.Marshal(profile)
	if err != nil {
		return pkg.Profile{}, fmt.Errorf("failed to normalize profile payload: %w", err)
	}
	var cleanProfile pkg.Profile
	if err := json.Unmarshal(payload, &cleanProfile); err != nil {
		return pkg.Profile{}, fmt.Errorf("failed to decode normalized profile payload: %w", err)
	}
	return cleanProfile, nil
}

func copyOf[T any](mu *sync.RWMutex, s []T) []T {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]T, len(s))
	copy(out, s)
	return out
}
