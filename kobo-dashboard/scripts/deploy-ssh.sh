#!/usr/bin/env bash
#
# Draadloze deploy — update de Espresso-dashboard-binary op de Kobo via SSH,
# zonder USB. Werkt met KOReader's ingebouwde SSH-server (of een eigen dropbear).
#
# Gebruik (Mac op dezelfde wifi als de Kobo):
#   ./kobo-dashboard/scripts/deploy-ssh.sh <kobo-ip>
#
# Poort/gebruiker overriden kan via env:
#   KOBO_SSH_PORT=2222 KOBO_SSH_USER=root ./scripts/deploy-ssh.sh 192.168.1.42
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)" # kobo-dashboard/
HOST="${1:-${KOBO_SSH_HOST:-}}"
PORT="${KOBO_SSH_PORT:-2222}"
USER="${KOBO_SSH_USER:-root}"
DEST="/mnt/onboard/.adds/espresso"

if [ -z "$HOST" ]; then
  echo "Gebruik: $0 <kobo-ip>   (poort via KOBO_SSH_PORT, standaard 2222)"
  echo "Tip: start eerst KOReader's SSH-server en lees daar het IP + de poort af."
  exit 1
fi

command -v go >/dev/null || { echo "Go ontbreekt. Installeer met: brew install go"; exit 1; }
SSH="ssh -p $PORT -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 $USER@$HOST"

echo "==> Cross-compile (linux/arm, GOARM=7)"
cd "$HERE"
CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 \
  go build -trimpath -ldflags="-s -w" -o build/espresso ./cmd/espresso

# We pipen de bestanden over SSH met `cat` i.p.v. scp, want dropbear op de Kobo
# heeft vaak geen scp-binary. `cat >` werkt met alleen een shell.
echo "==> Binary + launcher naar de Kobo pushen (over wifi)"
$SSH "cat > $DEST/espresso.new" < build/espresso
$SSH "cat > $DEST/run.sh" < kfmon/run.sh
$SSH "chmod +x $DEST/espresso.new $DEST/run.sh && mv -f $DEST/espresso.new $DEST/espresso"

echo "==> App herstarten in wanddisplay-modus"
# Oude instance stoppen (indien actief) en de nieuwe losgekoppeld starten, zodat
# 'ie blijft draaien nadat de SSH-sessie sluit.
$SSH "kill \$(pidof espresso) 2>/dev/null; sleep 1; cd $DEST && (setsid ./run.sh >/dev/null 2>&1 </dev/null & ) || (nohup ./run.sh >/dev/null 2>&1 & ); true"

echo
echo "Klaar ✅  Het dashboard hoort binnen een paar tellen op de Kobo te verschijnen"
echo "en te blijven staan (wanddisplay-modus). Verschijnt het niet meteen? Tik dan"
echo "de Espresso-tegel aan — dat start dezelfde nieuwe versie."
