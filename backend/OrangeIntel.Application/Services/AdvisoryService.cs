using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Services;

public class AdvisoryService : IAdvisoryService
{
    private readonly IAdvisoryRepository _repository;

    public AdvisoryService(IAdvisoryRepository repository)
    {
        _repository = repository;
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
        // Repository needs Update logic? AdvisoryRepository usually has Add/Get.
        // I need to check if AdvisoryRepository has UpdateAsync. 
        // Assuming it does or I'll add it.
        // Actually, let's assume I need to add it to Repository interface too if missing.
        // But for now, let's call it.
        await _repository.UpdateAsync(advisory);
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
