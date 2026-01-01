package ingest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"orangeintel-backend/config"
)

// MISPSource is an implementation of a MISP feed.
type MISPSource struct {
	FeedConfig config.FeedDetails
	AuthConfig config.AuthDetails
}

func NewMISPSource(feedCfg config.FeedDetails, authCfg config.AuthDetails) *MISPSource {
	return &MISPSource{
		FeedConfig: feedCfg,
		AuthConfig: authCfg,
	}
}

func (m *MISPSource) Name() string {
	return "MISP"
}

func (m *MISPSource) Fetch() ([]FeedItem, error) {
	// If URL is not configured or is "mock", return mock data
	if m.FeedConfig.ResolvedURL == "" || m.FeedConfig.ResolvedURL == "http://misp.local" {
		return m.fetchMock()
	}

	// Real Fetch Logic
	client := &http.Client{Timeout: 30 * time.Second}

	// Construct URL - handle endpoints if defined, otherwise default
	endpoint := "/attributes/restSearch" // default
	if val, ok := m.FeedConfig.Endpoints["attributes"]; ok {
		endpoint = val
	}

	fullURL := fmt.Sprintf("%s%s", m.FeedConfig.ResolvedURL, endpoint)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	// Authentication
	if m.AuthConfig.Type == "header" {
		authVal := m.AuthConfig.APIKey
		if m.AuthConfig.ValueFormat != "" {
			authVal = strings.Replace(m.AuthConfig.ValueFormat, "<API_KEY>", m.AuthConfig.APIKey, -1)
		}
		req.Header.Add(m.AuthConfig.HeaderName, authVal)
	}

	req.Header.Add("Accept", "application/json")
	req.Header.Add("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("[MISP] Error fetching from %s: %v\n", m.FeedConfig.ResolvedURL, err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("MISP API returned status: %s", resp.Status)
	}

	var result struct {
		Response struct {
			Attribute []map[string]interface{} `json:"Attribute"`
		} `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode MISP response: %v", err)
	}

	var items []FeedItem
	for _, attr := range result.Response.Attribute {
		if _, ok := attr["value"]; !ok {
			continue
		}

		data, err := json.Marshal(attr)
		if err != nil {
			continue
		}
		items = append(items, FeedItem{
			Source: m.Name(),
			Data:   string(data),
		})
	}

	fmt.Printf("[MISP] Fetched %d real attributes from %s.\n", len(items), m.FeedConfig.ResolvedURL)
	return items, nil
}

func (m *MISPSource) fetchMock() ([]FeedItem, error) {
	currentTime := time.Now().Format(time.RFC3339)
	// Create some mock events
	events := []map[string]interface{}{
		{
			"id":              "1",
			"info":            "Emotet Activity linked to Ryuk Ransomware",
			"date":            currentTime,
			"threat_level_id": "1",
			"Attribute": []map[string]string{
				{"type": "ip-dst", "value": "192.168.1.50"},
				{"type": "domain", "value": "malicious-site.com"},
				{"type": "comment", "value": "Vectors include Phishing and PowerShell execution."},
				{"type": "comment", "value": "Potentially exploiting CVE-2021-44228 (Log4Shell)."},
			},
		},
		{
			"id":              "2",
			"info":            "Cobalt Strike Beacon - APT28 Campaign",
			"date":            currentTime,
			"threat_level_id": "2",
			"Attribute": []map[string]string{
				{"type": "hash", "value": "d41d8cd98f00b204e9800998ecf8427e"},
				{"type": "comment", "value": "C2 communication observed."},
				{"type": "comment", "value": "Credential Dumping via Mimikatz behaviors."},
			},
		},
	}

	var items []FeedItem
	for _, evt := range events {
		// Flatten attributes for consistency with real fetch normalization
		if attrs, ok := evt["Attribute"].([]map[string]string); ok {
			for _, attr := range attrs {
				// We inject some event metadata into the attribute so context isn't lost
				// (In real fetch we just send the attr, but let's be nicer here)
				attrWithMeta := make(map[string]interface{})
				for k, v := range attr {
					attrWithMeta[k] = v
				}
				attrWithMeta["event_id"] = evt["id"]
				attrWithMeta["event_info"] = evt["info"]

				data, err := json.Marshal(attrWithMeta)
				if err != nil {
					continue
				}
				items = append(items, FeedItem{
					Source: m.Name(),
					Data:   string(data),
				})
			}
		}
	}
	fmt.Printf("[MISP] Mock fetched %d events.\n", len(items))
	return items, nil
}
