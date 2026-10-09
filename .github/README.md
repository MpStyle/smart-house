# GitHub Actions: configurazione e pipeline

Il progetto usa CI e deploy distinti per **frontend**, **backend** e **infrastruttura**. La pubblicazione automatica avviene su `main`, senza approvazione manuale, solo dopo la CI riuscita per **lo stesso commit**. Non occorrono credenziali Azure per la CI.

## Workflow e attivazione

| Workflow | Attivazione | Responsabilità |
| --- | --- | --- |
| [CI Frontend](workflows/ci-frontend.yml) | Push e pull request con modifiche frontend; avvio manuale | Unit test, build, test browser desktop/mobile; artifact frontend |
| [CI Backend](workflows/ci-backend.yml) | Push e pull request con modifiche backend; avvio manuale | Test .NET, publish Release; artifact ZIP backend |
| [CI Infrastructure](workflows/ci-infrastructure.yml) | Push e pull request con modifiche infrastruttura; avvio manuale | Compilazione Bicep e parametri, senza provisioning |
| [Deploy changed sections](workflows/deploy.yml) | Push su `main` con modifiche pertinenti, dopo il bootstrap | Selezione delle sezioni, attesa della loro CI, coordinamento dei deploy |
| [Deploy Infrastructure](workflows/deploy-infrastructure.yml) | Chiamato dal coordinatore oppure manualmente da `main` | Solo creazione/aggiornamento risorse Azure |
| [Deploy Backend](workflows/deploy-backend.yml) | Chiamato dal coordinatore oppure manualmente da `main` | Solo pubblicazione API su App Service |
| [Deploy Frontend](workflows/deploy-frontend.yml) | Chiamato dal coordinatore oppure manualmente da `main` | Solo upload frontend su Storage e purge Front Door |

I deploy riutilizzabili sono file YAML separati; quando chiamati dal coordinatore, GitHub li mostra come job della sua esecuzione. Le sezioni non selezionate **non chiamano il proprio workflow di deploy**.

### Quali modifiche selezionano una sezione

| File modificati | CI e deploy pertinenti |
| --- | --- |
| `frontend/**`, esclusi `README*`; YAML CI/deploy frontend | Frontend soltanto |
| `backend/**`, esclusi `README*`; `global.json`, `SmartHouse.sln`; YAML CI/deploy backend | Backend soltanto |
| `infra/**`, esclusi `README*`; YAML CI/deploy infrastruttura | Infrastruttura soltanto |
| `.github/actions/**`, `.github/scripts/**`, `deploy.yml`, esclusi `README*` | Tutte e tre: sono implementazione condivisa delle pipeline |
| Soli `README*`, compresi i README delle sezioni | Nessuna pipeline automatica |

Il confronto del deploy è tra il commit precedente e quello finale del push: considera anche push con più commit, file eliminati e il primo push. Per esempio, una modifica a `frontend/src/App.tsx` avvia **CI Frontend** e il coordinatore, che esegue **Deploy Frontend** soltanto; non avvia CI/deploy backend o infrastruttura.

I test end-to-end sono **solo nella CI frontend**. Avviano un backend demo per verificare il browser, ma non chiamano la CI o il deploy backend. La CI backend non installa il frontend e la CI infrastruttura non esegue test applicativi.

Se cambiano più sezioni nello stesso push, il coordinatore aspetta il successo di tutte le CI selezionate e distribuisce **infrastruttura → backend → frontend**, saltando le sezioni non modificate. Un errore ferma i deploy successivi. Un aggiornamento dell'infrastruttura non ridistribuisce automaticamente il codice applicativo.

Gli artifact vengono scaricati dal run CI riuscito dello stesso SHA, senza ricostruire pacchetti diversi durante il deploy. Sono conservati per **7 giorni**. Deploy manuali o retry richiedono CI riuscita e artifact ancora disponibili per il commit selezionato; se necessario, eseguire prima la CI della sezione su `main`. Non si usa automaticamente un artifact di un commit precedente, nemmeno se l'ultimo commit modifica solo documentazione.

Le pubblicazioni della stessa sezione sono serializzate. Prima di pubblicare, il workflow rifiuta un commit superato da una modifica più recente **della stessa sezione** su `main`; una successiva modifica ai soli README non impedisce di pubblicare il codice già verificato. Il coordinamento dell'ordine riguarda le sezioni dello **stesso push**, non una transazione atomica tra più merge distinti.

## Impostazioni GitHub

Creare un repository con ramo principale **`main`** e caricare anche `.github/`. I file di workflow devono essere presenti nel ramo principale per essere disponibili in **Actions → Run workflow**.

