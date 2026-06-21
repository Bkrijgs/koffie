#!/usr/bin/env bash
#
# install.sh — one-shot (re)installer for the Kobo espresso dashboard.
#
# Run this on the Mac with the Kobo mounted over USB:
#
#     ./kobo-dashboard/scripts/install.sh
#
# In a single run it:
#   1. cross-compiles the Go binary (GOARCH=arm GOARM=7) for the Aura HD,
#   2. fetches the prebuilt fbink binary (NiLuJe/FBInk, Kobo build),
#   3. copies the app + fbink + launcher to /Volumes/KOBOeReader/.adds/espresso/,
#   4. installs the KFMon tile (config + cover icon),
#   5. ejects the volume so Nickel re-imports the tile.
#
# Override anything via env, e.g.:
#   KOBO_MOUNT="/Volumes/KOBOeReader 1" ./install.sh
#   FBINK_BIN=/path/to/fbink ./install.sh      # use a local fbink, skip download
#   NO_EJECT=1 ./install.sh                     # leave the volume mounted
set -euo pipefail

# --- locate project ---------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- config -----------------------------------------------------------------
KOBO_MOUNT="${KOBO_MOUNT:-/Volumes/KOBOeReader}"
ADDS_DIR="$KOBO_MOUNT/.adds/espresso"
KFMON_CFG_DIR="$KOBO_MOUNT/.adds/kfmon/config"
ICON_DIR="$KOBO_MOUNT/icons"
FBINK_REPO="NiLuJe/FBInk"

note()  { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()   { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- preflight --------------------------------------------------------------
command -v go >/dev/null 2>&1 || die "Go is niet geïnstalleerd (brew install go)."
[ -d "$KOBO_MOUNT" ] || die "Kobo niet gevonden op $KOBO_MOUNT (sluit 'm aan / zet KOBO_MOUNT)."

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# --- 1. cross-compile -------------------------------------------------------
note "Go-binary cross-compileren (arm / GOARM=7)…"
( cd "$PROJECT_DIR" && \
  CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 \
  go build -trimpath -ldflags="-s -w" -o "$WORK/espresso" ./cmd/espresso )
ok "binary: $(du -h "$WORK/espresso" | cut -f1)"

# --- 2. tile-icon (host build) ----------------------------------------------
note "KFMon tile-icon renderen…"
if [ -f "$PROJECT_DIR/assets/icon.png" ]; then
  cp "$PROJECT_DIR/assets/icon.png" "$WORK/icon.png"
else
  ( cd "$PROJECT_DIR" && go run ./cmd/espresso -icon -out "$WORK/icon.png" )
fi
ok "icon klaar"

# --- 3. fbink ---------------------------------------------------------------
get_fbink() {
  # Priority: explicit FBINK_BIN > vendored copy > download latest release.
  if [ -n "${FBINK_BIN:-}" ]; then
    [ -f "$FBINK_BIN" ] || die "FBINK_BIN=$FBINK_BIN bestaat niet."
    cp "$FBINK_BIN" "$WORK/fbink"; ok "fbink: lokaal ($FBINK_BIN)"; return
  fi
  if [ -f "$PROJECT_DIR/vendor/fbink" ]; then
    cp "$PROJECT_DIR/vendor/fbink" "$WORK/fbink"; ok "fbink: vendored"; return
  fi
  # KFMon already ships a working Kobo fbink on the device — reuse it.
  for kf in \
    "$KOBO_MOUNT/.adds/kfmon/bin/fbink" \
    "$KOBO_MOUNT/.adds/koreader/fbink"; do
    if [ -f "$kf" ]; then
      cp "$kf" "$WORK/fbink"; ok "fbink: hergebruikt van toestel ($kf)"; return
    fi
  done

  note "Prebuilt fbink ophalen van ${FBINK_REPO}…"
  local url
  url="$(curl -fsSL "https://api.github.com/repos/$FBINK_REPO/releases/latest" \
         | grep -oE '"browser_download_url": *"[^"]+\.tar\.xz"' \
         | sed -E 's/.*"(https[^"]+)"/\1/' | head -1)"
  [ -n "$url" ] || die "Kon fbink release-asset niet vinden (zet FBINK_BIN of vendor/fbink)."
  curl -fsSL "$url" -o "$WORK/fbink.tar.xz"
  mkdir -p "$WORK/fbink_x"
  tar -xf "$WORK/fbink.tar.xz" -C "$WORK/fbink_x"
  local found
  found="$(find "$WORK/fbink_x" -type f -name fbink -path '*Kobo*' | head -1)"
  [ -n "$found" ] || found="$(find "$WORK/fbink_x" -type f -name fbink | head -1)"
  [ -n "$found" ] || die "Geen 'fbink' binary in de release-tarball."
  cp "$found" "$WORK/fbink"
  ok "fbink: $url"
}
get_fbink

# --- 4. copy to device ------------------------------------------------------
note "Kopiëren naar ${ADDS_DIR}…"
mkdir -p "$ADDS_DIR" "$KFMON_CFG_DIR" "$ICON_DIR"
install -m 0755 "$WORK/espresso"            "$ADDS_DIR/espresso"
install -m 0755 "$WORK/fbink"               "$ADDS_DIR/fbink"
install -m 0755 "$PROJECT_DIR/kfmon/run.sh" "$ADDS_DIR/run.sh"
cp "$WORK/icon.png"                         "$ICON_DIR/espresso.png"
cp "$PROJECT_DIR/kfmon/espresso.ini"        "$KFMON_CFG_DIR/espresso.ini"
# Preserve any device.conf probe.sh already wrote; otherwise the binary uses
# its built-in Aura HD defaults.
[ -f "$ADDS_DIR/device.conf" ] && ok "device.conf bewaard" || note "geen device.conf (defaults worden gebruikt; draai probe.sh op het toestel)"
ok "bestanden gekopieerd"

# --- 5. eject ---------------------------------------------------------------
sync
if [ "${NO_EJECT:-0}" = "1" ]; then
  note "NO_EJECT gezet — volume blijft gemount."
else
  note "Volume ejecten…"
  if command -v diskutil >/dev/null 2>&1; then
    diskutil eject "$KOBO_MOUNT" >/dev/null && ok "ge-ejecteerd"
  else
    umount "$KOBO_MOUNT" && ok "ge-unmount"
  fi
fi

cat <<EOF

$(ok "Klaar.")
  Op het toestel: open de bibliotheek en tik op de 'Espresso' tegel.
  (Eerste keer kan Nickel even nodig hebben om de cover te importeren.)
EOF
