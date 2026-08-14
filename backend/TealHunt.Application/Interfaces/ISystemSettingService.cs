namespace TealHunt.Application.Interfaces;

public interface ISystemSettingService
{
    Task<string> GetSettingAsync(string key, string defaultValue = "");
    Task<int> GetIntSettingAsync(string key, int defaultValue = 0);
    Task<bool> GetBoolSettingAsync(string key, bool defaultValue = false);
}
