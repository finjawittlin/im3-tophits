-- Datenbankstruktur für unsere Spotify-Data-Story
--
-- Wird von load.php automatisch ausgeführt, falls eine Tabelle fehlt.
-- Bestehende Tabellen werden dabei NICHT verändert (IF NOT EXISTS).


-- ------------------------------------------------------------
-- 1. Monatliche Resultate
-- ------------------------------------------------------------
-- Für jeden Monat zwischen 2014 und 2022:
-- das meistgestreamte Genre, dessen Streams,
-- der Top Artist innerhalb dieses Genres und dessen Streams.

CREATE TABLE IF NOT EXISTS monthly_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month DATE NOT NULL UNIQUE,
    top_genre VARCHAR(100) NOT NULL,
    genre_streams BIGINT NOT NULL,
    top_artist VARCHAR(255) NOT NULL,
    artist_streams BIGINT NOT NULL
) DEFAULT CHARSET = utf8mb4;


-- ------------------------------------------------------------
-- 2. Streams pro Monat und Genre (alle Genres, nicht nur das Top Genre)
-- ------------------------------------------------------------
-- Ermöglicht Ranglisten, Jahreszeiten-Auswertungen und Zeitverläufe.
--
-- chart_weeks      Anzahl Chart-Wochen im Monat (4 oder 5) –
--                  für faire Vergleiche "Streams pro Woche"
-- chart_entries    Anzahl Chart-Einträge (Song × Woche) des Genres
-- explicit_streams Streams von Songs mit Explicit-Kennzeichnung

CREATE TABLE IF NOT EXISTS monthly_genre_streams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month DATE NOT NULL,
    genre VARCHAR(100) NOT NULL,
    streams BIGINT NOT NULL,
    chart_weeks TINYINT NOT NULL,
    chart_entries INT NOT NULL,
    explicit_streams BIGINT NOT NULL,
    top_artist VARCHAR(255) NOT NULL,
    artist_streams BIGINT NOT NULL,
    top_track VARCHAR(255) NOT NULL,
    top_track_artist VARCHAR(255) NOT NULL,
    top_track_streams BIGINT NOT NULL,
    UNIQUE KEY month_genre (month, genre)
) DEFAULT CHARSET = utf8mb4;
