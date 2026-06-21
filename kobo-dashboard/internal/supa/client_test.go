package supa

import (
	"encoding/json"
	"testing"
)

// realShotsJSON is a verbatim PostgREST-shaped payload captured from the live
// project, so the parser is tested against the actual column types/shapes.
const realShotsJSON = `[
 {"id":"359eb6c7-115b-4b98-a72a-c622b031ba14","bean_id":"53aa6000-69b5-47e7-903e-caa27cece363","grind_size":4,"dose_grams":18,"yield_grams":48.8,"brew_ratio":2.71,"extraction_time_seconds":30,"notes":null,"next_adjustment":null,"rating":3.5,"dial_in":false,"tags":["noten"],"created_at":"2026-06-20T07:40:41.491108+00:00"},
 {"id":"da723f9d-a476-4f90-b2d0-87cd7b28c138","bean_id":"53aa6000-69b5-47e7-903e-caa27cece363","grind_size":"5.5","dose_grams":17.8,"yield_grams":52.6,"brew_ratio":2.96,"extraction_time_seconds":30,"notes":"vol, noten","next_adjustment":"fijner","rating":0,"dial_in":true,"tags":["noten","bogus"],"created_at":"2026-06-19T07:47:57.603245+00:00"}
]`

func TestShotFromRow(t *testing.T) {
	var rows []shotRow
	if err := json.Unmarshal([]byte(realShotsJSON), &rows); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("want 2 rows, got %d", len(rows))
	}

	a := shotFromRow(rows[0])
	if a.GrindSize != 4 || a.DoseGrams != 18 || a.YieldGrams != 48.8 {
		t.Errorf("row0 numbers off: grind=%v dose=%v yield=%v", a.GrindSize, a.DoseGrams, a.YieldGrams)
	}
	if a.BrewRatio != 2.71 || a.ExtractionTimeSecond != 30 || a.Rating != 3.5 {
		t.Errorf("row0 ratio/time/rating off: %v %v %v", a.BrewRatio, a.ExtractionTimeSecond, a.Rating)
	}
	if a.DialIn {
		t.Errorf("row0 should not be dial-in")
	}
	if len(a.Tags) != 1 || a.Tags[0] != "noten" {
		t.Errorf("row0 tags = %v", a.Tags)
	}
	if a.CreatedAt.IsZero() {
		t.Errorf("row0 created_at failed to parse")
	}

	b := shotFromRow(rows[1])
	if b.GrindSize != 5.5 { // grind_size came through as a quoted string
		t.Errorf("row1 string grind_size = %v, want 5.5", b.GrindSize)
	}
	if !b.DialIn || b.Rating != 0 {
		t.Errorf("row1 dial-in/rating: dialIn=%v rating=%v", b.DialIn, b.Rating)
	}
	if b.Notes != "vol, noten" || b.NextAdjustment != "fijner" {
		t.Errorf("row1 detail fields: notes=%q next=%q", b.Notes, b.NextAdjustment)
	}
	if len(b.Tags) != 1 || b.Tags[0] != "noten" { // "bogus" must be dropped
		t.Errorf("row1 tags = %v, want [noten]", b.Tags)
	}
}

func TestGrindSizeFallback(t *testing.T) {
	if got := grindSize(nil); got != 5 {
		t.Errorf("nil grind = %v, want 5", got)
	}
	if got := grindSize([]byte(`"abc"`)); got != 5 {
		t.Errorf("garbage grind = %v, want 5", got)
	}
}
