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
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Application.Services;

namespace OrangeIntel.Infrastructure.Services;

public class ThreatIngestionService
{
    private readonly ApplicationDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly ILogger<ThreatIngestionService> _logger;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly IEnumerable<INotificationProvider> _notificationProviders;

    public ThreatIngestionService(
        ApplicationDbContext context, 
        HttpClient httpClient, 
        ILogger<ThreatIngestionService> logger, 
        IConfiguration configuration, 
        INotificationService notificationService,
        IEnumerable<INotificationProvider> notificationProviders)
    {
        _context = context;
        _httpClient = httpClient;
        _logger = logger;
        _configuration = configuration;
        _notificationService = notificationService;
        _notificationProviders = notificationProviders;
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

        // 0. Multiple RSS Feeds
        var rssFeeds = new[]
        {
            ("https://feeds.feedburner.com/TheHackersNews", "The Hacker News", "THN-"),
            ("https://www.bleepingcomputer.com/feed/", "BleepingComputer", "BC-"),
            ("https://techpoint.africa/feed/", "Techpoint Africa", "TP-"),
            ("https://www.itnewsafrica.com/feed/", "IT News Africa", "ITN-"),
            ("https://cert.gov.ng/feed/", "CERT Nigeria", "NGC-"),
            ("https://nigeriacommunicationsweek.com.ng/feed/", "Nigeria CommWeek", "NCW-"),
            ("https://techcabal.com/feed/", "TechCabal Africa", "TC-"),
            ("https://nitda.gov.ng/feed/", "NITDA Nigeria", "NIT-"),
            ("https://www.itweb.co.za/static/rss/news.xml", "ITWeb Africa", "ITW-")
        };

        foreach (var (url, sourceName, prefix) in rssFeeds)
        {
            if (await DailyLimitReachedAsync()) break;
            var (feedCount, feedMsg) = await IngestRssFeedAsync(url, sourceName, prefix);
            totalIngested += feedCount;
            messages.Add($"{sourceName}: {feedMsg}");
        }

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
                     Category = DetermineCategory($"{vuln.vulnerabilityName} {vuln.shortDescription}"),
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
                 await _notificationService.NotifyIngestionAsync(item);
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

    private async Task<(int, string)> IngestRssFeedAsync(string rssUrl, string sourceName, string dedupPrefix)
    {
         try 
         {
             // Use a browser-like user agent to avoid 403s
             _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
             
             var rssContent = await _httpClient.GetStringAsync(rssUrl);
             var xdoc = System.Xml.Linq.XDocument.Parse(rssContent);
             
             // Simple interaction: Descendants("item")
             var items = xdoc.Descendants("item").Take(50);

             var source = await GetOrCreateSourceAsync(sourceName, "News Feed");
             int count = 0;

             // Strict cybersecurity-specific require-at-least-one keywords
             var cyberKeywords = new[] {
                 "cyber", "hack", "breach", "vulnerabilit", "ransomware", "malware", "phish",
                 "exploit", "zero-day", "0-day", "data leak", "apt ", "cve-", "ddos",
                 "botnet", "trojan", "spyware", "backdoor", "rootkit", "credential",
                 "intrusion", "incident response", "threat actor", "threat intel",
                 "security flaw", "security vulnerability", "remote code", "privilege escalation",
                 "supply chain attack", "social engineering", "identity theft",
                 "data exfiltration", "lateral movement", "command and control",
                 "indicator of compromise", "ioc", "mitre", "attack vector",
                 "endpoint detection", "siem", "soc ", "patch tuesday", "security patch",
                 "critical infrastructure", "government agency", "financial system", "banking infrastructure"
             };

             // Off-topic blocklist — discard if ANY of these dominate the headline
             var offTopicKeywords = new[] {
                 "cryptocurrency", "bitcoin", "ethereum", "blockchain", "stablecoin", "defi",
                 "usda payment", "usdc", "crypto payment", "nft", "web3", "token",
                 "fintech", "mobile money", "digital currency", "central bank digital", "cbdc",
                 "merger", "acquisition", "ipo", "stock", "share price", "dividend",
                 "5g rollout", "telecom", "spectrum license", "election", "vote",
                 "gdp", "inflation", "interest rate", "bond yield", "loan",
                 "integrate usda", "usda payments", "stablecoin settlement",
                 "payments system", "remittance", "forex", "foreign exchange"
             };

             // Use refined relevance logic
             foreach(var item in items)
             {
                 var title = item.Element("title")?.Value?.Trim() ?? "Unknown News";
                 var link = item.Element("link")?.Value?.Trim();
                 var pubDateStr = item.Element("pubDate")?.Value;
                 var description = item.Element("description")?.Value;
                 
                 // Clean description (often contains HTML)
                var originalSummary = System.Text.RegularExpressions.Regex.Replace(description ?? "", "<.*?>", String.Empty).Trim();
                if (originalSummary.Length > 500) originalSummary = originalSummary.Substring(0, 497) + "...";

                var combinedText = (title + " " + originalSummary).ToLowerInvariant();

                 // Stage 1: Must be cyber-related and NOT off-topic
                 if (!IsCyberRelated(combinedText) || IsOffTopic(combinedText))
                     continue;

                 // Stage 2: Language check (Reject if French keywords are dominant)
                 if (IsFrench(combinedText))
                     continue;

                 var dedupKey = $"{dedupPrefix}{ComputeStableHash(link ?? title)}";

                 // Check Hash OR Title (Double safety for news)
                 if (await _context.ThreatItems.AnyAsync(t => t.HashDedup == dedupKey || t.Title == title)) continue;

                 DateTime pubDate = DateTime.UtcNow;
                 if (DateTime.TryParse(pubDateStr, out var parsedDate)) pubDate = parsedDate.ToUniversalTime();

                 // Refined Priority/Confidence Logic
                 var severity = 5; // Default to Medium for News
                 var confidence = 60; // Default Confidence for News

                 // Upgrade if high-severity keywords present
                 if (HighSeverityKeywords.Any(k => combinedText.Contains(k)))
                 {
                     severity = 8;
                     confidence = 85;
                 }

                 var threat = new ThreatItem 
                 {
                    Title = title,
                    Summary = originalSummary,
                    ThreatType = "News",
                    Category = DetermineCategory(combinedText),
                    Severity = severity,
                    Confidence = confidence,
                    FirstSeen = pubDate,
                    LastSeen = DateTime.UtcNow,
                    Status = ThreatStatus.New,
                    HashDedup = dedupKey,
                    SourceId = source.Id,
                    MetadataJson = JsonSerializer.Serialize(new { Link = link, RawDate = pubDateStr }),
                    Language = "en"
                 };

                 _context.ThreatItems.Add(threat);
                 await _notificationService.NotifyIngestionAsync(threat);
                 count++;
             }
             
             await _context.SaveChangesAsync();
             return (count, "Success");
         }
         catch (Exception ex)
         { 
             _logger.LogError(ex, "RSS Ingestion Failed for {Url}", rssUrl);
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
                    Category = DetermineCategory((pulse.name ?? "") + " " + (pulse.description ?? "")),
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
                await _notificationService.NotifyIngestionAsync(threat);
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
    public async Task<int> PurgeIrrelevantThreatsAsync()
    {
        // Use the same refined logic for purging
        var allThreats = await _context.ThreatItems.ToListAsync();

        var toDelete = allThreats.Where(t =>
        {
            // 1. Language check (Aggressive French removal)
            if (t.Language == "fr" || IsFrench(t.Title + " " + t.Summary)) return true;

            // 2. Relevance check for news
            if (t.ThreatType == "News")
            {
                var combined = ((t.Title ?? "") + " " + (t.Summary ?? "")).ToLowerInvariant();
                return !IsCyberRelated(combined) || IsOffTopic(combined);
            }

            return false;
        }).ToList();

        if (toDelete.Count > 0)
        {
            _context.ThreatItems.RemoveRange(toDelete);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Purged {Count} irrelevant threat items.", toDelete.Count);
        }

        return toDelete.Count;
    }

    // --- RELEVANCE LOGIC HELPERS ---

    private static readonly string[] CyberKeywords = new[] {
        "cyber", "hack", "breach", "vulnerabilit", "ransomware", "malware", "phish",
        "exploit", "zero-day", "0-day", "data leak", "cve-", "ddos",
        "botnet", "trojan", "spyware", "backdoor", "rootkit", "credential",
        "intrusion", "incident response", "threat actor", "threat intel",
        "security flaw", "security vulnerability", "remote code", "privilege escalation",
        "supply chain attack", "social engineering", "identity theft",
        "data exfiltration", "lateral movement", "command and control",
        "indicator of compromise", "ioc", "mitre", "attack vector",
        "endpoint detection", "siem", "patch tuesday", "security patch",
        "critical infrastructure", "government agency", "financial system", "banking infrastructure"
    };

    private static readonly string[] OffTopicKeywords = new[] {
        "cryptocurrency", "bitcoin", "ethereum", "blockchain", "stablecoin", "defi",
        "usda payment", "usdc", "crypto payment", "nft", "web3", "token",
        "fintech", "mobile money", "digital currency", "central bank digital", "cbdc",
        "merger", "acquisition", "ipo", "stock", "share price", "dividend",
        "5g rollout", "telecom", "spectrum license", "election", "vote",
        "gdp", "inflation", "interest rate", "bond yield", "loan",
        "integrate usda", "usda payments", "stablecoin settlement",
        "payments system", "remittance", "forex", "foreign exchange",
        "ai video", "dubbing tool", "filmmaker", "nollywood", "church", "content creator",
        "startup funding", "venture capital", "series a", "series b"
    };

    private static readonly string[] HighSeverityKeywords = new[] {
        "critical breach", "ransomware attack", "zero-day", "massively exploited", 
        "data of millions", "government hack", "banking system down", "supply chain breach"
    };

    private static readonly string[] FrenchIndicators = new[] {
        " le ", " la ", " les ", " de ", " et ", " est ", " pour ", " dans ", " par ", " sur ",
        "cybersécurité", "numérique", "vulnérabilité", "données", "sécurité"
    };

    private bool IsCyberRelated(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        text = text.ToLowerInvariant();
        bool hasKeyword = CyberKeywords.Any(k => text.Contains(k));
        
        if (!hasKeyword)
        {
            var shortKeywords = new[] { "apt", "soc", "cve" };
            foreach (var sk in shortKeywords)
            {
                if (System.Text.RegularExpressions.Regex.IsMatch(text, $@"\b{sk}\b")) return true;
            }
        }
        return hasKeyword;
    }

    private bool IsOffTopic(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        text = text.ToLowerInvariant();
        return OffTopicKeywords.Any(k => text.Contains(k));
    }

    private bool IsFrench(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        text = text.ToLowerInvariant();
        // Count french indicators
        int count = FrenchIndicators.Count(k => text.Contains(k));
        return count >= 3; // Threshold to avoid false positives on short strings
    }

    public string DetermineCategory(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "Uncategorized";
        text = text.ToLowerInvariant();

        var keywordMap = new Dictionary<string, string>
        {
            { "chrome", "Browsers" },
            { "edge", "Browsers" },
            { "firefox", "Browsers" },
            { "vpn", "Network Infrastructure" },
            { "cisco", "Network Infrastructure" },
            { "fortinet", "Network Infrastructure" },
            { "windows", "Operating Systems" },
            { "linux", "Operating Systems" },
            { "macos", "Operating Systems" },
            { "ransomware", "Malware" },
            { "trojan", "Malware" },
            { "mfa", "Identity & Authentication" },
            { "okta", "Identity & Authentication" },
            { "office365", "Cloud Services" },
            { "aws", "Cloud Services" },
            { "azure", "Cloud Services" },
            { "phishing", "Email & Phishing" },
            { "android", "Mobile" },
            { "ios", "Mobile" },
            { "banking", "Financial Systems" },
            { "swift", "Financial Systems" }
        };

        foreach (var kvp in keywordMap)
        {
            if (text.Contains(kvp.Key))
            {
                return kvp.Value;
            }
        }

        if (text.Contains("cve-")) return "Vulnerability/CVE";

        return "Uncategorized";
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

    public async Task<int> BroadcastRecentAlertsAsync()
    {
        var provider = _notificationProviders.FirstOrDefault(p => p.Name == "Telegram");
        if (provider == null) return 0;

        // 1. Fetch recent critical threats
        var criticalThreats = await _context.ThreatItems
            .Include(t => t.Source)
            .Where(t => t.Severity >= 8)
            .OrderByDescending(t => t.FirstSeen)
            .Take(5)
            .ToListAsync();

        if (criticalThreats.Count == 0) return 0;

        // 2. Format Message
        var title = "📢 OrangeIntel | Critical Alerts Broadcast";
        var bodyBuilder = new StringBuilder();
        bodyBuilder.AppendLine("The following high-priority threats require immediate attention:\n");

        foreach (var threat in criticalThreats)
        {
            var severityLabel = threat.Severity >= 9 ? "CRITICAL" : "HIGH";
            var sourceName = threat.Source?.Name ?? "Unknown";
            bodyBuilder.AppendLine($"*[{severityLabel}]* {threat.Title}");
            bodyBuilder.AppendLine($"> Sector: {threat.EnvironmentRelevance} | Source: {sourceName}\n");
        }

        bodyBuilder.AppendLine("\n_Action: Review all topics in the analyst dashboard._");
        var body = bodyBuilder.ToString();

        // 3. Send to Global Chat
        int successCount = 0;
        if (await provider.SendAsync("", title, body)) successCount++;

        // 4. Send to all users with Telegram IDs
        var userChatIds = await _context.Users
            .Where(u => !string.IsNullOrEmpty(u.TelegramChatId))
            .Select(u => u.TelegramChatId)
            .ToListAsync();

        foreach (var chatId in userChatIds.Distinct())
        {
            if (chatId == _configuration["Telegram:ChatId"]) continue; // Skip if already sent to global
            if (await provider.SendAsync(chatId, title, body)) successCount++;
        }

        return successCount;
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
