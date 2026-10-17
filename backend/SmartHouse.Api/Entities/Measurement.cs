namespace SmartHouse.Api.Entities;

/// <summary>Represents a reading with provenance, timestamp, and optional history source.</summary>
public sealed record Measurement(
    string Id, string Kind, string DeviceName, double? Value, string Unit,
    DateTimeOffset? MeasuredAt, HistorySource? Source, bool UpdateFailed = false)
{
    public bool HasHistory => Source is not null;
}
