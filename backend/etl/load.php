<?php

header('Content-Type: text/plain; charset=utf-8');


// ------------------------------------------------------------
// 1. Transform ausführen
// ------------------------------------------------------------

$result = include __DIR__ . '/transform.php';


// ------------------------------------------------------------
// 2. Verbindung zur MySQL-Datenbank herstellen
// ------------------------------------------------------------
//
// Die Zugangsdaten liegen in config.php.
// Diese Datei darf NICHT auf GitHub landen.

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
// 3. Alte Daten löschen
// ------------------------------------------------------------
//
// Wir laden die Daten jedes Mal neu.
// Deshalb löschen wir zuerst die alten Chart-Einträge.

$pdo->exec('DELETE FROM chart_entries');
$pdo->exec('DELETE FROM songs');

echo "Alte Daten gelöscht.\n\n";


// ------------------------------------------------------------
// 4. SQL vorbereiten
// ------------------------------------------------------------

$findSong = $pdo->prepare(
    'SELECT id
     FROM songs
     WHERE track_id = ?'
);

$insertSong = $pdo->prepare(
    'INSERT INTO songs
        (track_id, name, artists, genres)
     VALUES
        (:track_id, :name, :artists, :genres)'
);

$insertChartEntry = $pdo->prepare(
    'INSERT INTO chart_entries
        (song_id, date, country, position, streams)
     VALUES
        (:song_id, :date, :country, :position, :streams)'
);


// ------------------------------------------------------------
// 5. Daten aus dem Transform in die Datenbank schreiben
// ------------------------------------------------------------

$songCount = 0;
$chartCount = 0;

foreach ($result as $row) {

    // --------------------------------------------------------
    // Song suchen
    // --------------------------------------------------------

    $findSong->execute([
        $row['track_id']
    ]);

    $songId = $findSong->fetchColumn();


    // --------------------------------------------------------
    // Falls der Song noch nicht existiert: anlegen
    // --------------------------------------------------------

    if ($songId === false) {

        $insertSong->execute([
            'track_id' => $row['track_id'],
            'name' => $row['name'],
            'artists' => json_encode(
                $row['artists'],
                JSON_UNESCAPED_UNICODE
            ),
            'genres' => json_encode(
                $row['genres'],
                JSON_UNESCAPED_UNICODE
            )
        ]);

        $songId = $pdo->lastInsertId();

        $songCount++;
    }


    // --------------------------------------------------------
    // Chart-Eintrag speichern
    // --------------------------------------------------------

    $insertChartEntry->execute([
        'song_id' => $songId,
        'date' => $row['date'],
        'country' => $row['country'],
        'position' => (int) $row['position'],
        'streams' => (int) $row['streams']
    ]);

    $chartCount++;
}


// ------------------------------------------------------------
// 6. Kontrolle
// ------------------------------------------------------------

echo "Songs gespeichert: " . $songCount . "\n";
echo "Chart-Einträge gespeichert: " . $chartCount . "\n\n";


// ------------------------------------------------------------
// 7. Kontrolle aus der Datenbank
// ------------------------------------------------------------

$totalSongs = $pdo
    ->query('SELECT COUNT(*) FROM songs')
    ->fetchColumn();

$totalEntries = $pdo
    ->query('SELECT COUNT(*) FROM chart_entries')
    ->fetchColumn();


echo "Songs in der Datenbank: " . $totalSongs . "\n";
echo "Chart-Einträge in der Datenbank: " . $totalEntries . "\n\n";


// ------------------------------------------------------------
// 8. Einige Daten wieder auslesen
// ------------------------------------------------------------

$check = $pdo->query(
    'SELECT
        chart_entries.date,
        chart_entries.country,
        chart_entries.position,
        chart_entries.streams,
        songs.name,
        songs.artists,
        songs.genres
     FROM chart_entries
     JOIN songs
        ON chart_entries.song_id = songs.id
     ORDER BY chart_entries.date
     LIMIT 5'
);

foreach ($check->fetchAll(PDO::FETCH_ASSOC) as $row) {

    echo $row['date']
        . " | "
        . $row['name']
        . " | Position "
        . $row['position']
        . " | "
        . $row['streams']
        . " Streams\n";
}