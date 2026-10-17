using SmartHouse.Api.Entities;

namespace SmartHouse.Api.Controllers;

public static class HealthEndpoint
{
    /// <summary>Maps the process readiness endpoint.</summary>
    public static void MapHealth(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/health", () => TypedResults.Ok(new HealthResponse("ok")))
            .WithName("Health");
}
