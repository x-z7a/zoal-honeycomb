//go:build !test

package main

import (
	"github.com/xairline/goplane/extra/logging"
	"github.com/xairline/xa-honeycomb/pkg/xplane"
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
