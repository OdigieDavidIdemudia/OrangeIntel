using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Domain.Enums;

namespace OrangeIntel.Application.Services;

public class ThreatService : IThreatService
{
    private readonly IThreatRepository _repository;
    private readonly IAdvisoryRepository _advisoryRepository;
    private readonly INotificationService _notificationService;

    public ThreatService(
        IThreatRepository repository,
        IAdvisoryRepository advisoryRepository,
        INotificationService notificationService)
    {
        _repository = repository;
        _advisoryRepository = advisoryRepository;
        _notificationService = notificationService;
    }

    public async Task<IEnumerable<ThreatItem>> GetThreatsAsync()
    {
        return await _repository.GetAllAsync();
    }

    public async Task<ThreatItem?> GetThreatByIdAsync(Guid id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task<Advisory?> PromoteThreatAsync(Guid threatId)
    {
        var threat = await _repository.GetByIdAsync(threatId);
        if (threat == null) return null;

        // Parse Metadata to extract tags if available
        var tags = new List<string>();
        string author = "System";
        try 
        {
            if (!string.IsNullOrEmpty(threat.MetadataJson))
            {
                var node = System.Text.Json.Nodes.JsonNode.Parse(threat.MetadataJson);
                if (node?["tags"] is System.Text.Json.Nodes.JsonArray tagArray)
                {
                    foreach (var t in tagArray) tags.Add(t.ToString());
                }
                if (node?["author_name"] != null) author = node["author_name"].ToString();
            }
        }
        catch { /* Ignore parsing errors */ }

        // Build Technical Details
        var detailsBuilder = new System.Text.StringBuilder();
        detailsBuilder.AppendLine($"**Source**: {author} via {threat.Source?.Name ?? "Unknown"}");
        detailsBuilder.AppendLine();
        detailsBuilder.AppendLine(threat.Summary);
        detailsBuilder.AppendLine();
        
        if (tags.Any())
        {
            detailsBuilder.AppendLine($"**Tags**: {string.Join(", ", tags)}");
            detailsBuilder.AppendLine();
        }

        if (threat.Indicators != null && threat.Indicators.Any())
        {
            detailsBuilder.AppendLine("### Indicators of Compromise");
            foreach (var indicator in threat.Indicators)
            {
                detailsBuilder.AppendLine($"- **{indicator.IndicatorType}**: `{indicator.IndicatorValue}`");
            }
        }

        var advisory = new Advisory
        {
            Title = threat.Title,
            ExecutiveSummary = threat.Summary, 
            TechnicalDetails = detailsBuilder.ToString(),
            ImpactedSectors = tags.Any() ? tags.Take(5).ToList() : new List<string> { "General" }, // Use tags as sectors/categories for now
            Classification = "TLP:AMBER",
            Confidence = threat.Confidence,
            CreatedById = "system",
            CreatedAt = DateTime.UtcNow,
            Status = AdvisoryStatus.Draft,
            RecommendedActions = "1. Block the listed indicators in all perimeter firewalls and proxies.\n2. Search historical logs (SIEM) for any traffic to/from these indicators.\n3. Quarantine any hosts that have communicated with these indicators."
        };

        await _advisoryRepository.AddAsync(advisory);
        
        threat.Status = ThreatStatus.Promoted;
        await _repository.UpdateAsync(threat);

        await _notificationService.NotifyPromotionAsync(threat);

        return advisory;
    }
}
