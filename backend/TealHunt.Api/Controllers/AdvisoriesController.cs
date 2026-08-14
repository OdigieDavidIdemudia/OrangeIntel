using Microsoft.AspNetCore.Mvc;
using TealHunt.Application.Services;
using TealHunt.Application.Interfaces;
using TealHunt.Application.DTOs.Reporting;
using TealHunt.Domain.Entities;

namespace TealHunt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class AdvisoriesController : ControllerBase
{
    private readonly IAdvisoryService _service;
    private readonly IEnumerable<IReportGenerator> _reportGenerators;

    public AdvisoriesController(IAdvisoryService service, IEnumerable<IReportGenerator> reportGenerators)
    {
        _service = service;
        _reportGenerators = reportGenerators;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Advisory>>> GetAdvisories()
    {
        var advisories = await _service.GetAdvisoriesAsync();
        return Ok(advisories);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Advisory>> GetAdvisory(Guid id)
    {
        var advisory = await _service.GetAdvisoryByIdAsync(id);
        if (advisory == null)
        {
            return NotFound();
        }
        return Ok(advisory);
    }
    [HttpPost("update")]
    public async Task<ActionResult> UpdateAdvisory([FromBody] Advisory advisory)
    {
        // If it's a new advisory (Id is empty), create it instead of updating
        if (advisory.Id == Guid.Empty)
        {
            await _service.AddAdvisoryAsync(advisory);
            return Ok(advisory);
        }

        var existing = await _service.GetAdvisoryByIdAsync(advisory.Id);
        if (existing == null) return NotFound();

        // Map relevant fields or use updated entity intact?
        // Ideally we should use a DTO but for speed using Entity directly as DTO here (as seen in frontend sending full object).
        // Update fields:
        existing.Title = advisory.Title;
        existing.ExecutiveSummary = advisory.ExecutiveSummary;
        existing.TechnicalDetails = advisory.TechnicalDetails;
        existing.ImpactedSectors = advisory.ImpactedSectors;
        existing.RecommendedActions = advisory.RecommendedActions;
        existing.Status = advisory.Status;
        existing.Confidence = advisory.Confidence;
        
        // Strict Report Fields
        existing.AttackVector = advisory.AttackVector;
        existing.Severity = advisory.Severity;
        existing.References = advisory.References;
        existing.DeliveryMechanism = advisory.DeliveryMechanism;
        existing.InitialAccess = advisory.InitialAccess;
        existing.Persistence = advisory.Persistence;
        existing.DefenseEvasion = advisory.DefenseEvasion;
        existing.CommandAndControl = advisory.CommandAndControl;
        existing.Exfiltration = advisory.Exfiltration;
        
        // New Fields
        existing.AffectedAssets = advisory.AffectedAssets;
        existing.Recommendations = advisory.Recommendations;
        existing.IOCs = advisory.IOCs;
        existing.ConfidenceStatement = advisory.ConfidenceStatement;

        // DEBUG LOGGING
        Console.WriteLine($"[UpdateAdvisory] Updating ID: {existing.Id}");
        Console.WriteLine($"Title: {advisory.Title}");
        Console.WriteLine($"AttackVector: {advisory.AttackVector}");
        Console.WriteLine($"IOC Count: {advisory.IOCs?.Count ?? 0}");
        Console.WriteLine($"Recommendations Count: {advisory.Recommendations?.Count ?? 0}");

        await _service.UpdateAdvisoryAsync(existing);
        return Ok(existing);
    }

    [HttpPost("draft")]
    public async Task<ActionResult> SaveDraft([FromBody] AdvisoryDraft draft)
    {
        if (draft.Id == Guid.Empty)
        {
            draft.Id = Guid.NewGuid();
        }
        draft.LastSavedAt = DateTime.UtcNow;
        await _service.SaveDraftAsync(draft);
        return Ok(draft);
    }

    [HttpGet("draft/{id}")]
    public async Task<ActionResult<AdvisoryDraft>> GetDraft(Guid id)
    {
        var draft = await _service.GetDraftByIdAsync(id);
        if (draft == null)
        {
            return NotFound();
        }
        return Ok(draft);
    }

    [HttpPost("preview")]
    public IActionResult PreviewAdvisory([FromBody] Advisory advisory)
    {
        Console.WriteLine($"[PreviewAdvisory] Generating PDF for: {advisory.Title}");
        
        try 
        {
            // Map Entity to Report Model
            var reportModel = new TealHunt.Application.DTOs.Reporting.ThreatAdvisoryReport();
            
            // Cover Page
            reportModel.Report.CoverPage.ReportTitle = advisory.Title;
            reportModel.Report.CoverPage.ReportIdentifier = $"TA-{DateTime.UtcNow:yyyyMMdd}-{advisory.Id.ToString().Substring(0,4).ToUpper()}";
            reportModel.Report.CoverPage.Classification = "TLP:AMBER"; // Default
            reportModel.Report.CoverPage.Severity = advisory.Severity.ToString(); // Enum to string? Need check
            
            // Exec Summary
            reportModel.Report.ExecutiveSummary.Content = advisory.ExecutiveSummary;
            reportModel.Report.ExecutiveSummary.ConfidenceStatement = advisory.ConfidenceStatement;

            // Analysis
            reportModel.Report.ThreatAnalysis.AttackChain.AttackVector = advisory.AttackVector;
            reportModel.Report.ThreatAnalysis.AttackChain.DeliveryMechanism = advisory.DeliveryMechanism;
            reportModel.Report.ThreatAnalysis.AttackChain.InitialAccess = advisory.InitialAccess;
            reportModel.Report.ThreatAnalysis.AttackChain.Persistence = advisory.Persistence;
            reportModel.Report.ThreatAnalysis.AttackChain.DefenseEvasion = advisory.DefenseEvasion;
            reportModel.Report.ThreatAnalysis.AttackChain.CommandAndControl = advisory.CommandAndControl;
            reportModel.Report.ThreatAnalysis.AttackChain.Exfiltration = advisory.Exfiltration;

            // Generate
            var generator = _reportGenerators.FirstOrDefault(g => g.SupportedFormat.Equals("pdf", StringComparison.OrdinalIgnoreCase));
            if (generator == null) return StatusCode(500, "PDF Generator not available");
            
            var report = new Report 
            { 
               Title = "Preview",
               ReportType = "ThreatAdvisory",
               Classification = "TLP:AMBER",
               GeneratedAt = DateTime.UtcNow 
            };
            
            var contentJson = System.Text.Json.JsonSerializer.Serialize(reportModel);
            var fileBytes = generator.Generate(report, contentJson);
            Console.WriteLine($"[PreviewAdvisory] Generated {fileBytes.Length} bytes");

            return File(fileBytes, "application/pdf", "preview_advisory.pdf");
        }
        catch (Exception ex)
        {
             Console.WriteLine($"[PreviewAdvisory] Error: {ex}");
             return StatusCode(500, $"Generation failed: {ex.Message}");
        }
    }
}
