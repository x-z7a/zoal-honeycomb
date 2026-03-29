mkfile_path := $(abspath $(lastword $(MAKEFILE_LIST)))
current_dir := $(notdir $(patsubst %/,%,$(dir $(mkfile_path))))

all: mac win lin

clean:
	rm -rf dist || true || rm ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/mac.xpl
mac:
	GOOS=darwin \
	GOARCH=arm64 \
	CGO_ENABLED=1 \
	CGO_CFLAGS="-DAPL=1 -DIBM=0 -DLIN=0 -O2 -g" \
	CGO_LDFLAGS="-F/System/Library/Frameworks/ -F${CURDIR}/Libraries/Mac -framework XPLM" \
	go build -buildmode c-shared -o build/zoal-honeycomb/mac_arm.xpl \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=${VERSION}"  plugin/plugin.go
	GOOS=darwin \
	GOARCH=amd64 \
	CGO_ENABLED=1 \
	CGO_CFLAGS="-DAPL=1 -DIBM=0 -DLIN=0 -O2 -g" \
	CGO_LDFLAGS="-F/System/Library/Frameworks/ -F${CURDIR}/Libraries/Mac -framework XPLM" \
	go build -buildmode c-shared -o build/zoal-honeycomb/mac_amd.xpl \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=${VERSION}" plugin/plugin.go
	lipo build/zoal-honeycomb/mac_arm.xpl build/zoal-honeycomb/mac_amd.xpl -create -output build/zoal-honeycomb/mac.xpl
dev:
	GOOS=darwin \
	GOARCH=arm64 \
	CGO_ENABLED=1 \
	CGO_CFLAGS="-DAPL=1 -DIBM=0 -DLIN=0 -O2 -g" \
	CGO_LDFLAGS="-F/System/Library/Frameworks/ -F${CURDIR}/Libraries/Mac -framework XPLM" \
	go build -buildmode c-shared -o ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/mac.xpl \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=development" plugin/plugin.go
	cp -r profiles ~/X-Plane\ 12/Resources/plugins/zoal-honeycomb/
win:
	CGO_CFLAGS="-DIBM=1 -static -O2 -g" \
	CGO_LDFLAGS="${CURDIR}/Libraries/Win/XPLM_64.lib -static-libgcc -static-libstdc++ -Wl,--exclude-libs,ALL" \
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
	CGO_LDFLAGS="-shared -rdynamic -nodefaultlibs -undefined_warning" \
	go build -tags libusb -buildmode c-shared -o build/zoal-honeycomb/lin.xpl  \
		-ldflags="-X github.com/x-z7a/zoal-honeycomb/pkg/xplane.VERSION=${VERSION}" plugin/plugin.go

mac-test:
	GOOS=darwin \
	GOARCH=arm64 \
	CGO_ENABLED=1 \
	CGO_CFLAGS="-DAPL=1 -DIBM=0 -DLIN=0" \
	CGO_LDFLAGS="-F/System/Library/Frameworks/ -F${CURDIR}/Libraries/Mac -framework XPLM" \
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
