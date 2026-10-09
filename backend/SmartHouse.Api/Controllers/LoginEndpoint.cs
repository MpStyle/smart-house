using Microsoft.AspNetCore.Authentication;

namespace SmartHouse.Api.Controllers;

public static class LoginEndpoint
{
    public static void MapLogin(this IEndpointRouteBuilder endpoints, bool authAvailable, Uri origin) =>
        endpoints.MapGet("/api/auth/login", (HttpContext context) =>
        {
            if (!authAvailable) return Results.Json(new { code = "auth_not_configured" }, statusCode: 503);
            var authority = origin.GetLeftPart(UriPartial.Authority);
            if (context.Request.Scheme != origin.Scheme || context.Request.Host != HostString.FromUriComponent(origin))
                return Results.Redirect(authority + "/api/auth/login");
            return Results.Challenge(new AuthenticationProperties { RedirectUri = authority + "/" }, ["Netatmo"]);
        });
}
