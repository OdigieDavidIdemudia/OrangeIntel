using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OrangeIntel.Api.Dtos;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace OrangeIntel.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IAuditService _auditService;
    private readonly ApplicationDbContext _context; // Required for listing with EF

    public UsersController(UserManager<AppUser> userManager, IAuditService auditService, ApplicationDbContext context)
    {
        _userManager = userManager;
        _auditService = auditService;
        _context = context;
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
            UserName = model.Email,
            Email = model.Email,
            EmailConfirmed = true, // Auto-confirm for manually created users
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(newUser, model.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);

        if (!string.IsNullOrEmpty(model.Role) && model.Role != "User")
        {
            await _userManager.AddToRoleAsync(newUser, model.Role);
        }

        await _auditService.LogAsync(currentUser!.Id, "create_user", $"Created user {model.Email}");
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

        await _auditService.LogAsync(currentUser!.Id, "update_user", $"Updated user {targetUser.Email}");
        return Ok();
    }
}
