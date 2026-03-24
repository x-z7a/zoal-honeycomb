package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/x-z7a/zoal-honeycomb/pkg"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"gopkg.in/yaml.v3"
)

const (
	profilesDirEnvVar        = "ZOAL_PROFILES_DIR"
	profilesFolderName       = "profiles"
	userProfilesFolderName   = "user profiles"
	defaultProfileTemplate   = "default.yaml"
	selectionErrorMsg        = "no profiles folder selected. Please select a folder containing YAML profiles"
	missingProfilesMsg       = "profiles folder not found. Please select your external profiles folder"
	invalidProfilesMsg       = "selected folder does not contain valid YAML profiles"
	profileSourceUser        = "user"
	profileSourceDefault     = "default"
)

var (
	executablePathFn = os.Executable
	getwdFn          = os.Getwd

	errProfilesSelectionCancelled = errors.New("profiles folder selection cancelled")
)

type ListResponse struct {
	Data []struct {
		ID         int64  `json:"id"`
		IsWritable bool   `json:"is_writable"`
		Name       string `json:"name"`
		ValueType  string `json:"value_type"`
	} `json:"data"`
}

type ProfilesStatus struct {
	ProfilesDir      string `json:"profilesDir"`
	UserProfilesDir  string `json:"userProfilesDir"`
	ProfilesCount    int    `json:"profilesCount"`
	NeedsSelection   bool   `json:"needsSelection"`
	LoadError        string `json:"loadError"`
	ParseErrors      int    `json:"parseErrors"`
}

// App struct
type App struct {
	ctx                    context.Context
	profilesDir            string
	userProfilesDir        string
	profiles               []pkg.Profile
	profileFiles           []string
	profileErrors          []string
	profileSources         []string
	profilesLoadErr        string
	needsProfilesSelection bool
	mu                     sync.RWMutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		profiles:               []pkg.Profile{},
		profileFiles:           []string{},
		needsProfilesSelection: true,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.mu.Lock()
	a.ctx = ctx
	a.mu.Unlock()

	go a.ensureProfilesLoaded()
}

// GetProfile returns a greeting for the given name
func (a *App) GetProfile(name string) pkg.Profile {
	a.mu.RLock()
	defer a.mu.RUnlock()

	for _, profile := range a.profiles {
		if profile.Metadata.Name == name {
			return profile
		}
	}

	return pkg.Profile{}
}

func (a *App) GetProfiles() []pkg.Profile {
	a.mu.RLock()
	defer a.mu.RUnlock()

	res := make([]pkg.Profile, len(a.profiles))
	copy(res, a.profiles)
	return res
}

func (a *App) GetProfileFiles() []string {
	a.mu.RLock()
	defer a.mu.RUnlock()

	res := make([]string, len(a.profileFiles))
	copy(res, a.profileFiles)
	return res
}

func (a *App) GetProfileErrors() []string {
	a.mu.RLock()
	defer a.mu.RUnlock()

	res := make([]string, len(a.profileErrors))
	copy(res, a.profileErrors)
	return res
}

func (a *App) GetProfileSources() []string {
	a.mu.RLock()
	defer a.mu.RUnlock()

	res := make([]string, len(a.profileSources))
	copy(res, a.profileSources)
	return res
}

func (a *App) GetProfilesStatus() ProfilesStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()

	parseErrors := 0
	for _, e := range a.profileErrors {
		if e != "" {
			parseErrors++
		}
	}

	return ProfilesStatus{
		ProfilesDir:     a.profilesDir,
		UserProfilesDir: a.userProfilesDir,
		ProfilesCount:   len(a.profiles),
		NeedsSelection:  a.needsProfilesSelection,
		LoadError:       a.profilesLoadErr,
		ParseErrors:     parseErrors,
	}
}

func (a *App) SelectProfilesFolder() error {
	a.mu.RLock()
	ctx := a.ctx
	a.mu.RUnlock()

	if ctx == nil {
		return errors.New("application context is not ready yet")
	}

	return a.selectProfilesFolder(ctx)
}

func (a *App) SaveProfileByIndex(index int, profile pkg.Profile) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if len(a.profiles) == 0 {
		return errors.New("no profiles are loaded; select a profiles folder first")
	}

	if index < 0 || index >= len(a.profiles) {
		return errors.New("profile index out of range")
	}

	if index >= len(a.profileFiles) {
		return errors.New("profile file index out of range")
	}

	cleanProfile, err := sanitizeProfileForSave(profile)
	if err != nil {
		return err
	}

	output, err := yaml.Marshal(cleanProfile)
	if err != nil {
		return err
	}

	// Always save into the user profiles directory
	userDir := a.userProfilesDir
	if userDir == "" {
		userDir = filepath.Join(filepath.Dir(a.profilesDir), userProfilesFolderName)
	}
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return fmt.Errorf("failed to create user profiles folder: %w", err)
	}

	baseName := filepath.Base(a.profileFiles[index])
	userFilePath := filepath.Join(userDir, baseName)

	if err := os.WriteFile(userFilePath, output, 0o644); err != nil {
		return err
	}

	a.profiles[index] = cleanProfile
	a.profileFiles[index] = userFilePath
	if index < len(a.profileSources) {
		a.profileSources[index] = profileSourceUser
	}
	if a.userProfilesDir == "" {
		a.userProfilesDir = userDir
	}
	return nil
}

