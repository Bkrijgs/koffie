package render

import (
	"fmt"
	"image"
	"image/color"
	"strings"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/stats"
)

// Layout constants for the 1080x1440 Aura HD panel.
const (
	margin    = 48
	contentW  = 1080 - 2*margin
	footerTop = 1366
)

// View is everything the dashboard renderer needs. Beans is an id→bean lookup
// so cards can show the bean name.
type View struct {
	Month     stats.MonthStats
	Beans     map[string]model.Bean
	Tips      []stats.Tip // barista insights (cross-bean, current state)
	FetchedAt time.Time
	Stale     bool
	CanPrev   bool
	CanNext   bool
}

// Hitboxes are the tappable regions on the dashboard. Fixed layout, so phase-4
// touch handling can resolve a tap without re-deriving geometry.
type Hitboxes struct {
	Prev    image.Rectangle
	Next    image.Rectangle
	Refresh image.Rectangle
	Close   image.Rectangle
}

// DashboardHitboxes returns the fixed tap targets.
func DashboardHitboxes() Hitboxes {
	return Hitboxes{
		Prev:    image.Rect(0, 90, 220, 200),
		Next:    image.Rect(1080-220, 90, 1080, 200),
		Refresh: image.Rect(1080/2-150, footerTop, 1080/2+150, 1440),
		Close:   image.Rect(0, footerTop, 240, 1440),
	}
}

// RenderDashboard draws the full month view onto c. Sections flow vertically:
// each returns the y of its bottom edge.
func RenderDashboard(c *Canvas, v View) {
	c.Fill(0, 0, c.W, c.H, Paper)

	y := drawHeader(c, v)
	y = drawStats(c, v.Month, y)
	y = drawInsights(c, v.Tips, y)
	y = drawChart(c, v.Month, y)
	drawShots(c, v, y)
	drawFooter(c, v)
}

func drawHeader(c *Canvas, v View) int {
	c.Text(margin, 70, "ESPRESSO", 44, true, Ink)

	// Freshness (top-right).
	fresh := "—"
	if !v.FetchedAt.IsZero() {
		fresh = "ververst " + v.FetchedAt.Local().Format("15:04")
	}
	if v.Stale {
		fresh = "offline · " + fresh
	}
	c.TextRight(c.W-margin, 60, fresh, 22, false, Ink300)

	// Month navigation row.
	label := v.Month.Month.Label()
	c.TextCenter(c.W/2, 165, label, 40, true, Ink)

	prevCol, nextCol := Line, Line
	if v.CanPrev {
		prevCol = Ink
	}
	if v.CanNext {
		nextCol = Ink
	}
	drawChevron(c, margin+30, 150, 26, true, prevCol)
	drawChevron(c, c.W-margin-30, 150, 26, false, nextCol)

	c.HLine(margin, 200, contentW, 2, Line)
	return 210
}

// drawChevron draws a ‹ or › arrow centered at (cx, cy). left=true → ‹.
func drawChevron(c *Canvas, cx, cy, r int, left bool, col color.Color) {
	dx := r / 2
	var tip, top, bot [2]float64
	if left {
		tip = [2]float64{float64(cx - dx), float64(cy)}
		top = [2]float64{float64(cx + dx), float64(cy - r)}
		bot = [2]float64{float64(cx + dx), float64(cy + r)}
	} else {
		tip = [2]float64{float64(cx + dx), float64(cy)}
		top = [2]float64{float64(cx - dx), float64(cy - r)}
		bot = [2]float64{float64(cx - dx), float64(cy + r)}
	}
	// Stroke as a thick triangle outline by filling two offset triangles.
	c.FillPolygon([][2]float64{top, tip, bot}, col)
	inset := 7.0
	var top2, tip2, bot2 [2]float64
	if left {
		top2 = [2]float64{top[0] + inset, top[1] + inset*0.7}
		tip2 = [2]float64{tip[0] + inset, tip[1]}
		bot2 = [2]float64{bot[0] + inset, bot[1] - inset*0.7}
	} else {
		top2 = [2]float64{top[0] - inset, top[1] + inset*0.7}
		tip2 = [2]float64{tip[0] - inset, tip[1]}
		bot2 = [2]float64{bot[0] - inset, bot[1] - inset*0.7}
	}
	c.FillPolygon([][2]float64{top2, tip2, bot2}, Paper)
}

