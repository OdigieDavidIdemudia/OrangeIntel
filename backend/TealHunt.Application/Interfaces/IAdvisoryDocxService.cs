using TealHunt.Application.DTOs.Reporting;

namespace TealHunt.Application.Interfaces;

public interface IAdvisoryDocxService
{
    byte[] GenerateAdvisory(GTBankAdvisoryReportV1 model);
}
