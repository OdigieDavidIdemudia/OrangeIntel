package integrations

import (
	"encoding/json"
	"fmt"
	"time"

	"orangeintel-backend/internal/models"

	"github.com/google/uuid"
)

// --- CISA KEV Source ---

type CisaKevSource struct{}

const CisaKevURL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

func (s *CisaKevSource) Name() string { return "CISA_KEV" }

func (s *CisaKevSource) Interval() time.Duration {
	return 12 * time.Hour // 720 minutes
}

type cisaResponse struct {
	Vulnerabilities []struct {
		CveID             string `json:"cveID"`
		VendorProject     string `json:"vendorProject"`
		Product           string `json:"product"`
		VulnerabilityName string `json:"vulnerabilityName"`
		ShortDescription  string `json:"shortDescription"`
	} `json:"vulnerabilities"`
}

func (s *CisaKevSource) Fetch(client *Client) ([]models.Topic, error) {
	body, err := client.Get(CisaKevURL, nil, true)
	if err != nil {
		return nil, err
	}

	var resp cisaResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal CISA response: %v", err)
	}

	var topics []models.Topic
	// Limit to last 10 for demo/performance (real app would dedupe against DB)
	// In a real implementation we would check the 'dateAdded' field
	limit := 5
	if len(resp.Vulnerabilities) < limit {
		limit = len(resp.Vulnerabilities)
	}

	for i := 0; i < limit; i++ {
		vuln := resp.Vulnerabilities[i]

		topic := models.Topic{
			ID:                fmt.Sprintf("TOPIC-%s", uuid.New().String()[:8]),
			Title:             fmt.Sprintf("CISA KEV: %s - %s", vuln.CveID, vuln.VulnerabilityName),
			RelevanceScore:    90,
			Confidence:        "high",
			BusinessRelevance: true,
			Status:            models.TopicStatusSuggested,
			CreatedAt:         time.Now(),
			Signals: []models.Signal{
				{
					Source: "CISA_KEV",
					Type:   "cve",
					Value:  vuln.CveID,
					Context: map[string]interface{}{
						"vendor":      vuln.VendorProject,
						"product":     vuln.Product,
						"description": vuln.ShortDescription,
					},
				},
			},
		}
		topics = append(topics, topic)
	}

	return topics, nil
}

// --- NVD Source ---

type NvdSource struct{}

const NvdBaseURL = "https://services.nvd.nist.gov/rest/json/cves/2.0"

func (s *NvdSource) Name() string { return "NVD" }

func (s *NvdSource) Interval() time.Duration {
	return 24 * time.Hour // 1440 minutes
}

type nvdResponse struct {
	Vulnerabilities []struct {
		Cve struct {
			Id           string `json:"id"`
			Published    string `json:"published"`
			Descriptions []struct {
				Lang  string `json:"lang"`
				Value string `json:"value"`
			} `json:"descriptions"`
			Metrics struct {
				CvssMetricV31 []struct {
					CvssData struct {
						BaseScore float64 `json:"baseScore"`
					} `json:"cvssData"`
				} `json:"cvssMetricV31"`
				CvssMetricV2 []struct {
					CvssData struct {
						BaseScore float64 `json:"baseScore"`
					} `json:"cvssData"`
				} `json:"cvssMetricV2"`
			} `json:"metrics"`
		} `json:"cve"`
	} `json:"vulnerabilities"`
}

func (s *NvdSource) Fetch(client *Client) ([]models.Topic, error) {
	// Filter for last 7 days to get RECENT vulnerabilities
	start := time.Now().Add(-7 * 24 * time.Hour).Format("2006-01-02T15:04:05.000")
	end := time.Now().Format("2006-01-02T15:04:05.000")

	// NVD API requires strict time format
	url := fmt.Sprintf("%s?pubStartDate=%s&pubEndDate=%s&resultsPerPage=5", NvdBaseURL, start, end)

	body, err := client.Get(url, nil, true)
	if err != nil {
		return nil, err
	}

	var resp nvdResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal NVD response: %v", err)
	}

	var topics []models.Topic
	for _, item := range resp.Vulnerabilities {
		desc := "No description"
		if len(item.Cve.Descriptions) > 0 {
			desc = item.Cve.Descriptions[0].Value
		}

		score := 0.0
		if len(item.Cve.Metrics.CvssMetricV31) > 0 {
			score = item.Cve.Metrics.CvssMetricV31[0].CvssData.BaseScore
		} else if len(item.Cve.Metrics.CvssMetricV2) > 0 {
			score = item.Cve.Metrics.CvssMetricV2[0].CvssData.BaseScore
		}

		// Skip if score is 0 implies it might be rejected or waiting analysis, but we can keep it with warning or skip
		// For now, keep it but Context context makes it clear

		topic := models.Topic{
			ID:                fmt.Sprintf("TOPIC-%s", item.Cve.Id),
			Title:             fmt.Sprintf("NVD: %s (CVSS %.1f)", item.Cve.Id, score),
			RelevanceScore:    int(score * 10), // Map 0-10 to 0-100
			Confidence:        "medium",
			BusinessRelevance: score > 7.0,
			Status:            models.TopicStatusSuggested,
			CreatedAt:         time.Now(),
			Signals: []models.Signal{
				{
					Source: "NVD",
					Type:   "cve",
					Value:  item.Cve.Id,
					Context: map[string]interface{}{
						"description": desc,
						"cvss":        score,
						"published":   item.Cve.Published,
					},
				},
			},
		}
		topics = append(topics, topic)
	}

	return topics, nil
}

// --- AlienVault OTX Source ---

type AlienVaultSource struct {
	APIKey string
}

const AlienVaultURL = "https://otx.alienvault.com/api/v1/search/pulses?q=modified:7d&limit=5&sort=-modified"

func (s *AlienVaultSource) Name() string { return "AlienVault_OTX" }

func (s *AlienVaultSource) Interval() time.Duration {
	return 6 * time.Hour // 360 minutes
}

type otxResponse struct {
	Results []struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		AuthorName  string `json:"author_name"`
		Created     string `json:"created"`
		Indicators  []struct {
			Indicator string `json:"indicator"`
			Type      string `json:"type"`
		} `json:"indicators"`
	} `json:"results"`
}

func (s *AlienVaultSource) Fetch(client *Client) ([]models.Topic, error) {
	if s.APIKey == "" {
		return nil, nil // Skipping if no key
	}

	headers := map[string]string{
		"X-OTX-API-KEY": s.APIKey,
	}

	body, err := client.Get(AlienVaultURL, headers, true)
	if err != nil {
		return nil, err
	}

	var resp otxResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal OTX response: %v", err)
	}

	var topics []models.Topic
	for _, pulse := range resp.Results {
		topic := models.Topic{
			ID:                fmt.Sprintf("TOPIC-OTX-%s", pulse.ID[:8]),
			Title:             fmt.Sprintf("OTX Pulse: %s", pulse.Name),
			RelevanceScore:    60,
			Confidence:        "medium",
			BusinessRelevance: false,
			Status:            models.TopicStatusSuggested,
			CreatedAt:         time.Now(),
			Signals: []models.Signal{
				{
					Source: "AlienVault_OTX",
					Type:   "pulse",
					Value:  pulse.ID,
					Context: map[string]interface{}{
						"author":      pulse.AuthorName,
						"description": pulse.Description,
					},
				},
			},
		}
		topics = append(topics, topic)
	}

	return topics, nil
}
