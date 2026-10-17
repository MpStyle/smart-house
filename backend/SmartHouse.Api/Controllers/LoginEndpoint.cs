using Microsoft.AspNetCore.Authentication;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.Controllers;

public static class LoginEndpoint
{
    /// <summary>Maps browser OAuth sign-in using the configured public origin.</summary>
    public static void MapLogin(this IEndpointRouteBuilder endpoints, bool authAvailable, Uri origin) =>
        endpoints.MapGet("/auth/login", (HttpContext context) =>
        {
            if (!authAvailable)
            {

                return Results.Json(new ApiError("auth_not_configured"), statusCode: 503);
            }

            var authority = origin.GetLeftPart(UriPartial.Authority);
            if (context.Request.Scheme != origin.Scheme || context.Request.Host != HostString.FromUriComponent(origin))
            {

                return Results.Redirect(authority + "/api/v1/auth/login");
            }

            return Results.Challenge(new AuthenticationProperties { RedirectUri = authority + "/" }, ["Netatmo"]);
        }).WithName("Login").Produces(302).Produces<ApiError>(503)
            .WithDescription("Navigate the browser here to start Netatmo OAuth. The provider returns to /api/v1/auth/callback.");
}
