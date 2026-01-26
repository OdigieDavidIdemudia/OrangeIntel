using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Interfaces;

public interface IReportRepository
{
    Task<IEnumerable<Report>> GetAllAsync();
    Task<Report?> GetByIdAsync(Guid id);
    Task AddAsync(Report report);
}
