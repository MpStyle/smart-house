# TODO

## Front-end

- Separare le pagine e i componenti grafici in file distinti. Le pagine nella cartella "src/component/page/<nome_pagina>/<nome_pagina>.tsx" e i componenti grafici nella cartella "src/component/common/<nome_componente>/<nome_componente>.tsx" se sono comuni a più pagine, altrimenti nella cartella della relativa pagina.
- le traduzioni devono essere definiti in file json che vengono caricati dinamicamente quando viene richiesta una lingua diversa, usa https://github.com/i18next/i18next-http-backend
- Separare i types nei propri file: crea una cartella "entity" e creare i relaviti file per ogni models
- Spostare i file di logica nella cartella "book"
- Spostare i file relativi alle API nella cartella "api"
- Stampare request e response in console.log solo quando il front-end è avviato in dev.
- Tutte le props dei componenti grafici devono avere un proprio tipo definito all'interno del file stesso del componente.
- le MeasurementCard devono essere 2 per riga negli schermi degli smartphone
- negli schermi degli smartphone nascondi le informazioni della stanza e la data di campionamento della misura nel componente MeasurementCard
- nella pagina di Dashboard il pulsante di refresh deve essere nell' app bar, quindi l'app-bar deve contenere azioni specifiche per le singole pagine

## Back-end
- Separare i model nei propri file: crea una cartella "Entities" e creare i relaviti file per ogni models
- Separare le rotte nei propri file: creare una cartella "Controllers" e creare i relativi file per ogni rotta.
- Spostare i file di logica nella cartella "BusinessModels"
- Spostare i file di interazione con il DB nella cartella "Repositories"

## Generale
- L'informazione dell'ultima temperatura misurata del temostato non è disponibile, ma quando accedo alla pagina del grafico, questa si visualizza correttamente. Correggi.