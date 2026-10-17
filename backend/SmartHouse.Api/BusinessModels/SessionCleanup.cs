using Microsoft.Data.Sqlite;

namespace SmartHouse.Api.BusinessModels;

/// <summary>Periodically removes expired server sessions and their cached data.</summary>
public sealed class SessionCleanup(SessionStore store, ILogger<SessionCleanup> logger) : BackgroundService
{
    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                store.Cleanup();
            }
            catch (SqliteException exception)
            {
                logger.LogError(exception, "Expired session cleanup failed.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
