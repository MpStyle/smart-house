# Frontend

Vite, React, and TypeScript dashboard with MUI, Redux Toolkit, and i18next. Published as an Azure Storage static website, reached through Front Door on the same origin as the backend.

## Organization

Pages live in `src/component/page/<Page>/<Page>.tsx`; shared components live in `src/component/common/<Component>/<Component>.tsx`. Page-specific components stay beside their page, each with a local props type. Shared models/types live in `src/entity/`, application logic and the store in `src/book/`, and API calls in `src/api/`.

Page routes are constants in `src/book/routes.ts`, shared by the router, page recognition, navigation, and redirects. `createHistoryRoute` and `createRoomRoute` build links and encode IDs. Room details use `/#/homes/:homeId/rooms/:roomId`; existing individual history routes remain available. HTTP endpoints remain separate in `src/api/`.

AppBar receives `showBack`, derived from room/history/settings routes: when true, it keeps an arrow visible on every screen size and returns to the previous internal page. With no previous router history entry, it returns to the dashboard without leaving the app. This does not use `PageActionsContext`, which is reserved for page actions such as refresh.

The sticky AppBar stays on one line, including at 600-768 px. It hides when scrolling down past the top area and reappears when scrolling up, returning to the top, changing routes, or focusing its controls with the keyboard. Reduced-motion preferences disable its transition. The home selector shows the chosen home icon and ellipsizes long names.

The account control sits at the far right, immediately after page actions. Below 900 px it shows only the user icon with a 44 x 44 px interaction area; the full identity is displayed inside the menu and remains in `title` and the accessible label. From 900 px, name and arrow are visible; long names are ellipsized.

The account button opens settings and logout. It shows the backend identity (Netatmo email when no name is available), an account label if the provider supplies neither, or "Demo" in demo mode. Language and theme are available only on `Settings`, at `/#/settings`, even without homes or when home loading fails. They occupy separate vertically stacked panels with always-visible radio buttons: three columns from 600 px and vertical options below that threshold. Preferences save automatically; translation loading disables only the language group.

Settings supports reordering rooms and measurements with drag handles, using mouse, touch, or keyboard. Measurements remain in their own rooms. Dashboard order saves automatically in `localStorage` under `smart-house.dashboardOrders`, independently per home and room, without cross-browser/device synchronization. New items follow ordered items; removed IDs are ignored. Changing homes in settings keeps the page open and changes the selected home's order.

Settings also controls visibility and icons under `smart-house.dashboardCustomizations`, scoped by home and room IDs. Hidden readings are omitted from dashboard and room details; hidden rooms and rooms without visible readings are omitted from the dashboard. All entries remain editable in Settings. Room details show cards without history before charts, preserving configured order within each group and sharing one history range across charts. Individual measurement history is unchanged.

Home and room icons offer built-in choices, upload, and reset. Upload accepts PNG/JPEG/WebP up to 2 MiB and 16 megapixels; the browser decodes, scales without upsampling to at most 128 x 128 px, and re-encodes to WebP (PNG fallback) up to 64 KiB. SVG/GIF are not accepted. Images are stored only in browser preferences, never uploaded. Saving occurs before Redux updates: quota/permission errors show an alert and preserve the last saved choices. These settings are presentation preferences, not backend access controls, and are shared by accounts using the same browser/home IDs.

Language radio buttons show decorative 24 x 18 px SVG flags beside names: United Kingdom for English, then Italy, France, Germany, Spain, and Portugal. Language names remain accessible labels. Flags are local assets in `src/assets/flags/`, from `flag-icons` 7.5.0 under its MIT license in `public/licenses/flag-icons.txt`, also included in the published build. No extra runtime dependency or external service is required.

The six languages live in `src/locales/*.json` and load on demand through `i18next-http-backend`. Vite publishes separate hashed JSON files in `dist/assets/`, compatible with existing caching/deployment; they are not embedded in the JavaScript bundle. Loaded languages are reused. If a language fails to load, the app switches to English without an on-screen warning and saves the language actually loaded; errors remain in the console. If English also fails, a minimal screen allows retrying.

Request/response `console.log` calls run only in development: they include method/URL/status and payload, redact sensitive properties, and never print authentication headers, cookies, or antiforgery tokens. Errors remain diagnosable in production.

## Generated API client

[`src/api/generated.ts`](src/api/generated.ts) is generated by `@rtk-query/codegen-openapi` from [`../openapi/smart-house.json`](../openapi/smart-house.json). Do not edit it manually. `baseApi.ts` preserves same-origin cookies, redacted logging, session-expiration handling on 401, and the existing cache policy. `api.ts` exports application hooks; API entity files re-export generated types instead of duplicating the contract.