func drawStats(c *Canvas, ms stats.MonthStats, top int) int {
	type cell struct{ label, value, sub string }
	cells := []cell{
		{"Shots", itoa(ms.Total), dialSub(ms.DialInCount)},
		{"Effectief", itoa(len(ms.Effective)), ""},
		{"Gem. rating", ratingStr(ms.AvgRating), ""},
		{"Gem. tijd", timeStr(ms.AvgTimeSeconds), ""},
		{"Gem. ratio", ratioStr(ms.AvgRatio), ""},
	}
	h := 150
	cw := contentW / len(cells)
	for i, cl := range cells {
		cx := margin + i*cw + cw/2
		if i > 0 {
			c.Fill(margin+i*cw, top+20, 2, h-40, Line200)
		}
		c.TextCenter(cx, top+34, strings.ToUpper(cl.label), 18, false, Ink300)
		c.TextCenter(cx, top+96, cl.value, 46, true, Ink)
		if cl.sub != "" {
			c.TextCenter(cx, top+128, cl.sub, 18, false, Ink300)
		}
	}
	c.HLine(margin, top+h+10, contentW, 2, Line)
	return top + h + 10
}

// drawInsights renders the barista insight box (top tip). Returns bottom y.
func drawInsights(c *Canvas, tips []stats.Tip, top int) int {
	if len(tips) == 0 {
		return top
	}
	tip := tips[0]
	y := top + 26
	boxTop := y - 4

	c.Text(margin, y+34, "BARISTA", 16, true, Ink300)
	// Kind marker, drawn (the Go font has no ★/▸ glyphs).
	drawTipMarker(c, margin+92, y+26, tip.Kind)

	textX := margin + 116
	maxW := contentW - 116
	lines := c.WrapText(tip.Text, 24, false, maxW)
	if len(lines) > 2 {
		lines = lines[:2]
		lines[1] = c.TruncateToWidth(lines[1]+"…", 24, false, maxW)
	}
	ly := y + 34
	for _, ln := range lines {
		c.Text(textX, ly, ln, 24, false, Ink600)
		ly += 32
	}

	bottom := ly + 6
	if bottom < boxTop+60 {
		bottom = boxTop + 60
	}
	c.HLine(margin, bottom, contentW, 2, Line)
	return bottom + 2
}

// drawTipMarker draws a small kind-specific glyph centered at (cx, cy):
// praise→star, warn→filled disc, tweak→right triangle, info→dot.
func drawTipMarker(c *Canvas, cx, cy int, kind stats.TipKind) {
	switch kind {
	case stats.TipPraise:
		c.fillStar(cx, cy, 11, 1, Ink, Ink)
	case stats.TipWarn:
		// Filled disc with a punched-out exclamation.
		c.fillDisc(cx, cy, 11, Ink)
		c.Fill(cx-2, cy-7, 4, 8, Paper)
		c.Fill(cx-2, cy+4, 4, 4, Paper)
	case stats.TipTweak:
		c.FillPolygon([][2]float64{
			{float64(cx - 7), float64(cy - 9)},
			{float64(cx + 8), float64(cy)},
			{float64(cx - 7), float64(cy + 9)},
		}, Ink)
	default: // info
		c.fillDisc(cx, cy, 6, Ink400)
	}
}

func (c *Canvas) fillDisc(cx, cy, r int, col color.Color) {
	for dy := -r; dy <= r; dy++ {
		for dx := -r; dx <= r; dx++ {
			if dx*dx+dy*dy <= r*r {
				c.set(cx+dx, cy+dy, col)
			}
		}
	}
}

