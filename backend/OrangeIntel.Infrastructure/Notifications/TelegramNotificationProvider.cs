using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OrangeIntel.Application.Interfaces;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace OrangeIntel.Infrastructure.Notifications;

public class TelegramNotificationProvider : INotificationProvider
{
    public string Name => "Telegram";
    private readonly IConfiguration _config;
    private readonly ILogger<TelegramNotificationProvider> _logger;
    private readonly HttpClient _httpClient;

    public TelegramNotificationProvider(IConfiguration config, ILogger<TelegramNotificationProvider> logger, HttpClient httpClient)
    {
        _config = config;
        _logger = logger;
        _httpClient = httpClient;
    }

    public async Task<bool> SendAsync(string recipient, string title, string body)
    {
        var enabled = _config.GetValue<bool>("Telegram:Enabled", false);
        if (!enabled) return false;

        var botToken = _config["Telegram:BotToken"];
        var chatId = _config["Telegram:ChatId"];

        if (string.IsNullOrEmpty(botToken) || botToken == "<BOT_TOKEN>")
        {
            _logger.LogWarning("Telegram BotToken is not configured.");
            return false;
        }

        // Use the recipient as chatId if provided, otherwise fallback to config
        var targetChatId = string.IsNullOrEmpty(recipient) ? chatId : recipient;
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
