using Microsoft.Data.Sqlite;

namespace SmartHouse.Api.Repositories;

public sealed class SessionRepository
{
    private readonly string connectionString;

    /// <summary>Opens persistent session storage and creates its schema when needed.</summary>
    public SessionRepository(IConfiguration config)
    {
        var directory = Path.GetFullPath(config["DataDirectory"] ?? ".local");
        Directory.CreateDirectory(directory);
        connectionString = new SqliteConnectionStringBuilder { DataSource = Path.Combine(directory, "sessions.db") }.ToString();
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

    /// <summary>Inserts an encrypted session payload with its absolute expiration.</summary>
    public void Create(string id, long expires, string payload)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO sessions (id,expires,payload) VALUES ($id,$expires,$payload)";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$expires", expires);
        command.Parameters.AddWithValue("$payload", payload);
        command.ExecuteNonQuery();
    }

    /// <summary>Updates an existing unexpired session and reports whether it still exists.</summary>
    public bool Save(string id, long expires, string payload, long now)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE sessions SET expires=$expires,payload=$payload WHERE id=$id AND expires>$now";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$expires", expires);
        command.Parameters.AddWithValue("$payload", payload);
        command.Parameters.AddWithValue("$now", now);

        return command.ExecuteNonQuery() == 1;
    }

    /// <summary>Reads an encrypted payload only if the session has not expired.</summary>
    public string? Find(string id, long now)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT payload FROM sessions WHERE id=$id AND expires>$now";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$now", now);

        return command.ExecuteScalar() as string;
    }

    /// <summary>Reads an encrypted cached payload by session and cache key.</summary>
    public string? Cached(string id, string key)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT payload FROM cache WHERE session_id=$id AND cache_key=$key";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$key", key);

        return command.ExecuteScalar() as string;
    }

    /// <summary>Upserts a cached payload only for an existing unexpired session.</summary>
    public bool Cache(string id, string key, string payload, long now)
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
        command.Parameters.AddWithValue("$payload", payload);
        command.Parameters.AddWithValue("$now", now);

        return command.ExecuteNonQuery() == 1;
    }

    /// <summary>Deletes a session and its cache through the foreign-key cascade.</summary>
    public void Delete(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM sessions WHERE id=$id";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    /// <summary>Deletes all sessions expired at the supplied Unix timestamp.</summary>
    public void Cleanup(long now)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM sessions WHERE expires <= $now";
        command.Parameters.AddWithValue("$now", now);
        command.ExecuteNonQuery();
    }
}
