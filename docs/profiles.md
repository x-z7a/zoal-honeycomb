# Profiles Guide

## Recommended Workflow: Use the UI

Use the `bravo` app as the primary editing workflow.

- The app loads profile YAML files from `profiles/`.
- The editor updates in memory while you work.
- **Save YAML** writes the changes back to the profile file.

![Bravo profile editor](/images/bravo-app-window.png)

## UI Editing Walkthrough

1. Launch `bravo` and select a profile from the left sidebar.
2. Confirm the active profile card in the editor area.
3. Edit each tab as needed.
4. Click **Save YAML**.
5. Test behavior in X-Plane.

## Tab Reference

### Autopilot Buttons

Maps `buttons.<key>.single_click[]` and `buttons.<key>.double_click[]`.

![Autopilot Buttons tab](/images/bravo-tab-buttons.png)

Use this tab for AP button command mapping:

- `hdg`, `nav`, `alt`, `apr`, `vs`, `ap`, `ias`, `rev`
- Add multiple commands per click mode when needed.

### Autopilot Lights

Maps AP status LEDs under `leds`.

![Autopilot Lights tab](/images/bravo-tab-lights.png)

Typical keys in this tab:

- `alt`, `hdg`, `apr`, `rev`, `nav`, `vs`, `ap`, `ias`

### Annunciators Top

Maps the top annunciator LED row in `leds`.

![Annunciators Top tab](/images/bravo-tab-annunciators-top.png)

Typical keys:

- `master_warn`, `fire`, `oil_low_pressure`, `fuel_low_pressure`, `anti_ice`, `eng_starter`, `apu`

### Annunciators Bottom

Maps the bottom annunciator LED row in `leds`.

![Annunciators Bottom tab](/images/bravo-tab-annunciators-bottom.png)

Typical keys:

- `master_caution`, `vacuum`, `hydro_low_pressure`, `aux_fuel_pump`, `parking_brake`, `volt_low`, `doors`

### Auto Pilot Knobs

Maps encoder behavior under `knobs`.

![Auto Pilot Knobs tab](/images/bravo-tab-knobs.png)

Typical keys:

- `ap_alt`, `ap_hdg`, `ap_vs`, `ap_crs`, `ap_ias`

Each knob can use:

- Dataref mode (`datarefs`)
- Command mode (`commands`)

### Bus Voltage

Controls whether the aircraft is considered powered on (`conditions.bus_voltage`).

![Bus Voltage tab](/images/bravo-tab-bus-voltage.png)

Use this tab to define power-on datarefs and thresholds.

### Landing Gear

Configures the gear indicator behavior in `leds.gear`.

![Landing Gear tab](/images/bravo-tab-landing-gear.png)

## Revert and Save

- **Revert** discards unsaved edits for the current profile.
- **Save YAML** persists current tab changes to the profile file.

## Profile selection logic

At runtime, profile selection is:

1. Read ICAO from `sim/aircraft/view/acf_ICAO`.
2. Try exact file: `profiles/<ICAO>.yaml`.
3. If multiple files share ICAO prefix, match exact aircraft UI name (`sim/aircraft/view/acf_ui_name`) against `metadata.selectors`.

Example:

- ICAO `C172` can use `C172 G1000.yaml` and `C172 Steam.yaml`.
- `metadata.selectors` picks the correct variant.

## Advanced topic: edit YAML directly

Direct YAML editing is still supported for bulk edits and scripting workflows.

### Main top-level keys

- `metadata`
- `buttons`
- `knobs`
- `leds`
- `conditions`
- `data`

### Minimal advanced template

```yaml
metadata:
  name: "<display name>"
  description: "<optional description>"
  selectors:
    - "<exact aircraft UI name>"

buttons:
  hdg:
    single_click:
      - command_str: "<xplane/command>"
    double_click:
      - command_str: "<xplane/command>"

knobs:
  ap_hdg:
    datarefs:
      - dataref_str: "<xplane/dataref>"

leds:
  hdg:
    datarefs:
      - dataref_str: "<xplane/dataref>"
        operator: "=="
        threshold: 1

conditions:
  bus_voltage:
    datarefs:
      - dataref_str: "sim/cockpit2/electrical/bus_volts"
        operator: ">"
        threshold: 0.01
```

### YAML validation checklist

1. File name matches ICAO or starts with ICAO for variants.
2. `metadata.selectors` exactly matches X-Plane UI aircraft name.
3. `command_str` values exist in X-Plane command list.
4. Each LED/condition dataref has `operator` and `threshold`.
5. Use `index` for array-style datarefs when required.

For reference examples, see profiles in the repo: [`profiles/`](https://github.com/x-z7a/zoal-honeycomb/tree/main/profiles)
