# Smart House

Dashboard Netatmo in sola lettura: misurazioni per casa e stanza, storico dedicato e accesso tramite account Netatmo. Frontend React/TypeScript, Redux Toolkit, MUI e i18next; backend ASP.NET Core 10. Lingue: italiano, inglese, francese, tedesco, spagnolo e portoghese.

## Avvio locale

Prerequisiti: .NET SDK 10 aggiornato e Node.js 20.14 o successivo (Node 22 consigliato). La modalità demo è **esplicita**, usa dati simulati e non può essere abilitata in produzione.

Da due terminali, nella radice del progetto:

```bash
dotnet build backend/SmartHouse.Api
cd backend/SmartHouse.Api
ASPNETCORE_ENVIRONMENT=Development DemoMode=true \
  dotnet bin/Debug/net10.0/SmartHouse.Api.dll --urls http://localhost:5080
```

```bash
cd frontend
npm ci
npm run dev
```

Aprire <http://localhost:5173> e selezionare **Esplora la demo**. Anche la demo richiede una sessione: non mostra dati prima dell'accesso. Include un termostato, una stazione con moduli meteo, valori scaduti e grafici. In questa modalità nessuna chiamata viene inviata a Netatmo.

### Collegamento a dispositivi reali

1. Registrare un'app dedicata su [Netatmo Connect](https://dev.netatmo.com/apps), abilitando esclusivamente `read_station` e `read_thermostat`. Verificare che l'app possa autorizzare utenti esterni prima di pubblicizzare la beta.
2. Configurare come redirect URI locale `http://localhost:5173/api/auth/callback`, se consentito dal portale Netatmo. Se è richiesto HTTPS, usare un origin locale HTTPS attendibile e aggiornare `PublicOrigin` e il proxy Vite di conseguenza.
3. Inserire i segreti **nel terminale locale**, mai in chat, nel frontend o nel repository:

```bash
dotnet user-secrets set 'Netatmo:ClientId' '<client-id>' --project backend/SmartHouse.Api
dotnet user-secrets set 'Netatmo:ClientSecret' '<client-secret>' --project backend/SmartHouse.Api
```

4. Riavviare il backend con `ASPNETCORE_ENVIRONMENT=Development`, senza `DemoMode=true`, e usare **Accedi con Netatmo**. Il proxy Vite mantiene frontend, callback OAuth e API sullo stesso origin. Le credenziali mancanti disabilitano il pulsante; non attivano automaticamente la demo.

Le sessioni durano sette giorni **assoluti**, senza rinnovo della durata al refresh. I cookie contengono solo l'identificatore opaco della sessione; access e refresh token rimangono cifrati sul backend. Il logout elimina sessione e cache. I dati locali sono in `backend/SmartHouse.Api/.local/` (oppure nel percorso `DataDirectory` configurato).

## Comportamento dei dati

