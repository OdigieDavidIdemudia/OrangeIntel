using OrangeIntel.Domain.Enums;

namespace OrangeIntel.Domain.Entities;

public class Assessment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AdvisoryId { get; set; }
    public Advisory? Advisory { get; set; }

    public string ExecutiveSummary { get; set; } = string.Empty;
    public string BusinessImpact { get; set; } = string.Empty;
    public RiskRating RiskRating { get; set; }
    public string ConfidenceStatement { get; set; } = string.Empty;

    // Strict Report Fields
    public List<string> ImpactedServices { get; set; } = new();
    public List<string> Systems { get; set; } = new();
    public List<string> Applications { get; set; } = new();
    public List<string> DataTypes { get; set; } = new();

    public List<string> ImmediateActions { get; set; } = new();
    public List<string> ShortTermActions { get; set; } = new();
    public List<string> LongTermActions { get; set; } = new();
    
    public string? ApprovedById { get; set; }
    public DateTime? ApprovedAt { get; set; }
}
