# Migration Plan: Go → Native C++ with ImGui UI

> **Status**: Draft — not yet approved for implementation
> **Date**: 2026-11-16

## 1. Inventory (what we have today)

| Component | Location | Lines | What it does |
|-----------|----------|-------|-------------|
| `pkg/xplane/*.go` (8 files) | core plugin | ~1,335 | Plugin lifecycle, flight loop, datarefs, commands, menus, profile loading, expression eval, profile store |
| `pkg/honeycomb/leds.go` | LED bits | ~530 | 27 LED state bitmasks (ANNUNCIATOR_W1/W2, GEAR_W, AUTO_PILOT_W) |
| `pkg/honeycomb/bravo.go` | HID bridge | ~146 | hidapi init/connect to Bravo (vid:pid = 0x294B:0x1901), feature reports |
| `pkg/shared.go` | Types | ~138 | All YAML schema structs (Profile, Buttons, Knobs, Leds, etc.) |
| `profilestore/store.go` | Configurator backend | ~440 | Dual-folder profile store (shipped/default vs user profiles) |
| `plugin/plugin.go` | Entry point | ~22 | `init()`, calls xplane.NewXplaneService() |
| Frontend (React/SkyScript) | `frontend/` | ~10k LOC | Browser-based configurator rendered in SkyScript window |

**3 key external deps to replace:**
- `goplane/xplm/*` → hand-written XPLM C++ wrappers
- `go-hid` → `hidapi.h` (third-party .h/.c, embed in repo or vendored)
- `expr-lang/expr` → lightweight embedded expression evaluator
- `yaml.v3` → `yaml-cpp` or hand-rolled YAML loader

---

## 2. Target Directory Structure

```
zoal-honeycomb/
├── CMakeLists.txt              # Top-level, sets up all targets
├── cmake/
│   └── xplane-sdk.cmake        # Finds XP SDK, configures XPLM_INCLUDES
├── src/
│   ├── zoal_honeycomb.cpp      # Entry: XPluginOpen/XPluginStop/etc.
│   ├── zoal_honeycomb.h
│   │
│   ├── plugin/                 # Lifecycle & orchestration
│   │   ├── manager.h/cpp       # Singleton, init/stop, configUI launch
│   │   └── menu.h/cpp          # XPLM menus ("ZOAL Honeycomb" submenu)
│   │
│   ├── core/                   # Flight loop + hardware
│   │   ├── flight_loop.h/cpp   # 100ms callback: LED updates, cmd queue
│   │   ├── hid_manager.h/cpp   # hidapi wrapper (cross-platform)
│   │   └── led_state.h/cpp     # Bitmasks for ANNUNCIATOR_W1/W2, GEAR_W, AP_W
│   │
│   ├── profile/                # All YAML/schema logic
│   │   ├── types.h             # ALL structs from pkg/shared.go + profilestore
│   │   ├── loader.h/cpp        # loadProfile(), aircraft IACO matching
│   │   ├── store.h/cpp         # Dual-folder store (configUI backend)
│   │   └── expression.h/cpp    # expr-lang replacement for condition eval
│   │
│   ├── xplane/                 # X-Plane integration
│   │   ├── dataref.h/cpp       # DataRef reader/writer helpers
│   │   ├── commands.h/cpp      # Command registration + dispatch
│   │   ├── callbacks.h/cpp     # FlightLoop, process_loop registrations
│   │   └── debug_log.h/cpp     # XPLMDebugString logger
│   │
│   └── ui/                     # ImGui configurator
│       ├── imgui_window.h/cpp  # Main configurator window + message dispatch
│       └── imgui_tab_*.h/cpp   # Per-tab UI (buttons, leds, knobs, etc.)
│
├── thirdparty/
│   ├── hidapi/                 # MIT-licensed hidapi .h + .c
│   └── yaml-cpp/               # OR inline minimal YAML parser
│
├── profiles/                   # ← stays as-is
│   └── *.yaml
├── docs/                       # ← stays as-is
└── README.md
```

---

## 3. Phased Migration Steps

### Phase 0 — Prerequisites (no behavioral change)

**Goal:** Set up C++ build skeleton alongside Go code.

