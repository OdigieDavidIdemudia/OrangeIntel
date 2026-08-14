using System;

namespace TealHunt.Domain.Entities;

public class AuditLog
{
    public int Id { get; set; }
    public string? UserId { get; set; } // Nullable if action is by system or unknown user
    public string Action { get; set; } = string.Empty; // e.g., "login", "create_user"
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    // Navigation property - Optional
    public AppUser? User { get; set; }
}
