using TealHunt.Domain.Entities;

namespace TealHunt.Application.Interfaces;

public interface IReportGenerator
{
    string SupportedFormat { get; }
    byte[] Generate(Report report, string contentJson);
}
