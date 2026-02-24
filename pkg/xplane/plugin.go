package xplane

import (
	"runtime"

	"github.com/xairline/goplane/extra"
	"github.com/xairline/goplane/xplm/menus"
	"github.com/xairline/goplane/xplm/processing"
)

func (s *xplaneService) onPluginStateChanged(state extra.PluginState, plugin *extra.XPlanePlugin) {
	switch state {
	case extra.PluginStart:
		s.onPluginStart()
	case extra.PluginStop:
		s.onPluginStop()
	case extra.PluginEnable:
		s.Logger.Infof("Plugin: %s enabled", plugin.GetName())
	case extra.PluginDisable:
		s.Logger.Infof("Plugin: %s disabled", plugin.GetName())
	}
}

func (s *xplaneService) onPluginStart() {
	s.Logger.Info("Plugin started")
	runtime.GOMAXPROCS(runtime.NumCPU())

	processing.RegisterFlightLoopCallback(s.flightLoop, 5.0, nil)
	//
	// setup menu
	menuId := menus.FindPluginsMenu()
	menuContainerId := menus.AppendMenuItem(menuId, "XA Honeycomb", 0, false)
	s.myMenuId = menus.CreateMenu("XA Honeycomb", menuId, menuContainerId, s.menuHandler, nil)
	menus.AppendMenuItem(s.myMenuId, "Reload Profile", 0, true)
	menus.AppendMenuSeparator(s.myMenuId)
	s.myMenuItemIndex = menus.AppendMenuItem(s.myMenuId, "Enable Debug", 1, true)

	if s.debug {
		menus.CheckMenuItem(s.myMenuId, s.myMenuItemIndex, menus.Menu_Checked)
	} else {
		menus.CheckMenuItem(s.myMenuId, s.myMenuItemIndex, menus.Menu_Unchecked)
	}
	s.setupKnobsCmds()
	s.setupApCmds()
	s.setupTrimCmds()

}

func (s *xplaneService) onPluginStop() {
	s.BravoService.Exit()
	s.Logger.Info("Plugin stopped")
	s.cancelFunc()
}