1. Create `CMakeLists.txt` with a `zoal-honeycomb` static library target + the existing `.xpl` shared library targets still working
2. Add `thirdparty/hidapi/` — copy `hidapi.h` and `hid.c` from upstream (MIT license, single .h/.c pair)
3. Choose YAML approach:
   - **Option A:** Link `yaml-cpp` (requires vcpkg/conan on CI, ~5MB increase)
   - **Option B:** Inline a minimal YAML parser (~1000 LOC, only needs: map/string/list parsing for `.yaml` profiles) — recommended since profile YAML is a predictable subset
4. Add `src/profile/types.h` — copy all types verbatim from `pkg/shared.go`:
   - `Metadata`, `Dataref`, `DatarefCondition`, `Command`, `ConditionProfile`, `DatarefProfile`, `LEDProfile`, `DataProfile`, `KnobProfile`, `ButtonProfile`, `Knobs`, `Leds`, `Data`, `TrimWheels`, `Conditions`, `Buttons`, `Profile`
   - Add JSON serialization helpers for configurator roundtrip (only fields actually used by the UI need support)
5. No tests break. Nothing ships yet.

---

### Phase 1 — Core Hardware Layer (replace honeycomb/ + pkg/xplane parts)

**Goal:** HID reads/writes + LED bitmask management, flight loop still wired to Go stub.

#### 1a. `hid_manager.h/cpp`
| From Go | To C++ |
|---------|--------|
| `hid.Init()` / `hid.Exit()` | `hidapi_hid_init()` / `hidapi_hid_exit()` |
| `hid.OpenFirst(Vendor, Product)` | `hidapi_hid_open(VENDOR_ID, PRODUCT_ID)` → returns `hid_device*` |
| `bravo.SendFeatureReport(buf)` | `hidapi_hid_send_feature_report(dev, data, len)` |
| Global `BRAVO_CONNECTED`, `PROFILE_LOADED` | Class members `connected_`, `profile_loaded_` |

#### 1b. `led_state.h/cpp`
Copy all constants from `leds.go` as `constexpr`:
```cpp
// annunciator_w2 bits
constexpr uint8_t LED_FUEL_PUMP     = (1 << 0);
constexpr uint8_t LED_PARKING_BRAKE = (1 << 1);
// ... etc.

class LedState {
    uint8_t annunciator_w1_ = 0;
    uint8_t annunciator_w2_ = 0;
    uint8_t gear_w_ = 0;
    uint8_t ap_w_ = 0;
public:
    void SendToBravo(hid_device* dev);
    // ... helper methods for all OnLED*/OffLED* patterns
};
```

All `OnLED...()` / `OffLED...()` free functions become static inline in a `.h` or methods on `LedState`. The bitmasks are written to the Bravo via `hid_manager::SendFeatureReport()`.

#### 1c. Flight loop (still Go-backed for now)
Not touched yet — keeps the existing `.xpl` plugin working while we build the C++ core alongside it.

---

### Phase 2 — Profile System

**Goal:** YAML loading, expression evaluation, profile store — all in C++.

#### 2a. `profile/types.h`
Direct translation of every struct from `pkg/shared.go`. Key differences:
- Replace `interface{}` with `std::variant<std::monostate, std::string, int, float, bool>` or simple base classes
- Add JSON serialization methods for configurator roundtrip

#### 2b. `profile/loader.h/cpp`
Translates `tryLoadProfile()`, `setupProfile()`, `loadProfile()` (314 LOC in `profile.go`).
- Reads YAML files from `profiles/` and `user profiles/` directories
- Aircraft IACO matching via `XPLMGetDatavi()` / `XPLMGetData refi()` (replacing `dataAccess.GetString("sim/aircraft/view/acf_ICAO")`)
- UI name fallback matching

#### 2c. `profile/expression.h/cpp` — expr-lang Replacement

This is the biggest concern, and for good reason. But the expressions are extremely constrained:

**What expr-lang actually does in this project:**

Every condition from the YAML profiles reduces to ONE of these two patterns:
```
GetFloatData(ref) > threshold        // scalar dataref
GetFloatArrayData(ref)[index] < threshold  // array dataref with index
```

With one of six operators: `==`, `!=`, `>`, `<`, `>=`, `<=`

That's it. Not arbitrary Go code. Not a script language. Two patterns, six operators.

**The expr-lang compilation pipeline:**

1. At load time: `expr.Compile(code, env)` → parses "GetFloatData(myRef) > 27" into a VM bytecode program
2. At runtime: `expr.Run(program, env)` → executes the bytecode against live datarefs

**Replacement — a tiny parser (~200 LOC):**

