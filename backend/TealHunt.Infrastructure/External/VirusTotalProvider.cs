using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TealHunt.Application.DTOs;
using TealHunt.Application.Interfaces;
using TealHunt.Infrastructure.Data;

namespace TealHunt.Infrastructure.External;

public class VirusTotalProvider : IIocProvider
{
    public string Name => "VirusTotal";
    private readonly HttpClient _httpClient;
    private readonly ISystemSettingService _settings;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<VirusTotalProvider> _logger;

    public VirusTotalProvider(HttpClient httpClient, ISystemSettingService settings, ApplicationDbContext db, ILogger<VirusTotalProvider> logger)
    {
        _httpClient = httpClient;
        _settings = settings;
        _db = db;
        _logger = logger;
    }

    public async Task<(int Score, ProviderResult Result)> QueryAsync(string indicator, string indicatorType, string? userId = null)
    {
        var result = new ProviderResult { ProviderName = Name };

        // 1. Try user-specific key, then fall back to global admin key
        string? apiKey = null;
        if (!string.IsNullOrEmpty(userId))
        {
            var userKey = await _db.UserApiKeys
                .FirstOrDefaultAsync(k => k.UserId == userId && k.KeyName == "vt_api_key");
            if (userKey != null && !string.IsNullOrEmpty(userKey.KeyValue))
                apiKey = userKey.KeyValue;
        }
        if (string.IsNullOrEmpty(apiKey))
            apiKey = await _settings.GetSettingAsync("vt_api_key", string.Empty);

        if (string.IsNullOrEmpty(apiKey) || apiKey == "<VT_API_KEY>")
        {
            result.Success = false;
            result.Message = "VirusTotal API key not configured. Set it in Settings → My API Keys.";
            return (0, result);
        }

        try
        {
            string endpoint;
            if (indicatorType == "IP") endpoint = $"ip_addresses/{indicator}";
            else if (indicatorType == "Domain") endpoint = $"domains/{indicator}";
            else if (indicatorType == "Hash") endpoint = $"files/{indicator}";
            else if (indicatorType == "URL")
            {
                var plainTextBytes = System.Text.Encoding.UTF8.GetBytes(indicator);
                var base64Url = Convert.ToBase64String(plainTextBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
                endpoint = $"urls/{base64Url}";
            }
            else
            {
                result.Success = false;
                result.Message = "Unsupported indicator type for VirusTotal.";
                return (0, result);
            }

            var url = $"https://www.virustotal.com/api/v3/{endpoint}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("x-apikey", apiKey);

            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadFromJsonAsync<JsonElement>();
                result.Success = true;
                result.RawData = content;

                int riskScore = 0;
                if (content.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("attributes", out var attributes) &&
                    attributes.TryGetProperty("last_analysis_stats", out var stats))
                {
                    int malicious = stats.GetProperty("malicious").GetInt32();
                    int suspicious = stats.GetProperty("suspicious").GetInt32();
                    if (malicious > 0) riskScore = Math.Min(100, 50 + (malicious * 10));
                    else if (suspicious > 0) riskScore = Math.Min(100, 20 + (suspicious * 10));
                }

                result.Message = $"Risk Score: {riskScore}";
                return (riskScore, result);
            }
            else
            {
                result.Success = false;
                result.Message = $"API Error: {response.StatusCode}";
                return (0, result);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "VirusTotal query failed.");
            result.Success = false;
            result.Message = "Internal error during query.";
            return (0, result);
        }
    }
}
