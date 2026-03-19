package xplane

import "C"
import (
	"strings"
	"time"

	"github.com/x-z7a/zoal-honeycomb/pkg"
	"github.com/x-z7a/zoal-honeycomb/pkg/honeycomb"
	"github.com/xairline/goplane/xplm/dataAccess"
	"github.com/xairline/goplane/xplm/utilities"
)

const doubleClickThreshold = 500 * time.Millisecond // Define double-click threshold

const (
	defaultTrimUpCommand   = "sim/flight_controls/pitch_trim_up"
	defaultTrimDownCommand = "sim/flight_controls/pitch_trim_down"
	defaultTrimSensitivity = 23.0
	defaultTrimWindowMs    = int64(500)
	minimumTrimSensitivity = 1.0
	minimumTrimWindowMs    = int64(1)
	minimumTrimHoldMs      = 40.0
	maximumTrimHoldMs      = 150.0
)

func (s *xplaneService) changeApValue(command utilities.CommandRef, phase utilities.CommandPhase, ref interface{}) int {
	if phase == utilities.Phase_CommandEnd {
		direction := -1
		if ref.(string) == "up" {
			direction = 1
		}
		s.handleKnobTurn(direction)
	}
	return 0
}

func (s *xplaneService) changeAPMode(command utilities.CommandRef, phase utilities.CommandPhase, ref interface{}) int {
	if phase == utilities.Phase_CommandEnd {
		s.setAPSelector(ref.(string))
	}
	return 0
}

func (s *xplaneService) handleBravoEvent(event honeycomb.BravoEvent) {
	switch event.Kind {
	case honeycomb.BravoEventSelector:
		s.setAPSelector(event.Name)
	case honeycomb.BravoEventButton:
		if s.profile == nil {
			return
		}
		s.handleAPButtonRelease(event.Name)
	case honeycomb.BravoEventEncoder:
		if s.profile == nil {
			return
		}
		for i := 0; i < abs(event.Delta); i++ {
			s.handleKnobTurn(sign(event.Delta))
		}
	case honeycomb.BravoEventTrim:
		for i := 0; i < abs(event.Delta); i++ {
			if event.Delta > 0 {
				s.handleTrimDirection("up")
			} else if event.Delta < 0 {
				s.handleTrimDirection("down")
			}
		}
	}
}

func (s *xplaneService) setAPSelector(selector string) {
	if s.apSelector == selector {
		return
	}

	s.Logger.Debugf("AP MODE CHANGE: %s", selector)
	s.apSelector = selector
}

func (s *xplaneService) apAdjustmentProfile() (pkg.KnobProfile, float64, bool) {
	if s.profile == nil || s.profile.Knobs == nil || s.profile.Data == nil {
		return pkg.KnobProfile{}, 0, false
	}

	switch s.apSelector {
	case "ias":
		if iasStep, found := s.dataValue(&s.profile.Data.AP_IAS_STEP); found {
			return s.profile.Knobs.AP_IAS, iasStep, true
		}
		return s.profile.Knobs.AP_IAS, 1, true
	case "alt":
		if altStep, found := s.dataValue(&s.profile.Data.AP_ALT_STEP); found {
			return s.profile.Knobs.AP_ALT, altStep, true
		}
		return s.profile.Knobs.AP_ALT, 100, true
	case "vs":
		if vsStep, found := s.dataValue(&s.profile.Data.AP_VS_STEP); found {
			return s.profile.Knobs.AP_VS, vsStep, true
		}
		return s.profile.Knobs.AP_VS, 1, true
	case "hdg":
		return s.profile.Knobs.AP_HDG, 1, true
	case "crs":
		return s.profile.Knobs.AP_CRS, 1, true
	default:
		return pkg.KnobProfile{}, 0, false
	}
}

