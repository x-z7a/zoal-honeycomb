//go:build darwin

package honeycomb

import "testing"

func TestConfigureHIDOpenModeDisablesExclusiveAccess(t *testing.T) {
	original := setOpenExclusive
	defer func() {
		setOpenExclusive = original
	}()

	called := false
	value := true
	setOpenExclusive = func(exclusive bool) {
		called = true
		value = exclusive
	}

	configureHIDOpenMode()

	if !called {
		t.Fatal("expected configureHIDOpenMode to call SetOpenExclusive")
	}
	if value {
		t.Fatal("expected configureHIDOpenMode to disable exclusive access")
	}
}
