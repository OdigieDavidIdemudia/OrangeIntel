using TealHunt.Domain.Entities;

namespace TealHunt.Application.Interfaces;

public interface IAuditService
{
    Task LogAsync(string userId, string action, string details = "", string ipAddress = "");
    Task<List<AuditLog>> GetLogsAsync(int count = 100);
}
