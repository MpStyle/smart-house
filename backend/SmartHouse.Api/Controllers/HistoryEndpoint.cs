using System.Security.Claims;
using SmartHouse.Api.BusinessModels;

namespace SmartHouse.Api.Controllers;

public static class HistoryEndpoint
{
    public static void MapHistory(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/{homeId}/history/{measurementId}", async (string homeId, string measurementId, int? hours,
            HttpContext context, DashboardService service, CancellationToken ct) =>
            Results.Ok(await service.History(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, homeId, measurementId, hours ?? 6, ct)));
}
