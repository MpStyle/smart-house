using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using SmartHouse.Api.Entities;

namespace SmartHouse.Api.BusinessModels;

public sealed class NetatmoClient(HttpClient http, SessionStore store, IConfiguration config,
    TimeProvider clock, ILogger<NetatmoClient> logger) : INetatmoClient
{
    public async Task<JsonElement> Get(string sessionId, string endpoint, Dictionary<string, string?>? query, CancellationToken ct)
    {
        try
        {
            return await store.Locked("tokens:" + sessionId, async () =>
            {
                var session = store.Find(sessionId) ?? throw new ProviderException("session_expired", 401);
                if (session.Demo) return DemoData.Get(endpoint, query, clock.GetUtcNow());
                if (session.Tokens.ExpiresAt <= clock.GetUtcNow().AddMinutes(1))
                    session = await Refresh(sessionId, session, ct);

                using var response = await Send(session.Tokens.AccessToken, endpoint, query, ct);
                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    session = await Refresh(sessionId, session, ct);
                    using var retry = await Send(session.Tokens.AccessToken, endpoint, query, ct);
                    if (retry.StatusCode == HttpStatusCode.Unauthorized) store.Delete(sessionId);
                    return await Parse(retry, ct);
                }
                return await Parse(response, ct);
            });
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException
            || exception is OperationCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(exception, "Netatmo transport or response failed for {Endpoint}.", endpoint);
            throw new ProviderException("provider_unavailable");
        }
    }

    private async Task<HttpResponseMessage> Send(string token, string endpoint, Dictionary<string, string?>? query, CancellationToken ct)
    {
        var uri = QueryHelpers.AddQueryString("https://api.netatmo.com/api/" + endpoint, query ?? []);
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await http.SendAsync(request, ct);
    }

    private async Task<StoredSession> Refresh(string id, StoredSession session, CancellationToken ct)
    {
        using var response = await http.PostAsync("https://api.netatmo.com/oauth2/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = session.Tokens.RefreshToken,
            ["client_id"] = config["Netatmo:ClientId"]!,
            ["client_secret"] = config["Netatmo:ClientSecret"]!
        }), ct);
        if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            store.Delete(id);
            throw new ProviderException("session_expired", 401);
        }
        var payload = await Parse(response, ct, bodyOnly: false);
        var token = payload.Text("access_token") ?? throw new ProviderException("invalid_provider_response");
        var refresh = payload.Text("refresh_token") ?? throw new ProviderException("invalid_provider_response");
        var expires = payload.Number("expires_in") ?? throw new ProviderException("invalid_provider_response");
        var updated = session with { Tokens = new(token, refresh, clock.GetUtcNow().AddSeconds(expires)) };
        store.Save(id, updated);
        return updated;
    }

    private async Task<JsonElement> Parse(HttpResponseMessage response, CancellationToken ct, bool bodyOnly = true)
    {
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Netatmo request failed with HTTP {Status}.", (int)response.StatusCode);
            throw new ProviderException(response.StatusCode switch
            {
                HttpStatusCode.Unauthorized => "session_expired",
                HttpStatusCode.Forbidden => "provider_permission_denied",
                HttpStatusCode.TooManyRequests => "provider_rate_limited",
                _ => "provider_unavailable"
            }, response.StatusCode == HttpStatusCode.Unauthorized ? 401 : 502);
        }
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var root = document.RootElement;
        if (root.Field("error").ValueKind != JsonValueKind.Undefined)
        {
            logger.LogWarning("Netatmo returned an API error code {Code}.", root.Field("error").Text("code"));
            throw new ProviderException("provider_unavailable");
        }
        var body = bodyOnly ? root.Field("body") : root;
        if (body.ValueKind == JsonValueKind.Undefined) throw new ProviderException("invalid_provider_response");
        return body.Clone();
    }
}
