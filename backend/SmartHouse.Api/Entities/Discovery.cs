namespace SmartHouse.Api.Entities;

public sealed record Discovery(Home[] Homes, Units Units, string[] Warnings, string? AccountName = null);
