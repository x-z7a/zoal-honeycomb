# zoal-honeycomb X-Plane plugin.
#
# v2 targets X-Plane 12.4.4+ on Apple Silicon macOS, Windows x64 and Linux x64.
# The configurator runs inside X-Plane: a React app (frontend/) shown in a
# SkyScript browser window. Every platform links the SkyScript library and
# ships a renamed copy of it next to its .xpl (see "SkyScript" below).
#
#   make dev        build mac + UI and install into $(XPLANE_PLUGIN_DIR)
#   make release    build every platform into build/zoal-honeycomb
#   make models     regenerate frontend/src/models.ts from the Go types

VERSION ?= development
PKG     := github.com/x-z7a/zoal-honeycomb
LDFLAGS := -X $(PKG)/pkg/xplane.VERSION=$(VERSION)
OUT     := build/zoal-honeycomb

XPLANE_PLUGIN_DIR ?= $(HOME)/X-Plane 12/Resources/plugins/zoal-honeycomb

# ---------------------------------------------------------------- SkyScript
# Every SkyScript plugin ships the same library under the same identity, and
# loaders key loaded libraries by that identity, not by path: a second plugin
# with a stock copy (zoal-atc ships one) would silently get the first one's.
# So each platform's copy is renamed before linking, and the .xpl records the
# new name. Same scheme as SkyScript's scripts/unique-library-identity.sh.
# https://github.com/x-z7a/skyscript/blob/main/docs/developer/multiple-plugins.md
SKYSCRIPT_VERSION ?= 0.14.0
SKYSCRIPT_DIR     := $(CURDIR)/Libraries/SkyScript/$(SKYSCRIPT_VERSION)
SKYSCRIPT_DIST    := $(SKYSCRIPT_DIR)/SkyScript-lib/lib
SKYSCRIPT_STAMP   := $(SKYSCRIPT_DIR)/.downloaded

SKYSCRIPT_NAME := SkyScriptLib-zoal-honeycomb
MAC_LIB_DIR    := $(SKYSCRIPT_DIR)/mac
MAC_LIB        := $(MAC_LIB_DIR)/lib$(SKYSCRIPT_NAME).dylib
LIN_LIB_DIR    := $(SKYSCRIPT_DIR)/lin
LIN_LIB        := $(LIN_LIB_DIR)/lib$(SKYSCRIPT_NAME).so
WIN_LIB_DIR    := $(SKYSCRIPT_DIR)/win
WIN_DLL        := $(SKYSCRIPT_NAME).dll
WIN_IMPLIB     := $(WIN_LIB_DIR)/lib$(SKYSCRIPT_NAME).dll.a

MAC_CGO_CFLAGS  := -DAPL=1 -DIBM=0 -DLIN=0 -O2 -g
MAC_CGO_LDFLAGS := -F/System/Library/Frameworks/ -F$(CURDIR)/Libraries/Mac -framework XPLM \
	-L$(MAC_LIB_DIR) -l$(SKYSCRIPT_NAME) -Wl,-rpath,@loader_path

.PHONY: all release dev ui models skyscript mac win lin package clean mac-test msys2 msys2-test

all: release

release: mac win lin package

clean:
	rm -rf build/zoal-honeycomb frontend/dist

$(SKYSCRIPT_STAMP):
	mkdir -p "$(SKYSCRIPT_DIR)"
	curl -fsSL -o "$(SKYSCRIPT_DIR)/lib.zip" \
		https://github.com/x-z7a/skyscript/releases/download/v$(SKYSCRIPT_VERSION)/SkyScript-lib-$(SKYSCRIPT_VERSION)-XP12.zip
	unzip -q -o "$(SKYSCRIPT_DIR)/lib.zip" -d "$(SKYSCRIPT_DIR)"
	touch "$@"

skyscript: $(SKYSCRIPT_STAMP)

$(MAC_LIB): $(SKYSCRIPT_STAMP)
	mkdir -p "$(MAC_LIB_DIR)"
	cp "$(SKYSCRIPT_DIST)/mac_x64/libSkyScriptLib.dylib" "$@"
	install_name_tool -id @rpath/lib$(SKYSCRIPT_NAME).dylib "$@"
	codesign -f -s - "$@"

$(LIN_LIB): $(SKYSCRIPT_STAMP)
	mkdir -p "$(LIN_LIB_DIR)"
	cp "$(SKYSCRIPT_DIST)/lin_x64/libSkyScriptLib.so" "$@"
	patchelf --set-soname lib$(SKYSCRIPT_NAME).so "$@"

# ---------------------------------------------------------------- frontend
ui:
	cd frontend && npm ci && npm run build

models:
	go run ./cmd/gen-ts-models

# ---------------------------------------------------------------- platforms
# Apple Silicon only (SkyScript ships an arm64 dylib; Intel Macs stay on v1).
mac: $(MAC_LIB)
	mkdir -p $(OUT)
	rm -f $(OUT)/mac.xpl
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=1 \
	CGO_CFLAGS="$(MAC_CGO_CFLAGS)" CGO_LDFLAGS="$(MAC_CGO_LDFLAGS)" \
	go build -buildmode c-shared -o $(OUT)/mac.xpl -ldflags="$(LDFLAGS)" plugin/plugin.go
	rm -f $(OUT)/mac.h
	cp "$(MAC_LIB)" $(OUT)/

