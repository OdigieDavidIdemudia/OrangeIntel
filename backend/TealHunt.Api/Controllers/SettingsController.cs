using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TealHunt.Domain.Entities;
using TealHunt.Infrastructure.Data;

namespace TealHunt.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<AppUser> _userManager;

    public SettingsController(ApplicationDbContext context, UserManager<AppUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    [HttpGet]
    [Authorize(Roles = "admin,super_admin")]
    public async Task<ActionResult<IEnumerable<SystemSetting>>> GetSettings([FromQuery] string? category)
    {
        var query = _context.SystemSettings.AsQueryable();
        
        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(s => s.Category == category);
        }

        return await query.ToListAsync();
    }

    [HttpPut]
    [Authorize(Roles = "admin,super_admin")]
    public async Task<ActionResult> UpdateSettings([FromBody] List<SystemSettingDto> settings)
    {
        var user = await _userManager.GetUserAsync(User);
        
        foreach (var settingDto in settings)
        {
            var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == settingDto.Key);
            
            if (setting == null)
            {
                setting = new SystemSetting
                {
                    Key = settingDto.Key,
                    Value = settingDto.Value,
                    Category = settingDto.Category,
                    LastUpdatedAt = DateTime.UtcNow,
                    LastUpdatedBy = user?.Email
                };
                _context.SystemSettings.Add(setting);
            }
            else
            {
                setting.Value = settingDto.Value;
                setting.LastUpdatedAt = DateTime.UtcNow;
                setting.LastUpdatedBy = user?.Email;
                _context.Entry(setting).State = EntityState.Modified;
            }
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("user")]
    public async Task<ActionResult<UserSettingsDto>> GetUserSettings()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();
        
        return Ok(new UserSettingsDto
        {
            UiPreferencesJson = user.UiPreferencesJson,
            MfaEnabled = !string.IsNullOrEmpty(user.MfaSecret), // Assuming MfaSecret presence means enabled/setup
            TelegramChatId = user.TelegramChatId
        });
    }

    [HttpPatch("user")]
    public async Task<ActionResult> UpdateUserUiPreferences([FromBody] UiPreferencesDto dto)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        user.UiPreferencesJson = dto.PreferencesJson;
        await _userManager.UpdateAsync(user);
        
        return Ok();
    }
    [HttpPost("reset")]
    [Authorize(Roles = "super_admin,admin")]
    public async Task<ActionResult> ResetDatabase()
    {
        try 
        {
            var user = await _userManager.GetUserAsync(User);
            
                // Clear dependent Indicators first
            await _context.Indicators.ExecuteDeleteAsync();

            // Truncate/Delete ThreatItems
            await _context.ThreatItems.ExecuteDeleteAsync();
            
            // Reset Sources last fetched time to trigger immediate re-ingest
            await _context.ThreatSources.ExecuteUpdateAsync(s => s.SetProperty(x => x.LastFetchedAt, DateTime.MinValue));

            return Ok("Database threats cleared and ingestion reset.");
        }
        catch (Exception ex)
        {
            return BadRequest($"Reset Failed: {ex.Message} {ex.InnerException?.Message}");
        }
    }
}

public class SystemSettingDto
{
    public required string Key { get; set; }
    public required string Value { get; set; }
    public string? Category { get; set; }
}

public class UiPreferencesDto
{
    public required string PreferencesJson { get; set; }
}

public class UserSettingsDto
{
    public string? UiPreferencesJson { get; set; }
    public bool MfaEnabled { get; set; }
    public string? TelegramChatId { get; set; }
}