```cpp
// profile/expression.h

#pragma once
#include <string>
#include <vector>
#include <functional>
#include <optional>

namespace profile {

struct DataRefRead {
    std::string name;      // e.g. "sim/cockpit2/autopilot/heading_mode"
    int index = -1;         // -1 for scalar, >=0 for array
};

enum class CompOp { Equals, NotEquals, Greater, Less, GEq, LEq };

// A single parsed condition: one dataref + one comparison
struct ConditionClause {
    DataRefRead read;
    CompOp op = CompOp::Equals;
    float threshold = 0.0f;
};

// A full condition: one or more clauses AND'd (or OR'd if "any")
struct ParsedCondition {
    std::vector<ConditionClause> clauses;
    bool any_of = false;  // true means OR, false means AND
    
    // Evaluate against live datarefs — lambdas provided by the caller
    using FloatReader = std::function<float(const std::string&)>;
    using IntReader   = std::function<int(const std::string&)>;
    using FloatArrReader = std::function<std::vector<float>(const std::string&, int)>;
    
    bool Evaluate(FloatReader fr, IntReader ir, FloatArrReader arr) const;
};

// Minimal parser: turns a YAML condition into ParsedCondition
class ConditionParser {
public:
    static std::optional<ParsedCondition> Parse(
        const std::string& dataref_name,
        const std::string& operator_str,
        float threshold,
        int index = -1);
};

} // namespace profile
```

**Evaluation is trivial:**
```cpp
bool ParsedCondition::Evaluate(FloatReader fr, IntReader ir, FloatArrReader arr) const {
    auto compare = [](float a, CompOp op, float b) {
        switch (op) {
            case CompOp::Equals:      return a == b;
            case CompOp::NotEquals:   return a != b;
            case CompOp::Greater:     return a > b;
            case CompOp::Less:        return a < b;
            case CompOp::GEq:         return a >= b;
            case CompOp::LEq:         return a <= b;
        }
    };
    
    bool result = any_of;  // true for OR, false for AND
    for (auto& clause : clauses) {
        float val;
        if (clause.read.index >= 0)
            val = arr(clause.read.name, clause.read.index)[clause.read.index];
        else
            val = fr(clause.read.name);
        
        bool match = compare(val, clause.op, clause.threshold);
        if (!match && !any_of) return false;   // AND: fail fast
        if (match && any_of) return true;      // OR: short-circuit
    }
    return result;
}
```

**Why this is safe:**
- Input is YAML profile files (your control, not user input)
- The operator set is fixed at compile time (no `eval()`, no `exec()`)
- Each condition has exactly one dataref + one comparison + one threshold
- No bytecode, no AST, no VM — just a parsed struct and lambdas

**Testing strategy:** Take every YAML profile's conditions (~50 profiles, ~15 unique patterns), run them against the same test aircraft IACOs that `xplane_test.go` uses, and verify outputs match the Go version byte-for-byte.

#### 2d. `profile/store.h/cpp`
Translates `profilestore/store.go`:
- `Reload()` — scan both directories, parse YAMLs
- `Combine()` — merge default + user profiles by filename
- `Save()`, `CreateFromDefault()`, `DeleteUserProfiles()`
- Sanitize for save (strip runtime-only fields)

---

### Phase 3 — XPLM Wrappers & Plugin Core

**Goal:** Full plugin behavior without Go, but no UI yet (configurator stubbed).

#### 3a. `xplane/dataref.h/cpp`
Hand-written wrappers around XPLM data reference calls:
```cpp
namespace xplane {

enum class DataType { Float, Double, Int, FloatArray, IntArray };

class DataRef {
    XPLMDataRef ref_;
public:
    float GetFloat() const;
    double GetDouble() const;
    int GetInt() const;
    std::vector<float> GetFloatArray() const;
    void SetFloat(float v);
    void SetInt(int v);
};

DataRef Find(const char* name);  // XPLMFindDataRef + return wrapper
}
```

#### 3b. `xplane/commands.h/cpp`
Command registration and dispatch via `XPLMRegisterCommandCallback` / `XPLMUnregisterCommandCallback`:
- `Honeycomb Bravo/increase`, `Honeycomb Bravo/decrease` (knob encoder)
- `Honeycomb Bravo/mode_*` (AP mode selection)
- `Honeycomb Bravo/ap_*` (autopilot buttons)
- `Honeycomb Bravo/pitch_trim_up/down` (trim wheel)

