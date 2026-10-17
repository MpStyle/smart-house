using System.Text.Json;

namespace SmartHouse.Api.BusinessModels;

public interface INetatmoClient
{
    /// <summary>Retrieves provider data using the server-side credentials of the specified session.</summary>
    Task<JsonElement> Get(string sessionId, string endpoint, Dictionary<string, string?>? query, CancellationToken ct);
}
