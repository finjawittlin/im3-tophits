# im3-tophits

Data Story Projekt IM3: Analyse von Genre-Trends in der Schweiz von 2014 bis 2022

## Aktueller Stand

### 1. Forschungsfrage

Unsere Forschungsfrage lautet:

Welches Genre wurde in welchem Monat in der Schweiz zwischen 2014 und 2022 am meisten gestreamt?

Zusätzlich zeigen wir den Top Artist innerhalb des jeweiligen Top Genres.

### 2. Datenquelle

Wir verwenden den Kaggle-Datensatz "Spotify Chart Data" von jfreyberg.

Quelle:
https://www.kaggle.com/datasets/jfreyberg/spotify-chart-data/

Aus der ursprünglichen Datei `charts.csv` filtern wir nur die Schweizer Daten (`country = ch`) für den Zeitraum 2014 bis 2022.

Die gefilterte Datei liegt im Ordner:

`data/spotify_ch_2014_2022.csv`

Die CSV enthält unter anderem:

- Datum
- Land
- Chartposition
- Anzahl Streams
- Track-ID
- Künstler:innen
- Artist-Genres
- Dauer
- Explicit-Kennzeichnung
- Songname

Die Daten liegen als wöchentliche Chart-Einträge vor.

Für die Monatsanalyse wird jeder Wochenwert dem Monat seines Datums zugeordnet.

### 3. Extract

Mit `backend/etl/extract.php` werden die Daten aus der CSV-Datei eingelesen.

Die Grundlage für die weitere Verarbeitung ist die gefilterte Datei:

`data/spotify_ch_2014_2022.csv`

### 4. Transform

Mit `backend/etl/transform.php` werden die Rohdaten für unsere Forschungsfrage aufbereitet.

Dabei werden:

- Datum und Monat bestimmt
- Genres aus der CSV eingelesen
- ähnliche Genres zu grösseren Hauptkategorien zusammengefasst
- jedem Datensatz ein Hauptgenre zugeordnet
- Streams pro Monat und Hauptgenre summiert
- das Top Genre pro Monat bestimmt
- innerhalb des Top Genres die Streams pro Artist summiert
- der Top Artist innerhalb des Top Genres bestimmt

Die verwendeten Hauptgenres sind:

- Electronic / Dance
- Hip-Hop / Rap
- Rock
- R&B / Soul
- Latin
- Indie / Alternative
- Pop
- Other

Genres, die keiner definierten Kategorie zugeordnet werden können, landen in `Other`.

Bei Songs mit mehreren Artists wird nur der erste Artist als Hauptartist verwendet.

Regeln der Genre-Zuordnung:

- Jedes Spotify-Genre eines Artists wird einzeln geprüft. Die Reihenfolge der Kategorien bestimmt die Priorität: Latin, Hip-Hop / Rap, R&B / Soul, Rock, Indie / Alternative, Electronic / Dance, Pop.
- `dance pop`, `pop dance` und `electropop` zählen als `Pop`, nicht als Electronic.
- Eindeutig elektronische Genres wie `edm`, `house`, `techno`, `electro` und `brostep` werden `Electronic / Dance` zugeordnet – auch wenn der Artist zusätzlich `dance pop` hat.
- `trap latino` zählt zu `Latin` (Latin steht vor Hip-Hop).
- Listen aus der CSV (`['…']`) werden zeichenweise gelesen, damit Namen mit Apostroph (z.B. `Guns N' Roses`) korrekt erkannt werden.

Zusätzlich werden pro Monat **und Genre** berechnet: Streams, Anzahl Chart-Wochen, Chart-Einträge, Explicit-Streams, Top Artist und Top Song.

### 5. Datenbank

Die transformierten Resultate werden in der MySQL-Datenbank bei Hostpoint gespeichert (`backend/etl/schema.sql`):

