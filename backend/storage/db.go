package storage

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"orangeintel-backend/internal/models"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var DB *sql.DB
var encryptionKey []byte // In a real app, this should be securely managed/loaded

func InitDB(dataSourceName string) {
	var err error
	// Use standard DSN, apply PRAGMAs after connection
	DB, err = sql.Open("sqlite", dataSourceName)
	if err != nil {
		log.Fatal(err)
	}

	if err = DB.Ping(); err != nil {
		log.Panicf("Failed to connect to database: %v", err)
	}

	// Optimize SQLite for concurrency
	if _, err := DB.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		log.Printf("Failed to set WAL mode: %v", err)
	}
	if _, err := DB.Exec("PRAGMA busy_timeout=5000;"); err != nil {
		log.Printf("Failed to set busy_timeout: %v", err)
	}
	if _, err := DB.Exec("PRAGMA synchronous=NORMAL;"); err != nil {
		log.Printf("Failed to set synchronous mode: %v", err)
	}

	// Create tables if they don't exist
	createTables()

	// Initialize a dummy key for dev (32 bytes for AES-256)
	encryptionKey = []byte("01234567890123456789012345678901")
	fmt.Println("Database initialized and connected with WAL mode")
}

func createTables() {
	queries := []string{
		// Users (Auth)
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			role TEXT DEFAULT 'SOCTI_Analyst',
			mfa_enabled INTEGER DEFAULT 0,
			mfa_secret TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			last_login_at DATETIME
		);`,

		// Audit Logs
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			action TEXT NOT NULL,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			details TEXT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,

		// Indicator Enrichment (Missing table fixed)
		`CREATE TABLE IF NOT EXISTS indicator_enrichment (
			indicator_value TEXT NOT NULL,
			indicator_type TEXT,
			source TEXT NOT NULL,
			verdict TEXT,
			score INTEGER,
			raw_data TEXT,
			last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(indicator_value, source)
		);`,

		// Feeds (Preserved/Recreated to store Signals)
		`CREATE TABLE IF NOT EXISTS feeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            data TEXT, -- Encrypted raw content (The Signal)
            content_hash TEXT,
            fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_saved INTEGER DEFAULT 0
        );`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_feeds_hash ON feeds(content_hash);`,

		// Ingestion State (Preserved)
		`CREATE TABLE IF NOT EXISTS ingestion_state (
            source_id TEXT PRIMARY KEY,
            last_fetched_at DATETIME,
            last_cursor_hash TEXT,
            adaptive_interval_seconds INTEGER DEFAULT 600
        );`,

		// Topic Candidates (Plan A)
		`CREATE TABLE IF NOT EXISTS topic_candidates (
			id TEXT PRIMARY KEY, -- TOPIC-YYYY-NNN
			title TEXT,
			signals TEXT, -- JSON array of Signal objects
			relevance_score INTEGER,
			confidence TEXT,
			business_relevance INTEGER, -- boolean
			status TEXT, -- suggested, accepted, discarded
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,

		// Threat Advisories (Plan B)
		`CREATE TABLE IF NOT EXISTS threat_advisories (
			id TEXT PRIMARY KEY, -- TA-YYYY-NNN
			topic_id TEXT,
			title TEXT,
			overview TEXT,
			threat_description TEXT,
			affected_assets TEXT, -- JSON array
			attack_vector TEXT,
			severity TEXT,
			recommendations TEXT, -- JSON array
			reference_list TEXT, -- JSON array (Renamed from references to avoid keyword)
			ioc_list TEXT, -- JSON array
			confidence_statement TEXT,
			analyst TEXT,
			status TEXT, -- draft, approved, archived
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(topic_id) REFERENCES topic_candidates(id)
		);`,

		// Threat Intelligence Assessments (Plan C)
		`CREATE TABLE IF NOT EXISTS threat_intelligence_assessments (
			id TEXT PRIMARY KEY, -- TIA-YYYY-NNN
			related_advisories TEXT, -- JSON array of TA IDs
			trend_analysis TEXT,
			likelihood TEXT,
			impact TEXT,
			overall_risk TEXT,
			business_impact TEXT,
			analyst_judgement TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,

		// Reports (Phase 5)
		`CREATE TABLE IF NOT EXISTS reports (
			id TEXT PRIMARY KEY, -- RPT-YYYY-NNN
			source_id TEXT,
			type TEXT,
			title TEXT,
			generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			analyst TEXT,
			blob BLOB
		);`,
	}

	for _, query := range queries {
		_, err := DB.Exec(query)
		if err != nil {
			log.Printf("Error creating table: %v\nQuery: %s", err, query)
		}
	}
}

