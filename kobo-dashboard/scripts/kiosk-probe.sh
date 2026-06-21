#!/bin/sh
#
# kiosk-probe.sh — READ-ONLY recon for the kiosk (boot-to-dashboard) setup.
# Run this ON the Kobo over SSH/telnet. It changes NOTHING; it only prints how
# this firmware boots, so the boot-hook can be tailored safely and reversibly.
#
#   sh kiosk-probe.sh
#
echo "===== KOBO KIOSK PROBE (read-only) ====="

echo
echo "--- firmware / model ---"
cat /mnt/onboard/.kobo/version 2>/dev/null
cat /etc/os-release 2>/dev/null | grep -i version
[ -r /proc/device-tree/model ] && { cat /proc/device-tree/model; echo; }
echo "uname: $(uname -a)"

echo
echo "--- how is Nickel/UI started? (grep init scripts) ---"
for f in /etc/init.d/rcS /etc/init.d/rcS2 /etc/init.d/on-animator.sh; do
  [ -r "$f" ] && echo "## $f exists"
done
echo "-- references to nickel/pickel/hindenburg/on-animator in /etc/init.d --"
grep -rIn -E 'nickel|pickel|hindenburg|on-animator|KoboRoot' /etc/init.d 2>/dev/null

echo
echo "--- the UI launcher script (if found) ---"
for f in /etc/init.d/rcS; do
  [ -r "$f" ] || continue
  echo "## tail of $f"
  tail -n 40 "$f"
done

echo
echo "--- KoboRoot mechanism present? ---"
grep -rIn 'KoboRoot.tgz' /etc/init.d 2>/dev/null | head -5
ls -l /mnt/onboard/.kobo/KoboRoot.tgz 2>/dev/null || echo "(no pending KoboRoot.tgz — normal)"

echo
echo "--- our app present? ---"
ls -l /mnt/onboard/.adds/espresso/ 2>/dev/null

echo
echo "--- fbink available? ---"
for p in /mnt/onboard/.adds/espresso/fbink /mnt/onboard/.adds/kfmon/bin/fbink /mnt/onboard/.adds/koreader/fbink; do
  [ -x "$p" ] && echo "  $p (executable)"
done

echo
echo "--- writable rootfs check (is / read-only?) ---"
mount | grep -E ' / |/dev/root' | head -3

echo
echo "===== EINDE PROBE — plak deze hele uitvoer terug ====="
