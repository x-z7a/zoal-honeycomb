package main

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	beginMarker = "<!-- BEGIN GENERATED SUPPORTED PLANES -->"
	endMarker   = "<!-- END GENERATED SUPPORTED PLANES -->"
)

type profileYAML struct {
	Metadata struct {
		Name      string   `yaml:"name"`
		Selectors []string `yaml:"selectors"`
	} `yaml:"metadata"`
}

type profileEntry struct {
	FileName    string
	DisplayName string
	Selectors   []string
}

func main() {
	repoRoot, err := findRepoRoot()
	if err != nil {
		exitWithError(err)
	}

	profiles, err := loadProfiles(filepath.Join(repoRoot, "profiles"))
	if err != nil {
		exitWithError(err)
	}

	outputPath := filepath.Join(repoRoot, "docs", "supported-planes.md")
	if err := updateGeneratedSection(outputPath, renderGeneratedSection(profiles)); err != nil {
		exitWithError(err)
	}
}

func exitWithError(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}

func findRepoRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("get working directory: %w", err)
	}

	current := wd
	for {
		if fileExists(filepath.Join(current, "go.mod")) &&
			dirExists(filepath.Join(current, "profiles")) &&
			fileExists(filepath.Join(current, "docs", "supported-planes.md")) {
			return current, nil
		}

		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}

	return "", errors.New("could not locate repository root from current working directory")
}

func loadProfiles(profilesDir string) ([]profileEntry, error) {
	entries, err := os.ReadDir(profilesDir)
	if err != nil {
		return nil, fmt.Errorf("read profiles directory: %w", err)
	}

	profiles := make([]profileEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if !strings.EqualFold(filepath.Ext(entry.Name()), ".yaml") {
			continue
		}
		if strings.EqualFold(entry.Name(), "default.yaml") {
			continue
		}

		filePath := filepath.Join(profilesDir, entry.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("read profile %q: %w", filePath, err)
		}

		var parsed profileYAML
		if err := yaml.Unmarshal(content, &parsed); err != nil {
			return nil, fmt.Errorf("parse profile %q: %w", filePath, err)
		}

		profiles = append(profiles, profileEntry{
			FileName:    entry.Name(),
			DisplayName: strings.TrimSpace(parsed.Metadata.Name),
			Selectors:   normalizeSelectors(parsed.Metadata.Selectors),
		})
	}

	sort.Slice(profiles, func(i, j int) bool {
		return profiles[i].FileName < profiles[j].FileName
	})

	return profiles, nil
}

func normalizeSelectors(selectors []string) []string {
	normalized := make([]string, 0, len(selectors))
	for _, selector := range selectors {
		trimmed := strings.TrimSpace(selector)
		if trimmed == "" {
			continue
		}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func renderGeneratedSection(profiles []profileEntry) string {
	var body strings.Builder
	body.WriteString(fmt.Sprintf("There are currently `%d` profile files. The `Matches` column shows the exact\n", len(profiles)))
	body.WriteString("`metadata.selectors` values used by runtime profile selection, so a single\n")
	body.WriteString("profile can cover multiple aircraft variants.\n\n")
	body.WriteString("| Profile file | Display name | Matches (`metadata.selectors`) |\n")
	body.WriteString("| --- | --- | --- |\n")

	for _, profile := range profiles {
		body.WriteString("| `")
		body.WriteString(escapeInlineCode(profile.FileName))
		body.WriteString("` | ")
		body.WriteString(renderCell(profile.DisplayName))
		body.WriteString(" | ")
		body.WriteString(renderSelectors(profile.Selectors))
		body.WriteString(" |\n")
	}

	return strings.TrimRight(body.String(), "\n")
}

func renderCell(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "-"
	}
	return escapeTableText(trimmed)
}

func renderSelectors(selectors []string) string {
	if len(selectors) == 0 {
		return "-"
	}

	formatted := make([]string, 0, len(selectors))
	for _, selector := range selectors {
		formatted = append(formatted, "`"+escapeInlineCode(selector)+"`")
	}
	return strings.Join(formatted, "<br>")
}

func escapeInlineCode(value string) string {
	return strings.ReplaceAll(value, "`", "\\`")
}

func escapeTableText(value string) string {
	return strings.ReplaceAll(value, "|", "\\|")
}

func updateGeneratedSection(path string, generated string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read docs file %q: %w", path, err)
	}

	beginIndex := bytes.Index(content, []byte(beginMarker))
	endIndex := bytes.Index(content, []byte(endMarker))
	if beginIndex == -1 || endIndex == -1 || endIndex <= beginIndex {
		return fmt.Errorf("markers not found in %q", path)
	}

	beginEnd := beginIndex + len(beginMarker)
	replacement := []byte("\n" + generated + "\n")

	var updated bytes.Buffer
	updated.Write(content[:beginEnd])
	updated.Write(replacement)
	updated.Write(content[endIndex:])

	if err := os.WriteFile(path, updated.Bytes(), 0o644); err != nil {
		return fmt.Errorf("write docs file %q: %w", path, err)
	}

	return nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
