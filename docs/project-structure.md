# Project structure

The root [`README.md`](../README.md) covers startup, behavior, deployment, and verification. [`architecture.md`](architecture.md) explains the components and login/API flow. [`TODO.md`](../TODO.md) tracks requested work; `SmartHouse.sln` groups the backend, backend tests, and C# SDK.

| Directory | Contents |
| --- | --- |
| `.config/` | Local .NET tool manifest, including the pinned NSwag generator. |
| `.github/actions/` | Shared composite actions for Azure targets, CI artifacts, and current release checks. |
| `.github/scripts/` | Deployment section selection and its tests. |
| `.github/workflows/` | Separate frontend/backend/infrastructure/SDK CI, coordinated Azure deployments, and explicit tagged SDK publication. |
| `backend/SmartHouse.Api/` | ASP.NET Core application, startup in `Program.cs`, configuration defaults, and project dependencies. |
| `backend/SmartHouse.Api/Controllers/` | Versioned Minimal API endpoint mapping modules for auth, homes, readings, history, and health. |
| `backend/SmartHouse.Api/BusinessModels/` | Provider adapter, discovery/snapshot/history logic, measurement conversions/parsing, session encryption/locking, cleanup, and demo data. |
| `backend/SmartHouse.Api/Entities/` | Internal records and public API response models. Internal tokens and provider history sources are not exposed in API responses. |
| `backend/SmartHouse.Api/Repositories/` | SQLite persistence for encrypted session and cache payloads. |
| `backend/SmartHouse.Api.Tests/` | Unit, integration, token/session, OpenAPI, and generated-client tests using an isolated API host. |
| `frontend/` | Vite, TypeScript, package manifests, API generation, and Playwright configuration. |
| `frontend/src/api/` | Generated RTK Query endpoints/types plus handwritten base-query behavior, hook exports, and redacted logging. |
| `frontend/src/book/` | Redux store, preferences, ordering/visibility/image processing, routing, translation loading, and shared hooks/helpers. |
| `frontend/src/component/common/` | Shared application shell, authentication, app bar/account menu, icons, page actions, loading, and error components. |
| `frontend/src/component/page/` | Login, dashboard, room details, individual history, and Settings, with page-specific components beside each page. |
| `frontend/src/entity/` | Application state and UI types; API model files re-export generated contract types. |
| `frontend/src/locales/` | English, Italian, French, German, Spanish, and Portuguese translation JSON, loaded on demand. |
| `frontend/src/assets/flags/` | Local decorative language flags. |
| `frontend/src/test/` | Vitest and Testing Library unit/component/API tests and setup. |
| `frontend/e2e/` | Playwright desktop/mobile browser scenarios, including responsive navigation, room history, local personalization, and upload limits. |
| `frontend/public/licenses/` | Attribution distributed with the frontend. |
| `infra/` | Azure Bicep template, deployment parameters, and infrastructure setup instructions. |
| `openapi/` | Versioned backend API contract exported during builds. |
| `scripts/` | API/client regeneration and backend style checks with tests. |
| `sdk/` | NSwag configuration and shared SDK usage/release instructions. |
| `sdk/csharp/` | .NET SDK project targeting .NET 8+, with NSwag-generated sources in `Generated/`. |
| `sdk/typescript/` | Independent Fetch SDK, generated `src/client.ts`, package/build configuration, and behavior tests in `test/`. |
| `docs/` | Architecture and repository structure documentation. |
| `docs/images/` | Dashboard screenshot captured using simulated demo data only. |

## Generated and local-only directories

Build output and dependencies such as `bin/`, `obj/`, `frontend/dist/`, `node_modules/`, and TypeScript SDK `dist/` are not source directories. Do not manually edit generated SDK sources or `frontend/src/api/generated.ts`; use the root generation script.

The backend's default `.local/` directory contains sensitive local SQLite sessions and Data Protection keys. Its location can be overridden with `DataDirectory`. It must not be committed or used as documentation/demo content. Editor metadata and temporary browser reports are not part of the application architecture.
