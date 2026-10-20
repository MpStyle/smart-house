# GitHub Actions: configuration and pipelines

The project separates CI and deployment for **frontend**, **backend**, and **infrastructure**. Automatic deployment runs on `main`, without manual approval, only after successful CI for **the same commit**. CI does not require Azure credentials.

## Copilot TODO workflow

Explicitly invoke `/mp-smart-home-workflow` to process unchecked entries in root
`TODO.md` using the [project skill](skills/mp-smart-home-workflow/SKILL.md).
Creating or discussing the skill does not run it. With no open entries it does
nothing.

The workflow is entirely local: it does not access GitHub or perform remote
Git operations (including fetch, pull or push). It starts from a clean checkout
and uses the initial local branch as its fixed integration base, without
consulting or synchronizing origin. Existing GitHub links remain inert text.

Each entry gets a short descriptive English branch name, such as
`add-room-renaming`, without numbers or generated IDs, and a mandatory
`grill-me` interview with your confirmation before implementation. Agreed
English GIVEN / WHEN / THEN scenarios are recorded under the entry in TODO.md.
Install the personal `grill-me` and `grilling` skills first; they are not bundled
with this project.

The invocation authorizes sequential implementation, local commits and
automatic local fast-forward merges into the initial branch. Unit tests must
pass before every commit, along with applicable local verification. Missing
test infrastructure or non-applicable tests require your explicit decision.
Commits use English messages with `TODO: <task title>` references; the completed
implementation and checked TODO entry are committed together. After verification,
the workflow integrates the exact tested commit only if the base is unchanged.
Failures or ambiguity stop the sequence without discarding work. Existing local
work is matched by title, context and branch; branches are retained after merge.

