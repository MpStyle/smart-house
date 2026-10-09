namespace SmartHouse.Api.Entities;

public sealed record Metric(string Field, string Kind, string? HistoryType, string Unit);
