using System.Text.Json;
using SmartHouse.Api;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Entities;
using Xunit;

namespace SmartHouse.Api.Tests;

public class MeasurementTests
{
    [Fact]
    public void FreshnessUsesMeasurementTimeNotFetchTime()
    {
        var now = DateTimeOffset.UtcNow;
        Assert.True(Measurements.Fresh(now.AddMinutes(-30), now));
        Assert.False(Measurements.Fresh(now.AddMinutes(-30).AddSeconds(-1), now));
        Assert.False(Measurements.Fresh(null, now));
        Assert.False(Measurements.Fresh(now.AddMinutes(6), now));
    }

    [Fact]
    public void LastKnownValuesHaveExplicitStateAndAnExactFortyEightHourLimit()
    {
        var now = DateTimeOffset.UtcNow;
        var measurement = new Measurement("id", "temperature", "Device", 21, "°C", now.AddMinutes(-30), null);
        Assert.Equal("fresh", Measurements.State(measurement, now));
        Assert.Equal("stale", Measurements.State(measurement with { MeasuredAt = now.AddMinutes(-30).AddTicks(-1) }, now));
        Assert.Equal("stale", Measurements.State(measurement with { UpdateFailed = true }, now));
        Assert.True(Measurements.Retained(measurement with { MeasuredAt = now.AddHours(-48) }, now));
        Assert.Equal("unavailable", Measurements.State(measurement with { MeasuredAt = now.AddHours(-48).AddTicks(-1) }, now));
        Assert.False(Measurements.Retained(measurement with { MeasuredAt = null }, now));
        Assert.False(Measurements.Retained(measurement with { MeasuredAt = now.AddMinutes(6) }, now));
        Assert.False(Measurements.Retained(measurement with { Value = double.NaN }, now));
        var snapshot = new Snapshot("home", "UTC", now, [new("room", "Room", [measurement])], []);
        Assert.Equal(21, Measurements.LimitToRetention(snapshot, now.AddMinutes(1)).Rooms[0].Measurements[0].Value);
        Assert.Null(Measurements.LimitToRetention(snapshot, now.AddHours(48)).Rooms[0].Measurements[0].Value);
    }

    [Fact]
    public void MetricAndImperialConversionsApplyToBothCurrentAndHistory()
    {
        Assert.Equal((68d, "°F"), Measurements.Convert(20, "°C", new(1)));
        Assert.Equal((1d, "in"), Measurements.Convert(25.4, "mm", new(1)));
        Assert.Equal((10d, "m/s"), Measurements.Convert(36, "km/h", new(Wind: 2)));
        Assert.Equal((12d, "Bft"), Measurements.Convert(120, "km/h", new(Wind: 3)));
        Assert.Equal(29.921, Measurements.Convert(1013.25, "hPa", new(Pressure: 1)).Value!.Value, 3);
        Assert.Null(Measurements.Convert(null, "°C", new(1)).Value);
    }

    [Theory]
    [InlineData("{\"1700000000\":[21],\"1700001800\":[null],\"1700003600\":[22]}")]
    [InlineData("[{\"beg_time\":1700000000,\"step_time\":1800,\"value\":[[21],[null],[22]]}]")]
    [InlineData("{\"home\":{\"beg_time\":1700000000,\"step_time\":1800,\"values\":[{\"value\":21},{\"value\":null},{\"value\":22}]}}")]
    public void ParsesDocumentedHistoryFormatsAndGaps(string payload)
    {
        using var document = JsonDocument.Parse(payload);
        var values = Measurements.ParseHistory(document.RootElement);
        Assert.Equal(3, values.Length);
        Assert.Equal(21, values[0].Value);
        Assert.Null(values[1].Value);
        Assert.Equal(22, values[2].Value);
        Assert.Equal(TimeSpan.FromMinutes(30), values[1].Time - values[0].Time);
    }

    [Fact]
    public void UnexpectedHistoryIsAnErrorNotAnEmptySuccess()
    {
        using var document = JsonDocument.Parse("{\"unexpected\":true}");
        Assert.Throws<ProviderException>(() => Measurements.ParseHistory(document.RootElement));
    }

    [Fact]
    public void RoomNamesMergeOnlyCaseAndEdgeWhitespace()
    {
        Assert.Equal(Measurements.RoomKey(" Soggiorno "), Measurements.RoomKey("soggiorno"));
        Assert.NotEqual(Measurements.RoomKey("Living  Room"), Measurements.RoomKey("Living Room"));
    }
}
