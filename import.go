package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/x-z7a/zoal-honeycomb/pkg"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"gopkg.in/yaml.v3"
)

// ---------- Old Honeycomb Bravo Configurator JSON types ----------

type ConfiguratorVariableBoundaries struct {
	MinValue string `json:"MinValue"`
	MaxValue string `json:"MaxValue"`
	Clamp    bool   `json:"Clamp"`
}

type ConfiguratorVariableEntry struct {
	Variable           string                         `json:"Variable"`
	Value              string                         `json:"Value"`
	VariableIsCustom   bool                           `json:"VariableIsCustom"`
	VariableBoundaries ConfiguratorVariableBoundaries `json:"VariableBoundaries"`
}

type ConfiguratorConditionEntry struct {
	Variable           string                         `json:"Variable"`
	Value              string                         `json:"Value"`
	VariableIsCustom   bool                           `json:"VariableIsCustom"`
	VariableBoundaries ConfiguratorVariableBoundaries `json:"VariableBoundaries"`
	Condition          string                         `json:"Condition"`
	ConditionValue     string                         `json:"ConditionValue"`
	ConditionIsCustom  bool                           `json:"ConditionIsCustom"`
}

type ConfiguratorEvent struct {
	Variables      []ConfiguratorVariableEntry  `json:"Variables"`
	Variable       string                      `json:"Variable"`
	Value          string                      `json:"Value"`
	Name           string                      `json:"Name"`
	Condition      string                      `json:"Condition"`
	ConditionValue string                      `json:"ConditionValue"`
	ConditionLogic string                      `json:"ConditionLogic"`
	Conditions     []ConfiguratorConditionEntry `json:"Conditions"`
	Repeat         int                         `json:"Repeat"`
}

type ConfiguratorButton struct {
	ButtonNumber int                 `json:"ButtonNumber"`
	PressEvent   []ConfiguratorEvent `json:"PressEvent"`
	ReleaseEvent []ConfiguratorEvent `json:"ReleaseEvent"`
}

type ConfiguratorLEDCondition struct {
	Condition         string `json:"Condition"`
	ConditionValue    string `json:"ConditionValue"`
	ConditionIsCustom bool   `json:"ConditionIsCustom"`
}

type ConfiguratorLED struct {
	ByteIndex      int                        `json:"ByteIndex"`
	BitIndex       int                        `json:"BitIndex"`
	ConditionLogic string                     `json:"ConditionLogic"`
	Conditions     []ConfiguratorLEDCondition `json:"Conditions"`
}

type ConfiguratorProfile struct {
	Version              int                   `json:"Version"`
	SaveName             string                `json:"SaveName"`
	Data                 []ConfiguratorButton  `json:"Data"`
	LEDs                 []ConfiguratorLED     `json:"LEDs"`
	ConfiguratorSettings struct {
		Device string `json:"device"`
	} `json:"ConfiguratorSettings"`
}

// ---------- Import preview ----------

type ImportPreview struct {
	SaveName string   `json:"saveName"`
	LEDCount int      `json:"ledCount"`
	Device   string   `json:"device"`
	FilePath string   `json:"filePath"`
	Warnings []string `json:"warnings"`
}

// ---------- Mapping tables ----------

// ledMapKey encodes (ByteIndex, BitIndex) into a single int for map lookup.
func ledMapKey(byteIndex, bitIndex int) int {
	return byteIndex*8 + bitIndex
}

var ledMapping = map[int]string{
	ledMapKey(0, 0): "bus_voltage",
	ledMapKey(1, 0): "hdg",
	ledMapKey(1, 1): "nav",
	ledMapKey(1, 2): "apr",
	ledMapKey(1, 3): "rev",
	ledMapKey(1, 4): "alt",
	ledMapKey(1, 5): "vs",
	ledMapKey(1, 6): "ias",
	ledMapKey(1, 7): "ap",
	// (2, 0-5) = gear LEDs, skipped
	ledMapKey(2, 6): "master_warn",
	ledMapKey(2, 7): "fire",
	ledMapKey(3, 0): "oil_low_pressure",
	ledMapKey(3, 1): "fuel_low_pressure",
	ledMapKey(3, 2): "anti_ice",
	ledMapKey(3, 3): "eng_starter",
	ledMapKey(3, 4): "apu",
	ledMapKey(3, 5): "master_caution",
	ledMapKey(3, 6): "vacuum",
	ledMapKey(3, 7): "hydro_low_pressure",
	ledMapKey(4, 0): "aux_fuel_pump",
	ledMapKey(4, 1): "parking_brake",
	ledMapKey(4, 2): "volt_low",
	ledMapKey(4, 3): "doors",
}

