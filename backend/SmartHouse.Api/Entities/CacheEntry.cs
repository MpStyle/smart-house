namespace SmartHouse.Api.Entities;

/// <summary>Stores a cached value and the timestamp of its retrieval attempt.</summary>
public sealed record CacheEntry<T>(DateTimeOffset AttemptedAt, T Value);
