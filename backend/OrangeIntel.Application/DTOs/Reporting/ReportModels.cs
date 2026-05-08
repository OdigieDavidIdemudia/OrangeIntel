using System.Text.Json.Serialization;

namespace OrangeIntel.Application.DTOs.Reporting;

public class ThreatAssessmentReport
{
    [JsonPropertyName("threat_intelligence_assessment")]
    public AssessmentContent ThreatIntelligenceAssessment { get; set; } = new();

    public class AssessmentContent
    {
        [JsonPropertyName("metadata")]
        public ReportMetadata Metadata { get; set; } = new();

        [JsonPropertyName("table_of_contents")]
        public List<string> TableOfContents { get; set; } = new();

        [JsonPropertyName("report_overview")]
        public ReportOverview ReportOverview { get; set; } = new();

        [JsonPropertyName("executive_summary")]
        public ExecutiveSummary ExecutiveSummary { get; set; } = new();

        [JsonPropertyName("threat_landscape")]
        public ThreatLandscape ThreatLandscape { get; set; } = new();

        [JsonPropertyName("detection_rules")]
        public DetectionRules DetectionRules { get; set; } = new();

        [JsonPropertyName("impact_assessment")]
        public ImpactAssessment ImpactAssessment { get; set; } = new();

        [JsonPropertyName("affected_assets")]
        public AffectedAssets AffectedAssets { get; set; } = new();

        [JsonPropertyName("threat_actor_profile")]
        public ThreatActorProfile ThreatActorProfile { get; set; } = new();

        [JsonPropertyName("recommendations_and_mitigations")]
        public Recommendations Recommendations { get; set; } = new();

        [JsonPropertyName("references")]
        public References References { get; set; } = new();

        [JsonPropertyName("appendices")]
        public Appendices Appendices { get; set; } = new();
    }
}

public class ReportMetadata
{
    [JsonPropertyName("report_title")]
    public string ReportTitle { get; set; } = string.Empty;
    [JsonPropertyName("report_id")]
    public string ReportId { get; set; } = string.Empty;
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;
    [JsonPropertyName("prepared_by")]
    public string PreparedBy { get; set; } = string.Empty;
    [JsonPropertyName("reviewed_by")]
    public string ReviewedBy { get; set; } = string.Empty;
    [JsonPropertyName("organization_unit")]
    public string OrganizationUnit { get; set; } = string.Empty;
}

public class ReportOverview
{
    [JsonPropertyName("report_title")]
    public string ReportTitle { get; set; } = string.Empty;
    [JsonPropertyName("date_of_release")]
    public string DateOfRelease { get; set; } = string.Empty;
    [JsonPropertyName("organization")]
    public string Organization { get; set; } = string.Empty;
    [JsonPropertyName("scope")]
    public string Scope { get; set; } = string.Empty;
    [JsonPropertyName("summary_purpose")]
    public string SummaryPurpose { get; set; } = string.Empty;
}

public class ExecutiveSummary
{
    [JsonPropertyName("date_of_release")]
    public string DateOfRelease { get; set; } = string.Empty;
    [JsonPropertyName("affected_versions")]
    public List<string> AffectedVersions { get; set; } = new();
    [JsonPropertyName("affected_applications")]
    public List<string> AffectedApplications { get; set; } = new();
    [JsonPropertyName("advisory_summary")]
    public string AdvisorySummary { get; set; } = string.Empty;
    [JsonPropertyName("high_level_risk_statement")]
    public string HighLevelRiskStatement { get; set; } = string.Empty;
}

public class ThreatLandscape
{
    [JsonPropertyName("type_of_threat")]
    public List<string> TypeOfThreat { get; set; } = new();
    [JsonPropertyName("source_origin")]
    public string SourceOrigin { get; set; } = string.Empty;
    [JsonPropertyName("discovery_method")]
    public string DiscoveryMethod { get; set; } = string.Empty;
    [JsonPropertyName("related_cves")]
    public List<string> RelatedCves { get; set; } = new();
    [JsonPropertyName("mitre_ttps")]
    public MitreTTPs MitreTTPs { get; set; } = new();
    [JsonPropertyName("related_advisories_links")]
    public List<string> RelatedAdvisoriesLinks { get; set; } = new();
}

