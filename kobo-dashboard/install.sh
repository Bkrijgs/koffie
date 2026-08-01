#!/usr/bin/env bash
#
# Eén-commando installer voor het espresso-dashboard op de Kobo.
# Draai dit op je Mac met de Kobo via USB aangesloten en "Verbinden" getikt.
#
#   ./kobo-dashboard/install.sh
#
# Doet in één run: cross-compile (arm v7) -> FBInk regelen -> alles naar de
# Kobo kopiëren -> KFMon-tegel plaatsen -> icoon genereren -> uitwerpen.
#
# Overrides via env: KOBO_VOL=/Volumes/… FBINK_VERSION=v1.25.0
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
VOL="${KOBO_VOL:-/Volumes/KOBOeReader}"
FBINK_VERSION="${FBINK_VERSION:-v1.25.0}"
cd "$HERE"

# --- 0. Checks -------------------------------------------------------------
command -v go >/dev/null || { echo "Go ontbreekt. Installeer met: brew install go"; exit 1; }
if [ ! -d "$VOL" ]; then
  echo "Kobo niet gevonden op $VOL."
  echo "Sluit 'm via USB aan, tik op de Kobo 'Verbinden', en probeer opnieuw."
  echo "(Ander pad? Zet KOBO_VOL=/Volumes/JOUW_NAAM.)"
  exit 1
fi

# --- 1. Cross-compile ------------------------------------------------------
echo "==> Go-binary cross-compilen (linux/arm, GOARM=7)"
GOTOOLCHAIN=local GOOS=linux GOARCH=arm GOARM=7 \
  go build -trimpath -ldflags="-s -w" -o build/espresso ./cmd/espresso

# --- 2. FBInk regelen ------------------------------------------------------
if [ ! -x "$HERE/device/fbink" ]; then
  echo "==> FBInk ($FBINK_VERSION) ophalen"
  URL="https://github.com/NiLuJe/FBInk/releases/download/${FBINK_VERSION}/FBInk-${FBINK_VERSION}.tar.xz"
  TMP="$(mktemp -d)"
  if curl -fL "$URL" -o "$TMP/fbink.tar.xz" 2>/dev/null && tar -xJf "$TMP/fbink.tar.xz" -C "$TMP" 2>/dev/null; then
    FB="$(find "$TMP" -type f -iname 'fbink' -path '*[Kk]obo*' | head -1)"
    [ -n "$FB" ] || FB="$(find "$TMP" -type f -iname 'fbink' | head -1)"
    if [ -n "$FB" ]; then
      cp "$FB" "$HERE/device/fbink"
      chmod +x "$HERE/device/fbink"
    fi
  fi
  rm -rf "$TMP"
fi
if [ ! -x "$HERE/device/fbink" ]; then
  echo "!! Kon FBInk niet automatisch regelen."
  echo "   Download de Kobo (armhf) 'fbink' handmatig van:"
  echo "     https://github.com/NiLuJe/FBInk/releases"
  echo "   en plaats de binary als: kobo-dashboard/device/fbink"
  echo "   Draai daarna install.sh opnieuw."
  exit 1
fi

# --- 3. Deploy naar de Kobo ------------------------------------------------
echo "==> Kopiëren naar de Kobo"
APP="$VOL/.adds/espresso"
mkdir -p "$APP" "$VOL/.adds/kfmon/config"
cp build/espresso "$APP/espresso"
cp device/fbink   "$APP/fbink"
cp device/launch.sh "$APP/launch.sh"
cp device/kfmon/espresso.ini "$VOL/.adds/kfmon/config/espresso.ini"
chmod +x "$APP/espresso" "$APP/fbink" "$APP/launch.sh"

# --- 4. Launcher-icoon (native gegenereerd op de Mac) ----------------------
echo "==> Launcher-icoon genereren"
GOTOOLCHAIN=local go run ./cmd/espresso -icon "$VOL/espresso.png"

# --- 5. Netjes uitwerpen ---------------------------------------------------
sync
echo "==> Uitwerpen"
if command -v diskutil >/dev/null; then
  diskutil eject "$VOL" || echo "   (kon niet automatisch uitwerpen — werp handmatig uit)"
fi

cat <<'DONE'

Klaar. Op de Kobo:
  1. Koppel de USB los.
  2. Nickel verwerkt de nieuwe "Espresso"-tegel (kan even duren).
  3. Tik de Espresso-tegel in je bibliotheek → het dashboard verschijnt.

Updaten later: git pull && ./kobo-dashboard/install.sh
DONE
