//go:build !test

package main

import (
	"github.com/x-z7a/zoal-honeycomb/pkg/xplane"
	"github.com/xairline/goplane/extra/logging"
)

func main() {
}

func init() {
	xplaneLogger := xplane.NewXplaneLogger()
	logging.MinLevel = logging.Info_Level
	logging.PluginName = "xa honeycomb - " + xplane.VERSION

	// entrypoint
	xplane.NewXplaneService(
		xplaneLogger,
	)
}