func (s *xplaneService) handleKnobTurn(direction int) {
	if direction == 0 {
		return
	}

	now := time.Now()
	elapsed := now.Sub(s.lastKnobTime).Milliseconds()
	multiplier := 1.0
	if !s.lastKnobTime.IsZero() {
		if elapsed < 100 {
			multiplier = 5.0
		} else if elapsed < 200 {
			multiplier = 3.0
		}
	}

	myProfile, step, ok := s.apAdjustmentProfile()
	if !ok {
		s.Logger.Warningf("Knob turn ignored: selector %q is not active", s.apSelector)
		return
	}

	if s.apSelector == "alt" {
		if elapsed < 100 {
			multiplier *= 5
		} else if elapsed < 200 {
			multiplier *= 2
		}
	}

	s.adjust(myProfile, direction, multiplier, step)
	s.Logger.Debugf("Knob turn: %d, Mode: %s, Multiplier: %.1f, Step: %.1f", direction, s.apSelector, multiplier, step)
	s.lastKnobTime = now
}

func (s *xplaneService) adjust(myProfile pkg.KnobProfile, direction int, multiplier float64, step float64) {
	if myProfile.Commands != nil {
		var cmd utilities.CommandRef
		if direction > 0 {
			cmd = utilities.FindCommand(myProfile.Commands[0].CommandStr)
		} else {
			cmd = utilities.FindCommand(myProfile.Commands[1].CommandStr)
		}
		for i := 0; i < int(multiplier); i++ {
			utilities.CommandOnce(cmd)
		}
	}

	for i := 0; i < len(myProfile.Datarefs); i++ {
		myDatarefName := myProfile.Datarefs[i].DatarefStr
		myDataref, found := dataAccess.FindDataRef(myDatarefName)
		if !found {
			s.Logger.Errorf("Dataref[%d] not found: %s", i, myDatarefName)
			continue
		}
		currentValueType := dataAccess.GetDataRefTypes(myDataref)
		switch currentValueType {
		case dataAccess.TypeFloat:
			currentValue := dataAccess.GetFloatData(myDataref)
			newValue := currentValue + float32(float64(direction)*multiplier*step)
			s.Logger.Debugf("Knob dataref: %s, Current Value: %f, New Value: %f", myDatarefName, currentValue, newValue)
			dataAccess.SetFloatData(myDataref, newValue)
		case dataAccess.TypeInt:
			currentValue := dataAccess.GetIntData(myDataref)
			newValue := currentValue + int(float64(direction)*multiplier*step)
			s.Logger.Debugf("Knob dataref: %s, Current Value: %f, New Value: %f", myDatarefName, currentValue, newValue)
			dataAccess.SetIntData(myDataref, newValue)
		}
	}
}

func (s *xplaneService) setupKnobsCmds() {
	increaseCmd := utilities.CreateCommand("Honeycomb Bravo/increase", "Increase the value of the autopilot mode selected with the rotary encoder.")
	decreaseCmd := utilities.CreateCommand("Honeycomb Bravo/decrease", "Decrease the value of the autopilot mode selected with the rotary encoder.")

	mode_ias := utilities.CreateCommand("Honeycomb Bravo/mode_ias", "Set the autopilot mode to IAS.")
	mode_alt := utilities.CreateCommand("Honeycomb Bravo/mode_alt", "Set the autopilot mode to ALT.")
	mode_vs := utilities.CreateCommand("Honeycomb Bravo/mode_vs", "Set the autopilot mode to VS.")
	mode_hdg := utilities.CreateCommand("Honeycomb Bravo/mode_hdg", "Set the autopilot mode to HDG.")
	mode_crs := utilities.CreateCommand("Honeycomb Bravo/mode_crs", "Set the autopilot mode to CRS.")

	// set up command handlers
	utilities.RegisterCommandHandler(increaseCmd, s.changeApValue, true, "up")
	utilities.RegisterCommandHandler(decreaseCmd, s.changeApValue, true, "down")
	utilities.RegisterCommandHandler(mode_ias, s.changeAPMode, true, "ias")
	utilities.RegisterCommandHandler(mode_alt, s.changeAPMode, true, "alt")
	utilities.RegisterCommandHandler(mode_vs, s.changeAPMode, true, "vs")
	utilities.RegisterCommandHandler(mode_hdg, s.changeAPMode, true, "hdg")
	utilities.RegisterCommandHandler(mode_crs, s.changeAPMode, true, "crs")
}

