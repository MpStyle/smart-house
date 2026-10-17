using System.Security.Claims;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.Controllers;

public static class HomesEndpoint
{
    /// <summary>Maps discovery of the authenticated account's homes and display identity.</summary>
    public static void MapHomes(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/", async (HttpContext context, DashboardService service, CancellationToken ct) =>
        {
            var discovery = await service.Discover(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, ct);

            return TypedResults.Ok(new HomesResponse(
                discovery.Homes.Select(home => new HomeResponse(home.Id, home.Name, home.Timezone)).ToArray(),
                discovery.Warnings, context.User.FindFirstValue(ClaimTypes.Name) ?? discovery.AccountName));
        }).WithName("Homes").Produces(401).Produces<ApiError>(502).Produces<ApiError>(503);
}
