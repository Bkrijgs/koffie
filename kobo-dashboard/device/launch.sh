#!/bin/sh
# KFMon-actie: start het espresso-dashboard.
# Draait op de Kobo. Nickel/KOReader blijven staan; dit is volledig omkeerbaar.

DIR="/mnt/onboard/.adds/espresso"
# Gebruik de meegeleverde fbink als die er is; anders vindt de app zelf de
# fbink van KOReader/KFMon op het toestel.
[ -x "$DIR/fbink" ] && export ESPRESSO_FBINK="$DIR/fbink"

cd "$DIR" || exit 1

# -interval 180 = elke 3 uur verversen (batterijvriendelijk; wifi gaat tussendoor uit).
exec ./espresso -interval 180 >> "$DIR/espresso.log" 2>&1
