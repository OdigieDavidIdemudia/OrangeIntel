using Microsoft.AspNetCore.Mvc;
using System.Text.Json.Serialization;
using OrangeIntel.Application.Services;
using OrangeIntel.Domain.Entities;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace OrangeIntel.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _service;

    public ReportsController(IReportService service)
    {
        _service = service;
    }

    private string GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier) 
            ?? User.FindFirstValue("id") 
            ?? User.FindFirstValue("sub") 
            ?? "system";
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Report>>> GetReports()
    {
        var userId = GetCurrentUserId();
        return Ok(await _service.GetReportsAsync(userId));
    }

    [HttpPost("create")]
    public async Task<ActionResult<Report>> CreateReport([FromBody] CreateReportRequest request)
    {
        var userId = GetCurrentUserId();
        
        // Enforce DOCX
        var report = await _service.GenerateReportAsync(request.ArtifactId, request.Type, "DOCX", userId);
        if (report == null) return BadRequest("Failed to generate report");
        
        return Ok(report);
    }
    
    [HttpGet("preview")]
    public async Task<IActionResult> PreviewReport([FromQuery] Guid artifactId, [FromQuery] string type)
    {
         var userId = GetCurrentUserId();
         var fileBytes = await _service.GeneratePreviewAsync(artifactId, type, userId);
         
         if (fileBytes == null) return NotFound("Could not generate preview. Artifact might not exist.");

         return File(fileBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    [HttpGet("download")]
    public async Task<IActionResult> DownloadReport(Guid id)
    {
        var report = await _service.GetReportByIdAsync(id);
        if (report == null) return NotFound();

        var fileBytes = await _service.GetReportFileAsync(id);
        if (fileBytes == null) return StatusCode(500, "Error generating file.");

        var mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        return File(fileBytes, mimeType, $"{report.Title}.docx");
    }

    [HttpPost("advisory")]
    public async Task<IActionResult> GenerateAdvisoryReport([FromBody] OrangeIntel.Application.DTOs.Reporting.GTBankAdvisoryReportV1 model, [FromServices] OrangeIntel.Application.Interfaces.IAdvisoryDocxService advisoryService)
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // Log to database
            await _service.SaveAdvisoryReportAsync(model, userId);

            var bytes = advisoryService.GenerateAdvisory(model);
            var fileName = $"GTBank_ThreatAdvisory_{model.Metadata.Title.Replace(" ", "_")}.docx";
            return File(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to generate advisory: {ex.Message}");
        }
    }
}

public class CreateReportRequest
{
    [JsonPropertyName("artifact_id")]
    public Guid ArtifactId { get; set; }
    
    [JsonPropertyName("type")]
    public string Type { get; set; }
    
    // Format removed effectively, kept for back-compat if needed but ignored
    [JsonPropertyName("format")]
    public string? Format { get; set; }
}
