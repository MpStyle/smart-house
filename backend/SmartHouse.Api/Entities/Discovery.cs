namespace SmartHouse.Api.Entities;

/// <summary>Contains authorized homes, account units, and discovery warnings.</summary>
public sealed record Discovery(Home[] Homes, Units Units, string[] Warnings, string? AccountName = null);
