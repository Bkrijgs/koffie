// Package supabase is een minimale PostgREST-client voor de espresso-shots.
//
// Zelfde bron als de KOReader-plugin (espressolog.koplugin/main.lua): de
// Supabase REST API met de anon key. RLS staat alleen lezen toe, dus de key
// mag in de binary — hij kan niets schrijven of andere tabellen zien.
package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// Config wijst naar het Supabase-project. De defaults komen 1-op-1 uit de
// bestaande plugin, zodat het dashboard exact dezelfde data toont.
type Config struct {
	BaseURL    string
	AnonKey    string
	Table      string
	FetchLimit int
}

// DefaultConfig is de live koffie-database (identiek aan het CONFIG-blok in
// espressolog.koplugin/main.lua).
func DefaultConfig() Config {
	return Config{
		BaseURL:    "https://wkbjugwavyebiurhuspa.supabase.co",
		AnonKey:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrYmp1Z3dhdnllYml1cmh1c3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzUyMzIsImV4cCI6MjA5MjkxMTIzMn0.w3K_QN2O3zqNFJa1-IfuA11zRxTYHFOFAmUkDxs8vsA",
		Table:      "shots",
		FetchLimit: 2000,
	}
}

// Bean is de embedded boon (PostgREST `beans(name,roaster)`).
type Bean struct {
	Name    string `json:"name"`
	Roaster string `json:"roaster"`
}

// Shot is één espresso-shot. Veldselectie identiek aan buildUrl() in de plugin.
type Shot struct {
	CreatedAt             string    `json:"created_at"`
	DoseGrams             float64   `json:"dose_grams"`
	YieldGrams            float64   `json:"yield_grams"`
	BrewRatio             float64   `json:"brew_ratio"`
	GrindSize             flexFloat `json:"grind_size"`
	ExtractionTimeSeconds int       `json:"extraction_time_seconds"`
	Rating                float64   `json:"rating"`
	DialIn                bool      `json:"dial_in"`
	Notes                 string    `json:"notes"`
	NextAdjustment        string    `json:"next_adjustment"`
	Tags                  []string  `json:"tags"`
	Beans                 *Bean     `json:"beans"`
}

// BeanName geeft de boonnaam of "?" als er geen embed is.
func (s Shot) BeanName() string {
	if s.Beans != nil && s.Beans.Name != "" {
		return s.Beans.Name
	}
	return "?"
}

// Time parset created_at (RFC3339-achtig) los; faalt stil naar zero-time.
func (s Shot) Time() time.Time {
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05"} {
		if t, err := time.Parse(layout, s.CreatedAt); err == nil {
			return t
		}
	}
	return time.Time{}
}

// flexFloat accepteert zowel een JSON-getal als een string ("5") of null.
// grind_size was ooit tekst; oude rijen kunnen dus nog een string zijn.
type flexFloat float64

func (f *flexFloat) UnmarshalJSON(b []byte) error {
	s := string(b)
	if s == "null" || s == "" {
		*f = 0
		return nil
	}
	if b[0] == '"' {
		var str string
		if err := json.Unmarshal(b, &str); err != nil {
			return err
		}
		v, _ := strconv.ParseFloat(str, 64)
		*f = flexFloat(v)
		return nil
	}
	var v float64
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	*f = flexFloat(v)
	return nil
}

// Float geeft de onderliggende waarde als gewone float64.
func (f flexFloat) Float() float64 { return float64(f) }

// Grind maakt een grind-waarde (handig voor tests / demo-data).
func Grind(v float64) flexFloat { return flexFloat(v) }

// Client haalt shots op.
type Client struct {
	cfg  Config
	http *http.Client
}

// New maakt een client met een redelijke timeout voor de trage Kobo-wifi.
func New(cfg Config) *Client {
	return &Client{
		cfg:  cfg,
		http: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) buildURL() string {
	sel := "created_at,dose_grams,yield_grams,brew_ratio,grind_size," +
		"extraction_time_seconds,rating,dial_in,notes,next_adjustment,tags," +
		"beans(name,roaster)"
	q := url.Values{}
	q.Set("select", sel)
	q.Set("order", "created_at.desc")
	q.Set("limit", strconv.Itoa(c.cfg.FetchLimit))
	return fmt.Sprintf("%s/rest/v1/%s?%s", c.cfg.BaseURL, c.cfg.Table, q.Encode())
}

// FetchShots haalt de shots op, nieuwste eerst.
func (c *Client) FetchShots(ctx context.Context) ([]Shot, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.buildURL(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", c.cfg.AnonKey)
	req.Header.Set("Authorization", "Bearer "+c.cfg.AnonKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("geen verbinding: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	var shots []Shot
	if err := json.Unmarshal(body, &shots); err != nil {
		return nil, fmt.Errorf("kon JSON niet lezen: %w", err)
	}
	return shots, nil
}
