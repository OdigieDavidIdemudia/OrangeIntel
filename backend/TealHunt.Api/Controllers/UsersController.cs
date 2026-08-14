using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TealHunt.Api.Dtos;
using TealHunt.Application.Interfaces;
using TealHunt.Domain.Entities;
using TealHunt.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace TealHunt.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IAuditService _auditService;
    private readonly ApplicationDbContext _context; 
    private readonly IEnumerable<INotificationProvider> _notificationProviders;

    public UsersController(
        UserManager<AppUser> userManager, 
        IAuditService auditService, 
        ApplicationDbContext context,
        IEnumerable<INotificationProvider> notificationProviders)
    {
        _userManager = userManager;
        _auditService = auditService;
        _context = context;
        _notificationProviders = notificationProviders;
    }

    [HttpGet("profile")]
    public async Task<ActionResult<UserProfileDto>> GetProfile()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        var roles = await _userManager.GetRolesAsync(user);

        return new UserProfileDto
        {
            Id = user.Id,
            Email = user.Email!,
            UserName = user.UserName!,
            Roles = roles.ToList(),
            MfaEnabled = !string.IsNullOrEmpty(user.MfaSecret),
            MfaEnforced = user.MfaEnforced,
            RequiresPasswordChange = user.RequiresPasswordChange,
            FullName = user.FullName,
            TelegramChatId = user.TelegramChatId,
            NotificationPreferencesJson = user.NotificationPreferencesJson
        };
    }

    [HttpPut("profile")]
    public async Task<ActionResult> UpdateProfile([FromBody] UpdateProfileDto model)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        user.FullName = model.FullName;
        user.TelegramChatId = model.TelegramChatId;
        
        if (!string.IsNullOrEmpty(model.UserName) && model.UserName != user.UserName)
        {
            user.UserName = model.UserName;
        }

        await _userManager.UpdateAsync(user);

        await _auditService.LogAsync(user.Id, "update_profile", "Updated profile details");

        return Ok();
    }

    [HttpPut("settings/notifications")]
    public async Task<ActionResult> UpdateNotificationSettings([FromBody] UpdateNotificationSettingsDto model)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        user.NotificationPreferencesJson = model.NotificationPreferencesJson;
        await _userManager.UpdateAsync(user);
        
        await _auditService.LogAsync(user.Id, "update_notifications", "Updated notification preferences");

        return Ok();
    }

    [HttpPost("change-password")]
    public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordDto model)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        // Clear the forced-change flag and record the date
        user.RequiresPasswordChange = false;
        user.LastPasswordChangeDate = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        await _auditService.LogAsync(user.Id, "change_password", "Changed password successfully");

        return Ok("Password changed successfully");
    }

    [HttpGet]
    [Authorize(Roles = "admin,super_admin")]
    public async Task<ActionResult<List<UserProfileDto>>> ListUsers()
    {
        var users = await _context.Users.ToListAsync();
        var userDtos = new List<UserProfileDto>();

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            userDtos.Add(new UserProfileDto
            {
                Id = user.Id,
                Email = user.Email!,
                UserName = user.UserName!,
                Roles = roles.ToList(),
                MfaEnabled = !string.IsNullOrEmpty(user.MfaSecret),
                FullName = user.FullName,
                TelegramChatId = user.TelegramChatId,
                NotificationPreferencesJson = user.NotificationPreferencesJson
            });
        }
        return userDtos;
    }

    [HttpPost]
    [Authorize(Roles = "admin,super_admin")]
    public async Task<ActionResult> CreateUser([FromBody] CreateUserDto model)
    {
        var currentUser = await _userManager.GetUserAsync(User);

        if (await _userManager.FindByEmailAsync(model.Email) != null)
        {
            return BadRequest("User with this email already exists.");
        }

        var newUser = new AppUser
        {
            UserName = model.UserName,
            Email = model.Email,
            EmailConfirmed = true, 
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(newUser, model.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);

        if (!string.IsNullOrEmpty(model.Role) && model.Role != "User")
        {
            await _userManager.AddToRoleAsync(newUser, model.Role);
        }

        await _auditService.LogAsync(currentUser!.Id, "create_user", $"Created user {newUser.UserName}");
        return Ok();
    }

    // Since Identity usually handles updates via specific managers, 
    // a simple update endpoint might just handle role changes for now.
    [HttpPatch("{id}")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult> UpdateUser(string id, [FromBody] UpdateUserRoleDto model)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        var targetUser = await _userManager.FindByIdAsync(id);
        
        if (targetUser == null) return NotFound();

        // Update Role if provided
        if (!string.IsNullOrEmpty(model.NewRole))
        {
            var existingRoles = await _userManager.GetRolesAsync(targetUser);
            await _userManager.RemoveFromRolesAsync(targetUser, existingRoles);
            
            if (model.NewRole != "User")
            {
                await _userManager.AddToRoleAsync(targetUser, model.NewRole);
            }
        }

        await _auditService.LogAsync(currentUser!.Id, "update_user", $"Updated user {targetUser.UserName ?? targetUser.Email}");
        return Ok();
    }

    [HttpPost("profile/test-telegram")]
    public async Task<ActionResult> TestTelegram([FromQuery] string? chatId, [FromServices] ISystemSettingService settingService, [FromServices] Microsoft.Extensions.Configuration.IConfiguration config)
    {
        var user = await _userManager.GetUserAsync(User);
        var targetChatId = chatId ?? user?.TelegramChatId;

        if (string.IsNullOrEmpty(targetChatId))
            return BadRequest("No Chat ID provided. Enter your Telegram Chat ID in Account settings first.");

        // 1. Check user's personal bot token from UserApiKeys
        var userBotToken = string.Empty;
        if (user != null)
        {
            var userKey = await _context.UserApiKeys
                .FirstOrDefaultAsync(k => k.UserId == user.Id && k.KeyName == "telegram_bot_token");
            if (userKey != null && !string.IsNullOrEmpty(userKey.KeyValue))
                userBotToken = userKey.KeyValue;
        }

        // 2. Fall back to global system setting (admin-configured)
        if (string.IsNullOrEmpty(userBotToken))
            userBotToken = await settingService.GetSettingAsync("telegram_bot_token", string.Empty);

        // 3. Fall back to IConfiguration (env vars / appsettings)
        if (string.IsNullOrEmpty(userBotToken))
            userBotToken = config["Telegram:BotToken"] ?? string.Empty;

        if (string.IsNullOrEmpty(userBotToken) || userBotToken == "<BOT_TOKEN>")
            return BadRequest("No Telegram Bot Token configured. Add your bot token in 'My API Keys' settings.");

        // Send directly — bypass the provider so we use the resolved token above
        var title = "🛡️ TealHunt | Connection Test";
        var body = $"Hello {user?.FullName ?? "Analyst"},\n\nThis is a test notification confirming your Chat ID is correctly linked to TealHunt.\n\nTime: {DateTime.Now:f}";
        var message = $"{title}\n\n{body}";
        var url = $"https://api.telegram.org/bot{userBotToken}/sendMessage";
        var payload = new { chat_id = targetChatId, text = message, parse_mode = "Markdown" };

        try
        {
            using var http = new System.Net.Http.HttpClient();
            var content = new System.Net.Http.StringContent(
                System.Text.Json.JsonSerializer.Serialize(payload),
                System.Text.Encoding.UTF8, "application/json");
            var response = await http.PostAsync(url, content);
            if (response.IsSuccessStatusCode)
                return Ok("Test message sent successfully! Check your Telegram.");

            var error = await response.Content.ReadAsStringAsync();
            return BadRequest($"Telegram API rejected the request: {error}. Check your Bot Token is correct and you have sent /start to the bot.");
        }
        catch (Exception ex)
        {
            return BadRequest($"Connection failed: {ex.Message}");
        }
    }
}

