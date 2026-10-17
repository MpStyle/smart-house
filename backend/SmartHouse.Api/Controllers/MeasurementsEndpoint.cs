using System.Security.Claims;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.Controllers;

public static class MeasurementsEndpoint
{
    /// <summary>Maps authorized measurements without exposing provider tokens or internal history sources.</summary>
    public static void MapMeasurements(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/{homeId}/measurements", async (string homeId, HttpContext context, DashboardService service,
            TimeProvider clock, CancellationToken ct) =>
        {
            var snapshot = await service.Snapshot(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, homeId, ct);
            var now = clock.GetUtcNow();

            return TypedResults.Ok(new SnapshotResponse(
                snapshot.HomeId, snapshot.Timezone, snapshot.FetchedAt,
                snapshot.Rooms.Select(room => new RoomResponse(
                    room.Id, room.Name,
                    room.Measurements.Select(measurement => new MeasurementResponse(
                        measurement.Id, measurement.Kind, measurement.DeviceName, measurement.Value,
                        measurement.Unit, measurement.MeasuredAt, measurement.HasHistory, measurement.UpdateFailed,
                        Enum.Parse<MeasurementStatus>(Measurements.State(measurement, now)),
                        measurement.Source?.Endpoint == "getroommeasure" ? 30 : null)).ToArray())).ToArray(),
                snapshot.Warnings));
        }).WithName("Snapshot").Produces(401).Produces<ApiError>(404)
            .Produces<ApiError>(502).Produces<ApiError>(503);
}
