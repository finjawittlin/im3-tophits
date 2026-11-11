# Pink gegen Neon – Was hört die Schweiz?

Data-Story-Projekt im Modul IM3 von **Die Chartjägerinnen**: Wie sich die Schweizer Spotify-Charts zwischen 2014 und 2022 verändert haben – Monat für Monat, erzählt als interaktive Datenreportage.

**Website:** https://im3.okurocic.myhostpoint.ch/im3-tophits/frontend/
**API:** https://im3.okurocic.myhostpoint.ch/im3-tophits/backend/api/

> TODO (Team): Die Online-Version auf Hostpoint entspricht noch nicht dem aktuellen Stand dieses Repos (Stand 11.11.2026: alter Seitentitel, `?resource=genres` wird von der API noch nicht unterstützt). Nach dem Hochladen der aktuellen Dateien und einem Load diesen Hinweis entfernen.

## Inhalt

1. [Projektbeschreibung und Zielsetzung](#1-projektbeschreibung-und-zielsetzung)
2. [Screenshots](#2-screenshots)
3. [Marktstand](#3-marktstand)
4. [Installation und Ausführung](#4-installation-und-ausführung)
5. [ETL-Prozess](#5-etl-prozess)
6. [Datenbank und API](#6-datenbank-und-api)
7. [Frontend](#7-frontend)
8. [Technische Umsetzung und Projektstruktur](#8-technische-umsetzung-und-projektstruktur)
9. [Learnings](#9-learnings)
10. [Schwierigkeiten und Lösungen](#10-schwierigkeiten-und-lösungen)
11. [Ressourcen](#11-ressourcen)
12. [Lizenz](#12-lizenz)

---

## 1. Projektbeschreibung und Zielsetzung

**Forschungsfrage:** Welches Genre wurde in welchem Monat in der Schweiz zwischen 2014 und 2022 am meisten gestreamt?

Zusätzlich zeigen wir den Top Artist innerhalb des jeweiligen Top Genres.

**Ziel:** Aus wöchentlichen Spotify-Chartdaten eine verständliche, interaktive Geschichte machen. Die Daten werden mit einem eigenen ETL-Prozess in PHP aufbereitet, in einer MySQL-Datenbank gespeichert, über eine JSON-API ausgeliefert und im Browser als Scrollytelling-Reportage dargestellt («Pink» = Pop, «Neon» = Hip-Hop / Rap).

Datenfluss:

```
CSV → Extract → Transform → Qualitätschecks → Load → MySQL → API → Frontend
```

## 2. Screenshots

Aufgenommen aus der lokalen Version mit den 108 Monatsresultaten aus der Datenbank (Desktop 1280 px, Mobile 390 px).

| | |
|---|---|
| ![Startseite mit Skyline aller Monate](docs/screenshots/01-hero.png) Startseite: jeder Balken ein Monat | ![Kapitel 1](docs/screenshots/02-kapitel-1-pink.png) Kapitel 1: die Pop-Phase |
| ![Kapitel 2: Heatmap beim Wendepunkt Juni 2018](docs/screenshots/03-kapitel-2-wandel.png) Kapitel 2: der Wendepunkt | ![Kapitel 3: Jahresuhr mit Jahreszeiten-Effekten](docs/screenshots/04-kapitel-3-jahresuhr.png) Kapitel 3: die Jahresuhr |
| ![Kapitel 5: Streams im Zeitverlauf](docs/screenshots/05-kapitel-5-streams.png) Kapitel 5: Streams | ![Zeitmaschine im Explorer](docs/screenshots/06-zeitmaschine.png) Kapitel 7: die Zeitmaschine |

<img src="docs/screenshots/07-mobile.png" alt="Startseite auf dem Smartphone" width="260">

## 3. Marktstand

> TODO (Team): Foto vom Marktstand als `docs/marktstand.jpg` ablegen und die Zeile unten aktivieren (Kommentarzeichen entfernen). Kurz beschreiben, was am Stand gezeigt wurde.

<!-- ![Unser Marktstand](docs/marktstand.jpg) -->

## 4. Installation und Ausführung

### Voraussetzungen

- PHP 8.0 oder neuer mit `pdo_mysql` (lokal geht für Tests auch `pdo_sqlite`)
- MySQL / MariaDB (bei uns: Hostpoint)
- Die Rohdaten-CSV (nicht im Repo, siehe unten)

### Schritte

1. **Repo klonen**
   ```bash
   git clone https://github.com/finjawittlin/im3-tophits.git
   cd im3-tophits
   ```
2. **Konfiguration anlegen**
   ```bash
   cp config.template.php config.php
   ```
   In `config.php` Datenbank-Host, -Name, Benutzer und Passwort eintragen. `config.php` ist in `.gitignore` und wird nie committet.
3. **Daten bereitstellen:** Den Kaggle-Datensatz herunterladen (siehe [Ressourcen](#11-ressourcen)), aus `charts.csv` die Schweizer Zeilen (`country = ch`) von 2014 bis 2022 filtern und als `data/spotify_ch_2014_2022.csv` speichern. Die CSV ist wegen ihrer Grösse nicht im Repo.
4. **Probelauf (ohne Datenbank):**
   ```bash
   php backend/etl/extract.php      # liest die CSV, zeigt Spalten, Zeilen, Zeitraum
   php backend/etl/transform.php    # Transform + Qualitätschecks, schreibt nichts
   ```
5. **Load (schreibt in die Datenbank):**
   ```bash
   php backend/etl/load.php
   ```
   Ersetzt den Inhalt von `monthly_results` und `monthly_genre_streams` in einer Transaktion. Im Browser nur mit Token: `backend/etl/load.php?token=…` (`$etlToken` in `config.php`; leer = gesperrt).
6. **Website lokal starten:**
   ```bash
   php -S 127.0.0.1:8000
   ```
   und http://127.0.0.1:8000/frontend/ öffnen.

Andere CSV verwenden: `php backend/etl/transform.php --csv=pfad/zur/datei.csv` oder `$csvFile` in `config.php`.

### Deployment (Hostpoint)

Ordner `backend/`, `frontend/`, `data/` (mit `.htaccess` und CSV) und `config.php` per SFTP hochladen. `data/.htaccess` verhindert, dass die CSV öffentlich heruntergeladen werden kann.

## 5. ETL-Prozess

### Datenquelle

Kaggle-Datensatz **«Spotify tracks chart dataset (2014-2022)»** von Julian Freyberg (jfreyberg), https://www.kaggle.com/datasets/jfreyberg/spotify-chart-data/. Der Datensatz stammt laut Beschreibung von kworb.net und der offiziellen Spotify-API.

Die gefilterte Datei `data/spotify_ch_2014_2022.csv` enthält wöchentliche Chart-Einträge mit den Spalten `date, country, position, streams, track_id, artists, artist_genres, duration, explicit, name`.

### Extract – `backend/etl/extract.php`

- liest die CSV Zeile für Zeile als **Generator** (`extractRows()`), damit auch grosse Dateien wenig Speicher brauchen
- findet die Spalten über ihren **Namen** (nicht über die Position) und prüft, ob alle Pflichtspalten vorhanden sind
- Pfad dynamisch: Terminal-Argument `--csv=…`, `$csvFile` in `config.php` oder Standardpfad
- Fehler (Datei fehlt, leer, Pflichtspalte fehlt) werfen eine `ExtractException` – Load verändert dann nichts
- Zeilen mit falscher Spaltenzahl werden übersprungen und mit Zeilennummer protokolliert
- direkt aufgerufen: Bericht mit Spalten, Anzahl Zeilen, Chart-Wochen und Zeitraum

### Transform – `backend/etl/transform.php`

`transform.php` bindet `extract.php` ein und verarbeitet dessen Zeilen direkt (`transformRows(extractRows(…))`). Dabei werden:

- Datum geprüft (`2019/01/03` oder `2019-01-03`; ungültige Daten wie 31. Februar werden verworfen) und der Monat bestimmt – **jede Chart-Woche zählt zum Monat ihres Datums**
- Streams geprüft (nur ganze Zahlen ≥ 0)
- Duplikate verworfen (derselbe Song zweimal in derselben Chart-Woche)
- Genres aus der CSV gelesen und zu Hauptgenres zusammengefasst
- Streams pro Monat und Hauptgenre summiert, Top Genre und Top Artist pro Monat bestimmt
- pro Monat **und Genre** zusätzlich: Anzahl Chart-Wochen, Chart-Einträge, Explicit-Streams, Top Artist und Top Song

Hauptgenres: Pop, Hip-Hop / Rap, Electronic / Dance, Rock, R&B / Soul, Latin, Indie / Alternative – sowie:

| Kategorie | Bedeutung |
|---|---|
| `Other` | Der Artist hat Spotify-Genres, aber keine Regel passt (z.B. `schlager`) |
| `Unknown` | Der Artist hat bei Spotify **keine** Genres. Fehlt der Artist- oder Songname, steht dort ebenfalls `Unknown` |

Regeln der Genre-Zuordnung:

- Jedes Spotify-Genre eines Artists wird einzeln geprüft. Die Reihenfolge der Kategorien bestimmt die Priorität: Latin, Hip-Hop / Rap, R&B / Soul, Rock, Indie / Alternative, Electronic / Dance, Pop.
- `dance pop`, `pop dance` und `electropop` zählen als `Pop`, nicht als Electronic.
- Eindeutig elektronische Genres wie `edm`, `house`, `techno`, `electro` und `brostep` werden `Electronic / Dance` zugeordnet – auch wenn der Artist zusätzlich `dance pop` hat.
- `trap latino` zählt zu `Latin` (Latin steht vor Hip-Hop).
- Listen aus der CSV (`['…']`) werden zeichenweise gelesen, damit Namen mit Apostroph (z.B. `Guns N' Roses`) korrekt erkannt werden.
- Bei Songs mit mehreren Artists zählt nur der erste Artist als Hauptartist.

### Qualitätschecks – `backend/etl/quality.php`

Laufen bei jedem Transform automatisch. Jeder Check meldet **OK**, **WARNUNG** (auffällig, Load läuft weiter) oder **FEHLER** (Load bricht ab, Datenbank bleibt unverändert):

| Check | Was geprüft wird |
|---|---|
| Zeilen | falsche Spaltenzahl, ungültiges Datum, ungültige Streams, Duplikate – mit Zeilennummern. FEHLER ab 1 % verworfener Zeilen |
| Monate | lückenlos vom ersten bis zum letzten Monat, sonst FEHLER |
| Wochen pro Monat | jede Chart-Woche genau einem Monat zugeordnet (sonst FEHLER); Verteilung 4/5 Wochen; Monate mit weniger als 4 oder mehr als 5 Wochen und Abstände ≠ 7 Tage als WARNUNG |
| Einträge pro Woche | Wochen mit weniger als der Hälfte des Medians (z.B. unvollständig erfasste letzte Wochen) |
| Unknown | Zeilen ohne Genre, Artist oder Titel; Anteil an den Streams, betroffene Artists; WARNUNG ab 5 % oder wenn `Unknown` ein Monat gewinnt |
| Other | Anteil an den Streams und die häufigsten nicht zugeordneten Spotify-Genres (Kandidaten für neue Regeln); WARNUNG ab 10 % oder wenn `Other` ein Monat gewinnt |
| Konsistenz | Monat + Genre eindeutig, Summe der Genre-Streams = alle verarbeiteten Streams, Top Genre hat wirklich die meisten Streams |

Den Bericht zeigt `php backend/etl/transform.php` (Probelauf) und `load.php` vor dem Schreiben.

Warum «Wochen pro Monat» wichtig ist: Ein Monat hat 4 oder 5 Chart-Wochen. Monate mit 5 Wochen haben deshalb mehr Streams. Darum speichern wir `chart_weeks`, und der Explorer bietet die Ansicht «Ø pro Woche».

### Load – `backend/etl/load.php`

1. Zugriffsschutz: im Browser nur mit Token, sonst nur im Terminal
2. Sperre: Es kann immer nur ein Load gleichzeitig laufen
3. Extract + Transform + Qualitätschecks – bei FEHLER Abbruch **vor** dem Verbinden zur Datenbank
4. Fehlende Tabellen anlegen (`schema.sql`) und prüfen, dass sie **InnoDB** nutzen (nur InnoDB kann ein ROLLBACK). Das geschieht vor der Transaktion, weil `CREATE TABLE` in MySQL eine offene Transaktion automatisch beendet
5. **`BEGIN`** → alte Zeilen löschen → neue Zeilen einfügen (Prepared Statements) → Kontrolle: Anzahl Zeilen und Summe der Streams in der Datenbank = erwartete Werte → **`COMMIT`**
6. Bei jedem Fehler: **`ROLLBACK`** – der alte Datenbestand bleibt vollständig erhalten. Die Meldung nennt den Schritt (z.B. Monat und Genre), aber keine Zugangsdaten

Duplikate verhindert zusätzlich die Datenbank: `month` ist in `monthly_results` eindeutig, `(month, genre)` in `monthly_genre_streams`.

## 6. Datenbank und API

Tabellen (`backend/etl/schema.sql`, MySQL, InnoDB, utf8mb4):

- `monthly_results`: pro Monat `month`, `top_genre`, `genre_streams`, `top_artist`, `artist_streams`
- `monthly_genre_streams`: pro Monat und Genre `streams`, `chart_weeks`, `chart_entries`, `explicit_streams`, `top_artist`, `artist_streams`, `top_track`, `top_track_artist`, `top_track_streams`

`backend/api/index.php` liest nur und gibt JSON zurück:

- `backend/api/` oder `?resource=months` – Top Genre und Top Artist pro Monat
- `backend/api/?resource=genres` – alle Genres pro Monat (leere Liste, solange `monthly_genre_streams` nicht befüllt ist)

`backend/etl/unload.php` nutzt dieselbe Logik.

## 7. Frontend

### «Pink gegen Neon» – interaktive Datenreportage

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

### Roter Faden: das Mixtape (`frontend/guide.js`)

Die Reportage ist ein Mixtape: **Seite A** (Pink/Pop: Intro, Kapitel 1, Quiz) – beim Farbwischer wird die Kassette **umgedreht** – **Seite B** (Neon/Hip-Hop: Kapitel 2–6) – **Bonus** (Kapitel 7, Explorer).

Der Begleiter unten links ist eine Kassette:
- zeigt Track (Kapitel), Seite und Bandstand (linke Spule wird kleiner, rechte grösser); die Spulen drehen sich nur beim Scrollen
- Liner Notes mit echten Zahlen; in Kapitel 2 und in der Zeitmaschine live mit dem aktuellen Monat
- **Tipp-Knopf** pro Kapitel: springt zum interaktiven Element und hebt es hervor
- ⏮ ⏭ und Trackliste (Klick auf die Kassette) mit ✓ für gehörte Tracks; verkleinerbar
- reagiert auf Quiz-Tipp, Wendepunkt, Zeitmaschine (Rekordmonat, unvollständige Monate)
- fünf versteckte Noten ♪ schalten einen **Hidden Track** mit Geheimfakt frei

### Jahreszeiten nur dort, wo sie Thema sind

Elemente mit `data-season-fx` lösen beim Hover, Fokus oder Antippen einen Effekt **nur in ihrem Bereich** aus: Schnee (bleibt unten liegen), Herbstlaub, wachsende Blumen, Sonnenstrahlen.
- Kapitel 3: Karten «Juni–November» (Sonne + Laub), «Januar–April» (Schnee + Blumen), «Dezember» (Schnee); beim ersten Erreichen spielen sie einmal kurz an. Hover über der Jahresuhr zeigt die Jahreszeit des Monats, «Nur Dezember» lässt es schneien.
- Kapitel 2 (Dezember-Schritt), Fazit (Sommer/Herbst), Explorer-Ansicht «Jahreszeiten» und die Zeitmaschine (kurzer Gruss der Jahreszeit des gewählten Monats).
- Bei «reduzierter Bewegung» keine Effekte und keine Animationen.

## 8. Technische Umsetzung und Projektstruktur

- **Backend:** PHP 8 ohne Framework, PDO mit Prepared Statements, MySQL bei Hostpoint
- **Frontend:** HTML, CSS und Vanilla JavaScript ohne Bibliotheken; Diagramme als SVG/HTML selbst gezeichnet, Jahreszeiten-Effekte mit Canvas
- **Schriften:** Anton und Space Mono (Google Fonts)

```
im3-tophits/
├── config.template.php      Vorlage für config.php (ohne Zugangsdaten)
├── config.php               echte Zugangsdaten – nur lokal/Server, in .gitignore
├── backend/
│   ├── api/index.php        JSON-API (nur lesend)
│   └── etl/
│       ├── extract.php      CSV lesen und prüfen
│       ├── transform.php    Monats- und Genre-Auswertung
│       ├── quality.php      Qualitätschecks
│       ├── load.php         Schreiben in MySQL (Transaktion)
│       ├── unload.php       JSON-Ausgabe (nutzt die API)
│       └── schema.sql       Tabellenstruktur
├── data/
│   ├── .htaccess            sperrt den Download der Rohdaten
│   └── spotify_ch_2014_2022.csv   (nicht im Repo)
├── frontend/
│   ├── index.html           Seite und Kapitelstruktur
│   ├── style.css            Gestaltung
│   ├── script.js            Daten laden, Explorer, Zeitmaschine
│   ├── story.js             Kapitel und Texte aus den Daten
│   └── guide.js             Mixtape-Begleiter, Jahreszeiten-Effekte
└── docs/screenshots/        Screenshots für dieses README
```

## 9. Learnings

> TODO (Team): Eigene Learnings ergänzen – was habt ihr im Projekt gelernt (fachlich, technisch, im Team)?

-
-
-

## 10. Schwierigkeiten und Lösungen

Die folgenden Punkte sind im Code und in den Commits dokumentiert:

| Schwierigkeit | Lösung |
|---|---|
| Artists und Genres stehen in der CSV als Python-Listen (`['…']`); einfaches Ersetzen von `'` durch `"` scheitert bei Namen wie `Guns N' Roses` | Eigener Parser `parsePythonList()`, der die Liste Zeichen für Zeichen liest |
| Artists haben viele, teils widersprüchliche Spotify-Genres (z.B. `dance pop` und `edm`) | Hauptgenres mit fester Priorität und Ausnahmen (`GENRE_RULES`); nicht zuordenbare Genres landen in `Other`, Artists ohne Genre in `Unknown`, beides wird im Qualitätsbericht ausgewiesen |
| Wöchentliche Daten, aber Auswertung pro Monat: Monate haben 4 oder 5 Chart-Wochen | Jede Woche zählt zum Monat ihres Datums; `chart_weeks` wird gespeichert, der Explorer zeigt zusätzlich «Ø pro Woche»; Check «Wochen pro Monat» |
| Der letzte Monat (Dezember 2022) ist vermutlich unvollständig erfasst | Qualitätscheck «Einträge pro Woche»; im Frontend wird der Monat schraffiert und in Aussagen nicht als vollständig gezählt |
| Ein abgebrochener Load hätte die Tabellen halb leer hinterlassen können | Transaktion mit BEGIN/COMMIT/ROLLBACK, Kontrolle vor dem COMMIT, Qualitätschecks vor dem Verbinden |
| `load.php` liegt auf dem Webserver und könnte von allen aufgerufen werden | Aufruf nur im Terminal oder mit geheimem Token |
| Rohdaten sollen nicht öffentlich herunterladbar sein | `data/.htaccess` mit `Require all denied` |

> TODO (Team): Eigene Erfahrungen ergänzen – was war für euch schwierig (z.B. Teamorganisation, Hostpoint, Git), und wie habt ihr es gelöst?

## 11. Ressourcen

| Ressource | Verwendung | Abrufdatum |
|---|---|---|
| Kaggle: [Spotify tracks chart dataset (2014-2022)](https://www.kaggle.com/datasets/jfreyberg/spotify-chart-data/), Julian Freyberg, Version 4 (letzte Aktualisierung 09.04.2023), Lizenz CC BY 4.0 | Rohdaten | Download: TODO (Team) · Metadaten geprüft: 11.11.2026 |
| [kworb.net](https://kworb.net/spotify/) und Spotify Web API | Ursprung der Kaggle-Daten (laut Datensatzbeschreibung) | 11.11.2026 (über die Kaggle-Beschreibung) |
| [Google Fonts](https://fonts.google.com/): Anton, Space Mono | Schriften der Website | TODO (Team) |
| [PHP-Dokumentation](https://www.php.net/manual/de/) (PDO, Transaktionen, `fgetcsv`) | Backend | TODO (Team) |
| Hostpoint (Webhosting, MySQL) | Server und Datenbank | – |
| PhpStorm, GitHub, GitHub Desktop | Entwicklung und Versionsverwaltung | – |
| Claude Code (KI-Assistent von Anthropic) | Unterstützung bei Frontend, ETL, Qualitätschecks und Dokumentation | – |

> TODO (Team): Weitere Quellen (z.B. Unterrichtsunterlagen IM3, Tutorials, Inspirationen) mit Abrufdatum ergänzen.

## 12. Lizenz

- **Daten:** Der Kaggle-Datensatz steht unter [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). Namensnennung: Julian Freyberg, «Spotify tracks chart dataset (2014-2022)», Kaggle. Die Website nennt die Quelle im Abschnitt «Daten & Methode».
- **Code:** TODO (Team) – Lizenz festlegen (z.B. MIT) und als `LICENSE` ablegen. Ohne Lizenzdatei gilt: alle Rechte bei den Autorinnen.
- **Team:** Die Chartjägerinnen, IM3. TODO (Team): Namen ergänzen.