# Windows has no install name or SONAME to rewrite: the DLL name comes from
# the import library. So instead of linking SkyScript's SkyScriptLib.lib, build
# an import library from its export list (SkyScriptLib.def) that names the
# renamed DLL, and the .xpl links against that name directly.
WIN_CC      ?= x86_64-w64-mingw32-gcc
WIN_DLLTOOL ?= $(shell $(WIN_CC) -print-prog-name=dlltool)
WIN_OBJDUMP ?= $(shell $(WIN_CC) -print-prog-name=objdump)
# Under msys2, make sees POSIX paths (/d/a/...) but go and ld.exe are native
# Windows programs, and MSYS only converts the first path in an environment
# variable. Hand them native paths; elsewhere (cross-compiling) use as is.
native_path = $(if $(shell command -v cygpath 2>/dev/null),$(shell cygpath -m '$(1)'),$(1))
WIN_LIBS    = $(call native_path,$(CURDIR)/Libraries/Win/XPLM_64.lib) \
	$(call native_path,$(WIN_IMPLIB))

$(WIN_IMPLIB): $(SKYSCRIPT_STAMP)
	mkdir -p "$(WIN_LIB_DIR)"
	sed 's/^LIBRARY .*/LIBRARY "$(WIN_DLL)"/' "$(SKYSCRIPT_DIST)/win_x64/SkyScriptLib.def" > "$(WIN_LIB_DIR)/$(SKYSCRIPT_NAME).def"
	"$(WIN_DLLTOOL)" -d "$(WIN_LIB_DIR)/$(SKYSCRIPT_NAME).def" -l "$@"

win: $(WIN_IMPLIB)
	mkdir -p $(OUT)
	rm -f $(OUT)/win.xpl
	GOOS=windows GOARCH=amd64 CGO_ENABLED=1 CC=$(WIN_CC) \
	CGO_CFLAGS="-DIBM=1 -static -O2 -g" \
	CGO_LDFLAGS="$(WIN_LIBS) -static-libgcc -static-libstdc++ -Wl,--exclude-libs,ALL" \
	go build -buildmode c-shared -o $(OUT)/win.xpl -ldflags="$(LDFLAGS)" plugin/plugin.go
	rm -f $(OUT)/win.h
	cp "$(SKYSCRIPT_DIST)/win_x64/SkyScriptLib.dll" $(OUT)/$(WIN_DLL)
	OBJDUMP="$(WIN_OBJDUMP)" scripts/check-win-dlls.sh $(OUT) $(WIN_DLL)

# Built with the host's glibc toolchain (CI runs this on Ubuntu): the SkyScript
# .so is linked against glibc.
LIN_CC ?= gcc
lin: $(LIN_LIB)
	mkdir -p $(OUT)
	rm -f $(OUT)/lin.xpl
	GOOS=linux GOARCH=amd64 CGO_ENABLED=1 CC=$(LIN_CC) \
	CGO_CFLAGS="-DLIN=1 -DAPL=0 -DIBM=0 -O2 -g" \
	CGO_LDFLAGS="-shared -rdynamic -nodefaultlibs -L$(LIN_LIB_DIR) -l$(SKYSCRIPT_NAME) -Wl,-rpath,\$$ORIGIN" \
	go build -buildmode c-shared -o $(OUT)/lin.xpl -ldflags="$(LDFLAGS)" plugin/plugin.go
	rm -f $(OUT)/lin.h
	cp "$(LIN_LIB)" $(OUT)/

# UI bundle and shipped profiles. Never touches "user profiles".
package: ui
	mkdir -p $(OUT)
	rm -rf $(OUT)/ui $(OUT)/profiles
	cp -R frontend/dist $(OUT)/ui
	cp -R profiles $(OUT)/profiles
	cp Changelog.txt $(OUT)/

dev: VERSION = development
dev: mac package
	mkdir -p "$(XPLANE_PLUGIN_DIR)"
	cp $(OUT)/mac.xpl $(OUT)/lib$(SKYSCRIPT_NAME).dylib "$(XPLANE_PLUGIN_DIR)/"
	rm -rf "$(XPLANE_PLUGIN_DIR)/ui"
	cp -R $(OUT)/ui "$(XPLANE_PLUGIN_DIR)/ui"
	cp -R $(OUT)/profiles/ "$(XPLANE_PLUGIN_DIR)/profiles/"

# ---------------------------------------------------------------- tests
mac-test: $(MAC_LIB)
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=1 \
	CGO_CFLAGS="-DAPL=1 -DIBM=0 -DLIN=0" CGO_LDFLAGS="$(MAC_CGO_LDFLAGS)" \
	DYLD_FRAMEWORK_PATH="$(CURDIR)/Libraries/Mac" DYLD_LIBRARY_PATH="$(MAC_LIB_DIR)" \
	go test -race -coverprofile=coverage.txt -covermode=atomic ./... -v

# Windows msys2/mingw64 shell.
PLUG_DIR = $(XPL_ROOT)/Resources/plugins/zoal-honeycomb

msys2:
	@if [ -z "$(XPL_ROOT)" ]; then echo "Environment is not setup"; exit 1; fi
	$(MAKE) win package WIN_CC=gcc
	[ -d "$(PLUG_DIR)" ] && cp -p $(OUT)/win.xpl $(OUT)/$(WIN_DLL) "$(PLUG_DIR)/." && cp -R $(OUT)/ui "$(PLUG_DIR)/."

msys2-test:
	@if [ -z "$(XPL_ROOT)" ]; then echo "Environment is not setup"; exit 1; fi
	go test -race -coverprofile=coverage.txt -covermode=atomic ./... -v
