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

	opts := runOpts{
		dev:          dev,
		out:          out,
		preview:      *preview,
		month:        *monthFlag,
		fixtureBeans: *fixtureBeans,
		fixtureShots: *fixtureShots,
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
}

func run(o runOpts) error {
	snap, err := loadData(o)
	if err != nil {
		return err
	}
	log.Printf("data: %d beans, %d shots (stale=%v)", len(snap.Beans), len(snap.Shots), snap.Stale)

	a := &app{o: o, snap: snap, month: pickMonth(o.month, snap.Shots)}
	if !o.preview {
		a.fb = render.NewFBInk(o.dev.FBInkBin)
		if !a.fb.Available() {
			return fmt.Errorf("fbink not found/executable at %s", o.dev.FBInkBin)
		}
	}
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
	if err := render.SavePNG(c, a.o.out); err != nil {
		return fmt.Errorf("save png: %w", err)
	}
	log.Printf("rendered %s for %s", a.o.out, a.month.Label())
	if a.fb == nil {
		return nil
	}
	return a.fb.DisplayImage(a.o.out)
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

// loop handles touch navigation until close or idle timeout.
func (a *app) loop() {
	reader, err := input.Open(a.o.dev)
	if err != nil {
		// No touch panel: leave the rendered dashboard up and return to Nickel.
		log.Printf("touch unavailable (%v); static display", err)
		return
	}
	defer reader.Close()

	hb := render.DashboardHitboxes()
	idle := time.NewTimer(idleTimeout)
	defer idle.Stop()

	for {
		select {
		case <-idle.C:
			log.Printf("idle timeout; exiting")
			return
		case tap, ok := <-reader.Taps():
			if !ok {
				return
			}
			idle.Reset(idleTimeout)
			p := image.Pt(tap.X, tap.Y)
			first, last, hasData := stats.DataRange(a.snap.Shots)
			switch {
			case p.In(hb.Close):
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
		FetchedAt: snap.FetchedAt,
		Stale:     snap.Stale,
		CanPrev:   ok && (first.Before(month)),
		CanNext:   ok && (month.Before(last)),
	}
}

// showError renders a minimal error screen so a headless device isn't silent.
func showError(dev config.Device, out string, err error) {
	fb := render.NewFBInk(dev.FBInkBin)
	if c, cerr := render.NewCanvas(config.ScreenWidth, config.ScreenHeight); cerr == nil {
		render.ErrorScreen(c, err.Error())
		if render.SavePNG(c, out) == nil && fb.Available() {
			_ = fb.DisplayImage(out)
			return
		}
	}
	if fb.Available() {
		_ = fb.Print(6, "espresso: "+err.Error())
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
