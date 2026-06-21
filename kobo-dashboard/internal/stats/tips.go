package stats

import (
	"fmt"
	"sort"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
)

// TipKind classifies an insight for styling.
type TipKind int

const (
	TipInfo TipKind = iota
	TipTweak
	TipPraise
	TipWarn
)

// Tip is a single barista insight, ported from lib/tips.ts.
type Tip struct {
	ID   string
	Kind TipKind
	Text string
}

const (
	timeMin      = 25
	timeMax      = 32
	ratioMin     = 1.6
	ratioMax     = 2.6
	freshMinDays = 5
	freshMaxDays = 35
)

func daysBetween(t time.Time, now time.Time) int {
	return int(now.Sub(t).Hours() / 24)
}

func median(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	s := append([]float64(nil), xs...)
	sort.Float64s(s)
	mid := len(s) / 2
	if len(s)%2 == 0 {
		return (s[mid-1] + s[mid]) / 2
	}
	return s[mid]
}

type sweetSpot struct {
	timeLow, timeHigh   float64
	ratioLow, ratioHigh float64
	obsTimeLow          float64
	obsTimeHigh         float64
	learned             bool
}

// beanSweetSpot learns a bean's optimal time/ratio range from its own ≥4★
// shots, falling back to general espresso rules (lib/tips.ts).
func beanSweetSpot(eff []model.Shot) sweetSpot {
	var good []model.Shot
	for _, s := range eff {
		if s.Rating >= 4 {
			good = append(good, s)
		}
	}
	if len(good) < 3 {
		return sweetSpot{timeMin, timeMax, ratioMin, ratioMax, timeMin, timeMax, false}
	}
	tLow, tHigh := float64(good[0].ExtractionTimeSecond), float64(good[0].ExtractionTimeSecond)
	rLow, rHigh := good[0].BrewRatio, good[0].BrewRatio
	for _, s := range good {
		t := float64(s.ExtractionTimeSecond)
		if t < tLow {
			tLow = t
		}
		if t > tHigh {
			tHigh = t
		}
		if s.BrewRatio < rLow {
			rLow = s.BrewRatio
		}
		if s.BrewRatio > rHigh {
			rHigh = s.BrewRatio
		}
	}
	return sweetSpot{tLow - 2, tHigh + 2, rLow - 0.15, rHigh + 0.15, tLow, tHigh, true}
}

// lastBeanNudges ports the time/ratio/grind-drift tips of tipsForBean that
// globalTips surfaces for the most recently used bean. Shots are newest-first.
func lastBeanNudges(bean model.Bean, beanShots []model.Shot) []Tip {
	eff := EffectiveShots(beanShots)
	if len(eff) == 0 {
		return nil
	}
	recent := eff
	if len(recent) > 3 {
		recent = recent[:3]
	}
	spot := beanSweetSpot(eff)
	obsRange := fmt.Sprintf("%d–%ds", round(spot.obsTimeLow), round(spot.obsTimeHigh))

	var tips []Tip
	times := make([]float64, len(recent))
	ratios := make([]float64, len(recent))
	for i, s := range recent {
		times[i] = float64(s.ExtractionTimeSecond)
		ratios[i] = s.BrewRatio
	}
	rt := Average(times)
	if rt > 0 && rt < spot.timeLow {
		hard := rt < spot.timeLow-6
		tips = append(tips, Tip{"time-fast", TipTweak, nudgeText(spot.learned, rt, obsRange, hard, "fijner")})
	} else if rt > 0 && rt > spot.timeHigh {
		hard := rt > spot.timeHigh+8
		tips = append(tips, Tip{"time-slow", TipTweak, nudgeText(spot.learned, rt, obsRange, hard, "grover")})
	}
	ra := Average(ratios)
	if ra > 0 && ra < spot.ratioLow {
		tips = append(tips, Tip{"ratio-low", TipTweak,
			fmt.Sprintf("Brew ratio gem. 1:%.2f — kort. Laat 'm langer doorlopen.", ra)})
	} else if ra > 0 && ra > spot.ratioHigh {
		tips = append(tips, Tip{"ratio-high", TipTweak,
			fmt.Sprintf("Brew ratio gem. 1:%.2f — lang. Stop eerder voor meer body.", ra)})
	}

	// grind-drift: top shot vs latest grind.
	top := topByRating(eff)
	last := eff[0]
	if top != nil && top.ID != last.ID && top.Rating >= 4 && top.GrindSize != last.GrindSize {
		delta := last.GrindSize - top.GrindSize
		dir := "grover"
		if delta > 0 {
			dir = "fijner"
		}
		steps := delta
		if steps < 0 {
			steps = -steps
		}
		word := "stap"
		if steps != 1 {
			word = "stappen"
		}
		tips = append(tips, Tip{"grind-drift", TipTweak,
			fmt.Sprintf("Topshot (%s★) zat op maalgraad %s, je laatste op %s. Ga %s %s %s terug.",
				numFmt(top.Rating), numFmt(top.GrindSize), numFmt(last.GrindSize), numFmt(steps), word, dir)})
	}
	return tips
}

