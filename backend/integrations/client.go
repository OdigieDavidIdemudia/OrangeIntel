package integrations

import (
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// ClientConfig holds settings for the HTTP client
type ClientConfig struct {
	TimeoutSeconds  int
	MaxRetries      int
	RateLimitPerMin int // 0 for no limit
}

// Client wraps http.Client with specific integration features
type Client struct {
	httpClient *http.Client
	config     ClientConfig

	// Simple in-memory cache: URL -> Body
	cache       map[string][]byte
	cacheExpiry map[string]time.Time
	cacheMu     sync.RWMutex

	// Rate Limiting
	lastRequest time.Time
	rateMu      sync.Mutex
}

// NewClient creates a new Integration Client
func NewClient(cfg ClientConfig) *Client {
	// Set Defaults
	if cfg.TimeoutSeconds == 0 {
		cfg.TimeoutSeconds = 30
	}
	if cfg.MaxRetries == 0 {
		cfg.MaxRetries = 3
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: time.Duration(cfg.TimeoutSeconds) * time.Second,
		},
		config:      cfg,
		cache:       make(map[string][]byte),
		cacheExpiry: make(map[string]time.Time),
	}
}

// Get performs a GET request with retries, caching, and rate limiting
func (c *Client) Get(url string, headers map[string]string, useCache bool) ([]byte, error) {
	// 1. Check Cache
	if useCache {
		c.cacheMu.RLock()
		data, ok := c.cache[url]
		expiry, expOk := c.cacheExpiry[url]
		c.cacheMu.RUnlock()

		if ok && expOk && time.Now().Before(expiry) {
			return data, nil
		}
	}

	// 2. Rate Limit Enforcement (Simple Token/Time Bucket)
	if c.config.RateLimitPerMin > 0 {
		c.rateMu.Lock()
		minInterval := time.Minute / time.Duration(c.config.RateLimitPerMin)
		timeSince := time.Since(c.lastRequest)
		if timeSince < minInterval {
			sleepTime := minInterval - timeSince
			time.Sleep(sleepTime)
		}
		c.lastRequest = time.Now()
		c.rateMu.Unlock()
	}

	// 3. Retry Loop
	var lastErr error
	for i := 0; i <= c.config.MaxRetries; i++ {
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, err
		}

		// Add Headers
		for k, v := range headers {
			req.Header.Set(k, v)
		}

		resp, err := c.httpClient.Do(req)
		if err == nil {
			defer resp.Body.Close()

			if resp.StatusCode == 200 {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					return nil, err
				}

				// 4. Update Cache (Default TTL 60m)
				if useCache {
					c.cacheMu.Lock()
					c.cache[url] = body
					c.cacheExpiry[url] = time.Now().Add(60 * time.Minute)
					c.cacheMu.Unlock()
				}

				return body, nil
			}

			// Handle non-200 errors that might be retryable (e.g., 5xx, 429)
			// For simplicity, we assume 500/502/503/504 are retryable.
			// 401/403/404 are NOT retryable.
			if resp.StatusCode >= 500 || resp.StatusCode == 429 {
				lastErr = fmt.Errorf("server error: status code %d", resp.StatusCode)
			} else {
				// Fatal error, do not retry
				return nil, fmt.Errorf("fatal error: status code %d", resp.StatusCode)
			}
		} else {
			lastErr = err
		}

		// Exponential Backoff: 1s, 2s, 4s...
		if i < c.config.MaxRetries {
			time.Sleep(time.Duration(1<<i) * time.Second)
		}
	}

	return nil, fmt.Errorf("failed after %d retries: %v", c.config.MaxRetries, lastErr)
}
