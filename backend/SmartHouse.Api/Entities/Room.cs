namespace SmartHouse.Api.Entities;

public sealed record Room(string Id, string Name, Measurement[] Measurements);