func nudgeText(learned bool, rt float64, obsRange string, hard bool, dir string) string {
	hardness := "Een tikje"
	if hard {
		hardness = "Flink"
	}
	if learned {
		return fmt.Sprintf("Recent ~%ds; je topshots zitten op %s. %s %s malen.", round(rt), obsRange, hardness, dir)
	}
	return fmt.Sprintf("Doorlooptijd ~%ds. %s %s malen.", round(rt), hardness, dir)
}

type todStat struct {
	best, other       string
	bestAvg, otherAvg float64
}

func bestTodPattern(shots []model.Shot) *todStat {
	buckets := map[string][]float64{"ochtend": nil, "middag": nil, "avond": nil}
	for _, s := range shots {
		buckets[hourBucket(s.CreatedAt)] = append(buckets[hourBucket(s.CreatedAt)], s.Rating)
	}
	type kv struct {
		k   string
		avg float64
	}
	var stats []kv
	for k, arr := range buckets {
		if len(arr) >= 3 {
			stats = append(stats, kv{k, Average(arr)})
		}
	}
	if len(stats) < 2 {
		return nil
	}
	sort.Slice(stats, func(i, j int) bool { return stats[i].avg > stats[j].avg })
	top, bot := stats[0], stats[len(stats)-1]
	if top.avg-bot.avg < 0.5 {
		return nil
	}
	return &todStat{top.k, bot.k, top.avg, bot.avg}
}

func hourBucket(t time.Time) string {
	h := t.Local().Hour()
	switch {
	case h >= 5 && h < 12:
		return "ochtend"
	case h >= 12 && h < 17:
		return "middag"
	default:
		return "avond"
	}
}

