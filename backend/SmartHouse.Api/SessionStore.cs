using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;
using System.Security.Cryptography;
using System.Text.Json;

namespace SmartHouse.Api;

public sealed class SessionStore
{
    private readonly string connectionString;
    private readonly IDataProtector protector;
    private readonly TimeProvider clock;
    private readonly ILogger<SessionStore> logger;
    private readonly Dictionary<string, SemaphoreSlim[]> gates = new[] { "tokens", "discovery", "snapshot", "history" }
        .ToDictionary(name => name, _ => Enumerable.Range(0, 64).Select(_ => new SemaphoreSlim(1, 1)).ToArray());

    public SessionStore(IConfiguration config, IDataProtectionProvider protection, TimeProvider clock, ILogger<SessionStore> logger)
    {
        this.clock = clock;
        this.logger = logger;
        var directory = Path.GetFullPath(config["DataDirectory"] ?? ".local");
        Directory.CreateDirectory(directory);
        connectionString = new SqliteConnectionStringBuilder { DataSource = Path.Combine(directory, "sessions.db") }.ToString();
        protector = protection.CreateProtector("SmartHouse.ServerSessions.v1");
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode=DELETE;
            CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS cache (session_id TEXT NOT NULL, cache_key TEXT NOT NULL, payload TEXT NOT NULL,
                PRIMARY KEY(session_id, cache_key), FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE);
            """;
        command.ExecuteNonQuery();
    }

    private SqliteConnection Open()
    {
        var db = new SqliteConnection(connectionString);
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;";
        command.ExecuteNonQuery();
        return db;
    }

    public async Task<T> Locked<T>(string id, Func<Task<T>> operation)
    {
        var hash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(id));
        var group = gates[id.Split(':', 2)[0]];
        var gate = group[hash[0] % group.Length];
        await gate.WaitAsync();
        try { return await operation(); }
        finally { gate.Release(); }
    }

    public string Create(TokenSet tokens, bool demo = false)
    {
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        using var db = Open();
        using var command = db.CreateCommand();
        var session = new StoredSession(tokens, clock.GetUtcNow().AddDays(7), demo);
        command.CommandText = "INSERT INTO sessions (id,expires,payload) VALUES ($id,$expires,$payload)";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$expires", session.ExpiresAt.ToUnixTimeSeconds());
        command.Parameters.AddWithValue("$payload", protector.Protect(JsonSerializer.Serialize(session, Json.Options)));
        command.ExecuteNonQuery();
        return id;
    }

    public void Save(string id, StoredSession session)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE sessions SET expires=$expires,payload=$payload WHERE id=$id AND expires>$now";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$expires", session.ExpiresAt.ToUnixTimeSeconds());
        command.Parameters.AddWithValue("$payload", protector.Protect(JsonSerializer.Serialize(session, Json.Options)));
        command.Parameters.AddWithValue("$now", clock.GetUtcNow().ToUnixTimeSeconds());
        if (command.ExecuteNonQuery() != 1) throw new ProviderException("session_expired", 401);
    }

    public StoredSession? Find(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT payload FROM sessions WHERE id=$id AND expires>$now";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$now", clock.GetUtcNow().ToUnixTimeSeconds());
        return Read<StoredSession>(command.ExecuteScalar() as string);
    }

    private T? Read<T>(string? payload)
    {
        if (payload is null) return default;
        try { return JsonSerializer.Deserialize<T>(protector.Unprotect(payload), Json.Options); }
        catch (CryptographicException exception)
        {
            logger.LogError(exception, "Session data cannot be decrypted; verify the persistent data protection keys.");
            throw new ProviderException("session_store_unavailable", 503);
        }
    }

    public CacheEntry<T>? Cached<T>(string id, string key)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT payload FROM cache WHERE session_id=$id AND cache_key=$key";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$key", key);
        return Read<CacheEntry<T>>(command.ExecuteScalar() as string);
    }

    public void Cache<T>(string id, string key, T value)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO cache SELECT $id,$key,$payload
            WHERE EXISTS(SELECT 1 FROM sessions WHERE id=$id AND expires>$now)
            ON CONFLICT(session_id,cache_key) DO UPDATE SET payload=excluded.payload
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$key", key);
        command.Parameters.AddWithValue("$payload", protector.Protect(JsonSerializer.Serialize(new CacheEntry<T>(clock.GetUtcNow(), value), Json.Options)));
        command.Parameters.AddWithValue("$now", clock.GetUtcNow().ToUnixTimeSeconds());
        if (command.ExecuteNonQuery() != 1) throw new ProviderException("session_expired", 401);
    }

    public void Delete(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM sessions WHERE id=$id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    public void Cleanup()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM sessions WHERE expires <= $now";
        command.Parameters.AddWithValue("$now", clock.GetUtcNow().ToUnixTimeSeconds());
        command.ExecuteNonQuery();
    }
}

public sealed class SessionCleanup(SessionStore store, ILogger<SessionCleanup> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try { store.Cleanup(); }
            catch (SqliteException exception) { logger.LogError(exception, "Expired session cleanup failed."); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
