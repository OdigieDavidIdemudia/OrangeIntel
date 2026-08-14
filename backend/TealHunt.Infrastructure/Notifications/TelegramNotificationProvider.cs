using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TealHunt.Application.Interfaces;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace TealHunt.Infrastructure.Notifications;

public class TelegramNotificationProvider : INotificationProvider
{
    public string Name => "Telegram";
    private readonly IConfiguration _config;
    private readonly ILogger<TelegramNotificationProvider> _logger;
    private readonly HttpClient _httpClient;
    private readonly ISystemSettingService _settings;

    public TelegramNotificationProvider(IConfiguration config, ILogger<TelegramNotificationProvider> logger, HttpClient httpClient, ISystemSettingService settings)
    {
        _config = config;
        _logger = logger;
        _httpClient = httpClient;
        _settings = settings;
    }

    public async Task<bool> SendAsync(string recipient, string title, string body, byte[] attachment = null, string attachmentName = null)
    {
        // Read bot token from DB first, then fall back to IConfiguration
        var botToken = await _settings.GetSettingAsync("telegram_bot_token", string.Empty);
        if (string.IsNullOrEmpty(botToken))
            botToken = _config["Telegram:BotToken"] ?? string.Empty;

        if (string.IsNullOrEmpty(botToken) || botToken == "<BOT_TOKEN>")
        {
            _logger.LogWarning("Telegram BotToken is not configured.");
            return false;
        }

        // Read default chat ID from DB first, then fall back to IConfiguration
        var defaultChatId = await _settings.GetSettingAsync("telegram_chat_id", string.Empty);
        if (string.IsNullOrEmpty(defaultChatId))
            defaultChatId = _config["Telegram:ChatId"] ?? string.Empty;

        // Use the recipient (per-user chat ID) if provided, otherwise use the global default
        var targetChatId = string.IsNullOrEmpty(recipient) ? defaultChatId : recipient;
        if (string.IsNullOrEmpty(targetChatId) || targetChatId == "<CHAT_ID>")
        {
            _logger.LogWarning("Telegram ChatId is not configured.");
            return false;
        }

        var message = $"{title}\n\n{body}";
        var url = $"https://api.telegram.org/bot{botToken}/sendMessage";

        var payload = new
        {
            chat_id = targetChatId,
            text = message,
            parse_mode = "Markdown"
        };

        try
        {
            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Telegram API failed with status {StatusCode}: {Error}", response.StatusCode, error);
                return false;
            }

            _logger.LogInformation("Telegram notification sent successfully to {ChatId}", targetChatId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while sending Telegram notification.");
            return false;
        }
    }
}

