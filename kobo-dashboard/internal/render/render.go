// Package render tekent het espresso-dashboard naar een afbeelding, die de
// caller met FBInk op het e-ink scherm blit. Alles in grijstinten, hoog
// contrast, grote letters — afgestemd op de Kobo Aura HD (1080×1440).
package render

import (
	"fmt"
	"image"
	"math"
	"time"

	"github.com/fogleman/gg"
	"github.com/golang/freetype/truetype"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"

	"kobo-dashboard/internal/stats"
	"kobo-dashboard/internal/supabase"
)

// Aura HD framebuffer.
const (
	W      = 1080
	H      = 1440
	margin = 52
)

var monthsNL = []string{
	"", "januari", "februari", "maart", "april", "mei", "juni",
	"juli", "augustus", "september", "oktober", "november", "december",
}

type faces struct {
	reg, bold *truetype.Font
}

func loadFaces() *faces {
	r, _ := truetype.Parse(goregular.TTF)
	b, _ := truetype.Parse(gobold.TTF)
	return &faces{reg: r, bold: b}
}

func (f *faces) regFace(size float64) font.Face {
	return truetype.NewFace(f.reg, &truetype.Options{Size: size, DPI: 72, Hinting: font.HintingFull})
}
func (f *faces) boldFace(size float64) font.Face {
	return truetype.NewFace(f.bold, &truetype.Options{Size: size, DPI: 72, Hinting: font.HintingFull})
}

// grijstinten
const (
	black = 0.0
	dark  = 0.20
	mid   = 0.45
	soft  = 0.65
	line  = 0.78
	pale  = 0.90
)

