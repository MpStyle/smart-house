# Smart House

Read-only Netatmo dashboard: measurements by home and room, dedicated history, and Netatmo account sign-in. React/TypeScript, Redux Toolkit, MUI, and i18next frontend; ASP.NET Core 10 backend. Languages: Italian, English, French, German, Spanish, and Portuguese.

## Local startup

Prerequisites: up-to-date .NET SDK 10 and Node.js 20.14 or later (Node 22 recommended). Demo mode is **explicit**, uses simulated data, and cannot be enabled in production.

From two terminals at the repository root:

```bash
dotnet build backend/SmartHouse.Api
cd backend/SmartHouse.Api
ASPNETCORE_ENVIRONMENT=Development DemoMode=true \
  dotnet bin/Debug/net10.0/SmartHouse.Api.dll --urls http://localhost:5080
```

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173> and select **Explore the demo**. Demo mode also requires a session: no data appears before sign-in. It includes a thermostat, a station with weather modules, stale readings, and charts. No requests are sent to Netatmo in this mode.

### Connecting real devices

1. Register a dedicated app on [Netatmo Connect](https://dev.netatmo.com/apps), enabling only `read_station` and `read_thermostat`. Verify that the app can authorize external users before advertising the beta.
2. Set the local redirect URI to `http://localhost:5173/api/v1/auth/callback`, if the Netatmo portal allows it. If HTTPS is required, use a trusted local HTTPS origin and update `PublicOrigin` and the Vite proxy accordingly.
3. Enter secrets **in your local terminal**, never in chat, the frontend, or the repository:

```bash
dotnet user-secrets set 'Netatmo:ClientId' '<client-id>' --project backend/SmartHouse.Api
dotnet user-secrets set 'Netatmo:ClientSecret' '<client-secret>' --project backend/SmartHouse.Api
```

4. Restart with `ASPNETCORE_ENVIRONMENT=Development`, without `DemoMode=true`, and choose **Sign in with Netatmo**. The Vite proxy keeps frontend, OAuth callback, and APIs on one origin. Missing credentials disable the button; they do not enable demo mode automatically.

Sessions last an **absolute** seven days; token refresh does not extend them. Cookies contain only an opaque session identifier; access and refresh tokens remain encrypted on the backend. Logout deletes the session and cache. Local data lives in `backend/SmartHouse.Api/.local/`, or the configured `DataDirectory`.

## Data behavior

- Classic `NATherm1` Smart Thermostat with relay; Weather Station, outdoor module, extra indoor modules, rain gauge, and wind gauge.
- Weather Stations are associated with homes through their explicit `home_id`. Without it, the station is a **separate home**, even if another home has the same name. Names or location never imply an association.
- Within a home, room/module names match ignoring case and edge whitespace. Each measurement keeps its provenance; two temperatures are not averaged.
- Documented numeric environmental readings are shown: temperature, humidity, CO2, noise, pressure/absolute pressure, daily minimum/maximum, rain and accumulations, wind/gusts and directions. No commands, setpoints, battery readings, or heating state.
- `homestatus` does not document a timestamp for instantaneous thermostat temperature. The dashboard retrieves **the last thirty-minute sample from `getroommeasure` within the last 48 hours**, without requiring the chart to open. It is not presented as an instantaneous reading. The API supplies room history; this version supports the classic room thermostat and does not attribute aggregated temperatures to multiple distinct thermostats.
- A valid sample within 30 minutes is fresh; older samples up to 48 hours remain visible as **Stale data**. Beyond 48 hours, or without a valid value/timestamp, the reading is **Unavailable**. The client also checks thresholds while the page remains open or returns to visibility, without network requests.
- When an update fails or a device is unreachable, its last known value within 48 hours remains visible with **Update failed**, without appearing fresh. Weather sensors use current responses and cache without extra history requests; thermostats use room history. Errors remain visible and revoked permissions do not trigger this fallback. Values keep their original timestamp: no measurement archive is created.
- Fetch on opening and manual refresh; no polling. Backend cache per session/home lasts one minute and survives restarts. Concurrent requests are coalesced. Topology and weather responses are shared between homes of the same session to reduce calls. Failed discovery attempts are also throttled for one minute.
- Charts start at 6 hours, with 6/12/24/48-hour ranges, thirty-minute resolution, actual timestamps, and the home's timezone. Gaps are not interpolated. Current values and history use the same conversions, based on Netatmo preferences with metric fallback.
- The **Rain** chart uses `sum_rain`: accumulation in each thirty-minute interval, not the instantaneous reading. Current 1/24-hour accumulations, absolute pressure, and daily extremes do not link to semantically different history.
- History comes from Netatmo; no proprietary archive is built. Chart responses are cached only in memory for one minute.
- Errors and partial results remain visible. A total provider failure is not shown as an account with no devices. Access to homes/measurements outside the session returns 404.
- Language, theme, and last selected home persist in the browser; device data and tokens are not stored in `localStorage`. Hash routing supports direct history links on Storage static websites.

### Endpoints

All APIs use `/api/v1`. Unversioned `/api/...` URLs are no longer supported; update external clients and Netatmo callback registrations when deploying this change.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/auth/session` | Session state and antiforgery token; no Netatmo tokens |
| `GET /api/v1/auth/login` | Starts browser Netatmo OAuth |
| `GET /api/v1/auth/callback` | OAuth middleware callback with state validation |
| `POST /api/v1/auth/logout` | Logout, with `X-CSRF-TOKEN` header |
| `POST /api/v1/auth/demo` | Development demo sign-in with antiforgery; 404 when disabled |
| `GET /api/v1/homes` | Authorized homes |
| `GET /api/v1/homes/{homeId}/measurements` | Home rooms and measurements |
| `GET /api/v1/homes/{homeId}/history/{measurementId}?hours=6` | 6/12/24/48-hour history |
| `GET /api/v1/health` | Process readiness |

### OpenAPI and SDKs

Backend builds update [`openapi/smart-house.json`](openapi/smart-house.json). After API changes, run `node scripts/generate-api.mjs` with frontend dependencies installed to regenerate the C# SDK (`SmartHouse.Sdk`, .NET 8+), independent Fetch SDK (`@mpstyle/smart-house-sdk`), and frontend RTK Query client. Contract and generated sources are versioned; CI rejects drift.

SDKs publish to GitHub Packages only through an explicit `sdk-vX.Y.Z` tag on a commit belonging to `main`. See [SDK setup and releases](sdk/README.md), [backend formatting/export](backend/README.md), and [frontend code generation](frontend/README.md#generated-api-client).

## Azure

Configuration and section-specific pipelines: [GitHub Actions](.github/README.md), [frontend](frontend/README.md), [backend](backend/README.md), and [infrastructure](infra/README.md). The frontend README covers local backend port configuration.

`infra/main.bicep` creates resources in a dedicated resource group:

- Linux App Service **B1, single instance**, .NET 10, in West Europe;
- LRS Storage Account for the static frontend;
- Front Door Standard, HTTPS on the Azure domain, routing `/api/*` to the backend and `/*` to the frontend; **API caching disabled**;
- private Storage and Key Vault for persistent ASP.NET Data Protection keys; managed identity and RBAC for the backend;
- Key Vault for Netatmo credentials through App Service references;
- optional budget alerts at 80% actual and 100% forecast cost.

Production cookies are Secure/HttpOnly and the backend admits only its own Front Door through network restrictions and `X-Azure-FDID` validation. The frontend has no Azure/Netatmo credentials and does not use CORS. Front Door applies CSP and security headers to static files too.

**Do not scale to multiple backend instances without migrating sessions/cache to shared transactional storage and locks to distributed coordination.** Persistent SQLite in `/home/data/smart-house` and in-process locks target the initial beta (~50 users, few concurrent). SQLite uses rollback journaling, not WAL, on the App Service volume. Preserve that volume and every Key Vault key version needed to decrypt existing sessions. No history database is created.

### Deployment preparation

Publish to a GitHub repository with **`main`** as the primary branch. Frontend, backend, and infrastructure CI are separate and run only for relevant changes; README-only changes are excluded. Browser tests belong to frontend CI and do not invoke backend CI.

Create the **production environment without manual approval**, and configure Azure OIDC identities, variables, secrets, and RBAC using the [GitHub configuration tables](.github/README.md#github-settings). Netatmo credentials stay in Key Vault, never in the frontend or YAML.

The first release uses **manual infrastructure-only bootstrap**, with automatic deployments disabled: create the dedicated group, run **Deploy Infrastructure**, enter Netatmo secrets and register the HTTPS callback from the outputs, then publish backend and frontend through their workflows. The [infrastructure guide](infra/README.md#manual-bootstrap) describes two-pass provisioning and prerequisites.

After bootstrap, set the **repository** variable `AZURE_DEPLOY_ENABLED=true`. Merges to `main` automatically deploy only changed sections after successful CI on the same commit, in order: **infrastructure → backend → frontend**. Frontend/backend reuse verified artifacts and do not recreate infrastructure. Failures stop subsequent deployment steps.

Old hashed deployment assets remain available to avoid breaking open tabs. APIs and cookies are not CDN-cached. Optional budgets use the subscription currency and do not impose a spending cap.

### Costs and release prerequisites

No Azure resources have been created. **The EUR 50–100/month target is neither a quote nor a spending limit.** Check Front Door Standard (fixed fee, requests, traffic), App Service B1, Storage, Key Vault, and taxes with [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/), using your subscription and West Europe. Alerts do not stop resources; notifications require at least one recipient. If the region does not offer .NET 10, do not switch runtimes implicitly: update the template or use a supported .NET 10 image.

Before a public beta, the following remain necessary:

- OAuth access with real accounts/devices, without treating demo payloads as integration evidence;
- verification of names, associations, timestamps, and history samples for the actual thermostat/modules;
- verification of non-metric Netatmo preferences, conversions, and ranges with missing readings;
- confirmation of [Netatmo terms and limits](https://dev.netatmo.com/guideline) for external users, commercial permissions if needed, and the beta privacy notice;
- real deployment and verification of OAuth redirects, token refresh/revocation, restart persistence, origin restrictions, Front Door readiness, and pricing.

Adapters use the official [Energy](https://dev.netatmo.com/apidocumentation/energy) and [Weather](https://dev.netatmo.com/apidocumentation/weather) payload documentation. Real-device availability still needs verification; demo mode and tests do not replace it.

## Local verification

```bash
Netatmo__ClientId='' Netatmo__ClientSecret='' dotnet test backend/SmartHouse.Api.Tests
cd frontend
npm test
npm run build
cd ..
npm test --prefix sdk/typescript
az bicep build --file infra/main.bicep --outfile /tmp/smart-house-template.json
```

Tests cover sign-in/CSRF, session expiration, logout, isolation, grouping/provenance, stale values, concurrent throttling, history shapes/ranges, conversions, home selection, translation completeness, and generated clients. NuGet treats advisories as errors; native SQLite and XML crypto dependencies are explicitly updated.

For browser verification, Playwright starts demo servers if they are not already running:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

Desktop/mobile scenarios cover sign-in, duplicate measurements, charts, language changes, logout, no polling, and expiration while the page remains open.

Below 600 px, cards use two columns: device names and sample timestamps are hidden, while room headings, stale state, and update failures remain visible. The dashboard app bar contains **Refresh**; history replaces the home icon with a **Back** arrow, including during loading/errors. The arrow returns to the previous internal page or the dashboard for a direct history link, without leaving the app. The range selector remains beside the chart.
