using System.Net;
using System.Text.Json;
using SmartHouse.Sdk;
using Xunit;

namespace SmartHouse.Api.Tests;

public class ContractTests
{
    /// <summary>Verifies that the versioned generated client supports session, data, history, and logout.</summary>
    [Fact]
    public async Task GeneratedClientUsesTheVersionedContract()
    {
        using var app = new ApiFactory();
        using var http = app.CreateClient();
        var sdk = new SmartHouseClient(http);
        Assert.Equal("ok", (await sdk.HealthAsync()).Status);
        var anonymous = await sdk.SessionAsync();
        Assert.False(anonymous.Authenticated);
        await Assert.ThrowsAsync<ApiException>(() => sdk.HomesAsync());
        await sdk.DemoAsync(anonymous.CsrfToken);
        var session = await sdk.SessionAsync();
        Assert.True(session.Authenticated);
        var home = Assert.Single((await sdk.HomesAsync()).Homes);
        var snapshot = await sdk.SnapshotAsync(home.Id);
        var measurement = snapshot.Rooms.SelectMany(room => room.Measurements).First(item => item.HasHistory);
        Assert.Contains(measurement.Status, Enum.GetValues<MeasurementStatus>());
        var history = await sdk.HistoryAsync(home.Id, measurement.Id, 6);
        Assert.Equal(measurement.Id, history.MeasurementId);
        Assert.NotEmpty(history.Points);
        await sdk.LogoutAsync(session.CsrfToken);
        Assert.False((await sdk.SessionAsync()).Authenticated);
    }

    /// <summary>Verifies removal of unversioned routes and rejection of disabled demo mode.</summary>
    [Fact]
    public async Task OldRoutesAreNotAliasesAndDemoMustBeEnabled()
    {
        using var app = new ApiFactory { DemoEnabled = false };
        using var http = app.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await http.PostAsync("/api/v1/auth/demo", null)).StatusCode);
        foreach (var path in new[] { "/api/health", "/api/auth/session", "/api/auth/login", "/api/homes" })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync(path)).StatusCode);
        }
        var session = await new SmartHouseClient(http).SessionAsync();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/demo");
        request.Headers.Add("X-CSRF-TOKEN", session.CsrfToken);
        Assert.Equal(HttpStatusCode.NotFound, (await http.SendAsync(request)).StatusCode);
    }

    /// <summary>Verifies complete operation identifiers and precise nullable numeric response schemas.</summary>
    [Fact]
    public void OpenApiDescribesAllClientOperationsWithoutLeakingInternalModels()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "openapi.json")));
        var root = document.RootElement;
        var paths = root.GetProperty("paths");
        Assert.Equal(8, paths.EnumerateObject().Count());
        Assert.All(paths.EnumerateObject(), path =>
        {
            Assert.StartsWith("/api/v1/", path.Name);
            Assert.All(path.Value.EnumerateObject(), operation =>
                Assert.False(string.IsNullOrWhiteSpace(operation.Value.GetProperty("operationId").GetString())));
        });
        var schemas = root.GetProperty("components").GetProperty("schemas");
        Assert.False(schemas.TryGetProperty("TokenSet", out _));
        Assert.False(schemas.TryGetProperty("HistorySource", out _));
        var measurement = schemas.GetProperty("MeasurementResponse").GetProperty("properties");
        Assert.Equal("number", measurement.GetProperty("value").GetProperty("type").GetString());
        Assert.True(measurement.GetProperty("value").GetProperty("nullable").GetBoolean());
        Assert.Equal("integer", measurement.GetProperty("sampleMinutes").GetProperty("type").GetString());
        var header = paths.GetProperty("/api/v1/auth/logout").GetProperty("post").GetProperty("parameters")[0];
        Assert.Equal("X-CSRF-TOKEN", header.GetProperty("name").GetString());
        Assert.True(header.GetProperty("required").GetBoolean());
    }
}
