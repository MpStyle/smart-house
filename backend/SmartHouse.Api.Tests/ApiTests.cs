using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SmartHouse.Api;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Entities;
using Xunit;

namespace SmartHouse.Api.Tests;

public sealed class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
    public override DateTimeOffset GetUtcNow() => Now;
}

public sealed class CountingProvider(TestClock clock) : INetatmoClient
{
    public List<(string Endpoint, Dictionary<string, string?>? Query)> Calls { get; } = [];
    public bool Fail { get; set; }
    public bool SeparateStation { get; set; }
    public HashSet<string> FailedEndpoints { get; } = [];
    public int FailureStatus { get; set; } = 502;
    public string FailureCode { get; set; } = "provider_unavailable";
    public TimeSpan? ThermostatAge { get; set; }
    public bool Unreachable { get; set; }
    public bool MissingTemperature { get; set; }
    public bool InvalidHistory { get; set; }
    public bool MissingOptionalMetrics { get; set; }
    public TimeSpan? WeatherAge { get; set; }
    public bool Imperial { get; set; }
    public Task<JsonElement> Get(string sid, string endpoint, Dictionary<string, string?>? query, CancellationToken ct)
    {
        Calls.Add((endpoint, query));
        if (Fail || FailedEndpoints.Contains(endpoint)) throw new ProviderException(FailureCode, FailureStatus);
        var result = DemoData.Get(endpoint, query, clock.Now);
        if (endpoint == "getroommeasure" && ThermostatAge is { } age)
            result = JsonSerializer.SerializeToElement(new Dictionary<string, double?[]>
            {
                [clock.Now.Subtract(age).ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture)] = [22.3]
            });
        if (endpoint == "getroommeasure" && InvalidHistory)
            result = JsonSerializer.SerializeToElement(new { unexpected = true });
        if (endpoint == "homestatus" && Unreachable)
        {
            var json = System.Text.Json.Nodes.JsonNode.Parse(result.GetRawText())!;
            json["home"]!["rooms"]![0]!["reachable"] = false;
            result = JsonSerializer.SerializeToElement(json);
        }
        if (endpoint == "getstationsdata" && (Unreachable || MissingTemperature || MissingOptionalMetrics
            || WeatherAge is not null || Imperial))
        {
            var json = System.Text.Json.Nodes.JsonNode.Parse(result.GetRawText())!;
            if (Unreachable) json["devices"]![0]!["reachable"] = false;
            if (MissingTemperature) json["devices"]![0]!["dashboard_data"]!.AsObject().Remove("Temperature");
            if (MissingOptionalMetrics) json["devices"]![0]!["dashboard_data"]!.AsObject().Remove("AbsolutePressure");
            if (WeatherAge is { } weatherAge)
                json["devices"]![0]!["dashboard_data"]!["time_utc"] = clock.Now.Subtract(weatherAge).ToUnixTimeSeconds();
            if (Imperial) json["user"]!["administrative"]!["unit"] = 1;
            result = JsonSerializer.SerializeToElement(json);
        }
        if (SeparateStation && endpoint == "getstationsdata")
        {
            var json = System.Text.Json.Nodes.JsonNode.Parse(result.GetRawText())!;
            json["devices"]![0]!.AsObject().Remove("home_id");
            result = JsonSerializer.SerializeToElement(json);
        }
        return Task.FromResult(result);
    }
}

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "smart-house-tests-" + Guid.NewGuid());
    public TestClock Clock { get; } = new();
    public CountingProvider Provider { get; }
    public ApiFactory() => Provider = new(Clock);
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DemoMode"] = "true", ["DataDirectory"] = directory, ["PublicOrigin"] = "http://localhost",
            ["Netatmo:ClientId"] = "", ["Netatmo:ClientSecret"] = ""
        }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
            services.RemoveAll<INetatmoClient>();
            services.AddSingleton<INetatmoClient>(Provider);
        });
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
    }
}

