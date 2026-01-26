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
        var users = await _userManager.Users.ToListAsync();
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
                SignalPhoneNumber = user.SignalPhoneNumber,
                CreatedAt = user.CreatedAt
            });
        }

        return userDtos;
    }

    [HttpPost("users")]
    public async Task<ActionResult> CreateUser([FromBody] CreateUserDto model)
    {
        var user = new AppUser
        {
            UserName = model.Email,
            Email = model.Email,
            EmailConfirmed = true // Auto-confirm/verify not required for initial create by admin
        };

        var result = await _userManager.CreateAsync(user, model.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);

        // Assign role
        var role = !string.IsNullOrEmpty(model.Role) ? model.Role : "analyst";
        await _userManager.AddToRoleAsync(user, role);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "create_user", $"Created user {model.Email} with role {role}");

        return Ok(new { Message = "User created successfully" });
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
        await _auditService.LogAsync(currentUserId, "assign_role", $"Updated user {user.Email} role to {model.NewRole}");

        return Ok();
    }

    [HttpPost("users/{id}/mfa/reset")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult> ResetMfa(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        user.MfaSecret = null;
        await _userManager.UpdateAsync(user);

        var currentUserId = _userManager.GetUserId(User) ?? "unknown";
        await _auditService.LogAsync(currentUserId, "reset_mfa", $"Reset MFA for user {user.Email}");

        return Ok("MFA reset successfully");
    }
}
