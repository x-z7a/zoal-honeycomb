//go:build !test

package xplane

// goplane's display package would provide this, but its cgo exports do not
// compile with current clang, so the one XPLM call needed is declared here.

/*
extern void XPLMGetScreenSize(int *outWidth, int *outHeight);
*/
import "C"

// screenSize returns the size of X-Plane's main window in boxels.
func screenSize() (width, height int) {
	var w, h C.int
	C.XPLMGetScreenSize(&w, &h)
	return int(w), int(h)
}
