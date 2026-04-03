//go:build !test

package xplane

import (
	"path/filepath"

	skyscript "github.com/x-z7a/skyscript/go"
)

func (s *xplaneService) initSkyScript() {
	s.Logger.Info("SkyScript: initializing")
	skyscript.Initialize()
	skyscript.SetLogPrefix("[zoal-honeycomb]")
	skyscript.SetPluginPath(s.pluginPath)
	skyscript.SetAssetsPath(filepath.Join(s.pluginPath, "assets"))
	if ok := skyscript.LoadAppsFromDirectory(); !ok {
		s.Logger.Warning("SkyScript: no apps discovered in apps/ directory")
	}
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
