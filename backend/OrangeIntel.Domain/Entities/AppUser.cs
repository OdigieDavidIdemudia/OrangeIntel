using Microsoft.AspNetCore.Identity;

namespace OrangeIntel.Domain.Entities;

public class AppUser : IdentityUser
{
    // Role is handled by IdentityRole, but we can keep a helper property if strictly needed for simple checks, 
    // though it's better to rely on UserManager.GetRolesAsync.
    // We will remove the explicit Role string property to enforce using Identity Roles.
    
    public string? MfaSecret { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
    
    public string? FullName { get; set; }
    public string? TelegramChatId { get; set; }
    
    // JSON blob for storing granular notification preferences
    // e.g. { "topic_promotion": true, "advisory_recommendation": true }
    public string? NotificationPreferencesJson { get; set; }
    
    // JSON blob for UI preferences (theme, density, etc.)
    public string? UiPreferencesJson { get; set; }
    
    // Security Versioning
    public int TokenVersion { get; set; } = 0;

    // Advanced Security Enforcement
    public bool RequiresPasswordChange { get; set; } = false;
    public bool MfaEnforced { get; set; } = false;
    public DateTime? LastPasswordChangeDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
