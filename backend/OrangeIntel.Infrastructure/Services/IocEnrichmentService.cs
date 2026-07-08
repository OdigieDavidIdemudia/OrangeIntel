using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrangeIntel.Application.DTOs;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Infrastructure.Data;

namespace OrangeIntel.Infrastructure.Services;

public class IocEnrichmentService : IIocEnrichmentService
{
    private readonly IEnumerable<IIocProvider> _providers;
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<IocEnrichmentService> _logger;

    public IocEnrichmentService(IEnumerable<IIocProvider> providers, ApplicationDbContext dbContext, ILogger<IocEnrichmentService> logger)
    {
        _providers = providers;
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<IocLookupResponse> EnrichSingleIocAsync(string indicator, string? userId = null)
    {
        indicator = indicator?.Trim();
        if (string.IsNullOrEmpty(indicator))
        {
            return new IocLookupResponse
            {
                IndicatorValue = indicator ?? string.Empty,
                IndicatorType = "Unknown",
                Message = "Indicator cannot be empty."
            };
        }

        var type = DetermineIndicatorType(indicator);
        if (type == "Unknown")
        {
            return new IocLookupResponse
            {
                IndicatorValue = indicator,
                IndicatorType = type,
                Message = "Could not determine indicator type."
            };
        }

        // 1. Check Cache (Lookups in the last 24 hours)
        var cached = await _dbContext.IocAuditLogs
            .Where(x => x.IndicatorValue == indicator && x.QueriedAt > DateTime.UtcNow.AddDays(-1))
            .OrderByDescending(x => x.QueriedAt)
            .FirstOrDefaultAsync();

        if (cached != null)
        {
            var cachedResponse = new IocLookupResponse
            {
                IndicatorValue = cached.IndicatorValue,
                IndicatorType = cached.IndicatorType,
                UnifiedRiskScore = cached.RiskScore,
                IsCached = true,
                QueriedAt = cached.QueriedAt
            };

            if (!string.IsNullOrEmpty(cached.RawResultJson))
            {
                try
                {
                    cachedResponse.ProviderResults = JsonSerializer.Deserialize<List<ProviderResult>>(cached.RawResultJson);
                }
                catch { }
            }
            
            // If we added a new provider recently, ignore the cache if the provider count doesn't match
            if (cachedResponse.ProviderResults?.Count >= _providers.Count())
            {
                return cachedResponse;
            }
        }

        // 2. Query Providers sequentially (EF Core DbContext is not thread-safe;
        //    providers call ISystemSettingService which uses the same DbContext)
        var results = new List<ProviderResult>();
        int maxScore = 0;

        foreach (var provider in _providers)
        {
            try
            {
                var (score, result) = await provider.QueryAsync(indicator, type, userId);
                results.Add(result);
                if (score > maxScore) maxScore = score;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Provider {Name} threw during query for {Indicator}", provider.Name, indicator);
                results.Add(new ProviderResult
                {
                    ProviderName = provider.Name,
                    Success = false,
                    Message = "Provider threw an unexpected error."
                });
            }
        }

        // 3. Save to DB Cache
        var auditLog = new IocAuditLog
        {
            IndicatorValue = indicator,
            IndicatorType = type,
            RiskScore = maxScore,
            RawResultJson = JsonSerializer.Serialize(results),
            QueriedAt = DateTime.UtcNow,
            QueriedByUserId = userId
        };

        _dbContext.IocAuditLogs.Add(auditLog);
        await _dbContext.SaveChangesAsync();

        return new IocLookupResponse
        {
            IndicatorValue = indicator,
            IndicatorType = type,
            UnifiedRiskScore = maxScore,
            ProviderResults = results,
            IsCached = false,
            QueriedAt = auditLog.QueriedAt
        };
    }

    public async Task<BulkIocLookupResponse> EnrichBulkIocAsync(List<string> indicators, string? userId = null)
    {
        var response = new BulkIocLookupResponse();
        var uniqueIndicators = indicators
            .Where(i => !string.IsNullOrWhiteSpace(i))
            .Select(i => i.Trim())
            .Distinct()
            .ToList();

        // EF Core DbContext is NOT thread-safe, so we process sequentially.
        // We still respect VirusTotal's 4 req/min free-tier limit with a counter.
        int requestCount = 0;

        foreach (var ind in uniqueIndicators)
        {
            // Rate-limit: pause after every 4 requests
            if (requestCount > 0 && requestCount % 4 == 0)
            {
                _logger.LogInformation("Rate limiting: pausing 60s after {Count} requests...", requestCount);
                await Task.Delay(TimeSpan.FromSeconds(60));
            }

            var res = await EnrichSingleIocAsync(ind, userId);
            response.Results.Add(res);
            response.TotalProcessed++;
            if (res.IndicatorType == "Unknown") response.ErrorCount++;

            requestCount++;
        }

        return response;
    }

    public async Task<List<IocHistoryDto>> GetLookupHistoryAsync(int count = 50)
    {
        return await _dbContext.IocAuditLogs
            .OrderByDescending(x => x.QueriedAt)
            .Take(count)
            .Select(x => new IocHistoryDto
            {
                Id = x.Id,
                IndicatorValue = x.IndicatorValue,
                IndicatorType = x.IndicatorType,
                RiskScore = x.RiskScore,
                QueriedAt = x.QueriedAt,
                QueriedByUserId = x.QueriedByUserId
            })
            .ToListAsync();
    }

    private string DetermineIndicatorType(string value)
    {
        if (Regex.IsMatch(value, @"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$")) return "IP";
        if (Regex.IsMatch(value, @"^[a-fA-F0-9]{32}$")) return "Hash"; // MD5
        if (Regex.IsMatch(value, @"^[a-fA-F0-9]{40}$")) return "Hash"; // SHA1
        if (Regex.IsMatch(value, @"^[a-fA-F0-9]{64}$")) return "Hash"; // SHA256
        if (value.StartsWith("http://") || value.StartsWith("https://")) return "URL";
        if (Regex.IsMatch(value, @"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$", RegexOptions.IgnoreCase)) return "Domain";
        if (Regex.IsMatch(value, @"^CVE-\d{4}-\d{4,7}$", RegexOptions.IgnoreCase)) return "CVE";
        
        // Fallback for Application Names and Filenames (e.g., "Google Chrome", "vlc.exe")
        if (Regex.IsMatch(value, @"^[a-zA-Z0-9\s\.\-_]+$")) return "FileName";

        return "Unknown";
    }
}
