package analysis

import "time"

// FinalThreatObject represents the unified output format for the threat core.
type FinalThreatObject struct {
	ThreatID     string           `json:"threat_id"`
	Name         string           `json:"name"`
	Score        int              `json:"score"`
	RiskSeverity string           `json:"risk_severity"` // high, medium, low
	IOCs         []NormalizedIOC  `json:"iocs"`
	CVEs         []EnrichedCVE    `json:"cves"`
	Mitre        []MitreTechnique `json:"mitre"`
	ActorProfile ActorProfile     `json:"actor_profile"`
	Summary      string           `json:"summary"`
	FirstSeen    time.Time        `json:"first_seen"`
	LastSeen     time.Time        `json:"last_seen"`
	SourceFeed   string           `json:"source_feed"`
	ReportReady  bool             `json:"report_ready"`
}

// NormalizedIOC represents a single indicator of compromise.
type NormalizedIOC struct {
	Value string `json:"value"`
	Type  string `json:"type"` // ip, domain, url, hash, email, etc.
}

// EnrichedCVE represents vulnerability data.
type EnrichedCVE struct {
	CVEID       string  `json:"cve_id"`
	CVSSScore   float64 `json:"cvss_score_base"`
	Description string  `json:"description"`
}

// MitreTechnique represents a mapped ATT&CK technique.
type MitreTechnique struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ActorProfile represents attribution data.
type ActorProfile struct {
	Name          string   `json:"name"`
	Origin        string   `json:"origin,omitempty"`
	Motivations   []string `json:"motivations,omitempty"`
	AssociatedTTP []string `json:"associated_ttp,omitempty"`
}
