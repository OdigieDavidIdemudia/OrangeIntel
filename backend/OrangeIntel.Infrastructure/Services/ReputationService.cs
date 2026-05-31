using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace OrangeIntel.Infrastructure.Services;

public class ReputationService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ReputationService> _logger;

    private const string VirusTotalApiKey = "5b977a085f8e210c896c93810e5793b9ebea64c5a737ffbb5c72cf5c58eb46bd";
    private const string AbuseIPDBApiKey = "4334aa45ab8dccdfc6f23e62e7be92c715bd79b6683d1597c9811f149c7baa83527b802ebbc50336";

    public ReputationService(HttpClient httpClient, ILogger<ReputationService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public List<string> ExtractIps(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return new List<string>();
        var regex = new Regex(@"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b");
        return regex.Matches(text).Select(m => m.Value).Distinct().ToList();
    }

    public List<string> ExtractHashes(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return new List<string>();
        var regex = new Regex(@"\b([a-fA-F0-9]{32}|[a-fA-F0-9]{64})\b");
        return regex.Matches(text).Select(m => m.Value).Distinct().ToList();
    }

    public async Task<int?> CheckAbuseIPDBAsync(string ip)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.abuseipdb.com/api/v2/check?ipAddress={ip}");
            request.Headers.Add("Key", AbuseIPDBApiKey);
            request.Headers.Add("Accept", "application/json");

            var response = await _httpClient.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<AbuseIPDBResponse>();
                return result?.Data?.AbuseConfidenceScore;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, $"Failed to check IP {ip} against AbuseIPDB");
        }
        return null;
    }

    public async Task<int?> CheckVirusTotalHashAsync(string hash)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"https://www.virustotal.com/api/v3/files/{hash}");
            request.Headers.Add("x-apikey", VirusTotalApiKey);
            request.Headers.Add("Accept", "application/json");

            var response = await _httpClient.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<VirusTotalResponse>();
                return result?.Data?.Attributes?.LastAnalysisStats?.Malicious;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, $"Failed to check hash {hash} against VirusTotal");
        }
        return null;
    }

    private class AbuseIPDBResponse
    {
        public AbuseIPDBData? Data { get; set; }
    }

    private class AbuseIPDBData
    {
        public int AbuseConfidenceScore { get; set; }
    }

    private class VirusTotalResponse
    {
        public VirusTotalData? Data { get; set; }
    }

    private class VirusTotalData
    {
        public VirusTotalAttributes? Attributes { get; set; }
    }

    private class VirusTotalAttributes
    {
        public VirusTotalStats? LastAnalysisStats { get; set; }
    }

    private class VirusTotalStats
    {
        public int Malicious { get; set; }
    }
}
