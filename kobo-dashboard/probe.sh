#!/bin/sh
# Eenmalige toestel-probe voor fase 4 (touch/maandnavigatie).
# Draai dit OP de Kobo (via een terminal: NickelMenu-shell, SSH/telnet, of
# KOReader's "Terminal emulator"). Kopieer/fotografeer de output.
#
# Verwacht een Kobo Aura HD ("dragon", 1080x1440).

echo "===== framebuffer ====="
echo -n "virtual_size: "; cat /sys/class/graphics/fb0/virtual_size 2>/dev/null
echo -n "bits/pixel:   "; cat /sys/class/graphics/fb0/bits_per_pixel 2>/dev/null
echo -n "rotate:       "; cat /sys/class/graphics/fb0/rotate 2>/dev/null

echo
echo "===== input-nodes (touch) ====="
for e in /dev/input/event*; do
  [ -e "$e" ] || continue
  n="$(basename "$e")"
  name="$(cat /sys/class/input/$n/device/name 2>/dev/null)"
  echo "$e  ->  $name"
done

echo
echo "===== netwerk-interfaces ====="
if command -v ip >/dev/null 2>&1; then
  ip -o link show 2>/dev/null | awk -F': ' '{print $2}'
else
  ls /sys/class/net 2>/dev/null
fi

echo
echo "===== FBInk ====="
FB="/mnt/onboard/.adds/espresso/fbink"
if [ -x "$FB" ]; then
  "$FB" -e 2>/dev/null || echo "fbink -e faalde"
else
  echo "fbink nog niet geïnstalleerd op $FB (draai eerst install.sh)"
fi
