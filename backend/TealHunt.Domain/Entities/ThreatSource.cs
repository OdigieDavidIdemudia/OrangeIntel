namespace TealHunt.Domain.Entities;

public class ThreatSource
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool RequiresApiKey { get; set; }
    public int PollIntervalMinutes { get; set; }
    public DateTime? LastFetchedAt { get; set; }
    public bool Enabled { get; set; } = true;
}
