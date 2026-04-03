package xplane

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
	panelProfilesFolderName     = "profiles"
	panelUserProfilesFolderName = "user profiles"
	panelDefaultProfileTemplate = "default.yaml"
	panelProfileSourceUser      = "user"
	panelProfileSourceDefault   = "default"
)

type profilesDataResponse struct {
	Profiles []pkg.Profile      `json:"profiles"`
	Files    []string           `json:"files"`
	Errors   []string           `json:"errors"`
	Sources  []string           `json:"sources"`
	Status   panelProfileStatus `json:"status"`
}

type panelProfileStatus struct {
	ProfilesDir     string `json:"profilesDir"`
	UserProfilesDir string `json:"userProfilesDir"`
	ProfilesCount   int    `json:"profilesCount"`
	NeedsSelection  bool   `json:"needsSelection"`
	LoadError       string `json:"loadError"`
	ParseErrors     int    `json:"parseErrors"`
}

type panelProfileManager struct {
	pluginPath      string
	profilesDir     string
	userProfilesDir string
	profiles        []pkg.Profile
	profileFiles    []string
	profileErrors   []string
	profileSources  []string
	loadErr         string
	mu              sync.RWMutex
	logger          pkg.Logger
}

func newPanelProfileManager(pluginPath string, logger pkg.Logger) *panelProfileManager {
	return &panelProfileManager{
		pluginPath:      pluginPath,
		profilesDir:     filepath.Join(pluginPath, panelProfilesFolderName),
		userProfilesDir: filepath.Join(pluginPath, panelUserProfilesFolderName),
		logger:          logger,
	}
}

func (pm *panelProfileManager) loadProfiles() {
	profilesDir := pm.profilesDir
	if !panelDirExists(profilesDir) {
		pm.mu.Lock()
		pm.loadErr = "profiles folder not found at " + profilesDir
		pm.profiles = nil
		pm.profileFiles = nil
		pm.profileErrors = nil
		pm.profileSources = nil
		pm.mu.Unlock()
		return
	}

	profiles, files, profileErrors, err := panelReadProfilesFromDir(profilesDir)
	if err != nil {
		pm.mu.Lock()
		pm.loadErr = err.Error()
		pm.profiles = nil
		pm.profileFiles = nil
		pm.profileErrors = nil
		pm.profileSources = nil
		pm.mu.Unlock()
		return
	}

	sources := make([]string, len(profiles))
	for i := range sources {
		sources[i] = panelProfileSourceDefault
	}

	userDir := pm.userProfilesDir
	if panelDirExists(userDir) {
		userProfiles, userFiles, userErrors, userErr := panelReadProfilesFromDir(userDir)
		if userErr == nil {
			profiles, files, profileErrors, sources = panelCombineProfiles(
				profiles, files, profileErrors,
				userProfiles, userFiles, userErrors,
			)
		}
	}

	pm.mu.Lock()
	pm.profiles = profiles
	pm.profileFiles = files
	pm.profileErrors = profileErrors
	pm.profileSources = sources
	pm.loadErr = ""
	pm.mu.Unlock()
}

func (pm *panelProfileManager) getProfilesData() profilesDataResponse {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	parseErrors := 0
	for _, e := range pm.profileErrors {
		if e != "" {
			parseErrors++
		}
	}

	profiles := make([]pkg.Profile, len(pm.profiles))
	copy(profiles, pm.profiles)
	files := make([]string, len(pm.profileFiles))
	copy(files, pm.profileFiles)
	errs := make([]string, len(pm.profileErrors))
	copy(errs, pm.profileErrors)
	srcsCopy := make([]string, len(pm.profileSources))
	copy(srcsCopy, pm.profileSources)

	return profilesDataResponse{
		Profiles: profiles,
		Files:    files,
		Errors:   errs,
		Sources:  srcsCopy,
		Status: panelProfileStatus{
			ProfilesDir:     pm.profilesDir,
			UserProfilesDir: pm.userProfilesDir,
			ProfilesCount:   len(profiles),
			NeedsSelection:  len(profiles) == 0 && pm.loadErr != "",
			LoadError:       pm.loadErr,
			ParseErrors:     parseErrors,
		},
	}
}

func (pm *panelProfileManager) saveProfileByIndex(index int, profile pkg.Profile) error {
	pm.mu.RLock()
	if len(pm.profiles) == 0 {
		pm.mu.RUnlock()
		return errors.New("no profiles are loaded")
	}
	if index < 0 || index >= len(pm.profiles) {
		pm.mu.RUnlock()
		return errors.New("profile index out of range")
	}
	if index >= len(pm.profileFiles) {
		pm.mu.RUnlock()
		return errors.New("profile file index out of range")
	}
	baseName := filepath.Base(pm.profileFiles[index])
	pm.mu.RUnlock()

	cleanProfile, err := panelSanitizeProfile(profile)
	if err != nil {
		return err
	}

	output, err := yaml.Marshal(cleanProfile)
	if err != nil {
		return err
	}

	userDir := pm.userProfilesDir
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return fmt.Errorf("failed to create user profiles folder: %w", err)
	}

	userFilePath := filepath.Join(userDir, baseName)
	if err := os.WriteFile(userFilePath, output, 0o644); err != nil {
		return err
	}

	pm.loadProfiles()
	return nil
}

func (pm *panelProfileManager) createProfileFromDefault(filename, profileName, description string, selectors []string) (string, error) {
	profilesDir := pm.profilesDir
	if !panelDirExists(profilesDir) {
		return "", errors.New("profiles folder is not available")
	}

	normalizedFilename, err := panelNormalizeFilename(filename)
	if err != nil {
		return "", err
	}

	name := strings.TrimSpace(profileName)
	if name == "" {
		return "", errors.New("profile name is required")
	}

	cleanedSelectors := panelNormalizeSelectors(selectors)
	if len(cleanedSelectors) == 0 {
		return "", errors.New("at least one selector is required")
	}

	targetDir := pm.userProfilesDir
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create user profiles folder: %w", err)
	}

	newProfilePath := filepath.Join(targetDir, normalizedFilename)
	if _, err := os.Stat(newProfilePath); err == nil {
		return "", fmt.Errorf("profile %q already exists in user profiles", normalizedFilename)
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("failed to check existing profile %q: %w", normalizedFilename, err)
	}

	templatePath := filepath.Join(profilesDir, panelDefaultProfileTemplate)
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

	pm.loadProfiles()
	return newProfilePath, nil
}

// Utility functions

func panelReadProfilesFromDir(profilesDir string) ([]pkg.Profile, []string, []string, error) {
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

func panelCombineProfiles(
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
		entries = append(entries, entry{
			profile: defaultProfiles[i],
			file:    file,
			err:     defaultErrors[i],
			source:  panelProfileSourceDefault,
			sortKey: strings.ToLower(filepath.Base(file)),
		})
	}
	for i, file := range userFiles {
		entries = append(entries, entry{
			profile: userProfiles[i],
			file:    file,
			err:     userErrors[i],
			source:  panelProfileSourceUser,
			sortKey: strings.ToLower(filepath.Base(file)),
		})
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

func panelDirExists(directory string) bool {
	if strings.TrimSpace(directory) == "" {
		return false
	}
	info, err := os.Stat(directory)
	if err != nil {
		return false
	}
	return info.IsDir()
}

func panelNormalizeFilename(filename string) (string, error) {
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

func panelNormalizeSelectors(selectors []string) []string {
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

func panelSanitizeProfile(profile pkg.Profile) (pkg.Profile, error) {
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
