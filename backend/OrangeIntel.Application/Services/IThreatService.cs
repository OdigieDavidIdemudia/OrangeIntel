using OrangeIntel.Domain.Entities;
using OrangeIntel.Application.DTOs;

namespace OrangeIntel.Application.Services;

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
}
