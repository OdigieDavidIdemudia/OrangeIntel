using TealHunt.Domain.Entities;

namespace TealHunt.Application.Interfaces;

public interface IReportRepository
{
    Task<IEnumerable<Report>> GetAllAsync();
    Task<IEnumerable<Report>> GetByUserIdAsync(string userId);
    Task<Report?> GetByIdAsync(Guid id);
    Task AddAsync(Report report);
}
