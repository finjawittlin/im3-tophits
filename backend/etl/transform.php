<?php

// ------------------------------------------------------------
// Transform
//
// Liest die Schweizer Spotify-Charts (wöchentlich) und berechnet:
//
// 1. monthly_results          pro Monat: Top Genre + Top Artist darin
// 2. monthly_genre_streams    pro Monat UND Genre: Streams, Top Artist,
//                             Top Song, Explicit-Streams, Chart-Wochen
//
// Wird von load.php per include aufgerufen und gibt beide Listen zurück.
// ------------------------------------------------------------

$csvFile = $csvFile ?? __DIR__ . "/../../data/spotify_ch_2014_2022.csv";

$handle = fopen($csvFile, "r");

if ($handle === false) {
    exit("CSV-Datei konnte nicht geöffnet werden.");
}


// --------------------------------------------------
// Python-Liste aus der CSV lesen
// --------------------------------------------------
// Die CSV speichert Listen im Python-Format, z.B.
//   ['dance pop', 'edm']   oder   ["Guns N' Roses"]
// Ein einfaches Ersetzen von ' durch " scheitert bei Apostrophen
// in Namen. Darum wird die Liste Zeichen für Zeichen gelesen.

function parsePythonList(string $text): array
{
    $items = [];
    $length = strlen($text);
    $i = 0;

    while ($i < $length) {

        $quote = $text[$i];

        if ($quote !== "'" && $quote !== '"') {
            $i++;
            continue;
        }

        $value = "";
        $i++;

        while ($i < $length && $text[$i] !== $quote) {

            if ($text[$i] === "\\" && $i + 1 < $length) {
                $i++;
            }

            $value .= $text[$i];
            $i++;
        }

        $items[] = $value;
        $i++;
    }

    return $items;
}


// --------------------------------------------------
// Hauptgenre bestimmen
// --------------------------------------------------
// Jedes Spotify-Genre eines Artists wird einzeln geprüft.
// Die Reihenfolge der Kategorien bestimmt die Priorität:
// besitzt ein Artist ein Genre einer früheren Kategorie,
// gewinnt diese Kategorie.
//
// - Latin steht vor Hip-Hop, damit "trap latino" zu Latin zählt.
// - "dance pop", "pop dance" und "electropop" zählen nicht als
//   Electronic. Eindeutig elektronische Genres (edm, house, …)
//   gewinnen aber vor Pop – so wie im README beschrieben.

const GENRE_RULES = [

    "Latin" => '/latin|reggaeton|bachata|urbano|cumbia|salsa|\bsertanejo/',

    "Hip-Hop / Rap" => '/hip hop|rap\b|\btrap\b|drill|grime/',

    "R&B / Soul" => '/r&b|\bsoul\b|neo soul/',

    "Rock" => '/rock|metal|punk|grunge/',

    "Indie / Alternative" => '/indie|alternative/',

    "Electronic / Dance" => '/\bedm\b|house|techno|\belectro\b|electro house|brostep|dubstep|trance|big room|drum and bass|\bdance\b/',

    "Pop" => '/pop/'
];

function classifyGenreTag(string $tag): ?string
{
    $tag = strtolower(trim($tag));

    foreach (GENRE_RULES as $mainGenre => $pattern) {

        // Pop-Varianten sollen nicht wegen "dance"/"electro" Electronic werden
        if (
            $mainGenre === "Electronic / Dance" &&
            preg_match('/dance pop|pop dance|electropop|dancehall/', $tag)
        ) {
            continue;
        }

        if (preg_match($pattern, $tag)) {
            return $mainGenre;
        }
    }

    return null;
}

