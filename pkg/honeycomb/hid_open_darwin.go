//go:build darwin

package honeycomb

import "github.com/sstallion/go-hid"

var setOpenExclusive = hid.SetOpenExclusive

func configureHIDOpenMode() {
	setOpenExclusive(false)
}
