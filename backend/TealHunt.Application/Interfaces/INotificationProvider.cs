namespace TealHunt.Application.Interfaces;

public interface INotificationProvider
{
    string Name { get; }
    Task<bool> SendAsync(string recipient, string title, string body, byte[] attachment = null, string attachmentName = null);
}
