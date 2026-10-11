<?php

header('Content-Type: text/plain; charset=utf-8');


// ------------------------------------------------------------
// 1. Transform ausführen
// ------------------------------------------------------------

$result = include __DIR__ . '/transform.php';


// ------------------------------------------------------------
// 2. Verbindung zur MySQL-Datenbank herstellen
// ------------------------------------------------------------

require __DIR__ . '/../../config.php';

try {

    $pdo = new PDO(
        $dsn,
        $username,
        $password,
        $options
    );

    echo "Verbindung zur Datenbank steht.\n\n";

} catch (PDOException $e) {

    exit(
        "Verbindung fehlgeschlagen: "
        . $e->getMessage()
        . "\n"
    );
}


// ------------------------------------------------------------
// 3. Alte Monatsresultate löschen
// ------------------------------------------------------------

$pdo->exec('DELETE FROM monthly_results');

echo "Alte Monatsresultate gelöscht.\n\n";


// ------------------------------------------------------------
// 4. SQL vorbereiten
// ------------------------------------------------------------

$insertResult = $pdo->prepare(
    'INSERT INTO monthly_results
        (month, top_genre, genre_streams, top_artist, artist_streams)
     VALUES
        (:month, :top_genre, :genre_streams, :top_artist, :artist_streams)'
);


// ------------------------------------------------------------
// 5. Transformierte Daten speichern
// ------------------------------------------------------------

$count = 0;

foreach ($result as $row) {

    // Aus 2014-01 wird 2014-01-01
    $monthDate = $row['month'] . '-01';

    $insertResult->execute([
        'month' => $monthDate,
        'top_genre' => $row['top_genre'],
        'genre_streams' => (int) $row['genre_streams'],
        'top_artist' => $row['top_artist'],
        'artist_streams' => (int) $row['artist_streams']
    ]);

    $count++;
}


// ------------------------------------------------------------
// 6. Kontrolle
// ------------------------------------------------------------

echo "Monatsresultate gespeichert: " . $count . "\n\n";

$totalResults = $pdo
    ->query('SELECT COUNT(*) FROM monthly_results')
    ->fetchColumn();

echo "Einträge in der Datenbank: " . $totalResults . "\n\n";


// ------------------------------------------------------------
// 7. Erste 5 Einträge anzeigen
// ------------------------------------------------------------

$check = $pdo->query(
    'SELECT
        month,
        top_genre,
        genre_streams,
        top_artist,
        artist_streams
     FROM monthly_results
     ORDER BY month
     LIMIT 5'
);

foreach ($check->fetchAll(PDO::FETCH_ASSOC) as $row) {

    echo $row['month']
        . " | "
        . $row['top_genre']
        . " | "
        . $row['genre_streams']
        . " Streams | "
        . $row['top_artist']
        . " | "
        . $row['artist_streams']
        . " Streams\n";
}