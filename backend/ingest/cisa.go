package ingest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"orangeintel-backend/config"
)

type CISAKEVSource struct {
	URL string
}

func NewCISAKEVSource(feedCfg config.FeedDetails) *CISAKEVSource {
	// Fallback to a working URL if the config one is broken or old
	url := feedCfg.ResolvedURL
	if url == "" || url == "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" {
		url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
	}
	return &CISAKEVSource{
		URL: url,
	}
}

func (c *CISAKEVSource) Name() string { return "CISA KEV" }

func (c *CISAKEVSource) Fetch() ([]FeedItem, error) {
	if c.URL == "" {
		return nil, nil
	}

	resp, err := http.Get(c.URL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CISA API status: %s", resp.Status)
	}

	var result struct {
		Vulnerabilities []interface{} `json:"vulnerabilities"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	items := []FeedItem{}
	for _, v := range result.Vulnerabilities {
		data, _ := json.Marshal(v)
		items = append(items, FeedItem{Source: "CISA-KEV", Data: string(data)})
	}
	fmt.Printf("[CISA] Fetched %d KEVs.\n", len(items))
	return items, nil
}
