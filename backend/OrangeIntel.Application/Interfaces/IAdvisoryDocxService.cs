using OrangeIntel.Application.DTOs.Reporting;

namespace OrangeIntel.Application.Interfaces;

public interface IAdvisoryDocxService
{
    byte[] GenerateAdvisory(GTBankAdvisoryReportV1 model);
}
