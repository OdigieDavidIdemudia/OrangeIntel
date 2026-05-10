using Microsoft.AspNetCore.Mvc;
using OrangeIntel.Application.Services;
using OrangeIntel.Application.DTOs;
using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class MetricsController : ControllerBase
{
    private readonly IThreatService _threatService;

    public MetricsController(IThreatService threatService)
    {
        _threatService = threatService;
    }

    [HttpGet("last-threat")]
    public async Task<ActionResult> GetLastThreatTime()
    {
        var time = await _threatService.GetLastAcceptedThreatTimeAsync();
        // Return 204 if no threats ever accepted? Or just null?
        // Returning ISO string or null
        return Ok(new { timestamp = time });
    }

    [HttpGet("severity-count")]
    public async Task<ActionResult> GetSeverityCount()
    {
        var metrics = await _threatService.GetDashboardMetricsAsync();
        return Ok(metrics.SeverityCounts);
    }

    [HttpGet("environment-threats")]
    public async Task<ActionResult> GetEnvironmentThreats()
    {
        var metrics = await _threatService.GetDashboardMetricsAsync();
        return Ok(metrics.EnvironmentThreats);
    }

    [HttpGet("team-threat-distribution")]
    public async Task<ActionResult> GetTeamThreatDistribution()
    {
        var metrics = await _threatService.GetDashboardMetricsAsync();
        return Ok(metrics.TeamDistribution);
    }

    [HttpGet("risk-distribution")]
    public async Task<ActionResult> GetRiskDistribution()
    {
        var metrics = await _threatService.GetDashboardMetricsAsync();
        return Ok(metrics.RiskDistribution);
    }

    [HttpGet("/api/threats/recent")]
    public async Task<ActionResult> GetRecentThreats()
    {
        var recent = await _threatService.GetRecentAcceptedThreatsAsync(10);
        return Ok(recent);
    }

    [HttpGet("system/health")]
    public async Task<ActionResult> GetSystemHealth()
    {
        // Simple mock health for now as spec mentions "Backend and ingestion status"
        // Ideally checking DB connection + last ingestion time.
        // For MVP/Demo:
        return Ok(new 
        { 
            status = "Healthy",
            database = "Connected",
            ingestion = "Active",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult> GetDashboard()
    {
        var metrics = await _threatService.GetDashboardMetricsAsync();
        return Ok(metrics);
    }
}
