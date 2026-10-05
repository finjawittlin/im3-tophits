<?php

$file = __DIR__ . "/../../data/spotify_ch_2014_2022.csv";

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

    // Spezieller Fall:
    // "dance pop" oder "pop dance" soll zu Pop gehören
    if (
        str_contains($genreText, "dance pop") ||
        str_contains($genreText, "pop dance")
    ) {
        return "Pop";
    }

    $genreRules = [

        "Hip-Hop / Rap" => [
            "rap",
            "hip hop",
            "trap",
            "drill"
        ],

        "R&B / Soul" => [
            "r&b",
            "soul"
        ],

        "Rock" => [
            "rock",
            "metal",
            "punk"
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

        "Electronic / Dance" => [
            "edm",
            "house",
            "techno",
            "electro",
            "dance",
            "brostep"
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
// Kopfzeile lesen
// --------------------------------------------------

$headers = fgetcsv($handle, 0, ",", '"', "\\");


// --------------------------------------------------
// Speicher vorbereiten
// --------------------------------------------------

// Streams pro Monat und Genre
$monthlyGenreStreams = [];

// Streams pro Monat, Genre und Artist
$monthlyGenreArtistStreams = [];


// --------------------------------------------------
// CSV Zeile für Zeile verarbeiten
// --------------------------------------------------

while (($row = fgetcsv($handle, 0, ",", '"', "\\")) !== false) {

    if (count($row) !== count($headers)) {
        continue;
    }

    $row = array_combine($headers, $row);


    // --------------------------------------------------
    // Datum
    // --------------------------------------------------

    $date = DateTime::createFromFormat(
        "Y/m/d",
        $row["date"]
    );

    if ($date === false) {
        continue;
    }

    $monthKey = $date->format("Y-m");


    // --------------------------------------------------
    // Streams
    // --------------------------------------------------

    $streams = (int) $row["streams"];


    // --------------------------------------------------
    // Genres
    // --------------------------------------------------

    $genres = json_decode(
        str_replace("'", '"', $row["artist_genres"]),
        true
    );

    if (!is_array($genres)) {
        $genres = [];
    }

    $mainGenre = getMainGenre($genres);


    // --------------------------------------------------
    // Artists
    // --------------------------------------------------

    $artists = json_decode(
        str_replace("'", '"', $row["artists"]),
        true
    );

    if (!is_array($artists) || count($artists) === 0) {
        $artists = ["Unknown"];
    }

    // Nur erster Artist zählt als Hauptartist
    $mainArtist = $artists[0];


    // --------------------------------------------------
    // Streams pro Monat + Genre addieren
    // --------------------------------------------------

    if (!isset($monthlyGenreStreams[$monthKey])) {
        $monthlyGenreStreams[$monthKey] = [];
    }

    if (!isset($monthlyGenreStreams[$monthKey][$mainGenre])) {
        $monthlyGenreStreams[$monthKey][$mainGenre] = 0;
    }

    $monthlyGenreStreams[$monthKey][$mainGenre] += $streams;


    // --------------------------------------------------
    // Streams pro Monat + Genre + Artist addieren
    // --------------------------------------------------

    if (!isset($monthlyGenreArtistStreams[$monthKey])) {
        $monthlyGenreArtistStreams[$monthKey] = [];
    }

    if (!isset($monthlyGenreArtistStreams[$monthKey][$mainGenre])) {
        $monthlyGenreArtistStreams[$monthKey][$mainGenre] = [];
    }

    if (!isset($monthlyGenreArtistStreams[$monthKey][$mainGenre][$mainArtist])) {
        $monthlyGenreArtistStreams[$monthKey][$mainGenre][$mainArtist] = 0;
    }

    $monthlyGenreArtistStreams[$monthKey][$mainGenre][$mainArtist] += $streams;
}

fclose($handle);


// --------------------------------------------------
// Monate sortieren
// --------------------------------------------------

ksort($monthlyGenreStreams);


// --------------------------------------------------
// Resultate vorbereiten
// --------------------------------------------------

$results = [];

foreach ($monthlyGenreStreams as $month => $genres) {

    // Genres nach Streams sortieren
    arsort($genres);

    // Top Genre
    $topGenre = array_key_first($genres);
    $topGenreStreams = $genres[$topGenre];

    // Artists nur aus dem Top Genre holen
    $artistsInTopGenre =
        $monthlyGenreArtistStreams[$month][$topGenre] ?? [];

    arsort($artistsInTopGenre);

    $topArtist = array_key_first($artistsInTopGenre);

    $topArtistStreams = $topArtist !== null
        ? $artistsInTopGenre[$topArtist]
        : 0;

    $results[] = [
        "month" => $month,
        "top_genre" => $topGenre,
        "genre_streams" => $topGenreStreams,
        "top_artist" => $topArtist,
        "artist_streams" => $topArtistStreams
    ];
}

return $results;