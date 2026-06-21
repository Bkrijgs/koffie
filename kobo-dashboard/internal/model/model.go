// Package model holds the domain types, ported 1:1 from the web app's
// lib/types.ts so the dashboard logic stays identical across clients.
package model

import "time"

// Bean is a coffee bean entry.
type Bean struct {
	ID        string
	Name      string
	Roaster   string
	Origin    string
	Blend     string
	RoastDate string // YYYY-MM-DD, may be empty
	Notes     string
	CreatedAt time.Time
}

// Shot is a single espresso log entry.
//
// Rating uses 0 to mean "no rating" (only allowed for dial-in shots), matching
// the web app where rating 0 is excluded from every aggregate via DialIn.
type Shot struct {
	ID                   string
	BeanID               string
	CreatedAt            time.Time
	GrindSize            float64
	DoseGrams            float64
	YieldGrams           float64
	BrewRatio            float64
	ExtractionTimeSecond int
	Notes                string
	NextAdjustment       string
	Rating               float64
	DialIn               bool
	Tags                 []string
}
