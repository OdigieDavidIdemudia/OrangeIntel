using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using TealHunt.Application.Interfaces;

namespace TealHunt.Infrastructure.Services;

public class JwtTokenService : ITokenService
{
    private readonly IConfiguration _config;

    public JwtTokenService(IConfiguration config)
    {
        _config = config;
    }

    public string GenerateAccessToken(IEnumerable<Claim> claims)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "super_secret_key_change_me_in_prod_12345!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiryMinutes = int.Parse(_config["Jwt:ExpiryMinutes"] ?? "15");

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "TealHunt",
            audience: _config["Jwt:Audience"] ?? "TealHuntUser",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    public ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "super_secret_key_change_me_in_prod_12345!"));
        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false, // Verify explicitly if needed
            ValidateIssuer = false,   // Verify explicitly if needed
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = false // Ignore expiry to validation parameters
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken securityToken);
        
        if (securityToken is not JwtSecurityToken jwtSecurityToken || 
            !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            throw new SecurityTokenException("Invalid token");

        return principal;
    }

    public string GenerateMfaTrustToken(string userId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "super_secret_key_change_me_in_prod_12345!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim("sub", userId),
            new Claim("mfa_trust", "true")
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "TealHunt",
            audience: _config["Jwt:Audience"] ?? "TealHuntUser",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public bool ValidateMfaTrustToken(string token, string userId)
    {
        if (string.IsNullOrEmpty(token)) return false;
        
        try
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "super_secret_key_change_me_in_prod_12345!"));
            var tokenHandler = new JwtSecurityTokenHandler();
            var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateAudience = true,
                ValidateIssuer = true,
                ValidAudience = _config["Jwt:Audience"] ?? "TealHuntUser",
                ValidIssuer = _config["Jwt:Issuer"] ?? "TealHunt",
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateLifetime = true
            }, out _);

            var subClaim = principal.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier) ?? principal.Claims.FirstOrDefault(c => c.Type == "sub");
            var trustClaim = principal.Claims.FirstOrDefault(c => c.Type == "mfa_trust");

            return subClaim?.Value == userId && trustClaim?.Value == "true";
        }
        catch
        {
            return false;
        }
    }
}
