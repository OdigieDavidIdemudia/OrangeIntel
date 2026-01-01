package analysis

import (
	"encoding/json"
	"math"
	"time"

	"github.com/google/uuid"
)

type Engine struct {
	IOCAnalyzer   *IOCAnalyzer
	CVEEnricher   *CVEEnricher
	MitreAnalyzer *MitreAnalyzer
	Attributor    *ActorAttributor
}

func NewEngine() *Engine {
	return &Engine{
		IOCAnalyzer:   NewIOCAnalyzer(),
		CVEEnricher:   NewCVEEnricher(),
		MitreAnalyzer: NewMitreAnalyzer(),
		Attributor:    NewActorAttributor(),
	}
}

// Analyze performs the full threat analysis pipeline.
// It returns the score and the JSON-marshaled FinalThreatObject (as the 'findings' string for compatibility).
func (e *Engine) Analyze(content string, source string) (int, string) {
	// 1. IOC Extraction & Normalization
	iocs := e.IOCAnalyzer.Analyze(content)

	// 2. CVE Enrichment
	// We extract CVEs from the content itself for now, though eventually we might match IOCs to CVEs
	cves := e.CVEEnricher.Analyze(content)

	// 3. MITRE Mapping
	techniques := e.MitreAnalyzer.Analyze(content)

	// 4. Attribution
	actor := e.Attributor.Attribute(content, techniques)

	// 5. Scoring
	score := e.calculateScore(len(iocs), cves, techniques, actor)

	// 6. Construct Final Object
	risk := "low"
	if score >= 80 {
		risk = "high"
	} else if score >= 50 {
		risk = "medium"
	}

	threat := FinalThreatObject{
		ThreatID:     uuid.New().String(),
		Name:         generateThreatName(actor, techniques, source),
		Score:        score,
		RiskSeverity: risk,
		IOCs:         iocs,
		CVEs:         cves,
		Mitre:        techniques,
		ActorProfile: actor,
		Summary:      generateSummary(actor, len(iocs), len(cves), score),
		FirstSeen:    time.Now(),
		LastSeen:     time.Now(),
		SourceFeed:   source,
		ReportReady:  true,
	}

	// Marshal to JSON string for storage compatibility
	bytes, _ := json.MarshalIndent(threat, "", "  ")
	return score, string(bytes)
}

func (e *Engine) calculateScore(iocCount int, cves []EnrichedCVE, mitre []MitreTechnique, actor ActorProfile) int {
	// Formula: (IOC * 0.3) + (CVE * 0.35) + (Mitre * 0.25) + (Actor * 0.10)

	// Normalize sub-scores to 0-100 scale

	// IOC Score: Cap at 50 IOCs for max score
	iocScore := float64(iocCount) * 2.0
	if iocScore > 100 {
		iocScore = 100
	}

	// CVE Score: Max CVSS * 10
	maxCvss := 0.0
	for _, c := range cves {
		if c.CVSSScore > maxCvss {
			maxCvss = c.CVSSScore
		}
	}
	cveScore := maxCvss * 10.0

	// Mitre Score: 20 points per technique, cap at 100
	mitreScore := float64(len(mitre)) * 20.0
	if mitreScore > 100 {
		mitreScore = 100
	}

	// Actor Score: 100 if attributed, 0 if unknown
	actorScore := 0.0
	if actor.Name != "Unknown" {
		actorScore = 100.0
	}

	final := (iocScore * 0.3) + (cveScore * 0.35) + (mitreScore * 0.25) + (actorScore * 0.10)
	return int(math.Round(final))
}

func generateThreatName(actor ActorProfile, mitre []MitreTechnique, source string) string {
	name := "Unidentified Threat"
	if actor.Name != "Unknown" {
		name = actor.Name + " Activity"
	} else if len(mitre) > 0 {
		name = mitre[0].Name + " Campaign"
	} else {
		name = "Suspicious Activity (" + source + ")"
	}
	return name
}

func generateSummary(actor ActorProfile, iocCount, cveCount, score int) string {
	return "Automated analysis indicates " + actor.Name + " related indicators."
}
