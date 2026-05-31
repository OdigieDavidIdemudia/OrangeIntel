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

public class AlienVaultOtxProvider : IIocProvider
{
    public string Name => "AlienVault OTX";
    private readonly HttpClient _httpClient;
    private readonly ISystemSettingService _settings;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<AlienVaultOtxProvider> _logger;

    public AlienVaultOtxProvider(HttpClient httpClient, ISystemSettingService settings, ApplicationDbContext db, ILogger<AlienVaultOtxProvider> logger)
    {
        _httpClient = httpClient;
        _settings = settings;
        _db = db;
        _logger = logger;
    }

    public async Task<(int Score, ProviderResult Result)> QueryAsync(string indicator, string indicatorType, string? userId = null)
    {
        var result = new ProviderResult { ProviderName = Name };

        // Try user-specific key first, then fall back to global admin key
        string? apiKey = null;
        if (!string.IsNullOrEmpty(userId))
        {
            var userKey = await _db.UserApiKeys
                .FirstOrDefaultAsync(k => k.UserId == userId && k.KeyName == "alienvault_api_key");
            if (userKey != null && !string.IsNullOrEmpty(userKey.KeyValue))
                apiKey = userKey.KeyValue;
        }
        if (string.IsNullOrEmpty(apiKey))
            apiKey = await _settings.GetSettingAsync("alienvault_api_key", string.Empty);

        if (string.IsNullOrEmpty(apiKey) || apiKey == "<OTX_API_KEY>")
        {
            result.Success = false;
            result.Message = "AlienVault OTX API key not configured. Set it in Settings → My API Keys.";
            return (0, result);
        }

        try
        {
            string endpoint;
            if (indicatorType == "IP") endpoint = $"IPv4/{indicator}";
            else if (indicatorType == "Domain") endpoint = $"domain/{indicator}";
            else if (indicatorType == "Hash") endpoint = $"file/{indicator}";
            else if (indicatorType == "URL") endpoint = $"url/{indicator}";
            else
            {
                result.Success = false;
                result.Message = "Unsupported indicator type for AlienVault OTX.";
                return (0, result);
            }

            var url = $"https://otx.alienvault.com/api/v1/indicators/{endpoint}/general";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("X-OTX-API-KEY", apiKey);

            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadFromJsonAsync<JsonElement>();
                result.Success = true;
                result.RawData = content;

                int pulseCount = 0;
                if (content.TryGetProperty("pulse_info", out var pulseInfo) &&
                    pulseInfo.TryGetProperty("count", out var countProp))
                {
                    pulseCount = countProp.GetInt32();
                }

                int riskScore = Math.Min(100, pulseCount * 10);
                result.Message = $"Found in {pulseCount} pulses. Score: {riskScore}";
                return (riskScore, result);
            }
            else if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                result.Success = true;
                result.Message = "Not found in OTX.";
                return (0, result);
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
            _logger.LogError(ex, "AlienVault OTX query failed.");
            result.Success = false;
            result.Message = "Internal error during query.";
            return (0, result);
        }
    }
}
