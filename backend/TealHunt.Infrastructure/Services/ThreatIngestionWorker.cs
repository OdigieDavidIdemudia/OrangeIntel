using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace TealHunt.Infrastructure.Services;

public class ThreatIngestionWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ThreatIngestionWorker> _logger;
    private readonly TimeSpan _pollInterval = TimeSpan.FromMinutes(15);

    public ThreatIngestionWorker(IServiceProvider serviceProvider, ILogger<ThreatIngestionWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Threat Ingestion Worker is starting.");

        // Initial delay to allow the system to settle
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Starting scheduled threat ingestion cycle at: {time}", DateTimeOffset.Now);

            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var ingestionService = scope.ServiceProvider.GetRequiredService<ThreatIngestionService>();
                    var (count, message) = await ingestionService.IngestAllAsync();
                    _logger.LogInformation("Ingestion cycle complete. Count: {count}, Message: {message}", count, message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred during the scheduled threat ingestion cycle.");
            }

            _logger.LogInformation("Waiting for next ingestion cycle in {minutes} minutes.", _pollInterval.TotalMinutes);
            await Task.Delay(_pollInterval, stoppingToken);
        }

        _logger.LogInformation("Threat Ingestion Worker is stopping.");
    }
}
