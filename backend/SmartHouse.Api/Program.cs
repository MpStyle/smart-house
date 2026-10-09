using System.Security.Claims;
using Azure.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using SmartHouse.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true);
var config = builder.Configuration;
var origin = new Uri(config["PublicOrigin"] ?? throw new InvalidOperationException("PublicOrigin is required."));
if (!builder.Environment.IsDevelopment() && origin.Scheme != "https")
    throw new InvalidOperationException("PublicOrigin must use HTTPS in production.");
var dataDirectory = Path.GetFullPath(config["DataDirectory"] ?? ".local");
Directory.CreateDirectory(dataDirectory);
var protection = builder.Services.AddDataProtection().SetApplicationName("SmartHouse");
if (config["DataProtection:BlobUri"] is { Length: > 0 } blobUri && config["DataProtection:KeyUri"] is { Length: > 0 } keyUri)
{
    var credential = new DefaultAzureCredential();
    protection.PersistKeysToAzureBlobStorage(new Uri(blobUri), credential).ProtectKeysWithAzureKeyVault(new Uri(keyUri), credential);
}
else if (builder.Environment.IsDevelopment())
    protection.PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataDirectory, "keys")));
else throw new InvalidOperationException("Production requires Azure Blob and Key Vault data protection configuration.");

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<SessionStore>();
builder.Services.AddHostedService<SessionCleanup>();
builder.Services.AddHttpClient<INetatmoClient, NetatmoClient>(http => http.Timeout = TimeSpan.FromSeconds(25));
builder.Services.AddScoped<DashboardService>();
builder.Services.AddMemoryCache();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = builder.Environment.IsDevelopment() ? "sh.csrf" : "__Host-sh.csrf";
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
builder.Services.AddAuthorization();
var auth = builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
});
auth.AddCookie(options =>
{
    options.Cookie.Name = builder.Environment.IsDevelopment() ? "sh.session" : "__Host-sh.session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = false;
    options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
    options.Events.OnValidatePrincipal = async context =>
    {
        var id = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id is null || context.HttpContext.RequestServices.GetRequiredService<SessionStore>().Find(id) is null)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync();
        }
    };
});
static bool CredentialConfigured(string? value) =>
    !string.IsNullOrWhiteSpace(value) && !value.StartsWith("@Microsoft.KeyVault(", StringComparison.OrdinalIgnoreCase);
var authAvailable = CredentialConfigured(config["Netatmo:ClientId"]) && 
                    CredentialConfigured(config["Netatmo:ClientSecret"])
                    ;
if (authAvailable)
    auth.AddOAuth("Netatmo", options =>
    {
        options.ClientId = config["Netatmo:ClientId"]!;
        options.ClientSecret = config["Netatmo:ClientSecret"]!;
        options.AuthorizationEndpoint = "https://api.netatmo.com/oauth2/authorize";
        options.TokenEndpoint = "https://api.netatmo.com/oauth2/token";
        options.CallbackPath = "/api/auth/callback";
        options.CorrelationCookie.SameSite = SameSiteMode.Lax;
        options.CorrelationCookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        options.Scope.Add("read_station");
        options.Scope.Add("read_thermostat");
        options.SaveTokens = false;
        options.Events.OnRedirectToAuthorizationEndpoint = context =>
        {
            context.Response.Redirect(context.RedirectUri);
            return Task.CompletedTask;
        };
        options.Events.OnCreatingTicket = context =>
        {
            if (context.AccessToken is null || context.RefreshToken is null || context.ExpiresIn is null)
                throw new ProviderException("invalid_provider_response");
            var clock = context.HttpContext.RequestServices.GetRequiredService<TimeProvider>();
            var store = context.HttpContext.RequestServices.GetRequiredService<SessionStore>();
            var id = store.Create(new(context.AccessToken, context.RefreshToken, clock.GetUtcNow().Add(context.ExpiresIn.Value)));
            context.Identity!.AddClaim(new(ClaimTypes.NameIdentifier, id));
            context.Properties.IsPersistent = true;
            context.Properties.ExpiresUtc = clock.GetUtcNow().AddDays(7);
            return Task.CompletedTask;
        };
        options.Events.OnRemoteFailure = context =>
        {
            context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>().LogWarning("Netatmo authorization failed.");
            context.HandleResponse();
            context.Response.Redirect(origin.GetLeftPart(UriPartial.Authority) + "/?authError=1");
            return Task.CompletedTask;
        };
    });

