// Command espresso is the standalone Kobo espresso dashboard. It fetches shots
// from Supabase, renders a month view to a PNG, and displays it on the e-ink
// panel via fbink. KFMon launches it; Nickel/KOReader stay installed as a
// fallback.
package main

import (
	"context"
	"flag"
	"fmt"
	"image"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/config"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/fb"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/input"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/render"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/stats"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/supa"
)

// idleTimeout returns control to Nickel if the dashboard is left untouched, so
// the app never holds the device indefinitely.
const idleTimeout = 5 * time.Minute

func main() {
	var (
		devicePath   = flag.String("device", defaultDevicePath(), "path to device.conf")
		preview      = flag.Bool("preview", false, "render the PNG but skip fbink (dev machine)")
		outPath      = flag.String("out", "", "PNG output path (default: <DataDir>/dashboard.png)")
		icon         = flag.Bool("icon", false, "render the KFMon tile icon to -out and exit")
		monthFlag    = flag.String("month", "", "month to show as YYYY-MM (default: latest with data)")
		fixtureBeans = flag.String("fixture-beans", "", "PostgREST beans JSON file (offline preview)")
		fixtureShots = flag.String("fixture-shots", "", "PostgREST shots JSON file (offline preview)")
		kiosk        = flag.Bool("kiosk", false, "kiosk mode: never auto-exit; hold the screen (boot-to-dashboard)")
		touchtest    = flag.Bool("touchtest", false, "print touch taps (calibration) and exit")
	)
	flag.Parse()

	if *icon {
		if err := renderIcon(*outPath); err != nil {
			log.Fatalf("icon: %v", err)
		}
		return
	}

	if *touchtest {
		runTouchTest(config.Load(*devicePath))
		return
	}

	dev := config.Load(*devicePath)
	out := *outPath
	if out == "" {
		out = filepath.Join(dev.DataDir, "dashboard.png")
	}
	logTo(dev.DataDir)

	opts := runOpts{
		dev:          dev,
		out:          out,
		preview:      *preview,
		month:        *monthFlag,
		fixtureBeans: *fixtureBeans,
		fixtureShots: *fixtureShots,
		kiosk:        *kiosk,
	}
	if err := run(opts); err != nil {
		log.Printf("fatal: %v", err)
		if !*preview {
			showError(dev, out, err)
		}
		os.Exit(1)
	}
}

type runOpts struct {
	dev                        config.Device
	out                        string
	preview                    bool
	month                      string
	fixtureBeans, fixtureShots string
	kiosk                      bool
}

// resolveFBInk returns an fbink wrapper, preferring the configured binary but
// falling back to KFMon's / KOReader's bundled fbink if ours is missing.
func resolveFBInk(dev config.Device) *render.FBInk {
	for _, p := range []string{
		dev.FBInkBin,
		"/mnt/onboard/.adds/kfmon/bin/fbink",
		"/mnt/onboard/.adds/koreader/fbink",
	} {
		if p == "" {
			continue
		}
		if fb := render.NewFBInk(p); fb.Available() {
			return fb
		}
	}
	return render.NewFBInk(dev.FBInkBin)
}

func run(o runOpts) error {
	var fb *render.FBInk
	if !o.preview {
		fb = resolveFBInk(o.dev)
		if !fb.Available() {
			return fmt.Errorf("fbink not found/executable at %s", o.dev.FBInkBin)
		}
		// Live (device) runs may wait on wifi; show a loading splash first.
		if o.fixtureBeans == "" && o.fixtureShots == "" {
			showLoading(o.dev, fb, o.out)
		}
	}

	snap, err := loadData(o)
	if err != nil {
		return err
	}
	log.Printf("data: %d beans, %d shots (stale=%v)", len(snap.Beans), len(snap.Shots), snap.Stale)

	a := &app{o: o, snap: snap, month: pickMonth(o.month, snap.Shots), fb: fb}
	if err := a.renderShow(); err != nil {
		return err
	}
	if o.preview {
		fmt.Println(o.out)
		return nil
	}
	// Fixture runs are non-interactive (dev machine has no touch panel).
	if o.fixtureBeans != "" || o.fixtureShots != "" {
		return nil
	}
	a.loop()
	return nil
}

