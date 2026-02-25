package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/xairline/xa-honeycomb/pkg"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"gopkg.in/yaml.v3"
)

const (
	profilesDirEnvVar  = "ZOAL_PROFILES_DIR"
	profilesFolderName = "profiles"
	configDirName      = "zoal-honeycomb"
	configFileName     = "config.json"
	selectionErrorMsg  = "no profiles folder selected. Please select a folder containing YAML profiles"
	missingProfilesMsg = "profiles folder not found. Please select your external profiles folder"
	invalidProfilesMsg = "selected folder does not contain valid YAML profiles"
)

var (
	executablePathFn = os.Executable
	getwdFn          = os.Getwd
	userConfigDirFn  = os.UserConfigDir

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
	ProfilesDir    string `json:"profilesDir"`
	ProfilesCount  int    `json:"profilesCount"`
	NeedsSelection bool   `json:"needsSelection"`
	LoadError      string `json:"loadError"`
}

type appConfig struct {
	ProfilesDir string `json:"profiles_dir"`
}

// App struct
type App struct {
	ctx                    context.Context
	profilesDir            string
	profiles               []pkg.Profile
	profileFiles           []string
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

func (a *App) GetProfilesStatus() ProfilesStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()

	return ProfilesStatus{
		ProfilesDir:    a.profilesDir,
		ProfilesCount:  len(a.profiles),
		NeedsSelection: a.needsProfilesSelection,
		LoadError:      a.profilesLoadErr,
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

	fileName := a.profileFiles[index]
	output, err := yaml.Marshal(profile)
	if err != nil {
		return err
	}

	err = os.WriteFile(fileName, output, 0o644)
	if err != nil {
		return err
	}

	a.profiles[index] = profile
	return nil
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
	if persistedDir := loadPersistedProfilesDir(); persistedDir != "" {
		candidates = append(candidates, persistedDir)
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

	if err := savePersistedProfilesDir(selectedDirectory); err != nil {
		a.setProfilesError(fmt.Sprintf("profiles loaded, but failed to persist folder: %v", err), false)
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
	if persistedDir := loadPersistedProfilesDir(); dirExists(persistedDir) {
		return persistedDir
	}

	return ""
}

func (a *App) loadProfilesFromDir(profilesDir string) error {
	normalized := normalizeDir(profilesDir)
	profiles, files, err := readProfilesFromDir(normalized)
	if err != nil {
		return err
	}

	a.mu.Lock()
	a.profilesDir = normalized
	a.profiles = profiles
	a.profileFiles = files
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

func readProfilesFromDir(profilesDir string) ([]pkg.Profile, []string, error) {
	entries, err := os.ReadDir(profilesDir)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read profiles folder %q: %w", profilesDir, err)
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
		return nil, nil, errors.New("profiles folder does not contain any .yaml files")
	}

	profiles := make([]pkg.Profile, 0, len(yamlFiles))
	profileFiles := make([]string, 0, len(yamlFiles))
	for _, yamlFile := range yamlFiles {
		fileName := filepath.Join(profilesDir, yamlFile)
		content, err := os.ReadFile(fileName)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to read profile %q: %w", fileName, err)
		}

		var profile pkg.Profile
		if err := yaml.Unmarshal(content, &profile); err != nil {
			return nil, nil, fmt.Errorf("failed to parse profile %q: %w", fileName, err)
		}

		profiles = append(profiles, profile)
		profileFiles = append(profileFiles, fileName)
	}

	return profiles, profileFiles, nil
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

func configFilePath() (string, error) {
	configRoot, err := userConfigDirFn()
	if err != nil {
		return "", err
	}

	return filepath.Join(configRoot, configDirName, configFileName), nil
}

func loadPersistedProfilesDir() string {
	configPath, err := configFilePath()
	if err != nil {
		return ""
	}

	content, err := os.ReadFile(configPath)
	if err != nil {
		return ""
	}

	var cfg appConfig
	if err := json.Unmarshal(content, &cfg); err != nil {
		return ""
	}

	return normalizeDir(cfg.ProfilesDir)
}

func savePersistedProfilesDir(profilesDir string) error {
	configPath, err := configFilePath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(configPath), 0o755); err != nil {
		return err
	}

	cfg := appConfig{
		ProfilesDir: normalizeDir(profilesDir),
	}

	content, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, content, 0o644)
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
