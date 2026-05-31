using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrangeIntel.Application.DTOs;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Infrastructure.Data;

namespace OrangeIntel.Infrastructure.External;

public class NvdCveProvider : IIocProvider
{
    public string Name => "NVD (CVE)";
    private readonly HttpClient _httpClient;
    private readonly ISystemSettingService _settings;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<NvdCveProvider> _logger;

    public NvdCveProvider(HttpClient httpClient, ISystemSettingService settings, ApplicationDbContext db, ILogger<NvdCveProvider> logger)
    {
        _httpClient = httpClient;
        _settings = settings;
        _db = db;
        _logger = logger;
    }

    public async Task<(int Score, ProviderResult Result)> QueryAsync(string indicator, string indicatorType, string? userId = null)
    {
        var result = new ProviderResult { ProviderName = Name };

        if (indicatorType != "CVE")
        {
            result.Success = false;
            result.Message = "NVD only supports CVE identifiers (e.g., CVE-YYYY-NNNN).";
            return (0, result);
        }

        // Try user-specific key first, then fall back to global admin key
        string? apiKey = null;
        if (!string.IsNullOrEmpty(userId))
        {
            var userKey = await _db.UserApiKeys
                .FirstOrDefaultAsync(k => k.UserId == userId && k.KeyName == "nvd_api_key");
            if (userKey != null && !string.IsNullOrEmpty(userKey.KeyValue))
                apiKey = userKey.KeyValue;
        }
        if (string.IsNullOrEmpty(apiKey))
            apiKey = await _settings.GetSettingAsync("nvd_api_key", string.Empty);

        try
        {
            var url = $"https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={indicator.ToUpper()}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            
            if (!string.IsNullOrEmpty(apiKey) && apiKey != "<NVD_API_KEY>")
            {
                request.Headers.Add("apiKey", apiKey);
            }

            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadFromJsonAsync<JsonElement>();
                result.Success = true;
                result.RawData = content;

                if (content.TryGetProperty("totalResults", out var totalResults) && totalResults.GetInt32() > 0)
                {
                    var vulnerabilities = content.GetProperty("vulnerabilities");
                    if (vulnerabilities.GetArrayLength() > 0)
                    {
                        var cveNode = vulnerabilities[0].GetProperty("cve");
                        
                        double baseScore = 0;
                        string severity = "UNKNOWN";

                        if (cveNode.TryGetProperty("metrics", out var metrics))
                        {
                            // Try cvssMetricV31 first, then cvssMetricV30, then cvssMetricV2
                            JsonElement? cvssData = null;
                            if (metrics.TryGetProperty("cvssMetricV31", out var v31) && v31.GetArrayLength() > 0)
                            {
                                cvssData = v31[0].GetProperty("cvssData");
                            }
                            else if (metrics.TryGetProperty("cvssMetricV30", out var v30) && v30.GetArrayLength() > 0)
                            {
                                cvssData = v30[0].GetProperty("cvssData");
                            }
                            else if (metrics.TryGetProperty("cvssMetricV2", out var v2) && v2.GetArrayLength() > 0)
                            {
                                cvssData = v2[0].GetProperty("cvssData");
                            }

                            if (cvssData.HasValue)
                            {
                                if (cvssData.Value.TryGetProperty("baseScore", out var scoreProp))
                                    baseScore = scoreProp.GetDouble();
                                if (cvssData.Value.TryGetProperty("baseSeverity", out var sevProp))
                                    severity = sevProp.GetString() ?? "UNKNOWN";
                            }
                        }

                        int riskScore = (int)(baseScore * 10); // CVSS 0-10 -> 0-100 risk score
                        result.Message = $"CVSS Score: {baseScore} ({severity})";
                        return (riskScore, result);
                    }
                }
                
                result.Success = true;
                result.Message = "CVE not found in NVD database.";
                return (0, result);
            }
            else
            {
                result.Success = false;
                result.Message = $"NVD API Error: {response.StatusCode}. Note: Without an API key, NVD heavily rate limits requests.";
                return (0, result);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "NVD CVE query failed.");
            result.Success = false;
            result.Message = "Internal error during NVD query.";
            return (0, result);
        }
    }
}