#### 3c. `xplane/callbacks.h/cpp`
Flight loop callback registration, process loop (if used). The 100ms loop from `RegisterFlightLoopCallback(s.flightLoop, 5.0, ...)` becomes:
```cpp
void RegisterCallbacks();
float FlightLoop(float elapsed, float sinceLast, int counter, void* ref);
// Returns next interval (0.1 for 100ms)
```

#### 3d. `xplane/debug_log.h/cpp`
`XPLMDebugString()`-backed logger replacing `goplane/extra/logging`:
```cpp
namespace log {
    enum Level { Debug, Info, Warning, Error };
    void Log(Level level, const char* fmt, ...);
}
```

#### 3e. `zoal_honeycomb.cpp` — Main Plugin Entry
The full `XPluginOpen`, `XPluginStop`, `XPluginReceiveMessage` implementation:
- Initialize `LedState`, `HidManager`, `ProfileStore`
- Register flight loop, menu callbacks
- Launch config UI (currently stubbed)

```cpp
// zoal_honeycomb.cpp (new entry point)
#include "plugin/manager.h"

static plugin::Manager& GetManager() {
    static plugin::Manager instance;
    return instance;
}

PLUGIN_EXPORT int XPluginOpen(char* outName, char* outSig, char* outDesc) {
    // ... populate name/signature/description
    GetManager().Initialize();
    return 1; // success
}

PLUGIN_EXPORT void XPluginStop() {}
PLUGIN_EXPORT int XPluginReceiveMessage(
    long incomingMessage, long param, void* sender) {
    return GetManager().HandleMessage(incomingMessage, param, sender);
}
```

#### 3f. `plugin/menu.h/cpp`
Translates `menu.go`: "ZOAL Honeycomb" submenu with Configurator + Enable Debug items. Uses `XPLMCreateMenu`, `XPLMAddMenuItem`.

---

### Phase 4 — ImGui Configurator (the big one)

**Goal:** Full in-sim configurator replacing the React/SkyScript frontend.

This is the largest single effort. The React app has ~10k LOC across 15 files; each maps to an ImGui window/tab.

#### 4a. Architecture Overview

Instead of SkyScript's `app.OnMessage(channel, fn)` bridge → JSON ↔ Go, we use **ImGui callbacks + shared data model**:

```
┌───────────────────────────────────────┐
│         ImGui Window (imgui_window)   │
│                                       │
│  ┌─────────────┐  ┌──────────────┐   │
│  │ Left Panel   │  │ Right Panel  │   │
│  │ (Profiles    │  │ (Editor      │   │
│  │  list + X-   │  │  tabs)       │   │
│  │   Plane info)│  │              │   │
│  └─────────────┘  └──────────────┘   │
└───────────────────────────────────────┘
         ↓ callbacks on "Save"          │
    profile::store.Save(index, prof)    │
         ↓ writes to disk               │
    "user profiles/A320.yaml"           │
```

Each "tab" in the React app becomes an ImGui `ImGuiTabItem` with its own rendering function. The data flows through shared pointers to `profile::Profile` objects — no serialization overhead.

#### 4b. File Mapping: React → ImGui

| React Component | ImGui Replacement | Key Logic |
|-----------------|-------------------|-----------|
| `App.tsx` (1002 LOC) | `ui/imgui_window.h/cpp` | Main layout, profile state machine, dirty tracking |
| `components/profiles.tsx` (496 LOC) | `ui/imgui_profiles_tab.h/cpp` | Profile list with checkboxes, error badges, reload/delete buttons |
| `components/metadata.tsx` (184 LOC) | inline in main window | Name/description/selector text fields |
| `components/lightConfiguration.tsx` (462 LOC) | `ui/imgui_led_config.h/cpp` | Collapsible LED configs with dataref condition editors |
| `components/buttonConfiguration.tsx` (234 LOC) | `ui/imgui_button_config.h/cpp` | Single-click/Double-click command list editors |
| `components/knobConfiguration.tsx` (497 LOC) | `ui/imgui_knob_config.h/cpp` | Dataref + commands editor for 5 AP knobs |
| `components/dataConfiguration.tsx` (438 LOC) | `ui/imgui_data_config.h/cpp` | Step controls (AP_ALT_STEP, AP_VS_STEP, AP_IAS_STEP) |
| `components/trimWheelConfiguration.tsx` (217 LOC) | `ui/imgui_trim_config.h/cpp` | Up/Down cmd + sensitivity + window_ms fields |
| `components/xplane.tsx` (89 LOC) | inline in main window | IACO + aircraft name display |
| `api.ts` (69 LOC) | **eliminated** | Direct function calls, no bridge needed |

