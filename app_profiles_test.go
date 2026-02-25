package main

import (
	"os"
	"path/filepath"
	"testing"
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
