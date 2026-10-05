-- Datenbankstruktur für unsere Spotify-Data-Story
--
-- Für jeden Monat zwischen 2014 und 2022 speichern wir:
-- 1. das meistgestreamte Genre
-- 2. die Streams dieses Genres
-- 3. den Top Artist innerhalb dieses Genres
-- 4. die Streams dieses Artists


-- ------------------------------------------------------------
-- Monatliche Resultate
-- ------------------------------------------------------------

CREATE TABLE monthly_results (
                                 id INT AUTO_INCREMENT PRIMARY KEY,

                                 month DATE NOT NULL UNIQUE,

                                 top_genre VARCHAR(100) NOT NULL,

                                 genre_streams BIGINT NOT NULL,

                                 top_artist VARCHAR(255) NOT NULL,

                                 artist_streams BIGINT NOT NULL
);