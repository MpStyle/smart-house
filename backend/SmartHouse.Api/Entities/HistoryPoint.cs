namespace SmartHouse.Api.Entities;

/// <summary>Represents a timestamped history sample, including a possible gap.</summary>
public sealed record HistoryPoint(DateTimeOffset Time, double? Value);
