namespace OrangeIntel.Application.Interfaces;

public interface IOneTimePasswordService
{
    string GenerateSecret();
    string GenerateQrCodeUri(string email, string secret);
    bool VerifyCode(string secret, string code);
}
