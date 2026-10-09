namespace SmartHouse.Api.Entities;

public sealed record TokenSet(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt);
