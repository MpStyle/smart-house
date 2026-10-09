using System.Text.Json;

namespace SmartHouse.Api.BusinessModels;

public interface INetatmoClient
{
    Task<JsonElement> Get(string sessionId, string endpoint, Dictionary<string, string?>? query, CancellationToken ct);
}
