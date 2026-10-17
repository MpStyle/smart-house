using System.Text.Json;

namespace SmartHouse.Api.BusinessModels;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    /// <summary>Reads an object field, returning an undefined element when absent.</summary>
    public static JsonElement Field(this JsonElement json, string name) =>
        json.ValueKind == JsonValueKind.Object && json.TryGetProperty(name, out var value) ? value : default;
    /// <summary>Reads a JSON string or the textual representation of a number.</summary>
    public static string? Text(this JsonElement json) => json.ValueKind switch
    {
        JsonValueKind.String => json.GetString(),
        JsonValueKind.Number => json.GetRawText(),
        _ => null
    };
    /// <summary>Reads a named field as text.</summary>
    public static string? Text(this JsonElement json, string name) => json.Field(name).Text();
    /// <summary>Reads a finite numeric field, or returns null when unavailable.</summary>
    public static double? Number(this JsonElement json, string name) =>
        json.Field(name).ValueKind == JsonValueKind.Number && json.Field(name).TryGetDouble(out var value) && double.IsFinite(value)
            ? value : null;
    /// <summary>Reads array elements, or returns an empty array for non-array values.</summary>
    public static JsonElement[] Items(this JsonElement json) =>
        json.ValueKind == JsonValueKind.Array ? json.EnumerateArray().ToArray() : [];
    /// <summary>Reads a valid positive Unix timestamp in seconds.</summary>
    public static DateTimeOffset? Timestamp(this JsonElement json, string name) =>
        json.Number(name) is { } seconds && seconds is > 0 and < 253402300799
            ? DateTimeOffset.FromUnixTimeSeconds((long)seconds) : null;
    /// <summary>Checks whether a named field is explicitly false.</summary>
    public static bool IsFalse(this JsonElement json, string name) => json.Field(name).ValueKind == JsonValueKind.False;
}
