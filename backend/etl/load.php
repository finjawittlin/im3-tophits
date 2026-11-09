<?php

// ------------------------------------------------------------
// Load
//
// Schreibt die Resultate aus transform.php in die Datenbank.
// ACHTUNG: ersetzt den gesamten Inhalt von monthly_results
// und monthly_genre_streams.
//
// Aufruf:
//   Terminal:  php backend/etl/load.php
//   Browser:   load.php?token=<$etlToken aus config.php>
// ------------------------------------------------------------

header('Content-Type: text/plain; charset=utf-8');

require __DIR__ . '/../../config.php';


// ------------------------------------------------------------
// 0. Schutz: im Browser nur mit geheimem Token
// ------------------------------------------------------------

if (PHP_SAPI !== 'cli') {

    $token = $_GET['token'] ?? '';

    if (empty($etlToken) || !hash_equals((string) $etlToken, (string) $token)) {
        http_response_code(403);
        exit("Kein Zugriff. Load nur per Terminal oder mit gültigem Token.\n");
    }
}


// ------------------------------------------------------------
// 1. Transform ausführen
// ------------------------------------------------------------

$result = include __DIR__ . '/transform.php';

$monthlyResults = $result['monthly_results'];
$monthlyGenreStreams = $result['monthly_genre_streams'];

if (count($monthlyResults) === 0) {
    exit("Transform lieferte keine Daten. Datenbank wurde nicht verändert.\n");
}


// ------------------------------------------------------------
// 2. Verbindung zur Datenbank herstellen
// ------------------------------------------------------------

try {

    $pdo = new PDO($dsn, $username, $password, $options);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Verbindung zur Datenbank steht.\n\n";

} catch (PDOException $e) {

    // Keine Details ausgeben (könnten Zugangsdaten enthalten)
    exit("Verbindung zur Datenbank fehlgeschlagen.\n");
}


// ------------------------------------------------------------
// 3. Tabellen anlegen, falls sie fehlen (nur MySQL)
// ------------------------------------------------------------

if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {

    $schema = file_get_contents(__DIR__ . '/schema.sql');

    // Kommentare entfernen und an ";" aufteilen
    $schema = preg_replace('/^\s*--.*$/m', '', $schema);

    foreach (array_filter(array_map('trim', explode(';', $schema))) as $statement) {
        $pdo->exec($statement);
    }
}


// ------------------------------------------------------------
// 4. Daten in einer Transaktion ersetzen
// ------------------------------------------------------------
// Schlägt etwas fehl, bleibt der alte Datenbestand erhalten.

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

    $pdo->beginTransaction();

    $pdo->exec('DELETE FROM monthly_results');
    $pdo->exec('DELETE FROM monthly_genre_streams');

    foreach ($monthlyResults as $row) {
        // Aus 2014-01 wird 2014-01-01
        $row['month'] .= '-01';
        $insertResult->execute($row);
    }

    foreach ($monthlyGenreStreams as $row) {
        $row['month'] .= '-01';
        $insertGenre->execute($row);
    }

    $pdo->commit();

} catch (PDOException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    exit("Fehler beim Speichern – alte Daten bleiben erhalten.\n");
}


// ------------------------------------------------------------
// 5. Kontrolle
// ------------------------------------------------------------

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
