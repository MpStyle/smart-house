using System.Security.Claims;
using SmartHouse.Api.BusinessModels;

namespace SmartHouse.Api.Controllers;

public static class HistoryEndpoint
{
    /// <summary>Maps history retrieval scoped to the authenticated session and measurement.</summary>
    public static void MapHistory(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/{homeId}/history/{measurementId}", async (string homeId, string measurementId, int? hours,
            HttpContext context, DashboardService service, CancellationToken ct) =>
            TypedResults.Ok(await service.History(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, homeId, measurementId, hours ?? 6, ct)))
            .WithName("History").Produces(401)
            .Produces<SmartHouse.Api.Entities.ApiError>(400).Produces<SmartHouse.Api.Entities.ApiError>(404)
            .Produces<SmartHouse.Api.Entities.ApiError>(502).Produces<SmartHouse.Api.Entities.ApiError>(503);
}
