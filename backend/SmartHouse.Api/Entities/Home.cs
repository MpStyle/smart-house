namespace SmartHouse.Api.Entities;

public sealed record Home(string Id, string Name, string Timezone, string? EnergyId, string[] StationIds);
