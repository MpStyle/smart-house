namespace SmartHouse.Api.Entities;

/// <summary>Maps a provider field to its display kind, unit, and supported history type.</summary>
public sealed record Metric(string Field, string Kind, string? HistoryType, string Unit);
