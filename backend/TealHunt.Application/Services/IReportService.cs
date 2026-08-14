using TealHunt.Domain.Entities;

namespace TealHunt.Application.Services;

public interface IReportService
{
    Task<IEnumerable<Report>> GetReportsAsync(string userId);
    Task<Report?> GetReportByIdAsync(Guid id);

    Task<Report?> GenerateReportAsync(Guid artifactId, string type, string format, string userId);
    Task<Report> SaveAdvisoryReportAsync(TealHunt.Application.DTOs.Reporting.GTBankAdvisoryReportV1 model, string userId);
    Task<byte[]?> GetReportFileAsync(Guid reportId);
    Task<byte[]?> GeneratePreviewAsync(Guid artifactId, string type, string userId);
}
