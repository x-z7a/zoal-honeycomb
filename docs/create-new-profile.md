# Create a New Profile (UI Only)

Use this when your aircraft has no good profile yet.

You will do everything in the app `Form` tab.

## Before You Start

You need:

- Aircraft loaded in X-Plane
- Known commands/datarefs for that aircraft
- App running with save access (SkyScript mode)

## Step-by-Step

## 1. Click `New Profile`

- In the left sidebar, click `New Profile`.
- Enter filename (example: `B764.yaml`).
- Confirm.

The app starts from `default.yaml`.

## 2. Fill `Metadata`

Set:

- `Name`: clear profile name
- `Description`: short description
- `Selectors`: exact aircraft UI name (one per line)

Use the `Current UI name` indicator in Metadata to confirm match.

## 3. Set `Buttons`

For each key (`hdg`, `nav`, `alt`, `apr`, `vs`, `ap`, `ias`, `rev`):

- Put single-click command(s)
- Put double-click command(s), if needed
- One command per line

## 4. Set `Knobs`

For each knob (`ap_hdg`, `ap_vs`, `ap_alt`, `ap_ias`, `ap_crs`):

- Usually set `Commands` (up/down pair)
- Use `Datarefs` only if aircraft needs dataref-driven control

## 5. Set `LEDs`

For each LED:

- Add one or more datarefs
- Choose operator (`==`, `!=`, `>`, `<`, `>=`, `<=`)
- Set threshold
- Choose `Condition`:
  - `all` for AND logic
  - `any` for OR logic

Start with core AP LEDs:

- `hdg`, `nav`, `apr`, `alt`, `vs`, `ias`, `ap`

Then warning LEDs:

- `master_warn`, `master_caution`, `fire`, `doors`, etc.

## 6. Set `Conditions`

Important:

- `bus_voltage` should be correct, or LEDs may stay off/on incorrectly
- `retractable_gear` should be correct for aircraft gear behavior

## 7. Set `Data` (if needed)

Add or verify `ap_state` and other entries your profile needs.

## 8. Save and Test

1. Click `Save`
2. Test all controls in sim
3. Tune one section at a time
4. Save again

## Recommended Tuning Order

1. Metadata selector match
2. AP button commands
3. Knob directions
4. AP mode LEDs
5. Warning LEDs
6. Conditions (`bus_voltage`, `retractable_gear`)
