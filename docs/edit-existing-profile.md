# Edit an Existing Profile (No YAML Needed)

Use this flow when a profile already works, but you want to tune behavior.

## Safe Editing Flow

1. Open the profile in the left list.
2. Click `Save As` first and create a copy.
3. Edit one section at a time in `Form`.
4. Test in sim.
5. Save again.

This protects the original profile.

## Step-by-Step

## 1. Open the profile

- In the left sidebar, click the profile you want to change.

## 2. Make a backup copy

- Click `Save As` in the top bar.
- Enter a new filename (example: `B738_mysetup.yaml`).
- Confirm.

## 3. Edit with the Form tab

- Keep the top tab on `Form` (not `YAML`).

Common edits:

- `Buttons`: change single-click / double-click commands
- `Knobs`: change rotate commands
- `LEDs`: adjust `Condition`, `Operator`, `Threshold`
- `Metadata`: update profile name/selectors

## 4. Test in X-Plane

After each small change, check:

- Button action is correct
- Knob direction is correct
- LED turns on/off at the expected time

## 5. Save

- Click `Save`.
- Check status in sidebar footer (should show saved message).

## Troubleshooting

## Save button does not work

If status says `Save not available in browser mode`:

- You are in read-only mode.
- Run inside SkyScript for write access.

## Profile not auto-selected

- Go to `Metadata` -> `Selectors`
- Add exact aircraft UI name (one per line)
- Save and retest

## LED never turns on

- In `LEDs`, verify:
  - correct `Dataref`
  - correct `Operator`
  - realistic `Threshold`
  - `Condition` (`all` vs `any`)
