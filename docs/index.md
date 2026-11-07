---
layout: home

hero:
  name: zoal-honeycomb v2
  text: Honeycomb Bravo Profiles for X-Plane 12.4.4+
  tagline: Previously xa-honeycomb. Looking for X-Plane 11 or older X-Plane 12? See the v1 docs.
  actions:
    - theme: brand
      text: Install Guide
      link: /install
    - theme: alt
      text: Supported Planes
      link: /supported-planes
    - theme: alt
      text: v1 Docs
      link: /v1/
    - theme: alt
      text: WebGA
      link: https://zoal.app/

features:
  - title: Configurator Inside X-Plane
    details: "New in v2: edit buttons, knobs, LEDs, bus voltage, and gear behavior in a window inside X-Plane (Plugins → ZOAL Honeycomb → Configurator). Saves apply immediately, no separate app."
  - title: Single + Double Click AP Actions
    details: Map AP buttons to separate single-click and double-click commands, useful for push/pull-style behavior on a single button.
  - title: YAML Profiles
    details: Profiles are still stored as YAML under profiles/, with direct editing available for advanced workflows.
  - title: Auto Reconnect
    details: Plugin reconnect behavior is built in.
  - title: Active Aircraft Coverage
    details: Includes Toliss, Zibo, LevelUp, FlightFactor, Laminar, and more.
---

::: danger v2 requires X-Plane 12.4.4 or newer
zoal-honeycomb v2 runs on **X-Plane 12.4.4+** only, on **Apple Silicon Macs**, **Windows x64** and **Linux x64**.
**X-Plane 11 and Intel Macs are no longer supported.**

Not sure? Check before installing:

- **X-Plane version:** the first line of `Log.txt` in your X-Plane folder, e.g. `Log.txt for X-Plane 12.4.4-r1 ...`
- **Mac chip:** Apple menu → **About This Mac**. "Chip: Apple M…" is Apple Silicon; "Processor: Intel" is not.

On an older setup, stay on **[v1.18.0](https://github.com/x-z7a/zoal-honeycomb/releases/tag/v1.18.0)** and use the **[v1 docs](/v1/)**.
:::

## Links

- Latest release: [GitHub Releases](https://github.com/x-z7a/zoal-honeycomb/releases/latest)
- Upgrading from v1: [Upgrade Guide](/upgrade)
- Create a profile tutorial: [Create Profile](/create-profile)
- Profiles format: [Profiles Guide](/profiles)
- v1 (X-Plane 11, X-Plane 12 before 12.4.4, Intel Mac): [v1 docs](/v1/) and [v1.18.0 release](https://github.com/x-z7a/zoal-honeycomb/releases/tag/v1.18.0)
- License: [GPL-3.0-or-later](https://github.com/x-z7a/zoal-honeycomb/blob/main/LICENSE)
- Source repository: [x-z7a/zoal-honeycomb](https://github.com/x-z7a/zoal-honeycomb)
