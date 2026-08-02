#!/bin/sh
# On-device launcher invoked by KFMon when the Espresso tile is tapped.
# KFMon runs this as root from Nickel; we just hand off to the Go binary,
# logging everything next to it so a black screen is still debuggable.
DIR="$(dirname "$0")"
cd "$DIR" || exit 1

# Give the binary its own working dir + device profile (written by probe.sh).
# -wall = always-on wall display: never auto-close, refresh itself hourly, and
# hold the last frame if a refresh fails. Power-cycle returns to Nickel.
exec ./espresso -device "$DIR/device.conf" -wall >>"$DIR/espresso.run.log" 2>&1
