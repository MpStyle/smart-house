# Backend

API ASP.NET Core 10 in [`SmartHouse.Api`](SmartHouse.Api/), con test in [`SmartHouse.Api.Tests`](SmartHouse.Api.Tests/). OAuth Netatmo, token cifrati solo lato server, sessioni persistenti di sette giorni, misure e storico autorizzati per account.

I modelli sono separati in `Entities/`, ogni endpoint Minimal API ha un file in `Controllers/`, la logica applicativa è in `BusinessModels/` e l'accesso SQLite in `Repositories/`. `Program.cs` conserva configurazione, dependency injection, autenticazione e middleware; URL, cookie e struttura del database restano invariati.

Le misure includono `status` (`fresh`, `stale`, `unavailable`) e `updateFailed`. Il timestamp del campione governa la freschezza (30 minuti) e la disponibilità dell'ultimo valore (48 ore), non l'ora del recupero. I guasti transitori conservano valori e timestamp della cache con avvisi; errori di autenticazione o permessi non vengono convertiti in risposte riuscite dalla cache.

## Avvio locale

Dalla radice, con .NET SDK 10 aggiornato:

```bash
dotnet build backend/SmartHouse.Api
cd backend/SmartHouse.Api
ASPNETCORE_ENVIRONMENT=Development DemoMode=true \
  dotnet bin/Debug/net10.0/SmartHouse.Api.dll --urls http://localhost:5080
```

Il frontend va eseguito separatamente su `http://localhost:5173`. `DemoMode=true` abilita soltanto dati simulati e non è consentito in produzione.

Per cambiare porta usare, per esempio, `--urls http://localhost:5090` e aggiornare il target del proxy Vite come descritto nel [README frontend](../frontend/README.md#configurare-la-porta-del-backend-locale). `PublicOrigin` è sempre l'origin **frontend** visibile al browser, non l'URL interno del backend.

Il file opzionale `appsettings.Local.json` sovrascrive i JSON standard; variabili d'ambiente e argomenti della riga di comando hanno precedenza sulle impostazioni locali. Non inserire segreti nei file versionati.

### Accesso Netatmo reale

Registrare l'app Netatmo Connect con scope `read_station` e `read_thermostat`, e callback locale `http://localhost:5173/api/auth/callback`, se consentita dal portale. Configurare dal terminale locale:

```bash
# Dalla radice:
dotnet user-secrets set 'Netatmo:ClientId' '<client-id>' --project backend/SmartHouse.Api
dotnet user-secrets set 'Netatmo:ClientSecret' '<client-secret>' --project backend/SmartHouse.Api
```

Riavviare il backend in Development **senza** `DemoMode=true`. Non condividere credenziali/token in chat e non inserirli in `appsettings.json` o nel frontend.

## CI backend

[`ci-backend.yml`](../.github/workflows/ci-backend.yml) parte per modifiche sotto `backend/`, a `global.json`/`SmartHouse.sln`, ai propri workflow o all'implementazione condivisa delle pipeline. I soli README non la avviano.

Esegue test .NET, publish Release e ZIP dell'API. Non installa il frontend, non esegue Playwright e non usa Azure. Su `main` conserva `backend-package` con `api.zip` per sette giorni.

```bash
dotnet test backend/SmartHouse.Api.Tests --configuration Release
dotnet publish backend/SmartHouse.Api --configuration Release
```

## Deploy backend su Azure

[`deploy-backend.yml`](../.github/workflows/deploy-backend.yml) pubblica su App Service solo il package CI riuscito **dello stesso commit** su `main`. È richiamato automaticamente per modifiche backend e può essere eseguito manualmente dopo il bootstrap.

| Nome | Posizione | Necessità |
| --- | --- | --- |
| `AZURE_DEPLOY_ENABLED=true` | Variabile di repository | Attivazione automatica, dopo il bootstrap |
| `AZURE_RESOURCE_GROUP` | Variabile environment `production` | Obbligatoria |
| `AZURE_DEPLOYMENT_NAME` | Variabile environment `production` | Opzionale; default `smart-house` |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Segreti environment `production` | Obbligatori per OIDC |
| `netatmo-client-id`, `netatmo-client-secret` | **Segreti Azure Key Vault**, non GitHub | Obbligatori prima del primo deploy API |

Nomi App Service/vault e URL pubblico vengono letti dagli output dell'infrastruttura. La pipeline verifica l'esistenza dei segreti, aggiorna i riferimenti Key Vault, distribuisce lo ZIP e controlla `/api/health` e `/api/auth/session` tramite Front Door. Deve risultare `authAvailable=true` e `demoAvailable=false`.

**Non crea risorse Azure e non pubblica il frontend.** Per il primo rilascio, completare prima il [bootstrap infrastruttura](../infra/README.md) e configurare il callback HTTPS in Netatmo.

L'identità di deploy richiede permessi di pubblicazione su App Service, lettura degli output ARM e `Key Vault Secrets User`. L'identità runtime del backend è distinta e configurata da Bicep. OIDC e ruoli: [README GitHub Actions](../.github/README.md).

## Configurazione runtime su Azure

Le impostazioni seguenti sono predisposte da Bicep, **non** sono ulteriori variabili da inserire in GitHub:

| Impostazione App Service | Uso |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT=Production` | Runtime produzione |
| `PublicOrigin` | URL HTTPS Front Door; origin di cookie e callback |
| `FrontDoorId` | Verifica del Front Door autorizzato |
| `DataDirectory=/home/data/smart-house` | SQLite persistente delle sessioni/cache |
| `DataProtection__BlobUri` | Keyring persistente su Blob privato |
| `DataProtection__KeyUri` | Chiave di cifratura Key Vault |
| `Netatmo__ClientId`, `Netatmo__ClientSecret` | Riferimenti ai segreti Key Vault |
| `WEBSITES_ENABLE_APP_SERVICE_STORAGE=true` | Persistenza del volume App Service |

Mantenere una sola istanza B1 nella prima beta: SQLite e lock in-process non sono progettati per scale-out. Non impostare `DemoMode=true` in produzione.