var app = builder.Build();
var demo = config.GetValue<bool>("DemoMode");
if (demo && !app.Environment.IsDevelopment()) throw new InvalidOperationException("DemoMode is allowed only in Development.");
app.Use(async (context, next) =>
{
    if (!app.Environment.IsDevelopment())
    {
        // Use the configured origin, not untrusted forwarded-host headers, for OAuth callback construction.
        context.Request.Scheme = origin.Scheme;
        context.Request.Host = HostString.FromUriComponent(origin);
    }
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    if (!app.Environment.IsDevelopment()) context.Response.Headers.StrictTransportSecurity = "max-age=31536000";
    try { await next(context); }
    catch (ProviderException exception)
    {
        context.Response.StatusCode = exception.Status;
        await context.Response.WriteAsJsonAsync(new { code = exception.Code });
    }
    catch (AntiforgeryValidationException)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { code = "invalid_csrf" });
    }
    catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
    {
        if (context.RequestAborted.IsCancellationRequested) return;
        app.Logger.LogError(exception, "Netatmo transport or response failure.");
        context.Response.StatusCode = 502;
        await context.Response.WriteAsJsonAsync(new { code = "provider_unavailable" });
    }
});
if (!app.Environment.IsDevelopment())
    app.Use(async (context, next) =>
    {
        var expected = config["FrontDoorId"];
        if (string.IsNullOrEmpty(expected) || context.Request.Headers["X-Azure-FDID"] != expected)
        {
            context.Response.StatusCode = 403;
            return;
        }
        await next(context);
    });
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/auth/session", (HttpContext context, IAntiforgery antiforgery, SessionStore store) =>
{
    var session = context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } id ? store.Find(id) : null;
    return Results.Ok(new
    {
        authenticated = session is not null,
        csrfToken = antiforgery.GetAndStoreTokens(context).RequestToken,
        authAvailable,
        demoAvailable = demo,
        demo = session?.Demo == true,
        expiresAt = session?.ExpiresAt
    });
});
app.MapGet("/api/auth/login", (HttpContext context) =>
{
    if (!authAvailable) return Results.Json(new { code = "auth_not_configured" }, statusCode: 503);
    var authority = origin.GetLeftPart(UriPartial.Authority);
    if (context.Request.Scheme != origin.Scheme || context.Request.Host != HostString.FromUriComponent(origin))
        return Results.Redirect(authority + "/api/auth/login");
    return Results.Challenge(new AuthenticationProperties { RedirectUri = authority + "/" }, ["Netatmo"]);
});
app.MapPost("/api/auth/logout", async (HttpContext context, IAntiforgery antiforgery, SessionStore store) =>
{
    await antiforgery.ValidateRequestAsync(context);
    if (context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } id) store.Delete(id);
    await context.SignOutAsync();
    return Results.NoContent();
});
if (demo)
    app.MapPost("/api/auth/demo", async (HttpContext context, IAntiforgery antiforgery, SessionStore store) =>
    {
        await antiforgery.ValidateRequestAsync(context);
        var id = store.Create(new("", "", DateTimeOffset.MaxValue), demo: true);
        await context.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id)], "demo")),
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7) });
        return Results.NoContent();
    });
var api = app.MapGroup("/api/homes").RequireAuthorization();
api.MapGet("/", async (HttpContext context, DashboardService service, CancellationToken ct) =>
{
    var discovery = await service.Discover(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, ct);
    return Results.Ok(new { homes = discovery.Homes.Select(home => new { home.Id, home.Name, home.Timezone }), discovery.Warnings });
});
api.MapGet("/{homeId}/measurements", async (string homeId, HttpContext context, DashboardService service, CancellationToken ct) =>
{
    var snapshot = await service.Snapshot(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, homeId, ct);
    return Results.Ok(new
    {
        snapshot.HomeId, snapshot.Timezone, snapshot.FetchedAt, snapshot.Warnings,
        rooms = snapshot.Rooms.Select(room => new
        {
            room.Id, room.Name,
            measurements = room.Measurements.Select(measurement => new
            {
                measurement.Id, measurement.Kind, measurement.DeviceName, measurement.Value,
                measurement.Unit, measurement.MeasuredAt, measurement.HasHistory,
                sampleMinutes = measurement.Source?.Endpoint == "getroommeasure" ? (int?)30 : null
            })
        })
    });
});
api.MapGet("/{homeId}/history/{measurementId}", async (string homeId, string measurementId, int? hours,
    HttpContext context, DashboardService service, CancellationToken ct) =>
    Results.Ok(await service.History(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!, homeId, measurementId, hours ?? 6, ct)));
app.Run();

public partial class Program;
