package profilestore

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/x-z7a/zoal-honeycomb/pkg"
	"gopkg.in/yaml.v3"
)

func TestReloadLoadsYamlAndIgnoresNonYaml(t *testing.T) {
	profilesDir := t.TempDir()
	writeProfileYAML(t, profilesDir, "default.yaml", "Default")
	writeProfileYAML(t, profilesDir, "A319.yaml", "A319")
	if err := os.WriteFile(filepath.Join(profilesDir, "notes.txt"), []byte("ignore me"), 0o644); err != nil {
		t.Fatalf("failed to write notes file: %v", err)
	}

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	files := store.Files()
	if len(files) != 2 {
		t.Fatalf("expected 2 profile files, got %d", len(files))
	}
	for _, file := range files {
		if filepath.Ext(file) != ".yaml" {
			t.Fatalf("expected .yaml file, got %q", file)
		}
	}

	status := store.Status()
	if status.ProfilesCount != 2 {
		t.Fatalf("expected profilesCount=2, got %d", status.ProfilesCount)
	}
}

func TestSaveDoesNotMarshalRuntimeFunctionFields(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, FolderName)
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

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	profiles := store.Profiles()
	if len(profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(profiles))
	}
	if profiles[0].Leds == nil {
		t.Fatalf("expected leds section to be populated")
	}
	// Runtime-only function fields must never leak into saved YAML.
	profiles[0].Leds.HDG.On = func() {}
	profiles[0].Leds.HDG.Off = func() {}

	if err := store.Save(0, profiles[0]); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	// Save now writes to "user profiles" directory
	userProfilesDir := filepath.Join(root, UserFolderName)
	saved, err := os.ReadFile(filepath.Join(userProfilesDir, "A319.yaml"))
	if err != nil {
		t.Fatalf("failed to read saved profile yaml: %v", err)
	}

	savedText := string(saved)
	if strings.Contains(savedText, "On:") || strings.Contains(savedText, "Off:") {
		t.Fatalf("saved yaml should not contain runtime function fields, got:\n%s", savedText)
	}
}

func TestSavePersistsZeroThreshold(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, FolderName)
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

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	profiles := store.Profiles()
	if len(profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(profiles))
	}
	if profiles[0].Leds == nil || len(profiles[0].Leds.GEAR.Datarefs) == 0 {
		t.Fatalf("expected gear led datarefs to be populated")
	}

	zero := float32(0)
	profiles[0].Leds.GEAR.Datarefs[0].Threshold = &zero

	if err := store.Save(0, profiles[0]); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	// Save now writes to "user profiles" directory
	userProfilesDir := filepath.Join(root, UserFolderName)
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

