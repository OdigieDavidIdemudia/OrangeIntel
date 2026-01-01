package ingest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"orangeintel-backend/config"
)

// --- NVD Source ---
type NVDSource struct {
	FeedConfig config.FeedDetails
	AuthConfig config.AuthDetails
}

func NewNVDSource(feedCfg config.FeedDetails, authCfg config.AuthDetails) *NVDSource {
	return &NVDSource{FeedConfig: feedCfg, AuthConfig: authCfg}
}

func (n *NVDSource) Name() string { return "NVD CVE" }

func (n *NVDSource) Fetch() ([]FeedItem, error) {
	if n.FeedConfig.ResolvedURL == "" {
		return nil, nil // basic mock/skip
	}

	// Real implementation would handle pagination based on query_params: resultsPerPage
	// For now, simpler fetch of one page
	url := fmt.Sprintf("%s?resultsPerPage=20", n.FeedConfig.ResolvedURL)
	if n.FeedConfig.QueryParams != nil {
		if val, ok := n.FeedConfig.QueryParams["resultsPerPage"]; ok {
			url = fmt.Sprintf("%s?resultsPerPage=%v", n.FeedConfig.ResolvedURL, val)
		}
	}

	client := &http.Client{Timeout: 60 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	if n.AuthConfig.APIKey != "" {
		req.Header.Add("apiKey", n.AuthConfig.APIKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("[NVD] Error fetching: %v\n", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NVD API status: %s", resp.Status)
	}

	// Just read body and wrap it
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// If getting full list, maybe treat whole page as one item or split?
	// Usually users want individual CVEs.
	// NVD response: { "vulnerabilities": [ ... ] }

	items := []FeedItem{}
	if vulns, ok := result["vulnerabilities"].([]interface{}); ok {
		for _, v := range vulns {
			data, _ := json.Marshal(v)
			items = append(items, FeedItem{Source: "NVD", Data: string(data)})
		}
	}
	fmt.Printf("[NVD] Fetched %d CVEs.\n", len(items))
	return items, nil
}

// --- CISAKEVSource moved to cisa.go ---

// --- EPSS Source ---
type EPSSSource struct {
	FeedConfig config.FeedDetails
}

func NewEPSSSource(feedCfg config.FeedDetails) *EPSSSource {
	return &EPSSSource{FeedConfig: feedCfg}
}

func (e *EPSSSource) Name() string { return "EPSS" }

func (e *EPSSSource) Fetch() ([]FeedItem, error) {
	// EPSS is usually a huge CSV or API lookup.
	// API: https://api.first.org/data/v1/epss?cve=CVE-2022-xyz
	// Without parameters it might default or error.
	// If we want a feed, we probably want the daily dump or query specific CVEs.
	// The config just says URL.
	// Let's assume for now it's enrichment-only similar to VT, OR we fetch top vulnerabilities.
	// We'll return empty for feed unless user configures parameters.
	return nil, nil
}
