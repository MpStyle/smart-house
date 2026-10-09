namespace SmartHouse.Api.Entities;

public sealed record Measurement(
    string Id, string Kind, string DeviceName, double? Value, string Unit,
    DateTimeOffset? MeasuredAt, HistorySource? Source, bool UpdateFailed = false)
{
    public bool HasHistory => Source is not null;
}
