using System.ComponentModel.DataAnnotations;

namespace OrangeIntel.Api.Dtos;

public class UserProfileDto
{
    [System.Text.Json.Serialization.JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("userName")]
    public string UserName { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("roles")]
    public List<string> Roles { get; set; } = new();

    [System.Text.Json.Serialization.JsonPropertyName("mfaEnabled")]
    public bool MfaEnabled { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("signalPhoneNumber")]
    public string? SignalPhoneNumber { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("notificationPreferencesJson")]
    public string? NotificationPreferencesJson { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }
}

public class UpdateProfileDto
{
    [Phone]
    public string? SignalPhoneNumber { get; set; }
}

public class UpdateNotificationSettingsDto
{
    public string NotificationPreferencesJson { get; set; } = "{}";
}

public class ChangePasswordDto
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;
    
    [Required]
    [MinLength(12)]
    public string NewPassword { get; set; } = string.Empty;
}

public class CreateUserDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
    
    public string Role { get; set; } = "analyst";
}

public class UpdateUserRoleDto
{
    [Required]
    public string NewRole { get; set; } = string.Empty;
}
