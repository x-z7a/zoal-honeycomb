//go:build !test

package xplane

// In-sim configurator: a React app (frontend/) rendered in an X-Plane browser
// window through SkyScript.
//
// The frontend calls skyscript.postMessage(<method>, [args...]) (see
// frontend/src/api.ts); each handler below answers one method with its JSON
// result. Handlers run on the X-Plane main thread during the flight loop, so
// they must stay quick: file I/O on the profile folders is fine, network is not.

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	skyscript "github.com/x-z7a/skyscript/go"
	"github.com/x-z7a/zoal-honeycomb/pkg"
	"github.com/x-z7a/zoal-honeycomb/pkg/profilestore"
	"github.com/xairline/goplane/xplm/dataAccess"
)

const (
	configUIFolder = "ui"
	configUIAppID  = "app-zoal-honeycomb"
)

type configUI struct {
	logger pkg.Logger
	app    *skyscript.App
	store  *profilestore.Store
	// onProfilesChanged runs after a save or create so the hardware side
	// picks up the edit right away.
	onProfilesChanged func()
	// active is the profile the hardware side has loaded. Only touched on
	// the X-Plane main thread (flight loop, menu and message handlers).
	active profilestore.ActiveProfile
}

// startConfigUI initializes SkyScript and creates the (hidden) configurator
// window. It returns nil when the UI bundle is missing, so the hardware side
// still runs normally.
func startConfigUI(logger pkg.Logger, pluginPath string, onProfilesChanged func()) *configUI {
	index := filepath.Join(pluginPath, configUIFolder, "index.html")
	if _, err := os.Stat(index); err != nil {
		logger.Warningf("In-sim configurator disabled: %s not found", index)
		return nil
	}

	skyscript.SetLogPrefix("[zoal-honeycomb skyscript]")
	skyscript.Initialize()
	skyscript.SetPluginPath(pluginPath)
	skyscript.SetAssetsPath(filepath.Join(pluginPath, "assets"))

	cfg := skyscript.DefaultConfig()
	cfg.Homepage = (&url.URL{Scheme: "file", Path: filepath.ToSlash(index)}).String()
	cfg.HideAddressBar = true
	cfg.Width = 1200
	cfg.Height = 1200
	cfg.MinimumWidth = 900

	app := skyscript.CreateAppWindow("ZOAL Honeycomb", configUIAppID, &cfg)
	if app == nil {
		logger.Errorf("In-sim configurator: SkyScript could not create a window")
		skyscript.Shutdown()
		return nil
	}

	ui := &configUI{
		logger:            logger,
		app:               app,
		store:             profilestore.New(filepath.Join(pluginPath, profilestore.FolderName)),
		onProfilesChanged: onProfilesChanged,
	}
	ui.registerHandlers()
	ui.reload()
	logger.Infof("In-sim configurator ready (%s)", cfg.Homepage)
	return ui
}

func (ui *configUI) stop() {
	if ui == nil {
		return
	}
	skyscript.Shutdown()
}

func (ui *configUI) toggle() {
	if ui == nil {
		return
	}
	if ui.app.Visible() {
		ui.app.Hide()
		return
	}
	// Pick up edits made on disk since the window was last open, and tell an
	// already-loaded page to refetch.
	ui.reload()
	ui.app.Show("")
	ui.app.PostMessage("profilesChanged", "{}")
}

func (ui *configUI) reload() {
	if err := ui.store.Reload(); err != nil {
		ui.logger.Errorf("In-sim configurator: %v", err)
	}
}

// setActiveProfile records the profile the hardware side just loaded and
// tells an open page, so the sidebar can mark it.
func (ui *configUI) setActiveProfile(file, name string) {
	if ui == nil {
		return
	}
	ui.active = profilestore.ActiveProfile{File: file, Name: name}
	payload, err := json.Marshal(ui.active)
	if err != nil {
		return
	}
	ui.app.PostMessage("activeProfileChanged", string(payload))
}

func (ui *configUI) profilesChanged() {
	if ui.onProfilesChanged != nil {
		ui.onProfilesChanged()
	}
}

// handle registers fn for a channel. The payload is the JSON array of the
// method's arguments; fn's result is marshalled back as the reply.
func (ui *configUI) handle(channel string, fn func(args []json.RawMessage) (any, error)) {
	ui.app.OnMessage(channel, func(payload string) (resp string, err error) {
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("%s: %v", channel, r)
				ui.logger.Errorf("In-sim configurator: %v", err)
			}
		}()

		var args []json.RawMessage
		if payload != "" && payload != "null" {
			if err := json.Unmarshal([]byte(payload), &args); err != nil {
				return "", fmt.Errorf("%s: bad arguments: %w", channel, err)
			}
		}
		result, err := fn(args)
		if err != nil {
			return "", err
		}
		out, err := json.Marshal(result)
		if err != nil {
			return "", err
		}
		return string(out), nil
	})
}