func num1(v float64) string {
	if v == math.Trunc(v) {
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%.1f", v)
}

// Dashboard tekent het volledige maand-dashboard.
//
//	now   – tijdstempel voor "bijgewerkt"
//	y, m  – de getoonde maand
//	month – shots in die maand (nieuwste eerst)
//	all   – alle shots (nieuwste eerst)
func Dashboard(now time.Time, y int, m time.Month, month, all []supabase.Shot) image.Image {
	f := loadFaces()
	dc := gg.NewContext(W, H)
	dc.SetRGB(1, 1, 1)
	dc.Clear()

	ms := stats.Compute(month)
	as := stats.Compute(all)

	yc := float64(margin)

	// ---- Header ------------------------------------------------------------
	dc.SetFontFace(f.boldFace(60))
	dc.SetRGB(black, black, black)
	dc.DrawString("Espresso", margin, yc+52)

	dc.SetFontFace(f.regFace(24))
	dc.SetRGB(mid, mid, mid)
	dc.DrawStringAnchored("bijgewerkt "+now.Format("15:04"), W-margin, yc+40, 1, 0.5)
	yc += 78

	dc.SetLineWidth(3)
	dc.SetRGB(black, black, black)
	dc.DrawLine(margin, yc, W-margin, yc)
	dc.Stroke()
	yc += 34

	// Maandtitel.
	title := fmt.Sprintf("%s %d", monthsNL[int(m)], y)
	dc.SetFontFace(f.boldFace(34))
	dc.SetRGB(dark, dark, dark)
	dc.DrawString(title, margin, yc+30)
	dc.SetFontFace(f.regFace(24))
	dc.SetRGB(soft, soft, soft)
	dc.DrawStringAnchored(fmt.Sprintf("%d shots totaal", as.Total), W-margin, yc+22, 1, 0.5)
	yc += 66

	// ---- Stat-tegels (deze maand) -----------------------------------------
	tiles := []struct{ value, label string }{
		{fmt.Sprintf("%d", ms.Total), "shots"},
		{ratingStr(ms), "gem. rating"},
		{ratioStr(ms), "gem. ratio"},
	}
	gap := 20.0
	tw := (float64(W-2*margin) - gap*float64(len(tiles)-1)) / float64(len(tiles))
	th := 150.0
	for i, t := range tiles {
		x := float64(margin) + float64(i)*(tw+gap)
		drawTile(dc, f, x, yc, tw, th, t.value, t.label)
	}
	// subregel onder de tegels
	yc += th + 16
	dc.SetFontFace(f.regFace(24))
	dc.SetRGB(mid, mid, mid)
	sub := fmt.Sprintf("gem. tijd %s   ·   dial-in %d", timeStr(ms), ms.DialIn)
	if ms.TopBean != nil {
		sub += fmt.Sprintf("   ·   meest: %s (%d)", ms.TopBean.Name, ms.TopBean.Count)
	}
	dc.DrawString(sub, margin, yc+22)
	yc += 54

	// ---- Rating-verdeling (horizontale balken) ----------------------------
	yc = sectionTitle(dc, f, "Rating-verdeling", yc)
	maxHist := 1
	for _, c := range ms.Hist {
		if c > maxHist {
			maxHist = c
		}
	}
	barH := 30.0
	barGap := 12.0
	labelW := 70.0
	trackX := float64(margin) + labelW
	trackW := float64(W-margin) - trackX - 60
	for star := 5; star >= 1; star-- {
		c := ms.Hist[star-1]
		row := yc
		dc.SetFontFace(f.regFace(24))
		dc.SetRGB(dark, dark, dark)
		dc.DrawString(fmt.Sprintf("%d", star), margin, row+barH-8)
		drawStar(dc, margin+30, row+barH/2, 9)
		// track
		dc.SetRGB(pale, pale, pale)
		dc.DrawRectangle(trackX, row, trackW, barH)
		dc.Fill()
		// value
		frac := float64(c) / float64(maxHist)
		dc.SetRGB(dark, dark, dark)
		dc.DrawRectangle(trackX, row, trackW*frac, barH)
		dc.Fill()
		dc.SetRGB(soft, soft, soft)
		dc.DrawString(fmt.Sprintf("%d", c), trackX+trackW+12, row+barH-8)
		yc += barH + barGap
	}
	yc += 24

	// ---- Activiteit (staafjes per dag) ------------------------------------
	yc = sectionTitle(dc, f, "Activiteit deze maand", yc)
	counts, n, maxc := stats.DayCounts(month, y, m)
	if maxc < 1 {
		maxc = 1
	}
	chartH := 130.0
	chartW := float64(W - 2*margin)
	slot := chartW / float64(n)
	bw := math.Max(4, slot-3)
	base := yc + chartH
	for i := 0; i < n; i++ {
		bh := (float64(counts[i]) / float64(maxc)) * chartH
		x := float64(margin) + float64(i)*slot
		if counts[i] > 0 {
			dc.SetRGB(dark, dark, dark)
		} else {
			dc.SetRGB(pale, pale, pale)
			bh = 3
		}
		dc.DrawRectangle(x, base-bh, bw, bh)
		dc.Fill()
	}
	dc.SetLineWidth(2)
	dc.SetRGB(line, line, line)
	dc.DrawLine(margin, base, W-margin, base)
	dc.Stroke()
	// dag-labels: 1, 10, 20, laatste
	dc.SetFontFace(f.regFace(20))
	dc.SetRGB(soft, soft, soft)
	for _, d := range []int{1, 10, 20, n} {
		if d >= 1 && d <= n {
			x := float64(margin) + (float64(d)-0.5)*slot
			dc.DrawStringAnchored(fmt.Sprintf("%d", d), x, base+22, 0.5, 0.5)
		}
	}
	yc = base + 52

	// ---- Laatste shots -----------------------------------------------------
	yc = sectionTitle(dc, f, "Laatste shots", yc)
	max := 8
	if len(all) < max {
		max = len(all)
	}
	rowH := 62.0
	for i := 0; i < max; i++ {
		s := all[i]
		if yc+rowH > H-margin {
			break
		}
		drawShotRow(dc, f, margin, yc, float64(W-2*margin), rowH, s)
		yc += rowH
	}

	return dc.Image()
}

func ratingStr(s stats.Stats) string {
	if !s.HasRating {
		return "—"
	}
	return fmt.Sprintf("%.1f", s.AvgRating)
}
func ratioStr(s stats.Stats) string {
	if !s.HasRatio {
		return "—"
	}
	return fmt.Sprintf("1:%.1f", s.AvgRatio)
}
func timeStr(s stats.Stats) string {
	if !s.HasTime {
		return "—"
	}
	return fmt.Sprintf("%.0f s", s.AvgTime)
}

func drawTile(dc *gg.Context, f *faces, x, y, w, h float64, value, label string) {
	dc.SetLineWidth(2)
	dc.SetRGB(line, line, line)
	dc.DrawRoundedRectangle(x, y, w, h, 14)
	dc.Stroke()

	dc.SetFontFace(f.boldFace(58))
	dc.SetRGB(black, black, black)
	dc.DrawStringAnchored(value, x+w/2, y+h/2-6, 0.5, 0.5)

	dc.SetFontFace(f.regFace(22))
	dc.SetRGB(mid, mid, mid)
	dc.DrawStringAnchored(label, x+w/2, y+h-30, 0.5, 0.5)
}

func sectionTitle(dc *gg.Context, f *faces, text string, y float64) float64 {
	dc.SetFontFace(f.boldFace(26))
	dc.SetRGB(mid, mid, mid)
	dc.DrawString(text, margin, y+22)
	dc.SetLineWidth(2)
	dc.SetRGB(line, line, line)
	dc.DrawLine(margin, y+38, W-margin, y+38)
	dc.Stroke()
	return y + 62
}

func drawShotRow(dc *gg.Context, f *faces, x, y, w, h float64, s supabase.Shot) {
	dc.SetLineWidth(1)
	dc.SetRGB(pale, pale, pale)
	dc.DrawLine(x, y+h, x+w, y+h)
	dc.Stroke()

	dc.SetFontFace(f.boldFace(26))
	dc.SetRGB(black, black, black)
	dc.DrawString(clip(s.BeanName(), 26), x, y+28)

	dc.SetFontFace(f.regFace(23))
	dc.SetRGB(mid, mid, mid)
	detail := fmt.Sprintf("maalgraad %s · %s→%s g (1:%.2f) · %d s",
		num1(s.GrindSize.Float()), num1(s.DoseGrams), num1(s.YieldGrams),
		s.BrewRatio, s.ExtractionTimeSeconds)
	dc.DrawString(detail, x, y+54)

	// rechterkant: datum + rating-stippen
	t := s.Time()
	dc.SetFontFace(f.regFace(22))
	dc.SetRGB(soft, soft, soft)
	if !t.IsZero() {
		dc.DrawStringAnchored(t.Format("02-01"), x+w, y+26, 1, 0.5)
	}
	drawDots(dc, x+w-5, y+48, s.Rating)
}

// drawDots tekent 5 stippen, gevuld tot afgeronde rating. Glyph-onafhankelijk.
func drawDots(dc *gg.Context, right, cy, rating float64) {
	r := 6.0
	gap := 20.0
	filled := int(rating + 0.5)
	for i := 0; i < 5; i++ {
		cx := right - float64(4-i)*gap
		if i < filled {
			dc.SetRGB(dark, dark, dark)
			dc.DrawCircle(cx, cy, r)
			dc.Fill()
		} else {
			dc.SetRGB(line, line, line)
			dc.SetLineWidth(2)
			dc.DrawCircle(cx, cy, r)
			dc.Stroke()
		}
	}
}

// drawStar tekent een gevulde 5-punts ster (glyph-onafhankelijk).
func drawStar(dc *gg.Context, cx, cy, r float64) {
	dc.SetRGB(dark, dark, dark)
	dc.NewSubPath()
	for i := 0; i < 10; i++ {
		ang := -math.Pi/2 + float64(i)*math.Pi/5
		rr := r
		if i%2 == 1 {
			rr = r * 0.42
		}
		x := cx + rr*math.Cos(ang)
		y := cy + rr*math.Sin(ang)
		if i == 0 {
			dc.MoveTo(x, y)
		} else {
			dc.LineTo(x, y)
		}
	}
	dc.ClosePath()
	dc.Fill()
}

func clip(s string, n int) string {
	rs := []rune(s)
	if len(rs) <= n {
		return s
	}
	return string(rs[:n-1]) + "…"
}

// Message tekent een fullscreen bericht (splash / fout). title groot, body klein.
func Message(title, body string) image.Image {
	f := loadFaces()
	dc := gg.NewContext(W, H)
	dc.SetRGB(1, 1, 1)
	dc.Clear()

	dc.SetFontFace(f.boldFace(56))
	dc.SetRGB(black, black, black)
	dc.DrawStringAnchored(title, W/2, H/2-40, 0.5, 0.5)

	if body != "" {
		dc.SetFontFace(f.regFace(26))
		dc.SetRGB(mid, mid, mid)
		lines := wrap(body, 44)
		for i, ln := range lines {
			dc.DrawStringAnchored(ln, W/2, H/2+20+float64(i)*36, 0.5, 0.5)
		}
	}
	return dc.Image()
}

// Icon tekent een eenvoudig launcher-icoon (kopje) op transparant/wit.
func Icon(size int) image.Image {
	dc := gg.NewContext(size, size)
	dc.SetRGB(1, 1, 1)
	dc.Clear()
	s := float64(size)
	dc.SetRGB(black, black, black)
	dc.SetLineWidth(s * 0.05)
	// kop
	dc.DrawArc(s*0.42, s*0.55, s*0.22, 0, math.Pi)
	dc.Stroke()
	dc.DrawLine(s*0.20, s*0.55, s*0.64, s*0.55)
	dc.Stroke()
	// oor
	dc.DrawArc(s*0.66, s*0.60, s*0.10, -math.Pi/2, math.Pi/2)
	dc.Stroke()
	// stoom
	for i := 0; i < 3; i++ {
		x := s*0.30 + float64(i)*s*0.12
		dc.MoveTo(x, s*0.42)
		dc.QuadraticTo(x+s*0.06, s*0.36, x, s*0.30)
		dc.Stroke()
	}
	return dc.Image()
}

func wrap(s string, width int) []string {
	var out []string
	var cur []rune
	for _, r := range s {
		if r == '\n' {
			out = append(out, string(cur))
			cur = cur[:0]
			continue
		}
		cur = append(cur, r)
		if len(cur) >= width && r == ' ' {
			out = append(out, string(cur))
			cur = cur[:0]
		}
	}
	if len(cur) > 0 {
		out = append(out, string(cur))
	}
	return out
}
