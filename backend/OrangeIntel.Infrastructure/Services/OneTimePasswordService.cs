using System.Security.Cryptography;
using System.Text;
using OrangeIntel.Application.Interfaces;

namespace OrangeIntel.Infrastructure.Services;

public class OneTimePasswordService : IOneTimePasswordService
{
    // Using a simpler implementation without external lib dependency for now to avoid NuGet issues if possible.
    // However, recreating RFC6238 correctly is error prone.
    // Plan: Use a simple manual implementation or recommend Otp.Net if available.
    // Given user constraints, I'll implement a basic TOTP validator compatible with Google Authenticator.
    
    // Period = 30s, Digits = 6, Algo = SHA1 (Standard Google Auth)
    
    public string GenerateSecret()
    {
        // Base32 secret
        var bytes = new byte[20];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Base32Encode(bytes);
    }

    public string GenerateQrCodeUri(string email, string secret)
    {
        // otpauth://totp/OrangeIntel:email?secret=SECRET&issuer=OrangeIntel&algorithm=SHA1&digits=6&period=30
        return $"otpauth://totp/OrangeIntel:{email}?secret={secret}&issuer=OrangeIntel&algorithm=SHA1&digits=6&period=30";
    }

    public bool VerifyCode(string secret, string code)
    {
        if (string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(code)) return false;
        
        // Allow for clock drift (+/- 1 step)
        long currentStep = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        
        for (long i = -1; i <= 1; i++)
        {
            if (GenerateTotp(secret, currentStep + i) == code) return true;
        }
        return false;
    }

    private string GenerateTotp(string secret, long step)
    {
        var secretBytes = Base32Decode(secret);
        var stepBytes = BitConverter.GetBytes(step);
        if (BitConverter.IsLittleEndian) Array.Reverse(stepBytes);

        using var hmac = new HMACSHA1(secretBytes);
        var hash = hmac.ComputeHash(stepBytes);

        int offset = hash[hash.Length - 1] & 0x0F;
        int binary = ((hash[offset] & 0x7F) << 24) |
                     ((hash[offset + 1] & 0xFF) << 16) |
                     ((hash[offset + 2] & 0xFF) << 8) |
                     (hash[offset + 3] & 0xFF);

        int code = binary % 1000000;
        return code.ToString("D6");
    }

    // Helpers for Base32
    private static readonly char[] _digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".ToCharArray();
    
    private string Base32Encode(byte[] data)
    {
         // Simplified Base32 Encoder
         // Not strictly optimized but functional for secret keys
         StringBuilder sb = new StringBuilder();
         int val = 0;
         int bits = 0;
         
         foreach (var b in data)
         {
             val = (val << 8) | b;
             bits += 8;
             while (bits >= 5)
             {
                 sb.Append(_digits[(val >> (bits - 5)) & 31]);
                 bits -= 5;
             }
         }
         if (bits > 0)
         {
             sb.Append(_digits[(val << (5 - bits)) & 31]);
         }
         return sb.ToString();
    }

    private byte[] Base32Decode(string input)
    {
        input = input.Trim().ToUpper().Replace(" ", "").Replace("-", "");
        var list = new List<byte>();
        int val = 0;
        int bits = 0;
        
        foreach (var c in input)
        {
            int d = Array.IndexOf(_digits, c);
            if (d < 0) continue; // skip invalid chars
            
            val = (val << 5) | d;
            bits += 5;
            
            while (bits >= 8)
            {
                list.Add((byte)((val >> (bits - 8)) & 0xFF));
                bits -= 8;
            }
        }
        return list.ToArray();
    }
}
