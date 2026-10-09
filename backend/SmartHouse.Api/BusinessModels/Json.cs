using System.Text.Json;

namespace SmartHouse.Api.BusinessModels;

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
