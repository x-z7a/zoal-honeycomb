package xplane

import (
	"fmt"
	"testing"
	"time"

	"github.com/x-z7a/zoal-honeycomb/pkg"
	"github.com/x-z7a/zoal-honeycomb/pkg/honeycomb"
)

type testLogger struct{}

func (testLogger) Infof(string, ...interface{})    {}
func (testLogger) Info(string)                     {}
func (testLogger) Debugf(string, ...interface{})   {}
func (testLogger) Debug(string)                    {}
func (testLogger) Errorf(string, ...interface{})   {}
func (testLogger) Error(string)                    {}
func (testLogger) Warningf(string, ...interface{}) {}
func (testLogger) Warning(string)                  {}

func TestHandleBravoEventUpdatesSelectorWithoutProfile(t *testing.T) {
	svc := newTestXplaneService()

	svc.handleBravoEvent(honeycomb.BravoEvent{Kind: honeycomb.BravoEventSelector, Name: "hdg"})

	if svc.apSelector != "hdg" {
		t.Fatalf("expected selector to update to hdg, got %q", svc.apSelector)
	}
}

func TestHandleAPButtonReleaseQueuesSingleClick(t *testing.T) {
	svc := newTestXplaneService()
	svc.profile = &pkg.Profile{
		Buttons: &pkg.Buttons{
			HDG: pkg.ButtonProfile{
				SingleClick: []pkg.Command{{CommandStr: "sim/autopilot/heading"}},
			},
		},
	}

	svc.handleAPButtonRelease("hdg")
	time.Sleep(doubleClickThreshold + 50*time.Millisecond)

	queued := svc.queuedCommands()
	if len(queued) != 1 || queued[0] != "sim/autopilot/heading" {
		t.Fatalf("expected single-click command to be queued, got %#v", queued)
	}
}

func TestHandleAPButtonReleaseQueuesDoubleClick(t *testing.T) {
	svc := newTestXplaneService()
	svc.profile = &pkg.Profile{
		Buttons: &pkg.Buttons{
			HDG: pkg.ButtonProfile{
				DoubleClick: []pkg.Command{{CommandStr: "sim/autopilot/heading_sync"}},
			},
		},
	}

	svc.handleAPButtonRelease("hdg")
	time.Sleep(100 * time.Millisecond)
	svc.handleAPButtonRelease("hdg")
	time.Sleep(doubleClickThreshold + 50*time.Millisecond)

	queued := svc.queuedCommands()
	if len(queued) != 1 || queued[0] != "sim/autopilot/heading_sync" {
		t.Fatalf("expected double-click command to be queued, got %#v", queued)
	}
}

func TestAPAdjustmentProfileUsesSelectorSpecificStep(t *testing.T) {
	altStep := float32(500)
	svc := newTestXplaneService()
	svc.profile = &pkg.Profile{
		Data: &pkg.Data{
			AP_ALT_STEP: pkg.DataProfile{Value: &altStep},
		},
		Knobs: &pkg.Knobs{
			AP_ALT: pkg.KnobProfile{
				Commands: []pkg.Command{{CommandStr: "alt_up"}, {CommandStr: "alt_down"}},
			},
		},
	}
	svc.apSelector = "alt"

	knobProfile, step, ok := svc.apAdjustmentProfile()
	if !ok {
		t.Fatal("expected AP adjustment profile for alt selector")
	}
	if step != 500 {
		t.Fatalf("expected alt step 500, got %v", step)
	}
	if len(knobProfile.Commands) != 2 || knobProfile.Commands[0].CommandStr != "alt_up" {
		t.Fatalf("expected alt knob profile, got %#v", knobProfile)
	}
}

func TestTrimWheelConfigUsesGenericFallbackDefaults(t *testing.T) {
	svc := newTestXplaneService()

	up, down, sensitivity, windowMs := svc.trimWheelConfig()
	if up != defaultTrimUpCommand {
		t.Fatalf("expected generic trim-up default, got %q", up)
	}
	if down != defaultTrimDownCommand {
		t.Fatalf("expected generic trim-down default, got %q", down)
	}
	if sensitivity != defaultTrimSensitivity || windowMs != defaultTrimWindowMs {
		t.Fatalf("expected trim defaults %.1f/%d, got %.1f/%d", defaultTrimSensitivity, defaultTrimWindowMs, sensitivity, windowMs)
	}
}

func TestTrimWheelConfigUsesProfileOverrides(t *testing.T) {
	sensitivity := 7.5
	windowMs := 320
	svc := newTestXplaneService()
	svc.profile = &pkg.Profile{
		TrimWheels: &pkg.TrimWheels{
			UpCmd:       "custom/trim/up",
			DownCmd:     "custom/trim/down",
			Sensitivity: &sensitivity,
			WindowMs:    &windowMs,
		},
	}

	up, down, gotSensitivity, gotWindowMs := svc.trimWheelConfig()
	if up != "custom/trim/up" || down != "custom/trim/down" {
		t.Fatalf("expected custom trim commands, got %q / %q", up, down)
	}
	if gotSensitivity != sensitivity || gotWindowMs != int64(windowMs) {
		t.Fatalf("expected trim overrides %.1f/%d, got %.1f/%d", sensitivity, windowMs, gotSensitivity, gotWindowMs)
	}
}

