namespace OrangeIntel.Application.Interfaces;

public interface INotificationProvider
{
    Task<bool> SendAsync(string recipient, string title, string body);
}
