using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TealHunt.Api.Dtos;
using TealHunt.Application.Interfaces;
using TealHunt.Domain.Entities;

namespace TealHunt.Api.Controllers;

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
                CreatedAt = user.CreatedAt,
                MfaEnforced = user.MfaEnforced,
                RequiresPasswordChange = user.RequiresPasswordChange
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
            CreatedAt = DateTime.UtcNow,
            RequiresPasswordChange = true  // Force password change on first login
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
    public async Task<ActionResult> ResetPassword(string id, [FromBody] AdminResetPasswordDto model)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var callerIsSuperAdmin = User.IsInRole("super_admin");
        var targetRoles = await _userManager.GetRolesAsync(user);

        // Admins can only reset Analyst passwords
        if (!callerIsSuperAdmin && (targetRoles.Contains("admin") || targetRoles.Contains("super_admin")))
            return Forbid();

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, model.NewPassword);
        
        if (!result.Succeeded) return BadRequest(result.Errors);

        // Security requirement: Revoke all existing sessions and enforce change
        user.TokenVersion++;
        user.RequiresPasswordChange = true;
        await _userManager.UpdateAsync(user);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "admin_reset_password", $"Admin reset password for user {user.UserName ?? user.Email}");

        return Ok("Password reset successfully and sessions revoked.");
    }

    [HttpPost("users/{id}/mfa/enforce")]
    public async Task<ActionResult> EnforceMfa(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var callerIsSuperAdmin = User.IsInRole("super_admin");
        var targetRoles = await _userManager.GetRolesAsync(user);

        // Admins can only enforce MFA for Analysts
        if (!callerIsSuperAdmin && (targetRoles.Contains("admin") || targetRoles.Contains("super_admin")))
            return Forbid();

        user.MfaEnforced = true;
        await _userManager.UpdateAsync(user);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "enforce_mfa", $"Enforced 2FA for user {user.UserName ?? user.Email}");

        return Ok("2FA enforced successfully.");
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<List<AuditLog>>> GetAuditLogs()
    {
        var logs = await _auditService.GetLogsAsync(200);
        var callerIsSuperAdmin = User.IsInRole("super_admin");

        if (callerIsSuperAdmin)
            return logs;

        // Admins only see logs where they are the actor, or logs that don't involve super_admins/admins (filtering target logs is harder since AuditLog doesn't have target user ID structured)
        // A simple approach: Admins only see their own logs for now, or logs where action was 'create_user' / 'admin_reset_password' and they were the actor.
        var currentUserId = _userManager.GetUserId(User);
        return logs.Where(l => l.UserId == currentUserId).ToList();
    }
}
