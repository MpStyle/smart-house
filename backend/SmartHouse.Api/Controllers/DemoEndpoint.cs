using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using SmartHouse.Api.BusinessModels;

namespace SmartHouse.Api.Controllers;

public static class DemoEndpoint
{
    public static void MapDemo(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapPost("/api/auth/demo", async (HttpContext context, IAntiforgery antiforgery, SessionStore store,
            TimeProvider clock) =>
        {
            await antiforgery.ValidateRequestAsync(context);
            var id = store.Create(new("", "", DateTimeOffset.MaxValue), demo: true);
            await context.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id)], "demo")),
                new AuthenticationProperties { IsPersistent = true, ExpiresUtc = clock.GetUtcNow().AddDays(7) });
            return Results.NoContent();
        });
}
