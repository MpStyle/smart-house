using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using SmartHouse.Api.BusinessModels;

namespace SmartHouse.Api.Controllers;

public static class LogoutEndpoint
{
    public static void MapLogout(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapPost("/api/auth/logout", async (HttpContext context, IAntiforgery antiforgery, SessionStore store) =>
        {
            await antiforgery.ValidateRequestAsync(context);
            if (context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } id) store.Delete(id);
            await context.SignOutAsync();
            return Results.NoContent();
        });
}
