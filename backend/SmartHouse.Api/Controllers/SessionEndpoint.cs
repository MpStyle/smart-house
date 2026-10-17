using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.Controllers;

public static class SessionEndpoint
{
    /// <summary>Maps session state and a browser antiforgery token without exposing provider credentials.</summary>
    public static void MapSession(this IEndpointRouteBuilder endpoints, bool authAvailable, bool demo) =>
        endpoints.MapGet("/auth/session", (HttpContext context, IAntiforgery antiforgery, SessionStore store) =>
        {
            var session = context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } id ? store.Find(id) : null;

            return TypedResults.Ok(new SessionResponse(session is not null,
                antiforgery.GetAndStoreTokens(context).RequestToken!,
                authAvailable, demo, session?.Demo == true, session?.ExpiresAt));
        }).WithName("Session");
}
