# Create a New Profile

This guide shows how to build a new profile using `profiles/C172 G1000.yaml` as the reference.

## Quick workflow

1. Copy a close existing profile in `profiles/`.
2. Rename the file for your aircraft (see naming rules below).
3. Update `metadata` so the profile can be selected correctly.
4. Map AP buttons in `buttons`.
5. Map rotary encoder targets in `knobs`.
6. Define LED rules in `leds`.
7. Add conditions in `conditions`
8. Tune knob step behavior in `data` (optional).
9. Reload the profile in plugin and verify behavior in cockpit.

## File naming and selection logic

The plugin loads profiles like this:

1. It reads aircraft ICAO from `sim/aircraft/view/acf_ICAO`.
2. It first tries `profiles/<ICAO>.yaml`.
3. It then scans files that start with the same ICAO prefix and picks the one whose `metadata.selectors` contains the exact aircraft UI name (`sim/aircraft/view/acf_ui_name`).

Example:

- ICAO `C172` can use `C172 G1000.yaml` and `C172 Steam.yaml`.
- `metadata.selectors` decides which variant is chosen.
- This is useful when you have multiple C172 (from LR and airfoilab for). So you can have a profile for each plane.

## Top-level YAML keys

The C172 G1000 profile uses all major sections:

- `metadata`: identity and selector matching.
- `buttons`: AP button click actions.
- `knobs`: AP rotary encoder targets.
- `leds`: Honeycomb LED on/off rules.
- `conditions`: global guard conditions that decide whether LEDs should be active at all.
- `data`: use planes' step value instead of plugin default. (exmaple, when you turn knob fast, HDG might change by 10 instead of 1.)

## 1) `metadata`

```yaml
metadata:
  name: Laminar C172 Skyhawk (G1000)
  description: Laminar Cessna 172 Skyhawk (G1000) FOSM
  selectors:
    - Cessna Skyhawk (G1000)
```

Key reference:

| Key | Example value | Meaning |
| --- | --- | --- |
| `metadata.name` | `Laminar C172 Skyhawk (G1000)` | Display name used in logs/menu. |
| `metadata.description` | `Laminar Cessna 172 Skyhawk (G1000) FOSM` | Human-readable description only. |
| `metadata.selectors` | `["Cessna Skyhawk (G1000)"]` | Exact UI aircraft names used to choose this profile among same ICAO-prefix files. |

## 2) `buttons`

Each AP button supports:

- `single_click`: commands fired on single press.
- `double_click`: commands fired when second click occurs within 500ms.
- Each click list can run one or multiple commands in order.
- Normally, your plane author provides these cmds for you. You can always use datarefEditor to find them

Schema:

```yaml
buttons:
  <button_name>:
    single_click:
      - command_str: "<xplane/command/path>"
    double_click:
      - command_str: "<xplane/command/path>"
```

Supported `button_name` keys:

- `hdg`, `nav`, `apr`, `rev` , `alt`, `vs`, `ias`, `ap`,

C172 G1000 button map:

| Key | Example value | Meaning |
| --- | --- | --- |
| `buttons.nav.single_click[0].command_str` | `sim/GPS/g1000n3_nav` | NAV mode on single press. |
| `buttons.nav.double_click[0].command_str` | `sim/GPS/g1000n3_nav` | Same action on double press. |
| `buttons.hdg.single_click[0].command_str` | `sim/GPS/g1000n3_hdg` | HDG mode select. |
| `buttons.hdg.double_click[0].command_str` | `sim/GPS/g1000n3_hdg_sync` | Heading sync shortcut. |
| `buttons.ias.single_click[0].command_str` | `sim/GPS/g1000n3_flc` | FLC (IAS) mode select. |
| `buttons.ias.double_click[0].command_str` | `sim/GPS/g1000n3_flc` | Same action on double press. |
| `buttons.alt.single_click[0].command_str` | `sim/GPS/g1000n3_alt` | Alt hold mode select. |
| `buttons.alt.double_click[0].command_str` | `sim/GPS/g1000n3_alt` | Same action on double press. |
| `buttons.vs.single_click[0].command_str` | `sim/GPS/g1000n3_vs` | VS mode select. |
| `buttons.vs.double_click[0].command_str` | `sim/GPS/g1000n3_vnv` | VNAV shortcut on double press. |
| `buttons.apr.single_click[0].command_str` | `sim/GPS/g1000n3_apr` | APR mode select. |
| `buttons.apr.double_click[0].command_str` | `sim/GPS/g1000n3_apr` | Same action on double press. |
| `buttons.ap.single_click[0].command_str` | `sim/autopilot/servos_toggle` | AP master toggle. |
| `buttons.ap.double_click[0].command_str` | `sim/autopilot/servos_toggle` | Same action on double press. |

