using TealHunt.Domain.Entities;
using TealHunt.Application.DTOs;

namespace TealHunt.Application.Services;

public interface IThreatService
{
    Task<IEnumerable<ThreatItem>> GetThreatsAsync();
    Task<ThreatItem?> GetThreatByIdAsync(Guid id);
    Task<Advisory?> PromoteThreatAsync(Guid threatId);
    Task<DateTime?> GetLastAcceptedThreatTimeAsync();
    Task<Dictionary<string, int>> GetAcceptedThreatCountsBySeverityAsync();
    Task<IEnumerable<ThreatItem>> GetRecentAcceptedThreatsAsync(int count);
    Task<ThreatVelocityDto> GetThreatVelocityAsync();
    Task<DashboardMetricsDto> GetDashboardMetricsAsync();
    Task<bool> DiscardThreatAsync(Guid threatId);
    Task<bool> AcknowledgeThreatAsync(Guid threatId, string acknowledgedBy, string note);
    Task<IEnumerable<ThreatItem>> GetAcknowledgedThreatsAsync();
    Task<int> MigrateExistingThreatsAsync();
    Task<IEnumerable<ThreatItem>> GetFilteredIntelligenceAsync(string? priority, int? days, string? sector, DateTime? startDate = null, DateTime? endDate = null);
}
