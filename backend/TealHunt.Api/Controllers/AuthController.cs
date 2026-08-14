using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TealHunt.Api.Dtos;
using TealHunt.Application.Interfaces;
using TealHunt.Domain.Entities;
using TealHunt.Infrastructure.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Caching.Memory;

namespace TealHunt.Api.Controllers;

[Route("api/auth")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly ITokenService _tokenService;
    private readonly IOneTimePasswordService _otpService;
    private readonly EncryptionService _encryptionService;
    private readonly IHibpService _hibpService;
    private readonly ILogger<AuthController> _logger;
    private readonly TealHunt.Infrastructure.Data.ApplicationDbContext _context;

    public AuthController(
        UserManager<AppUser> userManager,
        SignInManager<AppUser> signInManager,
        ITokenService tokenService,
        IOneTimePasswordService otpService,
        EncryptionService encryptionService,
        IHibpService hibpService,
        ILogger<AuthController> logger,
        TealHunt.Infrastructure.Data.ApplicationDbContext context)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _otpService = otpService;
        _encryptionService = encryptionService;
        _hibpService = hibpService;
        _logger = logger;
        _context = context;
    }

    [AllowAnonymous]
    [HttpGet("login")]
    public IActionResult LoginStatus()
    {
        return Ok(new { status = "READY", method = "POST", message = "Auth endpoint is reachable." });
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<TokenDto>> Login([FromBody] LoginDto model, [FromServices] Microsoft.Extensions.Caching.Memory.IMemoryCache cache)
    {
        var ipAddress = Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var cacheKey = $"login_attempt_{ipAddress}";
        
        if (cache.TryGetValue(cacheKey, out int attempts) && attempts >= 10)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, "Too many login attempts. Please try again in a minute.");
        }

        _logger.LogInformation("Login attempt for {Identifier} from IP: {IP}", model.UsernameOrEmail, ipAddress);
        
        var user = await _userManager.FindByEmailAsync(model.UsernameOrEmail) 
                   ?? await _userManager.FindByNameAsync(model.UsernameOrEmail);

        if (user == null) 
        {
            _logger.LogWarning("Login failed: User {Identifier} not found.", model.UsernameOrEmail);
            return Unauthorized("Invalid credentials (User not found)");
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, model.Password, false);
        if (!result.Succeeded) 
        {
            // Increment rate limit counter
            var cacheOptions = new Microsoft.Extensions.Caching.Memory.MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1)
            };
            cache.Set(cacheKey, (cache.TryGetValue(cacheKey, out int current) ? current : 0) + 1, cacheOptions);

            _logger.LogWarning("Login failed: Invalid password for user {Identifier}. IsLockedOut: {Locked}, IsNotAllowed: {NotAllowed}", 
                model.UsernameOrEmail, result.IsLockedOut, result.IsNotAllowed);
            return Unauthorized("Invalid credentials (Password/Account issue)");
        }

        // HIBP Password Breach Check
        bool isPwned = await _hibpService.IsPasswordPwnedAsync(model.Password);

        // MFA Check
        if (!string.IsNullOrEmpty(user.MfaSecret))
        {
            // Check for 24h mfa_trust cookie
            bool isTrusted = Request.Cookies.TryGetValue("mfa_trust", out var trustToken) && 
                             _tokenService.ValidateMfaTrustToken(trustToken, user.Id);

            if (!isTrusted && string.IsNullOrEmpty(model.MfaCode))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { 
                    message = "MFA required", 
                    requiresMfa = true,
                    isPasswordPwned = isPwned 
                });
            }

            if (!isTrusted)
            {
                var decryptedSecret = _encryptionService.Decrypt(user.MfaSecret);
                if (!_otpService.VerifyCode(decryptedSecret, model.MfaCode))
                {
                    return Unauthorized("Invalid MFA code");
                }

                // If user checked "Trust this device" (we'll add this to LoginDto)
                if (model.TrustDevice)
                {
                    var trustTokenNew = _tokenService.GenerateMfaTrustToken(user.Id);
                    Response.Cookies.Append("mfa_trust", trustTokenNew, new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = true,
                        SameSite = SameSiteMode.Strict,
                        Expires = DateTimeOffset.UtcNow.AddHours(24)
                    });
                }
            }
        }

        var tokenResponse = await GenerateTokenResponse(user);
        
        return Ok(new { 
            accessToken = tokenResponse.AccessToken,
            refreshToken = tokenResponse.RefreshToken,
            isPasswordPwned = isPwned,
            message = isPwned ? "Warning: Your password was found in a known data breach. We recommend changing it." : null,
            requiresPasswordChange = user.RequiresPasswordChange,
            requiresMfaSetup = user.MfaEnforced && string.IsNullOrEmpty(user.MfaSecret)
        });
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<TokenDto>> Refresh([FromBody] RefreshTokenDto model)
    {
        var principal = _tokenService.GetPrincipalFromExpiredToken(model.AccessToken);
        if (principal == null) return BadRequest("Invalid access token/refresh token");
        
        var username = principal.Identity?.Name; // Identity name is mapped to Email or username depending on claim
        // Actually, let's look for ClaimTypes.NameIdentifier or similar if needed, 
        // but User.Identity.Name is populated by "sub" or "name" usually.
        // Let's rely on finding user by a claim we put in.
        
        var emailClaim = principal.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email) ?? principal.Claims.FirstOrDefault(c => c.Type == "email");
        if (emailClaim == null) return BadRequest("Invalid token claims");

        var user = await _userManager.FindByEmailAsync(emailClaim.Value);
        if (user == null || user.RefreshToken != model.RefreshToken || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
        {
            return BadRequest("Invalid or expired refresh token");
        }

        return await GenerateTokenResponse(user);
    }
    
    [Authorize]
    [HttpPost("mfa/setup")]
    public async Task<ActionResult<MfaSetupDto>> SetupMfa()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        var secret = _otpService.GenerateSecret();
        var uri = _otpService.GenerateQrCodeUri(user.Email!, secret);

        return new MfaSetupDto
        {
            Secret = secret,
            QrCodeUri = uri
        };
    }

    [Authorize]
    [HttpPost("mfa/verify")]
    public async Task<ActionResult> VerifyMfaSetup([FromBody] MfaVerifyDto model)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        if (string.IsNullOrEmpty(model.Secret)) return BadRequest("Secret required for setup verification");

        if (_otpService.VerifyCode(model.Secret, model.Code))
        {
            user.MfaSecret = _encryptionService.Encrypt(model.Secret);
            await _userManager.UpdateAsync(user);
            return Ok("MFA enabled successfully");
        }

        return BadRequest("Invalid MFA code");
    }

    [Authorize]
    [HttpPost("mfa/disable")]
    public async Task<ActionResult> DisableMfa()
    {
         var user = await _userManager.GetUserAsync(User);
         if (user == null) return Unauthorized();
         
         // In production, we should ask for password again here for high security
         user.MfaSecret = null;
         await _userManager.UpdateAsync(user);
         
         return Ok("MFA disabled");
    }

    [AllowAnonymous]
    [HttpGet("diagnostics")]
    public async Task<ActionResult> Diagnostics()
    {
        var result = new Dictionary<string, object>();
        
        try 
        {
            result["availableEnvVars"] = Environment.GetEnvironmentVariables().Keys.Cast<string>().ToList();
            var rawUrl = Environment.GetEnvironmentVariable("DATABASE_URL") ?? "NOT_SET";
            result["rawDatabaseUrlLength"] = rawUrl.Length;
            result["rawDatabaseUrlStart"] = rawUrl.Length > 20 ? rawUrl.Substring(0, 20) : rawUrl;
            
            var conn = _context.Database.GetDbConnection();
            var connString = conn.ConnectionString;
            result["efConnectionStringLength"] = connString?.Length ?? 0;
            result["efConnectionStringStart"] = (connString?.Length > 30) ? connString.Substring(0, 30) : connString;
            result["efConnectionStringType"] = connString?.StartsWith("postgres://") == true ? "URL (INVALID)" : "Standard";
            
            var sanitizedConn = connString;
            if (connString != null && connString.Contains("Password=")) {
                var parts = connString.Split(';');
                sanitizedConn = string.Join(";", parts.Where(p => !p.StartsWith("Password=")));
            }
            result["connectionInfo"] = sanitizedConn;
            result["env_ASPNETCORE_ENVIRONMENT"] = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

            result["userCount"] = await _userManager.Users.CountAsync();
            var usersList = await _userManager.Users.ToListAsync();
            var userDiagnostics = new List<object>();

            foreach (var user in usersList)
            {
                var userRoles = await _userManager.GetRolesAsync(user);
                userDiagnostics.Add(new
                {
                    Email = user.Email,
                    Roles = string.Join(",", userRoles)
                });
            }
            result["users"] = userDiagnostics;
            
            if (System.IO.File.Exists("seed_log.txt"))
            {
                result["seedLog"] = await System.IO.File.ReadAllTextAsync("seed_log.txt");
            }
            else
            {
                result["seedLog"] = "seed_log.txt not found";
            }
            
            result["status"] = "OK";
        }
        catch (Exception ex)
        {
            result["status"] = "ERROR";
            result["error"] = ex.Message;
            result["inner"] = ex.InnerException?.Message;
            result["stack"] = ex.StackTrace;
        }

        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("test-admin-login")]
    public async Task<ActionResult> TestAdmin()
    {
         try
         {
             var adminEmail = "admin@tealhunt.local";
             var user = await _userManager.FindByEmailAsync(adminEmail);
             if (user == null) return Ok(new { status = "NOT_FOUND", message = "Admin user not found in DB" });

             // Force reset password and clear lockout for debugging
             await _userManager.RemovePasswordAsync(user);
             await _userManager.AddPasswordAsync(user, "Admin123!");
             await _userManager.SetLockoutEndDateAsync(user, null);
             await _userManager.ResetAccessFailedCountAsync(user);

             var result = await _signInManager.CheckPasswordSignInAsync(user, "Admin123!", false);
             
             return Ok(new {
                 status = "OK",
                 Email = user.Email,
                 PasswordTest = result.Succeeded ? "SUCCESS" : "FAILED",
                 IsLockedOut = result.IsLockedOut,
                 IsNotAllowed = result.IsNotAllowed,
                 RequiresTwoFactor = result.RequiresTwoFactor,
                 EmailConfirmed = user.EmailConfirmed,
                 MfaEnabled = !string.IsNullOrEmpty(user.MfaSecret),
                 Id = user.Id
             });
         }
         catch (Exception ex)
         {
             return Ok(new { status = "ERROR", error = ex.Message, inner = ex.InnerException?.Message });
         }
    }

    private async Task<TokenDto> GenerateTokenResponse(AppUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.UserName!),
            new Claim(ClaimTypes.Email, user.Email!),
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim("id", user.Id),
            new Claim("token_version", user.TokenVersion.ToString())
        };
        
        foreach(var r in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, r));
        }

        var accessToken = _tokenService.GenerateAccessToken(claims);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

        return new TokenDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken
        };
    }
}
