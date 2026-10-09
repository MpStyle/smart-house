namespace SmartHouse.Api.Controllers;

public static class HealthEndpoint
{
    public static void MapHealth(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
}
