package models

type TIARisk string

const (
	RiskLow    TIARisk = "Low"
	RiskMedium TIARisk = "Medium"
	RiskHigh   TIARisk = "High"
)

type ThreatIntelligenceAssessment struct {
	ID                        string                    `json:"id" db:"id"`
	AssessmentMetadata        AssessmentMetadata        `json:"assessment_metadata"`
	ExecutiveSummary          ExecutiveSummary          `json:"executive_summary"`
	ThreatOverview            ThreatOverview            `json:"threat_overview"`
	TechnicalDetails          TechnicalDetails          `json:"technical_details"`
	IndicatorsOfCompromise    IndicatorsOfCompromise    `json:"indicators_of_compromise"`
	ThreatActorAnalysis       ThreatActorAnalysis       `json:"threat_actor_analysis"`
	ImpactAssessment          ImpactAssessment          `json:"impact_assessment"`
	RecommendedActions        RecommendedActions        `json:"recommended_actions"`
	DefensiveGuidance         DefensiveGuidance         `json:"defensive_guidance"`
	AssumptionsAndLimitations AssumptionsAndLimitations `json:"assumptions_and_limitations"`
	References                References                `json:"references"`
	ReviewAndApproval         ReviewAndApproval         `json:"review_and_approval"`
}

type AssessmentMetadata struct {
	AssessmentID           string   `json:"assessment_id"`
	CreatedBy              string   `json:"created_by"`
	CreatedAt              string   `json:"created_at"`
	LastUpdated            string   `json:"last_updated"`
	Classification         string   `json:"classification"`
	SourceTopicIDs         []string `json:"source_topic_ids"`
	PromotionJustification string   `json:"promotion_justification"`
}

type ExecutiveSummary struct {
	Summary         string `json:"summary"`
	ConfidenceLevel string `json:"confidence_level"` // Low, Medium, High
	KeyTakeaway     string `json:"key_takeaway"`
}

type ThreatOverview struct {
	ThreatType            string   `json:"threat_type"` // Malware, Campaign, etc.
	ThreatName            string   `json:"threat_name"`
	KnownAliases          []string `json:"known_aliases"`
	FirstObserved         string   `json:"first_observed"`
	LastObserved          string   `json:"last_observed"`
	CurrentActivityStatus string   `json:"current_activity_status"` // Active, Dormant
	TargetedSectors       []string `json:"targeted_sectors"`
	GeographicRelevance   []string `json:"geographic_relevance"`
}

type TechnicalDetails struct {
	AttackVector          []string `json:"attack_vector"`
	InitialAccessMethods  []string `json:"initial_access_methods"`
	PersistenceMechanisms []string `json:"persistence_mechanisms"`
	PrivilegeEscalation   []string `json:"privilege_escalation"`
	LateralMovement       []string `json:"lateral_movement"`
	CommandAndControl     []string `json:"command_and_control"`
	PayloadBehavior       []string `json:"payload_behavior"`
}

type IndicatorsOfCompromise struct {
	Hashes  []string `json:"hashes"`
	IPs     []string `json:"ips"`
	Domains []string `json:"domains"`
	URLs    []string `json:"urls"`
	CVEs    []string `json:"cves"`
}

type ThreatActorAnalysis struct {
	AttributionConfidence string   `json:"attribution_confidence"`
	SuspectedActor        string   `json:"suspected_actor"`
	Motivation            string   `json:"motivation"`
	CapabilityLevel       string   `json:"capability_level"`
	KnownTooling          []string `json:"known_tooling"`
}

type ImpactAssessment struct {
	BusinessImpact             string `json:"business_impact"`
	PotentialImpactDescription string `json:"potential_impact_description"`
	LikelihoodOfOccurrence     string `json:"likelihood_of_occurrence"`
	OverallRiskRating          string `json:"overall_risk_rating"`
}

type RecommendedActions struct {
	ImmediateActions []string `json:"immediate_actions"`
	ShortTermActions []string `json:"short_term_actions"`
	LongTermActions  []string `json:"long_term_actions"`
}

type DefensiveGuidance struct {
	DetectionRecommendations  []string `json:"detection_recommendations"`
	MitigationStrategies      []string `json:"mitigation_strategies"`
	MonitoringRecommendations []string `json:"monitoring_recommendations"`
}

type AssumptionsAndLimitations struct {
	AssumptionsMade       []string `json:"assumptions_made"`
	IntelligenceGaps      []string `json:"intelligence_gaps"`
	ConfidenceConstraints []string `json:"confidence_constraints"`
}

type References struct {
	ExternalSources []string `json:"external_sources"`
	InternalSources []string `json:"internal_sources"`
}

type ReviewAndApproval struct {
	Analyst      string `json:"analyst"`
	Reviewer     string `json:"reviewer"`
	Approved     bool   `json:"approved"`
	ApprovalDate string `json:"approval_date"` // Using string for JSON date representation
}
