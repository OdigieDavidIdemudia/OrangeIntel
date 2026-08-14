using System.Threading.Tasks;
using TealHunt.Application.DTOs;

namespace TealHunt.Application.Interfaces;

public interface IIocProvider
{
    string Name { get; }
    
    // Returns a risk score (0-100) and the raw provider data.
    // userId is passed so the provider can check user-specific keys before falling back to global keys.
    Task<(int Score, ProviderResult Result)> QueryAsync(string indicator, string indicatorType, string? userId = null);
}
