// Command patch-pe-import renames an imported DLL inside a PE file in place.
//
//	go run ./cmd/patch-pe-import <file> <old.dll> <new.dll>
//
// The new name must be exactly as long as the old one, so no offsets move.
// This replaces a `sed -i` that corrupted win.xpl under msys2: its sed reads
// files in text mode and dropped bytes, so Windows refused the plugin with
// "Error Code = 193 : %1 is not a valid Win32 application".
package main

import (
	"bytes"
	"debug/pe"
	"fmt"
	"os"
	"slices"
	"strings"
)

func main() {
	if len(os.Args) != 4 {
		fmt.Fprintln(os.Stderr, "usage: patch-pe-import <file> <old.dll> <new.dll>")
		os.Exit(2)
	}
	if err := patch(os.Args[1], os.Args[2], os.Args[3]); err != nil {
		fmt.Fprintln(os.Stderr, "patch-pe-import:", err)
		os.Exit(1)
	}
}

func patch(path, oldName, newName string) error {
	if len(oldName) != len(newName) {
		return fmt.Errorf("%q and %q differ in length", oldName, newName)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := hasImport(data, oldName); err != nil {
		return err
	}
	n := bytes.Count(data, []byte(oldName))
	out := bytes.ReplaceAll(data, []byte(oldName), []byte(newName))
	if len(out) != len(data) {
		return fmt.Errorf("size changed: %d -> %d", len(data), len(out))
	}
	if err := hasImport(out, newName); err != nil {
		return fmt.Errorf("patched file: %w", err)
	}
	if err := os.WriteFile(path, out, 0o644); err != nil {
		return err
	}
	fmt.Printf("%s: %s -> %s (%d occurrence(s))\n", path, oldName, newName, n)
	return nil
}

// hasImport checks that data parses as a PE file importing name.
func hasImport(data []byte, name string) error {
	f, err := pe.NewFile(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("not a valid PE file: %w", err)
	}
	defer f.Close()
	// ImportedLibraries is unimplemented for PE; symbols come as "sym:DLL".
	syms, err := f.ImportedSymbols()
	if err != nil {
		return fmt.Errorf("reading imports: %w", err)
	}
	if !slices.ContainsFunc(syms, func(s string) bool {
		_, dll, _ := strings.Cut(s, ":")
		return strings.EqualFold(dll, name)
	}) {
		return fmt.Errorf("does not import %s", name)
	}
	return nil
}
