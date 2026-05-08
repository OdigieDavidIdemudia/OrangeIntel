using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrangeIntel.Api.Dtos;
using OrangeIntel.Application.Interfaces;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Infrastructure.Services;
using Microsoft.Extensions.Logging;

namespace OrangeIntel.Api.Controllers;

[Route("api/auth")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly ITokenService _tokenService;
    private readonly IOneTimePasswordService _otpService;
    private readonly EncryptionService _encryptionService;
    private readonly ILogger<AuthController> _logger;
    private readonly OrangeIntel.Infrastructure.Data.ApplicationDbContext _context;

    public AuthController(
        UserManager<AppUser> userManager,
        SignInManager<AppUser> signInManager,
        ITokenService tokenService,
        IOneTimePasswordService otpService,
        EncryptionService encryptionService,
        ILogger<AuthController> logger,
        OrangeIntel.Infrastructure.Data.ApplicationDbContext context)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _otpService = otpService;
        _encryptionService = encryptionService;
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
    public async Task<ActionResult<TokenDto>> Login([FromBody] LoginDto model)
    {
        _logger.LogInformation("Login attempt for email: {Email}", model.Email);
        
        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null) 
        {
            _logger.LogWarning("Login failed: User {Email} not found.", model.Email);
            return Unauthorized("Invalid credentials (User not found)");
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, model.Password, false);
        if (!result.Succeeded) 
        {
            _logger.LogWarning("Login failed: Invalid password for user {Email}. IsLockedOut: {Locked}, IsNotAllowed: {NotAllowed}", 
                model.Email, result.IsLockedOut, result.IsNotAllowed);
            return Unauthorized("Invalid credentials (Password/Account issue)");
        }

        // MFA Check
        if (!string.IsNullOrEmpty(user.MfaSecret))
        {
            if (string.IsNullOrEmpty(model.MfaCode))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "MFA required", RequiresMfa = true });
            }

            var decryptedSecret = _encryptionService.Decrypt(user.MfaSecret);
            if (!_otpService.VerifyCode(decryptedSecret, model.MfaCode))
            {
                return Unauthorized("Invalid MFA code");
            }
        }

        return await GenerateTokenResponse(user);
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
             var adminEmail = "admin@orangeintel.local";
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
            new Claim("id", user.Id)
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
