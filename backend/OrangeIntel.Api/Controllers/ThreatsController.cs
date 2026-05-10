using Microsoft.AspNetCore.Mvc;
using OrangeIntel.Application.DTOs;
using OrangeIntel.Application.Services;
using OrangeIntel.Domain.Entities;
using Microsoft.AspNetCore.Authorization;

namespace OrangeIntel.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ThreatsController : ControllerBase
{
    private readonly IThreatService _service;
    private readonly OrangeIntel.Infrastructure.Services.ThreatIngestionService _ingestionService;

    public ThreatsController(IThreatService service, OrangeIntel.Infrastructure.Services.ThreatIngestionService ingestionService)
    {
        _service = service;
        _ingestionService = ingestionService;
    }

    [HttpPost("ingest")]
    public async Task<ActionResult> IngestThreats()
    {
        var (count, message) = await _ingestionService.IngestLatestCvesAsync();
        
        if (count == -1)
        {
            return StatusCode(500, new { message = $"Ingestion failed: {message}" });
        }
        
        return Ok(new { message = $"Ingested {count} new threats", count });
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ThreatItem>>> GetThreats()
    {
        var threats = await _service.GetThreatsAsync();
        return Ok(threats);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ThreatItem>> GetThreat(Guid id)
    {
        var threat = await _service.GetThreatByIdAsync(id);
        if (threat == null)
        {
            return NotFound();
        }
        return Ok(threat);
    }

    [HttpPost("promote")]
    public async Task<ActionResult> PromoteThreat([FromBody] PromoteThreatRequest request)
    {
        var advisory = await _service.PromoteThreatAsync(request.ThreatId); // Maps to TopicId/ThreatId in request
        if (advisory == null)
        {
            return NotFound("Threat not found");
        }
        
        return Ok(new { advisory_id = advisory.Id });
    }

    [HttpPost("discard")]
    public async Task<ActionResult> DiscardThreat([FromBody] PromoteThreatRequest request)
    {
        var result = await _service.DiscardThreatAsync(request.ThreatId);
        if (!result)
        {
            return NotFound("Threat not found");
        }
        
        return Ok(new { message = "Threat discarded" });
    }

    [HttpPost("purge-irrelevant")]
    public async Task<ActionResult> PurgeIrrelevantThreats()
    {
        var count = await _ingestionService.PurgeIrrelevantThreatsAsync();
        return Ok(new { message = $"Purged {count} irrelevant threat items from the database.", count });
    }

    [HttpPost("{id}/acknowledge")]
    public async Task<ActionResult> AcknowledgeThreat(Guid id, [FromBody] AcknowledgeThreatRequest request)
    {
        var result = await _service.AcknowledgeThreatAsync(id, request.AcknowledgedBy, request.Note);
        if (!result)
        {
            return NotFound("Threat not found");
        }
        return Ok(new { message = "Threat acknowledged" });
    }

    [HttpGet("acknowledged")]
    public async Task<ActionResult<IEnumerable<ThreatItem>>> GetAcknowledgedThreats()
    {
        var threats = await _service.GetAcknowledgedThreatsAsync();
        return Ok(threats);
    }
}

public record AcknowledgeThreatRequest(string AcknowledgedBy, string Note);
