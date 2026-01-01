package config

import (
	"encoding/json"
	"os"
)

// Main Config Structure
type AppConfig struct {
	OrangeIntelAPIIntegration IntegrationConfig `json:"OrangeIntel_API_Integration"`
}

type IntegrationConfig struct {
	Version        string                      `json:"version"`
	Environment    EnvironmentConfig           `json:"environment"`
	Auth           AuthConfig                  `json:"auth"`
	Feeds          FeedsConfig                 `json:"feeds"`
	Normalization  NormalizationConfig         `json:"normalization_pipeline"`
	Enrichment     EnrichmentConfig            `json:"enrichment_pipeline"`
	Classification ClassificationConfig        `json:"threat_classification_engine"`
	Scoring        ScoringConfig               `json:"scoring_engine"`
	OutputFormat   OutputFormatConfig          `json:"final_output_format"`
	VirusTotal     VirusTotalIntegrationConfig `json:"virus_total_integration"`
}

type VirusTotalIntegrationConfig struct {
	Enabled                 bool           `json:"enabled"`
	UsageMode               string         `json:"usage_mode"`
	SupportedIndicatorTypes []string       `json:"supported_indicator_types"`
	QueryRules              QueryRules     `json:"query_rules"`
	RateLimiting            RateLimiting   `json:"rate_limiting"`
	ScoringLogic            VTScoringLogic `json:"scoring_logic"`
}

type QueryRules struct {
	OnlyIf       []string `json:"only_if"`
	NeverQueryIf []string `json:"never_query_if"`
}

type RateLimiting struct {
	RequestsPerMinute      int `json:"requests_per_minute"`
	BurstLimit             int `json:"burst_limit"`
	SleepBetweenRequestsMS int `json:"sleep_between_requests_ms"`
}

type VTScoringLogic struct {
	IfMaliciousGt5          ScoreRule `json:"if_malicious_gt_5"`
	IfMaliciousBetween1And5 ScoreRule `json:"if_malicious_between_1_and_5"`
	IfZeroDetections        ScoreRule `json:"if_zero_detections"`
}

type ScoreRule struct {
	Score    int    `json:"score"`
	Severity string `json:"severity"`
}

type EnvironmentConfig struct {
	Mode                 string `json:"mode"`
	OfflineModeSupported bool   `json:"offline_mode_supported"`
	RetryOnFail          bool   `json:"retry_on_fail"`
	MaxRetries           int    `json:"max_retries"`
	TimeoutSeconds       int    `json:"timeout_seconds"`
}

// Authentication Configuration
// Authentication Configuration (Simple API Keys)
type AuthConfig struct {
	MISP             string `json:"misp"`
	TAXII            string `json:"taxii"`
	VirusTotal       string `json:"virus_total"`
	NVD              string `json:"nvd"`
	CISAKEV          string `json:"cisa_kev"`
	AlienVault       string `json:"alienvault"`
	AbuseIPDB        string `json:"abuseipdb"`
	EPSS             string `json:"ep_ss"`
	MITREAttackTAXII string `json:"mitre_attack_taxii"`
}

type AuthDetails struct {
	Type        string `json:"type"`
	HeaderName  string `json:"header_name,omitempty"`
	ValueFormat string `json:"value_format,omitempty"`
	APIKeyEnv   string `json:"api_key_env,omitempty"`
	UsernameEnv string `json:"username_env,omitempty"`
	PasswordEnv string `json:"password_env,omitempty"`
	RateLimit   string `json:"rate_limit,omitempty"`

	// Runtime populated fields
	APIKey   string `json:"-"`
	Username string `json:"-"`
	Password string `json:"-"`
}

// Feeds Configuration
type FeedsConfig struct {
	MISP             FeedDetails `json:"misp"`
	TAXII            FeedDetails `json:"taxii"`
	VirusTotal       FeedDetails `json:"virustotal"`
	AlienVaultOTX    FeedDetails `json:"alienvault_otx"`
	CISAKEV          FeedDetails `json:"cisa_kev"`
	NVDCVE           FeedDetails `json:"nvd_cve"`
	EPSS             FeedDetails `json:"ep_ss"`
	MITREAttackTAXII FeedDetails `json:"mitre_attack_taxii"`
}

