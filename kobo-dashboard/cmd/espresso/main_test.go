package main

import (
	"testing"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/stats"
	"github.com/bkrijgs/koffie/kobo-dashboard/internal/supa"
)

// A cold start (no data yet) must retry soon, not sit for an hour on a blank
// panel; once shots are in it should relax to hourly.
func TestWallInterval(t *testing.T) {
	cold := &app{snap: supa.Snapshot{}}
	if got := cold.wallInterval(); got != 2*time.Minute {
		t.Fatalf("cold start interval: got %v, want 2m", got)
	}
	warm := &app{snap: supa.Snapshot{Shots: []model.Shot{{}}}}
	if got := warm.wallInterval(); got != time.Hour {
		t.Fatalf("with-data interval: got %v, want 1h", got)
	}
}

// pickMonth must always resolve to a real month so the wall loop never starts on
// a garbage/zero month: current month when there's no data, latest month with
// data otherwise, and an explicit YYYY-MM when given.
func TestPickMonth(t *testing.T) {
	if got, want := pickMonth("", nil), stats.MonthOf(time.Now()); got != want {
		t.Fatalf("cold start month: got %v, want %v", got, want)
	}
	if got := pickMonth("2026-03", nil); got.Year != 2026 || got.Month != time.March {
		t.Fatalf("explicit month: got %d-%02d, want 2026-03", got.Year, got.Month)
	}

	mk := func(y int, mo time.Month, d int) model.Shot {
		return model.Shot{CreatedAt: time.Date(y, mo, d, 12, 0, 0, 0, time.Local)}
	}
	shots := []model.Shot{mk(2026, time.July, 5), mk(2026, time.May, 1)}
	if got := pickMonth("", shots); got.Year != 2026 || got.Month != time.July {
		t.Fatalf("latest-with-data month: got %d-%02d, want 2026-07", got.Year, got.Month)
	}
}
