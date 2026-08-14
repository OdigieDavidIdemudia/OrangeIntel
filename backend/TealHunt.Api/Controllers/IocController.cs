using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TealHunt.Application.DTOs;
using TealHunt.Application.Interfaces;
using System.Security.Claims;
using System.Threading.Tasks;

namespace TealHunt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class IocController : ControllerBase
{
    private readonly IIocEnrichmentService _iocService;

    public IocController(IIocEnrichmentService iocService)
    {
        _iocService = iocService;
    }

    [HttpPost("enrich")]
    public async Task<IActionResult> EnrichSingle([FromBody] IocLookupRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var result = await _iocService.EnrichSingleIocAsync(request.Indicator, userId);
        if (result == null) return BadRequest("Invalid indicator.");
        return Ok(result);
    }

    [HttpPost("enrich/bulk")]
    public async Task<IActionResult> EnrichBulk([FromBody] BulkIocLookupRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var result = await _iocService.EnrichBulkIocAsync(request.Indicators, userId);
        return Ok(result);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int count = 50)
    {
        var result = await _iocService.GetLookupHistoryAsync(count);
        return Ok(result);
    }
}
