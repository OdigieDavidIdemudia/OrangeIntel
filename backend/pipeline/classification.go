package pipeline

import (
	"strings"

	"orangeintel-backend/config"
)

type ClassificationEngine struct {
	Config config.ClassificationConfig
}

func NewClassificationEngine(logic []string) *ClassificationEngine {
	return &ClassificationEngine{
		Config: config.ClassificationConfig{Logic: logic},
	}
}

// ResultGroup represents the output "threat object"
type ResultGroup struct {
	Name     string
	Type     string
	IOCs     []EnrichedIOC
	Severity string
	Score    int
}

func (c *ClassificationEngine) Classify(iocs []EnrichedIOC) []ResultGroup {
	// "cluster IOCs into threat objects"
	// Very basic grouping: Group by Source or Tags

	groups := make(map[string]*ResultGroup)

	for _, ioc := range iocs {
		key := "Unknown"
		typ := "generic"

		// Use Explicit Name if available (e.g. from STIX)
		if ioc.Name != "" {
			key = ioc.Name
		}

		// Attempt to classify based on tags
		// Merge IOC tags and enriched tags? struct has Tags in EnrichedIOC which inherits NormalizedIOC
		// Let's use ioc.Tags

		isRansomware := false
		isPhishing := false
		isAPT := false

		for _, tag := range ioc.Tags {
			t := strings.ToLower(tag)
			if strings.Contains(t, "ransomware") {
				isRansomware = true
			}
			if strings.Contains(t, "phishing") {
				isPhishing = true
			}
			if strings.Contains(t, "apt") || strings.Contains(t, "group") || strings.Contains(t, "intrusion-set") {
				isAPT = true
			}
		}

		if isRansomware {
			typ = "ransomware"
			if key == "Unknown" {
				key = "Ransomware Activity"
			}
		} else if isPhishing {
			typ = "phishing"
			if key == "Unknown" {
				key = "Phishing Campaign"
			}
		} else if isAPT {
			typ = "apt"
			if key == "Unknown" {
				key = "APT Activity"
			}
		} else if ioc.Type == "malware" {
			typ = "malware"
			if key == "Unknown" {
				key = "Malware Detected"
			}
		} else if ioc.Type == "cve" {
			typ = "cve"
			if key == "Unknown" {
				key = "Vulnerability: " + ioc.Value
			}
		}

		if key == "Unknown" && ioc.Source != "" {
			key = "Unclassified Feed: " + ioc.Source
		}

		if _, exists := groups[key]; !exists {
			groups[key] = &ResultGroup{
				Name: key,
				Type: typ,
				IOCs: []EnrichedIOC{},
			}
		}
		groups[key].IOCs = append(groups[key].IOCs, ioc)
	}

	var results []ResultGroup
	for _, g := range groups {
		results = append(results, *g)
	}

	return results
}
