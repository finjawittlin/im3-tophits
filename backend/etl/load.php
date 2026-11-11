<?php

// ------------------------------------------------------------
// Load
//
// Schreibt die Resultate aus transform.php in die Datenbank.
// ACHTUNG: ersetzt den gesamten Inhalt von monthly_results
// und monthly_genre_streams.
//
// Ablauf:
//   1. Extract + Transform + Qualitätschecks (ohne Datenbank)
//   2. bei FEHLER in den Checks: Abbruch, Datenbank bleibt unverändert
//   3. BEGIN – alte Zeilen löschen, neue einfügen, Anzahl kontrollieren
//   4. COMMIT – oder bei jedem Fehler ROLLBACK (alte Daten bleiben)
//
// Aufruf:
//   Terminal:  php backend/etl/load.php
//   Probelauf: php backend/etl/transform.php   (nur Checks, keine Datenbank)
//   Browser:   load.php?token=<$etlToken aus config.php>
// ------------------------------------------------------------

header('Content-Type: text/plain; charset=utf-8');

function loadFail(string $message, int $status = 500): void
{
    if (PHP_SAPI !== 'cli') {
        http_response_code($status);
    }

    echo $message . "\n";
    exit(1);
}

if (!is_file(__DIR__ . '/../../config.php')) {
    loadFail("config.php fehlt. Vorlage: config.template.php kopieren und ausfüllen.");
}

require __DIR__ . '/../../config.php';


// ------------------------------------------------------------
// 0. Schutz: im Browser nur mit geheimem Token
// ------------------------------------------------------------

if (PHP_SAPI !== 'cli') {

    $token = $_GET['token'] ?? '';

    if (empty($etlToken) || !hash_equals((string) $etlToken, (string) $token)) {
        loadFail("Kein Zugriff. Load nur per Terminal oder mit gültigem Token.", 403);
    }
}


// ------------------------------------------------------------
// 1. Nur ein Load gleichzeitig
// ------------------------------------------------------------

$lock = fopen(sys_get_temp_dir() . '/im3-tophits-load.lock', 'c');

if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
    loadFail("Es läuft bereits ein Load. Bitte später nochmals versuchen.", 409);
}


// ------------------------------------------------------------
// 2. Extract + Transform + Qualitätschecks
// ------------------------------------------------------------

try {
    $result = include __DIR__ . '/transform.php';
} catch (Throwable $e) {
    loadFail("Extract/Transform fehlgeschlagen: " . $e->getMessage() . "\nDatenbank wurde nicht verändert.");
}

echo qualityReport($result['quality']) . "\n";

if (qualityHasErrors($result['quality'])) {
    loadFail("Abbruch wegen Qualitätsfehlern. Datenbank wurde nicht verändert.", 422);
}

$monthlyResults = $result['monthly_results'];
$monthlyGenreStreams = $result['monthly_genre_streams'];

if (count($monthlyResults) === 0 || count($monthlyGenreStreams) === 0) {
    loadFail("Transform lieferte keine Daten. Datenbank wurde nicht verändert.", 422);
}


// ------------------------------------------------------------
// 3. Verbindung zur Datenbank herstellen
// ------------------------------------------------------------

try {

    $pdo = new PDO($dsn, $username, $password, $options ?? []);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Verbindung zur Datenbank steht.\n";

} catch (PDOException $e) {

    // Keine Details ausgeben (könnten Zugangsdaten enthalten)
    loadFail("Verbindung zur Datenbank fehlgeschlagen. Datenbank wurde nicht verändert.");
}

$isMysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';


// ------------------------------------------------------------
// 4. Tabellen anlegen, falls sie fehlen (nur MySQL)
// ------------------------------------------------------------
// CREATE TABLE beendet in MySQL jede offene Transaktion automatisch.
// Darum passiert das VOR dem BEGIN.

if ($isMysql) {

    try {
        $schema = file_get_contents(__DIR__ . '/schema.sql');

        // Kommentare entfernen und an ";" aufteilen
        $schema = preg_replace('/^\s*--.*$/m', '', $schema);

        foreach (array_filter(array_map('trim', explode(';', $schema))) as $statement) {
            $pdo->exec($statement);
        }

        // Transaktionen funktionieren nur mit InnoDB (nicht mit MyISAM)
        $engines = $pdo->query(
            "SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME IN ('monthly_results', 'monthly_genre_streams')"
        )->fetchAll(PDO::FETCH_KEY_PAIR);

        foreach ($engines as $table => $engine) {
            if (strcasecmp((string) $engine, 'InnoDB') !== 0) {
                loadFail("Tabelle $table nutzt $engine statt InnoDB – ROLLBACK wäre nicht möglich. Abbruch, Datenbank wurde nicht verändert.");
            }
        }

    } catch (PDOException $e) {
        loadFail("Tabellen konnten nicht geprüft/angelegt werden. Datenbank-Inhalte wurden nicht verändert.");
    }
}


