# Infrastruttura Azure

[`main.bicep`](main.bicep) e [`main.bicepparam`](main.bicepparam) definiscono Storage frontend, App Service Linux B1/.NET 10, Front Door Standard, Storage privato per Data Protection, Key Vault e RBAC del backend. Regione predefinita: **West Europe**.

Il deploy infrastruttura **non** pubblica frontend o backend e non inserisce credenziali Netatmo.

## CI infrastruttura

[`ci-infrastructure.yml`](../.github/workflows/ci-infrastructure.yml) si attiva solo per cambiamenti a `infra/`, ai propri workflow o all'implementazione condivisa delle pipeline; i soli README sono esclusi. Compila Bicep e parametri senza Azure login né creazione di risorse.

```bash
az bicep build --file infra/main.bicep --outfile /tmp/smart-house-template.json
az bicep build-params --file infra/main.bicepparam --outfile /tmp/smart-house-parameters.json
```

## Configurazione del deploy

[`deploy-infrastructure.yml`](../.github/workflows/deploy-infrastructure.yml) usa i parametri compilati dal file `.bicepparam`. Le variabili GitHub opzionali sovrascrivono i relativi parametri:

| Nome | Posizione | Default / uso |
| --- | --- | --- |
| `AZURE_DEPLOY_ENABLED` | **Repository** → Actions variables | Assente/`false` durante bootstrap, `true` per deploy automatici successivi |
| `AZURE_RESOURCE_GROUP` | Environment `production` → Variables | Obbligatoria: gruppo esistente e dedicato |
| `AZURE_DEPLOYMENT_NAME` | Environment `production` → Variables | `smart-house`; identifica il deployment e i suoi output |
| `AZURE_APP_NAME` | Environment `production` → Variables | `appName` da `.bicepparam`, inizialmente `smart-house` |
| `AZURE_BUDGET_EMAILS` | Environment `production` → Variables | `budgetEmails` da `.bicepparam`, inizialmente `[]`; array JSON |
| `AZURE_MONTHLY_BUDGET` | Environment `production` → Variables | `monthlyBudget` da `.bicepparam`, inizialmente `100`, valuta della sottoscrizione |
| `AZURE_BUDGET_START` | Environment `production` → Variables | Se si abilitano avvisi, data stabile `YYYY-MM-01`; alternativa: parametro `budgetStart` nel file |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Environment `production` → Secrets | ID dell'identità federata, tenant e sottoscrizione |

Non occorrono client secret Azure o publish profile. Configurare OIDC per `repo:<OWNER>/<REPOSITORY>:environment:production`, e ruoli di provisioning/assegnazione RBAC più `Storage Blob Data Contributor` per abilitare il sito statico. Passaggi completi: [README GitHub Actions](../.github/README.md).

`Contributor` non autorizza l'assegnazione dei ruoli: aggiungere `Role Based Access Control Administrator` o `User Access Administrator` sul gruppo. Creare il gruppo prima di avviare il workflow per poter limitare i ruoli a quell'ambito.

### Parametri

Per le impostazioni versionate modificare `main.bicepparam`. Un esempio con avvisi:

```bicep
using './main.bicep'

param appName = 'smart-house'
param location = 'westeurope'
param monthlyBudget = 100
param budgetEmails = ['owner@example.com']
param budgetStart = '2026-10-01'
```

Usare una data di inizio accettata da Azure nella propria sottoscrizione e conservarla nei successivi aggiornamenti. Le notifiche non spengono risorse né garantiscono il budget obiettivo 50–100 €/mese.

`frontendWebHost` è risolto dal workflow: non occorre configurarlo in GitHub. Al bootstrap viene eseguito un primo provisioning, si abilita static website e si completa l'origin Front Door con l'hostname effettivo. Nei deploy successivi il workflow recupera prima l'hostname esistente, evitando di rimuovere la route frontend durante il primo passaggio.

## Bootstrap manuale

1. Pubblicare i workflow su `main` lasciando `AZURE_DEPLOY_ENABLED` assente/`false`.
2. Creare il gruppo dedicato:

```bash
az group create --name '<resource-group>' --location westeurope
```

3. Configurare environment `production`, federazione OIDC, segreti Azure, variabili e ruoli. Attendere la propagazione RBAC.
4. In GitHub **Actions → Deploy Infrastructure → Run workflow**, scegliere `main` e spuntare `confirm_costs`. Il provisioning può generare costi ricorrenti; non è una semplice validazione.
5. Leggere nel riepilogo gli output:

| Output | Uso |
| --- | --- |
| `frontendStorage` | Account del sito statico |
| `apiName` | App Service backend |
| `keyVaultName` | Vault in cui inserire i segreti Netatmo |
| `frontDoorProfile`, `frontDoorEndpoint` | Front Door e invalidazione cache |
| `publicUrl` | URL HTTPS dell'app |
| `netatmoCallback` | Redirect URI esatto da registrare in Netatmo Connect |

6. Inserire `netatmo-client-id` e `netatmo-client-secret` in Key Vault con un'identità operatore `Key Vault Secrets Officer`. Non inserirli nei YAML, in Bicep o in chat.
7. Distribuire manualmente backend e frontend dai relativi workflow, dopo CI riuscita sullo stesso commit.
8. Abilitare `AZURE_DEPLOY_ENABLED=true` a livello repository. Gli aggiornamenti infrastruttura su `main` saranno quindi automatici, senza approvazione, dopo CI riuscita.

Il bootstrap non verifica ancora la readiness dell'API: il codice non è stato pubblicato. Questa verifica appartiene al deploy backend, mentre il deploy frontend controlla il sito.

## Aggiornamenti e limiti

Un merge che modifica solo `infra/` esegue solo CI/deploy infrastruttura. Un merge che modifica anche backend/frontend mantiene l'ordine concordato e pubblica solo le sezioni cambiate. Per un aggiornamento runtime o di impostazioni che richiede una nuova pubblicazione del codice, includere anche la modifica applicativa o eseguire esplicitamente il relativo deploy manuale.

Non cambiare nomi, resource group o deployment name durante un aggiornamento ordinario: gli output sono il contratto usato dalle pipeline applicative. Mantenere una sola istanza backend e preservare volume sessioni, keyring Blob e chiavi Key Vault.

Confermare il costo con Azure Pricing Calculator prima del bootstrap. La compilazione locale/CI del template non dimostra che la propria sottoscrizione abbia quote, permessi, SKU o runtime disponibili.
