package xplane

import (
	"github.com/xairline/goplane/extra/logging"
	"github.com/xairline/goplane/xplm/menus"
)

func (s *xplaneService) menuHandler(menuRef interface{}, itemRef interface{}) {
	itemId := itemRef.(int)
	if itemId == 1 {
		s.debug = !s.debug
		if s.debug {
			logging.MinLevel = logging.Debug_Level
			menus.CheckMenuItem(s.myMenuId, s.myMenuItemIndex, menus.Menu_Checked)
		} else {
			logging.MinLevel = logging.Info_Level
			menus.CheckMenuItem(s.myMenuId, s.myMenuItemIndex, menus.Menu_Unchecked)
		}

	}
	if itemId == 2 {
		s.configUI.toggle()
	}
	if itemId == 0 {
		s.Logger.Info("Reload Profile Clicked")
		s.profile = nil
	}
	s.Logger.Debugf("menu clicked: %v", itemRef)
}
