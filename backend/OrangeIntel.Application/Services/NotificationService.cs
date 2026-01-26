using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Services;

public interface INotificationService
{
    Task NotifyPromotionAsync(ThreatItem threat);
    // Task NotifyAdvisoryRecommendedAsync(...); // Future
}

public class NotificationService : INotificationService
{
    private readonly INotificationProvider _provider;
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(INotificationProvider provider, IConfiguration config, ILogger<NotificationService> logger)
    {
        _provider = provider;
        _config = config;
        _logger = logger;
    }

    public async Task NotifyPromotionAsync(ThreatItem threat)
    {
        // 1. Check Logic / Policies
        var minSeverity = _config.GetValue<int>("NotificationPolicy:MinSeverity", 7);
        var minConfidence = _config.GetValue<int>("NotificationPolicy:MinConfidence", 70);

        if (threat.Severity < minSeverity)
        {
            _logger.LogInformation("Notification skipped: Severity {Severity} < {MinSeverity}", threat.Severity, minSeverity);
            return;
        }

        if (threat.Confidence < minConfidence)
        {
            _logger.LogInformation("Notification skipped: Confidence {Confidence} < {MinConfidence}", threat.Confidence, minConfidence);
            return;
        }

        // 2. Format Message
        var recipient = _config["Signal:GroupId"];
        if (string.IsNullOrEmpty(recipient))
        {
            _logger.LogWarning("No Signal GroupId configured, skipping notification.");
            return;
        }

        var title = "🟠 OrangeIntel | New Threat Topic";
        var body = $"""
Topic: {threat.Title}
Threat Type: {threat.ThreatType}
Severity: {threat.Severity}/10
Confidence: {threat.Confidence}%
Relevant Sector: Banking

Why this matters:
{threat.Summary}

Action:
Review and decide if advisory is required.
""";

        // 3. Send
        await _provider.SendAsync(recipient, title, body);
    }
}
