# Frontend

Dashboard Vite, React e TypeScript con MUI, Redux Toolkit e i18next. Pubblicata come sito statico su Azure Storage, raggiungibile tramite Front Door sullo stesso origin del backend.

## Organizzazione

Le pagine sono in `src/component/page/<Pagina>/<Pagina>.tsx`; i componenti condivisi in `src/component/common/<Componente>/<Componente>.tsx`. I componenti specifici di una pagina rimangono nella sua cartella, ciascuno con un tipo locale per le props. I modelli e i tipi condivisi sono in `src/entity/`, la logica e lo store in `src/book/`, le chiamate API in `src/api/`.

Le sei lingue sono definite in `src/locales/*.json` e caricate su richiesta tramite `i18next-http-backend`. Vite pubblica JSON separati con nome hashed sotto `dist/assets/`, compatibili con la cache e il deploy esistenti; non sono incorporati nel bundle JavaScript. Le lingue già caricate vengono riutilizzate. Se una lingua non si carica, l'app passa all'inglese senza avviso a schermo e salva la lingua effettivamente caricata; gli errori rimangono in console. Se anche l'inglese non è disponibile, una schermata essenziale permette di riprovare.

I `console.log` di request e response sono attivi solo in sviluppo: includono metodo/URL/stato e payload, oscurano le proprietà sensibili e non stampano header di autenticazione, cookie o token anti-CSRF. Gli errori rimangono diagnosticabili anche in produzione.

## Esecuzione locale

Dalla radice del repository:

```bash
cd frontend
npm ci
npm run dev
```

Aprire <http://localhost:5173>. Vite usa porta `5173` con `strictPort: true`: se occupata, non sceglie silenziosamente una porta diversa.

Avviare anche il [backend](../backend/README.md) su `http://localhost:5080`, in un altro terminale. Il frontend invia richieste relative a `/api`; il proxy di sviluppo le inoltra al backend, evitando CORS e mantenendo cookie e callback OAuth sull'origin del frontend.

### Configurare la porta del backend locale

Il target è configurato in [`vite.config.ts`](vite.config.ts):

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

Se il backend ascolta, per esempio, su **5090**, modificare **solo il target del proxy** in `http://localhost:5090` e avviare il backend sulla stessa porta:

```bash
# Dalla radice, in un terminale separato:
dotnet build backend/SmartHouse.Api
cd backend/SmartHouse.Api
ASPNETCORE_ENVIRONMENT=Development DemoMode=true \
  dotnet bin/Debug/net10.0/SmartHouse.Api.dll --urls http://localhost:5090
```

Riavviare `npm run dev` dopo la modifica. Il browser continua a usare `http://localhost:5173/api/...`; **non** chiamare direttamente `http://localhost:5090` dal codice React e **non** impostare `PublicOrigin` alla porta del backend.

`PublicOrigin` nel backend deve restare `http://localhost:5173`, e il redirect URI locale Netatmo `http://localhost:5173/api/auth/callback`: sono l'origin visibile al browser, non la destinazione interna del proxy.

Se si cambia invece la **porta frontend**, allineare `server.port`, `PublicOrigin` e redirect URI Netatmo al nuovo origin. Se si abilita HTTPS, allineare anche protocollo e certificati senza disabilitare la verifica TLS.

I [test Playwright](playwright.config.ts) usano esplicitamente frontend `5173` e backend `5080`. Per eseguirli con porte personalizzate, allineare anche `use.baseURL`, URL/command dei `webServer` e `PublicOrigin` del backend demo; non basta modificare il proxy. La configurazione standard della CI continua a utilizzare le porte predefinite.

Verifica rapida del proxy:

```bash
curl --fail http://localhost:5173/api/health
# Risposta attesa: {"status":"ok"}
```

`DemoMode=true` è facoltativo e solo per Development; i dati demo sono simulati. Per Netatmo reale, avviare il backend senza demo e configurare i segreti come descritto nel suo README.

## CI frontend

[`ci-frontend.yml`](../.github/workflows/ci-frontend.yml) parte solo per modifiche frontend o ai suoi workflow, oltre alle parti condivise delle pipeline; i soli README sono esclusi.

Esegue `npm ci`, Vitest, build TypeScript/Vite e **test end-to-end desktop/mobile**. I test browser avviano il backend demo, ma non eseguono la CI o il deploy backend. Non sono richiesti segreti Azure o Netatmo.

Su `main` conserva `frontend/dist/` nell'artifact `frontend-package` per sette giorni, solo dopo il successo dei test. Comandi locali:

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Deploy frontend su Azure

[`deploy-frontend.yml`](../.github/workflows/deploy-frontend.yml) viene chiamato dal coordinatore dopo un merge su `main` che cambia il frontend; può anche essere avviato manualmente da `main`. Richiede un artifact CI riuscito **dello stesso commit**.

Configurazione GitHub:

| Nome | Posizione | Necessità |
| --- | --- | --- |
| `AZURE_DEPLOY_ENABLED=true` | Variabile di repository | Solo per attivare l'automazione dopo il bootstrap |
| `AZURE_RESOURCE_GROUP` | Variabile environment `production` | Obbligatoria |
| `AZURE_DEPLOYMENT_NAME` | Variabile environment `production` | Opzionale; default `smart-house` |
| `AZURE_CLIENT_ID` | Segreto environment `production` | Obbligatorio, identità federata |
| `AZURE_TENANT_ID` | Segreto environment `production` | Obbligatorio |
| `AZURE_SUBSCRIPTION_ID` | Segreto environment `production` | Obbligatorio |

Storage Account, Front Door e URL vengono letti dagli output del bootstrap infrastruttura. Non occorrono `VITE_API_URL`, variabili di build con URL Azure, token Netatmo o credenziali Storage nel frontend: in produzione il browser usa sempre `/api` sul proprio origin.

La pipeline scarica il package verificato, carica asset hashed con cache immutabile, pubblica `index.html` con `no-cache`, invalida `/` e `/index.html` su Front Door e verifica il sito. Conserva asset precedenti per non rompere tab aperte. **Non aggiorna App Service né esegue Bicep.**

L'identità OIDC richiede lettura degli output ARM, `Storage Blob Data Contributor` sullo storage frontend e permessi Front Door per il purge. Configurazione completa di OIDC, ruoli e bootstrap: [README GitHub Actions](../.github/README.md).
