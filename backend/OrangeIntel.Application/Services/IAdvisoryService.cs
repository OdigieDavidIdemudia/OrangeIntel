using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Services;

public interface IAdvisoryService
{
    Task<IEnumerable<Advisory>> GetAdvisoriesAsync();
    Task<Advisory?> GetAdvisoryByIdAsync(Guid id);
    Task UpdateAdvisoryAsync(Advisory advisory);
    Task SaveDraftAsync(AdvisoryDraft draft);
    Task<AdvisoryDraft?> GetDraftByIdAsync(Guid id);
}
