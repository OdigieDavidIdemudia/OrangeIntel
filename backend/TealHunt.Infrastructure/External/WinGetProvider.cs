using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using TealHunt.Application.DTOs;
using TealHunt.Application.Interfaces;

using Microsoft.EntityFrameworkCore;
using TealHunt.Infrastructure.Data;

namespace TealHunt.Infrastructure.External;

public class WinGetProvider : IIocProvider
{
    public string Name => "WinGetManifest";
    private readonly HttpClient _httpClient;
    private readonly ISystemSettingService _settings;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<WinGetProvider> _logger;

    public WinGetProvider(HttpClient httpClient, ISystemSettingService settings, ApplicationDbContext db, ILogger<WinGetProvider> logger)
    {
        _httpClient = httpClient;
        _settings = settings;
        _db = db;
        _logger = logger;
    }

    public async Task<(int Score, ProviderResult Result)> QueryAsync(string indicator, string indicatorType, string? userId = null)
    {
        var result = new ProviderResult { ProviderName = Name };

        if (indicatorType != "FileName")
        {
            result.Success = false;
            result.Message = "Unsupported indicator type for WinGetProvider.";
            return (0, result);
        }

        // 1. Fetch GitHub API Key (optional but recommended for rate limits)
        string? apiKey = null;
        if (!string.IsNullOrEmpty(userId))
        {
            var userKey = await _db.UserApiKeys
                .FirstOrDefaultAsync(k => k.UserId == userId && k.KeyName == "github_api_key");
            if (userKey != null && !string.IsNullOrEmpty(userKey.KeyValue))
                apiKey = userKey.KeyValue;
        }
        if (string.IsNullOrEmpty(apiKey))
            apiKey = await _settings.GetSettingAsync("github_api_key", string.Empty);

        try
        {
            // Remove extensions for better search
            string searchTerm = Regex.Replace(indicator, @"\.(exe|msi|zip)$", "", RegexOptions.IgnoreCase);
            
            // Escape the search term specifically for GitHub API
            string query = Uri.EscapeDataString($"{searchTerm} in:file repo:microsoft/winget-pkgs filename:.yaml");
            var searchUrl = $"https://api.github.com/search/code?q={query}";
            
            var request = new HttpRequestMessage(HttpMethod.Get, searchUrl);
            request.Headers.Add("User-Agent", "TealHunt-AppControl-Enrichment");
            if (!string.IsNullOrEmpty(apiKey) && apiKey != "<GITHUB_API_KEY>")
            {
                request.Headers.Add("Authorization", $"Bearer {apiKey}");
            }

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                result.Success = false;
                result.Message = $"GitHub API Error: {response.StatusCode}. Rate limit may be exceeded.";
                return (0, result);
            }

            var content = await response.Content.ReadFromJsonAsync<JsonElement>();
            if (content.TryGetProperty("items", out var items) && items.GetArrayLength() > 0)
            {
                // We pick the first relevant manifest
                var firstItem = items[0];
                string fileUrl = firstItem.GetProperty("url").GetString() ?? "";

                if (!string.IsNullOrEmpty(fileUrl))
                {
                    var fileReq = new HttpRequestMessage(HttpMethod.Get, fileUrl);
                    fileReq.Headers.Add("User-Agent", "TealHunt-AppControl-Enrichment");
                    var fileRes = await _httpClient.SendAsync(fileReq);
                    
                    if (fileRes.IsSuccessStatusCode)
                    {
                        var fileContent = await fileRes.Content.ReadFromJsonAsync<JsonElement>();
                        if (fileContent.TryGetProperty("content", out var base64ContentElement))
                        {
                            string base64 = base64ContentElement.GetString()?.Replace("\n", "") ?? "";
                            string yamlString = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(base64));

                            // Extract InstallerSha256
                            var hashMatch = Regex.Match(yamlString, @"InstallerSha256:\s*([A-Fa-f0-9]{64})");
                            if (hashMatch.Success)
                            {
                                string hash = hashMatch.Groups[1].Value;
                                result.Success = true;
                                result.Message = $"Hash: {hash}";
                                result.RawData = new { InstallerSha256 = hash, Source = firstItem.GetProperty("html_url").GetString() };
                                
                                // Return score 0 because it's a known benign application hash lookup
                                return (0, result); 
                            }
                            else
                            {
                                result.Success = false;
                                result.Message = "No InstallerSha256 found in the manifest.";
                                return (0, result);
                            }
                        }
                    }
                }
            }

            result.Success = false;
            result.Message = "No matching WinGet package manifest found.";
            return (0, result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WinGet query failed.");
            result.Success = false;
            result.Message = "Internal error during query.";
            return (0, result);
        }
    }
}
