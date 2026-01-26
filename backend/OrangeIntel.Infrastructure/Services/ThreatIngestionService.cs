using System.Net.Http.Json;
using System.Linq;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration; // ADDED
using OrangeIntel.Domain.Entities;
using OrangeIntel.Domain.Enums;
using OrangeIntel.Infrastructure.Data;
using System.Security.Cryptography;
using System.Text;

namespace OrangeIntel.Infrastructure.Services;

public class ThreatIngestionService
{
    private readonly ApplicationDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly ILogger<ThreatIngestionService> _logger;

    private readonly IConfiguration _configuration;

    public ThreatIngestionService(ApplicationDbContext context, HttpClient httpClient, ILogger<ThreatIngestionService> logger, IConfiguration configuration)
    {
        _context = context;
        _httpClient = httpClient;
        _logger = logger;
        _configuration = configuration;
    }

    private string ComputeStableHash(string input)
    {
        using (SHA256 sha256 = SHA256.Create())
        {
            byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < bytes.Length; i++)
            {
                builder.Append(bytes[i].ToString("x2"));
            }
            return builder.ToString();
        }
    }

    private const int MaxTopicsPerDay = 500; // Increased limit for testing

    public async Task<(int Count, string Message)> IngestAllAsync()
    {
        int totalIngested = 0;
        var messages = new List<string>();

        // 0. Breaking News (Simulated for immediate threats like Palo Alto)
        var (newsCount, newsMsg) = await IngestBreakingNewsAsync();
        totalIngested += newsCount;
        messages.Add($"Breaking: {newsMsg}");

        // 1. CISA KEV
        var (cisaCount, cisaMsg) = await IngestCisaKevAsync();
        totalIngested += cisaCount;
        messages.Add($"CISA: {cisaMsg}");

        // Stop if daily limit reached
        if (await DailyLimitReachedAsync()) return (totalIngested, string.Join("; ", messages) + " [Daily Limit Reached]");

        // 2. AlienVault OTX
        var (otxCount, otxMsg) = await IngestAlienVaultOtxAsync();
        totalIngested += otxCount;
        messages.Add($"OTX: {otxMsg}");

        // Stop if daily limit reached
        if (await DailyLimitReachedAsync()) return (totalIngested, string.Join("; ", messages) + " [Daily Limit Reached]");
        
        // 3. MITRE ATT&CK (Static/Mock for now as it's a large dataset)
        // var (mitreCount, mitreMsg) = await IngestMitreAttackAsync();
        // totalIngested += mitreCount;

        return (totalIngested, string.Join("; ", messages));
    }

    private async Task<bool> DailyLimitReachedAsync()
    {
        var today = DateTime.UtcNow.Date;
        var dailyCount = await _context.ThreatItems.CountAsync(t => t.IngestedAt >= today);

        // Fetch dynamic limit
        var limitSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "max_topics");
        int maxTopics = 200; // Default increased for user request
        if (limitSetting != null && int.TryParse(limitSetting.Value, out int val))
        {
            maxTopics = val;
        }

        return dailyCount >= maxTopics;
    }

    private async Task<(int, string)> IngestCisaKevAsync()
    {
        try 
        {
             if (await DailyLimitReachedAsync()) return (0, "Skipped (Limit Reached)");

             var url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
             var response = await _httpClient.GetFromJsonAsync<CisaKevResponse>(url);
             if (response?.vulnerabilities == null) return (0, "No data from CISA");

             int count = 0;
             var source = await GetOrCreateSourceAsync("CISA KEV", "Government");

             // Ingest latest 50 to save quota for other sources
             foreach(var vuln in response.vulnerabilities.OrderByDescending(v => v.dateAdded).Take(50))
             {
                 if (await DailyLimitReachedAsync()) break;
                 
                 var dedupKey = $"CISA-{ComputeStableHash(vuln.cveID)}";
                 if (await _context.ThreatItems.AnyAsync(t => t.HashDedup == dedupKey)) continue;

                 var item = new ThreatItem
                 {
                     Title = $"{vuln.cveID}: {vuln.vulnerabilityName}",
                     Summary = $"{vuln.shortDescription} (Required Action: {vuln.requiredAction})",
                     ThreatType = "Vulnerability",
                     AttackVector = "Exploited in Wild",
                     Severity = 9, // KEV is critical
                     Confidence = 100,
                     FirstSeen = DateTime.Parse(vuln.dateAdded, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal),
                     LastSeen = DateTime.UtcNow,
                     Status = ThreatStatus.New,
                     HashDedup = dedupKey,
                     SourceId = source.Id,
                     MetadataJson = JsonSerializer.Serialize(vuln)
                 };
                 
                 _context.ThreatItems.Add(item);
                 count++;
             }
             await _context.SaveChangesAsync();
             return (count, "Success");
        }
        catch(Exception ex) 
        { 
            _logger.LogError(ex, "CISA Ingestion Failed"); 
            return (0, "Failed"); 
        }
    }

    // Renamed existing method
    public async Task<(int Count, string Message)> IngestLatestCvesAsync() => await IngestAllAsync(); 

    private async Task<(int, string)> IngestBreakingNewsAsync()
    {
         // Real RSS Feed: The Hacker News
         try 
         {
             var rssUrl = "https://feeds.feedburner.com/TheHackersNews";
             // Use a browser-like user agent to avoid 403s
             _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
             
             var rssContent = await _httpClient.GetStringAsync(rssUrl);
             var xdoc = System.Xml.Linq.XDocument.Parse(rssContent);
             
             // Setup Namespace if needed (often RSS is default, but Atom exists. Assuming standard RSS 2.0 here)
             // Simple interaction: Descendants("item")
             var items = xdoc.Descendants("item").Take(50); // Take top 50 breaking news

             var source = await GetOrCreateSourceAsync("The Hacker News", "News Feed");
             int count = 0;

             foreach(var item in items)
             {
                 var title = item.Element("title")?.Value?.Trim() ?? "Unknown News";
                 var link = item.Element("link")?.Value?.Trim();
                 var pubDateStr = item.Element("pubDate")?.Value;
                 var description = item.Element("description")?.Value;
                 
                 // Clean description (often contains HTML)
                 var summary = System.Text.RegularExpressions.Regex.Replace(description ?? "", "<.*?>", String.Empty).Trim();
                 if (summary.Length > 300) summary = summary.Substring(0, 297) + "...";

                 var dedupKey = $"THN-{ComputeStableHash(link ?? title)}";

                 // Check Hash OR Title (Double safety for news)
                 if (await _context.ThreatItems.AnyAsync(t => t.HashDedup == dedupKey || t.Title == title)) continue;

                 DateTime pubDate = DateTime.UtcNow;
                 if (DateTime.TryParse(pubDateStr, out var parsedDate)) pubDate = parsedDate.ToUniversalTime();

                 var threat = new ThreatItem 
                 {
                     Title = title,
                     Summary = summary,
                     ThreatType = "News",
                     Severity = 7, // Default to High for Breaking News
                     Confidence = 80, // News is reliable but not a confirmed technical exploit verification
                     FirstSeen = pubDate,
                     LastSeen = DateTime.UtcNow,
                     Status = ThreatStatus.New,
                     HashDedup = dedupKey,
                     SourceId = source.Id,
                     MetadataJson = JsonSerializer.Serialize(new { Link = link, RawDate = pubDateStr })
                 };

                 _context.ThreatItems.Add(threat);
                 count++;
             }
             
             await _context.SaveChangesAsync();
             return (count, "Success");
         }
         catch (Exception ex)
         { 
             _logger.LogError(ex, "RSS Ingestion Failed");
             return (0, $"Failed: {ex.Message}"); 
         }
    } 

    private async Task<(int, string)> IngestAlienVaultOtxAsync()
    {
        try
        {
            if (await DailyLimitReachedAsync()) return (0, "Skipped (Limit Reached)");
            
            var apiKey = _configuration["ThreatIntel:AlienVaultApiKey"];
            if (string.IsNullOrEmpty(apiKey)) return (0, "Missing API Key");

            var url = "https://otx.alienvault.com/api/v1/pulses/subscribed";
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("X-OTX-API-KEY", apiKey);
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("OrangeIntel/1.0");

            var response = await _httpClient.GetFromJsonAsync<OtxResponse>(url);
            if (response?.results == null) return (0, "No results");

            int count = 0;
            var source = await GetOrCreateSourceAsync("AlienVault OTX", "Community");

            foreach (var pulse in response.results.GroupBy(p => p.id).Select(g => g.First()).Take(50)) 
            {
                if (await DailyLimitReachedAsync()) break;
                if (await _context.ThreatItems.AnyAsync(t => t.HashDedup == pulse.id)) continue;

                // Severity Logic: 
                // APT/Ransomware -> Critical (9)
                // Default -> Medium (5) - Changed from High(7) to demonstrate Medium logic
                var severity = 5; 
                if (pulse.tags != null && (pulse.tags.Contains("apt") || pulse.tags.Contains("ransomware"))) severity = 9;

                // Confidence Logic:
                // Simulate variable confidence. 
                // Real OTX pulses vary, but we'll default to 60 (Passes medium threshold) 
                // unless it's critical (90).
                var confidence = severity == 9 ? 90 : 60;

                // --- GLOBAL THREAT POLICY GATES ---
                
                // 1. Do Not Ingest Low
                if (severity < 4) continue; 

                // 2. Medium Requires Context (Confidence >= 50)
                if (severity >= 4 && severity <= 6)
                {
                    if (confidence < 50) continue; // Filter out low-confidence medium threats
                }

                // ----------------------------------

                var threat = new ThreatItem
                {
                    Title = pulse.name?.Length > 200 ? pulse.name.Substring(0, 200) : (pulse.name ?? "Unknown"),
                    Summary = pulse.description ?? "No description provided.",
                    ThreatType = "Threat Intel Pulse",
                    Severity = severity,
                    Confidence = confidence,
                    FirstSeen = pulse.created.ToUniversalTime(),
                    LastSeen = pulse.modified.ToUniversalTime(),
                    MetadataJson = JsonSerializer.Serialize(pulse),
                    Status = ThreatStatus.New,
                    HashDedup = !string.IsNullOrEmpty(pulse.id) ? pulse.id : $"OTX-Fallback-{ComputeStableHash(pulse.name + pulse.created.ToString())}",
                    SourceId = source.Id
                };
                
                _context.ThreatItems.Add(threat);
                count++;
            }

            await _context.SaveChangesAsync();
            return (count, "Success");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to ingest AlienVault Pulses");
            return (-1, ex.Message);
        }
    }

    private async Task<ThreatSource> GetOrCreateSourceAsync(string name, string type)
    {
        var source = await _context.ThreatSources.FirstOrDefaultAsync(s => s.Name == name);
        if (source == null)
        {
            // Fetch dynamic poll interval
            var pollSetting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == "poll_interval");
            int pollInterval = 30; // Default
            if (pollSetting != null && int.TryParse(pollSetting.Value, out int val))
            {
                pollInterval = val;
            }

            source = new ThreatSource
            {
                Name = name,
                Type = type,
                RequiresApiKey = false,
                PollIntervalMinutes = pollInterval, 
                LastFetchedAt = DateTime.UtcNow,
                Enabled = true
            };
            _context.ThreatSources.Add(source);
            await _context.SaveChangesAsync();
        }
        return source;
    }
}

// CISA DTOs
public class CisaKevResponse
{
    public string title { get; set; }
    public string catalogVersion { get; set; }
    public List<CisaVuln> vulnerabilities { get; set; }
}

public class CisaVuln
{
    public string cveID { get; set; }
    public string vendorProject { get; set; }
    public string product { get; set; }
    public string vulnerabilityName { get; set; }
    public string dateAdded { get; set; }
    public string shortDescription { get; set; }
    public string requiredAction { get; set; }
    public string notes { get; set; }
}

// Helper DTOs for AlienVault OTX
public class OtxResponse
{
    public int count { get; set; }
    public string? next { get; set; }
    public string? previous { get; set; }
    public List<OtxPulse>? results { get; set; }
}

public class OtxPulse
{
    public string? id { get; set; }
    public string? name { get; set; }
    public string? description { get; set; }
    public string? author_name { get; set; }
    public DateTime created { get; set; }
    public DateTime modified { get; set; }
    public List<string>? tags { get; set; }
}
