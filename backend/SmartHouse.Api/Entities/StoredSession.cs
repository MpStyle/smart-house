namespace SmartHouse.Api.Entities;

/// <summary>Contains server-side credentials and an absolute session expiration.</summary>
public sealed record StoredSession(TokenSet Tokens, DateTimeOffset ExpiresAt, bool Demo);
