using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrangeIntel.Api.Dtos;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "super_admin,admin")]
public class AdminController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IAuditService _auditService;

    public AdminController(UserManager<AppUser> userManager, IAuditService auditService)
    {
        _userManager = userManager;
        _auditService = auditService;
    }

    [HttpGet("users")]
    public async Task<ActionResult<List<UserProfileDto>>> ListUsers()
    {
        var callerIsSuperAdmin = User.IsInRole("super_admin");
        var users = await _userManager.Users.ToListAsync();
        var userDtos = new List<UserProfileDto>();

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);

            // Admins cannot see super_admin accounts
            if (!callerIsSuperAdmin && roles.Contains("super_admin"))
                continue;

            userDtos.Add(new UserProfileDto
            {
                Id = user.Id,
                Email = user.Email!,
                UserName = user.UserName!,
                Roles = roles.ToList(),
                MfaEnabled = !string.IsNullOrEmpty(user.MfaSecret),
                FullName = user.FullName,
                TelegramChatId = user.TelegramChatId,
                CreatedAt = user.CreatedAt
            });
        }

        return userDtos;
    }

    [HttpPost("users")]
    public async Task<ActionResult> CreateUser([FromBody] CreateUserDto model)
    {
        // Normalize role to lowercase to match seeded role names
        var role = !string.IsNullOrEmpty(model.Role) ? model.Role.ToLower() : "analyst";

        // Admins can only create analysts — only super_admins can elevate roles
        if (!User.IsInRole("super_admin") && role != "analyst")
            return Forbid();

        // Validate role exists
        var validRoles = new[] { "super_admin", "admin", "analyst" };
        if (!validRoles.Contains(role))
            return BadRequest(new { message = $"Invalid role '{role}'. Must be one of: {string.Join(", ", validRoles)}" });

        var user = new AppUser
        {
            UserName = string.IsNullOrWhiteSpace(model.UserName) ? model.Email : model.UserName,
            Email = model.Email,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, model.Password);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => new { message = e.Description }).ToList();
            return BadRequest(new { message = string.Join(" ", result.Errors.Select(e => e.Description)), errors });
        }

        await _userManager.AddToRoleAsync(user, role);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "create_user", $"Created user {user.UserName} with role {role}");

        return Ok(new { message = "User created successfully" });
    }

    [HttpPut("users/{id}/role")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult> UpdateRole(string id, [FromBody] UpdateUserRoleDto model)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var currentRoles = await _userManager.GetRolesAsync(user);
        await _userManager.RemoveFromRolesAsync(user, currentRoles);
        await _userManager.AddToRoleAsync(user, model.NewRole);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "assign_role", $"Updated user {user.UserName ?? user.Email} role to {model.NewRole}");

        return Ok();
    }

    [HttpPost("users/{id}/mfa/reset")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult> ResetMfa(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        user.MfaSecret = null;
        user.TokenVersion++;
        await _userManager.UpdateAsync(user);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "reset_mfa", $"Reset MFA and revoked sessions for user {user.UserName ?? user.Email}");

        return Ok("MFA reset successfully and sessions revoked.");
    }

    [HttpDelete("users/{id}")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult> DeleteUser(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "delete_user", $"Deleted user {user.UserName ?? user.Email}");

        return Ok("User deleted successfully");
    }

    [HttpPost("users/{id}/sessions/revoke")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult> RevokeSessions(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        user.TokenVersion++;
        await _userManager.UpdateAsync(user);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "revoke_sessions", $"Revoked all sessions for user {user.UserName ?? user.Email}");

        return Ok("All sessions have been revoked.");
    }

    [HttpPost("users/{id}/password/reset")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult> ResetPassword(string id, [FromBody] AdminResetPasswordDto model)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, model.NewPassword);
        
        if (!result.Succeeded) return BadRequest(result.Errors);

        // Security requirement: Revoke all existing sessions on password reset
        user.TokenVersion++;
        await _userManager.UpdateAsync(user);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "admin_reset_password", $"Admin reset password for user {user.UserName ?? user.Email}");

        return Ok("Password reset successfully and sessions revoked.");
    }
}