- `monthly_results`: pro Monat `month`, `top_genre`, `genre_streams`, `top_artist`, `artist_streams`
- `monthly_genre_streams`: pro Monat und Genre `streams`, `chart_weeks`, `chart_entries`, `explicit_streams`, `top_artist`, `artist_streams`, `top_track`, `top_track_artist`, `top_track_streams`

### 6. Load

`backend/etl/load.php` führt Transform aus, legt fehlende Tabellen an und ersetzt den Inhalt beider Tabellen **in einer Transaktion** (bei einem Fehler bleiben die alten Daten erhalten).

Aufruf:

- Terminal: `php backend/etl/load.php`
- Browser: `backend/etl/load.php?token=…` – dafür in `config.php` `$etlToken = '…';` setzen. Ohne gültigen Token ist der Load gesperrt.

`data/.htaccess` verhindert, dass die CSV öffentlich heruntergeladen werden kann.

### 7. API

`backend/api/index.php` liest die Daten aus MySQL und gibt JSON zurück:

- `backend/api/` oder `?resource=months` – Top Genre und Top Artist pro Monat
- `backend/api/?resource=genres` – alle Genres pro Monat (leere Liste, solange `monthly_genre_streams` nicht befüllt ist)

`backend/etl/unload.php` nutzt dieselbe Logik.

Die API ist online erreichbar unter:

`https://im3.okurocic.myhostpoint.ch/im3-tophits/backend/api/`

### Frontend: Scrollytelling-Datenreportage

`frontend/index.html` lädt die Daten live über `../backend/api/` (keine Mock-Daten) und erzählt sie als Geschichte:

1. **Hero** – «Was hört die Schweiz?» mit animierten Kennzahlen
2. **Kapitel 1 – Pink** – die lange Pop-Phase am Anfang und ihre Top Artists
3. **Kapitel 2 – Der Wandel** – die Heatmap bleibt fixiert und füllt sich beim Scrollen Monat für Monat; Textschritte erklären Wendepunkt, Hip-Hop-Phase, Pop-Comeback und das Dezember-Muster
4. **Kapitel 3 – Die Artists** – vor/nach dem Wendepunkt, Zeitachse der wichtigsten Artists
5. **Kapitel 4 – Die Streams** – Liniendiagramm mit Rekorden und das Duell Jahr für Jahr
6. **Kapitel 5 – Dein Jahr** – der interaktive Explorer (Jahr, Monate/Jahreszeiten, Heatmap, Muster, Zeitverlauf, Artist-Suche)

Alle Zahlen und Überschriften werden aus den Daten berechnet (`frontend/story.js`). Aussagen wie «2014 war die Schweiz pink» erscheinen nur, wenn die Daten sie stützen. Die Lade- und Scrollzustände sind oben in `story.js` dokumentiert.

Farben: Pink = Pop, Neongrün = Hip-Hop / Rap. Die Akzentfarbe der Seite wechselt beim Scrollen mit der Geschichte.

Ein letzter Monat mit auffällig wenigen Streams (unter 50 % des Medians der sechs Monate davor) wird als «vermutlich unvollständig» schraffiert – aktuell Dezember 2022.

Sind Genre-Daten (`?resource=genres`) vorhanden, kommen im Explorer automatisch dazu: Rangliste aller Genres, echte Jahreszeiten-Summen, «Ø pro Woche», Top Song, Explicit-Anteil und Linien pro Genre.

### 8. Aktueller Datenfluss

Der aktuelle Datenfluss funktioniert so:

CSV → Extract → Transform → Load → MySQL → API → Frontend

Aktuell umgesetzt:

- Schweizer Spotify-Daten von 2014 bis 2022
- alle 108 Monate vorhanden
- Genre-Zuordnung umgesetzt
- Top Genre pro Monat berechnet
- Top Artist innerhalb des Top Genres berechnet
- MySQL-Datenbank eingerichtet
- 108 Monatsresultate erfolgreich gespeichert
- JSON-Ausgabe getestet
- API liest direkt aus der Datenbank
- Backend läuft auf Hostpoint