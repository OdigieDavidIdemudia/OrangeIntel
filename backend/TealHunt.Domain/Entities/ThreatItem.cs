using TealHunt.Domain.Enums;
using System.Text.Json;

namespace TealHunt.Domain.Entities;

public class ThreatItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid SourceId { get; set; }
    public ThreatSource? Source { get; set; }

    public string Title { get; set; } = string.Empty;
    public string OriginalTitle { get; set; } = string.Empty; // ADDED
    public string ThreatType { get; set; } = string.Empty; // e.g. CVE, Malware
    public string AttackVector { get; set; } = string.Empty;
    public string DeliveryMechanism { get; set; } = string.Empty;
    public string EnvironmentRelevance { get; set; } = string.Empty; // e.g. Banking
    public string AssignedTeam { get; set; } = string.Empty;
    public int Severity { get; set; } // 1-10
    public int Confidence { get; set; } // 1-100
    public string Summary { get; set; } = string.Empty;
    public string OriginalSummary { get; set; } = string.Empty; // ADDED
    public string Language { get; set; } = "en"; // ADDED

    // Postgres JSONB
    public string MetadataJson { get; set; } = "{}"; // Store as string for EF if using simple mapping, or JsonDocument
    
    public DateTime? FirstSeen { get; set; }
    public DateTime? LastSeen { get; set; }
    public string HashDedup { get; set; } = string.Empty;
    public DateTime IngestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcceptedAt { get; set; }
    
    // Navigation
    public List<Indicator> Indicators { get; set; } = new();
    
    // Status for workflow (replaces TopicStatus)
    public ThreatStatus Status { get; set; } // Keep Enum or refactor? Let's use existing Enum for now
    
    // Category & Workflow Enhancements
    public string Category { get; set; } = string.Empty;
    public string AcknowledgedBy { get; set; } = string.Empty;
    public DateTime? AcknowledgedAt { get; set; }
    public string AcknowledgementNote { get; set; } = string.Empty;
}
