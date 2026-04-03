mkfile_path := $(abspath $(lastword $(MAKEFILE_LIST)))
current_dir := $(notdir $(patsubst %/,%,$(dir $(mkfile_path))))
WIN_CURDIR := $(if $(findstring /,$(CURDIR)),$(shell cygpath -m "$(CURDIR)" 2>/dev/null || echo $(CURDIR)),$(CURDIR))

all: mac win lin

clean:
	rm -rf dist build/apps || true || rm ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/mac.xpl
mac:
	GOOS=darwin \
	GOARCH=arm64 \
	CGO_ENABLED=1 \
	CGO_CFLAGS="-DAPL=1 -DIBM=0 -DLIN=0 -O2 -g" \
	CGO_LDFLAGS="-F/System/Library/Frameworks/ -F${CURDIR}/Libraries/Mac -framework XPLM -L${CURDIR}/Libraries/Mac/SkyScript -lSkyScriptLib -lcef_dll_wrapper -framework OpenGL -framework Cocoa -lc++ -L${CURDIR}/Libraries/Mac/SkyScript/cef -lChromiumEmbeddedFramework" \
	go build -buildmode c-shared -o build/zoal-honeycomb/mac.xpl \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=${VERSION}"  plugin/plugin.go
	npm --prefix frontend run build
	node frontend/inline-build.mjs
	cp frontend/skyscript-manifest.yaml build/apps/zoal-honeycomb/manifest.yaml
dev:
	GOOS=darwin \
	GOARCH=arm64 \
	CGO_ENABLED=1 \
	CGO_CFLAGS="-DAPL=1 -DIBM=0 -DLIN=0 -O2 -g" \
	CGO_LDFLAGS="-F/System/Library/Frameworks/ -F${CURDIR}/Libraries/Mac -framework XPLM -L${CURDIR}/Libraries/Mac/SkyScript -lSkyScriptLib -lcef_dll_wrapper -framework OpenGL -framework Cocoa -lc++ -L${CURDIR}/Libraries/Mac/SkyScript/cef -lChromiumEmbeddedFramework" \
	go build -buildmode c-shared -o ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/mac.xpl \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=development" plugin/plugin.go
	cp -r profiles ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/
	cp -r assets ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/
	npm --prefix frontend run build
	node frontend/inline-build.mjs
	cp frontend/skyscript-manifest.yaml build/apps/zoal-honeycomb/manifest.yaml
	rm -rf ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/apps
	cp -r build/apps ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/
MSVC_LIBS := $(if $(MSVC_LIB_DIR),$(MSVC_LIB_DIR)/msvcprt.lib $(MSVC_LIB_DIR)/vcruntime.lib $(MSVC_LIB_DIR)/ucrt.lib,)
win:
	CGO_CFLAGS="-DIBM=1 -static -O2 -g" \
	CGO_LDFLAGS="$(WIN_CURDIR)/Libraries/Win/XPLM_64.lib $(WIN_CURDIR)/Libraries/Win/SkyScript/SkyScriptLib.lib $(WIN_CURDIR)/Libraries/Win/SkyScript/libcef_dll_wrapper.lib $(MSVC_LIBS) -static-libgcc -static-libstdc++ -Wl,--exclude-libs,ALL" \
	GOOS=windows \
	GOARCH=amd64 \
	CGO_ENABLED=1 \
	CC=x86_64-w64-mingw32-gcc \
	CXX=x86_64-w64-mingw32-g++ \
	go build --buildmode c-shared -o build/zoal-honeycomb/win.xpl \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=${VERSION}"  plugin/plugin.go
lin:
	GOOS=linux \
	GOARCH=amd64 \
	CGO_ENABLED=1 \
	CC=/usr/local/bin/x86_64-linux-musl-cc \
	CGO_CFLAGS="-DLIN=1 -O2 -g" \
	CGO_LDFLAGS="-shared -rdynamic -nodefaultlibs -undefined_warning -L${CURDIR}/Libraries/Lin/SkyScript -lSkyScriptLib -lcef_dll_wrapper" \
	go build -tags libusb -buildmode c-shared -o build/zoal-honeycomb/lin.xpl  \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=${VERSION}" plugin/plugin.go

mac-test:
	GOOS=darwin \
	GOARCH=arm64 \
	CGO_ENABLED=1 \
	CGO_CFLAGS="-DAPL=1 -DIBM=0 -DLIN=0" \
	CGO_LDFLAGS="-F/System/Library/Frameworks/ -F${CURDIR}/Libraries/Mac -framework XPLM -L${CURDIR}/Libraries/Mac/SkyScript -lSkyScriptLib -lcef_dll_wrapper -framework OpenGL -framework Cocoa -lc++ -L${CURDIR}/Libraries/Mac/SkyScript/cef -lChromiumEmbeddedFramework" \
	DYLD_FRAMEWORK_PATH="/Users/dzou/git//zoal-honeycomb/Libraries/Mac" \
	go test -race -coverprofile=coverage.txt -covermode=atomic ./... -v

# build on Windows msys2/mingw64
PLUG_DIR=$(XPL_ROOT)/Resources/plugins/zoal-honeycomb

msys2:
	@if [ -z "$(XPL_ROOT)" ]; then echo "Environment is not setup"; exit 1; fi
	go build --buildmode c-shared -o build/zoal-honeycomb/win.xpl \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=${VERSION}" plugin/plugin.go
	[ -d "$(PLUG_DIR)" ] && cp -p build/zoal-honeycomb/win.xpl "$(PLUG_DIR)/."

msys2-test:
	@if [ -z "$(XPL_ROOT)" ]; then echo "Environment is not setup"; exit 1; fi
	go test -race -coverprofile=coverage.txt -covermode=atomic ./... -v
