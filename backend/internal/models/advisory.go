package models

import (
	"time"
)

type AdvisoryStatus string

const (
	AdvisoryStatusDraft    AdvisoryStatus = "draft"
	AdvisoryStatusApproved AdvisoryStatus = "approved"
	AdvisoryStatusArchived AdvisoryStatus = "archived"
)

type IOC struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type ThreatAdvisory struct {
	ID                  string         `json:"id" db:"id"` // TA-YYYY-NNN
	TopicID             string         `json:"topic_id" db:"topic_id"`
	Title               string         `json:"title" db:"title"`
	Overview            string         `json:"overview" db:"overview"`
	ThreatDescription   string         `json:"threat_description" db:"threat_description"`
	AffectedAssets      []string       `json:"affected_assets" db:"affected_assets"` // JSON
	AttackVector        string         `json:"attack_vector" db:"attack_vector"`
	Severity            string         `json:"severity" db:"severity"`               // Low, Medium, High, Critical
	Recommendations     []string       `json:"recommendations" db:"recommendations"` // JSON
	References          []string       `json:"references" db:"references"`           // JSON
	IOCList             []IOC          `json:"ioc_list" db:"ioc_list"`               // JSON
	ConfidenceStatement string         `json:"confidence_statement" db:"confidence_statement"`
	Analyst             string         `json:"analyst" db:"analyst"`
	Status              AdvisoryStatus `json:"status" db:"status"`
	CreatedAt           time.Time      `json:"created_at" db:"created_at"`
}
