package pipeline

import (
	"orangeintel-backend/config"
)

type ScoringEngine struct {
	Config config.ScoringConfig
}

func NewScoringEngine(weights map[string]float64, riskBands map[string]string) *ScoringEngine {
	return &ScoringEngine{
		Config: config.ScoringConfig{
			Weights:   weights,
			RiskBands: riskBands,
		},
	}
}

func (s *ScoringEngine) Score(ioc EnrichedIOC) int {
	score := 0.0

	// Default base score
	score += 10.0

	// Weights
	// "ioc_volume": 0.25 (not applicable to single IOC directly without context)
	// "cve_severity": 0.25
	// "kev_flag": 0.15
	// "actor_presence": 0.10
	// "mitre_techniques": 0.15
	// "vt_reputation": 0.10

	// Example Logic
	if ioc.ReputationScore > 0 {
		// Normalize VT score (assuming out of 100?)
		sVal := float64(ioc.ReputationScore)
		if w, ok := s.Config.Weights["vt_reputation"]; ok {
			score += sVal * w
		}
	}

	if ioc.CVEData != nil {
		if w, ok := s.Config.Weights["cve_severity"]; ok {
			score += ioc.CVEData.CVSS * 10 * w // CVSS is 0-10, scale to 100
		}
		if ioc.CVEData.KEV {
			if w, ok := s.Config.Weights["kev_flag"]; ok {
				score += 100.0 * w
			}
		}
	}

	if len(ioc.MitreTechniques) > 0 {
		if w, ok := s.Config.Weights["mitre_techniques"]; ok {
			// Cap at max impact of this weight
			score += 50.0 * w
		}
	}

	if score > 100 {
		score = 100
	}

	return int(score)
}

func (s *ScoringEngine) CalculateSeverity(score int) string {
	// Parse Risk Bands
	// "high": ">=80", "medium": "50-79", "low": "<50"
	// simplified parsing
	if score >= 80 {
		return "high"
	} else if score >= 50 {
		return "medium"
	}
	return "low"
}
