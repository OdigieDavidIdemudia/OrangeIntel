package pipeline

import (
	"strings"

	"orangeintel-backend/config"
)

// EnrichedIOC extends NormalizedIOC with extra signals
type EnrichedIOC struct {
	NormalizedIOC
	ReputationScore int // 0-100
	FirstSeen       string
	LastSeen        string
	ASOwner         string
	Geo             string
	Tags            []string
	MitreTechniques []string
	CVEData         *ResultCVE
	Name            string // Explicitly carried over if needed, though NormalizedIOC has it.
	// Actually, embedding NormalizedIOC fields are accessible.
	// But let's be explicit if we modify it.
}

type ResultCVE struct {
	ID          string
	CVSS        float64
	Description string
	KEV         bool
	EPSSScore   float64
}

// Enricher interface for sources like VT, OTX
type Enricher interface {
	Name() string
	LookupIP(ip string) (map[string]interface{}, error)
	LookupHash(hash string) (map[string]interface{}, error)
}

type EnrichmentPipeline struct {
	Config    config.EnrichmentConfig
	Enrichers map[string]Enricher
}

func NewEnrichmentPipeline(cfg config.EnrichmentConfig, enrichers []Enricher) *EnrichmentPipeline {
	eMap := make(map[string]Enricher)
	for _, e := range enrichers {
		eMap[e.Name()] = e
	}
	return &EnrichmentPipeline{
		Config:    cfg,
		Enrichers: eMap,
	}
}

func (p *EnrichmentPipeline) Enrich(ioc NormalizedIOC) EnrichedIOC {
	out := EnrichedIOC{
		NormalizedIOC: ioc,
		Tags:          ioc.Tags,
	}

	// IOC Enrichment (VT, OTX)
	for _, sourceName := range p.Config.IOCEnrichment.From {
		enricher, ok := p.Enrichers[sourceName] // e.g., "VirusTotal"
		// Config uses lowercase "virustotal", so we might need normalization
		// My VT source name is "VirusTotal".
		if !ok {
			// try matching
			for k, v := range p.Enrichers {
				if strings.EqualFold(k, sourceName) {
					enricher = v
					break
				}
			}
		}

		if enricher != nil {
			if ioc.Type == "ip" {
				res, err := enricher.LookupIP(ioc.Value)
				if err == nil && res != nil {
					// Extract fields - heavily dependent on source output
					// Simulating generic extraction
					if val, ok := res["score"].(int); ok {
						out.ReputationScore = val // overwrite? or average? user logic not detailed
					}
				}
			} else if ioc.Type == "md5" || ioc.Type == "sha1" || ioc.Type == "sha256" {
				res, err := enricher.LookupHash(ioc.Value)
				if err == nil && res != nil {
					if val, ok := res["score"].(int); ok {
						out.ReputationScore = val
					}
				}
			}
		}
	}

	// CVE Enrichment logic
	// If the item is marked as "kev" (Known Exploited Vulnerability) in tags, we treat it as critical.
	// This ensures it gets a high score in the Scoring Engine.
	isKEV := false
	for _, t := range ioc.Tags {
		if t == "kev" {
			isKEV = true
			break
		}
	}

	if isKEV || ioc.Type == "cve" {
		out.CVEData = &ResultCVE{
			ID:          ioc.Value,
			KEV:         isKEV,
			CVSS:        9.0, // Default high for KEV/CVE until real NVD lookup added
			Description: "Known Vulnerability (Auto-Scored)",
		}
	}

	return out
}