function getMainGenre(array $genres): string
{
    $found = [];

    foreach ($genres as $tag) {
        $mainGenre = classifyGenreTag($tag);

        if ($mainGenre !== null) {
            $found[$mainGenre] = true;
        }
    }

    // Kategorie mit der höchsten Priorität gewinnt
    foreach (array_keys(GENRE_RULES) as $mainGenre) {
        if (isset($found[$mainGenre])) {
            return $mainGenre;
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

// Chart-Wochen pro Monat (verschiedene Chart-Daten)
$monthWeeks = [];

// Pro Monat + Genre: Streams, Artists, Songs, Explicit
$stats = [];


// --------------------------------------------------
// CSV Zeile für Zeile verarbeiten
// --------------------------------------------------

while (($row = fgetcsv($handle, 0, ",", '"', "\\")) !== false) {

    if (count($row) !== count($headers)) {
        continue;
    }

    $row = array_combine($headers, $row);

    // Datum
    $date = DateTime::createFromFormat("Y/m/d", $row["date"]);

    if ($date === false) {
        continue;
    }

    $monthKey = $date->format("Y-m");
    $monthWeeks[$monthKey][$date->format("Y-m-d")] = true;

    // Streams
    $streams = (int) $row["streams"];

    // Genre
    $mainGenre = getMainGenre(parsePythonList($row["artist_genres"] ?? ""));

    // Artist (nur der erste Artist zählt als Hauptartist)
    $artists = parsePythonList($row["artists"] ?? "");
    $mainArtist = $artists[0] ?? "Unknown";

    // Song
    $trackId = $row["track_id"] ?? "";
    $trackName = $row["name"] ?? "";
    $trackKey = $trackId !== "" ? $trackId : $trackName . "|" . $mainArtist;

    $explicit = in_array(strtolower($row["explicit"] ?? ""), ["true", "1"], true);

    // Summieren
    $s = &$stats[$monthKey][$mainGenre];

    if ($s === null) {
        $s = [
            "streams" => 0,
            "entries" => 0,
            "explicit_streams" => 0,
            "artists" => [],
            "tracks" => []
        ];
    }

    $s["streams"] += $streams;
    $s["entries"]++;

    if ($explicit) {
        $s["explicit_streams"] += $streams;
    }

    $s["artists"][$mainArtist] = ($s["artists"][$mainArtist] ?? 0) + $streams;

    if (!isset($s["tracks"][$trackKey])) {
        $s["tracks"][$trackKey] = [
            "name" => $trackName,
            "artist" => $mainArtist,
            "streams" => 0
        ];
    }

    $s["tracks"][$trackKey]["streams"] += $streams;

    unset($s);
}

fclose($handle);

ksort($stats);


// --------------------------------------------------
// Resultate vorbereiten
// --------------------------------------------------

$monthlyResults = [];
$monthlyGenreStreams = [];

foreach ($stats as $month => $genres) {

    // Genres nach Streams sortieren (grösste zuerst)
    uasort($genres, fn($a, $b) => $b["streams"] <=> $a["streams"]);

    $weeks = count($monthWeeks[$month]);
    $first = true;

    foreach ($genres as $genre => $s) {

        arsort($s["artists"]);
        $topArtist = array_key_first($s["artists"]);

        usort($s["tracks"], fn($a, $b) => $b["streams"] <=> $a["streams"]);
        $topTrack = $s["tracks"][0];

        $monthlyGenreStreams[] = [
            "month" => $month,
            "genre" => $genre,
            "streams" => $s["streams"],
            "chart_weeks" => $weeks,
            "chart_entries" => $s["entries"],
            "explicit_streams" => $s["explicit_streams"],
            "top_artist" => $topArtist,
            "artist_streams" => $s["artists"][$topArtist],
            "top_track" => $topTrack["name"],
            "top_track_artist" => $topTrack["artist"],
            "top_track_streams" => $topTrack["streams"]
        ];

        // Erstes Genre = Top Genre des Monats
        if ($first) {
            $monthlyResults[] = [
                "month" => $month,
                "top_genre" => $genre,
                "genre_streams" => $s["streams"],
                "top_artist" => $topArtist,
                "artist_streams" => $s["artists"][$topArtist]
            ];
            $first = false;
        }
    }
}

return [
    "monthly_results" => $monthlyResults,
    "monthly_genre_streams" => $monthlyGenreStreams
];
