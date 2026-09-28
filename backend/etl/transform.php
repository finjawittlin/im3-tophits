<?php

$file = "../../data/spotify_ch_2022.csv";

$handle = fopen($file, "r");

$data = [];

$headers = fgetcsv($handle, 0, ",", '"', "\\");

while (($row = fgetcsv($handle, 0, ",", '"', "\\")) !== false) {
    $data[] = array_combine($headers, $row);
}

fclose($handle);


// Streams pro Song zusammenzählen
$songs = [];

foreach ($data as $row) {

    $trackId = $row["track_id"];

    if (!isset($songs[$trackId])) {
        $songs[$trackId] = [
            "name" => $row["name"],
            "artists" => $row["artists"],
            "streams" => 0
        ];
    }

    $songs[$trackId]["streams"] += (int) $row["streams"];
}


// Songs nach Streams sortieren
$songs = array_values($songs);

usort($songs, function ($a, $b) {
    return $b["streams"] <=> $a["streams"];
});

// Nur die Top 10 Songs behalten
$topSongs = array_slice($songs, 0, 10);

print_r($topSongs);