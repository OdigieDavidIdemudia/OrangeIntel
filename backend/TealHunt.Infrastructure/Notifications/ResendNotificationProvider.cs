using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TealHunt.Application.Interfaces;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace TealHunt.Infrastructure.Notifications;

public class ResendNotificationProvider : INotificationProvider
{
    public string Name => "Email";
    private readonly IConfiguration _config;
    private readonly ILogger<ResendNotificationProvider> _logger;
    private readonly HttpClient _httpClient;
    private readonly ISystemSettingService _settings;

    public ResendNotificationProvider(IConfiguration config, ILogger<ResendNotificationProvider> logger, HttpClient httpClient, ISystemSettingService settings)
    {
        _config = config;
        _logger = logger;
        _httpClient = httpClient;
        _settings = settings;
    }

    public async Task<bool> SendAsync(string recipient, string title, string body, byte[] attachment = null, string attachmentName = null)
    {
        var apiKey = await _settings.GetSettingAsync("resend_api_key", string.Empty);
        if (string.IsNullOrEmpty(apiKey))
            apiKey = _config["Resend:ApiKey"] ?? string.Empty;

        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("Resend API Key is not configured.");
            return false;
        }

        var defaultTo = await _settings.GetSettingAsync("email_alert_to", string.Empty);
        if (string.IsNullOrEmpty(defaultTo))
            defaultTo = _config["Email:DefaultTo"] ?? "team@example.com";

        var targetEmail = string.IsNullOrEmpty(recipient) ? defaultTo : recipient;
        
        var fromEmail = await _settings.GetSettingAsync("email_alert_from", string.Empty);
        if (string.IsNullOrEmpty(fromEmail))
            fromEmail = _config["Email:DefaultFrom"] ?? "alerts@tealhunt.com";

        var payload = new
        {
            from = fromEmail,
            to = new[] { targetEmail },
            subject = title,
            text = body,
            attachments = attachment != null ? new[]
            {
                new 
                {
                    filename = attachmentName ?? "ThreatAdvisory.docx",
                    content = Convert.ToBase64String(attachment)
                }
            } : null
        };

        try
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            var response = await _httpClient.PostAsJsonAsync("https://api.resend.com/emails", payload);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Resend API failed with status {StatusCode}: {Error}", response.StatusCode, error);
                return false;
            }

            _logger.LogInformation("Email notification sent successfully to {Email}", targetEmail);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while sending Email notification via Resend.");
            return false;
        }
    }
}
