// Package supa is a tiny PostgREST client for the Supabase backend. It mirrors
// the queries the web app's supabaseBackend makes (lib/storage.ts): list beans
// and shots ordered newest-first, mapping the snake_case rows onto the domain
// model.
package supa

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/model"
)

// Allowed taste tags, ported from lib/tags.ts. Anything else is dropped so a bad
// row can't smuggle junk into the UI.
var allowedTags = map[string]bool{
	"fruitig": true, "bessen": true, "citrus": true, "noten": true,
	"chocolade": true, "karamel": true, "bloemig": true, "kruidig": true,
	"zuur": true, "bitter": true, "zoet": true, "vol": true,
}

// Client talks to one Supabase project over PostgREST.
type Client struct {
	baseURL string
	anonKey string
	http    *http.Client
}

// New returns a client. timeout caps each request so a flaky e-ink wifi link
// can't hang the UI forever.
func New(baseURL, anonKey string, timeout time.Duration) *Client {
	return &Client{
		baseURL: baseURL,
		anonKey: anonKey,
		http:    &http.Client{Timeout: timeout},
	}
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", c.anonKey)
	req.Header.Set("Authorization", "Bearer "+c.anonKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("supabase %s: %s: %s", path, resp.Status, body)
	}
	return json.Unmarshal(body, out)
}

// ---- beans -----------------------------------------------------------------

type beanRow struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Roaster   *string `json:"roaster"`
	Origin    *string `json:"origin"`
	Blend     *string `json:"blend"`
	RoastDate *string `json:"roast_date"`
	Notes     *string `json:"notes"`
	CreatedAt string  `json:"created_at"`
}

// Beans fetches all beans, newest-first.
func (c *Client) Beans(ctx context.Context) ([]model.Bean, error) {
	var rows []beanRow
	if err := c.get(ctx, "/rest/v1/beans?select=*&order=created_at.desc", &rows); err != nil {
		return nil, err
	}
	out := make([]model.Bean, 0, len(rows))
	for _, r := range rows {
		out = append(out, beanFromRow(r))
	}
	return out, nil
}

// DecodeBeans parses a PostgREST-shaped beans payload (an array of row objects)
// into the domain model. Exposed so a JSON export can be replayed without a
// network round-trip (preview / fixtures).
func DecodeBeans(data []byte) ([]model.Bean, error) {
	var rows []beanRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	out := make([]model.Bean, 0, len(rows))
	for _, r := range rows {
		out = append(out, beanFromRow(r))
	}
	return out, nil
}

// DecodeShots is DecodeBeans' counterpart for shots.
func DecodeShots(data []byte) ([]model.Shot, error) {
	var rows []shotRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	out := make([]model.Shot, 0, len(rows))
	for _, r := range rows {
		out = append(out, shotFromRow(r))
	}
	return out, nil
}

func beanFromRow(r beanRow) model.Bean {
	return model.Bean{
		ID:        r.ID,
		Name:      r.Name,
		Roaster:   str(r.Roaster),
		Origin:    str(r.Origin),
		Blend:     str(r.Blend),
		RoastDate: str(r.RoastDate),
		Notes:     str(r.Notes),
		CreatedAt: parseTime(r.CreatedAt),
	}
}

// ---- shots -----------------------------------------------------------------

type shotRow struct {
	ID                   string          `json:"id"`
	BeanID               string          `json:"bean_id"`
	GrindSize            json.RawMessage `json:"grind_size"` // number | string in old rows
	DoseGrams            json.Number     `json:"dose_grams"`
	YieldGrams           json.Number     `json:"yield_grams"`
	BrewRatio            json.Number     `json:"brew_ratio"`
	ExtractionTimeSecond int             `json:"extraction_time_seconds"`
	Notes                *string         `json:"notes"`
	NextAdjustment       *string         `json:"next_adjustment"`
	Rating               json.Number     `json:"rating"`
	DialIn               *bool           `json:"dial_in"`
	Tags                 []string        `json:"tags"`
	CreatedAt            string          `json:"created_at"`
}

// Shots fetches all shots, newest-first.
func (c *Client) Shots(ctx context.Context) ([]model.Shot, error) {
	var rows []shotRow
	if err := c.get(ctx, "/rest/v1/shots?select=*&order=created_at.desc", &rows); err != nil {
		return nil, err
	}
	out := make([]model.Shot, 0, len(rows))
	for _, r := range rows {
		out = append(out, shotFromRow(r))
	}
	return out, nil
}

func shotFromRow(r shotRow) model.Shot {
	return model.Shot{
		ID:                   r.ID,
		BeanID:               r.BeanID,
		CreatedAt:            parseTime(r.CreatedAt),
		GrindSize:            grindSize(r.GrindSize),
		DoseGrams:            num(r.DoseGrams),
		YieldGrams:           num(r.YieldGrams),
		BrewRatio:            num(r.BrewRatio),
		ExtractionTimeSecond: r.ExtractionTimeSecond,
		Notes:                str(r.Notes),
		NextAdjustment:       str(r.NextAdjustment),
		Rating:               num(r.Rating),
		DialIn:               r.DialIn != nil && *r.DialIn,
		Tags:                 sanitizeTags(r.Tags),
	}
}

// ---- helpers ---------------------------------------------------------------

func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func num(n json.Number) float64 {
	f, _ := n.Float64()
	return f
}

// grindSize normalizes the historical number|string column to a float, matching
// normalizeShot() in the web app (bad/empty values fall back to 5).
func grindSize(raw json.RawMessage) float64 {
	if len(raw) == 0 {
		return 5
	}
	// Try number first, then quoted string.
	var f float64
	if err := json.Unmarshal(raw, &f); err == nil {
		return f
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			return v
		}
	}
	return 5
}

func sanitizeTags(in []string) []string {
	if len(in) == 0 {
		return nil
	}
	out := make([]string, 0, len(in))
	for _, t := range in {
		if allowedTags[t] {
			out = append(out, t)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func parseTime(s string) time.Time {
	// Supabase returns RFC3339-ish timestamps; tolerate a few shapes.
	for _, layout := range []string{
		time.RFC3339Nano, time.RFC3339,
		"2006-01-02T15:04:05.999999-07:00",
		"2006-01-02 15:04:05.999999-07",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}
