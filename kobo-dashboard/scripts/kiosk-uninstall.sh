#!/bin/sh
#
# kiosk-uninstall.sh — fully revert the kiosk boot hook. Run ON the device.
# Restores rcS from the backup (or strips the marked block) and removes the
# kiosk flag, so the next boot goes straight to Nickel as before.
set -u

ESP=/mnt/onboard/.adds/espresso
RCS=/etc/init.d/rcS
BACKUP=/etc/init.d/rcS.espresso-bak
MARK_START="# >>> espresso-kiosk >>>"
MARK_END="# <<< espresso-kiosk <<<"

rm -f "$ESP/KIOSK_ENABLED"

if [ -f "$BACKUP" ]; then
  cp "$BACKUP" "$RCS" && echo "rcS hersteld vanaf back-up." || echo "FOUT: herstellen faalde."
elif grep -qF "$MARK_START" "$RCS"; then
  awk -v s="$MARK_START" -v e="$MARK_END" '
    index($0, s) { skip = 1; next }
    index($0, e) { skip = 0; next }
    !skip { print }
  ' "$RCS" > "$RCS.new" && sh -n "$RCS.new" && cp "$RCS.new" "$RCS" && rm -f "$RCS.new" \
    && echo "Hook-blok uit rcS verwijderd." || { rm -f "$RCS.new"; echo "FOUT: opschonen faalde."; }
else
  echo "Geen hook gevonden — niets te doen."
fi

echo "Kiosk uit. Reboot om naar Nickel te gaan."
