#!/usr/bin/env bash
#
# Verwijdert het espresso-dashboard volledig van de Kobo. Werkt alleen op de
# gewone KOBOeReader-schijf (vfat) — geen ext4-tools nodig. Nickel en KOReader
# blijven onaangeroerd.
#
# Draai op de Mac met de Kobo via USB aangesloten en "Verbinden" getikt:
#   ./kobo-dashboard/uninstall.sh
set -euo pipefail

VOL="${KOBO_VOL:-/Volumes/KOBOeReader}"
if [ ! -d "$VOL" ]; then
  echo "Kobo niet gevonden op $VOL. Sluit 'm aan en tik 'Verbinden'."
  exit 1
fi

echo "==> Espresso-dashboard verwijderen van de Kobo"
rm -rf "$VOL/.adds/espresso"
rm -f  "$VOL/.adds/kfmon/config/espresso.ini"
rm -f  "$VOL/espresso.png"
rm -f  "$VOL/espresso-uit.txt"
sync

echo "==> Uitwerpen"
if command -v diskutil >/dev/null; then
  diskutil eject "$VOL" || echo "   (kon niet automatisch uitwerpen — werp handmatig uit)"
fi

cat <<'DONE'

Klaar. De Espresso-tegel verdwijnt na de volgende Nickel-herstart.
Nickel, KOReader en KFMon zijn onaangeroerd — de Kobo is weer volledig stock.
DONE
