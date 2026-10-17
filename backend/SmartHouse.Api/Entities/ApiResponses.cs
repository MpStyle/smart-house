namespace SmartHouse.Api.Entities;

public sealed record ApiError(string Code);
public sealed record HealthResponse(string Status);
public sealed record SessionResponse(
    bool Authenticated, string CsrfToken, bool AuthAvailable, bool DemoAvailable, bool Demo, DateTimeOffset? ExpiresAt);
public sealed record HomeResponse(string Id, string Name, string Timezone);
public sealed record HomesResponse(HomeResponse[] Homes, string[] Warnings, string? AccountName);
public sealed record SnapshotResponse(
    string HomeId, string Timezone, DateTimeOffset FetchedAt, RoomResponse[] Rooms, string[] Warnings);
public sealed record RoomResponse(string Id, string Name, MeasurementResponse[] Measurements);
public sealed record MeasurementResponse(
    string Id, string Kind, string DeviceName, double? Value, string Unit,
    DateTimeOffset? MeasuredAt, bool HasHistory, bool UpdateFailed, MeasurementStatus Status, int? SampleMinutes);

[System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter<MeasurementStatus>))]
public enum MeasurementStatus
{
    fresh,
    stale,
    unavailable
}