func (a *App) CreateProfileFromDefault(filename string, profileName string, description string, selectors []string) (string, error) {
	a.mu.RLock()
	profilesDir := a.profilesDir
	userProfilesDir := a.userProfilesDir
	a.mu.RUnlock()

	if !dirExists(profilesDir) {
		return "", errors.New("profiles folder is not available")
	}

	normalizedFilename, err := normalizeProfileFilename(filename)
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

	// New profiles are always created in the user profiles directory
	targetDir := userProfilesDir
	if targetDir == "" {
		targetDir = filepath.Join(filepath.Dir(profilesDir), userProfilesFolderName)
	}
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create user profiles folder: %w", err)
	}

	newProfilePath := filepath.Join(targetDir, normalizedFilename)
	// Also check the default profiles dir for duplicates
	if _, err := os.Stat(newProfilePath); err == nil {
		return "", fmt.Errorf("profile %q already exists in user profiles", normalizedFilename)
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("failed to check existing profile %q: %w", normalizedFilename, err)
	}

	templatePath := filepath.Join(profilesDir, defaultProfileTemplate)
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

	if err := a.loadProfilesFromDir(profilesDir); err != nil {
		return "", fmt.Errorf("profile created but reload failed: %w", err)
	}

	return newProfilePath, nil
}

func (a *App) ensureProfilesLoaded() {
	profilesDir := a.resolveProfilesDir()
	if profilesDir != "" {
		if err := a.loadProfilesFromDir(profilesDir); err == nil {
			return
		}
	}

	a.setProfilesError(missingProfilesMsg, true)
}

func (a *App) resolveProfilesDir() string {
	candidates := []string{}

	if envDir := strings.TrimSpace(os.Getenv(profilesDirEnvVar)); envDir != "" {
		candidates = append(candidates, envDir)
	}
	if exePath, err := executablePathFn(); err == nil {
		if siblingDir := siblingProfilesDirFromExecutable(exePath); siblingDir != "" {
			candidates = append(candidates, siblingDir)
		}
	}
	if wd, err := getwdFn(); err == nil {
		candidates = append(candidates, filepath.Join(wd, profilesFolderName))
	}

	for _, candidate := range candidates {
		normalized := normalizeDir(candidate)
		if isValidProfilesDir(normalized) {
			return normalized
		}
	}

	return ""
}

func (a *App) selectProfilesFolder(ctx context.Context) error {
	if ctx == nil {
		a.setProfilesError("application context is not ready yet", true)
		return errors.New("application context is not ready yet")
	}

	defaultDirectory := a.defaultProfilesDirectoryForDialog()
	dialogOptions := wailsruntime.OpenDialogOptions{
		Title:                "Select Profiles Folder",
		DefaultDirectory:     defaultDirectory,
		CanCreateDirectories: true,
	}

	selectedDirectory, err := wailsruntime.OpenDirectoryDialog(ctx, dialogOptions)
	if err != nil {
		a.setProfilesError(fmt.Sprintf("failed to open folder picker: %v", err), true)
		return err
	}
	if strings.TrimSpace(selectedDirectory) == "" {
		a.setProfilesError(selectionErrorMsg, true)
		return errProfilesSelectionCancelled
	}

	selectedDirectory = normalizeDir(selectedDirectory)
	if err := a.loadProfilesFromDir(selectedDirectory); err != nil {
		a.setProfilesError(fmt.Sprintf("%s: %v", invalidProfilesMsg, err), true)
		return err
	}

	return nil
}

func (a *App) defaultProfilesDirectoryForDialog() string {
	a.mu.RLock()
	current := a.profilesDir
	a.mu.RUnlock()

	if dirExists(current) {
		return current
	}

	return ""
}

func (a *App) loadProfilesFromDir(profilesDir string) error {
	normalized := normalizeDir(profilesDir)
	profiles, files, profileErrors, err := readProfilesFromDir(normalized)
	if err != nil {
		return err
	}

	sources := make([]string, len(profiles))
	for i := range sources {
		sources[i] = profileSourceDefault
	}

	// Derive user profiles dir as sibling "user profiles" folder
	userDir := filepath.Join(filepath.Dir(normalized), userProfilesFolderName)
	userDir = normalizeDir(userDir)

	if dirExists(userDir) {
		userProfiles, userFiles, userErrors, userErr := readProfilesFromDir(userDir)
		if userErr == nil {
			profiles, files, profileErrors, sources = combineProfiles(
				profiles, files, profileErrors,
				userProfiles, userFiles, userErrors,
			)
		}
	}

	a.mu.Lock()
	a.profilesDir = normalized
	a.userProfilesDir = userDir
	a.profiles = profiles
	a.profileFiles = files
	a.profileErrors = profileErrors
	a.profileSources = sources
	a.profilesLoadErr = ""
	a.needsProfilesSelection = false
	a.mu.Unlock()

	return nil
}

