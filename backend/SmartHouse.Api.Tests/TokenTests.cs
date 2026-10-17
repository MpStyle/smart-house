using System.Net;
using System.Text;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SmartHouse.Api;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Entities;
using Xunit;

namespace SmartHouse.Api.Tests;

public sealed class ProviderHandler : HttpMessageHandler
{
    public int Refreshes;
    public bool Revoked;
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (request.RequestUri!.AbsolutePath.EndsWith("/oauth2/token", StringComparison.Ordinal))
        {
            Interlocked.Increment(ref Refreshes);

            return Task.FromResult(Response(Revoked ? HttpStatusCode.BadRequest : HttpStatusCode.OK,
                Revoked ? """{"error":"invalid_grant"}""" : """{"access_token":"fresh","refresh_token":"rotated","expires_in":10800}"""));
        }
        Assert.Equal("fresh", request.Headers.Authorization?.Parameter);

        return Task.FromResult(Response(HttpStatusCode.OK, """{"body":{"homes":[]}}"""));
    }
    private static HttpResponseMessage Response(HttpStatusCode status, string json) =>
        new(status)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
}

public class TokenTests
{
    /// <summary>Verifies refresh coalescing, unchanged session expiration, encrypted tokens, and retained cache.</summary>
    [Fact]
    public async Task ConcurrentRequestsRotateTokensOnceWithoutExtendingSessionOrDroppingCache()
    {
        using var app = new ApiFactory();
        using var bootstrap = app.CreateClient();
        var store = app.Services.GetRequiredService<SessionStore>();
        var sid = store.Create(new("expired", "previous", app.Clock.Now.AddMinutes(-1)));
        var expiration = store.Find(sid)!.ExpiresAt;
        store.Cache(sid, "sample", "cache");
        using var handler = new ProviderHandler();
        using var http = new HttpClient(handler);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Netatmo:ClientId"] = "test-client",
            ["Netatmo:ClientSecret"] = "test-only-not-a-secret"
        }).Build();
        var provider = new NetatmoClient(http, store, config, app.Clock, NullLogger<NetatmoClient>.Instance);
        await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => provider.Get(sid, "homesdata", null, CancellationToken.None)));
        Assert.Equal(1, handler.Refreshes);
        Assert.Equal("rotated", store.Find(sid)!.Tokens.RefreshToken);
        Assert.Equal(expiration, store.Find(sid)!.ExpiresAt);
        Assert.Equal("cache", store.Cached<string>(sid, "sample")!.Value);
        using var db = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = Path.Combine(app.Services.GetRequiredService<IConfiguration>()["DataDirectory"]!, "sessions.db")
        }.ToString());
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT payload FROM sessions WHERE id=$id";
        command.Parameters.AddWithValue("$id", sid);
        var payload = (string)command.ExecuteScalar()!;
        Assert.DoesNotContain("fresh", payload);
        Assert.DoesNotContain("rotated", payload);
    }

    /// <summary>Verifies that provider refresh revocation removes the corresponding server session.</summary>
    [Fact]
    public async Task RevokedRefreshTokenDeletesTheServerSession()
    {
        using var app = new ApiFactory();
        using var bootstrap = app.CreateClient();
        var store = app.Services.GetRequiredService<SessionStore>();
        var sid = store.Create(new("expired", "revoked", app.Clock.Now.AddMinutes(-1)));
        using var handler = new ProviderHandler { Revoked = true };
        using var http = new HttpClient(handler);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Netatmo:ClientId"] = "test-client",
            ["Netatmo:ClientSecret"] = "test-only-not-a-secret"
        }).Build();
        var provider = new NetatmoClient(http, store, config, app.Clock, NullLogger<NetatmoClient>.Instance);
        var exception = await Assert.ThrowsAsync<ProviderException>(() => provider.Get(sid, "homesdata", null, CancellationToken.None));
        Assert.Equal(401, exception.Status);
        Assert.Null(store.Find(sid));
    }

    /// <summary>Verifies that an in-flight token update cannot recreate a revoked session or its cache.</summary>
    [Fact]
    public void AnInFlightRefreshCannotResurrectALoggedOutSession()
    {
        using var app = new ApiFactory();
        using var bootstrap = app.CreateClient();
        var store = app.Services.GetRequiredService<SessionStore>();
        var sid = store.Create(new("expired", "previous", app.Clock.Now));
        var session = store.Find(sid)!;
        store.Delete(sid);
        Assert.Equal(401, Assert.Throws<ProviderException>(() => store.Save(sid, session)).Status);
        Assert.Equal(401, Assert.Throws<ProviderException>(() => store.Cache(sid, "sample", "value")).Status);
        Assert.Null(store.Find(sid));
    }
}
