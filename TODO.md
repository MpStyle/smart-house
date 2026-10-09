# TODO

## Front-end

- [x] Separare le pagine e i componenti grafici in file distinti. Le pagine nella cartella "src/component/page/<nome_pagina>/<nome_pagina>.tsx" e i componenti grafici nella cartella "src/component/common/<nome_componente>/<nome_componente>.tsx" se sono comuni a più pagine, altrimenti nella cartella della relativa pagina.
- [x] le traduzioni devono essere definiti in file json che vengono caricati dinamicamente quando viene richiesta una lingua diversa, usa https://github.com/i18next/i18next-http-backend
- [x] Separare i types nei propri file: crea una cartella "entity" e creare i relaviti file per ogni models
- [x] Spostare i file di logica nella cartella "book"
- [x] Spostare i file relativi alle API nella cartella "api"
- [x] Stampare request e response in console.log solo quando il front-end è avviato in dev.
- [x] Tutte le props dei componenti grafici devono avere un proprio tipo definito all'interno del file stesso del componente.
- [x] le MeasurementCard devono essere 2 per riga negli schermi degli smartphone
- [x] negli schermi degli smartphone nascondi le informazioni della stanza e la data di campionamento della misura nel componente MeasurementCard
- [x] nella pagina di Dashboard il pulsante di refresh deve essere nell' app bar, quindi l'app-bar deve contenere azioni specifiche per le singole pagine

## Back-end
- [x] Separare i model nei propri file: crea una cartella "Entities" e creare i relaviti file per ogni models
- [x] Separare le rotte nei propri file: creare una cartella "Controllers" e creare i relativi file per ogni rotta.
- [x] Spostare i file di logica nella cartella "BusinessModels"
- [x] Spostare i file di interazione con il DB nella cartella "Repositories"

## Generale
- [x] L'informazione dell'ultima temperatura misurata del temostato non è disponibile, ma quando accedo alla pagina del grafico, questa si visualizza correttamente. Correggi.

### Comportamento concordato

- Tutte le card mostrano campioni validi fino a 48 ore: freschi entro 30 minuti, poi con avviso di dato scaduto; oltre 48 ore sono non disponibili.
- Il termostato cerca il campione nello storico delle ultime 48 ore; i sensori meteo usano risposta corrente e cache. In caso di aggiornamento fallito si conserva l'ultimo valore noto con avviso esplicito, senza aggirare errori di autenticazione o permessi.
- Sotto 600 px si nascondono nome dispositivo e data/ora nelle card, mantenendo titoli delle stanze e avvisi; nessuna età relativa su smartphone.
- App bar: refresh nella dashboard; nello storico `showBack` booleano sostituisce l'icona della casa con la freccia Indietro, senza usare `PageActionsContext`. Ritorno alla pagina interna precedente, con dashboard come ripiego; scelta dell'intervallo accanto al grafico.
- Lingua non caricata: ripiego inglese senza avviso a schermo; se anche l'inglese manca, schermata di errore con nuovo tentativo.
- URL e Minimal API invariati, cache di un minuto e nessun polling; payload nei log di sviluppo con dati sensibili oscurati.