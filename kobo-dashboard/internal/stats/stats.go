// Package stats ports the web app's dashboard/stats logic (lib/utils.ts,
// app/page.tsx) to Go. The cardinal rule, same as the web app: dial-in shots
// stay visible in lists but never feed an aggregate (rating, averages, charts).
package stats

import (
	"sort"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
)

// EffectiveShots drops dial-in attempts so they never skew aggregates,
// mirroring effectiveShots() in lib/utils.ts.
func EffectiveShots(shots []model.Shot) []model.Shot {
	out := make([]model.Shot, 0, len(shots))
	for _, s := range shots {
		if !s.DialIn {
			out = append(out, s)
		}
	}
	return out
}

// Average returns the mean, or 0 for an empty slice.
func Average(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	var sum float64
	for _, x := range xs {
		sum += x
	}
	return sum / float64(len(xs))
}

// CalcBrewRatio mirrors lib/utils.ts (2-decimal yield/dose), used as a fallback
// when a row's stored brew_ratio is missing.
func CalcBrewRatio(yield, dose float64) float64 {
	if dose <= 0 {
		return 0
	}
	return float64(int((yield/dose)*100+0.5)) / 100
}

// Month is a calendar month in local time.
type Month struct {
	Year  int
	Month time.Month
}

// MonthOf returns the month a timestamp falls in (local time).
func MonthOf(t time.Time) Month {
	t = t.Local()
	return Month{Year: t.Year(), Month: t.Month()}
}

// Add returns the month n months later (n may be negative).
func (m Month) Add(n int) Month {
	t := time.Date(m.Year, m.Month, 1, 0, 0, 0, 0, time.Local).AddDate(0, n, 0)
	return Month{Year: t.Year(), Month: t.Month()}
}

// Contains reports whether t falls in this month.
func (m Month) Contains(t time.Time) bool {
	return MonthOf(t) == m
}

// Before reports whether m is strictly earlier than o.
func (m Month) Before(o Month) bool {
	if m.Year != o.Year {
		return m.Year < o.Year
	}
	return m.Month < o.Month
}

// Days returns the number of days in the month.
func (m Month) Days() int {
	return time.Date(m.Year, m.Month+1, 0, 0, 0, 0, 0, time.Local).Day()
}

var dutchMonths = [...]string{
	"januari", "februari", "maart", "april", "mei", "juni",
	"juli", "augustus", "september", "oktober", "november", "december",
}

// Label renders e.g. "juni 2026".
func (m Month) Label() string {
	name := "?"
	if m.Month >= 1 && m.Month <= 12 {
		name = dutchMonths[m.Month-1]
	}
	return name + " " + itoa(m.Year)
}

// ShotsInMonth filters shots to one month, preserving input order (newest-first).
func ShotsInMonth(shots []model.Shot, m Month) []model.Shot {
	out := make([]model.Shot, 0)
	for _, s := range shots {
		if m.Contains(s.CreatedAt) {
			out = append(out, s)
		}
	}
	return out
}

// MonthStats is everything the dashboard shows for one month.
type MonthStats struct {
	Month          Month
	All            []model.Shot // every shot in the month, newest-first
	Effective      []model.Shot // non-dial-in subset
	Total          int
	DialInCount    int
	AvgRating      float64 // effective only
	AvgTimeSeconds float64 // effective only
	AvgRatio       float64 // effective only
	PerDay         []int   // PerDay[d-1] = #effective shots on day d
	Best           *model.Shot
}

// ComputeMonth aggregates a month exactly like the dashboard does: counts use
// all shots, but every average/chart uses the effective subset.
func ComputeMonth(shots []model.Shot, m Month) MonthStats {
	all := ShotsInMonth(shots, m)
	eff := EffectiveShots(all)

	ms := MonthStats{
		Month:       m,
		All:         all,
		Effective:   eff,
		Total:       len(all),
		DialInCount: len(all) - len(eff),
		PerDay:      make([]int, m.Days()),
	}

	ratings := make([]float64, 0, len(eff))
	times := make([]float64, 0, len(eff))
	ratios := make([]float64, 0, len(eff))
	for _, s := range eff {
		ratings = append(ratings, s.Rating)
		times = append(times, float64(s.ExtractionTimeSecond))
		ratios = append(ratios, s.BrewRatio)
		d := s.CreatedAt.Local().Day()
		if d >= 1 && d <= len(ms.PerDay) {
			ms.PerDay[d-1]++
		}
	}
	ms.AvgRating = Average(ratings)
	ms.AvgTimeSeconds = Average(times)
	ms.AvgRatio = Average(ratios)

	// Best shot of the month: highest rating, then most recent.
	if len(eff) > 0 {
		best := make([]model.Shot, len(eff))
		copy(best, eff)
		sort.SliceStable(best, func(i, j int) bool {
			if best[i].Rating != best[j].Rating {
				return best[i].Rating > best[j].Rating
			}
			return best[i].CreatedAt.After(best[j].CreatedAt)
		})
		ms.Best = &best[0]
	}
	return ms
}

// DataRange returns the earliest and latest months that contain any shot.
func DataRange(shots []model.Shot) (first, last Month, ok bool) {
	for i, s := range shots {
		m := MonthOf(s.CreatedAt)
		if i == 0 {
			first, last = m, m
			ok = true
			continue
		}
		if m.Before(first) {
			first = m
		}
		if last.Before(m) {
			last = m
		}
	}
	return
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [12]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
