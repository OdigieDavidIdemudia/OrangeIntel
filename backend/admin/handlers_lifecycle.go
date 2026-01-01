package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"orangeintel-backend/internal/models"
	"orangeintel-backend/storage"
)

// PromoteTopicToAdvisoryHandler handles the promotion of a topic to a draft advisory
func PromoteTopicToAdvisoryHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TopicID string `json:"topic_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	fmt.Printf("[DEBUG] Promote requested for TopicID: %s\n", req.TopicID)

	// 1. Fetch Topic
	topic, err := storage.GetTopic(req.TopicID)
	if err != nil {
		fmt.Printf("[ERROR] GetTopic failed: %v\n", err)
		http.Error(w, "Topic not found: "+err.Error(), http.StatusNotFound)
		return
	}
	// Models mismatch? storage.GetTopic returns *models.TopicCandidate.
	// We need to dereference or use directly.
	// topic is *models.TopicCandidate

	// 2. Create Advisory
	advisory := models.ThreatAdvisory{
		ID:             fmt.Sprintf("TA-%d-%s", time.Now().Year(), req.TopicID), // Simple ID generation
		TopicID:        topic.ID,
		Title:          topic.Title,
		Status:         models.AdvisoryStatusDraft,
		CreatedAt:      time.Now(),
		AffectedAssets: []string{}, // Would populate from context
		IOCList:        []models.IOC{},
		References:     []string{},
	}

	// 3. Inherit Data from Signals
	fmt.Printf("[DEBUG] Processing %d signals for advisory\n", len(topic.Signals))
	for _, signal := range topic.Signals {
		advisory.IOCList = append(advisory.IOCList, models.IOC{
			Type:  signal.Type,
			Value: signal.Value,
		})
	}

	// 4. Save Advisory
	fmt.Printf("[DEBUG] Saving Advisory: %+v\n", advisory.ID)
	if err := storage.CreateAdvisory(advisory); err != nil {
		fmt.Printf("[ERROR] PromoteTopic failed to CreateAdvisory: %v\n", err)
		http.Error(w, "Failed to create advisory: "+err.Error(), http.StatusInternalServerError)
		return
	}
	fmt.Printf("[SUCCESS] Topic promoted to %s\n", advisory.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(advisory)
}

// CreateAssessmentHandler handles creating a new assessment linked to advisories
func CreateAssessmentHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AdvisoryIDs []string `json:"advisory_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	assessment := models.ThreatIntelligenceAssessment{
		ID: fmt.Sprintf("TIA-%s-%d", time.Now().Format("20060102"), time.Now().Unix()),
		AssessmentMetadata: models.AssessmentMetadata{
			AssessmentID:   fmt.Sprintf("TIA-%s-%d", time.Now().Format("20060102"), time.Now().Unix()),
			CreatedAt:      time.Now().Format(time.RFC3339),
			SourceTopicIDs: req.AdvisoryIDs,
			Classification: "INTERNAL",
		},
		ImpactAssessment: models.ImpactAssessment{
			LikelihoodOfOccurrence: "Medium",
			OverallRiskRating:      "Medium",
		},
		ExecutiveSummary: models.ExecutiveSummary{
			ConfidenceLevel: "Medium",
		},
	}

	if err := storage.CreateAssessment(assessment); err != nil {
		http.Error(w, "Failed to create assessment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assessment)
}
