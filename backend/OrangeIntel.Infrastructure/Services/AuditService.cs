using Microsoft.EntityFrameworkCore;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Infrastructure.Data;

namespace OrangeIntel.Infrastructure.Services;

public class AuditService : IAuditService
{
    // Need a way to access DbContext. 
    // Since this is scoped, we can inject DbContext directly or via a specific repository.
    // Direct DbContext is fine for now/Simplicity in Infrastructure layer.
    
    private readonly ApplicationDbContext _context;

    public AuditService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task LogAsync(string userId, string action, string details = "", string ipAddress = "")
    {
        var log = new AuditLog
        {
            UserId = userId,
            Action = action,
            Details = details,
            IpAddress = ipAddress,
            Timestamp = DateTime.UtcNow
        };
        
        _context.AuditLogs.Add(log);
        await _context.SaveChangesAsync();
    }

    public async Task<List<AuditLog>> GetLogsAsync(int count = 100)
    {
        return await _context.AuditLogs
            .OrderByDescending(x => x.Timestamp)
            .Take(count)
            .ToListAsync();
    }
}