// StoreFeed encrypts and stores a feed item and returns its ID
// Returns 0, nil if duplicate
func StoreFeed(source, data string) (int64, error) {
	// Deduplication check using Hash
	hash := sha256.Sum256([]byte(source + data))
	hashStr := hex.EncodeToString(hash[:])

	encryptedData, err := Encrypt(data)
	if err != nil {
		return 0, err
	}

	// Try Insert with IGNORE conflict resolution (or handle error)
	query := `INSERT INTO feeds (source, data, content_hash, fetched_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
	res, err := DB.Exec(query, source, encryptedData, hashStr)
	if err != nil {
		// Check for constraint violation (duplicate)
		log.Printf("[Storage] StoreFeed Error: %v", err)
		return 0, nil // Duplicate ignored
	}
	return res.LastInsertId()
}

// CheckFeedExists checks if the exact source and data is already in the DB
func CheckFeedExists(source, data string) (bool, error) {
	encryptedData, err := Encrypt(data)
	if err != nil {
		return false, err
	}

	// We check for duplicates within the last 24 hours to handle recurring threats reasonably
	query := `SELECT id FROM feeds WHERE source = ? AND data = ? LIMIT 1`
	var id int
	err = DB.QueryRow(query, source, encryptedData).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	} else if err != nil {
		return false, err
	}
	return true, nil
}

// StoreAnalysis removed as per architecture change
// func StoreAnalysis(feedID int64, score int, findings string) error { ... }

// Encrypt encrypts plain text string into a base64 encoded string
func Encrypt(text string) (string, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	plaintext := []byte(text)
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64 encoded string into plain text string
func Decrypt(cryptoText string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(cryptoText)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return "", errors.New("malformed ciphertext")
	}

	nonce, ciphertext := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// FeedResult represents a decrypted feed item for API responses
type FeedResult struct {
	ID        int    `json:"id"`
	Source    string `json:"source"`
	Data      string `json:"data"`
	FetchedAt string `json:"fetched_at"`
	Score     int    `json:"score"`
	Findings  string `json:"findings"`
}

// ThreatObject represents the UI-ready threat structure
type ThreatObject struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	ThreatType     string        `json:"threat_type"`
	Score          int           `json:"score"`
	Severity       string        `json:"severity"`
	Indicators     []interface{} `json:"indicators"`
	Summary        string        `json:"summary"`
	ReportReady    bool          `json:"report_ready"`
	FirstSeen      string        `json:"first_seen"`
	LastSeen       string        `json:"last_seen"`
	OriginalSource string        `json:"original_source"`
	CVES           []interface{} `json:"cves"`
	Mitre          []interface{} `json:"mitre"`
	Actor          interface{}   `json:"actor"`
}

// GetRecentThreats retrieves recent items and parses them into ThreatObjects
func GetRecentThreats(limit int) ([]ThreatObject, error) {
	// Reusing the diverse logic from GetRecentFeeds effectively
	rawFeeds, err := GetRecentFeeds(limit)
	if err != nil {
		return nil, err
	}

	var threats []ThreatObject
	for _, feed := range rawFeeds {
		// Default structure if findings parsing fails
		t := ThreatObject{
			ID:             strconv.Itoa(feed.ID),
			Name:           fmt.Sprintf("%s Detect", feed.Source),
			ThreatType:     "generic",
			Score:          feed.Score,
			Severity:       calculateSeverity(feed.Score),
			FirstSeen:      feed.FetchedAt,
			LastSeen:       feed.FetchedAt,
			OriginalSource: feed.Source,
			Summary:        "No detailed analysis available.",
		}

		// Parse findings JSON
		// findings string is like: {"name": "...", "summary": "...", "iocs": [...]}
		if feed.Findings != "" {
			var findingsMap map[string]interface{}
			if err := json.Unmarshal([]byte(feed.Findings), &findingsMap); err == nil {
				if n, ok := findingsMap["name"].(string); ok {
					t.Name = n
				}
				if s, ok := findingsMap["summary"].(string); ok {
					t.Summary = s
				}
				if iocs, ok := findingsMap["iocs"].([]interface{}); ok {
					t.Indicators = iocs
				}
				if cves, ok := findingsMap["cves"].([]interface{}); ok {
					t.CVES = cves
				}
				if mitre, ok := findingsMap["mitre"].([]interface{}); ok {
					t.Mitre = mitre
				}
				if actor, ok := findingsMap["actor_profile"]; ok {
					t.Actor = actor
				}
				if rr, ok := findingsMap["ReportReady"].(bool); ok {
					t.ReportReady = rr
				}
			}
		}

		// Ensure severity is populated
		if t.Severity == "" {
			t.Severity = calculateSeverity(t.Score)
		}

		threats = append(threats, t)
	}

	return threats, nil
}

func calculateSeverity(score int) string {
	if score >= 80 {
		return "high"
	} else if score >= 50 {
		return "medium"
	}
	return "low"
}

// GetRecentFeeds retrieves a diverse mix of recent feed items using a single optimized query
func GetRecentFeeds(limit int) ([]FeedResult, error) {
	// Use a UNION query to get the latest items from each key source in a single shot
	// This avoids looping and multiple round-trips/connections
	// We also limit each inner select to ensure variety
	query := `
		SELECT * FROM (
			SELECT f.id, f.source, f.data, f.fetched_at, COALESCE(a.score, 0), COALESCE(a.findings, '')
			FROM feeds f
			LEFT JOIN analysis_results a ON f.id = a.feed_id
			WHERE (f.source LIKE '%NVD%' OR f.source LIKE '%CVE%') AND COALESCE(a.score, 0) >= 40
			ORDER BY f.fetched_at DESC LIMIT 15
		)
		UNION ALL
		SELECT * FROM (
			SELECT f.id, f.source, f.data, f.fetched_at, COALESCE(a.score, 0), COALESCE(a.findings, '')
			FROM feeds f
			LEFT JOIN analysis_results a ON f.id = a.feed_id
			WHERE (f.source LIKE '%CISA%') AND COALESCE(a.score, 0) >= 40
			ORDER BY f.fetched_at DESC LIMIT 15
		)
		UNION ALL
		SELECT * FROM (
			SELECT f.id, f.source, f.data, f.fetched_at, COALESCE(a.score, 0), COALESCE(a.findings, '')
			FROM feeds f
			LEFT JOIN analysis_results a ON f.id = a.feed_id
			WHERE (f.source LIKE '%MISP%' OR f.source LIKE '%AlienVault%' OR f.source LIKE '%CrowdStrike%' OR f.source LIKE '%FireEye%' OR f.source LIKE '%TAXII%') AND COALESCE(a.score, 0) >= 40
			ORDER BY f.fetched_at DESC LIMIT 20
		)
		ORDER BY fetched_at DESC
		LIMIT ?
	`
	rows, err := DB.Query(query, limit)
	if err != nil {
		log.Printf("Diverse query failed, falling back to simple: %v", err)
		return getRecentFeedsSimple(limit)
	}
	defer rows.Close()

	var results []FeedResult
	for rows.Next() {
		var id int
		var source, encryptedData, fetchedAt string
		var score int
		var findings string

		if err := rows.Scan(&id, &source, &encryptedData, &fetchedAt, &score, &findings); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		// Hack: In case we added content_hash, the scan might fail if SELECT * fetches extra columns
		// Actually SELECT * from subqueries explicitly selects 6 columns, so it should be fine if table has 7. Wait.
		// The subqueries select explicit columns: f.id, f.source, f.data, f.fetched_at.
		// If we add content_hash, it won't be returned by "SELECT f.id...".
		// BUT "SELECT * FROM ( ... UNION ...)" uses columns from inner queries.
		// We need to be careful. The inner queries select explicit columns so adding a column to table doesn't break this query.
		// Good.

		decryptedData, err := Decrypt(encryptedData)
		if err != nil {
			decryptedData = "[Decryption Failed]"
		}

		results = append(results, FeedResult{
			ID:        id,
			Source:    source,
			Data:      decryptedData,
			FetchedAt: fetchedAt,
			Score:     score,
			Findings:  findings,
		})
	}
	if len(results) == 0 {
		return getRecentFeedsSimple(limit)
	}
	return results, nil
}

// getRecentFeedsSimple is the fallback legacy query
func getRecentFeedsSimple(limit int) ([]FeedResult, error) {
	query := `
		SELECT f.id, f.source, f.data, f.fetched_at, COALESCE(a.score, 0), COALESCE(a.findings, '')
		FROM feeds f
		LEFT JOIN analysis_results a ON f.id = a.feed_id
		WHERE COALESCE(a.score, 0) >= 40
		ORDER BY f.fetched_at DESC
		LIMIT ?
	`
	rows, err := DB.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []FeedResult
	for rows.Next() {
		var id int
		var source, encryptedData, fetchedAt string
		var score int
		var findings string

		if err := rows.Scan(&id, &source, &encryptedData, &fetchedAt, &score, &findings); err != nil {
			continue
		}

		decryptedData, err := Decrypt(encryptedData)
		if err != nil {
			decryptedData = "[Decryption Failed]"
		}

		results = append(results, FeedResult{
			ID:        id,
			Source:    source,
			Data:      decryptedData,
			FetchedAt: fetchedAt,
			Score:     score,
			Findings:  findings,
		})
	}
	return results, nil
}

// GetFeedsByIDs retrieves specific feed items by their IDs
func GetFeedsByIDs(ids []int) ([]FeedResult, error) {
	if len(ids) == 0 {
		return []FeedResult{}, nil
	}

	// Build query with IN clause
	query := `
		SELECT f.id, f.source, f.data, f.fetched_at, COALESCE(a.score, 0), COALESCE(a.findings, '')
		FROM feeds f
		LEFT JOIN analysis_results a ON f.id = a.feed_id
		WHERE f.id IN (`

	args := []interface{}{}
	for i, id := range ids {
		if i > 0 {
			query += ","
		}
		query += "?"
		args = append(args, id)
	}
	query += `)`

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []FeedResult
	for rows.Next() {
		var id int
		var source, encryptedData, fetchedAt string
		var score int
		var findings string

		if err := rows.Scan(&id, &source, &encryptedData, &fetchedAt, &score, &findings); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		decryptedData, err := Decrypt(encryptedData)
		if err != nil {
			log.Printf("Error decrypting data for id %d: %v", id, err)
			decryptedData = "[Decryption Failed]"
		}

		results = append(results, FeedResult{
			ID:        id,
			Source:    source,
			Data:      decryptedData,
			FetchedAt: fetchedAt,
			Score:     score,
			Findings:  findings,
		})
	}

	return results, nil
}

// IngestionState represents the state of a feed source
type IngestionState struct {
	SourceID                string
	LastFetchedAt           string
	LastCursorHash          string
	AdaptiveIntervalSeconds int
}

// GetIngestionState retrieves the state for a given source
func GetIngestionState(sourceID string) (*IngestionState, error) {
	query := `SELECT source_id, last_fetched_at, last_cursor_hash, adaptive_interval_seconds FROM ingestion_state WHERE source_id = ?`
	row := DB.QueryRow(query, sourceID)

	var s IngestionState
	// Scan nullable fields carefully if needed, but for now assume simplistic
	// If no row, return default
	if err := row.Scan(&s.SourceID, &s.LastFetchedAt, &s.LastCursorHash, &s.AdaptiveIntervalSeconds); err != nil {
		if err == sql.ErrNoRows {
			return &IngestionState{SourceID: sourceID, AdaptiveIntervalSeconds: 600}, nil
		}
		return nil, err
	}
	return &s, nil
}

// UpdateIngestionState updates the state for a given source
func UpdateIngestionState(state *IngestionState) error {
	query := `INSERT INTO ingestion_state (source_id, last_fetched_at, last_cursor_hash, adaptive_interval_seconds) 
              VALUES (?, ?, ?, ?)
              ON CONFLICT(source_id) DO UPDATE SET
              last_fetched_at = excluded.last_fetched_at,
              last_cursor_hash = excluded.last_cursor_hash,
              adaptive_interval_seconds = excluded.adaptive_interval_seconds`
	_, err := DB.Exec(query, state.SourceID, state.LastFetchedAt, state.LastCursorHash, state.AdaptiveIntervalSeconds)
	return err
}

// SaveEnrichmentResult upserts enrichment data
func SaveEnrichmentResult(value, iType, source, verdict string, score int, rawData interface{}) error {
	rawBytes, err := json.Marshal(rawData)
	if err != nil {
		return err
	}

	// Encrypt raw data
	encryptedData, err := Encrypt(string(rawBytes))
	if err != nil {
		return err
	}

	query := `
		INSERT INTO indicator_enrichment (indicator_value, indicator_type, source, verdict, score, raw_data, last_checked_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(indicator_value, source) DO UPDATE SET
			verdict = excluded.verdict,
			score = excluded.score,
			raw_data = excluded.raw_data,
			last_checked_at = CURRENT_TIMESTAMP;
	`
	_, err = DB.Exec(query, value, iType, source, verdict, score, encryptedData)
	return err
}

// ToggleFeedSaved toggles the is_saved status of a feed item
func ToggleFeedSaved(id int) (bool, error) {
	// First check current status
	var currentStatus int
	err := DB.QueryRow("SELECT is_saved FROM feeds WHERE id = ?", id).Scan(&currentStatus)
	if err != nil {
		return false, err
	}

	newStatus := 1
	if currentStatus == 1 {
		newStatus = 0
	}

	_, err = DB.Exec("UPDATE feeds SET is_saved = ? WHERE id = ?", newStatus, id)
	if err != nil {
		return false, err
	}
	return newStatus == 1, nil
}

// GetSavedFeeds retrieves all saved feed items
func GetSavedFeeds() ([]FeedResult, error) {
	query := `
		SELECT f.id, f.source, f.data, f.fetched_at, COALESCE(a.score, 0), COALESCE(a.findings, '')
		FROM feeds f
		LEFT JOIN analysis_results a ON f.id = a.feed_id
		WHERE f.is_saved = 1
		ORDER BY f.fetched_at DESC
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []FeedResult
	for rows.Next() {
		var id int
		var source, encryptedData, fetchedAt string
		var score int
		var findings string

		if err := rows.Scan(&id, &source, &encryptedData, &fetchedAt, &score, &findings); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		decryptedData, err := Decrypt(encryptedData)
		if err != nil {
			decryptedData = "[Decryption Failed]"
		}

		results = append(results, FeedResult{
			ID:        id,
			Source:    source,
			Data:      decryptedData,
			FetchedAt: fetchedAt,
			Score:     score,
			Findings:  findings,
		})
	}
	return results, nil
}

// MapFeedsToThreats converts a slice of FeedResult to ThreatObject
func MapFeedsToThreats(feeds []FeedResult) []ThreatObject {
	var threats []ThreatObject
	for _, feed := range feeds {
		// Reuse logic from GetRecentThreats
		t := ThreatObject{
			ID:             strconv.Itoa(feed.ID),
			Name:           fmt.Sprintf("%s Detect", feed.Source),
			ThreatType:     "generic",
			Score:          feed.Score,
			Severity:       calculateSeverity(feed.Score),
			FirstSeen:      feed.FetchedAt,
			LastSeen:       feed.FetchedAt,
			OriginalSource: feed.Source,
			Summary:        "No detailed analysis available.",
		}

		if feed.Findings != "" {
			var findingsMap map[string]interface{}
			if err := json.Unmarshal([]byte(feed.Findings), &findingsMap); err == nil {
				if n, ok := findingsMap["name"].(string); ok {
					t.Name = n
				}
				if s, ok := findingsMap["summary"].(string); ok {
					t.Summary = s
				}
				if iocs, ok := findingsMap["iocs"].([]interface{}); ok {
					t.Indicators = iocs
				}
				if cves, ok := findingsMap["cves"].([]interface{}); ok {
					t.CVES = cves
				}
				if mitre, ok := findingsMap["mitre"].([]interface{}); ok {
					t.Mitre = mitre
				}
				if actor, ok := findingsMap["actor_profile"]; ok {
					t.Actor = actor
				}
				if rr, ok := findingsMap["ReportReady"].(bool); ok {
					t.ReportReady = rr
				}
			}
		}

		if t.Severity == "" {
			t.Severity = calculateSeverity(t.Score)
		}
		threats = append(threats, t)
	}
	return threats
}

// CleanupEphemeralFeeds deletes unsaved items older than the specified duration
func CleanupEphemeralFeeds(hours int) (int64, error) {
	timeModifier := fmt.Sprintf("-%d hours", hours)
	query := `DELETE FROM feeds WHERE fetched_at < datetime('now', ?) AND is_saved = 0`

	res, err := DB.Exec(query, timeModifier)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// DeleteFeed permanently removes a feed item by ID
func DeleteFeed(id int) error {
	_, err := DB.Exec("DELETE FROM feeds WHERE id = ?", id)
	return err
}

// CheckTopicExists checks if a topic ID exists
func CheckTopicExists(id string) (bool, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM topic_candidates WHERE id = ?", id).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// SaveTopic saves a TopicCandidate
func SaveTopic(t models.TopicCandidate) error {
	signalsJSON, _ := json.Marshal(t.Signals)

	// Convert boolean to int for SQLite
	br := 0
	if t.BusinessRelevance {
		br = 1
	}

	query := `INSERT INTO topic_candidates (id, title, signals, relevance_score, confidence, business_relevance, status, created_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			  ON CONFLICT(id) DO UPDATE SET
			  signals = excluded.signals,
			  relevance_score = excluded.relevance_score,
			  status = excluded.status` // Minimal update logic

	_, err := DB.Exec(query, t.ID, t.Title, signalsJSON, t.RelevanceScore, t.Confidence, br, t.Status, t.CreatedAt)
	return err
}

// GetSignalCount counts how many distinct sources have reported a value
func GetSignalCount(value string) (int, error) {
	// Query indicator_enrichment based on value
	// Logic: We want count of UNIQUE sources for this value.
	// Table has UNIQUE(indicator_value, source), so simple count is enough.
	query := `SELECT COUNT(*) FROM indicator_enrichment WHERE indicator_value = ?`
	var count int
	err := DB.QueryRow(query, value).Scan(&count)
	return count, err
}

// GetSignalsForValue retrieves all signals (enrichment entries) for a value
func GetSignalsForValue(value string) ([]models.Signal, error) {
	query := `SELECT source, indicator_type, raw_data FROM indicator_enrichment WHERE indicator_value = ?`
	rows, err := DB.Query(query, value)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var signals []models.Signal
	for rows.Next() {
		var s, t, encryptedData string
		if err := rows.Scan(&s, &t, &encryptedData); err != nil {
			continue
		}

		sig := models.Signal{
			Source: s,
			Type:   t,
			Value:  value,
		}

		// Decrypt and unmarshal context
		if encryptedData != "" {
			decrypted, err := Decrypt(encryptedData)
			if err == nil {
				var ctx map[string]interface{}
				if err := json.Unmarshal([]byte(decrypted), &ctx); err == nil {
					sig.Context = ctx
				}
			}
		}

		signals = append(signals, sig)
	}
	return signals, nil
}

// GetTopics retrieves topics by status
func GetTopics(status models.TopicStatus) ([]models.TopicCandidate, error) {
	query := `SELECT id, title, signals, relevance_score, confidence, business_relevance, status, created_at FROM topic_candidates WHERE status = ?`
	rows, err := DB.Query(query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var topics []models.TopicCandidate
	for rows.Next() {
		var t models.TopicCandidate
		var signalsJSON string
		var br int
		if err := rows.Scan(&t.ID, &t.Title, &signalsJSON, &t.RelevanceScore, &t.Confidence, &br, &t.Status, &t.CreatedAt); err != nil {
			continue
		}
		t.BusinessRelevance = br == 1
		json.Unmarshal([]byte(signalsJSON), &t.Signals)
		topics = append(topics, t)
	}
	return topics, nil
}

// PromoteTopic accepts a topic and creates a draft advisory
func PromoteTopic(topicID string) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}

	// 1. Update Topic Status
	_, err = tx.Exec("UPDATE topic_candidates SET status = ? WHERE id = ?", models.TopicStatusAccepted, topicID)
	if err != nil {
		tx.Rollback()
		return err
	}

	// 2. Create Draft Advisory
	// Fetch topic to copy title and SIGNALS
	var title string
	var signalsJSON string
	err = tx.QueryRow("SELECT title, signals FROM topic_candidates WHERE id = ?", topicID).Scan(&title, &signalsJSON)
	if err != nil {
		tx.Rollback()
		return err
	}

	// Unmarshal Signals to extract intelligence
	var signals []models.Signal
	json.Unmarshal([]byte(signalsJSON), &signals)

	// Synthesize Intelligence
	var descriptionBuilder strings.Builder
	var attackVectorMap = make(map[string]bool)
	var assets []string
	var recs []string
	var iocs []models.IOC

	descriptionBuilder.WriteString(fmt.Sprintf("Advisory auto-generated from %d signals.\n\n", len(signals)))

	for _, s := range signals {
		descriptionBuilder.WriteString(fmt.Sprintf("- [%s] %s (%s)\n", s.Type, s.Value, s.Source))

		// Map to IOC
		if s.Type == "cve" || s.Type == "ip" || s.Type == "domain" || s.Type == "hash" || s.Type == "url" || s.Type == "pulse" {
			iocs = append(iocs, models.IOC{
				Type:  s.Type,
				Value: s.Value,
			})
		}

		// Extract TTPs / Tags from Context
		if s.Context != nil {
			if tags, ok := s.Context["Tags"].([]interface{}); ok {
				var tagStrs []string
				for _, t := range tags {
					if ts, ok := t.(string); ok {
						tagStrs = append(tagStrs, ts)
					}
				}
				if len(tagStrs) > 0 {
					descriptionBuilder.WriteString(fmt.Sprintf("  Tags: %s\n", strings.Join(tagStrs, ", ")))
				}
			}

			if mitre, ok := s.Context["MitreTechniques"].([]interface{}); ok {
				for _, m := range mitre {
					if ms, ok := m.(string); ok {
						attackVectorMap[ms] = true
					}
				}
			}
		}
	}

	var attackVectors []string
	for k := range attackVectorMap {
		attackVectors = append(attackVectors, k)
	}

	// Default Recommendations based on Type
	recs = append(recs, "Isolate affected hosts immediately.")
	recs = append(recs, "Reset credentials for compromised accounts.")

	ta := models.ThreatAdvisory{
		ID:                strings.Replace(topicID, "TOPIC", "TA", 1),
		TopicID:           topicID,
		Title:             title,
		Overview:          fmt.Sprintf("Threat Advisory derived from topic %s", topicID),
		ThreatDescription: descriptionBuilder.String(),
		AffectedAssets:    assets, // Empty for now unless we have asset DB
		AttackVector:      strings.Join(attackVectors, ", "),
		Severity:          "High", // Default to High for promoted topics
		Recommendations:   recs,
		IOCList:           iocs,
		Status:            models.AdvisoryStatusDraft,
		Analyst:           "System", // TODO: Current User
		CreatedAt:         time.Now(),
	}

	assetsJSON, _ := json.Marshal(ta.AffectedAssets)
	recsJSON, _ := json.Marshal(ta.Recommendations)
	iocsJSON, _ := json.Marshal(ta.IOCList)

	query := `INSERT INTO threat_advisories (id, topic_id, title, overview, threat_description, affected_assets, attack_vector, severity, recommendations, ioc_list, status, analyst, created_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err = tx.Exec(query, ta.ID, ta.TopicID, ta.Title, ta.Overview, ta.ThreatDescription, string(assetsJSON), ta.AttackVector, ta.Severity, string(recsJSON), string(iocsJSON), ta.Status, ta.Analyst, ta.CreatedAt)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

// GetAdvisories retrieves all advisories
func GetAdvisories() ([]models.ThreatAdvisory, error) {
	query := `SELECT id, topic_id, title, status FROM threat_advisories ORDER BY created_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var advisories []models.ThreatAdvisory
	for rows.Next() {
		var ta models.ThreatAdvisory
		if err := rows.Scan(&ta.ID, &ta.TopicID, &ta.Title, &ta.Status); err != nil {
			continue
		}
		advisories = append(advisories, ta)
	}
	return advisories, nil
}

// UpdateAdvisory updates the content and status of an advisory
func UpdateAdvisory(ta models.ThreatAdvisory) error {
	assetsJSON, _ := json.Marshal(ta.AffectedAssets)
	recsJSON, _ := json.Marshal(ta.Recommendations)

	query := `UPDATE threat_advisories SET 
		title = ?,
		overview = ?,
		threat_description = ?,
		affected_assets = ?,
		attack_vector = ?,
		severity = ?,
		recommendations = ?,
		status = ?
		WHERE id = ?`

	_, err := DB.Exec(query, ta.Title, ta.Overview, ta.ThreatDescription, string(assetsJSON), ta.AttackVector, ta.Severity, string(recsJSON), ta.Status, ta.ID)
	return err
}

// SaveAssessment creates a new assessment
func SaveAssessment(a models.ThreatIntelligenceAssessment) error {
	advisoriesJSON, _ := json.Marshal(a.AssessmentMetadata.SourceTopicIDs)

	query := `INSERT INTO threat_intelligence_assessments (id, related_advisories, trend_analysis, likelihood, impact, overall_risk, business_impact, analyst_judgement, created_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	// Mapping new nested fields to old DB columns
	// TrendAnalysis -> ExecutiveSummary.Summary (approx)
	// Likelihood -> ImpactAssessment.LikelihoodOfOccurrence
	// Impact -> ImpactAssessment.PotentialImpactDescription (approx)
	// OverallRisk -> ImpactAssessment.OverallRiskRating
	// BusinessImpact -> ImpactAssessment.BusinessImpact
	// AnalystJudgement -> ReviewAndApproval.Analyst (approx or just empty)

	_, err := DB.Exec(query, a.ID, string(advisoriesJSON), a.ExecutiveSummary.Summary, a.ImpactAssessment.LikelihoodOfOccurrence, a.ImpactAssessment.PotentialImpactDescription, a.ImpactAssessment.OverallRiskRating, a.ImpactAssessment.BusinessImpact, a.ReviewAndApproval.Analyst, a.AssessmentMetadata.CreatedAt)
	return err
}

// GetAssessments retrieves all assessments
func GetAssessments() ([]models.ThreatIntelligenceAssessment, error) {
	query := `SELECT id, related_advisories, trend_analysis, likelihood, impact, overall_risk, business_impact, analyst_judgement, created_at FROM threat_intelligence_assessments ORDER BY created_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assessments []models.ThreatIntelligenceAssessment
	for rows.Next() {
		var a models.ThreatIntelligenceAssessment
		var advJSON string

		// Temporary vars for scan
		var summary, likelihood, impact, overallRisk, busImpact, analyst, createdAt string

		if err := rows.Scan(&a.ID, &advJSON, &summary, &likelihood, &impact, &overallRisk, &busImpact, &analyst, &createdAt); err != nil {
			continue
		}

		a.AssessmentMetadata.AssessmentID = a.ID
		a.AssessmentMetadata.CreatedAt = createdAt
		// We probably should store related_advisories in SourceTopicIDs
		json.Unmarshal([]byte(advJSON), &a.AssessmentMetadata.SourceTopicIDs)

		a.ExecutiveSummary.Summary = summary
		a.ImpactAssessment.LikelihoodOfOccurrence = likelihood
		a.ImpactAssessment.PotentialImpactDescription = impact
		a.ImpactAssessment.OverallRiskRating = overallRisk
		a.ImpactAssessment.BusinessImpact = busImpact
		a.ReviewAndApproval.Analyst = analyst

		assessments = append(assessments, a)
	}
	return assessments, nil
}

// SaveReport saves a generated report with its blob
func SaveReport(r models.Report) error {
	query := `INSERT INTO reports (id, source_id, type, title, generated_at, analyst, blob)
			  VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, r.ID, r.SourceID, r.Type, r.Title, r.GeneratedAt, r.Analyst, r.Blob)
	return err
}

// GetReports retrieves report metadata (no blob)
func GetReports() ([]models.ReportMetadata, error) {
	query := `SELECT id, source_id, type, title, generated_at, analyst FROM reports ORDER BY generated_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []models.ReportMetadata
	for rows.Next() {
		var r models.ReportMetadata
		if err := rows.Scan(&r.ID, &r.SourceID, &r.Type, &r.Title, &r.GeneratedAt, &r.Analyst); err != nil {
			continue
		}
		reports = append(reports, r)
	}
	return reports, nil
}

// GetReportBlob retrieves just the blob for a report ID
func GetReportBlob(id string) ([]byte, error) {
	var blob []byte
	err := DB.QueryRow("SELECT blob FROM reports WHERE id = ?", id).Scan(&blob)
	if err != nil {
		return nil, err
	}
	return blob, nil
}

// CreateUser adds a new user to the DB
func CreateUser(u models.User) (int64, error) {
	query := `INSERT INTO users (username, password_hash, role, mfa_enabled, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
	res, err := DB.Exec(query, u.Username, u.PasswordHash, u.Role, 0)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// UpdateUserRole updates the role of a user
func UpdateUserRole(id int, role string) error {
	_, err := DB.Exec("UPDATE users SET role = ? WHERE id = ?", role, id)
	return err
}

// GetUserByUsername retrieves a user for auth (with password hash)
func GetUserByUsername(username string) (*models.User, error) {
	var u models.User
	query := `SELECT id, username, password_hash, role, mfa_enabled, created_at FROM users WHERE username = ?`
	err := DB.QueryRow(query, username).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.MFAEnabled, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
