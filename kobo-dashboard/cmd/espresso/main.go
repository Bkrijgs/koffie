// Command espresso is the standalone Kobo espresso dashboard. It renders the
// dashboard to a PNG and displays it on the e-ink panel via fbink. KFMon
// launches it; Nickel/KOReader stay installed as a fallback.
//
// Phase 1 (this file's MVP surface) proves the build → deploy → launch pipeline
// by rendering a "Hello espresso" splash. Later phases add data fetch, the full
// dashboard render, and touch navigation.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/config"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/render"
)

func main() {
	var (
		devicePath = flag.String("device", defaultDevicePath(), "path to device.conf")
		preview    = flag.Bool("preview", false, "render the PNG but skip fbink (dev machine)")
		outPath    = flag.String("out", "", "PNG output path (default: <DataDir>/dashboard.png)")
		hello      = flag.Bool("hello", false, "force the Phase-1 hello splash instead of the dashboard")
		icon       = flag.Bool("icon", false, "render the KFMon tile icon to -out and exit")
	)
	flag.Parse()

	if *icon {
		if err := renderIcon(*outPath); err != nil {
			log.Fatalf("icon: %v", err)
		}
		return
	}

	dev := config.Load(*devicePath)
	out := *outPath
	if out == "" {
		out = filepath.Join(dev.DataDir, "dashboard.png")
	}

	logTo(dev.DataDir)
	log.Printf("espresso starting (preview=%v hello=%v)", *preview, *hello)

	if err := run(dev, out, *preview, *hello); err != nil {
		log.Printf("fatal: %v", err)
		// Last-ditch: try to put the error on screen so a headless device isn't
		// silent. Ignore any secondary failure.
		if !*preview {
			fb := render.NewFBInk(dev.FBInkBin)
			if fb.Available() {
				_ = fb.Print(6, "espresso: "+err.Error())
			}
		}
		os.Exit(1)
	}
}

// run is the Phase-1 pipeline: render the hello splash and show it. Phases 2+
// extend this with data fetch and the dashboard renderer.
func run(dev config.Device, out string, preview, hello bool) error {
	_ = hello // Phase 1 always renders the splash; the flag is wired for later.

	c, err := render.NewCanvas(config.ScreenWidth, config.ScreenHeight)
	if err != nil {
		return fmt.Errorf("canvas: %w", err)
	}
	render.HelloSplash(c)

	if err := render.SavePNG(c, out); err != nil {
		return fmt.Errorf("save png: %w", err)
	}
	log.Printf("rendered %s", out)

	if preview {
		fmt.Println(out)
		return nil
	}

	fb := render.NewFBInk(dev.FBInkBin)
	if !fb.Available() {
		return fmt.Errorf("fbink not found/executable at %s", dev.FBInkBin)
	}
	if err := fb.DisplayImage(out); err != nil {
		return fmt.Errorf("fbink display: %w", err)
	}
	log.Printf("displayed via fbink")
	return nil
}

// renderIcon writes the KFMon tile cover. Run on the host during install.sh.
func renderIcon(out string) error {
	if out == "" {
		out = "icon.png"
	}
	c, err := render.NewCanvas(render.IconW, render.IconH)
	if err != nil {
		return err
	}
	render.IconTile(c)
	return render.SavePNG(c, out)
}

func defaultDevicePath() string {
	// Sits next to the binary in .adds/espresso on the device.
	if exe, err := os.Executable(); err == nil {
		return filepath.Join(filepath.Dir(exe), "device.conf")
	}
	return "device.conf"
}

// logTo appends to a logfile in DataDir so on-device runs are debuggable, while
// still echoing to stderr for `preview` runs on a dev machine.
func logTo(dir string) {
	log.SetFlags(log.LstdFlags)
	if dir == "" {
		return
	}
	if f, err := os.OpenFile(filepath.Join(dir, "espresso.log"),
		os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); err == nil {
		log.SetOutput(f)
	}
}
