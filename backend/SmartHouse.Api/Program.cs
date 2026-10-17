using System.Security.Claims;
using Azure.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.OpenApi;
using SmartHouse.Api.BusinessModels;
using SmartHouse.Api.Controllers;
using SmartHouse.Api.Repositories;
using SmartHouse.Api.Entities;

var builder = WebApplication.CreateBuilder(args);
var exportingOpenApi = System.Reflection.Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true)
    .AddEnvironmentVariables().AddCommandLine(args);
var config = builder.Configuration;
var origin = new Uri(config["PublicOrigin"] ?? (exportingOpenApi ? "https://localhost" : throw new InvalidOperationException("PublicOrigin is required.")));
if (!exportingOpenApi && !builder.Environment.IsDevelopment() && origin.Scheme != "https")
{
    throw new InvalidOperationException("PublicOrigin must use HTTPS in production.");
}

var dataDirectory = Path.GetFullPath(config["DataDirectory"] ?? ".local");
if (!exportingOpenApi)
{
    Directory.CreateDirectory(dataDirectory);
}

var protection = builder.Services.AddDataProtection().SetApplicationName("SmartHouse");
if (config["DataProtection:BlobUri"] is { Length: > 0 } blobUri && config["DataProtection:KeyUri"] is { Length: > 0 } keyUri)
{
    var credential = new DefaultAzureCredential();
    protection.PersistKeysToAzureBlobStorage(new Uri(blobUri), credential).ProtectKeysWithAzureKeyVault(new Uri(keyUri), credential);
}
else if (builder.Environment.IsDevelopment() && !exportingOpenApi)
{
    protection.PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataDirectory, "keys")));
}
else if (!exportingOpenApi)
{
    throw new InvalidOperationException("Production requires Azure Blob and Key Vault data protection configuration.");
}

builder.Services.AddOpenApi("v1", options =>
{
    options.AddSchemaTransformer((schema, context, _) =>
    {
        if (context.JsonTypeInfo.Type == typeof(MeasurementStatus))
        {
            schema.Type = JsonSchemaType.String;
        }

        return Task.CompletedTask;
    });
    options.AddOperationTransformer((operation, _, _) =>
    {
        if (operation.OperationId is "Demo" or "Logout")
        {
            operation.Parameters ??= [];
            operation.Parameters.Add(new OpenApiParameter
            {
                Name = "X-CSRF-TOKEN",
                In = ParameterLocation.Header,
                Required = true,
                Schema = new OpenApiSchema { Type = JsonSchemaType.String }
            });
        }

        return Task.CompletedTask;
    });
    options.AddDocumentTransformer((document, _, _) =>
    {
        document.Info.Title = "Smart House API";
        document.Info.Version = "v1";
        // Generated clients take the deployment origin from their caller, never from the export process.
        document.Servers = [];

        return Task.CompletedTask;
    });
});
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.Strict);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<SessionRepository>();
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
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = 401;

        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = 403;

        return Task.CompletedTask;
    };
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
var authAvailable = CredentialConfigured(config["Netatmo:ClientId"]) &&
                    CredentialConfigured(config["Netatmo:ClientSecret"])
                    ;
if (authAvailable)
{
    auth.AddOAuth("Netatmo", options =>
    {
        options.ClientId = config["Netatmo:ClientId"]!;
        options.ClientSecret = config["Netatmo:ClientSecret"]!;
        options.AuthorizationEndpoint = "https://api.netatmo.com/oauth2/authorize";
        options.TokenEndpoint = "https://api.netatmo.com/oauth2/token";
        options.CallbackPath = "/api/v1/auth/callback";
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
            {
                throw new ProviderException("invalid_provider_response");
            }

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
            context.HttpContext.RequestServices.GetRequiredService<ILogger<SmartHouse.Api.Program>>().LogWarning("Netatmo authorization failed.");
            context.HandleResponse();
            context.Response.Redirect(origin.GetLeftPart(UriPartial.Authority) + "/?authError=1");

            return Task.CompletedTask;
        };
    });
}

var app = builder.Build();
var demo = config.GetValue<bool>("DemoMode");
if (!exportingOpenApi && demo && !app.Environment.IsDevelopment())
{
    throw new InvalidOperationException("DemoMode is allowed only in Development.");
}

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
    if (!app.Environment.IsDevelopment())
    {
        context.Response.Headers.StrictTransportSecurity = "max-age=31536000";
    }

    try
    {
        await next(context);
    }
    catch (ProviderException exception)
    {
        context.Response.StatusCode = exception.Status;
        await context.Response.WriteAsJsonAsync(new ApiError(exception.Code));
    }
    catch (AntiforgeryValidationException)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new ApiError("invalid_csrf"));
    }
    catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
    {
        if (context.RequestAborted.IsCancellationRequested)
        {

            return;
        }

        app.Logger.LogError(exception, "Netatmo transport or response failure.");
        context.Response.StatusCode = 502;
        await context.Response.WriteAsJsonAsync(new ApiError("provider_unavailable"));
    }
});
if (!app.Environment.IsDevelopment())
{
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
}

app.UseAuthentication();
app.UseAuthorization();
var v1 = app.MapGroup("/api/v1");
v1.MapHealth();
v1.MapSession(authAvailable, demo);
v1.MapLogin(authAvailable, origin);
v1.MapLogout();
// Export the optional demo operation without enabling it in non-demo runtime environments.
if (demo || exportingOpenApi)
{
    v1.MapDemo();
}
var api = v1.MapGroup("/homes").RequireAuthorization();
api.MapHomes();
api.MapMeasurements();
api.MapHistory();
app.Run();

return;

static bool CredentialConfigured(string? value) =>
    !string.IsNullOrWhiteSpace(value) && !value.StartsWith("@Microsoft.KeyVault(", StringComparison.OrdinalIgnoreCase);

namespace SmartHouse.Api
{
    public partial class Program;
}
