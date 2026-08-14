using TealHunt.Domain.Enums;

namespace TealHunt.Domain.Entities;

public class Advisory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public string Title { get; set; } = string.Empty;
    public string Classification { get; set; } = string.Empty; // TLP:RED etc? Or standard string
    public List<string> ImpactedSectors { get; set; } = new();
    
    public string ExecutiveSummary { get; set; } = string.Empty;
    public string ConfidenceStatement { get; set; } = string.Empty; // Added
    public List<string> AffectedAssets { get; set; } = new(); // Added
    public List<string> Recommendations { get; set; } = new(); // Added (Replacing RecommendedActions usage)
    public List<string> IOCs { get; set; } = new(); // Added
    public string TechnicalDetails { get; set; } = string.Empty;
    public string AttackVector { get; set; } = string.Empty; // Added
    public int Severity { get; set; } // Added 0-3
    public List<string> References { get; set; } = new(); // Added
    public string RecommendedActions { get; set; } = string.Empty;
    
    // Strict Report Fields
    public string DeliveryMechanism { get; set; } = string.Empty;
    public string InitialAccess { get; set; } = string.Empty;
    public string Persistence { get; set; } = string.Empty;
    public string DefenseEvasion { get; set; } = string.Empty;
    public string CommandAndControl { get; set; } = string.Empty;
    public string Exfiltration { get; set; } = string.Empty;
    
    public int Confidence { get; set; } // 1-100
    
    public string CreatedById { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Status? Spec didn't mention, but we had Approved. keeping it implicitly or adding it?
    // Spec: "Analyst-approved threat advisories" -> implies they are approved.
    // But we might need draft state in builder.
    // I'll keep Status from previous if useful, or stick strictly to spec.
    // Spec doesn't show status column.
    // But our frontend needs draft/approved.
    // I will add Status back as it's critical for workflow.
    public AdvisoryStatus Status { get; set; } = AdvisoryStatus.Draft;
}

public enum AdvisoryStatus
{
    Draft,
    Approved,
    Archived
}
