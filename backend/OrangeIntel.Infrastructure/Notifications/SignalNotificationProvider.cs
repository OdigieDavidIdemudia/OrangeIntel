using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OrangeIntel.Application.Interfaces;

namespace OrangeIntel.Infrastructure.Notifications;

public class SignalNotificationProvider : INotificationProvider
{
    public string Name => "Signal";
    private readonly IConfiguration _config;
    private readonly ILogger<SignalNotificationProvider> _logger;

    public SignalNotificationProvider(IConfiguration config, ILogger<SignalNotificationProvider> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task<bool> SendAsync(string recipient, string title, string body)
    {
        var binaryPath = _config["Signal:BinaryPath"] ?? "signal-cli";
        var sender = _config["Signal:RegisteredNumber"];
        var timeoutSeconds = int.Parse(_config["Signal:TimeoutSeconds"] ?? "5");

        if (string.IsNullOrEmpty(sender))
        {
            _logger.LogError("Signal:RegisteredNumber is not configured.");
            return false;
        }

        var message = $"{title}\n\n{body}";
        
        // Command: signal-cli -u SENDER send -m "MESSAGE" RECIPIENT
        // Note: For groups using -g GROUP_ID is often required instead of RECIPIENT depending on signal-cli version,
        // but often the recipient arg handles both if group ID is passed.
        // Assuming RECIPIENT is the destination (User or Group ID).
        
        // Argument safety: This is a basic implementation. In production, be careful with argument injection.
        // ProcessStartInfo.ArgumentList is safer than interpolating strings.

        var startInfo = new ProcessStartInfo
        {
            FileName = binaryPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        // Construct arguments safely
        startInfo.ArgumentList.Add("-u");
        startInfo.ArgumentList.Add(sender);
        startInfo.ArgumentList.Add("send");
        
        // Handle Group vs Individual
        // The user config specified GroupId. 
        // If recipient looks like a group ID (base64ish) we might need -g
        // But typically signal-cli 'send' accepts recipients as trailing args.
        // If it's a group, we typically use -g <GROUP_ID> or just <GROUP_ID> as recipient depending on version.
        // Let's assume standard trailing recipient for now.
        
        // If the recipient passed in is explicitly the configured GroupId, let's treat it as a group if needed.
        // For simplicity:
        // signal-cli -u +12345 send -m "Hello" -g <GROUP_ID>   <-- for groups
        // signal-cli -u +12345 send -m "Hello" +15555555555    <-- for users
        
        var configuredGroupId = _config["Signal:GroupId"];
        bool isGroup = recipient == configuredGroupId;

        if (isGroup)
        {
            startInfo.ArgumentList.Add("-g");
            startInfo.ArgumentList.Add(recipient);
        }
        else
        {
            startInfo.ArgumentList.Add(recipient);
        }

        startInfo.ArgumentList.Add("-m");
        startInfo.ArgumentList.Add(message);

        try
        {
            _logger.LogInformation("Executing signal-cli: {FileName} {Arguments}", startInfo.FileName, string.Join(" ", startInfo.ArgumentList));

            using var process = Process.Start(startInfo);
            if (process == null)
            {
                _logger.LogError("Failed to start signal-cli process.");
                return false;
            }

            // Fire and forget or wait?
            // "Timeout_seconds": 5 suggests we wait.
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
            
            await process.WaitForExitAsync(cts.Token);

            if (process.ExitCode != 0)
            {
                var error = await process.StandardError.ReadToEndAsync();
                _logger.LogError("signal-cli failed with exit code {ExitCode}: {Error}", process.ExitCode, error);
                return false;
            }
            
            _logger.LogInformation("Signal notification sent successfully.");
            return true;
        }
        catch (OperationCanceledException)
        {
            _logger.LogError("signal-cli timed out after {Timeout} seconds.", timeoutSeconds);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while executing signal-cli.");
            return false;
        }
    }
}