// displayCanvas pushes a rendered canvas to the e-ink panel. Primary path:
// write pixels straight into the framebuffer (works regardless of fbink's image
// support), then ask fbink to refresh. Falls back to fbink's own image display
// if the framebuffer can't be opened. A PNG copy is always kept for debugging.
func displayCanvas(dev config.Device, fbink *render.FBInk, c *render.Canvas, out string) error {
	_ = render.SavePNG(c, out)
	if dev.FBDev != "" {
		if f, err := fb.Open(dev.FBDev); err == nil {
			f.Blit(c.Img)
			_ = f.Close()
			if rerr := fbink.Refresh(); rerr != nil {
				log.Printf("fbink refresh failed: %v", rerr)
			}
			log.Printf("displayed via framebuffer (%dx%d %dbpp)", f.XRes, f.YRes, f.BPP)
			return nil
		} else {
			log.Printf("fb open failed (%v); falling back to fbink -g", err)
		}
	}
	return fbink.DisplayImage(out)
}

// showLoading blits a loading splash so the panel isn't blank during fetch.
func showLoading(dev config.Device, fbink *render.FBInk, out string) {
	c, err := render.NewCanvas(config.ScreenWidth, config.ScreenHeight)
	if err != nil {
		return
	}
	render.LoadingScreen(c)
	_ = displayCanvas(dev, fbink, c, out)
}

// app holds the interactive dashboard state.
type app struct {
	o     runOpts
	snap  supa.Snapshot
	month stats.Month
	fb    *render.FBInk
}

// renderShow renders the current month and (unless previewing) blits it.
func (a *app) renderShow() error {
	c, err := render.NewCanvas(config.ScreenWidth, config.ScreenHeight)
	if err != nil {
		return fmt.Errorf("canvas: %w", err)
	}
	render.RenderDashboard(c, buildView(a.snap, a.month))
	log.Printf("rendered for %s", a.month.Label())
	if a.fb == nil { // preview mode: just write the PNG
		return render.SavePNG(c, a.o.out)
	}
	return displayCanvas(a.o.dev, a.fb, c, a.o.out)
}

// refetch reloads data from Supabase (falling back to cache) and re-renders.
func (a *app) refetch() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	client := supa.New(config.SupabaseURL, config.SupabaseAnonKey, 18*time.Second)
	if snap, err := supa.Load(ctx, client, a.o.dev.DataDir); err == nil {
		a.snap = snap
	} else {
		log.Printf("refetch failed: %v", err)
	}
	_ = a.renderShow()
}

// loop handles touch navigation. In normal mode it exits on close or after an
// idle timeout (back to Nickel). In kiosk mode it never auto-exits — it holds
// the screen indefinitely, and "Sluiten" disables kiosk so the next boot
// returns to Nickel.
func (a *app) loop() {
	reader, err := input.Open(a.o.dev)
	if err != nil {
		log.Printf("touch unavailable (%v)", err)
		if a.o.kiosk {
			// No touch panel but we must keep the dashboard on screen.
			select {}
		}
		return
	}
	defer reader.Close()

	hb := render.DashboardHitboxes()
	idle := time.NewTimer(idleTimeout)
	defer idle.Stop()
	if a.o.kiosk {
		idle.Stop() // never auto-exit in kiosk
	}

	for {
		select {
		case <-idle.C:
			log.Printf("idle timeout; exiting")
			return
		case tap, ok := <-reader.Taps():
			if !ok {
				if a.o.kiosk {
					select {} // touch reader died; keep holding the screen
				}
				return
			}
			if !a.o.kiosk {
				idle.Reset(idleTimeout)
			}
			p := image.Pt(tap.X, tap.Y)
			first, last, hasData := stats.DataRange(a.snap.Shots)
			switch {
			case p.In(hb.Close):
				if a.o.kiosk {
					a.disableKiosk() // next boot returns to Nickel
				}
				log.Printf("close tapped; exiting")
				return
			case p.In(hb.Refresh):
				a.refetch()
			case p.In(hb.Prev) && hasData && first.Before(a.month):
				a.month = a.month.Add(-1)
				_ = a.renderShow()
			case p.In(hb.Next) && hasData && a.month.Before(last):
				a.month = a.month.Add(1)
				_ = a.renderShow()
			}
		}
	}
}

