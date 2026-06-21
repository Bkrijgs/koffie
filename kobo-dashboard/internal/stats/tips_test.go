package stats

import (
	"testing"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
)

func TestGlobalTipsOnboarding(t *testing.T) {
	now := time.Date(2026, 6, 21, 12, 0, 0, 0, time.Local)
	if tips := GlobalTips(nil, nil, now); len(tips) != 1 || tips[0].ID != "no-beans" {
		t.Errorf("no beans -> %v", tips)
	}
	beans := []model.Bean{{ID: "b", Name: "Test"}}
	if tips := GlobalTips(beans, nil, now); len(tips) != 1 || tips[0].ID != "no-shots" {
		t.Errorf("no shots -> %v", tips)
	}
	// Only dial-in shots: still onboarding.
	dialOnly := []model.Shot{{BeanID: "b", DialIn: true, CreatedAt: now}}
	if tips := GlobalTips(beans, dialOnly, now); len(tips) != 1 || tips[0].ID != "no-shots" {
		t.Errorf("dial-in only -> %v", tips)
	}
}

func TestGlobalTipsInactive(t *testing.T) {
	now := time.Date(2026, 6, 21, 12, 0, 0, 0, time.Local)
	beans := []model.Bean{{ID: "b", Name: "Test"}}
	// Last effective shot 8 days ago -> "inactive" tip should appear.
	shots := []model.Shot{
		{BeanID: "b", Rating: 3.5, BrewRatio: 2.1, ExtractionTimeSecond: 28,
			CreatedAt: now.AddDate(0, 0, -8)},
	}
	tips := GlobalTips(beans, shots, now)
	found := false
	for _, tp := range tips {
		if tp.ID == "inactive" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected inactive tip, got %v", tips)
	}
	if len(tips) > 3 {
		t.Errorf("tips capped at 3, got %d", len(tips))
	}
}
