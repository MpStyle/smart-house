namespace SmartHouse.Api.Entities;

public sealed record HistorySource(string Endpoint, string DeviceId, string? ModuleId, string? RoomId, string Type);
