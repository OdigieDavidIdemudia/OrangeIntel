using System.Threading.Tasks;

namespace TealHunt.Application.Interfaces;

public interface IGeminiAiService
{
    Task<string> AnalyzeReportFormatAsync(string reportJson);
}
