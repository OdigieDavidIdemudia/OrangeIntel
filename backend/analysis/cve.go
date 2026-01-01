package analysis

import (
	"regexp"
)

type CVEEnricher struct{}

func NewCVEEnricher() *CVEEnricher {
	return &CVEEnricher{}
}

func (c *CVEEnricher) Name() string {
	return "CVE Enrichment Service"
}

// FindCVEs extracts CVE IDs and mock-enriches them.
func (c *CVEEnricher) Analyze(content string) []EnrichedCVE {
	results := []EnrichedCVE{}
	cveRegex := regexp.MustCompile(`CVE-\d{4}-\d{4,}`)
	matches := cveRegex.FindAllString(content, -1)

	uniqueMap := make(map[string]bool)
	for _, m := range matches {
		if !uniqueMap[m] {
			uniqueMap[m] = true
			results = append(results, c.Lookup(m))
		}
	}
	return results
}

// Lookup returns mock data for a CVE ID.
// In production, this would query NVD/CISA.
func (c *CVEEnricher) Lookup(id string) EnrichedCVE {
	// Deterministic mock based on ID char sum for stability
	score := 4.0 + float64(len(id)%6)
	desc := "Vulnerability allows remote code execution via buffer overflow."

	if score > 9.0 {
		desc = "CRITICAL: Zero-click remote execution vulnerability in kernel."
	}

	return EnrichedCVE{
		CVEID:       id,
		CVSSScore:   score,
		Description: desc,
	}
}
