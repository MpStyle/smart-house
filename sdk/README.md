# Generated SDKs

The backend exports [`../openapi/smart-house.json`](../openapi/smart-house.json) during every build. Pinned NSwag generates independent C# and TypeScript SDKs; `@rtk-query/codegen-openapi` separately generates the frontend's React/Redux client.

| Package | Target | Registry |
| --- | --- | --- |
| `SmartHouse.Sdk` | .NET 8 and later, HttpClient, System.Text.Json | `https://nuget.pkg.github.com/MpStyle/index.json` |
| `@mpstyle/smart-house-sdk` | ESM, Fetch, TypeScript declarations; modern browsers/Node.js with Fetch | `https://npm.pkg.github.com` |

## Update the contract and clients

Use .NET SDK 10 and Node.js 20.14 or later (Node 22 recommended):

```bash
npm ci --prefix frontend
npm ci --prefix sdk/typescript
node scripts/generate-api.mjs
dotnet build sdk/csharp
npm test --prefix sdk/typescript
```

The script builds the API in Release, restores the pinned local .NET generator, and updates `openapi/smart-house.json`, `sdk/csharp/Generated/SmartHouseClient.cs`, `sdk/typescript/src/client.ts`, and `frontend/src/api/generated.ts`. Run it whenever endpoints or response models change and commit the generated files with the change. Generator versions and configurations are versioned; never hand-edit generated sources.

CI regenerates and rejects differences or untracked generated files. It compiles/tests both SDKs, checks frontend integration, and checks package creation. The backend integration suite exercises the C# SDK against the test server, including CSRF, session cookies, measurements, history, and logout.

## C# consumer

Configure a NuGet source for the registry above using credentials with `read:packages`. Keep credentials in your user's NuGet configuration or a secret store, not this repository.

```bash
dotnet add package SmartHouse.Sdk --version <version> \
  --source https://nuget.pkg.github.com/MpStyle/index.json
```

```csharp
using SmartHouse.Sdk;

using var http = new HttpClient { BaseAddress = new Uri("https://your-house.example/") };
var client = new SmartHouseClient(http);
var health = await client.HealthAsync();
var session = await client.SessionAsync();
```

Set `BaseAddress` to the deployment **origin**, without `/api/v1`. Keep the same HttpClient/cookie container for a session. Homes, measurements, and history require an authenticated session cookie; the SDK does not accept Netatmo access tokens or automate interactive OAuth. Supply an authorized cookie securely when using a non-browser client. `DemoAsync(session.CsrfToken)` works only on an explicitly enabled Development demo server; refetch `SessionAsync()` afterward for the authenticated CSRF token. Pass that token to `LogoutAsync`.

## TypeScript consumer

Configure the `@mpstyle` npm scope for `https://npm.pkg.github.com` and authenticate with `read:packages`. Do not commit authentication tokens.

```bash
npm install @mpstyle/smart-house-sdk@<version>
```

```typescript
import { SmartHouseClient } from '@mpstyle/smart-house-sdk';

const client = new SmartHouseClient(window.location.origin);
// Run after interactive browser sign-in so the CSRF token belongs to the authenticated identity.
const session = await client.session();
const homes = await client.homes();
await client.logout(session.csrfToken);
```

Fetch uses same-origin cookies by default. Construct/refetch the session after sign-in to obtain the correct CSRF token. OAuth starts by navigating to `/api/v1/auth/login`, not by treating it as a JSON request. Cross-origin browser calls are not supported by the backend's current CORS policy. Node.js consumers must supply a Fetch implementation with their authenticated cookie handling through the client's optional `http` constructor argument. Methods accept an optional AbortSignal; timestamps remain ISO strings and missing numeric readings remain `null`.

## Release to GitHub Packages

After merging the API and generated files into `main`, explicitly create and push a stable tag such as `sdk-v1.2.3`. This is an operator action; regeneration never creates commits, tags, or pushes.

[`Publish SDK`](../.github/workflows/publish-sdk.yml) first runs the full SDK verification workflow. It then accepts only `sdk-vX.Y.Z` without leading zeroes, verifies that the commit belongs to `main`, packs both libraries with exactly that version, and publishes using the job's `GITHUB_TOKEN` with `packages: write`. Pull requests and ordinary `main` pushes never publish packages. Choose major/minor/patch deliberately for breaking changes, features, and fixes.

The repository/organization must permit Actions package publishing. Existing packages must grant this repository Actions access, and repository policy must allow the workflow's explicit write permission. No personal access token is needed for publication from this repository. Package visibility/access must be configured on GitHub for intended consumers.

NuGet and npm publication are not atomic: if one succeeds and the other fails, inspect the error before retrying. NuGet skips already published versions; npm refuses to overwrite an existing version. Fix permissions or registry access and recover the missing package explicitly rather than moving or overwriting released tags.
