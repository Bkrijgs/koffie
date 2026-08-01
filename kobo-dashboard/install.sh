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
# Override via env: KOBO_VOL=/Volumes/…
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
VOL="${KOBO_VOL:-/Volumes/KOBOeReader}"
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

# --- 2. FBInk regelen: hergebruik wat al op de Kobo staat ------------------
# FBInk wordt NIET als kant-en-klare binary op GitHub verspreid (alleen bron).
# Maar KOReader en KFMon hebben er al een op het toestel staan — die pakken we.
FBINK_SRC=""
if [ -x "$HERE/device/fbink" ]; then
  FBINK_SRC="$HERE/device/fbink"        # handmatig neergezet: heeft voorrang
else
  echo "==> FBInk zoeken op de Kobo (KOReader/KFMon gebruiken 'm al)"
  for c in "$VOL/.adds/koreader/fbink" "$VOL/.adds/kfmon/bin/fbink"; do
    [ -f "$c" ] && { FBINK_SRC="$c"; break; }
  done
  [ -n "$FBINK_SRC" ] || FBINK_SRC="$(find "$VOL/.adds" -maxdepth 3 -type f -iname 'fbink' 2>/dev/null | head -1)"
fi
if [ -n "$FBINK_SRC" ]; then
  echo "   gevonden: $FBINK_SRC"
else
  echo "   !! Geen fbink op de Kobo gevonden. De app probeert 'm bij het draaien"
  echo "      alsnog te vinden (.adds/koreader/fbink). Blijft het scherm leeg,"
  echo "      haal dan de prebuilt FBInk (Kobo/armhf) van de MobileRead FBInk-"
  echo "      thread en leg 'm neer als kobo-dashboard/device/fbink; run opnieuw."
fi

# --- 3. Deploy naar de Kobo ------------------------------------------------
echo "==> Kopiëren naar de Kobo"
APP="$VOL/.adds/espresso"
mkdir -p "$APP" "$VOL/.adds/kfmon/config"
cp build/espresso "$APP/espresso"
[ -n "$FBINK_SRC" ] && cp "$FBINK_SRC" "$APP/fbink"
cp device/launch.sh "$APP/launch.sh"
cp device/kfmon/espresso.ini "$VOL/.adds/kfmon/config/espresso.ini"
chmod +x "$APP/espresso" "$APP/launch.sh"
[ -f "$APP/fbink" ] && chmod +x "$APP/fbink"

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
