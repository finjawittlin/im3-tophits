-- Datenbankstruktur für unser Spotify-Data-Story-Projekt
--
-- Die CSV enthält Chart-Einträge für verschiedene Zeitpunkte.
-- Ein Song kann deshalb mehrfach vorkommen.
--
-- Wir trennen deshalb:
--
-- 1. songs
--    Informationen, die zum Song gehören:
--    Name, Artists und Genres
--
-- 2. chart_entries
--    Informationen, die sich pro Chart-Eintrag ändern:
--    Datum, Land, Position und Streams


-- ------------------------------------------------------------
-- 1. Songs
-- ------------------------------------------------------------

CREATE TABLE songs (
                       id INT AUTO_INCREMENT PRIMARY KEY,

                       track_id VARCHAR(50) NOT NULL UNIQUE,

                       name VARCHAR(255) NOT NULL,

                       artists TEXT,

                       genres TEXT
);


-- ------------------------------------------------------------
-- 2. Chart-Einträge
-- ------------------------------------------------------------

CREATE TABLE chart_entries (
                               id INT AUTO_INCREMENT PRIMARY KEY,

                               song_id INT NOT NULL,

                               date DATE NOT NULL,

                               country VARCHAR(10) NOT NULL,

                               position INT NOT NULL,

                               streams INT NOT NULL,

                               FOREIGN KEY (song_id) REFERENCES songs(id)
);