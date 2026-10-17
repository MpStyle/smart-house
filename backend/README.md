# Backend

ASP.NET Core 10 API in [`SmartHouse.Api`](SmartHouse.Api/), with tests in [`SmartHouse.Api.Tests`](SmartHouse.Api.Tests/). It provides Netatmo OAuth, server-side encrypted tokens, persistent seven-day sessions, and account-authorized measurements and history.

Models live in `Entities/`, each Minimal API endpoint has a file in `Controllers/`, application logic lives in `BusinessModels/`, and SQLite access lives in `Repositories/`. `Program.cs` owns configuration, dependency injection, authentication, and middleware. All HTTP APIs use `/api/v1`; old `/api/...` routes are not aliases. Cookie names and the database schema are unchanged.

Measurements include `status` (`fresh`, `stale`, `unavailable`) and `updateFailed`. Sample timestamps determine freshness (30 minutes) and last-known-value retention (48 hours), not fetch timestamps. Transient failures preserve cached values and timestamps with warnings; authentication or permission failures never become successful cached responses.

The authenticated `/api/v1/homes` response includes `accountName`: the authenticated identity's name, otherwise the Netatmo email (`user.email` from `homesdata` or `user.mail` from `getstationsdata`). Retrieval reuses discovery and its cache without extra calls or OAuth scopes. If the provider does not expose an identity, the field is `null`; transient failures retain the previously retrieved identity. Development frontend logs redact this field.

## Local startup

From the repository root, with an up-to-date .NET SDK 10:

```bash
dotnet build backend/SmartHouse.Api
cd backend/SmartHouse.Api
ASPNETCORE_ENVIRONMENT=Development DemoMode=true \
  dotnet bin/Debug/net10.0/SmartHouse.Api.dll --urls http://localhost:5080
```

Run the frontend separately on `http://localhost:5173`. `DemoMode=true` enables simulated data only and is forbidden in production. The demo endpoint remains in the contract but returns 404 when demo mode is disabled.

