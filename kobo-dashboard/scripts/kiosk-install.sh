#!/bin/sh
#
# kiosk-install.sh — make the Kobo boot straight into the espresso dashboard.
# Run this ON the device over SSH. It is FAIL-SAFE and REVERSIBLE:
#
#   • backs up /etc/init.d/rcS before touching it,
#   • inserts a tiny hook BEFORE the Nickel launch line,
#   • the hook only runs the dashboard if BOTH a flag file AND a working
#     launcher exist — otherwise Nickel boots exactly as it always did,
#   • syntax-checks the patched rcS and rolls back if anything is off,
#   • Nickel is never deleted; it stays as the fallback.
#
# Disable later with: sh kiosk-uninstall.sh   (or tap "Sluiten" in the app).
set -u

ESP=/mnt/onboard/.adds/espresso
RCS=/etc/init.d/rcS
BACKUP=/etc/init.d/rcS.espresso-bak
MARK_START="# >>> espresso-kiosk >>>"
MARK_END="# <<< espresso-kiosk <<<"

die() { echo "FOUT: $*" >&2; exit 1; }

[ -x "$ESP/espresso" ] || die "$ESP/espresso ontbreekt of is niet uitvoerbaar (eerst de binary deployen)."
[ -w "$RCS" ] || die "$RCS niet schrijfbaar (is de rootfs read-only?)."

# --- 1. write the on-device launcher --------------------------------------
cat > "$ESP/kiosk.sh" <<'LAUNCHER'
#!/bin/sh
# Runs the dashboard as the device UI while KIOSK_ENABLED exists. Foreground:
# returns when kiosk is disabled, so rcS then falls through to Nickel.
ESP=/mnt/onboard/.adds/espresso
[ -x "$ESP/espresso" ] || exit 1
echo "kiosk start $(date 2>/dev/null)" >> "$ESP/kiosk.log"
fails=0
while [ -f "$ESP/KIOSK_ENABLED" ]; do
  start=$(date +%s 2>/dev/null || echo 0)
  "$ESP/espresso" -device "$ESP/device.conf" -kiosk >> "$ESP/kiosk.log" 2>&1
  end=$(date +%s 2>/dev/null || echo 0)
  # Crash-loop guard: 5 fast exits in a row -> disable kiosk so Nickel boots
  # and the device stays recoverable.
  if [ $((end - start)) -lt 5 ]; then
    fails=$((fails + 1))
    if [ "$fails" -ge 5 ]; then
      echo "crash-loop; kiosk uitgeschakeld $(date 2>/dev/null)" >> "$ESP/kiosk.log"
      rm -f "$ESP/KIOSK_ENABLED"
      break
    fi
  else
    fails=0
  fi
  sleep 2
done
echo "kiosk stop $(date 2>/dev/null)" >> "$ESP/kiosk.log"
exit 0
LAUNCHER
chmod +x "$ESP/kiosk.sh"

# --- 2. patch rcS (idempotent) --------------------------------------------
if grep -qF "$MARK_START" "$RCS"; then
  echo "Hook zit er al in rcS — sla patchen over."
else
  [ -f "$BACKUP" ] || cp "$RCS" "$BACKUP" || die "back-up maken faalde."

  HOOK="/tmp/esp_hook.$$"
  {
    echo "$MARK_START"
    echo 'if [ -f /mnt/onboard/.adds/espresso/KIOSK_ENABLED ] && [ -x /mnt/onboard/.adds/espresso/kiosk.sh ]; then'
    echo '    /mnt/onboard/.adds/espresso/kiosk.sh'
    echo 'fi'
    echo "$MARK_END"
  } > "$HOOK"

  awk -v hookfile="$HOOK" '
    BEGIN { while ((getline l < hookfile) > 0) hook = hook l "\n" }
    /\/usr\/local\/Kobo\/nickel/ && /-platform/ && !done {
      printf "%s", hook; done = 1
    }
    { print }
    END { if (!done) exit 3 }
  ' "$RCS" > "$RCS.new"
  rc=$?
  rm -f "$HOOK"
  [ "$rc" = 0 ] || { rm -f "$RCS.new"; die "Nickel-startregel niet gevonden in rcS — niets gewijzigd."; }

  # Validate the patched script before committing to it.
  sh -n "$RCS.new" || { rm -f "$RCS.new"; die "Gepatchte rcS faalt syntax-check — niets gewijzigd."; }

  cp "$RCS.new" "$RCS" || { rm -f "$RCS.new"; die "Schrijven van rcS faalde."; }
  rm -f "$RCS.new"
  echo "rcS gepatcht (back-up: $BACKUP)."
fi

# --- 3. enable kiosk -------------------------------------------------------
touch "$ESP/KIOSK_ENABLED"

cat <<EOF

KLAAR. Kiosk staat AAN.
  • Reboot het toestel → het boot rechtstreeks in het dashboard.
  • In de app linksonder "Sluiten" → terug naar Nickel (zet kiosk uit).
  • Weer aanzetten:  touch $ESP/KIOSK_ENABLED  + reboot
  • Helemaal terugdraaien:  sh kiosk-uninstall.sh
EOF
