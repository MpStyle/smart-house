using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.Controllers;

public static class DemoEndpoint
{
    /// <summary>Maps demo sign-in, requiring antiforgery validation and explicitly enabled demo mode.</summary>
    public static void MapDemo(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapPost("/auth/demo", async (HttpContext context, IAntiforgery antiforgery, SessionStore store,
            TimeProvider clock) =>
        {
            await antiforgery.ValidateRequestAsync(context);
            var id = store.Create(new("", "", DateTimeOffset.MaxValue), demo: true);
            await context.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id)], "demo")),
                new AuthenticationProperties { IsPersistent = true, ExpiresUtc = clock.GetUtcNow().AddDays(7) });

            return Results.NoContent();
        }).WithName("Demo").Produces(204).Produces<ApiError>(400).Produces(404)
            .WithDescription("Create a demo session. Available only when Development demo mode is enabled.");
}
