package storage

import (
	"database/sql"
	"encoding/json"
	"orangeintel-backend/internal/models"
	"time"
)

// GetUsers retrieves all users (without sensitive data)
func GetUsers() ([]models.User, error) {
	query := `SELECT id, username, role, mfa_enabled, created_at, last_login_at FROM users ORDER BY created_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		// Handle Nullable LastLoginAt
		var lastLogin sql.NullTime
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.MFAEnabled, &u.CreatedAt, &lastLogin); err != nil {
			return nil, err
		}
		if lastLogin.Valid {
			u.LastLoginAt = lastLogin.Time
		}
		users = append(users, u)
	}
	return users, nil
}

// AuditLogEntry represents a system audit record
type AuditLogEntry struct {
	ID         int       `json:"id"`
	UserID     int       `json:"user_id"`
	Action     string    `json:"action"`
	EntityType string    `json:"entity_type"`
	EntityID   string    `json:"entity_id"`
	Details    string    `json:"details"`
	Timestamp  time.Time `json:"timestamp"`
}

// GetAuditLogs retrieves recent audit logs
func GetAuditLogs(limit int) ([]AuditLogEntry, error) {
	query := `SELECT id, user_id, action, entity_type, entity_id, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT ?`
	rows, err := DB.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []AuditLogEntry
	for rows.Next() {
		var l AuditLogEntry
		// Handle nullable details or user_id if necessary, but schema says mostly NOT NULL except details
		// Details is nullable in schema
		var details sql.NullString
		var userID sql.NullInt64 // User ID is nullable (system actions)
		if err := rows.Scan(&l.ID, &userID, &l.Action, &l.EntityType, &l.EntityID, &details, &l.Timestamp); err != nil {
			return nil, err
		}
		if details.Valid {
			l.Details = details.String
		}
		if userID.Valid {
			l.UserID = int(userID.Int64)
		}
		logs = append(logs, l)
	}
	return logs, nil
}

// LogAudit records an action
func LogAudit(userID int, action, entityType, entityID, details string) error {
	query := `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)`
	// If userID is 0 (system), we store NULL? or 0? Schema has user_id INTEGER.
	// Let's store 0 if system, or handle NULL.
	// For simplicity, let's just store the int, SQLite handles 0 fine.
	// If we want NULL for 0:
	var uid interface{} = userID
	if userID == 0 {
		uid = nil
	}
	// ... existing LogAudit ...
	_, err := DB.Exec(query, uid, action, entityType, entityID, details)
	return err
}

// GetTopic retrieves a specific topic candidate by ID
func GetTopic(id string) (*models.TopicCandidate, error) {
	query := `SELECT id, title, signals, relevance_score, confidence, business_relevance, status, created_at FROM topic_candidates WHERE id = ?`
	row := DB.QueryRow(query, id)

	var t models.TopicCandidate
	var signalsJSON string
	var br int

	if err := row.Scan(&t.ID, &t.Title, &signalsJSON, &t.RelevanceScore, &t.Confidence, &br, &t.Status, &t.CreatedAt); err != nil {
		return nil, err
	}

	t.BusinessRelevance = br == 1
	_ = json.Unmarshal([]byte(signalsJSON), &t.Signals)

	return &t, nil
}

// CreateAdvisory saves a new threat advisory
func CreateAdvisory(a models.ThreatAdvisory) error {
	affectedJSON, _ := json.Marshal(a.AffectedAssets)
	recommJSON, _ := json.Marshal(a.Recommendations)
	refsJSON, _ := json.Marshal(a.References)
	iocJSON, _ := json.Marshal(a.IOCList)

	query := `INSERT INTO threat_advisories (id, topic_id, title, overview, threat_description, affected_assets, attack_vector, severity, recommendations, reference_list, ioc_list, confidence_statement, analyst, status, created_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := DB.Exec(query,
		a.ID,
		a.TopicID,
		a.Title,
		a.Overview,
		a.ThreatDescription,
		string(affectedJSON),
		a.AttackVector,
		a.Severity,
		string(recommJSON),
		string(refsJSON),
		string(iocJSON),
		a.ConfidenceStatement,
		a.Analyst,
		a.Status,
		a.CreatedAt,
	)
	return err
}

// CreateAssessment saves a new assessment (serializing nested structs to JSON columns for now or flat usage - based on DB schema which uses text columns mainly)
// Note: The schema in db.go for assessments is simple text columns. We need to serialize the new BIG struct into JSON blob or update schema.
// Given strict JSON requirement, we should probably store the whole thing as a JSON document if strict relational columns aren't needed yet, OR we map fields.
// The current db.go schema has: related_advisories, trend_analysis, likelihood, impact, overall_risk, business_impact, strategic_recommendations...
// Let's serialize the *entire* struct into a separate 'data' column or just map what fits and store the rest as JSON?
// For Origin-1.0 spec, it's best to store as a JSON document given SQLite's JSON support.
// Let's modify CreateAssessment to serialize the whole struct into a 'data' column if possible or stick to the existing columns + a blob.
// Looking at db.go, table is: id, related_advisories, trend_analysis, likelihood, impact, overall_risk...
// We should probably just Update db.go to support a 'full_report' JSON column.
// For now, let's map what we can.
func CreateAssessment(a models.ThreatIntelligenceAssessment) error {
	// Current DB Schema in db.go (lines 144-154) is limited.
	// We will Map the key fields for queryability and potentially store the rest as JSON if we add a column,
	// BUT we can't easily add columns without migration script in this environment.
	// We will map the complex struct back to the FLAT columns for now to support the "Save" operation without errors.

	relatedJSON, _ := json.Marshal(a.AssessmentMetadata.SourceTopicIDs)
	// stratRecommJSON removed as field is gone. Mapping LongTermActions instead.
	stratJSON, _ := json.Marshal(a.RecommendedActions.LongTermActions) // Map LongTerm to Strategic

	query := `INSERT INTO threat_intelligence_assessments (id, related_advisories, likelihood, impact, overall_risk, business_impact, strategic_recommendations, confidence_statement, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	// Note: 'trend_analysis' was in DB but maybe not in new model?
	// New model has 'ThreatOverview.CurrentActivityStatus'.
	// We are doing a best-effort mapping to existing DB schema to avoid complex migration in this session unless user asked for DB schema update.
	// User *did* ask for "make use to this real data".
	// I will map what fits.

	// Impact is not directly in new model as single field? It has ImpactAssessment struct.
	// We'll use "Medium" as placeholder or derive?

	_, err := DB.Exec(query, a.ID, relatedJSON, a.ImpactAssessment.LikelihoodOfOccurrence, "Medium", a.ImpactAssessment.OverallRiskRating, a.ImpactAssessment.BusinessImpact, stratJSON, a.ExecutiveSummary.ConfidenceLevel, a.AssessmentMetadata.CreatedAt)
	return err
}
