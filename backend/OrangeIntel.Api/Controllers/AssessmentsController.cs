using Microsoft.AspNetCore.Mvc;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace OrangeIntel.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AssessmentsController : ControllerBase
{
    private readonly IAssessmentRepository _repository;
    private readonly IEnumerable<IReportGenerator> _reportGenerators;

    public AssessmentsController(IAssessmentRepository repository, IEnumerable<IReportGenerator> reportGenerators)
    {
        _repository = repository;
        _reportGenerators = reportGenerators;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Assessment>>> GetAssessments()
    {
        return Ok(await _repository.GetAllAsync());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Assessment>> GetAssessment(Guid id)
    {
        var assessment = await _repository.GetByIdAsync(id);
        if (assessment == null) return NotFound();
        return Ok(assessment);
    }

    [HttpPost("update")] // Handle Create/Update
    public async Task<ActionResult> UpdateAssessment([FromBody] AssessmentBuilderData data)
    {
        // This accepts the specific structure from AssessmentBuilder
        // Map data.Sections to Assessment Entity
        
        // This is a simplified example assuming we create new or update existing
        // For now, let's assume we are updating an ID if provided, or creating.
        // But the builder sends a complex object.
        
        var assessment = new Assessment();
        if (data.Id.HasValue && data.Id.Value != Guid.Empty)
        {
            var existing = await _repository.GetByIdAsync(data.Id.Value);
            if (existing != null) assessment = existing;
        }

        // Map Sections
        var exec = data.Sections.ExecutiveSummary;
        assessment.ExecutiveSummary = exec?.Summary ?? "";
        assessment.ConfidenceStatement = exec?.ConfidenceLevel ?? ""; // Mapping level to statement for simple field
        
        var impact = data.Sections.ImpactAssessment;
        assessment.BusinessImpact = impact?.BusinessImpact ?? "";
        // Risk Rating Map ??? Enum? 
        // assessment.RiskRating = ...
        
        assessment.ImpactedServices = impact?.ImpactedServices ?? new List<string>();
        assessment.Systems = impact?.Systems ?? new List<string>();
        assessment.Applications = impact?.Applications ?? new List<string>();
        assessment.DataTypes = impact?.DataTypes ?? new List<string>();

        var acts = data.Sections.RecommendedActions;
        assessment.ImmediateActions = acts?.ImmediateActions ?? new List<string>();
        assessment.ShortTermActions = acts?.ShortTermActions ?? new List<string>();
        assessment.LongTermActions = acts?.LongTermActions ?? new List<string>();

        // Save
        if (data.Id == null || data.Id == Guid.Empty)
           await _repository.AddAsync(assessment);
        else 
           await _repository.UpdateAsync(assessment);

        return Ok(assessment);
    }


    [HttpPost("draft")]
    public async Task<ActionResult> SaveDraft([FromBody] AssessmentBuilderData data)
    {
        var draftId = data.Id ?? Guid.NewGuid();
        var draft = new AssessmentDraft
        {
            Id = draftId,
            AuthorId = "current-user", // Replace with actual user ID from context
            ContentJson = JsonSerializer.Serialize(data.Sections),
            LastSavedAt = DateTime.UtcNow
        };
        
        await _repository.SaveDraftAsync(draft);
        
        // Return ID so frontend can update URL if needed
        return Ok(new { id = draft.Id });
    }

    [HttpGet("draft/{id}")]
    public async Task<ActionResult> GetDraft(Guid id)
    {
        var draft = await _repository.GetDraftByIdAsync(id);
        if (draft == null) return NotFound();
        
        // Deserialize content back to builder structure
        try 
        {
            var sections = JsonSerializer.Deserialize<AssessmentSections>(draft.ContentJson);
            return Ok(new AssessmentBuilderData 
            { 
                Id = draft.Id, 
                Status = "draft", 
                Sections = sections ?? new AssessmentSections() 
            });
        }
        catch
        {
            return StatusCode(500, "Error deserializing draft content");
        }
    }

    [HttpPost("preview")]
    public IActionResult PreviewAssessment([FromBody] AssessmentBuilderData data)
    {
        Console.WriteLine($"Preview Request Received. ID: {data?.Id}, Sections: {data?.Sections != null}");
        try
        {
            // Map Builder Data to Report Model
            var reportModel = new OrangeIntel.Application.DTOs.Reporting.ThreatAssessmentReport();
            
            // Metadata
            reportModel.ThreatIntelligenceAssessment.Metadata.ReportTitle = "Preview Assessment"; // Title could be extracted
            reportModel.ThreatIntelligenceAssessment.Metadata.ReportId = $"TIA-PREVIEW-{DateTime.UtcNow:ddMM}";
            reportModel.ThreatIntelligenceAssessment.Metadata.Date = DateTime.UtcNow.ToString("yyyy-MM-dd");
            reportModel.ThreatIntelligenceAssessment.Metadata.PreparedBy = "Current User"; // Placeholder

            // Executive Summary
            reportModel.ThreatIntelligenceAssessment.ExecutiveSummary.AdvisorySummary = data.Sections.ExecutiveSummary?.Summary ?? "";
            reportModel.ThreatIntelligenceAssessment.ExecutiveSummary.HighLevelRiskStatement = data.Sections.ExecutiveSummary?.ConfidenceLevel ?? "Unknown";

            // Impact
            reportModel.ThreatIntelligenceAssessment.ImpactAssessment.PotentialImpact.Add(data.Sections.ImpactAssessment?.BusinessImpact ?? "");
            
            // Assets
            reportModel.ThreatIntelligenceAssessment.AffectedAssets.ImpactedServices = data.Sections.ImpactAssessment?.ImpactedServices ?? new List<string>();
            reportModel.ThreatIntelligenceAssessment.AffectedAssets.Systems = data.Sections.ImpactAssessment?.Systems ?? new List<string>();
            reportModel.ThreatIntelligenceAssessment.AffectedAssets.Applications = data.Sections.ImpactAssessment?.Applications ?? new List<string>();
            reportModel.ThreatIntelligenceAssessment.AffectedAssets.DataTypes = data.Sections.ImpactAssessment?.DataTypes ?? new List<string>();

            // Actions
            reportModel.ThreatIntelligenceAssessment.Recommendations.ImmediateActions = data.Sections.RecommendedActions?.ImmediateActions ?? new List<string>();
            reportModel.ThreatIntelligenceAssessment.Recommendations.ShortTermActions = data.Sections.RecommendedActions?.ShortTermActions ?? new List<string>();
            reportModel.ThreatIntelligenceAssessment.Recommendations.LongTermActions = data.Sections.RecommendedActions?.LongTermActions ?? new List<string>();

            // Generate
            var generator = _reportGenerators.FirstOrDefault(g => g.SupportedFormat.Equals("pdf", StringComparison.OrdinalIgnoreCase));
            if (generator == null) return StatusCode(500, "PDF Generator not available");

            var report = new Report 
            { 
               Title = "Preview",
               ReportType = "ThreatAssessment",
               Classification = data.Sections.Metadata?.Classification ?? "TLP:AMBER",
               GeneratedAt = DateTime.UtcNow 
            };
            
            Console.WriteLine("Generating PDF...");
            var contentJson = JsonSerializer.Serialize(reportModel);
            var fileBytes = generator.Generate(report, contentJson);
            Console.WriteLine($"PDF Generated: {fileBytes.Length} bytes");

            return File(fileBytes, "application/pdf", "preview_assessment.pdf");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Preview Error: {ex}");
            return StatusCode(500, $"Generation failed: {ex.Message}");
        }
    }
}

// DTOs matching Frontend Builder Structure
public class AssessmentBuilderData
{
    public Guid? Id { get; set; }
    public string? Status { get; set; }
    public AssessmentSections Sections { get; set; } = new();
}

public class AssessmentSections
{
    [JsonPropertyName("assessment_metadata")]
    public MetadataData? Metadata { get; set; }

    [JsonPropertyName("executive_summary")]
    public ExecSummaryData? ExecutiveSummary { get; set; }

    [JsonPropertyName("threat_overview")]
    public ThreatOverviewData? ThreatOverview { get; set; }

    [JsonPropertyName("technical_details")]
    public TechnicalDetailsData? TechnicalDetails { get; set; }

    [JsonPropertyName("indicators_of_compromise")]
    public IocData? IndicatorsOfCompromise { get; set; }

    [JsonPropertyName("threat_actor_analysis")]
    public ActorAnalysisData? ActorAnalysis { get; set; }
    
    [JsonPropertyName("impact_assessment")]
    public ImpactData? ImpactAssessment { get; set; }
    
    [JsonPropertyName("recommended_actions")]
    public ActionsData? RecommendedActions { get; set; }

    [JsonPropertyName("defensive_guidance")]
    public DefensiveGuidanceData? DefensiveGuidance { get; set; }

    [JsonPropertyName("assumptions_and_limitations")]
    public AssumptionsData? Assumptions { get; set; }

    [JsonPropertyName("references")]
    public ReferencesData? References { get; set; }

    [JsonPropertyName("review_and_approval")]
    public ReviewData? Review { get; set; }
}

public class MetadataData
{
    [JsonPropertyName("classification")] public string? Classification { get; set; }
    [JsonPropertyName("promotion_justification")] public string? PromotionJustification { get; set; }
}

public class ThreatOverviewData
{
    [JsonPropertyName("threat_type")] public string? ThreatType { get; set; }
    [JsonPropertyName("threat_name")] public string? ThreatName { get; set; }
    [JsonPropertyName("current_activity_status")] public string? ActivityStatus { get; set; }
}

public class TechnicalDetailsData
{
    [JsonPropertyName("attack_vector")] public List<string>? AttackVector { get; set; }
    [JsonPropertyName("command_and_control")] public List<string>? CommandAndControl { get; set; }
}

public class IocData
{
    [JsonPropertyName("hashes")] public List<string>? Hashes { get; set; }
    [JsonPropertyName("ips")] public List<string>? IPs { get; set; }
    [JsonPropertyName("domains")] public List<string>? Domains { get; set; }
    [JsonPropertyName("urls")] public List<string>? URLs { get; set; }
}

public class ActorAnalysisData
{
    [JsonPropertyName("suspected_actor")] public string? SuspectedActor { get; set; }
    [JsonPropertyName("attribution_confidence")] public string? AttributionConfidence { get; set; }
    [JsonPropertyName("motivation")] public string? Motivation { get; set; }
}

public class DefensiveGuidanceData
{
    [JsonPropertyName("detection_recommendations")] public List<string>? DetectionRecommendations { get; set; }
    [JsonPropertyName("mitigation_strategies")] public List<string>? MitigationStrategies { get; set; }
}

public class AssumptionsData
{
    [JsonPropertyName("intelligence_gaps")] public List<string>? IntelligenceGaps { get; set; }
    [JsonPropertyName("confidence_constraints")] public List<string>? ConfidenceConstraints { get; set; }
}

public class ReferencesData
{
    [JsonPropertyName("external_sources")] public List<string>? ExternalSources { get; set; }
    [JsonPropertyName("internal_sources")] public List<string>? InternalSources { get; set; }
}

public class ReviewData
{
    [JsonPropertyName("analyst")] public string? Analyst { get; set; }
    [JsonPropertyName("reviewer")] public string? Reviewer { get; set; }

}

public class ExecSummaryData
{
    [JsonPropertyName("summary")] public string? Summary { get; set; }
    [JsonPropertyName("confidence_level")] public string? ConfidenceLevel { get; set; }
}

public class ImpactData
{
    [JsonPropertyName("business_impact")] public string? BusinessImpact { get; set; }
    [JsonPropertyName("impacted_services")] public List<string>? ImpactedServices { get; set; }
    [JsonPropertyName("systems")] public List<string>? Systems { get; set; }
    [JsonPropertyName("applications")] public List<string>? Applications { get; set; }
    [JsonPropertyName("data_types")] public List<string>? DataTypes { get; set; }
}

public class ActionsData
{
    [JsonPropertyName("immediate_actions")] public List<string>? ImmediateActions { get; set; }
    [JsonPropertyName("short_term_actions")] public List<string>? ShortTermActions { get; set; }
    [JsonPropertyName("long_term_actions")] public List<string>? LongTermActions { get; set; }
}
