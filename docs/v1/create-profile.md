# Create a New Profile

::: warning Archived: v1 documentation
These docs are for **zoal-honeycomb v1** (latest: [v1.18.0](https://github.com/x-z7a/zoal-honeycomb/releases/tag/v1.18.0)), which supports X-Plane 11, X-Plane 12 before 12.4.4, and Intel Macs.
On X-Plane 12.4.4 or newer? Use [v2](/) instead.
:::

Recommended flow is hybrid:

1. Create a new YAML file from an existing similar aircraft profile.
2. Set `metadata` (especially `selectors`) in YAML.
3. Use the UI editor for buttons/knobs/lights/conditions.
4. Save from UI and test in X-Plane.

## Quick start

1. Copy a close existing profile in `profiles/`.
2. Rename to match your ICAO/variant naming strategy.
3. Update:
   - `metadata.name`
   - `metadata.description`
   - `metadata.selectors` (exact aircraft UI name)
4. Open `bravo` and select your new profile.
5. Configure tabs in UI:
   - `Autopilot Buttons`
   - `Autopilot Lights`
   - `Annunciators Top` / `Bottom`
   - `Auto Pilot Knobs`
   - `Bus Voltage`
   - `Landing Gear`
6. Click **Save YAML** and verify in cockpit.

## When to edit YAML directly

- You need bulk find/replace across many profiles.
- You need to script generation of variants.
- You are fixing metadata/file naming before UI usage.

Full guide: [Profiles Guide](/v1/profiles)
