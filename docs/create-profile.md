# Create a New Profile

The canonical profile format and authoring guide is available in this docs site:

- [Profiles Guide](/profiles)

Use that guide as the source of truth. It includes:

- Full key-by-key YAML reference
- `profiles/C172 G1000.yaml` walkthrough
- Value explanations (`command_str`, `dataref_str`, `operator`, `threshold`, `condition`)
- Validation checklist and starter template

## Quick start

1. Copy a similar file in `profiles/`.
2. Rename it for your aircraft ICAO/variant.
3. Update `metadata.selectors` to match X-Plane aircraft UI name exactly.
4. Follow the [Profiles Guide](/profiles) to fill `buttons`, `knobs`, `leds`, `conditions`, and `data`.
