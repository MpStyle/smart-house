using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using SmartHouse.Api.BusinessModels;

namespace SmartHouse.Api.Controllers;

public static class SessionEndpoint
{
    public static void MapSession(this IEndpointRouteBuilder endpoints, bool authAvailable, bool demo) =>
        endpoints.MapGet("/api/auth/session", (HttpContext context, IAntiforgery antiforgery, SessionStore store) =>
        {
            var session = context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } id ? store.Find(id) : null;
            return Results.Ok(new
            {
                authenticated = session is not null,
                csrfToken = antiforgery.GetAndStoreTokens(context).RequestToken,
                authAvailable, demoAvailable = demo, demo = session?.Demo == true, expiresAt = session?.ExpiresAt
            });
        });
}
