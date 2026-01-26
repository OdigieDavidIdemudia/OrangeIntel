using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Services;

public interface IReportService
{
    Task<IEnumerable<Report>> GetReportsAsync();
    Task<Report?> GetReportByIdAsync(Guid id);

    Task<Report?> GenerateReportAsync(Guid artifactId, string type, string format, string userId);
    Task<byte[]?> GetReportFileAsync(Guid reportId);
    Task<byte[]?> GeneratePreviewAsync(Guid artifactId, string type, string userId);
}
