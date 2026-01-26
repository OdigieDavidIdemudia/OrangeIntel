using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Interfaces;

public interface IThreatRepository
{
    Task<IEnumerable<ThreatItem>> GetAllAsync();
    Task<ThreatItem?> GetByIdAsync(Guid id);
    Task AddAsync(ThreatItem threat);
    Task UpdateAsync(ThreatItem threat);
    Task DeleteAsync(Guid id);
}
