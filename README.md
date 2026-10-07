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

Mit `backend/etl/schema.sql` wird die Tabelle `monthly_results` erstellt.

Diese Tabelle enthält pro Monat:

- `id`
- `month`
- `top_genre`
- `genre_streams`
- `top_artist`
- `artist_streams`

Damit wird nicht jeder einzelne Song gespeichert, sondern direkt das Resultat unserer monatlichen Analyse.

Die Datenbank befindet sich bei Hostpoint.

### 6. Load

Mit `backend/etl/load.php` werden die transformierten Monatsresultate in die MySQL-Datenbank geschrieben.

Dabei wird aus einem Monatswert wie:

`2014-01`

für die Datenbank ein Datum wie:

`2014-01-01`

gespeichert.

Die Verbindung zur Hostpoint-Datenbank ist aktuell noch in Arbeit.

Die Tabelle `monthly_results` wurde bereits in phpMyAdmin erstellt.

Der lokale Zugriff auf die Datenbank wird momentan noch mit `Connection refused` abgelehnt. Als nächster Schritt müssen der korrekte MySQL-Host und die externe Host-Freigabe geprüft werden.

### 7. API / JSON

Als nächster Schritt soll ein Endpunkt vorbereitet werden, der die Daten aus `monthly_results` ausliest und als JSON an das Frontend weitergibt.

Geplant ist eine Struktur mit folgenden Werten:

- Monat
- Top Genre
- Streams des Top Genres
- Top Artist im Top Genre
- Streams dieses Artists

Damit kann das Frontend die monatlichen Veränderungen visualisieren.

### 8. Datenfluss

Der aktuelle Datenfluss sieht so aus:

CSV → Extract → Transform → MySQL-Datenbank → API → Frontend

Aktuell sind folgende Schritte umgesetzt oder vorbereitet:

- Schweizer Spotify-Daten von 2014 bis 2022 gefiltert
- alle 108 Monate geprüft
- Genre-Zuordnung umgesetzt
- Top Genre pro Monat berechnet
- Top Artist innerhalb des Top Genres berechnet
- `transform.php` auf Monatsresultate umgestellt
- Datenbankstruktur mit `monthly_results` vorbereitet
- Tabelle in phpMyAdmin erstellt
- `load.php` an die neue Struktur angepasst

Der nächste Schritt ist die Verbindung zur Hostpoint-Datenbank herzustellen und danach die Monatsresultate in MySQL zu laden.