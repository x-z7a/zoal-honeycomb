package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/x-z7a/zoal-honeycomb/pkg"
	"gopkg.in/yaml.v3"
)

func TestNewAppNeverReturnsNil(t *testing.T) {
	if NewApp() == nil {
		t.Fatal("NewApp returned nil")
	}
}

func TestReadProfilesFromDirLoadsYamlAndIgnoresNonYaml(t *testing.T) {
	profilesDir := t.TempDir()
	writeProfileYAML(t, profilesDir, "default.yaml", "Default")
	writeProfileYAML(t, profilesDir, "A319.yaml", "A319")
	if err := os.WriteFile(filepath.Join(profilesDir, "notes.txt"), []byte("ignore me"), 0o644); err != nil {
		t.Fatalf("failed to write notes file: %v", err)
	}

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	files := app.GetProfileFiles()
	if len(files) != 2 {
		t.Fatalf("expected 2 profile files, got %d", len(files))
	}
	for _, file := range files {
		if filepath.Ext(file) != ".yaml" {
			t.Fatalf("expected .yaml file, got %q", file)
		}
	}

	status := app.GetProfilesStatus()
	if status.ProfilesCount != 2 {
		t.Fatalf("expected profilesCount=2, got %d", status.ProfilesCount)
	}
	if status.NeedsSelection {
		t.Fatalf("expected needsSelection=false after successful load")
	}
}

func TestResolveProfilesDirUsesEnvVarFirst(t *testing.T) {
	restoreFns := stubPathFns(t)
	defer restoreFns()

	envProfiles := createProfilesDir(t, "env")

	t.Setenv(profilesDirEnvVar, envProfiles)
	executablePathFn = func() (string, error) { return filepath.Join(t.TempDir(), "bravo"), nil }
	getwdFn = func() (string, error) { return t.TempDir(), nil }

	app := NewApp()
	got := app.resolveProfilesDir()
	if got != normalizeDir(envProfiles) {
		t.Fatalf("expected env profiles dir %q, got %q", normalizeDir(envProfiles), got)
	}
}

func TestResolveProfilesDirUsesSiblingProfilesNextToApp(t *testing.T) {
	restoreFns := stubPathFns(t)
	defer restoreFns()

	t.Setenv(profilesDirEnvVar, "")

	root := t.TempDir()
	appRoot := filepath.Join(root, "release")
	executablePath := filepath.Join(appRoot, "bravo.app", "Contents", "MacOS", "bravo")
	if err := os.MkdirAll(filepath.Dir(executablePath), 0o755); err != nil {
		t.Fatalf("failed to create app executable dir: %v", err)
	}
	if err := os.WriteFile(executablePath, []byte(""), 0o755); err != nil {
		t.Fatalf("failed to create executable: %v", err)
	}

	siblingProfiles := createProfilesDirAtPath(t, filepath.Join(appRoot, profilesFolderName), "default")
	executablePathFn = func() (string, error) { return executablePath, nil }
	getwdFn = func() (string, error) { return filepath.Join(t.TempDir(), "missing-cwd"), nil }

	app := NewApp()
	got := app.resolveProfilesDir()
	if got != normalizeDir(siblingProfiles) {
		t.Fatalf("expected sibling profiles dir %q, got %q", normalizeDir(siblingProfiles), got)
	}
}

func TestResolveProfilesDirFallsBackToCwdProfiles(t *testing.T) {
	restoreFns := stubPathFns(t)
	defer restoreFns()

	t.Setenv(profilesDirEnvVar, filepath.Join(t.TempDir(), "invalid-env"))

	executablePathFn = func() (string, error) {
		return filepath.Join(t.TempDir(), "release", "bravo.app", "Contents", "MacOS", "bravo"), nil
	}

	cwd := t.TempDir()
	cwdProfiles := createProfilesDirAtPath(t, filepath.Join(cwd, profilesFolderName), "default")
	getwdFn = func() (string, error) { return cwd, nil }

	app := NewApp()
	got := app.resolveProfilesDir()
	if got != normalizeDir(cwdProfiles) {
		t.Fatalf("expected cwd fallback profiles dir %q, got %q", normalizeDir(cwdProfiles), got)
	}
}