type FeedDetails struct {
	Enabled              bool                   `json:"enabled"`
	BaseURLEnv           string                 `json:"base_url_env,omitempty"`
	BaseURL              string                 `json:"base_url,omitempty"`
	URL                  string                 `json:"url,omitempty"` // Some feeds use "url" instead of "base_url"
	Endpoints            map[string]string      `json:"endpoints,omitempty"`
	Collections          []string               `json:"collections,omitempty"`
	APIRoot              string                 `json:"api_root,omitempty"`
	FetchIntervalMinutes int                    `json:"fetch_interval_minutes,omitempty"`
	FetchIntervalHours   int                    `json:"fetch_interval_hours,omitempty"`
	Output               string                 `json:"output,omitempty"`
	RateLimit            string                 `json:"rate_limit,omitempty"`
	QueryParams          map[string]interface{} `json:"query_params,omitempty"`
	APIKeyEnv            string                 `json:"api_key_env,omitempty"` // Specific to OTX in example

	// Runtime populated
	ResolvedURL string `json:"-"`
}

// Pipelines
type NormalizationConfig struct {
	Steps  []string `json:"steps"`
	Output string   `json:"output"`
}

type EnrichmentConfig struct {
	IOCEnrichment   EnrichmentDetails `json:"ioc_enrichment"`
	CVEEnrichment   EnrichmentDetails `json:"cve_enrichment"`
	MITREEnrichment EnrichmentDetails `json:"mitre_enrichment"`
}

type EnrichmentDetails struct {
	From            []string `json:"from,omitempty"`
	FieldsAdded     []string `json:"fields_added,omitempty"`
	MatchFields     []string `json:"match_fields,omitempty"`
	TechniquesAdded string   `json:"techniques_added,omitempty"`
}

type ClassificationConfig struct {
	Logic  []string `json:"logic"`
	Output string   `json:"output"`
}

type ScoringConfig struct {
	Weights   map[string]float64 `json:"weights"`
	Scale     string             `json:"scale"`
	RiskBands map[string]string  `json:"risk_bands"`
}

type OutputFormatConfig struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Class           string   `json:"class"`
	Score           string   `json:"score"`
	Severity        string   `json:"severity"`
	IOCs            string   `json:"iocs"`
	CVEs            string   `json:"cves"`
	MITRE           string   `json:"mitre"`
	Actor           string   `json:"actor"`
	Sources         []string `json:"sources"`
	Summary         string   `json:"summary"`
	Recommendations string   `json:"recommendations"`
	ReportReady     bool     `json:"report_ready"`
}

// LoadConfig reads the JSON file and populates environment variables
func LoadConfig(path string) (*AppConfig, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var cfg AppConfig
	if err := json.NewDecoder(file).Decode(&cfg); err != nil {
		return nil, err
	}

	// Resolve Environment Variables for Auth
	// Resolve Environment Variables for Auth
	// (Simple string keys are now loaded directly from JSON)

	// Resolve Environment Variables for Feeds URLs
	resolveFeedURL(&cfg.OrangeIntelAPIIntegration.Feeds.MISP)
	resolveFeedURL(&cfg.OrangeIntelAPIIntegration.Feeds.TAXII)
	// Some feeds might have API Key in feed config (OTX)
	if cfg.OrangeIntelAPIIntegration.Feeds.AlienVaultOTX.APIKeyEnv != "" {
		// This logic handles if OTX has its own separate env key field here,
		// but typically we'd map it to an Auth struct if we could.
		// Since OTX uses a generic map structure in example, we might need a custom struct or specific handling.
		// For now we just focus on the main ones.
	}

	// Normalize URL vs BaseURL
	finalizeURL(&cfg.OrangeIntelAPIIntegration.Feeds.VirusTotal)
	finalizeURL(&cfg.OrangeIntelAPIIntegration.Feeds.CISAKEV)
	finalizeURL(&cfg.OrangeIntelAPIIntegration.Feeds.NVDCVE)
	finalizeURL(&cfg.OrangeIntelAPIIntegration.Feeds.EPSS)
	finalizeURL(&cfg.OrangeIntelAPIIntegration.Feeds.MITREAttackTAXII)

	return &cfg, nil
}

func resolveAuth(a *AuthDetails) {
	if a.APIKeyEnv != "" {
		a.APIKey = os.Getenv(a.APIKeyEnv)
	}
	if a.UsernameEnv != "" {
		a.Username = os.Getenv(a.UsernameEnv)
	}
	if a.PasswordEnv != "" {
		a.Password = os.Getenv(a.PasswordEnv)
	}
}

func resolveFeedURL(f *FeedDetails) {
	if f.BaseURLEnv != "" {
		f.ResolvedURL = os.Getenv(f.BaseURLEnv)
	} else if f.BaseURL != "" {
		f.ResolvedURL = f.BaseURL
	} else if f.URL != "" {
		f.ResolvedURL = f.URL
	}
}

func finalizeURL(f *FeedDetails) {
	if f.ResolvedURL == "" {
		if f.BaseURL != "" {
			f.ResolvedURL = f.BaseURL
		} else if f.URL != "" {
			f.ResolvedURL = f.URL
		}
	}
}
