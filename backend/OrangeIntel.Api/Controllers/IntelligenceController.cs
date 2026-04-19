using Microsoft.AspNetCore.Mvc;
using OrangeIntel.Application.Services;
using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IntelligenceController : ControllerBase
{
    private readonly IThreatService _threatService;

    public IntelligenceController(IThreatService threatService)
    {
        _threatService = threatService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ThreatItem>>> GetIntelligence(
        [FromQuery] string? priority, 
        [FromQuery] int? days, 
        [FromQuery] string? sector,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var intelligence = await _threatService.GetFilteredIntelligenceAsync(priority, days, sector, startDate, endDate);
        return Ok(intelligence);
    }

    [HttpPost("migrate")]
    public async Task<ActionResult> Migrate()
    {
        var count = await _threatService.MigrateExistingThreatsAsync();
        return Ok(new { message = $"Classified {count} legacy threats", count });
    }
}