public class MitreTTPs
{
    [JsonPropertyName("tactics")]
    public List<string> Tactics { get; set; } = new();
    [JsonPropertyName("techniques")]
    public List<string> Techniques { get; set; } = new();
    [JsonPropertyName("procedures")]
    public List<string> Procedures { get; set; } = new();
}

public class DetectionRules
{
    [JsonPropertyName("indicators_of_compromise")]
    public IOCs IndicatorsOfCompromise { get; set; } = new();
    [JsonPropertyName("behavioral_iocs")]
    public List<string> BehavioralIocs { get; set; } = new();
    [JsonPropertyName("file_paths")]
    public List<string> FilePaths { get; set; } = new();
    [JsonPropertyName("application_names")]
    public List<string> ApplicationNames { get; set; } = new();
    [JsonPropertyName("rule_source")]
    public RuleSource RuleSource { get; set; } = new();
}

public class IOCs
{
    [JsonPropertyName("ip_addresses")]
    public List<string> IpAddresses { get; set; } = new();
    [JsonPropertyName("domains")]
    public List<string> Domains { get; set; } = new();
    [JsonPropertyName("file_hashes")]
    public List<string> FileHashes { get; set; } = new();
    [JsonPropertyName("urls")]
    public List<string> Urls { get; set; } = new();
}

public class RuleSource
{
    [JsonPropertyName("type")]
    public List<string> Type { get; set; } = new();
    [JsonPropertyName("details")]
    public string Details { get; set; } = string.Empty;
}

public class ImpactAssessment
{
    [JsonPropertyName("potential_impact")]
    public List<string> PotentialImpact { get; set; } = new();
    [JsonPropertyName("business_risk_level")]
    public List<string> BusinessRiskLevel { get; set; } = new();
    [JsonPropertyName("regulatory_implications")]
    public List<string> RegulatoryImplications { get; set; } = new();
}

public class AffectedAssets
{
    [JsonPropertyName("impacted_services")]
    public List<string> ImpactedServices { get; set; } = new();
    [JsonPropertyName("systems")]
    public List<string> Systems { get; set; } = new();
    [JsonPropertyName("applications")]
    public List<string> Applications { get; set; } = new();
    [JsonPropertyName("data_types")]
    public List<string> DataTypes { get; set; } = new();
}

public class ThreatActorProfile
{
    [JsonPropertyName("known")]
    public bool Known { get; set; }
    [JsonPropertyName("name_or_group")]
    public string NameOrGroup { get; set; } = string.Empty;
    [JsonPropertyName("motivation")]
    public List<string> Motivation { get; set; } = new();
    [JsonPropertyName("known_ttps")]
    public List<string> KnownTTPs { get; set; } = new();
}

public class Recommendations
{
    [JsonPropertyName("immediate_actions")]
    public List<string> ImmediateActions { get; set; } = new();
    [JsonPropertyName("short_term_actions")]
    public List<string> ShortTermActions { get; set; } = new();
    [JsonPropertyName("long_term_actions")]
    public List<string> LongTermActions { get; set; } = new();
    [JsonPropertyName("responsible_teams")]
    public List<string> ResponsibleTeams { get; set; } = new();
    [JsonPropertyName("escalation_steps")]
    public List<string> EscalationSteps { get; set; } = new();
}

public class References
{
    [JsonPropertyName("external_threat_feeds")]
    public List<string> ExternalThreatFeeds { get; set; } = new();
    [JsonPropertyName("cve_references")]
    public List<string> CveReferences { get; set; } = new();
    [JsonPropertyName("vendor_advisories")]
    public List<string> VendorAdvisories { get; set; } = new();
    [JsonPropertyName("additional_links")]
    public List<string> AdditionalLinks { get; set; } = new();
}

public class Appendices
{
    [JsonPropertyName("logs")]
    public List<string> Logs { get; set; } = new();
    [JsonPropertyName("screenshots")]
    public List<string> Screenshots { get; set; } = new();
    [JsonPropertyName("raw_data")]
    public List<string> RawData { get; set; } = new();
    [JsonPropertyName("timeline_of_events")]
    public List<string> TimelineOfEvents { get; set; } = new();
    [JsonPropertyName("additional_notes")]
    public string AdditionalNotes { get; set; } = string.Empty;
}

// ---------------------------------------------------------
// Threat Advisory Report Models
// ---------------------------------------------------------

