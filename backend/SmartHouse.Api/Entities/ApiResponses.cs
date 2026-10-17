namespace SmartHouse.Api.Entities;

/// <summary>Exposes a safe, machine-readable API failure code.</summary>
public sealed record ApiError(string Code);
/// <summary>Reports process readiness.</summary>
public sealed record HealthResponse(string Status);
/// <summary>Reports browser session state without exposing provider credentials.</summary>
public sealed record SessionResponse(
    bool Authenticated, string CsrfToken, bool AuthAvailable, bool DemoAvailable, bool Demo, DateTimeOffset? ExpiresAt);
/// <summary>Describes an authorized home without internal provider identifiers.</summary>
public sealed record HomeResponse(string Id, string Name, string Timezone);
/// <summary>Lists authorized homes, discovery warnings, and the account display identity.</summary>
public sealed record HomesResponse(HomeResponse[] Homes, string[] Warnings, string? AccountName);
/// <summary>Returns a home's timestamped readings and update warnings.</summary>
public sealed record SnapshotResponse(
    string HomeId, string Timezone, DateTimeOffset FetchedAt, RoomResponse[] Rooms, string[] Warnings);
/// <summary>Groups API readings by room.</summary>
public sealed record RoomResponse(string Id, string Name, MeasurementResponse[] Measurements);
/// <summary>Returns a reading's value, units, provenance, and availability without internal history sources.</summary>
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
