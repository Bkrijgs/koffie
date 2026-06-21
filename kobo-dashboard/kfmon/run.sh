#!/bin/sh
# On-device launcher invoked by KFMon when the Espresso tile is tapped.
# KFMon runs this as root from Nickel; we just hand off to the Go binary,
# logging everything next to it so a black screen is still debuggable.
DIR="$(dirname "$0")"
cd "$DIR" || exit 1

# Give the binary its own working dir + device profile (written by probe.sh).
exec ./espresso -device "$DIR/device.conf" >>"$DIR/espresso.run.log" 2>&1
