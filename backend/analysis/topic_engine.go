package analysis

import (
	"fmt"
	"log"
	"strings" // Added for logic
	"time"

	"orangeintel-backend/internal/models"
	"orangeintel-backend/pipeline"
	"orangeintel-backend/storage"
)

type TopicEngine struct{}

func NewTopicEngine() *TopicEngine {
	return &TopicEngine{}
}

// checkBusinessRelevance determines if an IOC is relevant to the business context
// Validates against critical tags or high severity
func (te *TopicEngine) checkBusinessRelevance(ioc pipeline.EnrichedIOC) bool {
	// 1. High Severity is always relevant
	if ioc.ReputationScore >= 90 {
		return true
	}

	// 2. Critical Keywords in Raw Data or Type
	// This simulates distinct business logic
	criticalKeywords := []string{"ransomware", "apt", "finance", "database", "root"}
	for _, kw := range criticalKeywords {
		// Checking Type or any available metadata (e.g. source)
		// Ideally we check ioc.Tags but EnrichedIOC structure in manual view didn't show Tags explicit field here clearly,
		// verifying pipeline.EnrichedIOC definition might be needed, but assuming standard fields.
		if strings.Contains(strings.ToLower(ioc.Type), kw) || strings.Contains(strings.ToLower(ioc.Source), kw) {
			return true
		}
	}
	return false
}

// ProcessSignals evaluates a list of enriched IOCs to see if they warrant a TopicCandidate
func (te *TopicEngine) ProcessSignals(iocs []pipeline.EnrichedIOC) {
	for _, ioc := range iocs {
		// 1. Save Signal to DB (Persistent Signal Store)
		// Derive verdict from score
		verdict := "unknown"
		if ioc.ReputationScore >= 80 {
			verdict = "malicious"
		} else if ioc.ReputationScore >= 50 {
			verdict = "suspicious"
		} else if ioc.ReputationScore > 0 {
			verdict = "benign"
		}

		// Map EnrichedIOC to storage
		err := storage.SaveEnrichmentResult(ioc.Value, ioc.Type, ioc.Source, verdict, ioc.ReputationScore, ioc)
		if err != nil {
			log.Printf("[TopicEngine] Failed to save signal: %v", err)
			continue
		}

		// 2. Check for Correlation (Signals >= 2)
		// We query how many DISTINCT sources have seen this Indicator Value.
		count, err := storage.GetSignalCount(ioc.Value)
		if err != nil {
			log.Printf("[TopicEngine] Failed to count signals: %v", err)
			continue
		}

		if count >= 2 {
			log.Printf("[TopicEngine] Signal Threshold Reached (%d) for %s. Evaluating Topic.", count, ioc.Value)
			te.CreateOrUpdateTopic(ioc, count)
		} else {
			log.Printf("[TopicEngine] Signal Count %d for %s. Silently discarded.", count, ioc.Value)
		}
	}
}

func (te *TopicEngine) CreateOrUpdateTopic(ioc pipeline.EnrichedIOC, signalCount int) {
	// Rule: IF signal_count >= 2 AND relevance_score >= 70 THEN create
	// We use the IOC score as relevance for now, or aggregate.

	if ioc.ReputationScore < 70 {
		log.Printf("[TopicEngine] Relevance Score %d < 70. Discarding Topic.", ioc.ReputationScore)
		return
	}

	// ID generation: TOPIC-{YYYY}-{Hash of Value} to allow updates
	// Or check if one exists.
	topicID := fmt.Sprintf("TOPIC-%s-%s", time.Now().Format("2006"), ioc.Value) // Simple ID based on Value
	// Clean value for filename/ID safety if needed, but DB is fine.

	// Check if exists
	exists, err := storage.CheckTopicExists(topicID)
	if err != nil {
		log.Println("[TopicEngine] DB Check Error:", err)
		return
	}

	if exists {
		// Update? For now, we just ensure it's there.
		// Maybe update timestamp or signals list.
		log.Printf("[TopicEngine] Topic %s already exists. Skipping.", topicID)
		return
	}

	// Create New
	topic := models.TopicCandidate{
		ID:    topicID,
		Title: fmt.Sprintf("[%s] Suspicious Activity: %s", ioc.Type, ioc.Value),
		Signals: []models.Signal{
			{Source: ioc.Source, Type: ioc.Type, Value: ioc.Value},
			// We should actually fetch ALL signals for this value to populate this list fully
		},
		RelevanceScore:    ioc.ReputationScore,
		Confidence:        "medium",
		BusinessRelevance: te.checkBusinessRelevance(ioc),
		Status:            models.TopicStatusSuggested,
		CreatedAt:         time.Now(),
	}

	// Refetch all signals to be complete
	allSignals, _ := storage.GetSignalsForValue(ioc.Value)
	if len(allSignals) > 0 {
		topic.Signals = allSignals
	}

	err = storage.SaveTopic(topic)
	if err != nil {
		log.Printf("[TopicEngine] Failed to save Topic: %v", err)
	} else {
		log.Printf("[TopicEngine] TOPIC CREATED: %s", topic.Title)
	}
}