func (a *App) setProfilesError(errMessage string, needsSelection bool) {
	a.mu.Lock()
	a.profilesLoadErr = errMessage
	a.needsProfilesSelection = needsSelection
	a.mu.Unlock()
}

func readProfilesFromDir(profilesDir string) ([]pkg.Profile, []string, []string, error) {
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

// combineProfiles appends default and user profiles into a single sorted list.
// Both directories may contain files with the same name — both are kept and
// distinguished by their source tag ("default" or "user").
func combineProfiles(
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
			source:  profileSourceDefault,
			sortKey: strings.ToLower(filepath.Base(file)),
		})
	}

	for i, file := range userFiles {
		entries = append(entries, entry{
			profile: userProfiles[i],
			file:    file,
			err:     userErrors[i],
			source:  profileSourceUser,
			sortKey: strings.ToLower(filepath.Base(file)),
		})
	}

	sort.SliceStable(entries, func(i, j int) bool {
		return entries[i].sortKey < entries[j].sortKey
	})

	profiles := make([]pkg.Profile, 0, total)
	files := make([]string, 0, total)
	errors := make([]string, 0, total)
	sources := make([]string, 0, total)

	for _, e := range entries {
		profiles = append(profiles, e.profile)
		files = append(files, e.file)
		errors = append(errors, e.err)
		sources = append(sources, e.source)
	}

	return profiles, files, errors, sources
}

func isValidProfilesDir(profilesDir string) bool {
	if !dirExists(profilesDir) {
		return false
	}

	entries, err := os.ReadDir(profilesDir)
	if err != nil {
		return false
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.EqualFold(filepath.Ext(entry.Name()), ".yaml") {
			return true
		}
	}

	return false
}

func dirExists(directory string) bool {
	if strings.TrimSpace(directory) == "" {
		return false
	}

	info, err := os.Stat(directory)
	if err != nil {
		return false
	}

	return info.IsDir()
}

func normalizeDir(directory string) string {
	if strings.TrimSpace(directory) == "" {
		return ""
	}

	if abs, err := filepath.Abs(directory); err == nil {
		return filepath.Clean(abs)
	}

	return filepath.Clean(directory)
}

func normalizeProfileFilename(filename string) (string, error) {
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

func sanitizeProfileForSave(profile pkg.Profile) (pkg.Profile, error) {
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

func siblingProfilesDirFromExecutable(executablePath string) string {
	if strings.TrimSpace(executablePath) == "" {
		return ""
	}

	currentDir := filepath.Dir(filepath.Clean(executablePath))
	for {
		if strings.HasSuffix(currentDir, ".app") {
			return filepath.Join(filepath.Dir(currentDir), profilesFolderName)
		}

		parentDir := filepath.Dir(currentDir)
		if parentDir == currentDir {
			break
		}
		currentDir = parentDir
	}

	return filepath.Join(filepath.Dir(filepath.Clean(executablePath)), profilesFolderName)
}

func (a *App) GetXplane() []string {
	//GET http://localhost:8086/api/v1/datarefs
	datarefIds := []int64{
		getDatarefId("sim/aircraft/view/acf_ICAO"),
		getDatarefId("sim/aircraft/view/acf_ui_name"),
	}
	res := []string{}
	for _, id := range datarefIds {
		body := getDatarefValue(id)
		res = append(res, body)
	}
	return res
}

func (a *App) GetXplaneDataref(datarefStr string) string {
	id := getDatarefId(datarefStr)
	res := getDatarefValue(id)
	return res
}

func getDatarefId(datarefStr string) int64 {
	// URL for the GET request
	url := fmt.Sprintf("http://localhost:8086/api/v1/datarefs?filter[name]=%s", datarefStr)

	// Create a new HTTP client
	client := &http.Client{Timeout: 2 * time.Second}

	// Create a new GET request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println("Error creating request:", err)
		return 0
	}

	// Set headers if needed
	req.Header.Set("Accept", "application/json")

	// Execute the request
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error executing request:", err)
		return 0
	}
	defer resp.Body.Close()

	// Check the response status
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Error: Status code %d\n", resp.StatusCode)
		return 0
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return 0
	}

	var response ListResponse
	if err := json.Unmarshal(body, &response); err != nil {
		fmt.Println("Error parsing JSON:", err)
		return 0
	}
	if len(response.Data) == 0 {
		return 0
	}
	return response.Data[0].ID
}

func getDatarefValue(id int64) string {
	if id <= 0 {
		return ""
	}

	// URL for the GET request
	url := fmt.Sprintf("http://localhost:8086/api/v1/datarefs/%d/value", id)

	// Create a new HTTP client
	client := &http.Client{Timeout: 2 * time.Second}

	// Create a new GET request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println("Error creating request:", err)
		return ""
	}

	// Set headers if needed
	req.Header.Set("Accept", "application/json")

	// Execute the request
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error executing request:", err)
		return ""
	}
	defer resp.Body.Close()

	// Check the response status
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Error: Status code %d\n", resp.StatusCode)
		return ""
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return ""
	}

	return string(body)
}