func (s *xplaneService) setupApCmds() {

	ap_ias := utilities.CreateCommand("Honeycomb Bravo/ap_ias", "Bravo IAS pressed.")
	ap_alt := utilities.CreateCommand("Honeycomb Bravo/ap_alt", "Bravo ALT pressed.")
	ap_vs := utilities.CreateCommand("Honeycomb Bravo/ap_vs", "Bravo VS pressed.")
	ap_hdg := utilities.CreateCommand("Honeycomb Bravo/ap_hdg", "Bravo HDG pressed.")
	ap_rev := utilities.CreateCommand("Honeycomb Bravo/ap_rev", "Bravo REV pressed.")
	ap_nav := utilities.CreateCommand("Honeycomb Bravo/ap_nav", "Bravo NAV pressed.")
	ap_apr := utilities.CreateCommand("Honeycomb Bravo/ap_apr", "Bravo APR pressed.")
	ap := utilities.CreateCommand("Honeycomb Bravo/ap", "Bravo AP pressed.")

	// set up command handlers
	utilities.RegisterCommandHandler(ap_ias, s.apPressed, true, "ias")
	utilities.RegisterCommandHandler(ap_alt, s.apPressed, true, "alt")
	utilities.RegisterCommandHandler(ap_vs, s.apPressed, true, "vs")
	utilities.RegisterCommandHandler(ap_hdg, s.apPressed, true, "hdg")
	utilities.RegisterCommandHandler(ap_rev, s.apPressed, true, "rev")
	utilities.RegisterCommandHandler(ap_nav, s.apPressed, true, "nav")
	utilities.RegisterCommandHandler(ap_apr, s.apPressed, true, "apr")
	utilities.RegisterCommandHandler(ap, s.apPressed, true, "ap")
}

func (s *xplaneService) setupTrimCmds() {
	pitchTrimUp := utilities.CreateCommand("Honeycomb Bravo/pitch_trim_up", "Bravo pitch trim up pressed.")
	pitchTrimDown := utilities.CreateCommand("Honeycomb Bravo/pitch_trim_down", "Bravo pitch trim down pressed.")

	// set up command handlers
	utilities.RegisterCommandHandler(pitchTrimUp, s.trimPressed, true, "up")
	utilities.RegisterCommandHandler(pitchTrimDown, s.trimPressed, true, "down")
}

func (s *xplaneService) trimWheelConfig() (string, string, float64, int64) {
	upCommand := defaultTrimUpCommand
	downCommand := defaultTrimDownCommand
	sensitivity := defaultTrimSensitivity
	windowMs := defaultTrimWindowMs

	if s.profile == nil || s.profile.TrimWheels == nil {
		return upCommand, downCommand, sensitivity, windowMs
	}

	trimWheels := s.profile.TrimWheels
	if cmd := strings.TrimSpace(trimWheels.UpCmd); cmd != "" {
		upCommand = cmd
	}
	if cmd := strings.TrimSpace(trimWheels.DownCmd); cmd != "" {
		downCommand = cmd
	}
	if trimWheels.Sensitivity != nil {
		sensitivity = *trimWheels.Sensitivity
	}
	if trimWheels.WindowMs != nil {
		windowMs = int64(*trimWheels.WindowMs)
	}

	if sensitivity < minimumTrimSensitivity {
		sensitivity = minimumTrimSensitivity
	}
	if windowMs < minimumTrimWindowMs {
		windowMs = minimumTrimWindowMs
	}

	return upCommand, downCommand, sensitivity, windowMs
}