Notes:

- You can omit buttons you do not use.
- A commented-out key like `# rev:` means `REV` button is intentionally unassigned.

## 3) `knobs`

`knobs` defines what the Bravo encoder edits when a knob mode is selected (HDG, ALT, VS, IAS, CRS). 

Most planes use dataref and the plugin will change the dataref value accordingly. Some planes only use cmd, so you will need to provide one for increment and one for decrement.

Schema:

```yaml
knobs:
  <knob_name>:
    datarefs:
      - dataref_str: "<xplane/dataref>"
        index: <optional array index>
    commands:
      - command_str: "<optional increment command>"
      - command_str: "<optional decrement command>"
```

Supported `knob_name` keys:

- `ap_hdg`, `ap_alt`, `ap_vs`, `ap_ias`, `ap_crs`

C172 G1000 knob map:

| Key | Example value | Meaning |
| --- | --- | --- |
| `knobs.ap_hdg.datarefs[0].dataref_str` | `sim/cockpit2/autopilot/heading_dial_deg_mag_pilot` | Heading bug target. |
| `knobs.ap_alt.datarefs[0].dataref_str` | `sim/cockpit/autopilot/altitude` | Selected altitude target. |
| `knobs.ap_vs.datarefs[0].dataref_str` | `sim/cockpit2/autopilot/vvi_dial_fpm` | VS target in FPM. |
| `knobs.ap_ias.datarefs[0].dataref_str` | `sim/cockpit2/autopilot/airspeed_dial_kts_mach` | IAS target. |
| `knobs.ap_crs.datarefs[0].dataref_str` | `sim/cockpit2/radios/actuators/nav1_obs_deg_mag_pilot` | NAV1 course bug. |

Notes:

- If `commands` is omitted, plugin writes directly to the dataref value.
- If `commands` exists, first command is used for increase and second for decrease.

## 4) `leds`

Each LED entry is a condition block:

```yaml
leds:
  <led_name>:
    condition: any   # optional, default is "all"
    datarefs:
      - dataref_str: "<xplane/dataref>"
        index: <optional array index>
        operator: "== | != | > | < | >= | <="
        threshold: <number>
```

Evaluation behavior:

- If `condition` is omitted, all datarefs must pass (`AND` behavior).
- If `condition: any`, any one passing dataref turns LED on (`OR` behavior).
- `operator` is required for each `datarefs[]` item in `leds` and `conditions`.
- `threshold` is compared against live dataref value.

C172 G1000 LED rules:

