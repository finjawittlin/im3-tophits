# im3-tophits
Data Story Projekt IM3: Analyse saisonaler Genre-Trends 2025

## Aktueller Stand

### 1. Datenquelle

Wir verwenden eine CSV-Datei mit Spotify-Daten aus der Schweiz aus dem Jahr 2022.

Die Datei liegt im Ordner:

`data/spotify_ch_2022.csv`

Die CSV enthält unter anderem Informationen zu:
- Datum
- Land
- Position des Songs in den Charts
- Anzahl Streams
- Track-ID
- Künstler:innen
- Genres
- Songname

### 2. Extract

Mit `backend/etl/extract.php` lesen wir die CSV-Datei ein.

Die Daten werden dabei aus der CSV gelesen und in PHP als Array gespeichert.

### 3. Transform

Mit `backend/etl/transform.php` bereiten wir die Rohdaten für unser Projekt auf.

Dabei werden die Daten nach Song zusammengefasst. Wenn ein Song mehrmals in den Charts vorkommt, werden seine Streams zusammengezählt.

Anschliessend sortieren wir die Songs nach der Anzahl Streams und behalten die Top 10.

### 4. Datenbank

Wir haben mit `backend/etl/schema.sql` eine Datenbankstruktur vorbereitet.

Die Tabelle `songs` enthält:
- `id`
- `track_id`
- `name`
- `artists`
- `streams`

### 5. Aktueller Stand

Der bisherige Datenfluss sieht so aus:

CSV → Extract → Transform

Die Datenbankstruktur mit `schema.sql` ist bereits vorbereitet.

Als nächster Schritt werden die transformierten Daten mit `load.php` in die MySQL-Datenbank geschrieben.