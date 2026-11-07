package main

import (
	"os"
	"path/filepath"
	"testing"
)

// TestModelsUpToDate fails when a Go type the frontend uses has changed
// without models.ts being regenerated.
func TestModelsUpToDate(t *testing.T) {
	root, err := moduleRoot()
	if err != nil {
		t.Fatal(err)
	}
	current, err := os.ReadFile(filepath.Join(root, outputPath))
	if err != nil {
		t.Fatalf("read %s: %v (run: go run ./cmd/gen-ts-models)", outputPath, err)
	}
	if string(current) != Generate() {
		t.Fatalf("%s is out of date; run: go run ./cmd/gen-ts-models", outputPath)
	}
}
