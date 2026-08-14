namespace TealHunt.Domain.Enums;

public enum ThreatStatus
{
    New,
    Analyzing,
    Promoted,
    Archived,
    Acknowledged
}

public enum AdvisorySeverity
{
    Low,
    Medium,
    High,
    Critical
}

public enum RiskRating
{
    Negligible,
    Low,
    Medium,
    High,
    Critical
}