To change ports, use, for example, `--urls http://localhost:5090` and update the Vite proxy target as described in the [frontend README](../frontend/README.md#configuring-the-local-backend-port). `PublicOrigin` is always the browser-visible **frontend** origin, not the internal backend URL.

The optional `appsettings.Local.json` overrides standard JSON files; environment variables and command-line arguments take precedence over local settings. Never put secrets in tracked files.

### Real Netatmo access

Register the Netatmo Connect app with `read_station` and `read_thermostat` scopes and the local callback `http://localhost:5173/api/v1/auth/callback`, if allowed by the portal. Configure credentials in your local terminal:

```bash
# From the repository root:
dotnet user-secrets set 'Netatmo:ClientId' '<client-id>' --project backend/SmartHouse.Api
dotnet user-secrets set 'Netatmo:ClientSecret' '<client-secret>' --project backend/SmartHouse.Api
```

Restart the backend in Development **without** `DemoMode=true`. Do not share credentials or tokens in chat or put them in `appsettings.json` or the frontend. Existing Netatmo app registrations must update their callback to `/api/v1/auth/callback` when deploying v1.

## OpenAPI and generated clients

Every backend build creates or updates [`../openapi/smart-house.json`](../openapi/smart-house.json), an OpenAPI 3.0 contract with stable operation IDs and explicit response models. Build-time export does not start the HTTP server or require Azure/Netatmo credentials or initialize session storage. It does not expose a public OpenAPI endpoint.

After changing an endpoint or its models, regenerate all versioned clients from the root:

```bash
npm ci --prefix frontend
node scripts/generate-api.mjs
```

The script builds the backend in Release, restores the pinned NSwag tool, regenerates the C# and Fetch SDKs, then runs `@rtk-query/codegen-openapi` for the frontend. Commit the contract and all generated sources together with the API change. Do not edit generated sources manually. [SDK documentation](../sdk/README.md) covers packages and releases.

## Formatting and public methods

The root `.editorconfig` requires braces and multiline control-flow blocks. Public methods and explicitly declared primary constructors have concise English XML documentation; exported model summaries also flow into OpenAPI and generated SDK documentation. The return-spacing helper complements `.editorconfig`, which cannot express a blank line before every `return`.

```bash
dotnet format SmartHouse.sln --diagnostics IDE0011
node scripts/backend-style.mjs --write
```

CI runs the formatter in verification mode and checks return spacing. Apply the return-spacing helper **after** the formatter. Generated SDK sources are controlled by their generator, not hand-formatted.

## Backend CI

[`ci-backend.yml`](../.github/workflows/ci-backend.yml) runs for backend changes, `global.json`/`SmartHouse.sln`, C# SDK and OpenAPI changes used by integration tests, formatting configuration/helpers, its own workflows, or shared pipeline implementation. README-only changes do not trigger it.

It verifies formatting, runs .NET tests, publishes Release, and creates an API ZIP. It does not install the frontend, run Playwright, or use Azure. On `main`, it retains `backend-package` containing `api.zip` for seven days. [CI SDK](../.github/workflows/ci-sdk.yml) separately checks regeneration, both SDKs, and frontend compatibility.

```bash
# Empty environment overrides keep local Netatmo credentials out of the simulated test host.
Netatmo__ClientId='' Netatmo__ClientSecret='' \
  dotnet test backend/SmartHouse.Api.Tests --configuration Release
dotnet publish backend/SmartHouse.Api --configuration Release
```

## Backend deployment to Azure

[`deploy-backend.yml`](../.github/workflows/deploy-backend.yml) publishes only the successful CI package for **the same commit** on `main` to App Service. It is called automatically for backend changes and can run manually after bootstrap.

| Name | Location | Requirement |
| --- | --- | --- |
| `AZURE_DEPLOY_ENABLED=true` | Repository variable | Enables automatic deployment after bootstrap |
| `AZURE_RESOURCE_GROUP` | `production` environment variable | Required |
| `AZURE_DEPLOYMENT_NAME` | `production` environment variable | Optional; defaults to `smart-house` |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | `production` environment secrets | Required for OIDC |
| `netatmo-client-id`, `netatmo-client-secret` | **Azure Key Vault secrets**, not GitHub secrets | Required before the first API deployment |

App Service/vault names and the public URL come from infrastructure outputs. The pipeline checks that secrets exist, refreshes Key Vault references, deploys the ZIP, and checks `/api/v1/health` and `/api/v1/auth/session` through Front Door. It requires `authAvailable=true` and `demoAvailable=false`.

**It does not create Azure resources or publish the frontend.** For the first release, complete [infrastructure bootstrap](../infra/README.md) and register the HTTPS Netatmo callback first.

The deployment identity needs App Service publishing permissions, ARM output read access, and `Key Vault Secrets User`. The backend runtime identity is separate and configured by Bicep. OIDC and roles: [GitHub Actions README](../.github/README.md).

## Azure runtime configuration

Bicep provisions these settings; they are **not** additional GitHub variables:

| App Service setting | Purpose |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT=Production` | Production runtime |
| `PublicOrigin` | Front Door HTTPS URL; cookie and callback origin |
| `FrontDoorId` | Authorized Front Door verification |
| `DataDirectory=/home/data/smart-house` | Persistent SQLite sessions/cache |
| `DataProtection__BlobUri` | Persistent keyring on private Blob storage |
| `DataProtection__KeyUri` | Key Vault encryption key |
| `Netatmo__ClientId`, `Netatmo__ClientSecret` | Key Vault secret references |
| `WEBSITES_ENABLE_APP_SERVICE_STORAGE=true` | Persistent App Service volume |

Keep a single B1 instance for the initial beta: SQLite and in-process locks are not designed for scale-out. Never enable `DemoMode=true` in production.
