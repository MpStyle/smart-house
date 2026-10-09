using System.Text.Json;

namespace SmartHouse.Api;

public sealed record Units(int System = 0, int Wind = 0, int Pressure = 0);
public sealed record Home(string Id, string Name, string Timezone, string? EnergyId, string[] StationIds);
public sealed record HistorySource(string Endpoint, string DeviceId, string? ModuleId, string? RoomId, string Type);
public sealed record Measurement(
    string Id, string Kind, string DeviceName, double? Value, string Unit,
    DateTimeOffset? MeasuredAt, HistorySource? Source)
{
    public bool HasHistory => Source is not null;
}
public sealed record Room(string Id, string Name, Measurement[] Measurements);
public sealed record Snapshot(string HomeId, string Timezone, DateTimeOffset FetchedAt, Room[] Rooms, string[] Warnings);
public sealed record HistoryPoint(DateTimeOffset Time, double? Value);
public sealed record History(string MeasurementId, string Unit, DateTimeOffset From, DateTimeOffset To, HistoryPoint[] Points);
public sealed record Discovery(Home[] Homes, Units Units, string[] Warnings);
public sealed record TokenSet(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt);
public sealed record StoredSession(TokenSet Tokens, DateTimeOffset ExpiresAt, bool Demo);
public sealed record CacheEntry<T>(DateTimeOffset AttemptedAt, T Value);

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static JsonElement Field(this JsonElement json, string name) =>
        json.ValueKind == JsonValueKind.Object && json.TryGetProperty(name, out var value) ? value : default;
    public static string? Text(this JsonElement json) => json.ValueKind switch
    {
        JsonValueKind.String => json.GetString(),
        JsonValueKind.Number => json.GetRawText(),
        _ => null
    };
    public static string? Text(this JsonElement json, string name) => json.Field(name).Text();
    public static double? Number(this JsonElement json, string name) =>
        json.Field(name).ValueKind == JsonValueKind.Number && json.Field(name).TryGetDouble(out var value) && double.IsFinite(value)
            ? value : null;
    public static JsonElement[] Items(this JsonElement json) =>
        json.ValueKind == JsonValueKind.Array ? json.EnumerateArray().ToArray() : [];
    public static DateTimeOffset? Timestamp(this JsonElement json, string name) =>
        json.Number(name) is { } seconds && seconds is > 0 and < 253402300799
            ? DateTimeOffset.FromUnixTimeSeconds((long)seconds) : null;
    public static bool IsFalse(this JsonElement json, string name) => json.Field(name).ValueKind == JsonValueKind.False;
}

public sealed class ProviderException(string code, int status = 502) : Exception(code)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}
