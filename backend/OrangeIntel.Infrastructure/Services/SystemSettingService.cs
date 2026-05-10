using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Infrastructure.Data;

namespace OrangeIntel.Infrastructure.Services;

public class SystemSettingService : ISystemSettingService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _config;

    public SystemSettingService(ApplicationDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    public async Task<string> GetSettingAsync(string key, string defaultValue = "")
    {
        var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
        if (setting != null) return setting.Value;

        // Fallback to IConfiguration
        return _config[key] ?? defaultValue;
    }

    public async Task<int> GetIntSettingAsync(string key, int defaultValue = 0)
    {
        var val = await GetSettingAsync(key);
        if (int.TryParse(val, out var result)) return result;
        return defaultValue;
    }

    public async Task<bool> GetBoolSettingAsync(string key, bool defaultValue = false)
    {
        var val = await GetSettingAsync(key);
        if (bool.TryParse(val, out var result)) return result;
        return defaultValue;
    }
}