// Bravo hardware button numbers → YAML button names.
var apButtonMapping = map[int]string{
	21: "hdg",
	22: "nav",
	23: "apr",
	24: "rev",
	25: "alt",
	26: "vs",
	27: "ias",
	28: "ap",
}

// FCU_SELECTOR condition values → YAML knob names.
var fcuSelectorToKnob = map[string]string{
	"HDG": "ap_hdg",
	"VS":  "ap_vs",
	"ALT": "ap_alt",
	"IAS": "ap_ias",
	"CRS": "ap_crs",
}

// Encoder button numbers.
const (
	encoderUpButton   = 12
	encoderDownButton = 13
)

// ---------- Parsing helpers ----------

var conditionValueRegex = regexp.MustCompile(`^(>=|<=|!=|>|<|=)(.+)$`)

func parseConditionValue(raw string) (string, *float32, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil, errors.New("empty condition value")
	}

	matches := conditionValueRegex.FindStringSubmatch(raw)
	if len(matches) != 3 {
		return "", nil, fmt.Errorf("cannot parse condition value %q", raw)
	}

	op := matches[1]
	if op == "=" {
		op = "=="
	}

	val, err := strconv.ParseFloat(strings.TrimSpace(matches[2]), 32)
	if err != nil {
		return "", nil, fmt.Errorf("cannot parse threshold from %q: %w", raw, err)
	}
	threshold := float32(val)
	return op, &threshold, nil
}

// parseDatarefAndIndex splits "sim/foo/bar:2" into ("sim/foo/bar", 2).
func parseDatarefAndIndex(raw string) (string, int) {
	idx := strings.LastIndex(raw, ":")
	if idx < 0 {
		return raw, 0
	}
	suffix := raw[idx+1:]
	n, err := strconv.Atoi(suffix)
	if err != nil {
		return raw, 0
	}
	return raw[:idx], n
}

func convertLEDConditions(old ConfiguratorLED) ([]pkg.DatarefCondition, string) {
	datarefs := make([]pkg.DatarefCondition, 0, len(old.Conditions))

	for _, cond := range old.Conditions {
		if cond.ConditionIsCustom {
			continue
		}
		if cond.Condition == "" {
			continue
		}

		op, threshold, err := parseConditionValue(cond.ConditionValue)
		if err != nil {
			continue
		}

		datarefStr, index := parseDatarefAndIndex(cond.Condition)

		dc := pkg.DatarefCondition{
			DatarefStr: datarefStr,
			Operator:   op,
			Threshold:  threshold,
		}
		if index != 0 {
			dc.Index = index
		}
		datarefs = append(datarefs, dc)
	}

	condition := ""
	switch strings.ToUpper(strings.TrimSpace(old.ConditionLogic)) {
	case "OR":
		condition = "any"
	case "AND":
		condition = "all"
	}

	return datarefs, condition
}

// ---------- Button / Knob extraction ----------

// findButton returns the button entry with the given number, or nil.
func findButton(data []ConfiguratorButton, number int) *ConfiguratorButton {
	for i := range data {
		if data[i].ButtonNumber == number {
			return &data[i]
		}
	}
	return nil
}

