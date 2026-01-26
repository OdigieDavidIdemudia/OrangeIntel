namespace OrangeIntel.Domain.Entities;

public class Indicator
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid ThreatId { get; set; }
    public ThreatItem? Threat { get; set; }

    public string IndicatorType { get; set; } = string.Empty; // IP, Domain, Hash
    public string IndicatorValue { get; set; } = string.Empty;
    public int Confidence { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
