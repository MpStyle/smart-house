namespace SmartHouse.Api.Entities;

public sealed record History(string MeasurementId, string Unit, DateTimeOffset From, DateTimeOffset To, HistoryPoint[] Points);
