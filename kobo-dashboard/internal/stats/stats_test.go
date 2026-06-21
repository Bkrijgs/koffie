package stats

import (
	"testing"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
)

func mkShot(day int, rating float64, dialIn bool, ratio float64, sec int) model.Shot {
	return model.Shot{
		CreatedAt:            time.Date(2026, 6, day, 9, 0, 0, 0, time.Local),
		Rating:               rating,
		DialIn:               dialIn,
		BrewRatio:            ratio,
		ExtractionTimeSecond: sec,
	}
}

func TestComputeMonthExcludesDialIn(t *testing.T) {
	shots := []model.Shot{
		mkShot(20, 4, false, 2.0, 28),
		mkShot(20, 5, false, 2.5, 30),
		mkShot(19, 0, true, 1.5, 22), // dial-in: excluded from every average
		mkShot(5, 3, false, 2.2, 26),
	}
	ms := ComputeMonth(shots, Month{2026, time.June})

	if ms.Total != 4 || ms.DialInCount != 1 {
		t.Errorf("Total=%d DialIn=%d, want 4/1", ms.Total, ms.DialInCount)
	}
	if len(ms.Effective) != 3 {
		t.Fatalf("Effective=%d, want 3", len(ms.Effective))
	}
	if got := ms.AvgRating; got != (4+5+3)/3.0 {
		t.Errorf("AvgRating=%v, want 4", got)
	}
	if ms.PerDay[19] != 2 { // day 20 -> index 19, two effective shots
		t.Errorf("PerDay[20]=%d, want 2", ms.PerDay[19])
	}
	if ms.PerDay[18] != 0 { // day 19 was dial-in only
		t.Errorf("PerDay[19]=%d, want 0 (dial-in excluded)", ms.PerDay[18])
	}
	if ms.Best == nil || ms.Best.Rating != 5 {
		t.Errorf("Best should be the 5-star shot")
	}
}

func TestDataRangeAndNav(t *testing.T) {
	shots := []model.Shot{
		{CreatedAt: time.Date(2026, 6, 20, 0, 0, 0, 0, time.Local)},
		{CreatedAt: time.Date(2026, 4, 28, 0, 0, 0, 0, time.Local)},
	}
	first, last, ok := DataRange(shots)
	if !ok || first != (Month{2026, time.April}) || last != (Month{2026, time.June}) {
		t.Fatalf("range = %v..%v ok=%v", first, last, ok)
	}
	if got := last.Add(-1); got != (Month{2026, time.May}) {
		t.Errorf("June-1 = %v, want mei", got)
	}
	if got := (Month{2026, time.December}).Add(1); got != (Month{2027, time.January}) {
		t.Errorf("Dec+1 = %v, want jan 2027", got)
	}
}

func TestLabel(t *testing.T) {
	if got := (Month{2026, time.June}).Label(); got != "juni 2026" {
		t.Errorf("label = %q", got)
	}
}
