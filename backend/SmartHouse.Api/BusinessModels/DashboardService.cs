using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.BusinessModels;

public sealed class DashboardService(INetatmoClient client, SessionStore store, TimeProvider clock,
    IMemoryCache memory, ILogger<DashboardService> logger)
{
    public Task<Discovery> Discover(string sid, CancellationToken ct) => store.Locked("discovery:" + sid, async () =>
    {
        var cached = store.Cached<Discovery>(sid, "discovery");
        if (cached is not null && clock.GetUtcNow() - cached.AttemptedAt < TimeSpan.FromMinutes(1)) return cached.Value;
        var failure = store.Cached<string>(sid, "discoveryError");
        if (failure is not null && clock.GetUtcNow() - failure.AttemptedAt < TimeSpan.FromMinutes(1))
            throw new ProviderException(failure.Value);
        var warnings = new List<string>();
        var energy = await Optional(sid, "homesdata", null, warnings, ct);
        var weatherWarnings = new List<string>();
        var weather = await Optional(sid, "getstationsdata", new() { ["get_favorites"] = "false" }, weatherWarnings, ct);
        warnings.AddRange(weatherWarnings);
        if (weather is null) store.Cache(sid, "weatherError", weatherWarnings.FirstOrDefault() ?? "provider_unavailable");
        if (energy is null && weather is null)
        {
            if (cached is not null)
            {
                var previous = cached.Value with { Warnings = warnings.Distinct().ToArray() };
                store.Cache(sid, "discovery", previous);
                return previous;
            }
            store.Cache(sid, "discoveryError", "provider_unavailable");
            throw new ProviderException("provider_unavailable");
        }
        var homes = (energy?.Field("homes").Items() ?? []).Select(home => new Home(
            home.Text("id") ?? throw new ProviderException("invalid_provider_response"),
            home.Text("name") ?? "Netatmo", Zone(home.Text("timezone")), home.Text("id"), [])).ToList();
        if (energy is null && cached is not null)
            homes.AddRange(cached.Value.Homes.Where(home => home.EnergyId is not null)
                .Select(home => home with { StationIds = [] }));
        foreach (var station in weather?.Field("devices").Items() ?? [])
        {
            var stationId = station.Text("_id") ?? throw new ProviderException("invalid_provider_response");
            var homeId = station.Text("home_id");
            var existing = homes.FindIndex(home => home.Id == homeId);
            if (existing >= 0)
                homes[existing] = homes[existing] with { StationIds = [.. homes[existing].StationIds, stationId] };
            else
            {
                var id = homeId ?? "station:" + stationId;
                var weatherHome = homes.FindIndex(home => home.Id == id);
                if (weatherHome >= 0) homes[weatherHome] = homes[weatherHome] with { StationIds = [.. homes[weatherHome].StationIds, stationId] };
                else homes.Add(new(id, station.Text("home_name") ?? station.Text("station_name") ?? station.Text("module_name") ?? "Netatmo",
                    Zone(station.Field("place").Text("timezone")), null, [stationId]));
            }
        }
        if (weather is null && cached is not null)
            foreach (var previous in cached.Value.Homes.Where(home => home.StationIds.Length > 0))
            {
                var existing = homes.FindIndex(home => home.Id == previous.Id);
                if (existing >= 0) homes[existing] = homes[existing] with { StationIds = previous.StationIds };
                else homes.Add(previous with { EnergyId = null });
            }
        var admin = weather?.Field("user").Field("administrative") ?? default;
        var user = energy?.Field("user") ?? default;
        var units = new Units((int)(admin.Number("unit") ?? user.Number("unit_system") ?? cached?.Value.Units.System ?? 0),
            (int)(admin.Number("windunit") ?? user.Number("unit_wind") ?? cached?.Value.Units.Wind ?? 0),
            (int)(admin.Number("pressureunit") ?? user.Number("unit_pressure") ?? cached?.Value.Units.Pressure ?? 0));
        var accountName = user.Text("email")?.Trim();
        if (string.IsNullOrEmpty(accountName)) accountName = weather?.Field("user").Text("mail")?.Trim();
        if (string.IsNullOrEmpty(accountName)) accountName = cached?.Value.AccountName;
        var result = new Discovery(homes.OrderBy(home => home.Name, StringComparer.OrdinalIgnoreCase).ToArray(), units, warnings.ToArray(), accountName);
        store.Cache(sid, "discovery", result);
        if (energy is not null) store.Cache(sid, "energyTopology", energy.Value);
        if (weather is not null) store.Cache(sid, "weather", weather.Value);
        return result;
    });

    private string Zone(string? timezone)
    {
        if (timezone is not null)
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(timezone).Id; }
            catch (TimeZoneNotFoundException) { logger.LogWarning("Unsupported Netatmo timezone; using UTC."); }
        }
        return "UTC";
    }

    private async Task<JsonElement?> Optional(string sid, string endpoint, Dictionary<string, string?>? query, List<string> warnings, CancellationToken ct)
    {
        try { return await client.Get(sid, endpoint, query, ct); }
        catch (ProviderException exception) when (exception.Status != 401 && exception.Code != "provider_permission_denied")
        {
            warnings.Add(exception.Code);
            logger.LogWarning("Partial Netatmo retrieval failed: {Endpoint}, {Code}.", endpoint, exception.Code);
            return null;
        }
    }

    public async Task<Snapshot> Snapshot(string sid, string homeId, CancellationToken ct)
    {
        var discovery = await Discover(sid, ct);
        var home = discovery.Homes.FirstOrDefault(item => item.Id == homeId) ?? throw new ProviderException("home_not_found", 404);
        return await store.Locked("snapshot:" + sid, async () =>
        {
            var key = "snapshot:" + homeId;
            var cached = store.Cached<Snapshot>(sid, key);
            if (cached is not null && clock.GetUtcNow() - cached.AttemptedAt < TimeSpan.FromMinutes(1))
                return Measurements.LimitToRetention(cached.Value, clock.GetUtcNow());
            var warnings = new List<string>(discovery.Warnings);
            var previous = cached?.Value.Rooms.SelectMany(room => room.Measurements)
                .ToDictionary(measurement => measurement.Id) ?? [];
            var rooms = new Dictionary<string, (string Name, List<Measurement> Measures)>();
            void Add(string roomName, Measurement measurement)
            {
                if (previous.TryGetValue(measurement.Id, out var last)
                    && Measurements.Retained(last, clock.GetUtcNow())
                    && (!Measurements.Retained(measurement, clock.GetUtcNow()) || last.MeasuredAt > measurement.MeasuredAt))
                    measurement = measurement with
                    {
                        Value = last.Value, Unit = last.Unit, MeasuredAt = last.MeasuredAt, UpdateFailed = true
                    };
                if (measurement.UpdateFailed) warnings.Add("measurement_update_failed");
                roomName = roomName.Trim();
                if (roomName.Length == 0) roomName = measurement.DeviceName;
                var roomKey = Measurements.RoomKey(roomName);
                if (!rooms.TryGetValue(roomKey, out var room)) room = (roomName, []);
                room.Measures.Add(measurement);
                rooms[roomKey] = room;
            }
            if (home.StationIds.Length > 0)
            {
                var weather = store.Cached<JsonElement>(sid, "weather");
                var weatherError = store.Cached<string>(sid, "weatherError");
                var failedRecently = weatherError is not null
                    && clock.GetUtcNow() - weatherError.AttemptedAt < TimeSpan.FromMinutes(1)
                    && (weather is null || weatherError.AttemptedAt > weather.AttemptedAt);
                var weatherUpdateFailed = failedRecently;
                JsonElement? data = failedRecently ? weather?.Value
                    : weather is not null && clock.GetUtcNow() - weather.AttemptedAt < TimeSpan.FromMinutes(1)
                    ? weather.Value : await Optional(sid, "getstationsdata", new() { ["get_favorites"] = "false" }, warnings, ct);
                if (data is null && weather is not null)
                {
                    data = weather.Value;
                    weatherUpdateFailed = true;
                }
                if (data is not null)
                {
                    foreach (var station in data.Value.Field("devices").Items().Where(station => home.StationIds.Contains(station.Text("_id"))))
                    {
                        var stationId = station.Text("_id")!;
                        foreach (var module in new[] { station }.Concat(station.Field("modules").Items()))
                        {
                            var moduleId = module.Text("_id") ?? throw new ProviderException("invalid_provider_response");
                            var name = module.Text("module_name") ?? module.Text("type") ?? moduleId;
                            var deviceName = (station.Text("module_name") ?? station.Text("station_name") ?? stationId) + " / " + name;
                            var dataTypes = module.Field("data_type").Items().Select(type => type.Text()).ToArray();
                            var dashboard = module.Field("dashboard_data");
                            foreach (var metric in Measurements.Metrics)
                            {
                                var expected = dataTypes.Contains(metric.Field, StringComparer.OrdinalIgnoreCase)
                                    || (dataTypes.Contains("Wind") && metric.Kind is "wind" or "windAngle" or "gust" or "gustAngle");
                                if (!expected && dashboard.Field(metric.Field).ValueKind == JsonValueKind.Undefined
                                    && !previous.ContainsKey(Measurements.Id(moduleId, metric.Field))) continue;
                                var converted = Measurements.Convert(dashboard.Number(metric.Field), metric.Unit, discovery.Units);
                                Add(name, new(Measurements.Id(moduleId, metric.Field), metric.Kind, deviceName,
                                    converted.Value, converted.Unit, dashboard.Timestamp("time_utc"),
                                    metric.HistoryType is null ? null : new("getmeasure", stationId,
                                        moduleId == stationId ? null : moduleId, null, metric.HistoryType),
                                    weatherUpdateFailed || module.IsFalse("reachable") || station.IsFalse("reachable")
                                        || converted.Value is null || dashboard.Timestamp("time_utc") is null));
                            }
                        }
                    }
                }
                else if (cached is not null)
                    foreach (var room in cached.Value.Rooms)
                        foreach (var measurement in room.Measurements.Where(measurement => measurement.Source?.Endpoint != "getroommeasure"))
                            Add(room.Name, measurement with { UpdateFailed = true });
            }
            if (home.EnergyId is not null)
            {
                var topology = store.Cached<JsonElement>(sid, "energyTopology")?.Value.Field("homes").Items()
                    .FirstOrDefault(item => item.Text("id") == home.EnergyId) ?? default;
                var status = await Optional(sid, "homestatus", new() { ["home_id"] = home.EnergyId }, warnings, ct);
                foreach (var room in topology.Field("rooms").Items())
                {
                    var roomId = room.Text("id") ?? throw new ProviderException("invalid_provider_response");
                    var thermostat = topology.Field("modules").Items().FirstOrDefault(module =>
                        module.Text("type") == "NATherm1" && (module.Text("room_id") == roomId
                        || room.Field("module_ids").Items().Any(id => id.Text() == module.Text("id"))));
                    if (thermostat.ValueKind == JsonValueKind.Undefined) continue;
                    var roomStatus = status?.Field("home").Field("rooms").Items().FirstOrDefault(item => item.Text("id") == roomId) ?? default;
                    var source = new HistorySource("getroommeasure", home.EnergyId, null, roomId, "temperature");
                    var now = clock.GetUtcNow();
                    var latest = await LatestTemperature(sid, source, now, warnings, ct);
                    var converted = Measurements.Convert(latest?.Value, "°C", discovery.Units);
                    Add(room.Text("name") ?? roomId, new(Measurements.Id(thermostat.Text("id")!, "Temperature"), "temperature",
                        thermostat.Text("name") ?? "Netatmo thermostat", converted.Value, converted.Unit, latest?.Time, source,
                        status is null || roomStatus.ValueKind == JsonValueKind.Undefined
                            || roomStatus.IsFalse("reachable") || latest is null));
                }
            }
            var snapshot = new Snapshot(homeId, home.Timezone, clock.GetUtcNow(),
                rooms.Select(pair => new Room(pair.Key, pair.Value.Name, pair.Value.Measures.ToArray())).OrderBy(room => room.Name).ToArray(),
                warnings.Distinct().ToArray());
            store.Cache(sid, key, snapshot);
            return Measurements.LimitToRetention(snapshot, clock.GetUtcNow());
        });
    }

    private async Task<HistoryPoint?> LatestTemperature(string sid, HistorySource source, DateTimeOffset now,
        List<string> warnings, CancellationToken ct)
    {
        var from = now - Measurements.Retention;
        var history = await Optional(sid, source.Endpoint, HistoryQuery(source, from, now), warnings, ct);
        if (history is null) return null;
        try
        {
            return Measurements.ParseHistory(history.Value)
                .LastOrDefault(point => point.Value is not null && point.Time >= from && point.Time <= now);
        }
        catch (ProviderException exception)
        {
            warnings.Add(exception.Code);
            logger.LogWarning("Invalid thermostat history: {Code}.", exception.Code);
            return null;
        }
    }

    public static Dictionary<string, string?> HistoryQuery(HistorySource source, DateTimeOffset from, DateTimeOffset to)
    {
        var query = new Dictionary<string, string?>
        {
            ["scale"] = "30min", ["type"] = source.Type, ["optimize"] = "false", ["real_time"] = "true",
            ["date_begin"] = from.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["date_end"] = to.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture)
        };
        if (source.Endpoint == "getroommeasure") { query["home_id"] = source.DeviceId; query["room_id"] = source.RoomId; }
        else { query["device_id"] = source.DeviceId; if (source.ModuleId is not null) query["module_id"] = source.ModuleId; }
        return query;
    }

    public async Task<History> History(string sid, string homeId, string measurementId, int hours, CancellationToken ct)
    {
        if (hours is not (6 or 12 or 24 or 48)) throw new ProviderException("invalid_range", 400);
        var snapshot = await Snapshot(sid, homeId, ct);
        var measurement = snapshot.Rooms.SelectMany(room => room.Measurements).FirstOrDefault(item => item.Id == measurementId)
            ?? throw new ProviderException("measurement_not_found", 404);
        var source = measurement.Source ?? throw new ProviderException("history_unavailable", 404);
        return await store.Locked("history:" + sid, async () =>
        {
            var key = $"history:{homeId}:{measurementId}:{hours}";
            var memoryKey = sid + ":" + key;
            var cached = memory.Get<CacheEntry<History>>(memoryKey);
            if (cached is not null && clock.GetUtcNow() - cached.AttemptedAt < TimeSpan.FromMinutes(1)) return cached.Value;
            var discovery = await Discover(sid, ct);
            var to = clock.GetUtcNow();
            var from = to.AddHours(-hours);
            var data = await client.Get(sid, source.Endpoint, HistoryQuery(source, from, to), ct);
            var metric = Measurements.Metrics.First(item => item.Kind == measurement.Kind);
            var unit = Measurements.Convert(null, metric.Unit, discovery.Units).Unit;
            var values = Measurements.ParseHistory(data).Where(point => point.Time >= from && point.Time <= to)
                .Select(point => point with { Value = Measurements.Convert(point.Value, metric.Unit, discovery.Units).Value }).ToArray();
            var result = new History(measurementId, unit, from, to, values);
            memory.Set(memoryKey, new CacheEntry<History>(clock.GetUtcNow(), result), TimeSpan.FromMinutes(1));
            return result;
        });
    }
}