func TestSaveProfileByIndexDoesNotMarshalRuntimeFunctionFields(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, profilesFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	content := []byte(strings.TrimSpace(`
metadata:
  name: A319
leds:
  hdg:
    datarefs:
      - dataref_str: "sim/cockpit2/autopilot/heading_mode"
        operator: "=="
        threshold: 1
`) + "\n")
	if err := os.WriteFile(filepath.Join(profilesDir, "A319.yaml"), content, 0o644); err != nil {
		t.Fatalf("failed to write profile yaml: %v", err)
	}

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	profiles := app.GetProfiles()
	if len(profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(profiles))
	}
	if profiles[0].Leds == nil {
		t.Fatalf("expected leds section to be populated")
	}
	// Runtime-only function fields must never leak into saved YAML.
	profiles[0].Leds.HDG.On = func() {}
	profiles[0].Leds.HDG.Off = func() {}

	if err := app.SaveProfileByIndex(0, profiles[0]); err != nil {
		t.Fatalf("SaveProfileByIndex returned error: %v", err)
	}

	// Save now writes to "user profiles" directory
	userProfilesDir := filepath.Join(root, userProfilesFolderName)
	saved, err := os.ReadFile(filepath.Join(userProfilesDir, "A319.yaml"))
	if err != nil {
		t.Fatalf("failed to read saved profile yaml: %v", err)
	}

	savedText := string(saved)
	if strings.Contains(savedText, "On:") || strings.Contains(savedText, "Off:") {
		t.Fatalf("saved yaml should not contain runtime function fields, got:\n%s", savedText)
	}
}

func TestSaveProfileByIndexPersistsZeroThreshold(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, profilesFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	content := []byte(strings.TrimSpace(`
metadata:
  name: A319
leds:
  gear:
    datarefs:
      - dataref_str: "sim/flightmodel2/gear/deploy_ratio"
        operator: "!="
`) + "\n")
	if err := os.WriteFile(filepath.Join(profilesDir, "A319.yaml"), content, 0o644); err != nil {
		t.Fatalf("failed to write profile yaml: %v", err)
	}

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	profiles := app.GetProfiles()
	if len(profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(profiles))
	}
	if profiles[0].Leds == nil || len(profiles[0].Leds.GEAR.Datarefs) == 0 {
		t.Fatalf("expected gear led datarefs to be populated")
	}

	zero := float32(0)
	profiles[0].Leds.GEAR.Datarefs[0].Threshold = &zero

	if err := app.SaveProfileByIndex(0, profiles[0]); err != nil {
		t.Fatalf("SaveProfileByIndex returned error: %v", err)
	}

	// Save now writes to "user profiles" directory
	userProfilesDir := filepath.Join(root, userProfilesFolderName)
	saved, err := os.ReadFile(filepath.Join(userProfilesDir, "A319.yaml"))
	if err != nil {
		t.Fatalf("failed to read saved profile yaml: %v", err)
	}

	var savedProfile pkg.Profile
	if err := yaml.Unmarshal(saved, &savedProfile); err != nil {
		t.Fatalf("failed to parse saved profile yaml: %v", err)
	}

	if savedProfile.Leds == nil || len(savedProfile.Leds.GEAR.Datarefs) == 0 {
		t.Fatalf("expected saved gear datarefs to be populated")
	}
	if savedProfile.Leds.GEAR.Datarefs[0].Threshold == nil {
		t.Fatalf("expected threshold to be saved explicitly when set to zero")
	}
	if *savedProfile.Leds.GEAR.Datarefs[0].Threshold != 0 {
		t.Fatalf("expected threshold 0, got %v", *savedProfile.Leds.GEAR.Datarefs[0].Threshold)
	}
}

func TestCreateProfileFromDefaultCreatesProfileFromTemplate(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, profilesFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	defaultContent := []byte(strings.TrimSpace(`
metadata:
  name: Default Profile
  description: Template profile
  selectors:
    - default selector
buttons:
  hdg:
    single_click:
      - command_str: "sim/autopilot/heading"
`) + "\n")
	if err := os.WriteFile(filepath.Join(profilesDir, "default.yaml"), defaultContent, 0o644); err != nil {
		t.Fatalf("failed to write default template: %v", err)
	}

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	createdPath, err := app.CreateProfileFromDefault(
		"A320",
		"My A320",
		"Custom A320 profile",
		[]string{"A320 Neo", "A320 Neo", "", "A320 CEO"},
	)
	if err != nil {
		t.Fatalf("CreateProfileFromDefault returned error: %v", err)
	}

	if filepath.Base(createdPath) != "A320.yaml" {
		t.Fatalf("expected created file A320.yaml, got %q", filepath.Base(createdPath))
	}

	// New profiles are created in the "user profiles" directory
	userProfilesDir := filepath.Join(root, userProfilesFolderName)
	expectedDir := normalizeDir(userProfilesDir)
	if normalizeDir(filepath.Dir(createdPath)) != expectedDir {
		t.Fatalf("expected profile to be created in user profiles dir %q, got %q", expectedDir, filepath.Dir(createdPath))
	}

	savedContent, err := os.ReadFile(createdPath)
	if err != nil {
		t.Fatalf("failed to read created profile: %v", err)
	}

	var savedProfile pkg.Profile
	if err := yaml.Unmarshal(savedContent, &savedProfile); err != nil {
		t.Fatalf("failed to parse created profile: %v", err)
	}

	if savedProfile.Metadata == nil {
		t.Fatalf("expected metadata to be populated")
	}
	if savedProfile.Metadata.Name != "My A320" {
		t.Fatalf("expected metadata.name to be %q, got %q", "My A320", savedProfile.Metadata.Name)
	}
	if savedProfile.Metadata.Description != "Custom A320 profile" {
		t.Fatalf("expected metadata.description to be %q, got %q", "Custom A320 profile", savedProfile.Metadata.Description)
	}
	if len(savedProfile.Metadata.Selectors) != 2 {
		t.Fatalf("expected 2 unique selectors, got %d", len(savedProfile.Metadata.Selectors))
	}
	if savedProfile.Metadata.Selectors[0] != "A320 Neo" || savedProfile.Metadata.Selectors[1] != "A320 CEO" {
		t.Fatalf("unexpected selectors order/content: %#v", savedProfile.Metadata.Selectors)
	}
	if savedProfile.Buttons == nil {
		t.Fatalf("expected template sections to be copied from default.yaml")
	}
}

