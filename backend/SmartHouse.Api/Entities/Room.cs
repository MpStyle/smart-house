namespace SmartHouse.Api.Entities;

/// <summary>Groups readings under a normalized room identity and display name.</summary>
public sealed record Room(string Id, string Name, Measurement[] Measurements);