// drawChart draws a per-day bar chart of effective shots for the month and
// returns the y of its bottom edge.
func drawChart(c *Canvas, ms stats.MonthStats, top int) int {
	top += 40
	c.Text(margin, top, "Activiteit deze maand", 26, true, Ink)

	baseline := top + 170
	chartTop := top + 30

	days := len(ms.PerDay)
	if days == 0 {
		c.Text(margin, baseline, "Geen data deze maand.", 24, false, Ink400)
		return baseline + 30
	}

	peak := 1
	for _, n := range ms.PerDay {
		if n > peak {
			peak = n
		}
	}
	gap := 4
	barW := (contentW - (days-1)*gap) / days
	if barW < 6 {
		barW = 6
	}
	maxH := baseline - chartTop
	for d := 0; d < days; d++ {
		x := margin + d*(barW+gap)
		n := ms.PerDay[d]
		if n > 0 {
			bh := n * maxH / peak
			if bh < 6 {
				bh = 6
			}
			c.Fill(x, baseline-bh, barW, bh, Ink)
		} else {
			c.Fill(x, baseline-3, barW, 3, Line)
		}
		// Day ticks every 5 days and on day 1.
		day := d + 1
		if day == 1 || day%5 == 0 {
			c.TextCenter(x+barW/2, baseline+28, itoa(day), 18, false, Ink300)
		}
	}
	c.HLine(margin, baseline+1, contentW, 2, Line200)
	return baseline + 40
}

func drawShots(c *Canvas, v View, top int) {
	ms := v.Month
	top += 44
	c.Text(margin, top, "Shots", 26, true, Ink)
	c.TextRight(c.W-margin, top, fmt.Sprintf("%d deze maand", ms.Total), 22, false, Ink300)
	y := top + 30

	if len(ms.All) == 0 {
		c.Text(margin, y+40, "Nog geen shots in deze maand.", 24, false, Ink400)
		return
	}

	shown := 0
	for _, s := range ms.All {
		h := layoutCard(c, margin, y, contentW, s, "", false)
		if y+h > footerTop-20 {
			break
		}
		layoutCard(c, margin, y, contentW, s, v.beanName(s.BeanID), true)
		y += h + 16
		shown++
	}
	if shown < len(ms.All) {
		c.Text(margin, y+28, fmt.Sprintf("+ %d meer deze maand", len(ms.All)-shown), 22, false, Ink400)
	}
}

func (v View) beanName(id string) string {
	if b, ok := v.Beans[id]; ok {
		return b.Name
	}
	return "Onbekende boon"
}

func drawFooter(c *Canvas, v View) {
	c.HLine(margin, footerTop, contentW, 2, Line)
	cy := footerTop + 48

	c.Text(margin, cy, "‹ ›  maand", 22, false, Ink400)
	c.TextCenter(c.W/2, cy, "Ververs", 26, true, Ink)
	c.TextRight(c.W-margin, cy, "Sluiten", 22, false, Ink400)
}

// ---- shot card -------------------------------------------------------------

const cardPad = 22

// layoutCard lays out (and optionally draws) a shot card, returning its height.
// Sharing one routine for measure and draw keeps the two perfectly in sync and
// lets the block stay compact when there are no notes/tags.
func layoutCard(c *Canvas, x, y, w int, s model.Shot, beanName string, draw bool) int {
	left := x + cardPad
	detailW := w - 2*cardPad

	// Header + stats are a fixed block; detail/tags flow underneath.
	statsValueY := cardPad + 122 // baseline of the stat values
	cur := statsValueY + 28      // first detail baseline

	if draw {
		// Header.
		name := c.TruncateToWidth(beanName, 30, true, w-2*cardPad-180)
		c.Text(left, y+cardPad+26, name, 30, true, Ink)
		c.Text(left, y+cardPad+56, formatDateNL(s.CreatedAt), 20, false, Ink300)
		if s.DialIn {
			c.TextRight(x+w-cardPad, y+cardPad+24, "DIAL-IN", 20, true, Ink300)
		} else {
			starsW := 5 * (2 * 11)
			c.StarRating(x+w-cardPad-starsW-4, y+cardPad+18, 11, 5, s.Rating)
		}
		// Stats row.
		type kv struct{ k, v string }
		kvs := []kv{
			{"Maalgraad", numStr(s.GrindSize)},
			{"Dose", numStr(s.DoseGrams) + " g"},
			{"Yield", numStr(s.YieldGrams) + " g"},
			{"Ratio", "1:" + fmt.Sprintf("%.2f", s.BrewRatio)},
			{"Tijd", itoa(s.ExtractionTimeSecond) + "s"},
		}
		colW := detailW / len(kvs)
		for i, p := range kvs {
			cx := left + i*colW
			c.Text(cx, y+statsValueY-30, strings.ToUpper(p.k), 16, false, Ink300)
			c.Text(cx, y+statsValueY, p.v, 24, true, Ink)
		}
	}

	hasDetail := s.Notes != "" || s.NextAdjustment != "" || len(s.Tags) > 0
	if hasDetail {
		if draw {
			c.HLine(left, y+cur-22, detailW, 2, Line200)
		}
		cur += 8
	}
	if s.Notes != "" {
		cur = flowDetail(c, left, y+cur, detailW, "Smaak.", s.Notes, draw) - y
	}
	if s.NextAdjustment != "" {
		cur = flowDetail(c, left, y+cur, detailW, "Volgende.", s.NextAdjustment, draw) - y
	}
	if len(s.Tags) > 0 {
		if draw {
			drawTags(c, left, y+cur-4, s.Tags)
		}
		cur += 40
	}

	h := cur + cardPad - 8
	if !hasDetail {
		h = statsValueY + cardPad
	}
	if draw {
		c.Rect(x, y, w, h, 2, Line)
	}
	return h
}

