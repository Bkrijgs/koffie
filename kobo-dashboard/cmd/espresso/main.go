// Command espresso is de standalone Kobo-dashboard-app.
//
// Levenscyclus per verversing:
//
//	splash → wifi aan → shots ophalen (Supabase) → dashboard renderen →
//	met FBInk op e-ink tonen → wifi uit → slapen → opnieuw.
//
// Nickel en KOReader blijven staan; deze app wordt via KFMon gestart en is
// volledig omkeerbaar (geen firmware-wijziging).
package main

import (
	"context"
	"flag"
	"image"
	"image/png"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"kobo-dashboard/internal/render"
	"kobo-dashboard/internal/stats"
	"kobo-dashboard/internal/supabase"
	"kobo-dashboard/internal/wifi"
)

func main() {
	var (
		once     = flag.Bool("once", false, "één keer verversen en stoppen")
		hello    = flag.Bool("hello", false, "testframe tonen en stoppen (pijplijn-check)")
		iconPath = flag.String("icon", "", "schrijf een launcher-icoon naar dit pad en stop")
		demo     = flag.Bool("demo", false, "render een dashboard met voorbeelddata naar -out en stop")
		interval = flag.Int("interval", 180, "verversinterval in minuten")
		offset   = flag.Int("offset", 0, "maanden terug t.o.v. nu (0 = deze maand)")
		outPath  = flag.String("out", "/tmp/espresso-dash.png", "pad voor het gerenderde PNG")
	)
	flag.Parse()

	log.SetFlags(log.Ltime)

	// Icoon genereren (door install.sh gebruikt).
	if *iconPath != "" {
		if err := savePNG(render.Icon(120), *iconPath); err != nil {
			log.Fatalf("icoon schrijven mislukt: %v", err)
		}
		log.Printf("icoon geschreven: %s", *iconPath)
		return
	}

	// Demo: render met voorbeelddata, zonder toestel of netwerk.
	if *demo {
		now := time.Now()
		y, m := stats.TargetMonth(now, *offset)
		shots := demoShots(now)
		month := stats.FilterMonth(shots, y, m)
		if err := savePNG(render.Dashboard(now, y, m, month, shots), *outPath); err != nil {
			log.Fatalf("demo renderen mislukt: %v", err)
		}
		log.Printf("demo-dashboard geschreven: %s", *outPath)
		return
	}

	fbink := resolveFBInk()
	log.Printf("fbink: %s", fbink)

	// Pijplijn-check: bewijst build → deploy → launch → e-ink zonder netwerk.
	if *hello {
		showImage(fbink, *outPath, render.Message("Hello espresso", "pijplijn werkt"))
		return
	}

	cfg := supabase.DefaultConfig()
	client := supabase.New(cfg)

	refresh := func() {
		showImage(fbink, *outPath, render.Message("Espresso", "laden…"))

		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()

		if err := wifi.EnsureOnline(ctx, hostOf(cfg.BaseURL)); err != nil {
			showImage(fbink, *outPath, render.Message("Geen wifi", err.Error()))
			return
		}

		shots, err := client.FetchShots(ctx)
		if err != nil {
			showImage(fbink, *outPath, render.Message("Ophalen mislukt", err.Error()))
			wifi.Disable()
			return
		}
		wifi.Disable() // batterij sparen: wifi weer uit na de fetch

		now := time.Now()
		y, m := stats.TargetMonth(now, *offset)
		month := stats.FilterMonth(shots, y, m)
		img := render.Dashboard(now, y, m, month, shots)
		showImage(fbink, *outPath, img)
		log.Printf("dashboard bijgewerkt: %d shots (%d deze maand)", len(shots), len(month))
	}

	refresh()
	if *once {
		return
	}

	ticker := time.NewTicker(time.Duration(*interval) * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		refresh()
	}
}

// resolveFBInk zoekt de fbink-binary: env → naast onze binary → PATH.
func resolveFBInk() string {
	if p := os.Getenv("ESPRESSO_FBINK"); p != "" {
		return p
	}
	if exe, err := os.Executable(); err == nil {
		cand := filepath.Join(filepath.Dir(exe), "fbink")
		if _, err := os.Stat(cand); err == nil {
			return cand
		}
	}
	if p, err := exec.LookPath("fbink"); err == nil {
		return p
	}
	return "fbink" // laatste redmiddel; laat de fout uit exec komen
}

// showImage bewaart het beeld als PNG en blit het met FBInk (volledige refresh,
// gecentreerd). Faalt fbink, dan loggen we het maar crashen niet.
func showImage(fbink, path string, img image.Image) {
	if err := savePNG(img, path); err != nil {
		log.Printf("PNG schrijven mislukt: %v", err)
		return
	}
	cmd := exec.Command(fbink, "-q", "-f", "-g", "file="+path+",halign=center,valign=center")
	if out, err := cmd.CombinedOutput(); err != nil {
		log.Printf("fbink mislukt: %v (%s)", err, out)
	}
}

func savePNG(img image.Image, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}

// hostOf haalt de host uit een base-url (voor de wifi-bereikbaarheidstest).
func hostOf(baseURL string) string {
	s := baseURL
	for _, p := range []string{"https://", "http://"} {
		if len(s) >= len(p) && s[:len(p)] == p {
			s = s[len(p):]
			break
		}
	}
	if i := indexByte(s, '/'); i >= 0 {
		s = s[:i]
	}
	return s
}

func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

// demoShots bouwt een realistische set voorbeeld-shots in de huidige maand,
// puur voor -demo (visuele check zonder toestel/netwerk).
func demoShots(now time.Time) []supabase.Shot {
	beans := []string{"Robusta", "Dorico", "Killer Koffie", "Espresso Medium", "Haagsch Bakkie Dubbel"}
	ratings := []float64{4.0, 3.5, 4.5, 3.0, 2.5, 4.0, 3.5, 5.0, 4.0, 3.5}
	var out []supabase.Shot
	for i := 0; i < 22; i++ {
		day := 1 + (i*4)%27
		ts := time.Date(now.Year(), now.Month(), day, 8+i%9, (i*7)%60, 0, 0, time.Local)
		bean := beans[i%len(beans)]
		dose := 18.0 + float64(i%3)*0.4
		yield := dose * (1.9 + float64(i%5)*0.12)
		out = append(out, supabase.Shot{
			CreatedAt:             ts.Format(time.RFC3339),
			DoseGrams:             dose,
			YieldGrams:            yield,
			BrewRatio:             yield / dose,
			GrindSize:             supabase.Grind(float64(3 + i%7)),
			ExtractionTimeSeconds: 24 + i%12,
			Rating:                ratings[i%len(ratings)],
			DialIn:                i%9 == 0,
			Beans:                 &supabase.Bean{Name: bean},
		})
	}
	// nieuwste eerst, zoals PostgREST teruggeeft
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}
