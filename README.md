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

Dabei werden die wichtigen Informationen aus der CSV beibehalten:

- Datum
- Land
- Position
- Streams
- Track-ID
- Songname
- Künstler:innen
- Genres

Die Genres werden ebenfalls übernommen. Wenn ein Song mehrere Genres hat, bleiben alle Genres erhalten.

Die transformierten Daten werden anschliessend als JSON ausgegeben.

### 4. Datenbank

Mit `backend/etl/schema.sql` haben wir eine Datenbankstruktur vorbereitet.

Die Daten werden auf zwei Tabellen aufgeteilt.

Die Tabelle `songs` enthält:

- `id`
- `track_id`
- `name`
- `artists`
- `genres`

Die Tabelle `chart_entries` enthält:

- `id`
- `song_id`
- `date`
- `country`
- `position`
- `streams`

Über `song_id` werden die Chart-Einträge mit dem jeweiligen Song verbunden.

### 5. Load

Mit `backend/etl/load.php` ist der Import der transformierten Daten in die MySQL-Datenbank vorbereitet.

Dabei werden die Songs und die zugehörigen Chart-Einträge in die Datenbank geschrieben.

Die Datenbank befindet sich bei Hostpoint.

Der Import wurde lokal bereits getestet. Die Verbindung zur Hostpoint-Datenbank funktioniert aus der lokalen Umgebung aktuell noch nicht, da der verwendete MySQL-Host intern bei Hostpoint erreichbar ist.

### 6. API / JSON

Mit `backend/etl/unload.php` haben wir einen ersten Endpunkt vorbereitet, der Daten aus der MySQL-Datenbank ausliest und als JSON zurückgibt.

Die JSON-Daten enthalten:

- Datum
- Land
- Position
- Streams
- Track-ID
- Songname
- Künstler:innen
- Genres

Damit ist die Grundlage geschaffen, damit das Frontend später mit den aufbereiteten Daten arbeiten kann.

### 7. Aktueller Datenfluss

Der geplante Datenfluss sieht so aus:

CSV → Extract → Transform → MySQL-Datenbank → API → Frontend

Die Datenquelle und die Datenaufbereitung sind vorbereitet.

Die Datenbankstruktur ist erstellt und der Import sowie die JSON-Ausgabe sind vorbereitet.

Der nächste Schritt ist, die Datenbank auf dem Server mit den transformierten Daten zu befüllen und die API für das Frontend bereitzustellen.