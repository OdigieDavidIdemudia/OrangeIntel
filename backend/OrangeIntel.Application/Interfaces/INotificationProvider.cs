namespace OrangeIntel.Application.Interfaces;

public interface INotificationProvider
{
    string Name { get; }
    Task<bool> SendAsync(string recipient, string title, string body);
}
