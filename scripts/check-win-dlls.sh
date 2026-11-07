#!/usr/bin/env bash
# Checks that a built win.xpl will load on a clean Windows install:
#   - it is a valid x86-64 PE file,
#   - it imports the renamed SkyScript DLL (never the stock SkyScriptLib.dll),
#     and that DLL ships next to it,
#   - every symbol it takes from that DLL is exported by it,
#   - it depends on nothing beyond Windows, X-Plane and that DLL (a MinGW
#     runtime DLL such as libwinpthread-1.dll is not on users' machines).
#
#   scripts/check-win-dlls.sh <plugin dir> <skyscript dll name>
#
# OBJDUMP defaults to the MinGW objdump on PATH.
set -euo pipefail

dir=$1
dll=$2
objdump=${OBJDUMP:-$(command -v x86_64-w64-mingw32-objdump || command -v objdump)}
xpl=$dir/win.xpl
fail=0
err() { echo "check-win-dlls: $*" >&2; fail=1; }

[ -f "$xpl" ] || { err "$xpl not found"; exit 1; }
[ -f "$dir/$dll" ] || err "$dir/$dll not found"

headers=$("$objdump" -f "$xpl")
grep -q 'file format pei-x86-64' <<<"$headers" || { err "$xpl is not an x86-64 PE file"; exit 1; }

xpl_dump=$("$objdump" -p "$xpl")

# DLLs win.xpl imports, lower-cased.
imports=$(awk '/DLL Name:/ {print tolower($3)}' <<<"$xpl_dump")
echo "win.xpl imports:" $imports

want=$(tr '[:upper:]' '[:lower:]' <<<"$dll")
grep -qx "$want" <<<"$imports" || err "win.xpl does not import $dll"

while read -r lib; do
	case $lib in
		"$want" | xplm_64.dll | kernel32.dll | msvcrt.dll | api-ms-win-crt-*.dll) ;;
		*) err "unexpected DLL dependency: $lib" ;;
	esac
done <<<"$imports"

# Symbols win.xpl takes from the SkyScript DLL vs. what that DLL exports.
needed=$(awk -v d="$want" '
	/DLL Name:/ { cur = (tolower($3) == d); next }
	cur && NF == 0 { cur = 0 }
	cur && $1 ~ /^[0-9a-f]+$/ { print $NF }' <<<"$xpl_dump" | sort -u)
exported=$("$objdump" -p "$dir/$dll" | awk '
	/\[Ordinal\/Name Pointer\] Table/ { t = 1; next }
	t && NF == 0 { t = 0 }
	t { print $NF }' | sort -u)

[ -n "$needed" ] || err "found no symbols imported from $dll"
missing=$(comm -23 <(echo "$needed") <(echo "$exported"))
[ -z "$missing" ] || err "$dll does not export:" $missing

echo "win.xpl takes $(wc -l <<<"$needed" | tr -d ' ') symbols from $dll"
if [ "$fail" -eq 0 ]; then echo "check-win-dlls: OK"; fi
exit "$fail"
