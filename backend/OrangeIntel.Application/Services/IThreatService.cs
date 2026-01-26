using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Services;

public interface IThreatService
{
    Task<IEnumerable<ThreatItem>> GetThreatsAsync();
    Task<ThreatItem?> GetThreatByIdAsync(Guid id);
    Task<Advisory?> PromoteThreatAsync(Guid threatId);
}