// runTouchTest opens the touch panel and prints each tap (mapped to screen
// coordinates) plus which dashboard zone it hit. Used to confirm the touch node
// works and to calibrate the axis transform before enabling kiosk.
func runTouchTest(dev config.Device) {
	r, err := input.Open(dev)
	if err != nil {
		fmt.Printf("touch open failed for %s: %v\n", dev.TouchDev, err)
		os.Exit(1)
	}
	defer r.Close()
	fmt.Printf("Touch-test op %s (%dx%d). Tik op het scherm; Ctrl-C om te stoppen.\n",
		dev.TouchDev, config.ScreenWidth, config.ScreenHeight)
	fmt.Println("Tik op de hoeken en op de knoppen (‹ ›, Ververs, Sluiten).")
	hb := render.DashboardHitboxes()
	for tap := range r.Taps() {
		p := image.Pt(tap.X, tap.Y)
		zone := "(geen knop)"
		switch {
		case p.In(hb.Prev):
			zone = "‹ vorige maand"
		case p.In(hb.Next):
			zone = "volgende maand ›"
		case p.In(hb.Refresh):
			zone = "Ververs"
		case p.In(hb.Close):
			zone = "Sluiten"
		}
		fmt.Printf("tap  raw=(%-4d,%-4d)  scherm=(%-4d,%-4d)  -> %s\n",
			tap.RawX, tap.RawY, tap.X, tap.Y, zone)
	}
}

// disableKiosk removes the KIOSK_ENABLED flag so the on-device launcher stops
// relaunching us and the boot script falls through to Nickel.
func (a *app) disableKiosk() {
	flag := filepath.Join(a.o.dev.DataDir, "KIOSK_ENABLED")
	if err := os.Remove(flag); err != nil {
		log.Printf("disableKiosk: %v", err)
	}
}

// loadData returns a snapshot from fixtures (preview) or from Supabase (+cache).
func loadData(o runOpts) (supa.Snapshot, error) {
	if o.fixtureBeans != "" || o.fixtureShots != "" {
		return loadFixture(o.fixtureBeans, o.fixtureShots)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	client := supa.New(config.SupabaseURL, config.SupabaseAnonKey, 18*time.Second)
	return supa.Load(ctx, client, o.dev.DataDir)
}

func loadFixture(beansPath, shotsPath string) (supa.Snapshot, error) {
	var snap supa.Snapshot
	snap.FetchedAt = time.Now()
	if beansPath != "" {
		b, err := os.ReadFile(beansPath)
		if err != nil {
			return snap, err
		}
		if snap.Beans, err = supa.DecodeBeans(b); err != nil {
			return snap, err
		}
	}
	if shotsPath != "" {
		b, err := os.ReadFile(shotsPath)
		if err != nil {
			return snap, err
		}
		if snap.Shots, err = supa.DecodeShots(b); err != nil {
			return snap, err
		}
	}
	return snap, nil
}

// pickMonth resolves the month to show: an explicit YYYY-MM, else the latest
// month containing data, else the current month.
func pickMonth(flagVal string, shots []model.Shot) stats.Month {
	if flagVal != "" {
		if t, err := time.Parse("2006-01", flagVal); err == nil {
			return stats.MonthOf(t)
		}
	}
	if _, last, ok := stats.DataRange(shots); ok {
		return last
	}
	return stats.MonthOf(time.Now())
}

func buildView(snap supa.Snapshot, month stats.Month) render.View {
	beans := make(map[string]model.Bean, len(snap.Beans))
	for _, b := range snap.Beans {
		beans[b.ID] = b
	}
	first, last, ok := stats.DataRange(snap.Shots)
	return render.View{
		Month:     stats.ComputeMonth(snap.Shots, month),
		Beans:     beans,
		Tips:      stats.GlobalTips(snap.Beans, snap.Shots, time.Now()),
		FetchedAt: snap.FetchedAt,
		Stale:     snap.Stale,
		CanPrev:   ok && (first.Before(month)),
		CanNext:   ok && (month.Before(last)),
	}
}

// showError renders a minimal error screen so a headless device isn't silent.
func showError(dev config.Device, out string, err error) {
	fbink := resolveFBInk(dev)
	if c, cerr := render.NewCanvas(config.ScreenWidth, config.ScreenHeight); cerr == nil {
		render.ErrorScreen(c, err.Error())
		_ = displayCanvas(dev, fbink, c, out)
		return
	}
	if fbink.Available() {
		_ = fbink.Print(6, "espresso: "+err.Error())
	}
}

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
	if exe, err := os.Executable(); err == nil {
		return filepath.Join(filepath.Dir(exe), "device.conf")
	}
	return "device.conf"
}

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