Reload project skills in Copilot CLI with `/skills reload`, then invoke
`/mp-smart-home-workflow`. Explicit-only metadata is enabled; some Copilot
CLI/app versions have a known [manual invocation compatibility issue](https://github.com/github/copilot-cli/issues/4438).
If affected, use a compatible host/version rather than removing the
explicit-only restriction. This is an agent instruction workflow, not an
unattended GitHub Actions job; it requires an interactive host, local Git and
available local verification tools, not GitHub credentials.

## Workflows and triggers

| Workflow | Trigger | Responsibility |
| --- | --- | --- |
| [CI Frontend](workflows/ci-frontend.yml) | Push/PR with frontend changes; manual | Unit tests, build, desktop/mobile browser tests; frontend artifact |
| [CI Backend](workflows/ci-backend.yml) | Push/PR with backend/test dependency or formatting changes; manual | Formatting, .NET tests, Release publish; backend ZIP artifact |
| [CI Infrastructure](workflows/ci-infrastructure.yml) | Push/PR with infrastructure changes; manual | Bicep/parameter compilation without provisioning |
| [CI SDK](workflows/ci-sdk.yml) | Push/PR affecting contract, clients, or generators; reusable call | Regeneration drift check, SDK tests/packages, frontend compatibility |
| [Publish SDK](workflows/publish-sdk.yml) | Explicit `sdk-vX.Y.Z` tag on a commit belonging to `main` | Runs SDK verification, then publishes both SDKs to GitHub Packages |
| [Deploy changed sections](workflows/deploy.yml) | Relevant `main` push after bootstrap | Section selection, CI gating, deployment coordination |
| [Deploy Infrastructure](workflows/deploy-infrastructure.yml) | Coordinator call or manual from `main` | Azure resource creation/updates only |
| [Deploy Backend](workflows/deploy-backend.yml) | Coordinator call or manual from `main` | API publishing to App Service only |
| [Deploy Frontend](workflows/deploy-frontend.yml) | Coordinator call or manual from `main` | Frontend Storage upload and Front Door purge only |

Reusable deployments are separate YAML files; when called by the coordinator, GitHub shows them as jobs of that run. Unselected sections **do not call their deployment workflow**.

### Changes selecting a deployment section

| Changed files | Relevant CI/deployment |
| --- | --- |
| `frontend/**` except `README*`; frontend CI/deployment YAML | Frontend only |
| `backend/**` except `README*`; `global.json`, `SmartHouse.sln`; backend CI/deployment YAML | Backend only |
| `infra/**` except `README*`; infrastructure CI/deployment YAML | Infrastructure only |
| `.github/actions/**`, `.github/scripts/**`, `deploy.yml`, except `README*` | All three: shared pipeline implementation |
| Only `README*`, including section READMEs | No automatic pipeline |

Additional backend CI triggers (`sdk/csharp/**`, `openapi/**`, `.editorconfig`, and `scripts/backend-style*`) verify test dependencies/style without selecting extra Azure deployments. SDK CI has independent filters; SDK-only changes never deploy Azure resources.

Deployment compares the push's previous and final commits, including multi-commit pushes, deletions, and initial pushes. For example, changing `frontend/src/App.tsx` runs **CI Frontend** and the coordinator, which calls **Deploy Frontend** only, without backend/infrastructure CI or deployment.

End-to-end tests belong **only to frontend CI**. They start a demo backend to check the browser but do not call backend CI/deployment. Backend CI does not install the frontend; infrastructure CI does not run application tests.

For a multi-section push, the coordinator waits for every selected CI and deploys **infrastructure → backend → frontend**, skipping unchanged sections. Failure stops later deployments. Infrastructure changes alone do not redeploy application code.

Deployments download artifacts from the successful CI run for the same SHA; they do not rebuild different packages. Artifacts remain for **7 days**. Manual deployments/retries require successful CI and available artifacts for the selected commit; rerun that section's CI on `main` if necessary. An older artifact is never silently substituted, even when the newest commit changes documentation only.

Publications within a section are serialized. Before publishing, the workflow rejects a commit superseded by newer changes to **the same section** on `main`; later README-only changes do not prevent deployment of already verified code. Ordering applies to sections of **the same push**, not an atomic transaction across separate merges.

## GitHub settings

Create a repository with **`main`** as its primary branch and publish `.github/`. Workflows must exist on the primary branch to appear under **Actions → Run workflow**.

In **Settings → Actions → General**, allow the actions used (`actions/*`, `azure/login`) and keep default token permissions read-only. Deployment YAML explicitly requests `actions: read` for CI/artifacts and `id-token: write` for OIDC. SDK publication separately requests `packages: write`; repository/organization policy must allow it, and existing packages must grant this repository Actions access. See [SDK releases](../sdk/README.md#release-to-github-packages).

Create **Settings → Environments → production**:

- Do not configure required reviewers or wait timers: deployment is automatic without approval.
- Restrict deployment branches to **`main`**.
- Put production variables and secrets in this environment.

Protect `main` with pull requests and checks appropriate for path-filtered workflows. **Do not make a section check universally required when it may not run**: GitHub can leave filtered checks Pending and block unrelated PRs. Publication still gates the CI runs actually selected.

### Variables

| Name | Location | Required | Value / purpose |
| --- | --- | --- | --- |
| `AZURE_DEPLOY_ENABLED` | **Repository → Actions variables** | To enable automation | String `true` only **after** bootstrap. Missing/other values: CI enabled, automatic deployment disabled. Do not set it only in the environment: the coordinator reads it before deployment jobs. |
| `AZURE_RESOURCE_GROUP` | `production` environment → Variables | Yes | Existing dedicated resource group, e.g. `rg-smart-house-prod` |
| `AZURE_DEPLOYMENT_NAME` | `production` environment → Variables | No | ARM deployment/output name; defaults to `smart-house` and must remain stable |
| `AZURE_APP_NAME` | `production` environment → Variables | No | Overrides `.bicepparam` `appName`, initially `smart-house`. Use valid generated resource names; do not change for ordinary code updates. |
| `AZURE_BUDGET_EMAILS` | `production` environment → Variables | No | JSON array, e.g. `["owner@example.com"]`. Default `[]`: no alerts. |
| `AZURE_MONTHLY_BUDGET` | `production` environment → Variables | No | Positive integer, initially `100`, **in the billing subscription's currency**. Not an automatic spending limit. |
| `AZURE_BUDGET_START` | `production` environment → Variables | With alerts | Stable subscription-supported `YYYY-MM-01`, e.g. `2026-10-01`. Do not reset on each deployment. Alternatively set `.bicepparam` `budgetStart`. |

Compiled `.bicepparam` values are **actually used** by infrastructure deployment; optional variables override corresponding parameters. The default region is `westeurope`; frontend/backend read that deployment's outputs and need no separate Storage, App Service, or Front Door name variables.

### GitHub secrets

In **Environment production → Secrets**:

| Name | Value | Pipeline |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | Azure federated identity application/client ID | All deployments |
| `AZURE_TENANT_ID` | Microsoft Entra directory/tenant ID | All deployments |
| `AZURE_SUBSCRIPTION_ID` | Target subscription ID | All deployments |

These IDs are not passwords but are read from Secrets for consistent workflow configuration. **Do not configure `AZURE_CLIENT_SECRET` or a publish profile**: authentication uses OIDC.

Netatmo credentials belong **neither in GitHub secrets nor in the frontend**. Put them in the infrastructure's Key Vault:

| Key Vault secret | Contents |
| --- | --- |
| `netatmo-client-id` | Netatmo Connect application client ID |
| `netatmo-client-secret` | Netatmo Connect application client secret |

The backend uses App Service Key Vault references. Backend deployment checks that secrets exist without printing their values and refreshes references before publication.

## OIDC federation and Azure permissions

1. Create a Microsoft Entra app registration and service principal, or a user-assigned managed identity.
2. Add a **GitHub Actions / Environment** federated credential:

| Field | Value |
| --- | --- |
| Issuer | `https://token.actions.githubusercontent.com` |
| Subject | `repo:<OWNER>/<REPOSITORY>:environment:production` |
| Audience | `api://AzureADTokenExchange` |

Use the actual owner/repository and exact `production` name. The subject targets the environment, not `ref:refs/heads/main`, because Azure jobs declare `environment: production`.

3. Create the resource group once in the chosen subscription, then assign the CI/CD identity:

| Role | Scope | Reason |
| --- | --- | --- |
| `Contributor` | Dedicated resource group | Provisioning, App Service, Front Door, ARM output reads |
| `Role Based Access Control Administrator` or `User Access Administrator` | Dedicated resource group | Backend role assignments declared in Bicep |
| `Storage Blob Data Contributor` | Group at bootstrap, or existing frontend account for later deployments | Enable static website and upload `$web` with `--auth-mode login` |
| `Key Vault Secrets User` | Key Vault, or group to inherit at creation | Check secret existence during backend deployment |

The operator entering Netatmo credentials instead needs `Key Vault Secrets Officer`; the pipeline does not need this role. The backend uses its own system-assigned managed identity with Bicep-assigned access to the Blob keyring and vault secrets/keys.

`Contributor` alone grants neither Storage/Key Vault data-plane access nor role assignment permissions. Wait for role propagation before retrying bootstrap/deployment.

## First release: manual bootstrap

1. Leave `AZURE_DEPLOY_ENABLED` missing or `false`. Publish the repository/workflows to `main`: CI runs, **automatic resource creation does not**.
2. Create the dedicated group; configure `production`, OIDC, roles, variables, and Azure secrets.
3. In **Actions → Deploy Infrastructure → Run workflow**, choose `main` and select `confirm_costs`. This publishes neither application and does not yet need Netatmo secrets.
4. Read `keyVaultName` and `netatmoCallback` in the summary. Register the exact HTTPS callback in Netatmo Connect and enter both Netatmo secrets in the vault, outside chat/repository.
5. After successful CI, manually run **Deploy Backend** from `main`, then **Deploy Frontend**. If `main` changed or artifacts expired, first run both application CI workflows for that commit.
6. Set the **repository** variable `AZURE_DEPLOY_ENABLED=true`. Subsequent merges publish only changed sections automatically. Changing a GitHub variable does not trigger deployment itself.

The operator, not a workflow, creates the group so roles can be restricted to it before provisioning. The application template can create paid resources; enabling automatic deployments also authorizes automatic Bicep updates without per-merge approval.

## Retry and diagnostics

- CI failed/canceled/missing for the commit: no publication. Fix/rerun CI, then rerun the original coordinator or the section's manual deployment.
- Artifact missing/expired: rerun section CI on `main` to create a new package, then deploy.
- A newer CI run replaced the artifact while the coordinator waited: deployment stops explicitly; retry with the newer run.
- Missing `AZURE_RESOURCE_GROUP`/outputs: complete bootstrap using the same `AZURE_DEPLOYMENT_NAME`.
- OIDC login failure: verify the environment subject, three IDs, and `id-token: write`.
- Storage/Key Vault HTTP 403: verify **data-plane** roles and RBAC propagation; do not enable shared keys to bypass the failure.
- Backend cannot access Netatmo: verify vault credentials and portal callback. The final check requires `authAvailable=true` and `demoAvailable=false`.
- Deployments can be partial: there is no automatic Bicep/code rollback. Inspect the failed run before retrying.

## Local workflow verification

```bash
node --test .github/scripts/sections.test.mjs scripts/backend-style.test.mjs
az bicep build --file infra/main.bicep --outfile /tmp/smart-house-template.json
az bicep build-params --file infra/main.bicepparam --outfile /tmp/smart-house-parameters.json
```

Tests verify section selection, README exclusion, initial/multi-commit/deletion pushes, and CI gating by SHA, repository, branch, and result. Section configuration: [frontend](../frontend/README.md), [backend](../backend/README.md), and [infrastructure](../infra/README.md).
