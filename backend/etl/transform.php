<?php

$file = "../../data/spotify_ch_2014_2022.csv";

$handle = fopen($file, "r");

if ($handle === false) {
    exit("CSV-Datei konnte nicht geöffnet werden.");
}


// --------------------------------------------------
// Hauptgenre bestimmen
// --------------------------------------------------

function getMainGenre($genres)
{
    $genreText = strtolower(implode(" ", $genres));

    $genreRules = [
        "Electronic / Dance" => [
            "edm",
            "house",
            "techno",
            "electro",
            "dance",
            "brostep"
        ],

        "Hip-Hop / Rap" => [
            "rap",
            "hip hop",
            "trap",
            "drill"
        ],

        "Rock" => [
            "rock",
            "metal",
            "punk"
        ],

        "R&B / Soul" => [
            "r&b",
            "soul"
        ],

        "Latin" => [
            "latin",
            "reggaeton",
            "bachata"
        ],

        "Indie / Alternative" => [
            "indie",
            "alternative"
        ],

        "Pop" => [
            "pop"
        ]
    ];

    foreach ($genreRules as $mainGenre => $keywords) {
        foreach ($keywords as $keyword) {
            if (str_contains($genreText, $keyword)) {
                return $mainGenre;
            }
        }
    }

    return "Other";
}


// --------------------------------------------------
// CSV lesen
// --------------------------------------------------

$headers = fgetcsv($handle, 0, ",", '"', "\\");

$monthlyGenreStreams = [];

while (($row = fgetcsv($handle, 0, ",", '"', "\\")) !== false) {

    // Nur vollständige Zeilen übernehmen
    if (count($row) !== count($headers)) {
        continue;
    }

    $row = array_combine($headers, $row);


    // --------------------------------------------------
    // Genres aus CSV-Text in Array umwandeln
    // --------------------------------------------------

    $genres = json_decode(
        str_replace("'", '"', $row["artist_genres"]),
        true
    );

    if (!is_array($genres)) {
        $genres = [];
    }


    // --------------------------------------------------
    // Hauptgenre bestimmen
    // --------------------------------------------------

    $mainGenre = getMainGenre($genres);


    // --------------------------------------------------
    // Datum einlesen
    // --------------------------------------------------

    $date = DateTime::createFromFormat(
        "Y/m/d",
        $row["date"]
    );

    if ($date === false) {
        continue;
    }


    // Jahr und Monat bilden
    // Beispiel: 2022-01
    $monthKey = $date->format("Y-m");


    // --------------------------------------------------
    // Streams in Zahl umwandeln
    // --------------------------------------------------

    $streams = (int) $row["streams"];


    // --------------------------------------------------
    // Monat vorbereiten
    // --------------------------------------------------

    if (!isset($monthlyGenreStreams[$monthKey])) {
        $monthlyGenreStreams[$monthKey] = [];
    }


    // --------------------------------------------------
    // Genre vorbereiten
    // --------------------------------------------------

    if (!isset($monthlyGenreStreams[$monthKey][$mainGenre])) {
        $monthlyGenreStreams[$monthKey][$mainGenre] = 0;
    }


    // --------------------------------------------------
    // Streams addieren
    // --------------------------------------------------

    $monthlyGenreStreams[$monthKey][$mainGenre] += $streams;
}

fclose($handle);


// --------------------------------------------------
// Nach Monaten sortieren
// --------------------------------------------------

ksort($monthlyGenreStreams);


// --------------------------------------------------
// Genres innerhalb jedes Monats nach Streams sortieren
// --------------------------------------------------

foreach ($monthlyGenreStreams as $month => &$genres) {
    arsort($genres);
}

unset($genres);


// --------------------------------------------------
// Ausgabe
// --------------------------------------------------

foreach ($monthlyGenreStreams as $month => $genres) {

    echo $month . PHP_EOL;

    foreach ($genres as $genre => $streams) {

        echo "  "
            . $genre
            . ": "
            . number_format($streams, 0, ".", "'")
            . " Streams"
            . PHP_EOL;
    }

    echo PHP_EOL;
}