In **Settings → Actions → General** consentire le azioni utilizzate (`actions/*`, `azure/login`) e mantenere i permessi predefiniti del token in sola lettura. I YAML richiedono esplicitamente `actions: read` per leggere CI/artifact e `id-token: write` per OIDC nei deploy.

Creare **Settings → Environments → production**:

- Non configurare required reviewers né wait timer: è il deploy automatico senza approvazione concordato.
- Limitare i deployment branch a **`main`**.
- Configurare i segreti e le variabili di produzione sotto questo environment.

Proteggere `main` con pull request e verifiche richieste adatte ai workflow filtrati. **Non rendere sempre obbligatorio un check di una sezione che può non partire**: GitHub può lasciare un check filtrato in Pending e bloccare una PR di un'altra sezione. La pubblicazione ha comunque il proprio gate per le CI effettivamente selezionate.

### Variabili

| Nome | Dove | Obbligatoria | Valore / utilizzo |
| --- | --- | --- | --- |
| `AZURE_DEPLOY_ENABLED` | **Repository → Actions variables** | Per attivare l'automazione | Stringa `true` solo **dopo** il bootstrap. Assente o diversa da `true`: CI attiva, deploy automatici disabilitati. Non metterla solo nell'environment: il coordinatore la legge prima dei job di deploy. |
| `AZURE_RESOURCE_GROUP` | Environment `production` → Variables | Sì | Gruppo di risorse dedicato, già creato; per esempio `rg-smart-house-prod` |
| `AZURE_DEPLOYMENT_NAME` | Environment `production` → Variables | No | Nome del deployment ARM che conserva gli output. Default `smart-house`; deve rimanere uguale in tutti i deploy. |
| `AZURE_APP_NAME` | Environment `production` → Variables | No | Override di `appName` rispetto a `infra/main.bicepparam`; default nel file `smart-house`. Consentire solo nomi validi per le risorse Azure generate. Non cambiarlo per un semplice aggiornamento del codice. |
| `AZURE_BUDGET_EMAILS` | Environment `production` → Variables | No | Array JSON, per esempio `["owner@example.com"]`. Default nel file `[]`: nessun avviso. |
| `AZURE_MONTHLY_BUDGET` | Environment `production` → Variables | No | Intero positivo; default nel file `100`, **nella valuta di fatturazione della sottoscrizione**. Non è un limite automatico di spesa. |
| `AZURE_BUDGET_START` | Environment `production` → Variables | Se si abilitano avvisi | Data stabile `YYYY-MM-01` consentita da Azure, per esempio `2026-10-01`. Evita di cambiare l'inizio del budget a ogni deploy. In alternativa impostare `budgetStart` nel file `.bicepparam`. |

I parametri `.bicepparam` vengono compilati e **realmente utilizzati** dalla pipeline infrastruttura. Le variabili opzionali sovrascrivono solo i parametri corrispondenti. La regione predefinita è `westeurope`; frontend e backend leggono gli output di quel deployment e non richiedono variabili separate per i nomi di Storage, App Service o Front Door.

### Segreti GitHub

In **Environment production → Secrets**:

| Nome | Valore | Pipeline |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | Application/client ID dell'identità federata Azure | Tutti i deploy |
| `AZURE_TENANT_ID` | Directory/tenant ID Microsoft Entra | Tutti i deploy |
| `AZURE_SUBSCRIPTION_ID` | ID della sottoscrizione di destinazione | Tutti i deploy |

Questi ID non sono password, ma qui vengono letti dalla configurazione Secrets per mantenere coerenti i workflow. **Non configurare `AZURE_CLIENT_SECRET` né un publish profile**: l'accesso usa OIDC.

Le credenziali Netatmo **non vanno nei segreti GitHub né nel frontend**. Devono essere nel Key Vault creato dall'infrastruttura:

| Segreto Key Vault | Contenuto |
| --- | --- |
| `netatmo-client-id` | Client ID dell'app Netatmo Connect |
| `netatmo-client-secret` | Client secret dell'app Netatmo Connect |

Il backend li usa tramite riferimenti Key Vault nelle impostazioni App Service. La pipeline backend controlla l'esistenza dei segreti senza stamparne il valore e aggiorna i riferimenti prima della pubblicazione.

## Federazione OIDC e permessi Azure

1. Creare in Microsoft Entra un'app registration e il suo service principal, oppure una user-assigned managed identity.
2. Aggiungere una federated credential per **GitHub Actions / Environment**:

| Campo | Valore |
| --- | --- |
| Issuer | `https://token.actions.githubusercontent.com` |
| Subject | `repo:<OWNER>/<REPOSITORY>:environment:production` |
| Audience | `api://AzureADTokenExchange` |

Usare owner/repository effettivi e il nome `production` esatto. Il subject è per l'environment, non `ref:refs/heads/main`, perché i job Azure dichiarano `environment: production`.