| LED key | Rule summary |
| --- | --- |
| `leds.hdg` | On when `heading_mode == 1`. |
| `leds.nav` | On when `nav_status >= 1` OR `gpss_status >= 1` (`condition: any`). |
| `leds.apr` | On when `approach_status == 1`. |
| `leds.rev` | On when `backcourse_status == 1`. |
| `leds.alt` | On when `altitude_hold_status >= 1`. |
| `leds.vs` | On when `vvi_status >= 1`. |
| `leds.ias` | On when `autopilot_state == 106` (aircraft-specific bitmask/state value). |
| `leds.ap` | On when `servos_on > 0.01`. |
| `leds.gear` | Uses `sim/flightmodel2/gear/deploy_ratio != 0` (special multi-gear handling in plugin). |
| `leds.master_warn` | On when master warning dataref is active. |
| `leds.fire` | On when engine fire annunciator is active. |
| `leds.oil_low_pressure` | On when oil pressure warning value `>= 1`. |
| `leds.fuel_low_pressure` | Mapped to fuel quantity warning `>= 1` in this profile. |
| `leds.anti_ice` | On when pitot heat switch is on (`== 1`). |
| `leds.eng_starter` | On when starter is engaged (`> 0.01`). |
| `leds.apu` | On when APU running (`> 0.01`). |
| `leds.master_caution` | On when master caution is active. |
| `leds.vacuum` | On when low vacuum warning `> 0`. |
| `leds.aux_fuel_pump` | On when fuel pump on (`> 0.01`). |
| `leds.parking_brake` | On when parking brake ratio `== 1`. |
| `leds.volt_low` | On when low voltage warning `== 1`. |
| `leds.doors` | On when either door open ratio exceeds `0.9` (`condition: any`, second item uses `index: 1`). |

## 5) `conditions`

`conditions` defines global checks used by plugin core logic:

- `bus_voltage` decides whether LEDs are on at all.
- `retractable_gear` decides whether gear LEDs should be active at all.

```yaml
conditions:
  bus_voltage:
    datarefs:
      - dataref_str: "<xplane/dataref>"
        operator: ">"
        threshold: 0.01
  retractable_gear:
    datarefs:
      - dataref_str: "<xplane/dataref>"
        operator: "!="
        threshold: 0
```

C172 G1000 values:

| Key | Example value | Meaning |
| --- | --- | --- |
| `conditions.bus_voltage.datarefs[0].dataref_str` | `sim/cockpit2/electrical/bus_volts` | If this condition fails, plugin turns all LEDs off. |
| `conditions.bus_voltage.datarefs[0].operator` | `>` | Compare bus volts as greater-than. |
| `conditions.bus_voltage.datarefs[0].threshold` | `0.01` | Minimum voltage considered "powered". |
| `conditions.retractable_gear.datarefs[0].dataref_str` | `sim/aircraft/gear/acf_gear_retract` | Tells plugin if gear LEDs should be active. |
| `conditions.retractable_gear.datarefs[0].operator` | `!=` | Non-zero means retractable gear exists. |
| `conditions.retractable_gear.datarefs[0].threshold` | `0` | Zero means fixed gear. |

## 6) `data`

`data` provides values used by runtime logic for knob increments and related behavior.

Schema:

```yaml
data:
  <data_key>:
    datarefs:
      - dataref_str: "<xplane/dataref>"
    value: <optional literal>
```

Supported keys:

- `ap_state`, `ap_alt_step`, `ap_vs_step`, `ap_ias_step`

C172 G1000 values:

| Key | Example value | Meaning |
| --- | --- | --- |
| `data.ap_vs_step.datarefs[0].dataref_str` | `sim/aircraft/autopilot/vvi_step_ft` | Reads VS increment from aircraft config. |
| `data.ap_alt_step.value` | `20` | Hard-sets ALT increment to 20 units for encoder adjustments. |

## Minimal starter template

You can simply copy from `default.yaml`

## Validation checklist

1. File name starts with ICAO (for variants) or exactly matches ICAO.
2. `metadata.selectors` matches X-Plane UI name exactly (spacing and case).
3. All `command_str` values exist in X-Plane command list.
4. Every LED/condition dataref item has `operator` and `threshold`.
5. Array datarefs use `index` when needed (for example second door).
6. Profile reload succeeds without plugin log errors.

### Validation Tool

The UI, once it's implemented, should give you some validation feedback. As of now, any online yaml validator will do the bare minimum for you. However, it can't validate your dataref/cmd.