// ------------------------------------------------------------
// 5. Daten in EINER Transaktion ersetzen
// ------------------------------------------------------------
// BEGIN -> DELETE -> INSERT -> Kontrolle -> COMMIT
// Schlägt irgendetwas fehl: ROLLBACK, der alte Datenbestand bleibt.

$step = 'Vorbereitung';

try {

    $insertResult = $pdo->prepare(
        'INSERT INTO monthly_results
            (month, top_genre, genre_streams, top_artist, artist_streams)
         VALUES
            (:month, :top_genre, :genre_streams, :top_artist, :artist_streams)'
    );

    $insertGenre = $pdo->prepare(
        'INSERT INTO monthly_genre_streams
            (month, genre, streams, chart_weeks, chart_entries, explicit_streams,
             top_artist, artist_streams, top_track, top_track_artist, top_track_streams)
         VALUES
            (:month, :genre, :streams, :chart_weeks, :chart_entries, :explicit_streams,
             :top_artist, :artist_streams, :top_track, :top_track_artist, :top_track_streams)'
    );

    $step = 'BEGIN';
    $pdo->beginTransaction();

    $step = 'alte Daten löschen';
    $pdo->exec('DELETE FROM monthly_results');
    $pdo->exec('DELETE FROM monthly_genre_streams');

    foreach ($monthlyResults as $row) {
        $step = "monthly_results {$row['month']}";
        // Aus 2014-01 wird 2014-01-01
        $row['month'] .= '-01';
        $insertResult->execute($row);
    }

    foreach ($monthlyGenreStreams as $row) {
        $step = "monthly_genre_streams {$row['month']} · {$row['genre']}";
        $row['month'] .= '-01';
        $insertGenre->execute($row);
    }

    // Kontrolle vor dem COMMIT: stimmt die Anzahl Zeilen?
    $step = 'Kontrolle';
    $countResults = (int) $pdo->query('SELECT COUNT(*) FROM monthly_results')->fetchColumn();
    $countGenres = (int) $pdo->query('SELECT COUNT(*) FROM monthly_genre_streams')->fetchColumn();
    $sumGenres = (int) $pdo->query('SELECT COALESCE(SUM(streams), 0) FROM monthly_genre_streams')->fetchColumn();
    $expectedSum = array_sum(array_column($monthlyGenreStreams, 'streams'));

    if ($countResults !== count($monthlyResults) || $countGenres !== count($monthlyGenreStreams) || $sumGenres !== $expectedSum) {
        throw new RuntimeException(
            "Kontrolle fehlgeschlagen: $countResults/" . count($monthlyResults) . " Monate, "
            . "$countGenres/" . count($monthlyGenreStreams) . " Genre-Zeilen, "
            . "Streams $sumGenres/$expectedSum"
        );
    }

    $step = 'COMMIT';
    $pdo->commit();

} catch (Throwable $e) {

    $rolledBack = false;

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
        $rolledBack = true;
    }

    // Bei Datenbankfehlern nur den SQLSTATE zeigen (keine Zugangsdaten)
    $reason = $e instanceof PDOException ? 'SQLSTATE ' . $e->getCode() : $e->getMessage();

    loadFail(
        "Fehler beim Schritt «" . $step . "» ($reason).\n"
        . ($rolledBack ? "ROLLBACK ausgeführt – alte Daten bleiben erhalten." : "Keine Transaktion offen – Datenbank wurde nicht verändert.")
    );
}


// ------------------------------------------------------------
// 6. Bericht
// ------------------------------------------------------------

echo "COMMIT erfolgreich.\n";
echo "Monatsresultate gespeichert: " . count($monthlyResults) . "\n";
echo "Genre-Monatswerte gespeichert: " . count($monthlyGenreStreams) . "\n\n";

$check = $pdo->query(
    'SELECT month, top_genre, genre_streams, top_artist, artist_streams
     FROM monthly_results
     ORDER BY month
     LIMIT 5'
);

foreach ($check->fetchAll(PDO::FETCH_ASSOC) as $row) {

    echo $row['month']
        . " | " . $row['top_genre']
        . " | " . $row['genre_streams'] . " Streams"
        . " | " . $row['top_artist']
        . " | " . $row['artist_streams'] . " Streams\n";
}
