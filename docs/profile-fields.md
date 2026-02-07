# Profile Field Reference (UI)

This page explains each section in the Profile Editor `Form` tab.

You can follow this without editing raw YAML.

## Screen Layout

- Left side: profile list and `New Profile`
- Top bar: `Form`, `YAML`, `Save`, `Save As`
- Main area: sections (`Metadata`, `Buttons`, `Knobs`, `LEDs`, `Data`, `Conditions`)

## Metadata Section

What it is for: profile identity and aircraft matching.

Fields:

| UI field | What to enter | Why it matters |
| --- | --- | --- |
| `Name` | Friendly profile name | Helps you identify profile |
| `Description` | Short description | Optional note for this profile |
| `Selectors (one per line)` | Aircraft UI name(s) | Used to auto-match the correct profile |

Tip:

- If current aircraft does not match, add its exact UI name in `Selectors`.

## Buttons Section

What it is for: what each Bravo AP button does.

Button groups:

- `hdg`, `nav`, `alt`, `apr`, `vs`, `ap`, `ias`, `rev`

Fields in each group:

| UI field | What to enter |
| --- | --- |
| `Single Click (one command per line)` | X-Plane command(s) for single press |
| `Double Click (one command per line)` | X-Plane command(s) for double press |

Tip:

- Keep one command per line.

## Knobs Section

What it is for: what each knob does when rotated.

Knob groups:

- `ap_hdg`, `ap_vs`, `ap_alt`, `ap_ias`, `ap_crs`

Fields in each group:

| UI field | What to enter |
| --- | --- |
| `Datarefs (one per line)` | Use when knob is dataref-driven |
| `Commands (one command per line)` | Use when knob sends commands |

Tip:

- Most aircraft use `Commands`.
- If turning direction feels wrong, swap the up/down command order.

## LEDs Section

What it is for: when each Bravo LED turns on.

LED groups include:

- `hdg`, `nav`, `apr`, `rev`, `alt`, `vs`, `ias`, `ap`
- `gear`, `master_warn`, `master_caution`, `fire`
- `oil_low_pressure`, `fuel_low_pressure`, `anti_ice`, `eng_starter`
- `apu`, `vacuum`, `hydro_low_pressure`, `aux_fuel_pump`
- `parking_brake`, `volt_low`, `doors`

Fields:

| UI field | Meaning |
| --- | --- |
| `Condition` | `all` (every row must pass) or `any` (any row can pass) |
| `Dataref` | Dataref to monitor |
| `Operator` | Comparison type (`==`, `!=`, `>`, `<`, `>=`, `<=`) |
| `Threshold` | Number used in comparison |
| `Index` | Optional array slot (leave blank unless needed) |

Buttons:

- `Add Dataref`: add another condition row
- `Remove`: delete a row

## Data Section

What it is for: extra runtime values used by logic.

Common rows:

- `ap_state`
- `ap_alt_step`
- `ap_vs_step`
- `ap_ias_step`

Fields:

| UI field | Meaning |
| --- | --- |
| `Value` | Optional fixed value |
| `Datarefs (one per line)` | Dataref source(s) |

## Conditions Section

What it is for: global gates used by runtime.

Important condition groups:

| Group | Effect |
| --- | --- |
| `bus_voltage` | If false, all LEDs turn off |
| `retractable_gear` | If false, gear LEDs are disabled |

Fields are the same style as `LEDs`: `Condition`, `Dataref`, `Operator`, `Threshold`, `Index`.

## Save Controls

| Button | What it does |
| --- | --- |
| `Save` | Saves current profile filename |
| `Save As` | Saves a copy with a new filename |
| `New Profile` (left sidebar) | Starts from `default.yaml` template |

If save fails and you see `Save not available in browser mode`, run the app inside SkyScript (not plain browser preview).
