namespace SmartHouse.Api.Entities;

/// <summary>Identifies the authorized provider source of a measurement's history.</summary>
public sealed record HistorySource(string Endpoint, string DeviceId, string? ModuleId, string? RoomId, string Type);
