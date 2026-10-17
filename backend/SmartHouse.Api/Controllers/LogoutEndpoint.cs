using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.Controllers;

public static class LogoutEndpoint
{
    /// <summary>Maps antiforgery-protected logout and server-side session revocation.</summary>
    public static void MapLogout(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapPost("/auth/logout", async (HttpContext context, IAntiforgery antiforgery, SessionStore store) =>
        {
            await antiforgery.ValidateRequestAsync(context);
            if (context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } id)
            {
                store.Delete(id);
            }

            await context.SignOutAsync();

            return TypedResults.NoContent();
        }).WithName("Logout").Produces<ApiError>(400);
}
