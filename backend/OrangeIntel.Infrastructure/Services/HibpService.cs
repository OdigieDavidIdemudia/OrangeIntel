using System;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using OrangeIntel.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace OrangeIntel.Infrastructure.Services;

public class HibpService : IHibpService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<HibpService> _logger;

    public HibpService(HttpClient httpClient, ILogger<HibpService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<bool> IsPasswordPwnedAsync(string password)
    {
        try
        {
            var sha1 = SHA1.Create();
            var hashBytes = sha1.ComputeHash(Encoding.UTF8.GetBytes(password));
            var hashString = BitConverter.ToString(hashBytes).Replace("-", "").ToUpper();

            var prefix = hashString.Substring(0, 5);
            var suffix = hashString.Substring(5);

            var response = await _httpClient.GetStringAsync($"https://api.pwnedpasswords.com/range/{prefix}");
            var lines = response.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);

            return lines.Any(line => line.StartsWith(suffix, StringComparison.OrdinalIgnoreCase));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check HIBP API");
            return false; // Fail open (don't block user if API is down)
        }
    }
}