func TestReadProfilesFromDirSkipsBrokenYamlAndLoadsRest(t *testing.T) {
	profilesDir := t.TempDir()
	writeProfileYAML(t, profilesDir, "A319.yaml", "A319")
	if err := os.WriteFile(filepath.Join(profilesDir, "Broken.yaml"), []byte("bad: [unclosed"), 0o644); err != nil {
		t.Fatalf("failed to write broken yaml: %v", err)
	}
	writeProfileYAML(t, profilesDir, "default.yaml", "Default")

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	profiles := app.GetProfiles()
	files := app.GetProfileFiles()
	errors := app.GetProfileErrors()
	if len(profiles) != 3 {
		t.Fatalf("expected 3 profiles (including broken), got %d", len(profiles))
	}
	if len(files) != 3 {
		t.Fatalf("expected 3 profile files, got %d", len(files))
	}
	if len(errors) != 3 {
		t.Fatalf("expected 3 profile errors, got %d", len(errors))
	}

	// A319.yaml is OK
	if errors[0] != "" {
		t.Fatalf("expected no error for A319.yaml, got %q", errors[0])
	}
	if profiles[0].Metadata == nil || profiles[0].Metadata.Name != "A319" {
		t.Fatalf("expected A319 metadata, got %v", profiles[0].Metadata)
	}

	// Broken.yaml has parse error
	if errors[1] == "" {
		t.Fatalf("expected parse error for Broken.yaml, got empty string")
	}
	if !strings.Contains(errors[1], "YAML syntax error") {
		t.Fatalf("expected YAML syntax error message, got %q", errors[1])
	}

	// default.yaml is OK
	if errors[2] != "" {
		t.Fatalf("expected no error for default.yaml, got %q", errors[2])
	}

	status := app.GetProfilesStatus()
	if status.NeedsSelection {
		t.Fatalf("expected needsSelection=false when profiles dir is valid")
	}
	if status.ParseErrors != 1 {
		t.Fatalf("expected parseErrors=1, got %d", status.ParseErrors)
	}
	if status.ProfilesCount != 3 {
		t.Fatalf("expected profilesCount=3, got %d", status.ProfilesCount)
	}
}

func TestCreateProfileFromDefaultErrorsWhenTemplateMissing(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, profilesFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	writeProfileYAML(t, profilesDir, "A319.yaml", "A319")

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	_, err := app.CreateProfileFromDefault("A320", "My A320", "", []string{"A320"})
	if err == nil {
		t.Fatalf("expected error when default.yaml template is missing")
	}
	if !strings.Contains(err.Error(), "default.yaml") {
		t.Fatalf("expected error to mention default.yaml, got: %v", err)
	}
}

func stubPathFns(t *testing.T) func() {
	t.Helper()

	originalExecutableFn := executablePathFn
	originalGetwdFn := getwdFn

	return func() {
		executablePathFn = originalExecutableFn
		getwdFn = originalGetwdFn
	}
}

func createProfilesDir(t *testing.T, profileName string) string {
	t.Helper()
	return createProfilesDirAtPath(t, filepath.Join(t.TempDir(), profileName), profileName)
}

func createProfilesDirAtPath(t *testing.T, profilesDir string, profileName string) string {
	t.Helper()

	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	writeProfileYAML(t, profilesDir, profileName+".yaml", profileName)
	return profilesDir
}

