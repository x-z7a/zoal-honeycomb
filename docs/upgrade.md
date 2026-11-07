# Upgrading from v1

::: danger v2 requires X-Plane 12.4.4 or newer
zoal-honeycomb v2 runs on **X-Plane 12.4.4+** only, on **Apple Silicon Macs**, **Windows x64** and **Linux x64**.
**X-Plane 11 and Intel Macs are no longer supported.**

Not sure? Check before installing:

- **X-Plane version:** the first line of `Log.txt` in your X-Plane folder, e.g. `Log.txt for X-Plane 12.4.4-r1 ...`
- **Mac chip:** Apple menu → **About This Mac**. "Chip: Apple M…" is Apple Silicon; "Processor: Intel" is not.

On an older setup, stay on **[v1.18.0](https://github.com/x-z7a/zoal-honeycomb/releases/tag/v1.18.0)** and use the **[v1 docs](/v1/)**.
:::

## What changes in v2

| | v1 | v2 |
| --- | --- | --- |
| X-Plane | 11 and 12 | **12.4.4 or newer only** |
| macOS | Apple Silicon and Intel | **Apple Silicon only** |
| Windows / Linux | x64 | x64 |
| Configurator | Separate `bravo` app | Window inside X-Plane: **Plugins → ZOAL Honeycomb → Configurator** |
| Import old Honeycomb Configurator `.json` | Yes | **Removed** |
| Reloading after an edit | **Plugins → ZOAL Honeycomb → Reload Profile** | Automatic on save and create |
| Profiles | YAML in `profiles/` and `user profiles/` | Same folders, same format |

## Steps

1. Check the requirements above. If you don't meet them, stay on [v1.18.0](https://github.com/x-z7a/zoal-honeycomb/releases/tag/v1.18.0).
2. Back up `Resources/plugins/zoal-honeycomb/user profiles/`. It holds your own profiles and edits.
3. Install v2 over the old folder (see [Install](/install)).
4. Delete the v1 configurator app from the plugin folder: `bravo`, `bravo.app` and `bravo.exe`. v2 doesn't use them.
5. Start X-Plane and open **Plugins → ZOAL Honeycomb → Configurator**. Your profiles from `profiles/` and `user profiles/` are listed as before.

## Your profiles

The YAML format did not change, so v1 profiles work in v2 as they are. As in v1, **Save YAML** writes to `user profiles/`, so updates to the shipped `profiles/` never overwrite your edits. In v2 a save, or a new profile, takes effect right away. The **Reload Profile** menu item is gone because it is no longer needed.

## Importing old Honeycomb Configurator profiles

v2 can no longer import `.json` profiles from the original Honeycomb Bravo Configurator. If you need one:

1. Import it with the v1 `bravo` app from [v1.18.0](https://github.com/x-z7a/zoal-honeycomb/releases/tag/v1.18.0) ([how](https://github.com/x-z7a/zoal-honeycomb/blob/v1.18.0/PROFILES.md#importing-from-old-honeycomb-configurator)). This writes a YAML profile.
2. Copy that `.yaml` file into v2's `user profiles/` folder.
