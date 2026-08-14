using Microsoft.EntityFrameworkCore;
using TealHunt.Application.Interfaces;
using TealHunt.Domain.Entities;
using TealHunt.Infrastructure.Data;

namespace TealHunt.Infrastructure.Repositories;

public class AdvisoryRepository : IAdvisoryRepository
{
    private readonly ApplicationDbContext _context;

    public AdvisoryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(Advisory advisory)
    {
        await _context.Advisories.AddAsync(advisory);
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<Advisory>> GetAllAsync()
    {
        return await _context.Advisories.ToListAsync();
    }

    public async Task<Advisory?> GetByIdAsync(Guid id)
    {
        return await _context.Advisories.FindAsync(id);
    }

    public async Task UpdateAsync(Advisory advisory)
    {
        _context.Advisories.Update(advisory);
        await _context.SaveChangesAsync();
    }

    public async Task SaveDraftAsync(AdvisoryDraft draft)
    {
        var existing = await _context.AdvisoryDrafts.FindAsync(draft.Id);
        if (existing == null)
        {
            await _context.AdvisoryDrafts.AddAsync(draft);
        }
        else
        {
            // Update fields
            existing.ContentJson = draft.ContentJson;
            existing.TopicId = draft.TopicId;
            existing.Version = draft.Version;
            existing.LastSavedAt = DateTime.UtcNow;
            _context.AdvisoryDrafts.Update(existing);
        }
        await _context.SaveChangesAsync();
    }

    public async Task<AdvisoryDraft?> GetDraftByIdAsync(Guid id)
    {
        return await _context.AdvisoryDrafts.FindAsync(id);
    }
}