func writeProfileYAML(t *testing.T, profilesDir string, filename string, profileName string) {
	t.Helper()

	content := []byte("metadata:\n  name: " + profileName + "\n")
	if err := os.WriteFile(filepath.Join(profilesDir, filename), content, 0o644); err != nil {
		t.Fatalf("failed to write profile yaml %q: %v", filename, err)
	}
}

func TestUserAndDefaultProfilesBothAppear(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, profilesFolderName)
	userProfilesDir := filepath.Join(root, userProfilesFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	if err := os.MkdirAll(userProfilesDir, 0o755); err != nil {
		t.Fatalf("failed to create user profiles dir: %v", err)
	}

	writeProfileYAML(t, profilesDir, "A319.yaml", "Default A319")
	writeProfileYAML(t, profilesDir, "default.yaml", "Default")
	writeProfileYAML(t, userProfilesDir, "A319.yaml", "User A319")

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	profiles := app.GetProfiles()
	sources := app.GetProfileSources()

	// Both the default A319 and user A319 should appear (3 total)
	if len(profiles) != 3 {
		t.Fatalf("expected 3 combined profiles (2 default + 1 user), got %d", len(profiles))
	}

	defaultA319Found := false
	userA319Found := false
	for i, p := range profiles {
		if p.Metadata == nil {
			continue
		}
		if p.Metadata.Name == "Default A319" && sources[i] == profileSourceDefault {
			defaultA319Found = true
		}
		if p.Metadata.Name == "User A319" && sources[i] == profileSourceUser {
			userA319Found = true
		}
	}
	if !defaultA319Found {
		t.Fatalf("expected Default A319 with source 'default' in combined list")
	}
	if !userA319Found {
		t.Fatalf("expected User A319 with source 'user' in combined list")
	}
}

func TestUserProfilesOnlyInUserDir(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, profilesFolderName)
	userProfilesDir := filepath.Join(root, userProfilesFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	if err := os.MkdirAll(userProfilesDir, 0o755); err != nil {
		t.Fatalf("failed to create user profiles dir: %v", err)
	}

	writeProfileYAML(t, profilesDir, "default.yaml", "Default")
	writeProfileYAML(t, userProfilesDir, "Custom.yaml", "Custom User Profile")

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	profiles := app.GetProfiles()
	sources := app.GetProfileSources()

	if len(profiles) != 2 {
		t.Fatalf("expected 2 profiles (1 default + 1 user-only), got %d", len(profiles))
	}

	// Find the custom profile
	found := false
	for i, p := range profiles {
		if p.Metadata != nil && p.Metadata.Name == "Custom User Profile" {
			found = true
			if sources[i] != profileSourceUser {
				t.Fatalf("expected source 'user' for Custom profile, got %q", sources[i])
			}
		}
	}
	if !found {
		t.Fatalf("Custom User Profile not found in merged results")
	}
}

func TestSaveProfileByIndexWritesToUserProfilesDir(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, profilesFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	writeProfileYAML(t, profilesDir, "A319.yaml", "A319")

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	sources := app.GetProfileSources()
	if sources[0] != profileSourceDefault {
		t.Fatalf("expected initial source 'default', got %q", sources[0])
	}

	profiles := app.GetProfiles()
	if err := app.SaveProfileByIndex(0, profiles[0]); err != nil {
		t.Fatalf("SaveProfileByIndex returned error: %v", err)
	}

	// Verify file was saved to user profiles dir
	userProfilesDir := filepath.Join(root, userProfilesFolderName)
	if _, err := os.Stat(filepath.Join(userProfilesDir, "A319.yaml")); err != nil {
		t.Fatalf("expected A319.yaml to exist in user profiles dir: %v", err)
	}

	// Source should now be "user"
	sources = app.GetProfileSources()
	if sources[0] != profileSourceUser {
		t.Fatalf("expected source 'user' after save, got %q", sources[0])
	}

	// File path should now point to user profiles
	files := app.GetProfileFiles()
	if !strings.Contains(files[0], userProfilesFolderName) {
		t.Fatalf("expected file path to contain %q, got %q", userProfilesFolderName, files[0])
	}
}

func TestLoadWithNoUserProfilesDirStillWorks(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, profilesFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	writeProfileYAML(t, profilesDir, "default.yaml", "Default")

	app := NewApp()
	if err := app.loadProfilesFromDir(profilesDir); err != nil {
		t.Fatalf("loadProfilesFromDir returned error: %v", err)
	}

	profiles := app.GetProfiles()
	sources := app.GetProfileSources()

	if len(profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(profiles))
	}
	if sources[0] != profileSourceDefault {
		t.Fatalf("expected source 'default', got %q", sources[0])
	}
}