// GlobalTips ports lib/tips.ts globalTips: cross-bean insights for the
// dashboard. shots are newest-first. now allows deterministic testing.
func GlobalTips(beans []model.Bean, shots []model.Shot, now time.Time) []Tip {
	if len(beans) == 0 {
		return []Tip{{"no-beans", TipInfo, "Voeg eerst een boon toe."}}
	}
	if len(shots) == 0 {
		return []Tip{{"no-shots", TipInfo, "Log je eerste shot om data-tips te krijgen."}}
	}
	eff := EffectiveShots(shots)
	if len(eff) == 0 {
		return []Tip{{"no-shots", TipInfo, "Log je eerste niet-dial-in shot om data-tips te krijgen."}}
	}

	var tips []Tip
	last := eff[0]

	beanByID := map[string]model.Bean{}
	for _, b := range beans {
		beanByID[b.ID] = b
	}
	if lb, ok := beanByID[last.BeanID]; ok {
		var lbShots []model.Shot
		for _, s := range shots {
			if s.BeanID == lb.ID {
				lbShots = append(lbShots, s)
			}
		}
		for _, t := range lastBeanNudges(lb, lbShots) {
			tips = append(tips, Tip{lb.ID + ":" + t.ID, t.Kind, lb.Name + ": " + t.Text})
		}
	}

	if d := daysBetween(last.CreatedAt, now); d >= 5 {
		tips = append(tips, Tip{"inactive", TipInfo,
			fmt.Sprintf("Geen shot in %d dagen. Een aangebroken zak ontgast verder en loopt vaak sneller door — begin een tikje fijner.", d)})
	}

	if len(eff) >= 10 {
		if tod := bestTodPattern(eff); tod != nil {
			tips = append(tips, Tip{"global-tod", TipInfo,
				fmt.Sprintf("%s shots scoren gem. %.1f★ — %.1f★ hoger dan %s.",
					capitalize(tod.best), tod.bestAvg, tod.bestAvg-tod.otherAvg, tod.other)})
		}
	}

	recent10 := head(eff, 10)
	older10 := slice(eff, 10, 20)
	if len(recent10) >= 5 && len(older10) >= 5 {
		r := Average(ratings(recent10))
		o := Average(ratings(older10))
		switch {
		case r-o >= 0.5:
			tips = append(tips, Tip{"trending-up", TipPraise,
				fmt.Sprintf("Laatste 10 shots: %.1f★ vs %.1f★ daarvoor. Goede curve.", r, o)})
		case o-r >= 0.5:
			tips = append(tips, Tip{"trending-down", TipWarn,
				fmt.Sprintf("Laatste 10 shots: %.1f★, daarvoor %.1f★. Wat is veranderd?", r, o)})
		}
	}

	highest := 0.0
	for _, s := range eff {
		if s.Rating > highest {
			highest = s.Rating
		}
	}
	if last.Rating >= 4.5 && last.Rating == highest && len(eff) >= 2 {
		tips = append(tips, Tip{"top-shot", TipPraise,
			fmt.Sprintf("Net je beste shot tot nu toe (%s★). Onthou deze instellingen goed.", numFmt(last.Rating))})
	}

	for _, m := range []int{10, 25, 50, 100, 250, 500} {
		if len(eff) == m {
			tips = append(tips, Tip{"milestone-shots", TipPraise,
				fmt.Sprintf("%d shots gelogd. Dat is serieus dial-in werk.", m)})
		}
	}

	// best-bean: which bean scores highest (≥3 shots, clear gap).
	type rank struct {
		bean model.Bean
		n    int
		avg  float64
	}
	var ranked []rank
	for _, b := range beans {
		var rs []float64
		for _, s := range eff {
			if s.BeanID == b.ID {
				rs = append(rs, s.Rating)
			}
		}
		if len(rs) >= 3 {
			ranked = append(ranked, rank{b, len(rs), Average(rs)})
		}
	}
	sort.Slice(ranked, func(i, j int) bool { return ranked[i].avg > ranked[j].avg })
	if len(ranked) >= 2 && ranked[0].avg-ranked[len(ranked)-1].avg >= 0.5 {
		w := ranked[0]
		tips = append(tips, Tip{"best-bean", TipInfo,
			fmt.Sprintf("%s scoort het hoogst: gem. %.1f★ over %d shots.", w.bean.Name, w.avg, w.n)})
	}

	if len(tips) > 3 {
		tips = tips[:3]
	}
	return tips
}

// ---- small helpers ---------------------------------------------------------

func topByRating(eff []model.Shot) *model.Shot {
	if len(eff) == 0 {
		return nil
	}
	s := append([]model.Shot(nil), eff...)
	sort.SliceStable(s, func(i, j int) bool {
		if s[i].Rating != s[j].Rating {
			return s[i].Rating > s[j].Rating
		}
		return s[i].CreatedAt.After(s[j].CreatedAt)
	})
	return &s[0]
}

func ratings(shots []model.Shot) []float64 {
	out := make([]float64, len(shots))
	for i, s := range shots {
		out[i] = s.Rating
	}
	return out
}

func head(s []model.Shot, n int) []model.Shot {
	if n > len(s) {
		n = len(s)
	}
	return s[:n]
}

func slice(s []model.Shot, a, b int) []model.Shot {
	if a > len(s) {
		a = len(s)
	}
	if b > len(s) {
		b = len(s)
	}
	return s[a:b]
}

func round(f float64) int { return int(f + 0.5) }

func numFmt(v float64) string {
	if v == float64(int(v)) {
		return itoa(int(v))
	}
	return fmt.Sprintf("%.1f", v)
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return string(s[0]-32) + s[1:]
}

var _ = median // retained for parity with lib/tips.ts anomaly checks
