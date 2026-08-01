// Package stats port de reken-logica uit espressolog.koplugin/main.lua
// (computeStats, dayCounts, maand-helpers) naar Go. Zelfde regels:
// gemiddelden negeren dial-in shots, histogram rondt de rating naar 1..5.
package stats

import (
	"time"

	"kobo-dashboard/internal/supabase"
)

// Best is de hoogst beoordeelde (niet-dial-in) shot.
type Best struct {
	Rating float64
	Bean   string
}

// TopBean is de meest geloggde boon.
type TopBean struct {
	Name  string
	Count int
}

// Stats is het samengevatte dashboard-model.
type Stats struct {
	Total     int
	DialIn    int
	Beans     int
	Effective int // niet-dial-in shots mét rating

	AvgRating float64
	AvgRatio  float64
	AvgTime   float64
	HasRating bool
	HasRatio  bool
	HasTime   bool

	Hist          [5]int    // index 0 = 1★ ... index 4 = 5★
	RatingsChrono []float64 // effectieve ratings, oud → nieuw
	Best          *Best
	TopBean       *TopBean
}

func avg(xs []float64) (float64, bool) {
	if len(xs) == 0 {
		return 0, false
	}
	var s float64
	for _, v := range xs {
		s += v
	}
	return s / float64(len(xs)), true
}

// Compute is de Go-port van computeStats().
func Compute(shots []supabase.Shot) Stats {
	var st Stats
	seen := map[string]bool{}
	beanCounts := map[string]int{}
	var rVals, ratioVals, timeVals []float64
	var ratingsDesc []float64 // nieuwste eerst (shots komen desc binnen)

	for _, s := range shots {
		if s.DialIn {
			st.DialIn++
		}
		bn := ""
		if s.Beans != nil {
			bn = s.Beans.Name
		}
		if bn != "" {
			if !seen[bn] {
				seen[bn] = true
				st.Beans++
			}
			beanCounts[bn]++
		}
		if !s.DialIn {
			r := s.Rating
			if r > 0 {
				rVals = append(rVals, r)
				ratingsDesc = append(ratingsDesc, r)
				b := int(r + 0.5)
				if b < 1 {
					b = 1
				} else if b > 5 {
					b = 5
				}
				st.Hist[b-1]++
				if st.Best == nil || r > st.Best.Rating {
					name := bn
					if name == "" {
						name = "?"
					}
					st.Best = &Best{Rating: r, Bean: name}
				}
			}
			if s.BrewRatio > 0 {
				ratioVals = append(ratioVals, s.BrewRatio)
			}
			if s.ExtractionTimeSeconds > 0 {
				timeVals = append(timeVals, float64(s.ExtractionTimeSeconds))
			}
		}
	}

	st.Total = len(shots)
	st.Effective = len(rVals)
	st.AvgRating, st.HasRating = avg(rVals)
	st.AvgRatio, st.HasRatio = avg(ratioVals)
	st.AvgTime, st.HasTime = avg(timeVals)

	// Top-boon.
	topName, topN := "", 0
	for name, c := range beanCounts {
		if c > topN {
			topN, topName = c, name
		}
	}
	if topName != "" {
		st.TopBean = &TopBean{Name: topName, Count: topN}
	}

	// Chronologisch (oud → nieuw) voor de trendlijn.
	st.RatingsChrono = make([]float64, 0, len(ratingsDesc))
	for i := len(ratingsDesc) - 1; i >= 0; i-- {
		st.RatingsChrono = append(st.RatingsChrono, ratingsDesc[i])
	}
	return st
}

// TargetMonth geeft (jaar, maand) `offset` maanden terug vanaf `now`.
func TargetMonth(now time.Time, offset int) (int, time.Month) {
	y, m := now.Year(), int(now.Month())-offset
	for m < 1 {
		m += 12
		y--
	}
	for m > 12 {
		m -= 12
		y++
	}
	return y, time.Month(m)
}

// InMonth zegt of een shot in (y, m) valt.
func InMonth(s supabase.Shot, y int, m time.Month) bool {
	t := s.Time()
	return t.Year() == y && t.Month() == m
}

// FilterMonth geeft alleen de shots in (y, m).
func FilterMonth(shots []supabase.Shot, y int, m time.Month) []supabase.Shot {
	out := make([]supabase.Shot, 0, len(shots))
	for _, s := range shots {
		if InMonth(s, y, m) {
			out = append(out, s)
		}
	}
	return out
}

// DaysInMonth geeft het aantal dagen in (y, m).
func DaysInMonth(y int, m time.Month) int {
	return time.Date(y, m+1, 0, 12, 0, 0, 0, time.UTC).Day()
}

// DayCounts telt shots per dag van de maand. Port van dayCounts().
// Retourneert (counts[1..n] als slice van lengte n, n, max).
func DayCounts(shots []supabase.Shot, y int, m time.Month) (counts []int, n, max int) {
	n = DaysInMonth(y, m)
	counts = make([]int, n)
	for _, s := range shots {
		t := s.Time()
		if t.Year() != y || t.Month() != m {
			continue
		}
		d := t.Day()
		if d >= 1 && d <= n {
			counts[d-1]++
			if counts[d-1] > max {
				max = counts[d-1]
			}
		}
	}
	return counts, n, max
}
