using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Interfaces;

public interface IAssessmentRepository
{
    Task<IEnumerable<Assessment>> GetAllAsync();
    Task<Assessment?> GetByIdAsync(Guid id);
    Task AddAsync(Assessment assessment);
    Task UpdateAsync(Assessment assessment);
    Task SaveDraftAsync(AssessmentDraft draft);
    Task<AssessmentDraft?> GetDraftByIdAsync(Guid id);
}