- Termostato Intelligente classico `NATherm1` con relè; Weather Station, modulo esterno, moduli interni aggiuntivi, pluviometro e anemometro.
- Associazione Weather Station alla casa tramite il suo `home_id` esplicito. In sua assenza la stazione è una **casa separata**, anche se il nome coincide con quello di un'altra casa. Non si deducono associazioni da nomi o posizione.
- Nella stessa casa i nomi delle stanze/moduli coincidono ignorando maiuscole e spazi alle estremità. Ogni misura mantiene la propria provenienza; due temperature non vengono mediate.
- Vengono mostrati i valori numerici ambientali documentati: temperatura, umidità, CO₂, rumore, pressione/pressione assoluta, minime/massime giornaliere, pioggia e accumuli, vento e raffiche con relative direzioni. Nessun comando, setpoint, batteria o stato del riscaldamento.
- `homestatus` non documenta un timestamp della temperatura istantanea del termostato. Per non inventare la freschezza, la temperatura del termostato è **l'ultimo campione disponibile a 30 minuti da `getroommeasure`**, contrassegnato nell'interfaccia. Non è spacciato per una lettura istantanea. L'API fornisce uno storico della stanza; questa versione supporta il classico termostato della stanza, non attribuisce temperature aggregate a più termostati distinti.
- I valori mancanti, irraggiungibili o più vecchi di 30 minuti sono **Non disponibile**. La scadenza è verificata anche sul client mentre la pagina resta aperta o torna visibile, senza richieste di rete.
- Recupero all'apertura e manuale; nessun polling. La cache backend per sessione/casa dura un minuto e sopravvive al riavvio. Richieste concorrenti vengono accorpate. La topologia e la risposta meteo vengono condivise tra le case della stessa sessione per ridurre le chiamate. Un tentativo fallito di discovery viene ugualmente limitato per un minuto.
- Grafici: 6 ore iniziali, 6/12/24/48 ore, risoluzione 30 minuti, timestamp reali e fuso della casa. I buchi non vengono interpolati. Le unità vengono convertite nello stesso modo per valori e storico, usando le preferenze Netatmo e ripiego metrico.
- Il grafico **Pioggia** usa `sum_rain`, cioè l'accumulo in ciascun intervallo di 30 minuti, non la lettura istantanea. Accumuli correnti di 1/24 ore, pressione assoluta ed estremi giornalieri non hanno collegamenti a uno storico diverso dalla loro semantica.
- Lo storico si recupera da Netatmo; non si costruisce un archivio proprietario. Le risposte dei grafici sono conservate solo in memoria per un minuto.
- Errori e risultati parziali sono visibili. Un guasto totale del provider non è presentato come un account senza dispositivi. Accessi a case e misure non appartenenti alla sessione restituiscono 404.
- Preferenze di lingua, tema e ultima casa vengono salvate nel browser; nessun dato di dispositivi o token è salvato in `localStorage`. Routing con hash per aprire direttamente le pagine dello storico su Storage static website.

### Endpoint

| Endpoint | Uso |
| --- | --- |
| `GET /api/auth/session` | Stato di accesso e token anti-CSRF; nessun token Netatmo |
| `GET /api/auth/login` | Avvio OAuth Netatmo |
| `GET /api/auth/callback` | Callback gestita dal middleware OAuth, con controllo dello state |
| `POST /api/auth/logout` | Logout, con header `X-CSRF-TOKEN` |
| `POST /api/auth/demo` | Accesso demo, solo in Development e con anti-CSRF |
| `GET /api/homes/` | Case autorizzate |
| `GET /api/homes/{homeId}/measurements` | Stanze e misure della casa |
| `GET /api/homes/{homeId}/history/{measurementId}?hours=6` | Storico 6/12/24/48 ore |
| `GET /api/health` | Readiness del processo |

## Azure

Configurazione e pipeline per sezione: [GitHub Actions](.github/README.md), [frontend](frontend/README.md), [backend](backend/README.md), [infrastruttura](infra/README.md). Il README frontend include la configurazione della porta del backend locale.

`infra/main.bicep` crea risorse in un gruppo dedicato:

- App Service Linux **B1, una sola istanza**, .NET 10, in West Europe;
- Storage Account LRS per il frontend statico;
- Front Door Standard, HTTPS sul dominio Azure, routing `/api/*` al backend e `/*` al frontend; **cache disabilitata sulle API**;
- Storage privato e Key Vault per le chiavi persistenti ASP.NET Data Protection; managed identity e RBAC per il backend;
- Key Vault per le credenziali Netatmo, tramite riferimenti App Service;
- avvisi di budget opzionali a 80% del costo effettivo e 100% del costo previsto.

In produzione i cookie sono Secure/HttpOnly e il backend ammette solo il proprio Front Door, con restrizioni di rete e verifica `X-Azure-FDID`. Il frontend non conosce credenziali Azure/Netatmo e non usa CORS. Front Door applica CSP e gli header di sicurezza anche ai file statici.

**Non scalare il backend a più istanze senza migrare sessioni/cache a uno storage transazionale condiviso e i lock a un coordinamento distribuito.** SQLite persistente in `/home/data/smart-house` e lock in-process sono dimensionati per la prima beta (~50 utenti, pochi contemporanei). Il journal SQLite usa rollback, non WAL, sul volume App Service. Mantenere quel volume e tutte le versioni delle chiavi Key Vault necessarie a decifrare sessioni esistenti. Nessun database di storico viene creato.