func TestCreateFromDefaultCreatesProfileFromTemplate(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, FolderName)
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

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	createdPath, err := store.CreateFromDefault(
		"A320",
		"My A320",
		"Custom A320 profile",
		[]string{"A320 Neo", "A320 Neo", "", "A320 CEO"},
	)
	if err != nil {
		t.Fatalf("CreateFromDefault returned error: %v", err)
	}

	if filepath.Base(createdPath) != "A320.yaml" {
		t.Fatalf("expected created file A320.yaml, got %q", filepath.Base(createdPath))
	}

	// New profiles are created in the "user profiles" directory
	userProfilesDir := filepath.Join(root, UserFolderName)
	expectedDir := filepath.Clean(userProfilesDir)
	if filepath.Clean(filepath.Dir(createdPath)) != expectedDir {
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

func TestReloadSkipsBrokenYamlAndLoadsRest(t *testing.T) {
	profilesDir := t.TempDir()
	writeProfileYAML(t, profilesDir, "A319.yaml", "A319")
	if err := os.WriteFile(filepath.Join(profilesDir, "Broken.yaml"), []byte("bad: [unclosed"), 0o644); err != nil {
		t.Fatalf("failed to write broken yaml: %v", err)
	}
	writeProfileYAML(t, profilesDir, "default.yaml", "Default")

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	profiles := store.Profiles()
	files := store.Files()
	errors := store.Errors()
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

	status := store.Status()
	if status.ParseErrors != 1 {
		t.Fatalf("expected parseErrors=1, got %d", status.ParseErrors)
	}
	if status.ProfilesCount != 3 {
		t.Fatalf("expected profilesCount=3, got %d", status.ProfilesCount)
	}
}

func TestCreateFromDefaultErrorsWhenTemplateMissing(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, FolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	writeProfileYAML(t, profilesDir, "A319.yaml", "A319")

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	_, err := store.CreateFromDefault("A320", "My A320", "", []string{"A320"})
	if err == nil {
		t.Fatalf("expected error when default.yaml template is missing")
	}
	if !strings.Contains(err.Error(), "default.yaml") {
		t.Fatalf("expected error to mention default.yaml, got: %v", err)
	}
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
	profilesDir := filepath.Join(root, FolderName)
	userProfilesDir := filepath.Join(root, UserFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	if err := os.MkdirAll(userProfilesDir, 0o755); err != nil {
		t.Fatalf("failed to create user profiles dir: %v", err)
	}

	writeProfileYAML(t, profilesDir, "A319.yaml", "Default A319")
	writeProfileYAML(t, profilesDir, "default.yaml", "Default")
	writeProfileYAML(t, userProfilesDir, "A319.yaml", "User A319")

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	profiles := store.Profiles()
	sources := store.Sources()

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
		if p.Metadata.Name == "Default A319" && sources[i] == SourceDefault {
			defaultA319Found = true
		}
		if p.Metadata.Name == "User A319" && sources[i] == SourceUser {
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
	profilesDir := filepath.Join(root, FolderName)
	userProfilesDir := filepath.Join(root, UserFolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	if err := os.MkdirAll(userProfilesDir, 0o755); err != nil {
		t.Fatalf("failed to create user profiles dir: %v", err)
	}

	writeProfileYAML(t, profilesDir, "default.yaml", "Default")
	writeProfileYAML(t, userProfilesDir, "Custom.yaml", "Custom User Profile")

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	profiles := store.Profiles()
	sources := store.Sources()

	if len(profiles) != 2 {
		t.Fatalf("expected 2 profiles (1 default + 1 user-only), got %d", len(profiles))
	}

	// Find the custom profile
	found := false
	for i, p := range profiles {
		if p.Metadata != nil && p.Metadata.Name == "Custom User Profile" {
			found = true
			if sources[i] != SourceUser {
				t.Fatalf("expected source 'user' for Custom profile, got %q", sources[i])
			}
		}
	}
	if !found {
		t.Fatalf("Custom User Profile not found in merged results")
	}
}

func TestSaveWritesToUserProfilesDir(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, FolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	writeProfileYAML(t, profilesDir, "A319.yaml", "A319")

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	sources := store.Sources()
	if sources[0] != SourceDefault {
		t.Fatalf("expected initial source 'default', got %q", sources[0])
	}

	profiles := store.Profiles()
	if err := store.Save(0, profiles[0]); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	// Verify file was saved to user profiles dir
	userProfilesDir := filepath.Join(root, UserFolderName)
	if _, err := os.Stat(filepath.Join(userProfilesDir, "A319.yaml")); err != nil {
		t.Fatalf("expected A319.yaml to exist in user profiles dir: %v", err)
	}

	// Source should now be "user"
	sources = store.Sources()
	if sources[0] != SourceUser {
		t.Fatalf("expected source 'user' after save, got %q", sources[0])
	}

	// File path should now point to user profiles
	files := store.Files()
	if !strings.Contains(files[0], UserFolderName) {
		t.Fatalf("expected file path to contain %q, got %q", UserFolderName, files[0])
	}
}

func TestLoadWithNoUserProfilesDirStillWorks(t *testing.T) {
	root := t.TempDir()
	profilesDir := filepath.Join(root, FolderName)
	if err := os.MkdirAll(profilesDir, 0o755); err != nil {
		t.Fatalf("failed to create profiles dir: %v", err)
	}
	writeProfileYAML(t, profilesDir, "default.yaml", "Default")

	store := New(profilesDir)
	if err := store.Reload(); err != nil {
		t.Fatalf("Reload returned error: %v", err)
	}

	profiles := store.Profiles()
	sources := store.Sources()

	if len(profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(profiles))
	}
	if sources[0] != SourceDefault {
		t.Fatalf("expected source 'default', got %q", sources[0])
	}
}
