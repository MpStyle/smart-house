namespace SmartHouse.Api.Entities;

public sealed record CacheEntry<T>(DateTimeOffset AttemptedAt, T Value);
