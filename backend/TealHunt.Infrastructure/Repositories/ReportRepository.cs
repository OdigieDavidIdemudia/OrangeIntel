using Microsoft.EntityFrameworkCore;
using TealHunt.Application.Interfaces;
using TealHunt.Domain.Entities;
using TealHunt.Infrastructure.Data;

namespace TealHunt.Infrastructure.Repositories;

public class ReportRepository : IReportRepository
{
    private readonly ApplicationDbContext _context;

    public ReportRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Report>> GetAllAsync()
    {
        return await _context.Reports.ToListAsync();
    }
    
    public async Task<IEnumerable<Report>> GetByUserIdAsync(string userId)
    {
        return await _context.Reports
            .Where(r => r.GeneratedById == userId)
            .ToListAsync();
    }

    public async Task<Report?> GetByIdAsync(Guid id)
    {
        return await _context.Reports.FindAsync(id);
    }

    public async Task AddAsync(Report report)
    {
        await _context.Reports.AddAsync(report);
        await _context.SaveChangesAsync();
    }
}
