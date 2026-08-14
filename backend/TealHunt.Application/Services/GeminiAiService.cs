using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TealHunt.Application.Interfaces;

namespace TealHunt.Application.Services;

public class GeminiAiService : IGeminiAiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GeminiAiService> _logger;

    public GeminiAiService(HttpClient httpClient, IConfiguration configuration, ILogger<GeminiAiService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> AnalyzeReportFormatAsync(string reportJson)
    {
        try
        {
            var apiKey = _configuration["Gemini:ApiKey"];
            if (string.IsNullOrEmpty(apiKey))
            {
                _logger.LogWarning("Gemini API key is not configured.");
                return reportJson;
            }

            var prompt = "You are a cyber threat intelligence report formatting assistant. " +
                         "Please review the following JSON report data for correctness and professional formatting. " +
                         "Correct any obvious formatting errors, typos, or tone issues. " +
                         "Return ONLY the corrected JSON without any markdown formatting or extra text.\n\n" +
                         reportJson;

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.2
                }
            };

            var response = await _httpClient.PostAsJsonAsync($"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}", requestBody);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError($"Gemini API error: {error}");
                return reportJson;
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(jsonResponse);
            var root = doc.RootElement;

            if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
            {
                var text = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
                // Clean markdown code blocks if the AI accidentally adds them
                if (text.StartsWith("```json")) text = text.Substring(7);
                if (text.StartsWith("```")) text = text.Substring(3);
                if (text.EndsWith("```")) text = text.Substring(0, text.Length - 3);

                return text.Trim();
            }

            return reportJson;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to analyze report format with Gemini AI.");
            return reportJson;
        }
    }
}
