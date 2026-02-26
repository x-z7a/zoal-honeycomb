package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/xairline/xa-honeycomb/pkg"
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
	profilesDir := t.TempDir()
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

	saved, err := os.ReadFile(filepath.Join(profilesDir, "A319.yaml"))
	if err != nil {
		t.Fatalf("failed to read saved profile yaml: %v", err)
	}

	savedText := string(saved)
	if strings.Contains(savedText, "On:") || strings.Contains(savedText, "Off:") {
		t.Fatalf("saved yaml should not contain runtime function fields, got:\n%s", savedText)
	}
}

func TestCreateProfileFromDefaultCreatesProfileFromTemplate(t *testing.T) {
	profilesDir := t.TempDir()
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

func TestCreateProfileFromDefaultErrorsWhenTemplateMissing(t *testing.T) {
	profilesDir := t.TempDir()
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
