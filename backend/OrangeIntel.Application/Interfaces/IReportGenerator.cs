using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Interfaces;

public interface IReportGenerator
{
    string SupportedFormat { get; }
    byte[] Generate(Report report, string contentJson);
}
