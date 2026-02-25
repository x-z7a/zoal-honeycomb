package xplane

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/xairline/goplane/extra"
	"github.com/xairline/goplane/xplm/menus"
	"github.com/xairline/goplane/xplm/processing"
	"github.com/xairline/goplane/xplm/utilities"
)

const githubLatestReleaseURL = "https://api.github.com/repos/x-z7a/zoal-honeycomb/releases/latest"

var versionCheckHTTPClient = &http.Client{Timeout: 3 * time.Second}

type githubRelease struct {
	TagName string `json:"tag_name"`
}

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
	s.checkForNewReleaseVersion()

}

func (s *xplaneService) onPluginStop() {
	s.BravoService.Exit()
	s.Logger.Info("Plugin stopped")
	s.cancelFunc()
}

func (s *xplaneService) checkForNewReleaseVersion() {
	localVersion := strings.TrimSpace(VERSION)
	remoteVersion, err := fetchLatestGithubReleaseVersion(versionCheckHTTPClient, githubLatestReleaseURL)
	if err != nil {
		s.Logger.Warningf("Unable to check remote release version: %v", err)
		return
	}

	if versionsMatch(localVersion, remoteVersion) {
		s.Logger.Infof("Version check: local %s matches remote %s", localVersion, remoteVersion)
		return
	}

	message := fmt.Sprintf(
		"ZOAL Honeycomb plugin update available. Local: %s, Latest: %s",
		localVersion,
		remoteVersion,
	)
	s.Logger.Warning(message)
	utilities.SpeakString(message)
}

func fetchLatestGithubReleaseVersion(client *http.Client, endpoint string) (string, error) {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "xa-honeycomb-version-check")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("github api %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", err
	}

	if strings.TrimSpace(release.TagName) == "" {
		return "", fmt.Errorf("missing tag_name in github release response")
	}

	return release.TagName, nil
}

func versionsMatch(local, remote string) bool {
	return normalizeVersion(local) == normalizeVersion(remote)
}

func normalizeVersion(version string) string {
	version = strings.TrimSpace(version)
	version = strings.TrimPrefix(version, "v")
	version = strings.TrimPrefix(version, "V")
	return version
}