#### 4c. SkyScript Replacement — The Bridge

Currently the frontend talks to Go via:
```typescript
// frontend/src/api.ts — SkyScript bridge
skyscript.postMessage("GetProfiles", [])
  .then(json => parse(json))
```

In C++/ImGui this is **direct function calls** on shared objects. No JSON serialization, no IPC:

```cpp
// BEFORE (SkyScript/React)
const profiles = await GetProfiles(); // → SkyScript.postMessage → Go goroutine → JSON

// AFTER (ImGui/C++)
auto profiles = store_.GetProfiles();  // direct memory access
```

The configurator's "handle" functions become member lambdas:
```cpp
// BEFORE
ui.handle("SaveProfileByIndex", func(args) { ... });

// AFTER
auto onSave = [this](int index, const Profile& prof) {
    store_.Save(index, prof);
};
```

#### 4d. Specific ImGui Rendering Strategies

**Profiles panel (left sidebar):**
- `ImGui::ListBox` or `ImGui::BeginChild` + loop with checkboxes
- Each row: `[ ] Name (file.yaml)` + red error badge if parse error
- Bottom buttons: `Reload`, `+ New`, `Delete` (disabled when dirty)

**Editor tabs (right panel):**
```cpp
if (ImGui::BeginTabBar("editor")) {
    if (ImGui::BeginTabItem("Autopilot Buttons"))     { RenderButtonsTab(); }
    if (ImGui::BeginTabItem("Autopilot Lights"))      { RenderLedsTab(); }
    if (ImGui::BeginTabItem("Annunciators Top"))      { RenderAnnunciatorsTab(ROW_TOP); }
    if (ImGui::BeginTabItem("Annunciators Bottom"))   { RenderAnnunciatorsTab(ROW_BOTTOM); }
    if (ImGui::BeginTabItem("Auto Pilot Knobs"))      { RenderKnobsTab(); }
    if (ImGui::BeginTabItem("AP Rotary Steps"))       { RenderDataStepsTab(); }
    if (ImGui::BeginTabItem("Trim Wheels"))           { RenderTrimWheelsTab(); }
    if (ImGui::BeginTabItem("Bus Voltage"))           { RenderConditionTab("bus_voltage"); }
    if (ImGui::BeginTabItem("Landing Gear"))          { RenderConditionTab("retractable_gear"); }
    ImGui::EndTabBar();
}
```

**Per-LED / per-button row:**
```cpp
// Each LED condition becomes:
ImGui::Text("%s", led.name);
if (ImGui::BeginTable(...)) {
    // For each dataref in the condition:
    static char datarefBuf[256]; strncpy(datarefBuf, dr.dataref_str, 255);
    ImGui::InputText("Dataref", datarefBuf, sizeof(datarefBuf));
    // Operator dropdown, threshold input
    // "Add Dataref" button to append another row
}
ImGui::EndTable();
```

**Command list editor:**
```cpp
// Single-click / Double-click command lists:
for (auto& cmd : btn.single_click) {
    static char buf[256]; strncpy(buf, cmd.command_str.c_str(), 255);
    ImGui::InputText("##cmd", buf, sizeof(buf));
    if (ImGui::SameLine() && ImGui::SmallButton("x")) { /* remove */ }
}
if (ImGui::SmallButton("+ Add Command")) { btn.single_click.push_back({}); }
```

#### 4e. Window Management

Replace SkyScript's `CreateAppWindow` / `SetGeometry` clamp loop with:
```cpp
// ImGui window created once, shown/hidden per toggle
static bool visible = false;
if (visible) {
    ImGui::SetNextWindowPos(ImVec2(100, 100), ImGuiCond_FirstUseEver);
    ImGui::SetNextWindowSize(ImVec2(1000, 700));
    if (ImGui::Begin("ZOAL Honeycomb Configurator", &visible)) {
        RenderMainWindow();
    }
    ImGui::End();
}
```

The clamp-loop that kept the window below X-Plane's menu bar becomes a one-time position check on window creation. The same approach used in X-Plane 12.4.4's native ImGui examples.

---

### Phase 5 — Integration & Cutover

