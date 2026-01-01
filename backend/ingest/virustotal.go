package ingest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"orangeintel-backend/config"
)

type VirusTotalSource struct {
	FeedConfig  config.FeedDetails
	AuthConfig  config.AuthDetails
	Integration config.VirusTotalIntegrationConfig
	Client      *http.Client
	LastReqTime time.Time
}

func NewVirusTotalSource(feedCfg config.FeedDetails, authCfg config.AuthDetails, intCfg config.VirusTotalIntegrationConfig) *VirusTotalSource {
	return &VirusTotalSource{
		FeedConfig:  feedCfg,
		AuthConfig:  authCfg,
		Integration: intCfg,
		Client:      &http.Client{Timeout: 10 * time.Second},
	}
}

func (v *VirusTotalSource) Name() string {
	return "VirusTotal"
}

// Fetch for VT mostly doesn't make sense as a "Feed" without VTI.
func (v *VirusTotalSource) Fetch() ([]FeedItem, error) {
	return nil, nil
}

// LookupIP performs an enrichment lookup
func (v *VirusTotalSource) LookupIP(ip string) (map[string]interface{}, error) {
	if v.AuthConfig.APIKey == "" {
		return nil, fmt.Errorf("configuration error: Missing VirusTotal API Key")
	}

	endpoint := v.FeedConfig.Endpoints["ip"]
	// Fallback if not in feed config but user wants it
	if endpoint == "" {
		endpoint = "/ip_addresses/{ip}"
	}
	urlPath := strings.Replace(endpoint, "{ip}", ip, 1)

	return v.makeRequest(urlPath)
}

// LookupHash performs an enrichment lookup for file hashes
func (v *VirusTotalSource) LookupHash(hash string) (map[string]interface{}, error) {
	if v.AuthConfig.APIKey == "" {
		return nil, fmt.Errorf("configuration error: Missing VirusTotal API Key")
	}

	endpoint := "/files/{id}"
	if ep, ok := v.FeedConfig.Endpoints["hash"]; ok {
		endpoint = ep
	}

	urlPath := strings.Replace(endpoint, "{id}", hash, 1)
	return v.makeRequest(urlPath)
}

func (v *VirusTotalSource) makeRequest(path string) (map[string]interface{}, error) {
	// Rate Limiting Logic
	// Requests per minute: 4. So 1 request every 15 seconds.
	// Simple implementation: wait if last request was too recent.
	minInterval := time.Duration(v.Integration.RateLimiting.SleepBetweenRequestsMS) * time.Millisecond
	if minInterval == 0 {
		minInterval = 15 * time.Second // Default fallback
	}

	timeSinceLast := time.Since(v.LastReqTime)
	if timeSinceLast < minInterval {
		waitDuration := minInterval - timeSinceLast
		// Log or just wait? For on-demand, just wait.
		time.Sleep(waitDuration)
	}
	v.LastReqTime = time.Now()

	baseURL := v.FeedConfig.ResolvedURL
	if baseURL == "" {
		baseURL = "https://www.virustotal.com/api/v3"
	}

	fullURL := fmt.Sprintf("%s%s", baseURL, path)
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	// Auth
	key := v.AuthConfig.APIKey
	if key == "" {
		key = os.Getenv("VT_API_KEY") // Last resort fallback
	}

	// DEBUG LOGGING
	if key != "" {
		masked := key
		if len(key) > 4 {
			masked = key[:4] + "..."
		}
		fmt.Printf("[VT DEBUG] Using API Key: %s\n", masked)
	} else {
		fmt.Printf("[VT DEBUG] No API Key found!\n")
	}

	if v.AuthConfig.Type == "header" {
		req.Header.Add(v.AuthConfig.HeaderName, key)
	} else {
		req.Header.Add("x-apikey", key)
	}

	resp, err := v.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("[VT DEBUG] API Error Status: %s\n", resp.Status)
		return nil, fmt.Errorf("VT API error: %s", resp.Status)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// DEBUG LOGGING
	dump, _ := json.Marshal(result)
	fmt.Printf("[VT DEBUG] Raw Response: %s\n", string(dump))

	// Advanced Scoring Logic
	score := 0
	severity := "unknown"

	if data, ok := result["data"].(map[string]interface{}); ok {
		if attrs, ok := data["attributes"].(map[string]interface{}); ok {
			if stats, ok := attrs["last_analysis_stats"].(map[string]interface{}); ok {
				malicious := 0
				if m, ok := stats["malicious"].(float64); ok {
					malicious = int(m)
				}

				// Apply User Rules
				if malicious > 5 {
					score = v.Integration.ScoringLogic.IfMaliciousGt5.Score
					severity = v.Integration.ScoringLogic.IfMaliciousGt5.Severity
					if score == 0 {
						score = 85
						severity = "high"
					} // Fallback
				} else if malicious >= 1 {
					score = v.Integration.ScoringLogic.IfMaliciousBetween1And5.Score
					severity = v.Integration.ScoringLogic.IfMaliciousBetween1And5.Severity
					if score == 0 {
						score = 60
						severity = "medium"
					} // Fallback
				} else {
					score = v.Integration.ScoringLogic.IfZeroDetections.Score
					severity = v.Integration.ScoringLogic.IfZeroDetections.Severity
					if score == 0 {
						score = 20
						severity = "low"
					} // Fallback
				}
			}
		}
	}
	result["score"] = score
	result["severity"] = severity

	return result, nil
}