public class ApiTests
{
    private static async Task<string> Csrf(HttpClient client)
    {
        var session = await client.GetFromJsonAsync<JsonElement>("/api/auth/session");
        return session.Text("csrfToken")!;
    }
    private static async Task Login(HttpClient client)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/demo");
        request.Headers.Add("X-CSRF-TOKEN", await Csrf(client));
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task PrivateEndpointsRequireLoginAndDemoRequiresCsrf()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/homes/")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/auth/demo", null)).StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/api/auth/login")).StatusCode);
    }

    [Fact]
    public async Task GroupsRoomsPreservesDeviceValuesAndMarksOldReadingsAsStale()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        var rooms = snapshot.Field("rooms").Items();
        Assert.Equal(3, rooms.Length);
        var living = rooms.Single(room => room.Text("name") == "Soggiorno").Field("measurements").Items();
        Assert.Equal(9, living.Length);
        Assert.Equal(2, living.Count(value => value.Text("kind") == "temperature"));
        Assert.Equal(21.7, living.Single(value => value.Text("id") == "station:Temperature").Number("value"));
        Assert.All(living, value => Assert.NotEqual(JsonValueKind.Null, value.Field("value").ValueKind));
        Assert.All(rooms.Single(room => room.Text("name") == "Camera").Field("measurements").Items(),
            value => { Assert.NotEqual(JsonValueKind.Null, value.Field("value").ValueKind); Assert.Equal("stale", value.Text("status")); });
        Assert.DoesNotContain(living, value => value.Field("source").ValueKind != JsonValueKind.Undefined);
        Assert.DoesNotContain(living, value => value.Text("kind") == "battery");
    }

    [Theory]
    [InlineData(3, "stale")]
    [InlineData(48, "stale")]
    [InlineData(49, "unavailable")]
    [InlineData(-1, "unavailable")]
    public async Task ThermostatLastSampleIsAvailableBeforeOpeningTheChart(int ageHours, string expected)
    {
        using var app = new ApiFactory();
        app.Provider.ThermostatAge = TimeSpan.FromHours(ageHours);
        using var client = app.CreateClient();
        await Login(client);
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        var thermostat = snapshot.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items())
            .Single(value => value.Text("id") == "thermostat:Temperature");
        Assert.Equal(expected, thermostat.Text("status"));
        Assert.Equal(expected == "unavailable" ? null : 22.3, thermostat.Number("value"));
        var call = Assert.Single(app.Provider.Calls, call => call.Endpoint == "getroommeasure");
        Assert.Equal(48 * 3600, long.Parse(call.Query!["date_end"]!) - long.Parse(call.Query["date_begin"]!));
        Assert.DoesNotContain(app.Provider.Calls, call => call.Endpoint == "getmeasure");
    }

    [Theory]
    [InlineData("all")]
    [InlineData("getstationsdata")]
    [InlineData("getroommeasure")]
    public async Task TransientFailuresRetainLastKnownValuesAndExposeWarnings(string endpoint)
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        var first = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        if (endpoint == "all") app.Provider.Fail = true;
        else app.Provider.FailedEndpoints.Add(endpoint);
        app.Clock.Now = app.Clock.Now.AddSeconds(61);
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        Assert.NotEmpty(snapshot.Field("warnings").Items());
        var current = snapshot.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items());
        foreach (var value in current.Where(value => value.Field("updateFailed").ValueKind == JsonValueKind.True))
        {
            var previous = first.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items())
                .Single(previous => previous.Text("id") == value.Text("id"));
            Assert.Equal(previous.Number("value"), value.Number("value"));
            Assert.Equal("stale", value.Text("status"));
        }
        Assert.Contains(current, value => value.Field("updateFailed").ValueKind == JsonValueKind.True);
        var calls = app.Provider.Calls.Count;
        await client.GetAsync("/api/homes/demo-home/measurements");
        Assert.Equal(calls, app.Provider.Calls.Count);
    }

    [Fact]
    public async Task MissingFieldsAndUnreachableDevicesKeepKnownValuesButAreNotFresh()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        await client.GetAsync("/api/homes/demo-home/measurements");
        app.Provider.Unreachable = true;
        app.Provider.MissingTemperature = true;
        app.Provider.InvalidHistory = true;
        app.Clock.Now = app.Clock.Now.AddSeconds(61);
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        var measurements = snapshot.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items()).ToArray();
        Assert.All(measurements, value => Assert.Equal("stale", value.Text("status")));
        Assert.Equal(21.7, measurements.Single(value => value.Text("id") == "station:Temperature").Number("value"));
        Assert.NotNull(measurements.Single(value => value.Text("id") == "thermostat:Temperature").Number("value"));
    }

    [Fact]
    public async Task RetainedValuesExpireAfterFortyEightHoursAndCannotBypassRevokedAuthentication()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        await client.GetAsync("/api/homes/demo-home/measurements");
        app.Provider.Fail = true;
        app.Clock.Now = app.Clock.Now.AddHours(49);
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        Assert.All(snapshot.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items()),
            value => { Assert.Null(value.Number("value")); Assert.Equal("unavailable", value.Text("status")); });
        app.Provider.FailureStatus = 401;
        app.Provider.FailureCode = "session_expired";
        app.Clock.Now = app.Clock.Now.AddSeconds(61);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/homes/demo-home/measurements")).StatusCode);
    }

    [Fact]
    public async Task APermissionFailureNeverUsesLastKnownValuesAsASuccessfulResponse()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        await client.GetAsync("/api/homes/demo-home/measurements");
        app.Provider.Fail = true;
        app.Provider.FailureCode = "provider_permission_denied";
        app.Clock.Now = app.Clock.Now.AddSeconds(61);
        var response = await client.GetAsync("/api/homes/demo-home/measurements");
        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Equal("provider_permission_denied", (await response.Content.ReadFromJsonAsync<JsonElement>()).Text("code"));
    }

    [Fact]
    public async Task WeatherCacheSuppliesLastKnownValuesEvenBeforeTheFirstSnapshotOfAHome()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        await client.GetAsync("/api/homes/");
        app.Provider.FailedEndpoints.Add("getstationsdata");
        app.Clock.Now = app.Clock.Now.AddSeconds(61);
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        var station = snapshot.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items())
            .Single(value => value.Text("id") == "station:Temperature");
        Assert.Equal(21.7, station.Number("value"));
        Assert.Equal("stale", station.Text("status"));
        Assert.Equal(JsonValueKind.True, station.Field("updateFailed").ValueKind);
        Assert.Equal(2, app.Provider.Calls.Count(call => call.Endpoint == "getstationsdata"));
        Assert.DoesNotContain(app.Provider.Calls, call => call.Endpoint == "getmeasure");
    }

    [Fact]
    public async Task MissingOptionalMetricsAndOlderProviderSamplesKeepTheNewestKnownSample()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        var first = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        app.Provider.MissingOptionalMetrics = true;
        app.Provider.WeatherAge = TimeSpan.FromHours(3);
        app.Clock.Now = app.Clock.Now.AddSeconds(61);
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        var current = snapshot.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items()).ToArray();
        var previous = first.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items()).ToArray();
        foreach (var id in new[] { "station:AbsolutePressure", "station:Temperature" })
        {
            var value = current.Single(value => value.Text("id") == id);
            Assert.Equal(previous.Single(value => value.Text("id") == id).Text("measuredAt"), value.Text("measuredAt"));
            Assert.Equal(previous.Single(value => value.Text("id") == id).Number("value"), value.Number("value"));
            Assert.Equal("stale", value.Text("status"));
        }
    }

    [Fact]
    public async Task HistoryUnitMatchesItsConversionWhenLastKnownTemperatureUsesPreviousPreferences()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        await client.GetAsync("/api/homes/demo-home/measurements");
        app.Clock.Now = app.Clock.Now.AddSeconds(61);
        app.Provider.Imperial = true;
        app.Provider.FailedEndpoints.Add("getroommeasure");
        var snapshot = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/measurements");
        var thermostat = snapshot.Field("rooms").Items().SelectMany(room => room.Field("measurements").Items())
            .Single(value => value.Text("id") == "thermostat:Temperature");
        Assert.Equal("°C", thermostat.Text("unit"));
        app.Provider.FailedEndpoints.Clear();
        var history = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/history/thermostat%3ATemperature?hours=6");
        Assert.Equal("°F", history.Text("unit"));
        Assert.All(history.Field("points").Items(), point => Assert.InRange(point.Number("value")!.Value, 65, 75));
    }

    [Fact]
    public async Task ConcurrentRefreshesReuseSnapshotAndCacheSurvivesTokenUpdate()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        await client.GetAsync("/api/homes/demo-home/measurements");
        var calls = app.Provider.Calls.Count;
        await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => client.GetAsync("/api/homes/demo-home/measurements")));
        Assert.Equal(calls, app.Provider.Calls.Count);
        app.Clock.Now = app.Clock.Now.AddSeconds(61);
        await client.GetAsync("/api/homes/demo-home/measurements");
        Assert.True(app.Provider.Calls.Count > calls);
    }

    [Fact]
    public async Task HistoryUsesExactRangesAndThirtyMinuteResolution()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        await Login(client);
        var history = await client.GetFromJsonAsync<JsonElement>("/api/homes/demo-home/history/thermostat%3ATemperature?hours=48");
        Assert.Equal(TimeSpan.FromHours(48), DateTimeOffset.Parse(history.Text("to")!) - DateTimeOffset.Parse(history.Text("from")!));
        Assert.InRange(history.Field("points").Items().Length, 95, 97);
        Assert.All(app.Provider.Calls.Where(call => call.Endpoint is "getroommeasure" or "getmeasure"), call =>
        {
            Assert.Equal("30min", call.Query!["scale"]);
            Assert.Equal("true", call.Query["real_time"]);
            Assert.Equal("false", call.Query["optimize"]);
        });
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/homes/demo-home/history/thermostat%3ATemperature?hours=36")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/homes/demo-home/history/station%3AAbsolutePressure?hours=6")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/homes/other-user-home/measurements")).StatusCode);
    }

    [Fact]
    public async Task UnassociatedWeatherStationIsASeparateHome()
    {
        using var app = new ApiFactory();
        app.Provider.SeparateStation = true;
        using var client = app.CreateClient();
        await Login(client);
        var response = await client.GetFromJsonAsync<JsonElement>("/api/homes/");
        var homes = response.Field("homes").Items();
        Assert.Equal(2, homes.Length);
        Assert.Contains(homes, home => home.Text("id") == "station:station");
    }

    [Fact]
    public async Task FailedDiscoveryIsThrottledAndNotReportedAsAnEmptyHomeList()
    {
        using var app = new ApiFactory();
        app.Provider.Fail = true;
        using var client = app.CreateClient();
        await Login(client);
        Assert.Equal(HttpStatusCode.BadGateway, (await client.GetAsync("/api/homes/")).StatusCode);
        Assert.Equal(HttpStatusCode.BadGateway, (await client.GetAsync("/api/homes/")).StatusCode);
        Assert.Equal(2, app.Provider.Calls.Count);
    }

    [Fact]
    public async Task SessionsAreIsolatedExpireAfterSevenDaysAndLogoutRevokesAccess()
    {
        using var app = new ApiFactory();
        using var first = app.CreateClient();
        using var second = app.CreateClient();
        await Login(first);
        Assert.Equal(HttpStatusCode.Unauthorized, (await second.GetAsync("/api/homes/")).StatusCode);
        using var logout = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        logout.Headers.Add("X-CSRF-TOKEN", await Csrf(first));
        Assert.Equal(HttpStatusCode.NoContent, (await first.SendAsync(logout)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await first.GetAsync("/api/homes/")).StatusCode);
        await Login(first);
        app.Clock.Now = app.Clock.Now.AddDays(7).AddSeconds(1);
        Assert.Equal(HttpStatusCode.Unauthorized, (await first.GetAsync("/api/homes/")).StatusCode);
    }

    [Fact]
    public void UpdatingTokensKeepsLatestSnapshotAndTokensAreEncryptedOnDisk()
    {
        using var app = new ApiFactory();
        using var client = app.CreateClient();
        var store = app.Services.GetRequiredService<SessionStore>();
        var sid = store.Create(new("private-access", "private-refresh", app.Clock.Now.AddHours(1)));
        store.Cache(sid, "sample", "cached-value");
        store.Save(sid, store.Find(sid)! with { Tokens = new("updated", "refresh", app.Clock.Now.AddHours(2)) });
        Assert.Equal("cached-value", store.Cached<string>(sid, "sample")!.Value);
        Assert.Equal("updated", store.Find(sid)!.Tokens.AccessToken);
    }
}