// extractEncoderKnobCommands parses encoder buttons 12 (up) and 13 (down) to
// extract per-knob increment/decrement commands from FCU_SELECTOR conditions.
// Returns a map[knobName] → [incrementCmd, decrementCmd] and any warnings.
func extractEncoderKnobCommands(data []ConfiguratorButton) (map[string][2]string, []string) {
	// Collect increment commands from button 12, decrement from button 13.
	incCmds := map[string]string{} // knob name → increment command
	decCmds := map[string]string{} // knob name → decrement command

	var warnings []string

	for _, btnNum := range []int{encoderUpButton, encoderDownButton} {
		btn := findButton(data, btnNum)
		if btn == nil {
			continue
		}
		if len(btn.PressEvent) == 0 {
			continue
		}
		event := btn.PressEvent[0]
		for _, cond := range event.Conditions {
			if !strings.Contains(cond.Condition, "FCU_SELECTOR") {
				continue
			}
			if cond.VariableIsCustom {
				selectorVal := strings.ToUpper(strings.TrimSpace(cond.ConditionValue))
				knobName, ok := fcuSelectorToKnob[selectorVal]
				if ok {
					warnings = append(warnings, fmt.Sprintf("Knob %s: skipped — uses custom variable", knobName))
				}
				continue
			}
			cmd := strings.TrimSpace(cond.Variable)
			if cmd == "" {
				continue
			}
			selectorVal := strings.ToUpper(strings.TrimSpace(cond.ConditionValue))
			knobName, ok := fcuSelectorToKnob[selectorVal]
			if !ok {
				continue
			}
			if btnNum == encoderUpButton {
				incCmds[knobName] = cmd
			} else {
				decCmds[knobName] = cmd
			}
		}
	}

	// Pair up increment + decrement into result map.
	result := map[string][2]string{}
	allKnobs := map[string]bool{}
	for k := range incCmds {
		allKnobs[k] = true
	}
	for k := range decCmds {
		allKnobs[k] = true
	}

	for knob := range allKnobs {
		inc := incCmds[knob]
		dec := decCmds[knob]
		if inc != "" && dec != "" {
			result[knob] = [2]string{inc, dec}
		} else if inc != "" {
			warnings = append(warnings, fmt.Sprintf("Knob %s: found increment command but no decrement — skipped", knob))
		} else {
			warnings = append(warnings, fmt.Sprintf("Knob %s: found decrement command but no increment — skipped", knob))
		}
	}

	// Warn about knobs with no encoder mapping at all.
	for _, knobName := range []string{"ap_hdg", "ap_vs", "ap_alt", "ap_ias", "ap_crs"} {
		if _, found := allKnobs[knobName]; !found {
			warnings = append(warnings, fmt.Sprintf("Knob %s: no encoder mapping found — using default", knobName))
		}
	}

	return result, warnings
}

// extractAPButtonCommand tries to extract a simple command from an AP button's
// PressEvent. Returns the command string (empty if not extractable) and a warning.
func extractAPButtonCommand(btn *ConfiguratorButton) (string, string) {
	btnName := apButtonMapping[btn.ButtonNumber]
	label := strings.ToUpper(btnName)

	if len(btn.PressEvent) == 0 {
		return "", fmt.Sprintf("Button %s (%d): no press events — using default", label, btn.ButtonNumber)
	}

	event := btn.PressEvent[0]

	// Simple case: direct command in Variable field.
	if cmd := strings.TrimSpace(event.Variable); cmd != "" {
		return cmd, ""
	}

	// If only the Variables array is populated (sets internal state, no command) skip.
	if len(event.Variables) > 0 && len(event.Conditions) == 0 {
		return "", fmt.Sprintf("Button %s (%d): only sets internal variables — using default", label, btn.ButtonNumber)
	}

	// If conditions are used, it's too complex for a simple single_click mapping.
	if len(event.Conditions) > 0 {
		return "", fmt.Sprintf("Button %s (%d): uses conditional logic — using default", label, btn.ButtonNumber)
	}

	return "", fmt.Sprintf("Button %s (%d): could not extract command — using default", label, btn.ButtonNumber)
}

// ---------- Preview generation ----------

// analyzeImportProfile generates warnings by doing a dry-run analysis of
// button and knob mappability.
func analyzeImportProfile(profile *ConfiguratorProfile) []string {
	var warnings []string

	// Analyze knobs (encoder buttons).
	_, knobWarnings := extractEncoderKnobCommands(profile.Data)
	warnings = append(warnings, knobWarnings...)

	// Analyze AP buttons.
	for btnNum, btnName := range apButtonMapping {
		btn := findButton(profile.Data, btnNum)
		if btn == nil {
			warnings = append(warnings, fmt.Sprintf("Button %s (%d): not found in profile — using default", strings.ToUpper(btnName), btnNum))
			continue
		}
		_, warning := extractAPButtonCommand(btn)
		if warning != "" {
			warnings = append(warnings, warning)
		}
	}

	return warnings
}

// ---------- Public API ----------

