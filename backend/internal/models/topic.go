package models

import (
	"time"
)

type TopicStatus string

const (
	TopicStatusSuggested TopicStatus = "suggested"
	TopicStatusAccepted  TopicStatus = "accepted"
	TopicStatusDiscarded TopicStatus = "discarded"
)

type Signal struct {
	Source  string                 `json:"source"`
	Type    string                 `json:"type"` // cve, ioc, malware, tactic
	Value   string                 `json:"value"`
	Context map[string]interface{} `json:"context,omitempty"` // Rich data (VT results, etc.)
}

type TopicCandidate struct {
	ID                string      `json:"id" db:"id"` // TOPIC-YYYY-NNN
	Title             string      `json:"title" db:"title"`
	Signals           []Signal    `json:"signals" db:"signals"` // Stored as JSON
	RelevanceScore    int         `json:"relevance_score" db:"relevance_score"`
	Confidence        string      `json:"confidence" db:"confidence"` // low, medium, high
	BusinessRelevance bool        `json:"business_relevance" db:"business_relevance"`
	Status            TopicStatus `json:"status" db:"status"`
	CreatedAt         time.Time   `json:"created_at" db:"created_at"`
}

type Topic = TopicCandidate