After backend API changes, update the contract and **all** clients from the repository root:

```bash
npm ci --prefix frontend
node scripts/generate-api.mjs
```

To regenerate only frontend endpoints from an already updated contract:

```bash
cd frontend
npm run api:generate
```

Generated requests use `/api/v1/...`, including encoded path identifiers and CSRF headers for mutations. The frontend can build from versioned sources without a running backend or .NET. [CI SDK](../.github/workflows/ci-sdk.yml) rejects stale generated sources.

## Local development

From the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite uses port `5173` with `strictPort: true`; it does not silently pick a different port if occupied.

Start the [backend](../backend/README.md) on `http://localhost:5080` in another terminal. The frontend sends relative `/api/v1` requests; the development proxy forwards `/api` to the backend, avoiding CORS and keeping cookies and OAuth callbacks on the frontend origin.

### Configuring the local backend port

The target is configured in [`vite.config.ts`](vite.config.ts):

```typescript
server: {
  port: 5173,
  strictPort: true,
  proxy: {
    '/api': {
      target: 'http://localhost:5080',
      changeOrigin: false,
    },
  },
},
```

If the backend listens on **5090**, change **only the proxy target** to `http://localhost:5090` and start the backend on that port:

```bash
# From the repository root, in a separate terminal:
dotnet build backend/SmartHouse.Api
cd backend/SmartHouse.Api
ASPNETCORE_ENVIRONMENT=Development DemoMode=true \
  dotnet bin/Debug/net10.0/SmartHouse.Api.dll --urls http://localhost:5090
```

Restart `npm run dev` after changing the configuration. The browser still uses `http://localhost:5173/api/v1/...`; **do not** call `http://localhost:5090` directly from React or set `PublicOrigin` to the backend port.

Backend `PublicOrigin` must remain `http://localhost:5173`, with Netatmo local redirect URI `http://localhost:5173/api/v1/auth/callback`: these identify the browser-visible origin, not the internal proxy target.

If changing the **frontend port**, align `server.port`, `PublicOrigin`, and the Netatmo redirect URI to the new origin. If enabling HTTPS, align the scheme and certificates without disabling TLS verification.

[Playwright tests](playwright.config.ts) explicitly use frontend `5173` and backend `5080`. For custom ports, also align `use.baseURL`, `webServer` URLs/commands, and demo backend `PublicOrigin`; changing only the proxy is insufficient. Standard CI keeps the default ports.

Quick proxy check:

```bash
curl --fail http://localhost:5173/api/v1/health
# Expected response: {"status":"ok"}
```

`DemoMode=true` is optional and Development-only; its data is simulated. For real Netatmo access, start without demo and configure credentials as described in the backend README.

## Frontend CI

[`ci-frontend.yml`](../.github/workflows/ci-frontend.yml) runs for frontend changes, its workflows, or shared pipeline implementation; README-only changes are excluded.

It runs `npm ci`, Vitest, TypeScript/Vite build, and **desktop/mobile end-to-end tests**. Browser tests start a demo backend but do not run backend CI or deployment. No Azure or Netatmo secrets are required.

On `main`, it retains `frontend/dist/` in `frontend-package` for seven days, only after tests succeed. Local commands:

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Frontend deployment to Azure

[`deploy-frontend.yml`](../.github/workflows/deploy-frontend.yml) is called by the coordinator after a frontend-changing merge to `main`, or manually from `main`. It requires a successful CI artifact for **the same commit**.

| Name | Location | Requirement |
| --- | --- | --- |
| `AZURE_DEPLOY_ENABLED=true` | Repository variable | Enables automation after bootstrap |
| `AZURE_RESOURCE_GROUP` | `production` environment variable | Required |
| `AZURE_DEPLOYMENT_NAME` | `production` environment variable | Optional; defaults to `smart-house` |
| `AZURE_CLIENT_ID` | `production` environment secret | Required; federated identity |
| `AZURE_TENANT_ID` | `production` environment secret | Required |
| `AZURE_SUBSCRIPTION_ID` | `production` environment secret | Required |

Storage Account, Front Door, and public URL come from infrastructure outputs. The frontend needs no `VITE_API_URL`, Azure URL build variables, Netatmo tokens, or Storage credentials: production uses `/api/v1` on its own origin.

The pipeline downloads the verified package, uploads hashed assets with immutable caching, publishes `index.html` with `no-cache`, purges `/` and `/index.html` from Front Door, and verifies the website. It retains old assets to avoid breaking open tabs. **It does not update App Service or run Bicep.**

The OIDC identity requires ARM output read access, `Storage Blob Data Contributor` on frontend storage, and Front Door purge permissions. Full OIDC, role, and bootstrap configuration: [GitHub Actions README](../.github/README.md).
