#!/bin/sh
# On-device launcher invoked by KFMon when the Espresso tile is tapped.
#
# Supervisor: keeps the wall dashboard alive. The binary runs in -wall mode and
# is not supposed to exit; if it ever crashes or gets killed, we relaunch it
# (with backoff) so tapping the tile ALWAYS ends in a running dashboard. A
# power-cycle returns to Nickel (no boot hook involved), and `touch STOP` next
# to this script stops the loop cleanly (used by deploy-ssh.sh during updates).
DIR="$(dirname "$0")"
cd "$DIR" || exit 1
LOG="$DIR/espresso.run.log"

# Keep the log bounded on an always-on panel.
if [ -f "$LOG" ] && [ "$(wc -c < "$LOG" 2>/dev/null || echo 0)" -gt 262144 ]; then
  tail -c 65536 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
fi

# Prefer our bundled fbink; the binary also finds KOReader/KFMon's on its own.
[ -x "$DIR/fbink" ] && export ESPRESSO_FBINK="$DIR/fbink"
# Self-heal a non-executable binary (e.g. after a copy that dropped the bit).
chmod +x "$DIR/espresso" 2>/dev/null
# A fresh launch should never start out in the "stop" state.
rm -f "$DIR/STOP" 2>/dev/null

fails=0
while :; do
  [ -f "$DIR/STOP" ] && { echo "$(date): STOP present, supervisor exits" >> "$LOG"; exit 0; }

  start=$(date +%s 2>/dev/null || echo 0)
  echo "$(date): launching espresso -wall" >> "$LOG"
  ./espresso -device "$DIR/device.conf" -wall >> "$LOG" 2>&1
  echo "$(date): espresso exited ($?)" >> "$LOG"

  [ -f "$DIR/STOP" ] && { echo "$(date): STOP present, supervisor exits" >> "$LOG"; exit 0; }

  # If it ran a good while before exiting, treat the next start as fresh; only a
  # rapid crash-loop backs off, so a persistent failure can't hammer the panel.
  end=$(date +%s 2>/dev/null || echo 0)
  if [ "$start" -gt 0 ] && [ $((end - start)) -gt 120 ]; then
    fails=0
  else
    fails=$((fails + 1))
  fi
  if [ "$fails" -ge 4 ]; then sleep 30; else sleep 3; fi
done
