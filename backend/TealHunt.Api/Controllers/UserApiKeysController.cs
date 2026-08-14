using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TealHunt.Domain.Entities;
using TealHunt.Infrastructure.Data;

namespace TealHunt.Api.Controllers;

/// <summary>
/// Allows any authenticated user to store and retrieve their own personal API keys
/// for IOC enrichment providers. These take priority over global admin-set keys.
/// </summary>
[ApiController]
[Route("api/user/api-keys")]
[Authorize]
public class UserApiKeysController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public UserApiKeysController(ApplicationDbContext db) => _db = db;

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")
        ?? string.Empty;

    public record UserApiKeyDto(string KeyName, string KeyValue, DateTime LastUpdatedAt);
    public record UpsertApiKeyRequest(string KeyName, string KeyValue);

    /// <summary>GET all API keys for the current user (values masked).</summary>
    [HttpGet]
    public async Task<IActionResult> GetMyKeys()
    {
        var userId = CurrentUserId;
        var keys = await _db.UserApiKeys
            .Where(k => k.UserId == userId)
            .ToListAsync(); // materialize first — EF can't translate index operators

        var result = keys.Select(k => new UserApiKeyDto(
            k.KeyName,
            string.IsNullOrEmpty(k.KeyValue)
                ? ""
                : "••••••••" + k.KeyValue[Math.Max(0, k.KeyValue.Length - 4)..],
            k.LastUpdatedAt)).ToList();

        return Ok(result);
    }

    /// <summary>Upsert one or more API keys for the current user.</summary>
    [HttpPut]
    public async Task<IActionResult> UpsertKeys([FromBody] List<UpsertApiKeyRequest> requests)
    {
        var userId = CurrentUserId;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        foreach (var req in requests)
        {
            if (string.IsNullOrWhiteSpace(req.KeyName)) continue;

            var existing = await _db.UserApiKeys
                .FirstOrDefaultAsync(k => k.UserId == userId && k.KeyName == req.KeyName);

            if (existing == null)
            {
                _db.UserApiKeys.Add(new UserApiKey
                {
                    UserId = userId,
                    KeyName = req.KeyName,
                    KeyValue = req.KeyValue ?? string.Empty,
                    LastUpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                // Only update if a real value was provided (not the masked placeholder)
                if (!string.IsNullOrEmpty(req.KeyValue) && !req.KeyValue.StartsWith("••"))
                {
                    existing.KeyValue = req.KeyValue;
                    existing.LastUpdatedAt = DateTime.UtcNow;
                }
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "API keys saved successfully." });
    }

    /// <summary>Delete a specific API key (revert to global/admin key).</summary>
    [HttpDelete("{keyName}")]
    public async Task<IActionResult> DeleteKey(string keyName)
    {
        var userId = CurrentUserId;
        var key = await _db.UserApiKeys
            .FirstOrDefaultAsync(k => k.UserId == userId && k.KeyName == keyName);

        if (key == null) return NotFound();

        _db.UserApiKeys.Remove(key);
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Key '{keyName}' removed. Will now use global/admin key." });
    }
}
