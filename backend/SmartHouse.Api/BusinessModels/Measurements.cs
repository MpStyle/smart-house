using System.Text.Json;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.BusinessModels;

public static class Measurements
{
    public static readonly TimeSpan Retention = TimeSpan.FromHours(48);
    public static readonly Metric[] Metrics =
    [
        new("Temperature", "temperature", "temperature", "°C"),
        new("Humidity", "humidity", "humidity", "%"),
        new("CO2", "co2", "co2", "ppm"),
        new("Noise", "noise", "noise", "dB"),
        new("Pressure", "pressure", "pressure", "hPa"),
        new("AbsolutePressure", "absolutePressure", null, "hPa"),
        new("min_temp", "minTemperature", null, "°C"),
        new("max_temp", "maxTemperature", null, "°C"),
        new("Rain", "rain", "sum_rain", "mm"),
        new("sum_rain_1", "rainHour", null, "mm"),
        new("sum_rain_24", "rainDay", null, "mm"),
        new("WindStrength", "wind", "windstrength", "km/h"),
        new("WindAngle", "windAngle", "windangle", "°"),
        new("GustStrength", "gust", "guststrength", "km/h"),
        new("GustAngle", "gustAngle", "gustangle", "°"),
        new("max_wind_str", "maxWind", null, "km/h"),
        new("max_wind_angle", "maxWindAngle", null, "°")
    ];

    public static string RoomKey(string name) => name.Trim().ToUpperInvariant();
    public static string Id(string deviceId, string field) => $"{deviceId}:{field}";
    public static bool Fresh(DateTimeOffset? timestamp, DateTimeOffset now) =>
        timestamp is { } time && time <= now.AddMinutes(5) && now - time <= TimeSpan.FromMinutes(30);

    public static bool Retained(Measurement measurement, DateTimeOffset now) =>
        measurement.Value is { } value && double.IsFinite(value)
        && measurement.MeasuredAt is { } time && time <= now.AddMinutes(5) && now - time <= Retention;

    public static string State(Measurement measurement, DateTimeOffset now) =>
        !Retained(measurement, now) ? "unavailable"
        : measurement.UpdateFailed || !Fresh(measurement.MeasuredAt, now) ? "stale" : "fresh";

    public static (double? Value, string Unit) Convert(double? value, string unit, Units units)
    {
        if (unit == "°C" && units.System == 1) return (value * 9 / 5 + 32, "°F");
        if (unit == "mm" && units.System == 1) return (value / 25.4, "in");
        if (unit == "hPa") return units.Pressure switch
        {
            1 => (value * 0.0295299830714, "inHg"),
            2 => (value * 0.750061683, "mmHg"),
            _ => (value, unit)
        };
        if (unit == "km/h") return units.Wind switch
        {
            1 => (value / 1.609344, "mph"),
            2 => (value / 3.6, "m/s"),
            3 => (value is null ? null : Beaufort(value.Value), "Bft"),
            4 => (value / 1.852, "kn"),
            _ => (value, unit)
        };
        return (value, unit);
    }

    private static int Beaufort(double kph)
    {
        double[] thresholds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
        var index = Array.FindIndex(thresholds, threshold => kph < threshold);
        return index < 0 ? 12 : index;
    }

    public static HistoryPoint[] ParseHistory(JsonElement body)
    {
        var points = new SortedDictionary<long, double?>();
        void Add(long seconds, JsonElement value)
        {
            if (seconds is <= 0 or >= 253402300799) throw new ProviderException("invalid_provider_response");
            if (value.ValueKind == JsonValueKind.Array) value = value.Items().FirstOrDefault();
            if (value.ValueKind == JsonValueKind.Object) value = value.Field("value");
            points[seconds] = value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number)
                ? number : null;
        }
        void Parse(JsonElement element)
        {
            if (element.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in element.Items()) Parse(item);
            }
            else if (element.ValueKind == JsonValueKind.Object && element.Number("beg_time") is { } start)
            {
                var step = element.Number("step_time") ?? 1800;
                var values = element.Field("values");
                if (values.ValueKind == JsonValueKind.Undefined) values = element.Field("value");
                var rows = values.Items();
                for (var i = 0; i < rows.Length; i++) Add((long)(start + i * step), rows[i]);
            }
            else if (element.ValueKind == JsonValueKind.Object && element.Field("home").ValueKind != JsonValueKind.Undefined)
                Parse(element.Field("home"));
            else if (element.ValueKind == JsonValueKind.Object)
            {
                foreach (var entry in element.EnumerateObject())
                {
                    if (!long.TryParse(entry.Name, out var seconds)) throw new ProviderException("invalid_provider_response");
                    Add(seconds, entry.Value);
                }
            }
            else throw new ProviderException("invalid_provider_response");
        }
        Parse(body);
        return points.Select(pair => new HistoryPoint(DateTimeOffset.FromUnixTimeSeconds(pair.Key), pair.Value)).ToArray();
    }

    public static Snapshot LimitToRetention(Snapshot snapshot, DateTimeOffset now) => snapshot with
    {
        Rooms = snapshot.Rooms.Select(room => room with
        {
            Measurements = room.Measurements.Select(measurement => Retained(measurement, now)
                ? measurement : measurement with { Value = null }).ToArray()
        }).ToArray()
    };
}
