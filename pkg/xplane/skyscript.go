//go:build !test

package xplane

import (
	"encoding/json"
	"fmt"
	"path/filepath"

	skyscript "github.com/x-z7a/skyscript/go"

	"github.com/x-z7a/zoal-honeycomb/pkg"
)

func (s *xplaneService) initSkyScript() {
	s.Logger.Info("SkyScript: initializing")
	skyscript.Initialize()
	skyscript.SetLogPrefix("[zoal-honeycomb]")
	skyscript.SetPluginPath(s.pluginPath)
	skyscript.SetAssetsPath(filepath.Join(s.pluginPath, "assets"))
	if ok := skyscript.LoadAppsFromDirectory(); !ok {
		s.Logger.Warning("SkyScript: no apps discovered in apps/ directory")
		return
	}

	app := skyscript.FindApp("app-zoal-honeycomb")
	if app == nil {
		s.Logger.Warning("SkyScript: zoal-honeycomb app not found, message handlers not registered")
		return
	}

	pm := newPanelProfileManager(s.pluginPath, s.Logger)
	pm.loadProfiles()
	registerPanelHandlers(app, pm, s.Logger)
	s.Logger.Info("SkyScript: message handlers registered for zoal-honeycomb panel")
}

func (s *xplaneService) shutdownSkyScript() {
	s.Logger.Info("SkyScript: shutting down")
	skyscript.Shutdown()
}

func (s *xplaneService) toggleSkyScriptWindow() {
	app := skyscript.FindApp("app-zoal-honeycomb")
	if app == nil {
		s.Logger.Error("SkyScript: zoal-honeycomb app not found")
		return
	}
	if app.Visible() {
		app.Hide()
	} else {
		app.Show("")
	}
}

func registerPanelHandlers(app *skyscript.App, pm *panelProfileManager, logger pkg.Logger) {
	app.OnMessage("getProfilesData", func(payload string) (string, error) {
		data := pm.getProfilesData()
		resp, err := json.Marshal(data)
		if err != nil {
			return "", fmt.Errorf("failed to marshal profiles data: %w", err)
		}
		return string(resp), nil
	})

	app.OnMessage("saveProfileByIndex", func(payload string) (string, error) {
		var req struct {
			Index   int         `json:"index"`
			Profile pkg.Profile `json:"profile"`
		}
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			return "", fmt.Errorf("invalid payload: %w", err)
		}
		if err := pm.saveProfileByIndex(req.Index, req.Profile); err != nil {
			return "", err
		}
		data := pm.getProfilesData()
		resp, err := json.Marshal(data)
		if err != nil {
			return "", fmt.Errorf("failed to marshal profiles data: %w", err)
		}
		return string(resp), nil
	})

	app.OnMessage("createProfileFromDefault", func(payload string) (string, error) {
		var req struct {
			Filename    string   `json:"filename"`
			Name        string   `json:"name"`
			Description string   `json:"description"`
			Selectors   []string `json:"selectors"`
		}
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			return "", fmt.Errorf("invalid payload: %w", err)
		}
		createdPath, err := pm.createProfileFromDefault(req.Filename, req.Name, req.Description, req.Selectors)
		if err != nil {
			return "", err
		}
		data := pm.getProfilesData()
		resp, err := json.Marshal(struct {
			CreatedPath string               `json:"createdPath"`
			Data        profilesDataResponse `json:"data"`
		}{
			CreatedPath: createdPath,
			Data:        data,
		})
		if err != nil {
			return "", fmt.Errorf("failed to marshal response: %w", err)
		}
		return string(resp), nil
	})

	logger.Info("SkyScript: registered getProfilesData, saveProfileByIndex, createProfileFromDefault handlers")
}
