namespace SmartHouse.Api.Entities;

/// <summary>Contains the account's temperature, wind, and pressure unit preferences.</summary>
public sealed record Units(int System = 0, int Wind = 0, int Pressure = 0);