// arg decodes args[i] into v, reporting which argument was bad.
func arg(args []json.RawMessage, i int, v any) error {
	if i >= len(args) {
		return fmt.Errorf("missing argument %d", i+1)
	}
	if err := json.Unmarshal(args[i], v); err != nil {
		return fmt.Errorf("argument %d: %w", i+1, err)
	}
	return nil
}

func (ui *configUI) registerHandlers() {
	ui.handle("GetProfilesStatus", func([]json.RawMessage) (any, error) {
		return ui.store.Status(), nil
	})
	ui.handle("GetProfiles", func([]json.RawMessage) (any, error) {
		return ui.store.Profiles(), nil
	})
	ui.handle("GetProfileFiles", func([]json.RawMessage) (any, error) {
		return ui.store.Files(), nil
	})
	ui.handle("GetProfileErrors", func([]json.RawMessage) (any, error) {
		return ui.store.Errors(), nil
	})
	ui.handle("GetProfileSources", func([]json.RawMessage) (any, error) {
		return ui.store.Sources(), nil
	})

	ui.handle("GetActiveProfile", func([]json.RawMessage) (any, error) {
		return ui.active, nil
	})

	// Manual reload: reread the profile folders and the in-use profile, for
	// edits made outside the configurator.
	ui.handle("ReloadProfiles", func([]json.RawMessage) (any, error) {
		if err := ui.store.Reload(); err != nil {
			return nil, err
		}
		ui.profilesChanged()
		return nil, nil
	})
	ui.handle("DeleteUserProfiles", func(args []json.RawMessage) (any, error) {
		var files []string
		if err := arg(args, 0, &files); err != nil {
			return nil, err
		}
		n, err := ui.store.DeleteUserProfiles(files)
		if n > 0 {
			// The in-use profile may be gone; fall back to the next match.
			ui.profilesChanged()
		}
		if err != nil {
			return nil, err
		}
		return n, nil
	})

	ui.handle("SaveProfileByIndex", func(args []json.RawMessage) (any, error) {
		var index int
		var profile pkg.Profile
		if err := arg(args, 0, &index); err != nil {
			return nil, err
		}
		if err := arg(args, 1, &profile); err != nil {
			return nil, err
		}
		if err := ui.store.Save(index, profile); err != nil {
			return nil, err
		}
		ui.profilesChanged()
		return nil, nil
	})
	ui.handle("CreateProfileFromDefault", func(args []json.RawMessage) (any, error) {
		var filename, name, description string
		var selectors []string
		for i, v := range []any{&filename, &name, &description, &selectors} {
			if err := arg(args, i, v); err != nil {
				return nil, err
			}
		}
		path, err := ui.store.CreateFromDefault(filename, name, description, selectors)
		if err != nil {
			return nil, err
		}
		ui.profilesChanged()
		return path, nil
	})

	// Datarefs are read directly. The reply keeps the X-Plane web API's
	// {"data": ...} shape, which is what the frontend parses.
	ui.handle("GetXplane", func([]json.RawMessage) (any, error) {
		return []string{
			datarefValueJSON("sim/aircraft/view/acf_ICAO"),
			datarefValueJSON("sim/aircraft/view/acf_ui_name"),
		}, nil
	})
	ui.handle("GetXplaneDataref", func(args []json.RawMessage) (any, error) {
		var name string
		if err := arg(args, 0, &name); err != nil {
			return nil, err
		}
		return datarefValueJSON(name), nil
	})
}

// datarefValueJSON returns the dataref's value in the X-Plane web API's
// {"data": ...} envelope, or "" when the dataref does not exist.
func datarefValueJSON(name string) string {
	if name == "" {
		return ""
	}
	ref, found := dataAccess.FindDataRef(name)
	if !found {
		return ""
	}

	var value any
	types := dataAccess.GetDataRefTypes(ref)
	switch {
	case types&dataAccess.TypeData != 0:
		value = base64.StdEncoding.EncodeToString([]byte(dataAccess.GetString(ref)))
	case types&dataAccess.TypeFloatArray != 0:
		value = dataAccess.GetFloatArrayData(ref)
	case types&dataAccess.TypeIntArray != 0:
		value = dataAccess.GetIntArrayData(ref)
	case types&dataAccess.TypeDouble != 0:
		value = dataAccess.GetDoubleData(ref)
	case types&dataAccess.TypeFloat != 0:
		value = dataAccess.GetFloatData(ref)
	case types&dataAccess.TypeInt != 0:
		value = dataAccess.GetIntData(ref)
	default:
		return ""
	}

	out, err := json.Marshal(map[string]any{"data": value})
	if err != nil {
		return ""
	}
	return string(out)
}
