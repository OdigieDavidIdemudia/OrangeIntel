using Microsoft.EntityFrameworkCore;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Infrastructure.Data;

namespace OrangeIntel.Infrastructure.Repositories;

public class AssessmentRepository : IAssessmentRepository
{
    private readonly ApplicationDbContext _context;

    public AssessmentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Assessment>> GetAllAsync()
    {
        return await _context.Assessments.Include(a => a.Advisory).ToListAsync();
    }

    public async Task<Assessment?> GetByIdAsync(Guid id)
    {
        return await _context.Assessments.Include(a => a.Advisory).FirstOrDefaultAsync(a => a.Id == id);
    }

    public async Task AddAsync(Assessment assessment)
    {
        await _context.Assessments.AddAsync(assessment);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Assessment assessment)
    {
        _context.Assessments.Update(assessment);
        await _context.SaveChangesAsync();
    }

    public async Task SaveDraftAsync(AssessmentDraft draft)
    {
        var existing = await _context.AssessmentDrafts.FindAsync(draft.Id);
        if (existing == null)
        {
            await _context.AssessmentDrafts.AddAsync(draft);
        }
        else
        {
            existing.ContentJson = draft.ContentJson;
            existing.AdvisoryId = draft.AdvisoryId;
            existing.Version = draft.Version;
            existing.LastSavedAt = DateTime.UtcNow;
            _context.AssessmentDrafts.Update(existing);
        }
        await _context.SaveChangesAsync();
    }

    public async Task<AssessmentDraft?> GetDraftByIdAsync(Guid id)
    {
        return await _context.AssessmentDrafts.FindAsync(id);
    }
}
