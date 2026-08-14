using TealHunt.Application.Interfaces;
using TealHunt.Domain.Entities;

namespace TealHunt.Application.Services;

public class AdvisoryService : IAdvisoryService
{
    private readonly IAdvisoryRepository _repository;
    private readonly INotificationService _notificationService;

    public AdvisoryService(IAdvisoryRepository repository, INotificationService notificationService)
    {
        _repository = repository;
        _notificationService = notificationService;
    }

    public async Task<IEnumerable<Advisory>> GetAdvisoriesAsync()
    {
        return await _repository.GetAllAsync();
    }

    public async Task<Advisory?> GetAdvisoryByIdAsync(Guid id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task UpdateAdvisoryAsync(Advisory advisory)
    {
        var existing = await _repository.GetByIdAsync(advisory.Id);
        bool isBecomingApproved = existing != null && existing.Status == AdvisoryStatus.Draft && advisory.Status == AdvisoryStatus.Approved;

        await _repository.UpdateAsync(advisory);

        if (isBecomingApproved)
        {
            await _notificationService.NotifyAdvisoryPublishedAsync(advisory);
        }
    }

    public async Task AddAdvisoryAsync(Advisory advisory)
    {
        if (advisory.Id == Guid.Empty)
        {
            advisory.Id = Guid.NewGuid();
        }
        await _repository.AddAsync(advisory);
    }

    public async Task SaveDraftAsync(AdvisoryDraft draft)
    {
        await _repository.SaveDraftAsync(draft);
    }

    public async Task<AdvisoryDraft?> GetDraftByIdAsync(Guid id)
    {
        return await _repository.GetDraftByIdAsync(id);
    }
}
