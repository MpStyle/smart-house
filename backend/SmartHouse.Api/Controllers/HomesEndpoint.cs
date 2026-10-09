using System.Security.Claims;
using SmartHouse.Api.BusinessModels;

namespace SmartHouse.Api.Controllers;

public static class HomesEndpoint
{
    public static void MapHomes(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/", async (HttpContext context, DashboardService service, CancellationToken ct) =>
        {
            var discovery = await service.Discover(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, ct);
            return Results.Ok(new { homes = discovery.Homes.Select(home => new { home.Id, home.Name, home.Timezone }), discovery.Warnings });
        });
}
