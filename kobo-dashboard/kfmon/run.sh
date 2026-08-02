#!/bin/sh
# KFMon action: launch the Espresso wall dashboard.
#
# Kept deliberately SIMPLE: exec the binary once. In -wall mode the binary runs
# until you power-cycle. If it ever exits/crashes, this script exits too — so
# KFMon is never left "blocked" and re-tapping the tile relaunches cleanly.
#
# IMPORTANT: espresso.ini has block_spawns = false. An earlier version used
# block_spawns = true together with a never-exiting supervisor, which made KFMon
# refuse to spawn ANY tile (KOReader included) for as long as the dashboard ran.
DIR="$(dirname "$0")"
cd "$DIR" || exit 1

# Prefer our bundled fbink; the binary also finds KOReader/KFMon's on its own.
[ -x "$DIR/fbink" ] && export ESPRESSO_FBINK="$DIR/fbink"
# Self-heal a non-executable binary (e.g. after a copy that dropped the bit).
chmod +x "$DIR/espresso" 2>/dev/null

echo "$(date): launching espresso -wall" >> "$DIR/espresso.run.log"
exec ./espresso -device "$DIR/device.conf" -wall >> "$DIR/espresso.run.log" 2>&1
