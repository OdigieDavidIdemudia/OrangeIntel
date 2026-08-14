using System.Collections.Generic;
using System.Threading.Tasks;
using TealHunt.Application.DTOs;

namespace TealHunt.Application.Interfaces;

public interface IIocEnrichmentService
{
    Task<IocLookupResponse> EnrichSingleIocAsync(string indicator, string? userId = null);
    Task<BulkIocLookupResponse> EnrichBulkIocAsync(List<string> indicators, string? userId = null);
    Task<List<IocHistoryDto>> GetLookupHistoryAsync(int count = 50);
}
