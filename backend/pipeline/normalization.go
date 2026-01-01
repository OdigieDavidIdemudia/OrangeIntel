package pipeline

import (
	"encoding/json"
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"

	"orangeintel-backend/config"
)

// Define Normalized Output Structure
type NormalizedIOC struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"` // ip, domain, hash
	Value     string    `json:"value"`
	Source    string    `json:"source"`
	Timestamp time.Time `json:"timestamp"`
	RawData   string    `json:"raw_data"`
	Name      string    `json:"name"` // Added for real threat names (e.g. APT28)
	Tags      []string  `json:"tags"` // Added for threat tags (e.g. ransomware)
}

type NormalizationPipeline struct {
	Config config.NormalizationConfig
}

func NewNormalizationPipeline(cfg []string) *NormalizationPipeline {
	return &NormalizationPipeline{
		Config: config.NormalizationConfig{Steps: cfg},
	}
}

func (p *NormalizationPipeline) Normalize(source string, data string) ([]NormalizedIOC, error) {
	// 1. Collect Raw Data (Implicit)

	// 2. Identify IOCs
	iocs := []NormalizedIOC{}

	// Global generic unmarshal
	var generic map[string]interface{}
	if err := json.Unmarshal([]byte(data), &generic); err == nil {

		// Common fields extraction (Name, labels/tags)
		// STIX often has 'name' and 'labels'
		var commonName string
		var commonTags []string

		if val, ok := generic["name"].(string); ok {
			commonName = val
		}
		if labels, ok := generic["labels"].([]interface{}); ok {
			for _, l := range labels {
				if s, ok := l.(string); ok {
					commonTags = append(commonTags, s)
				}
			}
		}

		// STIX Type Handling
		if typ, hasType := generic["type"].(string); hasType {

			// Handle "malware", "campaign", "intrusion-set" as explicit threats
			if typ == "malware" || typ == "campaign" || typ == "intrusion-set" || typ == "tool" || typ == "attack-pattern" {
				// Use ID as Value if no specific pattern
				val := ""
				if id, ok := generic["id"].(string); ok {
					val = id
				}

				ioc := NormalizedIOC{
					ID:        fmt.Sprintf("%s-%s", source, val),
					Type:      typ, // preserve exact type like 'malware'
					Value:     val,
					Source:    source,
					Timestamp: time.Now(),
					RawData:   data,
					Name:      commonName,
					Tags:      commonTags,
				}
				iocs = append(iocs, ioc)
				return iocs, nil // Return early for these high-level objects
			}

			// ... existing indicator logic ...
			if typ == "indicator" {
				if pattern, hasPattern := generic["pattern"].(string); hasPattern {
					// Parse STIX pattern
					if strings.Contains(pattern, "ipv4-addr") {
						val := extractStixValue(pattern)
						iocs = append(iocs, NormalizedIOC{
							Type: "ip", Value: val, Source: source, Timestamp: time.Now(), RawData: data, Name: commonName, Tags: commonTags,
						})
					} else if strings.Contains(pattern, "domain-name") {
						val := extractStixValue(pattern)
						iocs = append(iocs, NormalizedIOC{
							Type: "domain", Value: val, Source: source, Timestamp: time.Now(), RawData: data, Name: commonName, Tags: commonTags,
						})
					}
				}
			}
		}

		// MISP Attribute Logic
		if val, hasVal := generic["value"].(string); hasVal {
			if typ, hasType := generic["type"].(string); hasType && typ != "indicator" && typ != "malware" && typ != "campaign" && typ != "intrusion-set" {
				// Avoid double matching with STIX types above if keys overlap
				// MISP usually distinct structure
				ioc := NormalizedIOC{
					ID:        fmt.Sprintf("%s-%s", source, val),
					Type:      normalizeType(typ),
					Value:     val,
					Source:    source,
					Timestamp: time.Now(),
					RawData:   data,
					Name:      commonName, // MISP might not have name at attribute level but event info is usually wrapped. Assuming flat attribute for now.
					Tags:      commonTags,
				}
				iocs = append(iocs, ioc)
			}
		}

		// CISA KEV style
		if val, hasID := generic["cveID"].(string); hasID {
			ioc := NormalizedIOC{
				ID:        fmt.Sprintf("%s-%s", source, val),
				Type:      "cve",
				Value:     val,
				Source:    source,
				Timestamp: time.Now(),
				RawData:   data,
				Name:      val, // CVE ID is the name
				Tags:      []string{"vulnerability", "kev"},
			}
			iocs = append(iocs, ioc)
		}
	}

	// 4. Cleanup and Validation
	validIOCs := []NormalizedIOC{}

	// Pre-compile validation regexes (simplified for MVP)
	// In production, these should be package-level vars
	domainRegex := regexp.MustCompile(`^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$`)
	// URL regex is complex, using a simple heuristic for now or rely on net/url if needed, but regex is faster for quick filter
	urlRegex := regexp.MustCompile(`^https?://.*`)

	for _, ioc := range iocs {
		// Trim whitespace
		ioc.Value = strings.TrimSpace(ioc.Value)
		isValid := false

		switch ioc.Type {
		case "ip":
			if net.ParseIP(ioc.Value) != nil {
				isValid = true
			}
		case "domain":
			if domainRegex.MatchString(ioc.Value) {
				isValid = true
			}
		case "url":
			if urlRegex.MatchString(ioc.Value) {
				isValid = true
			}
		case "hash":
			// Simple length check for common hashes
			l := len(ioc.Value)
			if l == 32 || l == 40 || l == 64 {
				isValid = true
			}
		default:
			// Allow others (like cve, campaign IDs)
			isValid = true
		}

		if isValid {
			validIOCs = append(validIOCs, ioc)
		} else {
			// Log rejected data? fmt.Printf("Rejected invalid IOC: %s (%s)\n", ioc.Value, ioc.Type)
		}
	}

	return validIOCs, nil
}

func normalizeType(t string) string {
	switch t {
	case "ip-dst", "ip-src", "ipv4-addr":
		return "ip"
	case "domain", "domain-name":
		return "domain"
	case "url":
		return "url"
	case "md5", "sha1", "sha256", "file-hash":
		return "hash"
	default:
		return "other"
	}
}

func extractStixValue(pattern string) string {
	// [ipv4-addr:value = '198.51.100.1'] -> 198.51.100.1
	// Very quick and dirty extraction
	parts := strings.Split(pattern, "'")
	if len(parts) >= 3 {
		return parts[1]
	}
	return ""
}
