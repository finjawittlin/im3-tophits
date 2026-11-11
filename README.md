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

### Frontend: «Pink gegen Neon» – interaktive Datenreportage

`frontend/index.html` lädt die Daten live über `../backend/api/` und erzählt sie als Scrollytelling:

| | Kapitel | Inhalt |
|---|---|---|
| Hero | Was hört die Schweiz? | Skyline aus allen Monaten (Farbe = Genre, Höhe = Streams), animierte Kennzahlen |
| 01 | Pink | Die lange Pop-Phase, ihre Artists und der «Machtmoment» (höchster Anteil eines Artists an seinem Genre) |
| – | Quiz | «In welchem Jahr lag Hip-Hop zum ersten Mal vorne?» – Auflösung beim Wendepunkt |
| – | Farbwischer | Pink wird beim Scrollen von Neongrün überwischt: «Dann änderte sich der Beat.» |
| 02 | Der Wandel | Fixierte Heatmap, füllt sich Monat für Monat; Wendepunkt, Hip-Hop-Phase, Pop-Comeback |
| 03 | Die Jahresuhr | Radiale Heatmap (Ringe = Jahre, Segmente = Monate) – Saisonmuster, Filter |
| 04 | Die Gesichter | Artists vor/nach dem Wendepunkt, Zeitachse der wichtigsten Artists |
| 05 | Die Streams | Liniendiagramm mit Rekorden, Duell Jahr für Jahr |
| 06 | Fazit | Drei Kernaussagen und «Was die Daten nicht sagen» |
| 07 | Dein Jahr | Zeitmaschine (Regler über alle Monate) und Explorer: Jahr, Monate/Jahreszeiten, Zeitverlauf, Artist-Suche |

Alle Zahlen und Überschriften werden aus den Daten berechnet (`frontend/story.js`). Aussagen wie «2014 war die Schweiz pink» erscheinen nur, wenn die Daten sie stützen. Lade- und Scrollzustände sind oben in `story.js` dokumentiert.

Farben: Pink = Pop, Neongrün = Hip-Hop / Rap. Die Akzentfarbe der ganzen Seite wechselt mit der Geschichte.

Barrierefreiheit: Skip-Link zum Explorer, Tastaturbedienung (Regler mit Pfeiltasten), sichtbarer Fokus, `prefers-reduced-motion` schaltet Animationen ab.

Ein letzter Monat mit auffällig wenigen Streams (unter 50 % des Medians der sechs Monate davor) wird als «vermutlich unvollständig» schraffiert – aktuell Dezember 2022.

Sind Genre-Daten (`?resource=genres`) vorhanden, kommen im Explorer automatisch dazu: Rangliste aller Genres, echte Jahreszeiten-Summen, «Ø pro Woche», Top Song, Explicit-Anteil und Linien pro Genre.

#### Roter Faden: das Mixtape (`frontend/guide.js`)

Die Reportage ist ein Mixtape: **Seite A** (Pink/Pop: Intro, Kapitel 1, Quiz) – beim Farbwischer wird die Kassette **umgedreht** – **Seite B** (Neon/Hip-Hop: Kapitel 2–6) – **Bonus** (Kapitel 7, Explorer).

Der Begleiter unten links ist eine Kassette:
- zeigt Track (Kapitel), Seite und Bandstand (linke Spule wird kleiner, rechte grösser); die Spulen drehen sich nur beim Scrollen
- Liner Notes mit echten Zahlen; in Kapitel 2 und in der Zeitmaschine live mit dem aktuellen Monat
- **Tipp-Knopf** pro Kapitel: springt zum interaktiven Element und hebt es hervor
- ⏮ ⏭ und Trackliste (Klick auf die Kassette) mit ✓ für gehörte Tracks; verkleinerbar
- reagiert auf Quiz-Tipp, Wendepunkt, Zeitmaschine (Rekordmonat, unvollständige Monate)
- fünf versteckte Noten ♪ schalten einen **Hidden Track** mit Geheimfakt frei

#### Jahreszeiten nur dort, wo sie Thema sind

Elemente mit `data-season-fx` lösen beim Hover, Fokus oder Antippen einen Effekt **nur in ihrem Bereich** aus: Schnee (bleibt unten liegen), Herbstlaub, wachsende Blumen, Sonnenstrahlen.
- Kapitel 3: Karten «Juni–November» (Sonne + Laub), «Januar–April» (Schnee + Blumen), «Dezember» (Schnee); beim ersten Erreichen spielen sie einmal kurz an. Hover über der Jahresuhr zeigt die Jahreszeit des Monats, «Nur Dezember» lässt es schneien.
- Kapitel 2 (Dezember-Schritt), Fazit (Sommer/Herbst), Explorer-Ansicht «Jahreszeiten» und die Zeitmaschine (kurzer Gruss der Jahreszeit des gewählten Monats).
- Bei «reduzierter Bewegung» keine Effekte und keine Animationen.

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