public class ThreatAdvisoryReport
{
    [JsonPropertyName("threat_advisory_report")]
    public AdvisoryContent Report { get; set; } = new();

    public class AdvisoryContent
    {
        [JsonPropertyName("cover_page")]
        public CoverPage CoverPage { get; set; } = new();

        [JsonPropertyName("table_of_contents")]
        public List<TocItem> TableOfContents { get; set; } = new();

        [JsonPropertyName("report_overview")]
        public ReportOverviewAdvisory ReportOverview { get; set; } = new();

        [JsonPropertyName("executive_summary")]
        public ExecutiveSummaryAdvisory ExecutiveSummary { get; set; } = new();

        [JsonPropertyName("threat_analysis")]
        public ThreatAnalysis ThreatAnalysis { get; set; } = new();

        [JsonPropertyName("indicators_of_compromise")]
        public IOCsAdvisory IndicatorsOfCompromise { get; set; } = new();

        [JsonPropertyName("detection_and_hunting")]
        public DetectionAndHunting DetectionAndHunting { get; set; } = new();

        [JsonPropertyName("mitigation_and_blocking")]
        public MitigationAndBlocking MitigationAndBlocking { get; set; } = new();

        [JsonPropertyName("affected_assets")]
        public List<string> AffectedAssets { get; set; } = new();

        [JsonPropertyName("references")]
        public List<ReferenceItem> References { get; set; } = new();
    }
}

public class CoverPage
{
    [JsonPropertyName("organization_name")]
    public string OrganizationName { get; set; } = "Guaranty Trust Bank Ltd";
    [JsonPropertyName("report_type")]
    public string ReportType { get; set; } = "Threat Advisory";
    [JsonPropertyName("report_identifier")]
    public string ReportIdentifier { get; set; } = string.Empty;
    [JsonPropertyName("report_title")]
    public string ReportTitle { get; set; } = string.Empty;
    [JsonPropertyName("classification")]
    public string Classification { get; set; } = "TLP:AMBER";
    [JsonPropertyName("severity")]
    public string Severity { get; set; } = "Low";
}

public class TocItem
{
    [JsonPropertyName("section")]
    public string Section { get; set; } = string.Empty;
    [JsonPropertyName("page")]
    public int Page { get; set; }
}

public class ReportOverviewAdvisory
{
    [JsonPropertyName("report_title")]
    public string ReportTitle { get; set; } = string.Empty;
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;
    [JsonPropertyName("prepared_by")]
    public string PreparedBy { get; set; } = string.Empty;
    [JsonPropertyName("reviewed_by")]
    public string ReviewedBy { get; set; } = string.Empty;
    [JsonPropertyName("organization_unit")]
    public string OrganizationUnit { get; set; } = "Security Monitoring and Threat Intelligence";
}

public class ExecutiveSummaryAdvisory
{
    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;
    [JsonPropertyName("confidence_statement")]
    public string ConfidenceStatement { get; set; } = string.Empty;
}

public class ThreatAnalysis
{
    [JsonPropertyName("attack_chain")]
    public AttackChain AttackChain { get; set; } = new();
    [JsonPropertyName("mitre_attack_mapping")]
    public List<MitreMapping> MitreAttackMapping { get; set; } = new();
}

public class AttackChain
{
    [JsonPropertyName("attack_vector")]
    public string AttackVector { get; set; } = string.Empty;
    [JsonPropertyName("initial_access")]
    public string InitialAccess { get; set; } = string.Empty;
    [JsonPropertyName("delivery_mechanism")]
    public string DeliveryMechanism { get; set; } = string.Empty;
    [JsonPropertyName("social_engineering")]
    public string SocialEngineering { get; set; } = string.Empty;
    [JsonPropertyName("execution")]
    public string Execution { get; set; } = string.Empty;
    [JsonPropertyName("defense_evasion")]
    public string DefenseEvasion { get; set; } = string.Empty;
    [JsonPropertyName("persistence")]
    public string Persistence { get; set; } = string.Empty;
    [JsonPropertyName("payload")]
    public string Payload { get; set; } = string.Empty;
    [JsonPropertyName("evasion")]
    public string Evasion { get; set; } = string.Empty;
    [JsonPropertyName("command_and_control")]
    public string CommandAndControl { get; set; } = string.Empty;
    [JsonPropertyName("exfiltration")]
    public string Exfiltration { get; set; } = string.Empty;
}

