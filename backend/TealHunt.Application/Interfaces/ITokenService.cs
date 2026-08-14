using System.Security.Claims;

namespace TealHunt.Application.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(IEnumerable<Claim> claims);
    string GenerateRefreshToken();
    ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
    string GenerateMfaTrustToken(string userId);
    bool ValidateMfaTrustToken(string token, string userId);
}
