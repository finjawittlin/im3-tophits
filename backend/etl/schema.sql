-- Das Datenmodell für die Spotify Top-Hits-Daten.
--
-- Anlegen in phpMyAdmin: diesen Text im Reiter «SQL» einfügen und
-- ausführen.
--
-- Angelegt wird die Struktur einmal von Hand.
-- Gefüllt wird sie danach von load.php.

CREATE TABLE songs (
                       id        INT AUTO_INCREMENT PRIMARY KEY,
                       track_id  VARCHAR(50) NOT NULL,
                       name      VARCHAR(255) NOT NULL,
                       artists   VARCHAR(255) NOT NULL,
                       streams   INT NOT NULL
);