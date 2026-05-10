using System.ComponentModel.DataAnnotations;

namespace OrangeIntel.Api.Dtos;

public class LoginDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    public string? MfaCode { get; set; }
    public bool TrustDevice { get; set; }
}

public class TokenDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
}

public class MfaSetupDto
{
    public string Secret { get; set; } = string.Empty;
    public string QrCodeUri { get; set; } = string.Empty;
}

public class MfaVerifyDto
{
    [Required]
    public string Code { get; set; } = string.Empty;
    
    public string? Secret { get; set; } // Only needed during setup verification if not yet saved
}

public class RefreshTokenDto
{
    [Required]
    public string AccessToken { get; set; } = string.Empty;
    
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}


