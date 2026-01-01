package models

import "time"

// Report represents a generated immutable document
type Report struct {
	ID          string    `json:"id"`
	SourceID    string    `json:"source_id"` // Configured ID of the artifact (TA- or TIA-)
	Type        string    `json:"type"`      // "Advisory" or "Assessment"
	Title       string    `json:"title"`
	GeneratedAt time.Time `json:"generated_at"`
	Analyst     string    `json:"analyst"`
	Blob        []byte    `json:"-"` // Don't return blob in list views
}

type ReportMetadata struct {
	ID          string    `json:"id"`
	SourceID    string    `json:"source_id"`
	Type        string    `json:"type"`
	Title       string    `json:"title"`
	GeneratedAt time.Time `json:"generated_at"`
	Analyst     string    `json:"analyst"`
}
