#!/bin/sh
# Espresso launcher — what NickelMenu (and, when it works, the KFMon tile) runs.
#
# Two jobs:
#   1) Opportunistically REVIVE KFMon if it isn't running. When KFMon is down its
#      IPC socket /tmp/kfmon-ipc.ctl is gone and no tile fires; starting the
#      KFMon binary again brings the library tiles back. Best-effort and safe:
#      only starts it when the socket is absent, and never touches the boot.
#   2) Launch the wall dashboard.
DIR="$(dirname "$0")"

# 1) Revive KFMon if its control socket is missing (i.e. it isn't running).
if [ ! -e /tmp/kfmon-ipc.ctl ]; then
  for k in /usr/local/kfmon/bin/kfmon /mnt/onboard/.adds/kfmon/bin/kfmon; do
    if [ -x "$k" ]; then
      "$k" >/dev/null 2>&1 &
      break
    fi
  done
fi

# 2) Launch the dashboard (run.sh execs the -wall binary).
exec "$DIR/run.sh"