public class MitreMapping
{
    [JsonPropertyName("technique_id")]
    public string TechniqueId { get; set; } = string.Empty;
    [JsonPropertyName("technique_name")]
    public string TechniqueName { get; set; } = string.Empty;
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class IOCsAdvisory
{
    [JsonPropertyName("domains_and_urls")]
    public List<DomainUrlIOC> DomainsAndUrls { get; set; } = new();
    [JsonPropertyName("file_indicators")]
    public List<FileIOC> FileIndicators { get; set; } = new();
    [JsonPropertyName("network_indicators")]
    public List<NetworkIOC> NetworkIndicators { get; set; } = new();
}

public class DomainUrlIOC
{
    [JsonPropertyName("indicator")]
    public string Indicator { get; set; } = string.Empty;
    [JsonPropertyName("defanged")]
    public bool Defanged { get; set; }
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class FileIOC
{
    [JsonPropertyName("filename")]
    public string Filename { get; set; } = string.Empty;
    [JsonPropertyName("path")]
    public string Path { get; set; } = string.Empty;
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class NetworkIOC
{
    [JsonPropertyName("protocol")]
    public string Protocol { get; set; } = string.Empty;
    [JsonPropertyName("port")]
    public string Port { get; set; } = string.Empty;
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class DetectionAndHunting
{
    [JsonPropertyName("hunting_logic")]
    public string HuntingLogic { get; set; } = string.Empty;
    [JsonPropertyName("endpoint_checks")]
    public List<string> EndpointChecks { get; set; } = new();
    [JsonPropertyName("log_sources")]
    public List<LogSource> LogSources { get; set; } = new();
}

public class LogSource
{
    [JsonPropertyName("log_type")]
    public string LogType { get; set; } = string.Empty;
    [JsonPropertyName("event_id")]
    public string EventId { get; set; } = string.Empty;
    [JsonPropertyName("keywords")]
    public List<string> Keywords { get; set; } = new();
}

public class MitigationAndBlocking
{
    [JsonPropertyName("network_controls")]
    public List<string> NetworkControls { get; set; } = new();
    [JsonPropertyName("endpoint_controls")]
    public List<string> EndpointControls { get; set; } = new();
    [JsonPropertyName("user_awareness")]
    public List<string> UserAwareness { get; set; } = new();
    [JsonPropertyName("hardening_actions")]
    public List<string> HardeningActions { get; set; } = new();
}

public class ReferenceItem
{
    [JsonPropertyName("id")]
    public int Id { get; set; }
    [JsonPropertyName("source")]
    public string Source { get; set; } = string.Empty;
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;
}

// ---------------------------------------------------------
// GTBank Structured Advisory Models (Task 33)
// ---------------------------------------------------------

// ---------------------------------------------------------
// GTBank Structured Advisory Models (v1.0 Canonical)
// ---------------------------------------------------------

public class GTBankAdvisoryReportV1
{
    [JsonPropertyName("_schema")]
    public string Schema { get; set; } = "GTBank Threat Advisory Report Template v1.0";

    [JsonPropertyName("_description")]
    public string Description { get; set; } = "This is the canonical JSON contract between OrangeIntel and the AdvisoryDocxService.";

    [JsonPropertyName("metadata")]
    public MetadataV1 Metadata { get; set; } = new();

    [JsonPropertyName("executive_summary")]
    public ExecutiveSummaryV1 ExecutiveSummary { get; set; } = new();

    [JsonPropertyName("threat_analysis")]
    public ThreatAnalysisV1 ThreatAnalysis { get; set; } = new();

    [JsonPropertyName("iocs")]
    public IocsV1 Iocs { get; set; } = new();

    [JsonPropertyName("detection_methods")]
    public DetectionMethodsV1 DetectionMethods { get; set; } = new();

    [JsonPropertyName("assessment")]
    public AssessmentV1 Assessment { get; set; } = new();

    [JsonPropertyName("remediation")]
    public RemediationV1 Remediation { get; set; } = new();

    [JsonPropertyName("references")]
    public ReferencesV1 References { get; set; } = new();
}

public class MetadataV1
{
    [JsonPropertyName("_section")]
    public string Section { get; set; } = "Cover Page + Report Overview";
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;
    [JsonPropertyName("prepared_by")]
    public string PreparedBy { get; set; } = string.Empty;
    [JsonPropertyName("reviewed_by")]
    public string ReviewedBy { get; set; } = string.Empty;
    [JsonPropertyName("organization_unit")]
    public string OrganizationUnit { get; set; } = "Security Monitoring and Threat Intelligence";
    [JsonPropertyName("tlp")]
    public string Tlp { get; set; } = "RED";
    [JsonPropertyName("classification")]
    public string Classification { get; set; } = "CONFIDENTIAL";
}

public class ExecutiveSummaryV1
{
    [JsonPropertyName("_section")]
    public string Section { get; set; } = "Section 1";
    [JsonPropertyName("body")]
    public string Body { get; set; } = string.Empty;
}

public class ThreatAnalysisV1
{
    [JsonPropertyName("_section")]
    public string Section { get; set; } = "Section 2";
    [JsonPropertyName("intro")]
    public string Intro { get; set; } = string.Empty;
    [JsonPropertyName("attack_chain")]
    public List<AttackChainStepV1> AttackChain { get; set; } = new();
    [JsonPropertyName("permissions_abuse")]
    public List<string> PermissionsAbuse { get; set; } = new();
    [JsonPropertyName("mitre_attack")]
    public List<MitreAttackV1> MitreAttack { get; set; } = new();
}

public class AttackChainStepV1
{
    [JsonPropertyName("step")]
    public int Step { get; set; }
    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class MitreAttackV1
{
    [JsonPropertyName("technique_id")]
    public string TechniqueId { get; set; } = string.Empty;
    [JsonPropertyName("tactic")]
    public string Tactic { get; set; } = string.Empty;
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class IocsV1
{
    [JsonPropertyName("_section")]
    public string Section { get; set; } = "Section 3";
    [JsonPropertyName("entries")]
    public List<IocEntryV1> Entries { get; set; } = new();
}

public class IocEntryV1
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;
    [JsonPropertyName("indicator")]
    public string Indicator { get; set; } = string.Empty;
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
    [JsonPropertyName("defanged")]
    public bool Defanged { get; set; }
}

public class DetectionMethodsV1
{
    [JsonPropertyName("_section")]
    public string Section { get; set; } = "Section 4";
    [JsonPropertyName("entries")]
    public List<DetectionEntryV1> Entries { get; set; } = new();
}

public class DetectionEntryV1
{
    [JsonPropertyName("sub_heading")]
    public string SubHeading { get; set; } = string.Empty;
    [JsonPropertyName("body")]
    public string Body { get; set; } = string.Empty;
    [JsonPropertyName("commands")]
    public List<string> Commands { get; set; } = new();
    [JsonPropertyName("command_language")]
    public string? CommandLanguage { get; set; }
}

public class AssessmentV1
{
    [JsonPropertyName("_section")]
    public string Section { get; set; } = "Section 5";
    [JsonPropertyName("intro")]
    public string Intro { get; set; } = string.Empty;
    [JsonPropertyName("questions")]
    public List<AssessmentQuestionV1> Questions { get; set; } = new();
    [JsonPropertyName("risk_rating")]
    public RiskRatingV1 RiskRating { get; set; } = new();
    [JsonPropertyName("assessment_notes")]
    public string AssessmentNotes { get; set; } = string.Empty;
}

public class AssessmentQuestionV1
{
    [JsonPropertyName("id")]
    public int Id { get; set; }
    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;
    [JsonPropertyName("question")]
    public string Question { get; set; } = string.Empty;
}

public class RiskRatingV1
{
    [JsonPropertyName("selected")]
    public string? Selected { get; set; }
}

public class RemediationV1
{
    [JsonPropertyName("_section")]
    public string Section { get; set; } = "Section 6";
    [JsonPropertyName("entries")]
    public List<RemediationEntryV1> Entries { get; set; } = new();
}

public class RemediationEntryV1
{
    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class ReferencesV1
{
    [JsonPropertyName("_section")]
    public string Section { get; set; } = "Section 7";
    [JsonPropertyName("entries")]
    public List<ReferenceEntryV1> Entries { get; set; } = new();
}

public class ReferenceEntryV1
{
    [JsonPropertyName("id")]
    public int Id { get; set; }
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;
}
