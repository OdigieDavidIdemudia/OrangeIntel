using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using System.Text;

namespace OrangeIntel.Application.Services;

public interface INotificationService
{
    Task NotifyPromotionAsync(ThreatItem threat);
    Task NotifyAdvisoryPublishedAsync(Advisory advisory);
    Task NotifyIngestionAsync(ThreatItem threat);
}

public class NotificationService : INotificationService
{
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationService> _logger;
    private readonly ISystemSettingService _settings;

    public NotificationService(
        IEnumerable<INotificationProvider> providers, 
        IConfiguration config, 
        ILogger<NotificationService> logger,
        ISystemSettingService settings)
    {
        _providers = providers;
        _config = config;
        _logger = logger;
        _settings = settings;
    }

    public async Task NotifyPromotionAsync(ThreatItem threat)
    {
        // 1. Signal Legacy Logic
        await NotifySignalAsync(threat);

        // 2. Telegram Logic with Triggers/Conditions
        await NotifyTelegramThreatAsync(threat);
    }

    public async Task NotifyAdvisoryPublishedAsync(Advisory advisory)
    {
        var botToken = _config["Telegram:BotToken"];
        if (string.IsNullOrEmpty(botToken) || botToken == "<BOT_TOKEN>") return;

        var title = "📄 OrangeIntel | Advisory Published";
        var body = $"""
Title: {advisory.Title}
Classification: {advisory.Classification}
Impacted Sectors: {string.Join(", ", advisory.ImpactedSectors)}
Confidence: {advisory.Confidence}%

Action:
Review the full advisory in OrangeIntel.
""";

        var provider = _providers.FirstOrDefault(p => p.Name == "Telegram");
        if (provider != null)
        {
            await provider.SendAsync("", title, body);
        }
    }

    private async Task NotifyTelegramThreatAsync(ThreatItem threat)
    {
        var minSeverity = await _settings.GetIntSettingAsync("notify_min_severity", 7);
        var minConfidence = await _settings.GetIntSettingAsync("notify_min_confidence", 70);

        bool isHighSeverity = threat.Severity >= minSeverity || threat.Confidence >= minConfidence;
        bool isFinancial = threat.EnvironmentRelevance == "Financial";

        if (!isHighSeverity || !isFinancial)
        {
            _logger.LogInformation("Telegram notification skipped for threat {Id}: Severity {Severity}, Sector {Sector} does not match trigger criteria.", threat.Id, threat.Severity, threat.EnvironmentRelevance);
            return;
        }

        var template = _config["Telegram:MessageTemplate"] ?? "🚨 {severity} Threat Detected\n\nTitle: {title}\nSector: {sector}\nSource: {source}\n\nAction: Review immediately in OrangeIntel";
        
        var severityLabel = threat.Severity >= 9 ? "Critical" : "High";
        
        var message = template
            .Replace("{severity}", severityLabel)
            .Replace("{title}", threat.Title)
            .Replace("{sector}", threat.EnvironmentRelevance)
            .Replace("{source}", threat.Source?.Name ?? "Unknown");

        var title = $"🚨 {severityLabel} Threat Accepted";
        
        var provider = _providers.FirstOrDefault(p => p.Name == "Telegram");
        if (provider != null)
        {
            await provider.SendAsync("", title, message);
        }
    }

    private async Task NotifySignalAsync(ThreatItem threat)
    {
        var minSeverity = await _settings.GetIntSettingAsync("notify_min_severity", 7);
        var minConfidence = await _settings.GetIntSettingAsync("notify_min_confidence", 70);

        if (threat.Severity < minSeverity && threat.Confidence < minConfidence) return;

        var recipient = _config["Signal:GroupId"];
        if (string.IsNullOrEmpty(recipient)) return;

        var title = "🟠 OrangeIntel | New Threat Topic";
        var body = $"""
Topic: {threat.Title}
Threat Type: {threat.ThreatType}
Severity: {threat.Severity}/10
Confidence: {threat.Confidence}%
Relevant Sector: {threat.EnvironmentRelevance}

Why this matters:
{threat.Summary}

Action:
Review and decide if advisory is required.
""";

        var provider = _providers.FirstOrDefault(p => p.Name == "Signal");
        if (provider != null)
        {
            await provider.SendAsync(recipient, title, body);
        }
    }
    public async Task NotifyIngestionAsync(ThreatItem threat)
    {
        // Only notify if it meets the global threshold
        var minSeverity = await _settings.GetIntSettingAsync("notify_min_severity", 7);
        var minConfidence = await _settings.GetIntSettingAsync("notify_min_confidence", 70);

        if (threat.Severity >= minSeverity || threat.Confidence >= minConfidence)
        {
            var title = $"🆕 New {GetSeverityLabel(threat.Severity)} Threat Ingested";
            var template = _config["Telegram:MessageTemplate"] ?? "🚨 {severity} Threat Detected\n\nTitle: {title}\nSector: {sector}\nSource: {source}\n\nAction: Review immediately in OrangeIntel";
            
            var message = template
                .Replace("{severity}", GetSeverityLabel(threat.Severity))
                .Replace("{title}", threat.Title)
                .Replace("{sector}", threat.EnvironmentRelevance ?? "General")
                .Replace("{source}", threat.Source?.Name ?? "Unknown");

            var provider = _providers.FirstOrDefault(p => p.Name == "Telegram");
            if (provider != null)
            {
                await provider.SendAsync("", title, message);
            }
        }
    }

    private string GetSeverityLabel(int severity)
    {
        if (severity >= 9) return "Critical";
        if (severity >= 7) return "High";
        if (severity >= 4) return "Medium";
        return "Low";
    }
}
