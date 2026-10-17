namespace SmartHouse.Api.Entities;

/// <summary>Holds provider tokens and the access token's expiration for encrypted storage.</summary>
public sealed record TokenSet(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt);