func (a *App) SelectImportFile() (ImportPreview, error) {
	a.mu.RLock()
	ctx := a.ctx
	a.mu.RUnlock()

	if ctx == nil {
		return ImportPreview{}, errors.New("application context is not ready yet")
	}

	selectedFile, err := wailsruntime.OpenFileDialog(ctx, wailsruntime.OpenDialogOptions{
		Title: "Select Configurator JSON Profile",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return ImportPreview{}, fmt.Errorf("failed to open file picker: %w", err)
	}
	if strings.TrimSpace(selectedFile) == "" {
		return ImportPreview{}, errors.New("no file selected")
	}

	content, err := os.ReadFile(selectedFile)
	if err != nil {
		return ImportPreview{}, fmt.Errorf("failed to read file: %w", err)
	}

	var profile ConfiguratorProfile
	if err := json.Unmarshal(content, &profile); err != nil {
		return ImportPreview{}, fmt.Errorf("invalid JSON: %w", err)
	}

	if profile.SaveName == "" {
		return ImportPreview{}, errors.New("file does not appear to be a valid Honeycomb Configurator profile (missing SaveName)")
	}

	warnings := analyzeImportProfile(&profile)

	return ImportPreview{
		SaveName: profile.SaveName,
		LEDCount: len(profile.LEDs),
		Device:   profile.ConfiguratorSettings.Device,
		FilePath: selectedFile,
		Warnings: warnings,
	}, nil
}

func (a *App) CreateProfileFromImport(jsonPath, filename, profileName, description string, selectors []string) (string, error) {
	a.mu.RLock()
	profilesDir := a.profilesDir
	userProfilesDir := a.userProfilesDir
	a.mu.RUnlock()

	if !dirExists(profilesDir) {
		return "", errors.New("profiles folder is not available")
	}

	normalizedFilename, err := normalizeProfileFilename(filename)
	if err != nil {
		return "", err
	}

	name := strings.TrimSpace(profileName)
	if name == "" {
		return "", errors.New("profile name is required")
	}

	cleanedSelectors := normalizeSelectors(selectors)
	if len(cleanedSelectors) == 0 {
		return "", errors.New("at least one selector is required")
	}

	// Read and parse the old JSON.
	jsonContent, err := os.ReadFile(jsonPath)
	if err != nil {
		return "", fmt.Errorf("failed to read import file: %w", err)
	}

	var oldProfile ConfiguratorProfile
	if err := json.Unmarshal(jsonContent, &oldProfile); err != nil {
		return "", fmt.Errorf("invalid import JSON: %w", err)
	}

	// Read default.yaml as base template.
	templatePath := filepath.Join(profilesDir, defaultProfileTemplate)
	templateContent, err := os.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to read template %q: %w", templatePath, err)
	}

	var profile pkg.Profile
	if err := yaml.Unmarshal(templateContent, &profile); err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	// Update metadata.
	if profile.Metadata == nil {
		profile.Metadata = &pkg.Metadata{}
	}
	profile.Metadata.Name = name
	profile.Metadata.Description = strings.TrimSpace(description)
	profile.Metadata.Selectors = cleanedSelectors

	// Convert LEDs.
	if profile.Leds == nil {
		profile.Leds = &pkg.Leds{}
	}
	if profile.Conditions == nil {
		profile.Conditions = &pkg.Conditions{}
	}
	applyImportedLEDs(&profile, oldProfile.LEDs)

	// Best-effort AP buttons.
	if profile.Buttons == nil {
		profile.Buttons = &pkg.Buttons{}
	}
	applyImportedButtons(&profile, oldProfile.Data)

	// Best-effort knobs from encoder.
	if profile.Knobs == nil {
		profile.Knobs = &pkg.Knobs{}
	}
	applyImportedKnobs(&profile, oldProfile.Data)

	// Save to user profiles directory.
	targetDir := userProfilesDir
	if targetDir == "" {
		targetDir = filepath.Join(filepath.Dir(profilesDir), userProfilesFolderName)
	}
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create user profiles folder: %w", err)
	}

	newProfilePath := filepath.Join(targetDir, normalizedFilename)
	if _, err := os.Stat(newProfilePath); err == nil {
		return "", fmt.Errorf("profile %q already exists in user profiles", normalizedFilename)
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("failed to check existing profile %q: %w", normalizedFilename, err)
	}

	output, err := yaml.Marshal(profile)
	if err != nil {
		return "", fmt.Errorf("failed to render profile yaml: %w", err)
	}

	if err := os.WriteFile(newProfilePath, output, 0o644); err != nil {
		return "", fmt.Errorf("failed to create profile %q: %w", newProfilePath, err)
	}

	if err := a.loadProfilesFromDir(profilesDir); err != nil {
		return "", fmt.Errorf("profile created but reload failed: %w", err)
	}

	return newProfilePath, nil
}

