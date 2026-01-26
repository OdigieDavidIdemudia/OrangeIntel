using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Interfaces;

public interface IAdvisoryRepository
{
    Task AddAsync(Advisory advisory);
    Task<IEnumerable<Advisory>> GetAllAsync();
    Task<Advisory?> GetByIdAsync(Guid id);
    Task UpdateAsync(Advisory advisory);
    Task SaveDraftAsync(AdvisoryDraft draft);
    Task<AdvisoryDraft?> GetDraftByIdAsync(Guid id);
}
