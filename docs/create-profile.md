# Create a New Profile

Recommended flow is hybrid:

1. Create a new YAML file from an existing similar aircraft profile.
2. Set `metadata` (especially `selectors`) in YAML.
3. Use the UI editor for buttons/knobs/lights/conditions.
4. Save from UI and test in X-Plane.

## Quick start

The configurator's **+** button (Plugins → ZOAL Honeycomb → Configurator) creates a new profile from `default.yaml` in `user profiles/`. To start from a similar aircraft instead:

1. Copy a close existing profile from `profiles/` into `user profiles/`.
2. Rename to match your ICAO/variant naming strategy.
3. Update:
   - `metadata.name`
   - `metadata.description`
   - `metadata.selectors` (exact aircraft UI name)
4. Open the configurator in X-Plane and select your new profile.
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

Full guide: [Profiles Guide](/profiles)
