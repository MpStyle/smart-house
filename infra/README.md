# Azure infrastructure

[`main.bicep`](main.bicep) and [`main.bicepparam`](main.bicepparam) define frontend Storage, Linux B1/.NET 10 App Service, Front Door Standard, private Data Protection Storage, Key Vault, and backend RBAC. Default region: **West Europe**.

Infrastructure deployment **does not** publish frontend/backend code or enter Netatmo credentials.

## Infrastructure CI

[`ci-infrastructure.yml`](../.github/workflows/ci-infrastructure.yml) runs for `infra/` changes, its workflows, or shared pipeline implementation; README-only changes are excluded. It compiles Bicep and parameters without Azure login or resource creation.

```bash
az bicep build --file infra/main.bicep --outfile /tmp/smart-house-template.json
az bicep build-params --file infra/main.bicepparam --outfile /tmp/smart-house-parameters.json
```

## Deployment configuration

[`deploy-infrastructure.yml`](../.github/workflows/deploy-infrastructure.yml) uses compiled `.bicepparam` parameters. Optional GitHub variables override their corresponding parameters:

| Name | Location | Default / purpose |
| --- | --- | --- |
| `AZURE_DEPLOY_ENABLED` | **Repository** → Actions variables | Missing/`false` during bootstrap; `true` for subsequent automatic deployments |
| `AZURE_RESOURCE_GROUP` | `production` environment → Variables | Required: existing dedicated resource group |
| `AZURE_DEPLOYMENT_NAME` | `production` environment → Variables | `smart-house`; identifies the deployment and its outputs |
| `AZURE_APP_NAME` | `production` environment → Variables | `appName` from `.bicepparam`, initially `smart-house` |
| `AZURE_BUDGET_EMAILS` | `production` environment → Variables | `budgetEmails` from `.bicepparam`, initially `[]`; JSON array |
| `AZURE_MONTHLY_BUDGET` | `production` environment → Variables | `monthlyBudget` from `.bicepparam`, initially `100`, in subscription currency |
| `AZURE_BUDGET_START` | `production` environment → Variables | Stable `YYYY-MM-01` date when alerts are enabled; alternatively set `budgetStart` in the file |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | `production` environment → Secrets | Federated identity, tenant, and subscription IDs |

No Azure client secret or publish profile is required. Configure OIDC for `repo:<OWNER>/<REPOSITORY>:environment:production`, provisioning/RBAC assignment roles, and `Storage Blob Data Contributor` to enable the static website. Full steps: [GitHub Actions README](../.github/README.md).

`Contributor` does not authorize role assignments: add `Role Based Access Control Administrator` or `User Access Administrator` on the group. Create the group before running the workflow so roles can be scoped to it.

### Parameters

Edit `main.bicepparam` for versioned settings. Example with alerts:

```bicep
using './main.bicep'

param appName = 'smart-house'
param location = 'westeurope'
param monthlyBudget = 100
param budgetEmails = ['owner@example.com']
param budgetStart = '2026-10-01'
```

Use a start date Azure accepts for your subscription and retain it in subsequent updates. Notifications do not stop resources or guarantee the EUR 50–100/month target.

The workflow resolves `frontendWebHost`; no GitHub variable is needed. Bootstrap provisions resources, enables the static website, then completes the Front Door origin with the actual hostname. Subsequent deployments retrieve the existing hostname first, avoiding removal of the frontend route during the first pass.

## Manual bootstrap

1. Publish workflows to `main` with `AZURE_DEPLOY_ENABLED` missing/`false`.
2. Create the dedicated resource group:

```bash
az group create --name '<resource-group>' --location westeurope
```

3. Configure `production`, OIDC federation, Azure secrets, variables, and roles. Allow RBAC propagation.
4. In GitHub **Actions → Deploy Infrastructure → Run workflow**, choose `main` and select `confirm_costs`. Provisioning may incur recurring costs; it is not just validation.
5. Read the summary outputs:

| Output | Purpose |
| --- | --- |
| `frontendStorage` | Static website account |
| `apiName` | Backend App Service |
| `keyVaultName` | Vault for Netatmo secrets |
| `frontDoorProfile`, `frontDoorEndpoint` | Front Door and cache invalidation |
| `publicUrl` | App HTTPS URL |
| `netatmoCallback` | Exact redirect URI to register in Netatmo Connect |

6. Enter `netatmo-client-id` and `netatmo-client-secret` in Key Vault using an operator identity with `Key Vault Secrets Officer`. Never put them in YAML, Bicep, or chat.
7. Deploy backend and frontend manually through their workflows after successful CI for the same commit.
8. Enable repository-level `AZURE_DEPLOY_ENABLED=true`. Future infrastructure updates on `main` deploy automatically after successful CI, without manual approval.

Bootstrap does not yet check API readiness because code has not been deployed. Backend deployment performs that check; frontend deployment verifies the website.

## Updates and limits

A merge changing only `infra/` runs only infrastructure CI/deployment. A merge also changing backend/frontend follows the agreed order and publishes only changed sections. For runtime/settings updates requiring code republishing, include an application change or explicitly run its manual deployment.

Do not change resource names, resource group, or deployment name during ordinary updates: outputs are the contract used by application pipelines. Keep a single backend instance and preserve the session volume, Blob keyring, and Key Vault keys.

The Front Door health probe uses `/api/v1/health`; the callback output uses `/api/v1/auth/callback`. When upgrading an existing installation, deploy the matching infrastructure, backend, and frontend changes together and update the Netatmo app registration. Unversioned API URLs are not supported.

Confirm pricing with Azure Pricing Calculator before bootstrap. Local/CI template compilation does not establish subscription quotas, permissions, SKU availability, or runtime availability.
