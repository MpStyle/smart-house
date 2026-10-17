namespace SmartHouse.Api.Entities;

/// <summary>Contains a measurement's history within explicit bounds and units.</summary>
public sealed record History(string MeasurementId, string Unit, DateTimeOffset From, DateTimeOffset To, HistoryPoint[] Points);
