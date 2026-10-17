namespace SmartHouse.Api.Entities;

/// <summary>Associates a home with its timezone and authorized provider devices.</summary>
public sealed record Home(string Id, string Name, string Timezone, string? EnergyId, string[] StationIds);
