package main

import (
	"encoding/json"
	"testing"

	"github.com/x-z7a/zoal-honeycomb/pkg"
)

// Trimmed from a real Configurator export (FF A320): AP buttons are 0-based,
// hand-typed datarefs/commands are flagged as "custom", and bare LED values
// mean equality.
const ffA320ConfiguratorJSON = `{
  "Version": 1,
  "SaveName": "FF A320",
  "Data": [
    {"ButtonNumber": 6, "PressEvent": [{"Variables": [{"Variable": "MOKNY/FFA320/FCUAP2Toggle", "Value": "", "VariableIsCustom": true}], "Conditions": []}]},
    {"ButtonNumber": 7, "PressEvent": [{"Variables": [{"Variable": "a320/Panel/FCU_AutoPilot1", "Value": "1", "VariableIsCustom": true}], "Conditions": []}]},
    {"ButtonNumber": 12, "PressEvent": [{"Conditions": [
      {"Variable": "a320/Panel/FCU_Speed_switch+", "Value": "", "VariableIsCustom": true, "Condition": "INT:FCU_SELECTOR, string", "ConditionValue": "IAS", "ConditionIsCustom": true}
    ]}]},
    {"ButtonNumber": 13, "PressEvent": [{"Conditions": [
      {"Variable": "a320/Panel/FCU_Speed_switch-", "Value": "", "VariableIsCustom": true, "Condition": "INT:FCU_SELECTOR, string", "ConditionValue": "IAS", "ConditionIsCustom": true}
    ]}]},
    {"ButtonNumber": 21, "PressEvent": [{"Variables": [{"Variable": "sim/flight_controls/pitch_trim_down", "Value": "", "VariableIsCustom": true}]}]}
  ],
  "LEDs": [
    {"ByteIndex": 1, "BitIndex": 7, "ConditionLogic": "", "Conditions": [
      {"Condition": "a320/Aircraft/Cockpit/Panel/FCU_AutoPilotLight1/Intensity", "ConditionValue": ">0", "ConditionIsCustom": true}
    ]},
    {"ByteIndex": 4, "BitIndex": 1, "ConditionLogic": "AND", "Conditions": [
      {"Condition": "sim/flightmodel/controls/parkbrake", "ConditionValue": "1", "ConditionIsCustom": false}
    ]}
  ]
}`

func TestImportFFA320ConfiguratorProfile(t *testing.T) {
	var old ConfiguratorProfile
	if err := json.Unmarshal([]byte(ffA320ConfiguratorJSON), &old); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	profile := pkg.Profile{
		Buttons:    &pkg.Buttons{},
		Knobs:      &pkg.Knobs{AP_IAS: pkg.KnobProfile{DatarefProfile: pkg.DatarefProfile{Datarefs: []pkg.Dataref{{DatarefStr: "sim/cockpit2/autopilot/airspeed_dial_kts_mach"}}}}},
		Leds:       &pkg.Leds{},
		Conditions: &pkg.Conditions{},
	}
	applyImportedLEDs(&profile, old.LEDs)
	applyImportedButtons(&profile, old.Data)
	applyImportedKnobs(&profile, old.Data)

	// Button 6 is IAS; button 21 is the trim wheel and must not land on HDG.
	if got := profile.Buttons.IAS.SingleClick; len(got) != 1 || got[0].CommandStr != "MOKNY/FFA320/FCUAP2Toggle" {
		t.Errorf("IAS button = %+v", got)
	}
	if len(profile.Buttons.HDG.SingleClick) != 0 {
		t.Errorf("HDG button should be untouched, got %+v", profile.Buttons.HDG.SingleClick)
	}
	// Button 7 only writes a dataref value, which buttons can't express.
	if len(profile.Buttons.AP.SingleClick) != 0 {
		t.Errorf("AP button should be skipped, got %+v", profile.Buttons.AP.SingleClick)
	}

	ias := profile.Knobs.AP_IAS
	if len(ias.Commands) != 2 || ias.Commands[0].CommandStr != "a320/Panel/FCU_Speed_switch+" || ias.Commands[1].CommandStr != "a320/Panel/FCU_Speed_switch-" {
		t.Errorf("AP_IAS commands = %+v", ias.Commands)
	}
	if len(ias.Datarefs) != 0 {
		t.Errorf("AP_IAS should drop template datarefs when using commands, got %+v", ias.Datarefs)
	}

	ap := profile.Leds.AP.Datarefs
	if len(ap) != 1 || ap[0].DatarefStr != "a320/Aircraft/Cockpit/Panel/FCU_AutoPilotLight1/Intensity" || ap[0].Operator != ">" || *ap[0].Threshold != 0 {
		t.Errorf("AP LED = %+v", ap)
	}
	pb := profile.Leds.PARKING_BRAKE.Datarefs
	if len(pb) != 1 || pb[0].Operator != "==" || *pb[0].Threshold != 1 {
		t.Errorf("parking brake LED = %+v", pb)
	}
}
