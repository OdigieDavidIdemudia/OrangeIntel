using Microsoft.EntityFrameworkCore;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Infrastructure.Data;

namespace OrangeIntel.Infrastructure.Repositories;

public class ThreatRepository : IThreatRepository
{
    private readonly ApplicationDbContext _context;

    public ThreatRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ThreatItem>> GetAllAsync()
    {
        return await _context.ThreatItems
            .Include(t => t.Indicators)
            .Include(t => t.Source)
            .ToListAsync();
    }

    public async Task<ThreatItem?> GetByIdAsync(Guid id)
    {
        return await _context.ThreatItems
            .Include(t => t.Indicators)
            .Include(t => t.Source)
            .FirstOrDefaultAsync(t => t.Id == id);
    }

    public async Task AddAsync(ThreatItem threat)
    {
        await _context.ThreatItems.AddAsync(threat);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(ThreatItem threat)
    {
        _context.ThreatItems.Update(threat);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var threat = await _context.ThreatItems.FindAsync(id);
        if (threat != null)
        {
            _context.ThreatItems.Remove(threat);
            await _context.SaveChangesAsync();
        }
    }
}