**Goal:** Swap the `.xpl` build from Go to C++ entirely.

1. **Build system update:**
   - `CMakeLists.txt` produces `mac.xpl`, `win.xpl`, `lin.xpl` as before
   - No more `go build -buildmode c-shared` — just `clang++` / `g++` linking against XPLM SDK + hidapi
   - Mac: `-framework Carbon -framework Cocoa -framework Quartz`
   - Windows: link `user32.lib`, `hid.lib` (or use vendored hidapi, no system deps)

2. **Remove SkyScript dependency:**
   - No more `Libraries/SkyScript/` SDK download in makefile
   - No more library renaming tricks for SkyScript identity
   - The `.xpl` is now a single shared object

3. **Remove React frontend build:**
   - No more `npm ci && npm run build` in the pipeline
   - No `frontend/dist/` output — the ImGui UI is statically linked

4. **CI/CD updates:**
   - Remove Go setup step, add CMake + compiler setup
   - Remove Node.js step (no frontend build)
   - Add `vcpkg` or static hidapi for dependency resolution

---

### Phase 6 — Polish & Cleanup

- [ ] Migrate remaining `.yaml` profile files (no changes needed, just verify)
- [ ] Port tests from `_test.go` to C++ (Google Test or catch2)
- [ ] Update documentation (`PROFILES.md`, `README.md`)
- [ ] Keep `profiles/`, `docs/`, `.github/workflows/` structure updated for new CI
- [ ] Performance benchmarking: flight loop latency, profile loading time

---

## 4. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Expression evaluator correctness** | **High** | Start with a test suite — run every profile condition against the same test aircraft IACOs that `xplane_test.go` uses (A339, DH8D), verify outputs match Go. Only ~15 distinct condition patterns across 50+ profiles. Each pattern is trivially verified. |
| **Expression evaluator scope creep** | Medium | Enforce a hard rule: only support `dataref op threshold`. No function calls, no arithmetic, no multiple conditions in one clause (those are handled by the `ParsedCondition.clauses` vector). |
| hidapi cross-platform quirks | Medium | Vendored hidapi is already battle-tested; same vid:pid, same feature report protocol. Test on Mac first, then Windows. |
| ImGui rendering performance | Low | Single window, ~50 LED rows max. Negligible draw call count. |
| Memory management bugs | Medium | Use `std::vector`, `std::string`, smart pointers. Avoid raw new/delete. |
| CMake/XPLM build quirks | Medium | X-Plane plugin ABI is standard `.so`/`.dylib`/`.dll` with extern "C" entry points. Well-documented. |

---

## 5. Recommended Implementation Order

1. **Skeleton first** — get a "Hello World" `.xpl` loading in X-Plane
2. **HID + LEDs** — verify Bravo communication works before touching profiles
3. **Profile loader** — load `default.yaml`, verify structure parses
4. **Expression evaluator** — unit test every condition pattern from real profiles
5. **Flight loop** — wire LEDs to actual flight datarefs, verify LED behavior matches Go version
6. **ImGui configurator (basic)** — open window, display profile list
7. **ImGui editor tabs** — one tab at a time, starting with simplest (metadata) → hardest (LED conditions)
8. **Save/Load roundtrip** — save from configUI → verify file matches expected YAML
9. **Full integration** — all pieces together, cleanup

---

## 6. What Stays the Same

- **All 50+ `.yaml` profile files** — unchanged, same schema
- **Plugin filename** — `zoal-honeycomb.xpl`, installs to `Resources/plugins/`
- **Menu items** — "ZOAL Honeycomb" in Plugins menu with same items
- **Hardware vid:pid** — `0x294B:0x1901` unchanged
- **HID report protocol** — feature report byte layout identical
- **Profiles directory structure** — `profiles/` + `user profiles/` dual-folder

## 7. What Changes

| Before | After |
|--------|-------|
| Go `.xpl` (c-shared) | Native C++ `.so`/`.dylib` |
| React frontend in SkyScript browser | ImGui window, natively rendered by X-Plane |
| `go.mod` + `go.sum` | `CMakeLists.txt` + vendored deps |
| npm build step (frontend/dist) | Eliminated entirely |
| SkyScript SDK dependency | Eliminated entirely |
| `cmd/gen-ts-models` → `models.ts` | Eliminated — types are C++ headers |
| JSON bridge between frontend and plugin | Direct shared-memory calls |

---

## 8. Estimated Effort Breakdown

