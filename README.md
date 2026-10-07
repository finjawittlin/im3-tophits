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
- Landwil
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

Bei Songs mit mehreren Artists wird aktuell nur der erste Artist als Hauptartist verwendet.

Für den Zeitraum 2014 bis 2022 entstehen insgesamt 108 Monatsresultate.

Spezialfall bei der Genre-Zuordnung:

- `dance pop` und `pop dance` werden `Pop` zugeordnet.
- Eindeutig elektronische Genres wie `edm`, `house`, `techno`, `electro` und `brostep` werden `Electronic / Dance` zugeordnet.

Damit soll verhindert werden, dass Pop-Artists nur wegen des Wortes `dance` automatisch als Electronic / Dance gezählt werden.

### 5. Datenbank

Die transformierten Monatsresultate werden in der MySQL-Datenbank bei Hostpoint gespeichert.

Dafür verwenden wir die Tabelle `monthly_results` mit folgenden Feldern:

- `id`
- `month`
- `top_genre`
- `genre_streams`
- `top_artist`
- `artist_streams`

Die Tabelle wurde mit `backend/etl/schema.sql` erstellt.

### 6. Load

Mit `backend/etl/load.php` werden die transformierten Daten in die Datenbank geschrieben.

Der Import wurde erfolgreich auf dem Hostpoint-Server getestet.

Aktuell werden genau 108 Monatsresultate für den Zeitraum 2014 bis 2022 in `monthly_results` gespeichert.

### 7. Unload / API

Mit `backend/etl/unload.php` werden die gespeicherten Daten wieder aus MySQL gelesen und als JSON ausgegeben.

Zusätzlich stellt `backend/api/index.php` die Daten für das Frontend bereit.

Die API liest die Daten direkt aus der MySQL-Datenbank und gibt pro Monat folgende Werte zurück:

- Monat
- Top Genre
- Streams des Top Genres
- Top Artist im Top Genre
- Streams dieses Artists

Die API ist online erreichbar unter:

`https://im3.okurocic.myhostpoint.ch/im3-tophits/backend/api/`

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