// Package config holds compile-time defaults and runtime device settings for
// the standalone Kobo espresso dashboard.
//
// The Supabase project URL and anon key are the SAME public values the web app
// (NEXT_PUBLIC_SUPABASE_*) and the KOReader plugin use. The anon key is a
// publishable token guarded by row-level security (anon read/write), so it is
// safe to ship inside the binary, exactly like the Lua plugin did.
package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

// Supabase connection. Public, RLS-guarded — safe to embed.
const (
	SupabaseURL     = "https://wkbjugwavyebiurhuspa.supabase.co"
	SupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrYmp1Z3dhdnllYml1cmh1c3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzUyMzIsImV4cCI6MjA5MjkxMTIzMn0.w3K_QN2O3zqNFJa1-IfuA11zRxTYHFOFAmUkDxs8vsA"
)

// Screen geometry for the Kobo Aura HD ("dragon"): 1080x1440 portrait, armhf.
const (
	ScreenWidth  = 1080
	ScreenHeight = 1440
)

// Device holds the runtime, hardware-specific bits that probe.sh discovers and
// writes to device.conf. Everything has a sane Aura-HD default so the app still
// runs (and renders) if the file is missing.
type Device struct {
	// FBInkBin is the path to the prebuilt fbink binary.
	FBInkBin string
	// FBDev is the framebuffer device we draw into directly.
	FBDev string
	// TouchDev is the evdev node for the touch panel, e.g. /dev/input/event1.
	TouchDev string
	// TouchMaxX / TouchMaxY are the ABS_MT_POSITION_X/Y maxima reported by the
	// panel. Used to map raw touch coordinates onto the 1080x1440 framebuffer.
	TouchMaxX int
	TouchMaxY int
	// TouchSwapXY mirrors the panel's axes when the digitizer is rotated 90°
	// relative to the framebuffer (common on Kobo).
	TouchSwapXY bool
	// TouchInvertX / TouchInvertY flip an axis when the panel origin differs
	// from the framebuffer origin.
	TouchInvertX bool
	TouchInvertY bool
	// WifiIface is the wireless interface, e.g. eth0 or wlan0.
	WifiIface string
	// DataDir is where the app lives and caches data on the device.
	DataDir string
}

// Defaults returns the Aura HD ("dragon") baseline. probe.sh overrides these.
func Defaults() Device {
	return Device{
		FBInkBin: "/mnt/onboard/.adds/espresso/fbink",
		FBDev:    "/dev/fb0",
		TouchDev: "/dev/input/event1",
		// Calibrated on an Aura HD (zForce): raw panel ~1400x1025, axes swapped
		// and X inverted relative to the framebuffer.
		TouchMaxX:    1400,
		TouchMaxY:    1025,
		TouchSwapXY:  true,
		TouchInvertX: true,
		TouchInvertY: false,
		WifiIface:    "eth0",
		DataDir:      "/mnt/onboard/.adds/espresso",
	}
}

// Load reads a `key=value` device.conf, layering it over Defaults(). Unknown
// keys and comment lines (#) are ignored so the file stays forward-compatible.
func Load(path string) Device {
	d := Defaults()
	f, err := os.Open(path)
	if err != nil {
		return d
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.Trim(strings.TrimSpace(val), `"'`)
		switch key {
		case "FBINK_BIN":
			d.FBInkBin = val
		case "FB_DEV":
			d.FBDev = val
		case "TOUCH_DEV":
			d.TouchDev = val
		case "TOUCH_MAX_X":
			d.TouchMaxX = atoiOr(val, d.TouchMaxX)
		case "TOUCH_MAX_Y":
			d.TouchMaxY = atoiOr(val, d.TouchMaxY)
		case "TOUCH_SWAP_XY":
			d.TouchSwapXY = boolOf(val)
		case "TOUCH_INVERT_X":
			d.TouchInvertX = boolOf(val)
		case "TOUCH_INVERT_Y":
			d.TouchInvertY = boolOf(val)
		case "WIFI_IFACE":
			d.WifiIface = val
		case "DATA_DIR":
			d.DataDir = val
		}
	}
	return d
}

func atoiOr(s string, fallback int) int {
	if n, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
		return n
	}
	return fallback
}

func boolOf(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "y", "on":
		return true
	}
	return false
}
