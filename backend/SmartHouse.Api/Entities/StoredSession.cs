namespace SmartHouse.Api.Entities;

public sealed record StoredSession(TokenSet Tokens, DateTimeOffset ExpiresAt, bool Demo);