func trimCommandMultiplier(lastTrimPulseAt, now float64, sensitivity float64, windowMs int64) float64 {
	if now < lastTrimPulseAt {
		return minimumTrimSensitivity
	}
	if now == lastTrimPulseAt {
		return sensitivity
	}

	elapsed := (now - lastTrimPulseAt) * 1000
	if elapsed >= float64(windowMs) {
		return minimumTrimSensitivity
	}

	multiplier := sensitivity - ((sensitivity - minimumTrimSensitivity) * elapsed / float64(windowMs))
	if multiplier < minimumTrimSensitivity {
		return minimumTrimSensitivity
	}

	return multiplier
}

func trimHoldDuration(multiplier, sensitivity float64, windowMs int64) float64 {
	maxHoldMs := float64(windowMs) / 4
	if maxHoldMs < minimumTrimHoldMs {
		maxHoldMs = minimumTrimHoldMs
	}
	if maxHoldMs > maximumTrimHoldMs {
		maxHoldMs = maximumTrimHoldMs
	}

	if sensitivity <= minimumTrimSensitivity {
		return minimumTrimHoldMs / 1000
	}

	normalized := (multiplier - minimumTrimSensitivity) / (sensitivity - minimumTrimSensitivity)
	if normalized < 0 {
		normalized = 0
	}
	if normalized > 1 {
		normalized = 1
	}

	holdMs := minimumTrimHoldMs + normalized*(maxHoldMs-minimumTrimHoldMs)
	return holdMs / 1000
}

func (s *xplaneService) beginCommandSignal(cmdStr string) bool {
	if strings.TrimSpace(cmdStr) == "" {
		return false
	}

	if s.commandBegin != nil {
		return s.commandBegin(cmdStr)
	}

	cmd := utilities.FindCommand(cmdStr)
	if cmd == nil {
		s.Logger.Errorf("Command not found: %s", cmdStr)
		return false
	}

	s.Logger.Debugf("Beginning command: %s", cmdStr)
	utilities.CommandBegin(cmd)
	return true
}

func (s *xplaneService) endCommandSignal(cmdStr string) bool {
	if strings.TrimSpace(cmdStr) == "" {
		return false
	}

	if s.commandEnd != nil {
		return s.commandEnd(cmdStr)
	}

	cmd := utilities.FindCommand(cmdStr)
	if cmd == nil {
		s.Logger.Errorf("Command not found: %s", cmdStr)
		return false
	}

	s.Logger.Debugf("Ending command: %s", cmdStr)
	utilities.CommandEnd(cmd)
	return true
}

func (s *xplaneService) stopTrimCommand() {
	if s.trimActive && s.trimCommand != "" {
		s.endCommandSignal(s.trimCommand)
	}

	s.trimActive = false
	s.trimCommand = ""
	s.trimDirection = ""
	s.trimHoldUntil = 0
}

func (s *xplaneService) resetTrimCadence() {
	s.hasTrimPulse = false
	s.lastTrimPulseAt = 0
}

func (s *xplaneService) updateTrimCommandState() {
	if !s.trimActive || s.trimCommand == "" {
		return
	}
	if s.globalTime < s.trimHoldUntil {
		return
	}

	s.stopTrimCommand()
	s.resetTrimCadence()
}

func (s *xplaneService) handleTrimDirection(buttonRef string) {
	upCommand, downCommand, sensitivity, windowMs := s.trimWheelConfig()

	var cmdStr string
	switch buttonRef {
	case "up":
		cmdStr = upCommand
	case "down":
		cmdStr = downCommand
	default:
		s.Logger.Warningf("Unknown trim button reference: %s", buttonRef)
		return
	}

	if s.trimActive && s.trimDirection != "" && s.trimDirection != buttonRef {
		s.stopTrimCommand()
		s.resetTrimCadence()
	}

	multiplier := minimumTrimSensitivity
	if s.hasTrimPulse {
		multiplier = trimCommandMultiplier(s.lastTrimPulseAt, s.globalTime, sensitivity, windowMs)
	}
	holdSeconds := trimHoldDuration(multiplier, sensitivity, windowMs)

	if s.trimCommand != "" && s.trimCommand != cmdStr {
		s.stopTrimCommand()
	}

	if !s.trimActive {
		if !s.beginCommandSignal(cmdStr) {
			return
		}
		s.trimActive = true
	}

	s.trimCommand = cmdStr
	s.trimDirection = buttonRef
	s.trimHoldUntil = s.globalTime + holdSeconds
	s.lastTrimPulseAt = s.globalTime
	s.hasTrimPulse = true

	s.Logger.Infof(
		"Trim command active: %s, Direction: %s, Hold: %.0f ms, Multiplier: %.1f, Sensitivity: %.1f, Window: %d ms",
		cmdStr,
		buttonRef,
		holdSeconds*1000,
		multiplier,
		sensitivity,
		windowMs,
	)
}

