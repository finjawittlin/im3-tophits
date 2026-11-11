<?php

// ------------------------------------------------------------
// API für das Frontend (nur lesend)
//
//   ?resource=months   (Standard) Top Genre + Top Artist pro Monat
//                      aus monthly_results
//   ?resource=genres   Streams pro Monat und Genre
//                      aus monthly_genre_streams
//                      (leere Liste, falls die Tabelle noch fehlt)
// ------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=300');

require __DIR__ . '/../../config.php';

function sendJson($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// Datum "2014-01-01" -> "2014-01" und Zahlenfelder als Integer
function formatRows(array $rows, array $intFields): array
{
    foreach ($rows as &$row) {
        $row['month'] = substr($row['month'], 0, 7);

        foreach ($intFields as $field) {
            $row[$field] = (int) $row[$field];
        }
    }
    unset($row);

    return $rows;
}

try {
    $pdo = new PDO($dsn, $username, $password, $options);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    sendJson(["error" => "Datenbankverbindung fehlgeschlagen"], 500);
}

$resource = $_GET['resource'] ?? 'months';

try {

    if ($resource === 'months') {

        $rows = $pdo->query(
            'SELECT month, top_genre, genre_streams, top_artist, artist_streams
             FROM monthly_results
             ORDER BY month'
        )->fetchAll(PDO::FETCH_ASSOC);

        sendJson(formatRows($rows, ['genre_streams', 'artist_streams']));
    }

    if ($resource === 'genres') {

        try {
            $rows = $pdo->query(
                'SELECT month, genre, streams, chart_weeks, chart_entries, explicit_streams,
                        top_artist, artist_streams, top_track, top_track_artist, top_track_streams
                 FROM monthly_genre_streams
                 ORDER BY month, streams DESC'
            )->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            // Tabelle existiert noch nicht -> Frontend nutzt nur monthly_results
            sendJson([]);
        }

        sendJson(formatRows($rows, [
            'streams', 'chart_weeks', 'chart_entries', 'explicit_streams',
            'artist_streams', 'top_track_streams'
        ]));
    }

    sendJson(["error" => "Unbekannte Ressource"], 400);

} catch (PDOException $e) {
    sendJson(["error" => "Datenbankabfrage fehlgeschlagen"], 500);
}
