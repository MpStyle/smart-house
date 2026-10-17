using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using SmartHouse.Api.Entities;
using SmartHouse.Api.Repositories;

namespace SmartHouse.Api.BusinessModels;

/// <summary>Protects persistent session data and coordinates concurrent session operations.</summary>
public sealed class SessionStore(SessionRepository repository, IDataProtectionProvider protection,
    TimeProvider clock, ILogger<SessionStore> logger)
{
    private readonly IDataProtector protector = protection.CreateProtector("SmartHouse.ServerSessions.v1");
    private readonly Dictionary<string, SemaphoreSlim[]> gates = new[] { "tokens", "discovery", "snapshot", "history" }
        .ToDictionary(name => name, _ => Enumerable.Range(0, 64).Select(_ => new SemaphoreSlim(1, 1)).ToArray());

    /// <summary>Serializes operations sharing a bounded, hashed session lock.</summary>
    public async Task<T> Locked<T>(string id, Func<Task<T>> operation)
    {
        var hash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(id));
        var group = gates[id.Split(':', 2)[0]];
        var gate = group[hash[0] % group.Length];
        await gate.WaitAsync();
        try
        {

            return await operation();
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>Creates an encrypted server-side session with an absolute seven-day lifetime.</summary>
    public string Create(TokenSet tokens, bool demo = false)
    {
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var session = new StoredSession(tokens, clock.GetUtcNow().AddDays(7), demo);
        repository.Create(id, session.ExpiresAt.ToUnixTimeSeconds(), Protect(session));

        return id;
    }

    /// <summary>Updates an active session without recreating a revoked or expired session.</summary>
    public void Save(string id, StoredSession session)
    {
        if (!repository.Save(id, session.ExpiresAt.ToUnixTimeSeconds(), Protect(session), clock.GetUtcNow().ToUnixTimeSeconds()))
        {
            throw new ProviderException("session_expired", 401);
        }
    }

    /// <summary>Decrypts an active session, or returns null if it has expired or does not exist.</summary>
    public StoredSession? Find(string id) =>
        Read<StoredSession>(repository.Find(id, clock.GetUtcNow().ToUnixTimeSeconds()));

    private string Protect<T>(T value) => protector.Protect(JsonSerializer.Serialize(value, Json.Options));

    private T? Read<T>(string? payload)
    {
        if (payload is null)
        {

            return default;
        }

        try
        {

            return JsonSerializer.Deserialize<T>(protector.Unprotect(payload), Json.Options);
        }
        catch (CryptographicException exception)
        {
            logger.LogError(exception, "Session data cannot be decrypted; verify the persistent data protection keys.");
            throw new ProviderException("session_store_unavailable", 503);
        }
    }

    /// <summary>Reads and decrypts a cached value belonging to a session.</summary>
    public CacheEntry<T>? Cached<T>(string id, string key) => Read<CacheEntry<T>>(repository.Cached(id, key));

    /// <summary>Encrypts and timestamps a cached value only while its session remains active.</summary>
    public void Cache<T>(string id, string key, T value)
    {
        var now = clock.GetUtcNow();
        if (!repository.Cache(id, key, Protect(new CacheEntry<T>(now, value)), now.ToUnixTimeSeconds()))
        {
            throw new ProviderException("session_expired", 401);
        }
    }

    /// <summary>Revokes a session and deletes its cached values.</summary>
    public void Delete(string id) => repository.Delete(id);
    /// <summary>Deletes expired sessions and their cached values.</summary>
    public void Cleanup() => repository.Cleanup(clock.GetUtcNow().ToUnixTimeSeconds());
}