3. Creare una volta il resource group nella sottoscrizione scelta, poi assegnare all'identità CI/CD:

| Ruolo | Ambito | Motivo |
| --- | --- | --- |
| `Contributor` | Resource group dedicato | Provisioning, App Service, Front Door e lettura degli output ARM |
| `Role Based Access Control Administrator` oppure `User Access Administrator` | Resource group dedicato | Creare i role assignment del backend dichiarati in Bicep |
| `Storage Blob Data Contributor` | Resource group durante il bootstrap, oppure account frontend già creato per i deploy successivi | Abilitare static website e caricare `$web` con `--auth-mode login` |
| `Key Vault Secrets User` | Key Vault, oppure resource group per ereditarlo alla creazione | Controllare l'esistenza dei segreti nel deploy backend |

L'identità dell'operatore che inserisce le credenziali Netatmo necessita invece di `Key Vault Secrets Officer`. Non occorre assegnarlo alla pipeline. Il backend ha una propria system-assigned managed identity: Bicep le assegna accesso al keyring Blob e ai segreti/chiavi del vault.

`Contributor` da solo non concede permessi dati Storage/Key Vault né autorizza la creazione dei role assignment. Attendere la propagazione dei ruoli prima di rieseguire un bootstrap o deploy.

## Primo rilascio: bootstrap manuale

1. Lasciare `AZURE_DEPLOY_ENABLED` assente o `false`. Pubblicare il repository e i workflow su `main`: partono le CI, **non** la creazione automatica delle risorse.
2. Creare il gruppo dedicato, configurare `production`, OIDC, ruoli, variabili e segreti Azure.
3. In **Actions → Deploy Infrastructure → Run workflow**, scegliere `main` e selezionare `confirm_costs`. Questo workflow non pubblica frontend/backend e non richiede ancora i segreti Netatmo.
4. Leggere `keyVaultName` e `netatmoCallback` nel riepilogo. Registrare il callback HTTPS esatto in Netatmo Connect e inserire i due segreti Netatmo nel vault, fuori dalla chat e dal repository.
5. Dopo CI riuscita, avviare manualmente **Deploy Backend** da `main`, quindi **Deploy Frontend** da `main`. Se nel frattempo `main` è cambiato o gli artifact sono scaduti, avviare prima **CI Backend** e **CI Frontend** su quel commit.
6. Impostare la variabile **di repository** `AZURE_DEPLOY_ENABLED=true`. Da questo momento i merge su `main` pubblicano automaticamente le sole sezioni modificate. Cambiare una variabile GitHub non avvia da solo un deploy.

Il gruppo viene creato dall'operatore, non dai workflow: consente di assegnare permessi limitati al gruppo prima del provisioning. Il template applicativo può creare risorse a pagamento; l'attivazione dei deploy automatici autorizza anche gli aggiornamenti automatici Bicep senza approvazione per ogni merge.

## Retry e diagnostica

- CI fallita/cancellata o assente per il commit: il coordinatore non pubblica; correggere o rieseguire la CI e poi rieseguire il coordinatore dal run originale, oppure il deploy manuale della sezione.
- Artifact mancante/scaduto: rieseguire la CI della sezione su `main` per generare un nuovo package, poi il deploy.
- Un run CI più recente ha cambiato l'artifact mentre il coordinatore aspettava: la pipeline si ferma esplicitamente; rieseguire il deploy con il nuovo run.
- `AZURE_RESOURCE_GROUP`/output mancanti: completare il bootstrap, usando lo stesso `AZURE_DEPLOYMENT_NAME`.
- Login OIDC fallito: verificare subject dell'environment, i tre ID e permessi `id-token: write`.
- HTTP 403 Storage/Key Vault: verificare i ruoli **data-plane** e la propagazione RBAC; non abilitare shared keys per aggirare l'errore.
- Backend senza accesso Netatmo: verificare segreti e callback nel vault/portale. Il check finale richiede `authAvailable=true` e `demoAvailable=false`.
- I deploy possono essere parziali: non c'è rollback automatico di Bicep o del codice. Ispezionare il run fallito prima di riprovare.

## Verifica locale dei workflow

```bash
node --test .github/scripts/sections.test.mjs
az bicep build --file infra/main.bicep --outfile /tmp/smart-house-template.json
az bicep build-params --file infra/main.bicepparam --outfile /tmp/smart-house-parameters.json
```

I test verificano la selezione delle sezioni, l'esclusione dei README, push iniziali/multipli/eliminazioni e il gate CI per SHA, repository, ramo e risultato. Per la configurazione delle singole parti vedere [frontend](../frontend/README.md), [backend](../backend/README.md) e [infrastruttura](../infra/README.md).