// ---------- Apply helpers ----------

func applyImportedLEDs(profile *pkg.Profile, leds []ConfiguratorLED) {
	for _, led := range leds {
		key := ledMapKey(led.ByteIndex, led.BitIndex)
		fieldName, ok := ledMapping[key]
		if !ok {
			continue
		}

		datarefs, condition := convertLEDConditions(led)
		if len(datarefs) == 0 {
			continue
		}

		if fieldName == "bus_voltage" {
			profile.Conditions.BUS_VOLTAGE = pkg.ConditionProfile{
				Datarefs:  datarefs,
				Condition: condition,
			}
			continue
		}

		ledProfile := pkg.LEDProfile{
			ConditionProfile: pkg.ConditionProfile{
				Datarefs:  datarefs,
				Condition: condition,
			},
		}

		switch fieldName {
		case "hdg":
			profile.Leds.HDG = ledProfile
		case "nav":
			profile.Leds.NAV = ledProfile
		case "apr":
			profile.Leds.APR = ledProfile
		case "rev":
			profile.Leds.REV = ledProfile
		case "alt":
			profile.Leds.ALT = ledProfile
		case "vs":
			profile.Leds.VS = ledProfile
		case "ias":
			profile.Leds.IAS = ledProfile
		case "ap":
			profile.Leds.AP = ledProfile
		case "master_warn":
			profile.Leds.MASTER_WARN = ledProfile
		case "fire":
			profile.Leds.FIRE = ledProfile
		case "oil_low_pressure":
			profile.Leds.OIL_LOW_PRESSURE = ledProfile
		case "fuel_low_pressure":
			profile.Leds.FUEL_LOW_PRESSURE = ledProfile
		case "anti_ice":
			profile.Leds.ANTI_ICE = ledProfile
		case "eng_starter":
			profile.Leds.ENG_STARTER = ledProfile
		case "apu":
			profile.Leds.APU = ledProfile
		case "master_caution":
			profile.Leds.MASTER_CAUTION = ledProfile
		case "vacuum":
			profile.Leds.VACUUM = ledProfile
		case "hydro_low_pressure":
			profile.Leds.HYDRO_LOW_PRESSURE = ledProfile
		case "aux_fuel_pump":
			profile.Leds.AUX_FUEL_PUMP = ledProfile
		case "parking_brake":
			profile.Leds.PARKING_BRAKE = ledProfile
		case "volt_low":
			profile.Leds.VOLT_LOW = ledProfile
		case "doors":
			profile.Leds.DOORS = ledProfile
		}
	}
}

func applyImportedButtons(profile *pkg.Profile, data []ConfiguratorButton) {
	for btnNum, btnName := range apButtonMapping {
		btn := findButton(data, btnNum)
		if btn == nil {
			continue
		}
		cmd, _ := extractAPButtonCommand(btn)
		if cmd == "" {
			continue
		}

		bp := pkg.ButtonProfile{
			SingleClick: []pkg.Command{{CommandStr: cmd}},
		}

		switch btnName {
		case "hdg":
			profile.Buttons.HDG = bp
		case "nav":
			profile.Buttons.NAV = bp
		case "apr":
			profile.Buttons.APR = bp
		case "rev":
			profile.Buttons.REV = bp
		case "alt":
			profile.Buttons.ALT = bp
		case "vs":
			profile.Buttons.VS = bp
		case "ias":
			profile.Buttons.IAS = bp
		case "ap":
			profile.Buttons.AP = bp
		}
	}
}

func applyImportedKnobs(profile *pkg.Profile, data []ConfiguratorButton) {
	knobCmds, _ := extractEncoderKnobCommands(data)

	for knobName, cmds := range knobCmds {
		commands := []pkg.Command{
			{CommandStr: cmds[0]}, // increment
			{CommandStr: cmds[1]}, // decrement
		}

		switch knobName {
		case "ap_hdg":
			profile.Knobs.AP_HDG.Commands = commands
		case "ap_vs":
			profile.Knobs.AP_VS.Commands = commands
		case "ap_alt":
			profile.Knobs.AP_ALT.Commands = commands
		case "ap_ias":
			profile.Knobs.AP_IAS.Commands = commands
		case "ap_crs":
			profile.Knobs.AP_CRS.Commands = commands
		}
	}
}
