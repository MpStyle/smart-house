using System.Security.Claims;
using SmartHouse.Api.BusinessModels;

namespace SmartHouse.Api.Controllers;

public static class MeasurementsEndpoint
{
    public static void MapMeasurements(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/{homeId}/measurements", async (string homeId, HttpContext context, DashboardService service,
            TimeProvider clock, CancellationToken ct) =>
        {
            var snapshot = await service.Snapshot(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, homeId, ct);
            var now = clock.GetUtcNow();
            return Results.Ok(new
            {
                snapshot.HomeId, snapshot.Timezone, snapshot.FetchedAt, snapshot.Warnings,
                rooms = snapshot.Rooms.Select(room => new
                {
                    room.Id, room.Name,
                    measurements = room.Measurements.Select(measurement => new
                    {
                        measurement.Id, measurement.Kind, measurement.DeviceName, measurement.Value,
                        measurement.Unit, measurement.MeasuredAt, measurement.HasHistory, measurement.UpdateFailed,
                        status = Measurements.State(measurement, now),
                        sampleMinutes = measurement.Source?.Endpoint == "getroommeasure" ? (int?)30 : null
                    })
                })
            });
        });
}