| Phase | LOC (new) | Estimated Effort |
|-------|-----------|------------------|
| Phase 0: Skeleton + types | ~500 | 1 day (straightforward copy-paste + C++ idioms) |
| Phase 1: HID + LED state | ~600 | 1-2 days (mostly porting, some testing) |
| Phase 2: Profile system | ~1,200 | 3-4 days (**expression eval is the hard part**) |
| Phase 3: XPLM core | ~1,500 | 3-4 days (XPLM API familiarity, callback wiring) |
| Phase 4: ImGui configurator | ~4,000 | **5-7 days** (largest: each React component → ImGui equivalent) |
| Phase 5: Build integration | ~200 (CMake) | 2-3 days (CI pipeline changes, cross-platform testing) |
| Phase 6: Polish | varies | 2-3 days |

**Total: ~15–22 working days for a single competent C++ developer.**

---

## 9. expr-lang Deep Dive — Why It's More Manageable Than It Looks

This is your primary concern, so let me be very specific about what the Go code does today and how to replace it.

### What `expr-lang` compiles (from `pkg/xplane/profile.go:238-251`)

```go
// Every condition becomes one of these strings:
code = fmt.Sprintf("GetFloatData(myDataref) %s %f", operator, threshold)
code = fmt.Sprintf("GetIntData(myDataref) %s %d", operator, threshold)
code = fmt.Sprintf("GetFloatArrayData(myDataref)[%d] %s %f", index, operator, threshold)
code = fmt.Sprintf("GetIntArrayData(myDataref)[%d] %s %d", index, operator, threshold)
code = fmt.Sprintf("GetDoubleData(myDataref) %s %f", operator, threshold)

// Then: program, _ := expr.Compile(code, env)
```

### What the env looks like (from `pkg/xplane/profile.go:254-261`)

```go
env := map[string]interface{}{
    "GetFloatData":      dataAccess.GetFloatData,      // func(string) float32
    "GetIntData":        dataAccess.GetIntData,         // func(string) int
    "GetFloatArrayData": dataAccess.GetFloatArrayData,  // func(string) []float32
    "GetIntArrayData":   dataAccess.GetIntArrayData,    // func(string) []int
    "myDataref":         myDataref,                     // pre-bound dataref handle
}
```

### The critical observation

**Every compiled expression references exactly one function call with exactly one argument (the dataref name string), and compares the result to a single threshold with a comparison operator.**

The `env` map provides the mapping from function names to actual XPLM calls. There is NO arithmetic, NO function composition, NO loops, NO conditionals inside the expression language itself. The "expression" is literally just:

```
FUNCTION_CALL(result) COMPARE_OP threshold
```

That's it. One comparison. One dataref read.

### Replacement — a hand-rolled evaluator in ~150 lines

```cpp
// No VM, no bytecode, no compilation step at all.
// The "program" is just: (DataRefRead, CompOp, float threshold)
// Evaluated by calling lambdas that wrap XPLM dataref accessors.

// Example usage:
ParsedCondition cond = ConditionParser::Parse("heading_mode", ">=", 0.5f);
bool active = cond.Evaluate(
    [](const std::string& name) { 
        return XP_GetFloatData(XPLM_FindDataRef(name.c_str()));
    },
    // ... other readers
);
```

### Testing the replacement against Go

The Go tests already have two test cases: `A339` and `DH8D`. Run every LED condition from every YAML profile (use the same datarefs, same thresholds) through both the Go implementation and the C++ evaluator simultaneously. If they disagree on ANY combination, you have a bug. If they agree across all conditions, you're done.

**This is not a risky migration if scoped correctly.** The risk comes from scope creep — adding features to "expr-lang replacement" that don't exist in the current YAML profiles. Enforce a hard rule: **only support what's in the YAML today, nothing more.**

---

## 10. Pre-Flight Checklist (before starting)

- [ ] Confirm X-Plane 12.4.4 SDK ships ImGui source (it does — check `Libraries/ImGui/` or similar in SDK)
- [ ] Verify `hidapi.h` license is compatible (MIT — should be fine)
- [ ] Decide on YAML parser approach (inline vs yaml-cpp dependency)
- [ ] Set up XPLM plugin boilerplate Hello World to validate build pipeline
- [ ] Create test harness: ability to load all 50+ YAML profiles in a test binary
- [ ] List every dataref accessed by the project for C++ wrapper coverage
