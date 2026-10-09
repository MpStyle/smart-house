using System.Text.Json;

namespace SmartHouse.Api;

public static class DemoData
{
    public static JsonElement Get(string endpoint, Dictionary<string, string?>? query, DateTimeOffset now)
    {
        var timestamp = now.AddMinutes(-5).ToUnixTimeSeconds();
        object data = endpoint switch
        {
            "homesdata" => new
            {
                homes = new[] { new
                {
                    id = "demo-home", name = "Casa Netatmo", timezone = "Europe/Rome",
                    rooms = new[] { new { id = "room-living", name = "Soggiorno", module_ids = new[] { "thermostat" } } },
                    modules = new[] { new { id = "thermostat", type = "NATherm1", name = "Termostato", room_id = "room-living" } }
                } },
                user = new { unit_system = 0, unit_pressure = 0, unit_wind = 0 }
            },
            "homestatus" => new { home = new { rooms = new[] { new { id = "room-living", reachable = true, therm_measured_temperature = 21.4 } } } },
            "getstationsdata" => new
            {
                devices = new[] { new
                {
                    _id = "station", home_id = "demo-home", home_name = "Casa Netatmo", module_name = "Soggiorno",
                    place = new { timezone = "Europe/Rome" }, reachable = true,
                    data_type = new[] { "Temperature", "Humidity", "CO2", "Noise", "Pressure" },
                    dashboard_data = new { time_utc = timestamp, Temperature = 21.7, Humidity = 48, CO2 = 684, Noise = 38,
                        Pressure = 1016.2, AbsolutePressure = 1008.4, min_temp = 20.1, max_temp = 22.3 },
                    modules = new object[]
                    {
                        new { _id = "outdoor", module_name = "Giardino", type = "NAModule1", reachable = true,
                            data_type = new[] { "Temperature", "Humidity" },
                            dashboard_data = new { time_utc = timestamp, Temperature = 17.8, Humidity = 62 } },
                        new { _id = "bedroom", module_name = "Camera", type = "NAModule4", reachable = true,
                            data_type = new[] { "Temperature", "Humidity", "CO2" },
                            dashboard_data = new { time_utc = now.AddMinutes(-40).ToUnixTimeSeconds(), Temperature = 20.2, Humidity = 52, CO2 = 710 } },
                        new { _id = "rain", module_name = "Giardino", type = "NAModule3", reachable = true,
                            data_type = new[] { "Rain" },
                            dashboard_data = new { time_utc = timestamp, Rain = 0.1, sum_rain_1 = 0.8, sum_rain_24 = 3.4 } },
                        new { _id = "wind", module_name = "Giardino", type = "NAModule2", reachable = true,
                            data_type = new[] { "Wind" },
                            dashboard_data = new { time_utc = timestamp, WindStrength = 12.4, WindAngle = 245, GustStrength = 19.8, GustAngle = 250 } }
                    }
                } },
                user = new { administrative = new { unit = 0, windunit = 0, pressureunit = 0 } }
            },
            "getroommeasure" or "getmeasure" => History(query, now),
            _ => throw new ProviderException("demo_endpoint_not_supported")
        };
        return JsonSerializer.SerializeToElement(data);
    }

    private static Dictionary<string, double?[]> History(Dictionary<string, string?>? query, DateTimeOffset now)
    {
        var from = long.Parse(query!["date_begin"]!, System.Globalization.CultureInfo.InvariantCulture);
        var to = long.Parse(query["date_end"]!, System.Globalization.CultureInfo.InvariantCulture);
        var kind = query["type"];
        var baseline = kind switch { "co2" => 700d, "humidity" => 50, "pressure" => 1016, "noise" => 38, "sum_rain" => 0.2,
            "windstrength" => 12, "guststrength" => 18, "windangle" or "gustangle" => 245, _ => 21 };
        var result = new Dictionary<string, double?[]>();
        var last = Math.Min(to, now.AddMinutes(-5).ToUnixTimeSeconds());
        var first = from + (last - from) % 1800;
        for (var time = first; time <= last; time += 1800)
            result[time.ToString(System.Globalization.CultureInfo.InvariantCulture)] = [baseline + Math.Sin(time / 7200d) * baseline * 0.04];
        return result;
    }
}
