namespace SmartHouse.Api.Entities;

public sealed record HistoryPoint(DateTimeOffset Time, double? Value);