func TestTrimCommandMultiplierScalesWithinWindow(t *testing.T) {
	if got := trimCommandMultiplier(1.0, 1.0, 10, 500); got != 10 {
		t.Fatalf("expected same-tick trim pulses to get full smoothing, got %.2f", got)
	}

	multiplier := trimCommandMultiplier(1.0, 1.1, 10, 500)
	if multiplier <= minimumTrimSensitivity || multiplier >= 10 {
		t.Fatalf("expected multiplier between %.1f and 10, got %.2f", minimumTrimSensitivity, multiplier)
	}

	if got := trimCommandMultiplier(1.0, 1.7, 10, 500); got != minimumTrimSensitivity {
		t.Fatalf("expected first trim event multiplier %.1f, got %.2f", minimumTrimSensitivity, got)
	}
}

func TestTrimHoldDurationIsBounded(t *testing.T) {
	baseHold := trimHoldDuration(minimumTrimSensitivity, 10, 500)
	fastHold := trimHoldDuration(10, 10, 500)

	if baseHold <= 0 {
		t.Fatalf("expected positive base trim hold, got %.3f", baseHold)
	}
	if fastHold <= baseHold {
		t.Fatalf("expected faster pulses to extend trim hold, got base %.3f fast %.3f", baseHold, fastHold)
	}
	if fastHold > maximumTrimHoldMs/1000 {
		t.Fatalf("expected trim hold to stay bounded, got %.3f", fastHold)
	}
}

func TestHandleTrimDirectionBeginsAndExtendsActiveCommand(t *testing.T) {
	sensitivity := 10.0
	windowMs := 500
	svc := newTestXplaneService()
	svc.profile = &pkg.Profile{
		TrimWheels: &pkg.TrimWheels{
			Sensitivity: &sensitivity,
			WindowMs:    &windowMs,
		},
	}
	actions := attachCommandRecorder(svc)

	svc.globalTime = 1.0
	svc.handleTrimDirection("down")
	if fmt.Sprint(*actions) != fmt.Sprint([]string{"begin:" + defaultTrimDownCommand}) {
		t.Fatalf("expected trim to begin once, got %#v", *actions)
	}
	firstHold := svc.trimHoldUntil
	if !svc.trimActive || svc.trimCommand != defaultTrimDownCommand || svc.trimDirection != "down" {
		t.Fatalf("expected active trim-down state, got active=%v cmd=%q dir=%q", svc.trimActive, svc.trimCommand, svc.trimDirection)
	}

	svc.globalTime = 1.05
	svc.handleTrimDirection("down")
	if len(*actions) != 1 {
		t.Fatalf("expected second same-direction pulse to extend hold only, got %#v", *actions)
	}
	if svc.trimHoldUntil <= firstHold {
		t.Fatalf("expected trim hold to extend, got first %.3f next %.3f", firstHold, svc.trimHoldUntil)
	}
}

func TestUpdateTrimCommandStateEndsHeldTrimCommand(t *testing.T) {
	svc := newTestXplaneService()
	actions := attachCommandRecorder(svc)

	svc.globalTime = 1.0
	svc.handleTrimDirection("up")

	svc.globalTime = svc.trimHoldUntil + 0.001
	svc.updateTrimCommandState()

	expected := []string{
		"begin:" + defaultTrimUpCommand,
		"end:" + defaultTrimUpCommand,
	}
	if fmt.Sprint(*actions) != fmt.Sprint(expected) {
		t.Fatalf("expected trim command to end after hold timeout, got %#v", *actions)
	}
	if svc.trimActive || svc.trimCommand != "" || svc.trimDirection != "" {
		t.Fatalf("expected trim state to reset after timeout, got active=%v cmd=%q dir=%q", svc.trimActive, svc.trimCommand, svc.trimDirection)
	}
}

func TestHandleTrimDirectionReversesCleanly(t *testing.T) {
	svc := newTestXplaneService()
	actions := attachCommandRecorder(svc)

	svc.globalTime = 1.0
	svc.handleTrimDirection("down")

	svc.globalTime = 1.05
	svc.handleTrimDirection("up")

	expected := []string{
		"begin:" + defaultTrimDownCommand,
		"end:" + defaultTrimDownCommand,
		"begin:" + defaultTrimUpCommand,
	}
	if fmt.Sprint(*actions) != fmt.Sprint(expected) {
		t.Fatalf("expected trim reversal to end old direction and begin new one, got %#v", *actions)
	}
	if !svc.trimActive || svc.trimCommand != defaultTrimUpCommand || svc.trimDirection != "up" {
		t.Fatalf("expected active trim-up state after reversal, got active=%v cmd=%q dir=%q", svc.trimActive, svc.trimCommand, svc.trimDirection)
	}
}

func newTestXplaneService() *xplaneService {
	return &xplaneService{
		Logger:        testLogger{},
		lastClickTime: make(map[string]time.Time),
		clickTimers:   make(map[string]*time.Timer),
		commandStates: make(map[string]*commandState),
		commandBegin: func(string) bool {
			return true
		},
		commandEnd: func(string) bool {
			return true
		},
	}
}

func attachCommandRecorder(svc *xplaneService) *[]string {
	actions := []string{}
	svc.commandBegin = func(cmdStr string) bool {
		actions = append(actions, "begin:"+cmdStr)
		return true
	}
	svc.commandEnd = func(cmdStr string) bool {
		actions = append(actions, "end:"+cmdStr)
		return true
	}
	return &actions
}

func (s *xplaneService) queuedCommands() []string {
	s.cmdEventQueueMu.Lock()
	defer s.cmdEventQueueMu.Unlock()

	res := make([]string, len(s.cmdEventQueue))
	copy(res, s.cmdEventQueue)
	return res
}
