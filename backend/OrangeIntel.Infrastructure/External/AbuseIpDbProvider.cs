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

public class AbuseIpDbProvider : IIocProvider
{
    public string Name => "AbuseIPDB";
    private readonly HttpClient _httpClient;
    private readonly ISystemSettingService _settings;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<AbuseIpDbProvider> _logger;

    public AbuseIpDbProvider(HttpClient httpClient, ISystemSettingService settings, ApplicationDbContext db, ILogger<AbuseIpDbProvider> logger)
    {
        _httpClient = httpClient;
        _settings = settings;
        _db = db;
        _logger = logger;
    }

    public async Task<(int Score, ProviderResult Result)> QueryAsync(string indicator, string indicatorType, string? userId = null)
    {
        var result = new ProviderResult { ProviderName = Name };

        if (indicatorType != "IP")
        {
            result.Success = false;
            result.Message = "AbuseIPDB only supports IP addresses.";
            return (0, result);
        }

        // Try user-specific key first, then fall back to global admin key
        string? apiKey = null;
        if (!string.IsNullOrEmpty(userId))
        {
            var userKey = await _db.UserApiKeys
                .FirstOrDefaultAsync(k => k.UserId == userId && k.KeyName == "abuseipdb_api_key");
            if (userKey != null && !string.IsNullOrEmpty(userKey.KeyValue))
                apiKey = userKey.KeyValue;
        }
        if (string.IsNullOrEmpty(apiKey))
            apiKey = await _settings.GetSettingAsync("abuseipdb_api_key", string.Empty);

        if (string.IsNullOrEmpty(apiKey) || apiKey == "<ABUSEIPDB_API_KEY>")
        {
            result.Success = false;
            result.Message = "AbuseIPDB API key not configured. Set it in Settings → My API Keys.";
            return (0, result);
        }

        try
        {
            var url = $"https://api.abuseipdb.com/api/v2/check?ipAddress={indicator}&maxAgeInDays=90";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("Key", apiKey);
            request.Headers.Add("Accept", "application/json");

            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadFromJsonAsync<JsonElement>();
                result.Success = true;
                result.RawData = content;

                int riskScore = 0;
                if (content.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("abuseConfidenceScore", out var scoreProp))
                {
                    riskScore = scoreProp.GetInt32();
                }

                result.Message = $"Confidence Score: {riskScore}";
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
            _logger.LogError(ex, "AbuseIPDB query failed.");
            result.Success = false;
            result.Message = "Internal error during query.";
            return (0, result);
        }
    }
}
