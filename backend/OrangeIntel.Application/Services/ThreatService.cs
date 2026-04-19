using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Domain.Enums;
using OrangeIntel.Application.DTOs;
using System.Linq;
using System.Collections.Generic;
using System;
using System.Threading.Tasks;

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
        var all = await _repository.GetAllAsync();
        return all.Where(t => t.Status == ThreatStatus.New || t.Status == ThreatStatus.Analyzing);
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

    public async Task<DateTime?> GetLastAcceptedThreatTimeAsync()
    {
        var latest = await _repository.GetAllAsync(); 
        var lastAccepted = latest
            .Where(t => t.Status == ThreatStatus.Promoted)
            .OrderByDescending(t => t.IngestedAt)
            .FirstOrDefault();

        return lastAccepted?.IngestedAt;
    }

    public async Task<Dictionary<string, int>> GetAcceptedThreatCountsBySeverityAsync()
    {
        var allThreats = await _repository.GetAllAsync();
        var accepted = allThreats.Where(t => t.Status == ThreatStatus.Promoted);

        int high = 0;
        int medium = 0;
        int low = 0;

        foreach (var t in accepted)
        {
            if (t.Confidence >= 70) high++;
            else if (t.Confidence >= 40) medium++;
            else low++;
        }

        return new Dictionary<string, int>
        {
            { "High", high },
            { "Medium", medium },
            { "Low", low }
        };
    }

    public async Task<IEnumerable<ThreatItem>> GetRecentAcceptedThreatsAsync(int count)
    {
        var all = await _repository.GetAllAsync();
        return all
            .Where(t => t.Status == ThreatStatus.Promoted)
            .OrderByDescending(t => t.IngestedAt)
            .Take(count);
    }

    public async Task<ThreatVelocityDto> GetThreatVelocityAsync()
    {
        var all = await _repository.GetAllAsync();
        var promoted = all.Where(t => t.Status == ThreatStatus.Promoted).ToList();
        
        if (!promoted.Any()) return new ThreatVelocityDto { Status = "Normal", BaselineRate = 0, CurrentRate = 0 };

        var now = DateTime.UtcNow;
        var oneHourAgo = now.AddHours(-1);
        var twentyFourHoursAgo = now.AddHours(-24);

        var last24hCount = promoted.Count(t => t.IngestedAt >= twentyFourHoursAgo);
        var baselineRate = last24hCount / 24.0;
        var currentRate = promoted.Count(t => t.IngestedAt >= oneHourAgo);

        string status = "Normal";
        if (baselineRate > 0.5 && currentRate > (baselineRate * 2))
        {
            status = "SpikeDetected";
        }

        return new ThreatVelocityDto 
        { 
            Status = status, 
            BaselineRate = Math.Round(baselineRate, 2), 
            CurrentRate = currentRate 
        };
    }

    public async Task<DashboardMetricsDto> GetDashboardMetricsAsync()
    {
        var all = await _repository.GetAllAsync();
        // Count ALL threats for SOC Wallboard metrics (not just promoted)
        var allThreats = all.ToList();
        
        var now = DateTime.UtcNow;
        var oneHourAgo = now.AddHours(-1);

        var counts = new Dictionary<string, PriorityMetric>
        {
            { "High", new PriorityMetric() },
            { "Medium", new PriorityMetric() },
            { "Low", new PriorityMetric() }
        };

        int highCurrent = 0, mediumCurrent = 0, lowCurrent = 0;
        int high1h = 0, medium1h = 0, low1h = 0;

        foreach(var t in allThreats)
        {
            bool isHigh = t.Confidence >= 70;
            bool isMedium = t.Confidence >= 40 && t.Confidence < 70;
            bool isLow = t.Confidence < 40;

            if (isHigh) highCurrent++;
            else if (isMedium) mediumCurrent++;
            else lowCurrent++;

            if (t.IngestedAt.ToUniversalTime() < oneHourAgo)
            {
                if (isHigh) high1h++;
                else if (isMedium) medium1h++;
                else low1h++;
            }
        }

        counts["High"].Count = highCurrent;
        counts["High"].DeltaSinceOneHour = highCurrent - high1h;
        counts["Medium"].Count = mediumCurrent;
        counts["Medium"].DeltaSinceOneHour = mediumCurrent - medium1h;
        counts["Low"].Count = lowCurrent;
        counts["Low"].DeltaSinceOneHour = lowCurrent - low1h;

        var last24hCount = allThreats.Count(t => t.IngestedAt >= now.AddHours(-24));
        var baselineRate = last24hCount / 24.0;
        var currentRate = allThreats.Count(t => t.IngestedAt >= oneHourAgo);
        string velocityStatus = "Normal";
        if (baselineRate > 0.5 && currentRate > (baselineRate * 2)) velocityStatus = "SpikeDetected";

        var lastCritical = allThreats.Where(t => t.Confidence >= 70).OrderByDescending(t => t.IngestedAt).FirstOrDefault();
        TimeSpan? timeSinceCritical = lastCritical != null ? now - lastCritical.IngestedAt : null;

        string overallState = "CALM";
        if (highCurrent > 0 || velocityStatus == "SpikeDetected") overallState = "CRITICAL";
        else if (mediumCurrent > 0 || currentRate > (baselineRate * 1.5)) overallState = "ELEVATED";

        // Segmented Metrics Calculations
        var severityCounts = new Dictionary<string, int> { { "Critical", 0 }, { "High", 0 }, { "Medium", 0 }, { "Low", 0 } };
        var environmentThreats = new Dictionary<string, int> { { "Financial", 0 }, { "Hospitality", 0 }, { "Healthcare", 0 }, { "Telecom", 0 }, { "Technology", 0 }, { "General", 0 } };
        var teamDistribution = new Dictionary<string, int> { { "SOC", 0 }, { "Threat Intelligence", 0 }, { "Vulnerability Management", 0 }, { "IT Security", 0 } };
        var riskDistribution = new Dictionary<string, double> { { "Critical", 0 }, { "High", 0 }, { "Medium", 0 }, { "Low", 0 } };

        foreach (var t in allThreats)
        {
            var classification = ClassifyThreat(t);
            severityCounts[classification.SeverityLabel]++;
            environmentThreats[classification.Environment]++;
            teamDistribution[classification.Team]++;
        }

        int total = allThreats.Count;
        if (total > 0)
        {
            riskDistribution["Critical"] = Math.Round((double)severityCounts["Critical"] / total * 100, 1);
            riskDistribution["High"] = Math.Round((double)severityCounts["High"] / total * 100, 1);
            riskDistribution["Medium"] = Math.Round((double)severityCounts["Medium"] / total * 100, 1);
            riskDistribution["Low"] = Math.Round((double)severityCounts["Low"] / total * 100, 1);
        }

        // For RECENT THREATS: Show pending threats from last 60 days
        var twoMonthsAgo = now.AddDays(-60);
        var recent = all
            .Where(t => t.IngestedAt >= twoMonthsAgo && (t.Status == ThreatStatus.New || t.Status == ThreatStatus.Analyzing))
            .OrderByDescending(t => t.IngestedAt)
            .Take(50)
            .ToList();

        return new DashboardMetricsDto
        {
            OverallState = overallState,
            ThreatCounts = counts,
            SeverityCounts = severityCounts,
            EnvironmentThreats = environmentThreats,
            TeamDistribution = teamDistribution,
            RiskDistribution = riskDistribution,
            Velocity = new ThreatVelocityDto 
            { 
                Status = velocityStatus, 
                BaselineRate = Math.Round(baselineRate, 2), 
                CurrentRate = currentRate 
            },
            TimeSinceLastCriticalThreat = timeSinceCritical,
            LastCriticalThreatTime = lastCritical?.IngestedAt,
            RecentThreats = recent,
            SystemHealth = new SystemHealthDto 
            {
                Status = "Healthy",
                Database = "Connected",
                Ingestion = "Active",
                IngestLatencyMs = 125, 
                ErrorCount24h = 0,
                LastCorrelationRun = now.AddMinutes(-5)
            }
        };
    }

    public async Task<IEnumerable<ThreatItem>> GetFilteredIntelligenceAsync(string? priority, int? days, string? sector, DateTime? startDate = null, DateTime? endDate = null)
    {
        var all = await _repository.GetAllAsync();
        var query = all.AsQueryable();

        // 1. Priority Filter
        if (!string.IsNullOrEmpty(priority) && priority != "All")
        {
            query = priority.ToLower() switch
            {
                "high" => query.Where(t => t.Confidence >= 70),
                "medium" => query.Where(t => t.Confidence >= 40 && t.Confidence < 70),
                "low" => query.Where(t => t.Confidence < 40),
                _ => query
            };
        }

        // 2. Time Filter
        var now = DateTime.UtcNow;
        if (startDate.HasValue || endDate.HasValue)
        {
            if (startDate.HasValue) query = query.Where(t => t.IngestedAt >= startDate.Value);
            if (endDate.HasValue) query = query.Where(t => t.IngestedAt <= endDate.Value);
        }
        else if (days.HasValue && days.Value > 0)
        {
            var cutoff = now.AddDays(-days.Value);
            query = query.Where(t => t.IngestedAt >= cutoff);
        }

        // 3. Sector Filter
        if (!string.IsNullOrEmpty(sector) && sector != "All" && sector != "General")
        {
            query = query.Where(t => t.EnvironmentRelevance == sector);
        }

        return query.OrderByDescending(t => t.IngestedAt).ToList();
    }

    public async Task<bool> DiscardThreatAsync(Guid threatId)
    {
        var threat = await _repository.GetByIdAsync(threatId);
        if (threat == null) return false;

        threat.Status = ThreatStatus.Archived;
        await _repository.UpdateAsync(threat);
        return true;
    }

    public async Task<int> MigrateExistingThreatsAsync()
    {
        var all = await _repository.GetAllAsync();
        int updated = 0;
        foreach (var t in all)
        {
            var classification = ClassifyThreat(t);
            bool changed = false;
            
            if (string.IsNullOrEmpty(t.EnvironmentRelevance) || t.EnvironmentRelevance == "General")
            {
                t.EnvironmentRelevance = classification.Environment;
                changed = true;
            }

            if (string.IsNullOrEmpty(t.AssignedTeam))
            {
                t.AssignedTeam = classification.Team;
                changed = true;
            }

            if (changed)
            {
                await _repository.UpdateAsync(t);
                updated++;
            }
        }
        return updated;
    }

    private (string SeverityLabel, string Environment, string Team) ClassifyThreat(ThreatItem threat)
    {
        // 1. Severity Label
        string severityLabel = "Low";
        if (threat.Confidence >= 90 || threat.Severity >= 9) severityLabel = "Critical";
        else if (threat.Confidence >= 70 || threat.Severity >= 7) severityLabel = "High";
        else if (threat.Confidence >= 40 || threat.Severity >= 4) severityLabel = "Medium";

        // 2. Environment (Sector)
        string environment = "General";
        string content = (threat.Title + " " + threat.Summary + " " + threat.ThreatType).ToLowerInvariant();

        if (new[] { "banking", "payment", "fraud", "finance", "atm", "swift", "fintech" }.Any(k => content.Contains(k))) environment = "Financial";
        else if (new[] { "pos ", "hospitality", "hotel", "restaurant", "travel", "tourism" }.Any(k => content.Contains(k))) environment = "Hospitality";
        else if (new[] { "ransomware", "medical", "hospital", "health", "healthcare", "pharma", "clinical" }.Any(k => content.Contains(k))) environment = "Healthcare";
        else if (new[] { "sim swap", "telecom", "isp", "5g", "voip", "cellular", "carrier" }.Any(k => content.Contains(k))) environment = "Telecom";
        else if (new[] { "cloud", "software", "api", "devops", "saas", "tech", "it ", "developer", "server" }.Any(k => content.Contains(k))) environment = "Technology";
        else if (new[] { "gov", "federal", "ministry", "agency", "election", "public sector", "military", "defense" }.Any(k => content.Contains(k))) environment = "Government";
        else if (new[] { "energy", "utility", "power", "grid", "oil", "gas", "electricity", "water", "infrastructure" }.Any(k => content.Contains(k))) environment = "Energy";
        else if (new[] { "agric", "farm", "crop", "livestock", "food supply", "fishery", "harvest" }.Any(k => content.Contains(k))) environment = "Agriculture";
        else if (new[] { "school", "university", "education", "student", "college", "academic" }.Any(k => content.Contains(k))) environment = "Education";
        else if (new[] { "logistics", "supply chain", "shipping", "cargo", "delivery", "transport", "warehouse" }.Any(k => content.Contains(k))) environment = "Logistics";

        // 3. Team Routing
        string team = "IT Security";
        if (severityLabel == "Critical") team = "SOC";
        else if (severityLabel == "High") team = "Threat Intelligence";
        else if (severityLabel == "Medium") team = "Vulnerability Management";

        return (severityLabel, environment, team);
    }
}