### Preparazione della distribuzione

Pubblicare il progetto in un repository GitHub con ramo principale **`main`**. Le CI sono separate per frontend, backend e infrastruttura e partono solo per modifiche pertinenti; i soli README sono esclusi. I test browser sono nella CI frontend, senza avviare la pipeline backend.

Creare l'environment **production senza approvazione manuale**, configurare identità Azure OIDC, variabili, segreti e RBAC seguendo le [tabelle di configurazione GitHub](.github/README.md#impostazioni-github). Le credenziali Netatmo rimangono in Key Vault, mai nel frontend o nei YAML.

Il primo rilascio usa un **bootstrap manuale della sola infrastruttura**, con deploy automatici disabilitati: creare il gruppo dedicato, avviare **Deploy Infrastructure**, inserire i segreti Netatmo e registrare il callback HTTPS dagli output, quindi pubblicare backend e frontend dai rispettivi workflow. La [guida infrastruttura](infra/README.md#bootstrap-manuale) descrive il provisioning a due passaggi e tutti i prerequisiti.

Dopo il bootstrap impostare la variabile **di repository** `AZURE_DEPLOY_ENABLED=true`. I merge su `main` distribuiscono automaticamente solo le sezioni cambiate, dopo CI riuscita sullo stesso commit e nell'ordine **infrastruttura → backend → frontend**. Frontend/backend riutilizzano gli artifact verificati e non ricreano l'infrastruttura. Un errore ferma le pubblicazioni successive.

I file hashed dei vecchi deploy sono conservati per non rompere tab già aperte. Le API e i cookie non vengono memorizzati dalla CDN. I budget opzionali sono nella valuta della sottoscrizione e non impongono un tetto di spesa.

### Costi e prerequisiti di rilascio

Non è stata creata alcuna risorsa Azure. **Il target 50–100 €/mese non è un preventivo né un tetto di spesa.** Verificare Front Door Standard (quota fissa, richieste e traffico), App Service B1, storage, Key Vault e imposte con [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/), usando la propria sottoscrizione e West Europe. Gli avvisi non arrestano risorse; le notifiche richiedono almeno un destinatario. Se la regione non offre il runtime .NET 10, non procedere con un runtime differente: aggiornare il modello o usare un'immagine .NET 10 supportata.

Prima della beta pubblica sono ancora necessari:

- accesso OAuth con account e dispositivi reali, senza usare payload di demo come prova dell'integrazione;
- verifica di nomi, associazioni, timestamp e campioni storici restituiti per termostato e moduli effettivamente posseduti;
- verifica di conversioni con preferenze Netatmo non metriche e degli intervalli in assenza di misure;
- conferma delle [condizioni e dei limiti Netatmo](https://dev.netatmo.com/guideline) per utenti esterni, eventuali autorizzazioni commerciali e informativa privacy della beta;
- deploy reale e controllo del redirect OAuth, refresh/revoca token, persistenza dopo riavvio, restrizioni dell'origin, readiness Front Door e preventivo.

I payload ufficiali usati per implementare gli adapter sono quelli della [documentazione Energy](https://dev.netatmo.com/apidocumentation/energy) e [Weather](https://dev.netatmo.com/apidocumentation/weather). La disponibilità sui dispositivi reali resta da verificare: la demo e i test non sostituiscono quella verifica.

## Verifica locale

```bash
dotnet test backend/SmartHouse.Api.Tests
cd frontend
npm test
npm run build
cd ..
az bicep build --file infra/main.bicep --outfile /tmp/smart-house-template.json
```

I test coprono accesso/CSRF, scadenza della sessione, logout, isolamento, raggruppamento e provenienza, valori scaduti, throttling concorrente, formati di storico, intervalli consentiti, conversioni, selezione della casa e completezza delle traduzioni. NuGet tratta gli advisory come errori; dipendenze native SQLite e XML crypto sono esplicitamente aggiornate.

Per la verifica nel browser, Playwright avvia automaticamente i server demo se non sono già attivi:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

Gli scenari desktop e mobile verificano accesso, misure duplicate, grafici, cambio lingua, logout, assenza di polling e scadenza a pagina aperta.
