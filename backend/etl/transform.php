<?php

$file = "../../data/spotify_ch_2022.csv";

$handle = fopen($file, "r");

if ($handle === false) {
    exit("CSV-Datei konnte nicht geöffnet werden.");
}

$data = [];

// Kopfzeile lesen
$headers = fgetcsv($handle, 0, ",", '"', "\\");

while (($row = fgetcsv($handle, 0, ",", '"', "\\")) !== false) {

    // Nur vollständige Zeilen übernehmen
    if (count($row) !== count($headers)) {
        continue;
    }

    $data[] = array_combine($headers, $row);
}

fclose($handle);


// --------------------------------------------------
// Daten transformieren
// --------------------------------------------------

$transformedData = [];

foreach ($data as $row) {

    // Artists aus dem CSV-Text in ein Array umwandeln
    $artists = json_decode(
        str_replace("'", '"', $row["artists"]),
        true
    );

    if (!is_array($artists)) {
        $artists = [$row["artists"]];
    }


    // Genres aus dem CSV-Text in ein Array umwandeln
    $genres = json_decode(
        str_replace("'", '"', $row["artist_genres"]),
        true
    );

    if (!is_array($genres)) {
        $genres = [];
    }


    // Datum vereinheitlichen
    $date = DateTime::createFromFormat("Y/m/d", $row["date"]);

    if ($date !== false) {
        $formattedDate = $date->format("Y-m-d");
    } else {
        $formattedDate = null;
    }


    // Eine transformierte Zeile erstellen
    $transformedData[] = [
        "date" => $formattedDate,
        "country" => $row["country"],
        "position" => (int) $row["position"],
        "streams" => (int) $row["streams"],
        "track_id" => $row["track_id"],
        "name" => $row["name"],
        "artists" => $artists,
        "genres" => $genres
    ];
}


// --------------------------------------------------
// Ergebnis zurückgeben
// --------------------------------------------------

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($transformedData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} else {
    return $transformedData;
}