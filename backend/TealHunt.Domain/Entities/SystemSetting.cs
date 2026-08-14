namespace TealHunt.Domain.Entities;

public class SystemSetting
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // Unique key for the setting (e.g., "intelligence_config")
    public required string Key { get; set; }
    
    // JSON value
    public required string Value { get; set; }
    
    public string? Category { get; set; }
    
    public string? LastUpdatedBy { get; set; }
    
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
}
