package supa

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
)

// Snapshot is the data the dashboard renders, plus when it was fetched.
type Snapshot struct {
	Beans     []model.Bean `json:"beans"`
	Shots     []model.Shot `json:"shots"`
	FetchedAt time.Time    `json:"fetched_at"`
	// Stale is true when this snapshot came from the on-disk cache because the
	// live fetch failed (e.g. wifi down). The UI uses it to show a hint.
	Stale bool `json:"-"`
}

// Load fetches beans + shots from Supabase and writes a cache to dir. If the
// network fetch fails, it falls back to the last cached snapshot (marked Stale)
// so the dashboard still shows something useful offline.
func Load(ctx context.Context, c *Client, dir string) (Snapshot, error) {
	beans, bErr := c.Beans(ctx)
	shots, sErr := c.Shots(ctx)
	if bErr == nil && sErr == nil {
		snap := Snapshot{Beans: beans, Shots: shots, FetchedAt: time.Now()}
		_ = save(dir, snap) // best-effort cache write
		return snap, nil
	}

	// Live fetch failed — try the cache.
	if snap, err := loadCache(dir); err == nil {
		snap.Stale = true
		return snap, nil
	}
	// Nothing cached either: surface the original error.
	if bErr != nil {
		return Snapshot{}, bErr
	}
	return Snapshot{}, sErr
}

func cachePath(dir string) string { return filepath.Join(dir, "cache.json") }

func save(dir string, snap Snapshot) error {
	if dir == "" {
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	b, err := json.Marshal(snap)
	if err != nil {
		return err
	}
	tmp := cachePath(dir) + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, cachePath(dir))
}

func loadCache(dir string) (Snapshot, error) {
	var snap Snapshot
	b, err := os.ReadFile(cachePath(dir))
	if err != nil {
		return snap, err
	}
	if err := json.Unmarshal(b, &snap); err != nil {
		return snap, err
	}
	return snap, nil
}