// flowDetail measures/draws a wrapped "Label. text" detail line and returns the
// absolute y after it.
func flowDetail(c *Canvas, x, y, maxW int, label, text string, draw bool) int {
	lines := c.WrapText(label+" "+text, 22, false, maxW)
	labelW := c.TextWidth(label, 22, true)
	for i, ln := range lines {
		if draw {
			if i == 0 {
				c.Text(x, y, label, 22, true, Ink400)
				c.Text(x+labelW+6, y, strings.TrimPrefix(ln, label+" "), 22, false, Ink600)
			} else {
				c.Text(x, y, ln, 22, false, Ink600)
			}
		}
		y += 30
	}
	return y
}

func drawDetailLine(c *Canvas, x, y, maxW int, label, text string) int {
	lines := c.WrapText(label+" "+text, 22, false, maxW)
	labelW := c.TextWidth(label, 22, true)
	for i, ln := range lines {
		if i == 0 {
			c.Text(x, y, label, 22, true, Ink400)
			c.Text(x+labelW+6, y, strings.TrimPrefix(ln, label+" "), 22, false, Ink600)
		} else {
			c.Text(x, y, ln, 22, false, Ink600)
		}
		y += 30
	}
	return y
}

func drawTags(c *Canvas, x, y int, tags []string) {
	cx := x
	for _, t := range tags {
		tw := c.TextWidth(t, 20, false)
		pillW := tw + 28
		c.Rect(cx, y, pillW, 34, 2, Line)
		c.Text(cx+14, y+24, t, 20, false, Ink600)
		cx += pillW + 10
	}
}

// ---- formatting ------------------------------------------------------------

var nlWeekday = [...]string{"zo", "ma", "di", "wo", "do", "vr", "za"}
var nlMonthShort = [...]string{"jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"}

// formatDateNL renders a timestamp like "ma 20 jun · 07:40". Go's time package
// doesn't localize, so we assemble the Dutch names ourselves.
func formatDateNL(t time.Time) string {
	t = t.Local()
	return fmt.Sprintf("%s %d %s · %02d:%02d",
		nlWeekday[int(t.Weekday())], t.Day(), nlMonthShort[int(t.Month())-1],
		t.Hour(), t.Minute())
}

func dialSub(n int) string {
	if n <= 0 {
		return ""
	}
	return itoa(n) + " dial-in"
}

func ratingStr(v float64) string {
	if v <= 0 {
		return "—"
	}
	return fmt.Sprintf("%.1f", v)
}

func timeStr(v float64) string {
	if v <= 0 {
		return "—"
	}
	return fmt.Sprintf("%.0fs", v)
}

func ratioStr(v float64) string {
	if v <= 0 {
		return "—"
	}
	return "1:" + fmt.Sprintf("%.1f", v)
}

func numStr(v float64) string {
	if v == float64(int(v)) {
		return itoa(int(v))
	}
	return fmt.Sprintf("%.1f", v)
}