func (s *xplaneService) trimPressed(command utilities.CommandRef, phase utilities.CommandPhase, ref interface{}) int {
	if phase == utilities.Phase_CommandEnd {
		s.Logger.Debugf("Trim command: %v, Phase: %v, Button: %s", command, phase, ref.(string))
		s.handleTrimDirection(ref.(string))
	}
	return 0
}

func (s *xplaneService) apPressed(command utilities.CommandRef, phase utilities.CommandPhase, ref interface{}) int {
	if phase == utilities.Phase_CommandEnd {
		s.handleAPButtonRelease(ref.(string))
	}

	return 0
}

func (s *xplaneService) handleAPButtonRelease(buttonRef string) {
	now := time.Now()

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if timer, exists := s.clickTimers[buttonRef]; exists {
		timer.Stop()
		delete(s.clickTimers, buttonRef)
		s.Logger.Debugf("Double-click detected for button: %s, timestamp: %s", buttonRef, now)
		s.handleClick(buttonRef, true)
		return
	}

	timer := time.AfterFunc(doubleClickThreshold, func() {
		s.mutex.Lock()
		defer s.mutex.Unlock()

		if s.clickTimers[buttonRef] != nil {
			delete(s.clickTimers, buttonRef)
			s.Logger.Debugf("Single-click detected for button: %s, timestamp: %s", buttonRef, now)
			s.handleClick(buttonRef, false)
		}
	})

	s.clickTimers[buttonRef] = timer
	s.lastClickTime[buttonRef] = now
}

func (s *xplaneService) getButtonCommands(ref string, doubleClick bool) []pkg.Command {
	if s.profile == nil || s.profile.Buttons == nil {
		return nil
	}

	var btn *pkg.ButtonProfile
	switch ref {
	case "hdg":
		btn = &s.profile.Buttons.HDG
	case "nav":
		btn = &s.profile.Buttons.NAV
	case "alt":
		btn = &s.profile.Buttons.ALT
	case "apr":
		btn = &s.profile.Buttons.APR
	case "vs":
		btn = &s.profile.Buttons.VS
	case "ap":
		btn = &s.profile.Buttons.AP
	case "rev":
		btn = &s.profile.Buttons.REV
	case "ias":
		btn = &s.profile.Buttons.IAS
	default:
		// Unknown button ref
		return nil
	}

	if btn == nil {
		return nil
	}

	if doubleClick {
		return btn.DoubleClick
	}
	return btn.SingleClick
}

func (s *xplaneService) handleClick(ref string, doubleClick bool) {
	s.cmdEventQueueMu.Lock()
	defer s.cmdEventQueueMu.Unlock()

	cmds := s.getButtonCommands(ref, doubleClick)
	if cmds != nil && len(cmds) > 0 {
		for _, cmd := range cmds {
			s.cmdEventQueue = append(s.cmdEventQueue, cmd.CommandStr)
		}
	} else {
		// Differentiating log message based on single/double click
		clickType := "Single-click"
		if doubleClick {
			clickType = "Double-click"
		}
		s.Logger.Warningf("%s detected for button: %s (no commands configured)", clickType, ref)
	}
}

func abs(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func sign(value int) int {
	switch {
	case value > 0:
		return 1
	case value < 0:
		return -1
	default:
		return 0
	}
}
