package main

import (
	"strings"
	"testing"
)

func TestRenderGeneratedSectionIncludesCountAndSortedRows(t *testing.T) {
	output := renderGeneratedSection([]profileEntry{
		{
			FileName:    "B739.yaml",
			DisplayName: "Plane B",
			Selectors:   []string{"B Variant"},
		},
		{
			FileName:    "A320.yaml",
			DisplayName: "Plane A",
			Selectors:   []string{"A Variant", "A Variant 2"},
		},
	})

	if !strings.Contains(output, "There are currently `2` profile files.") {
		t.Fatalf("expected count line, got:\n%s", output)
	}

	firstRow := strings.Index(output, "| `B739.yaml` |")
	secondRow := strings.Index(output, "| `A320.yaml` |")
	if firstRow == -1 || secondRow == -1 {
		t.Fatalf("expected both rows in output, got:\n%s", output)
	}
	if firstRow > secondRow {
		t.Fatalf("expected rows to stay in input order for rendering test")
	}

	if !strings.Contains(output, "`A Variant`<br>`A Variant 2`") {
		t.Fatalf("expected selector formatting, got:\n%s", output)
	}
}

func TestNormalizeSelectorsDropsWhitespaceOnlyValues(t *testing.T) {
	got := normalizeSelectors([]string{"  A320  ", "", "   ", "A321"})
	if len(got) != 2 {
		t.Fatalf("expected 2 selectors, got %d", len(got))
	}
	if got[0] != "A320" || got[1] != "A321" {
		t.Fatalf("unexpected selectors: %#v", got)
	}
}
