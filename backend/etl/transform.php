<?php

// ------------------------------------------------------------
// Transform
//
// Bekommt die Zeilen aus extract.php und berechnet:
//
// 1. monthly_results          pro Monat: Top Genre + Top Artist darin
// 2. monthly_genre_streams    pro Monat UND Genre: Streams, Top Artist,
//                             Top Song, Explicit-Streams, Chart-Wochen
// 3. quality                  Qualitätschecks (siehe quality.php)
//
// Datenfluss:  extract.php (extractRows) -> transformRows() -> load.php
//
// Wird von load.php per include aufgerufen und gibt ein Array zurück.
// Direkt im Terminal aufgerufen (php backend/etl/transform.php) gibt sie
// nur den Qualitätsbericht aus – ohne Datenbank (Probelauf).
// ------------------------------------------------------------

require_once __DIR__ . '/extract.php';
require_once __DIR__ . '/quality.php';

// Längste erlaubte Texte (VARCHAR in schema.sql)
const TEXT_MAX = 255;
const GENRE_MAX = 100;


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

const GENRE_UNKNOWN = "Unknown";
const GENRE_OTHER = "Other";

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

// Keine Spotify-Genres         -> "Unknown" (Artist hat bei Spotify keine Genres)
// Genres, aber keine Regel passt -> "Other"
function getMainGenre(array $genres): string
{
    $genres = array_filter(array_map('trim', $genres), fn($g) => $g !== '');

    if (count($genres) === 0) {
        return GENRE_UNKNOWN;
    }

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

    return GENRE_OTHER;
}


// --------------------------------------------------
// Datum lesen: "2019/01/03" oder "2019-01-03"
// --------------------------------------------------

function parseChartDate(string $text): ?DateTimeImmutable
{
    foreach (['!Y/m/d', '!Y-m-d'] as $format) {

        $date = DateTimeImmutable::createFromFormat($format, trim($text));
        $errors = DateTimeImmutable::getLastErrors();

        // Ungültige Daten wie 2019/02/31 nicht stillschweigend umrechnen
        if ($date !== false && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
            return $date;
        }
    }

    return null;
}

// Zu lange Texte kürzen (und für den Bericht zählen)
function fitText(string $text, int $max, int &$counter): string
{
    if (mb_strlen($text) <= $max) {
        return $text;
    }

    $counter++;
    return mb_substr($text, 0, $max - 1) . '…';
}


// --------------------------------------------------
// Hauptfunktion
// --------------------------------------------------

function transformRows(iterable $rows): array
{
    // Chart-Wochen pro Monat (verschiedene Chart-Daten)
    $monthWeeks = [];

    // Pro Monat + Genre: Streams, Artists, Songs, Explicit
    $stats = [];

    // Angaben für die Qualitätschecks
    $q = [
        'rows' => 0,
        'used_rows' => 0,
        'total_streams' => 0,
        'invalid_date' => [],
        'invalid_streams' => [],
        'duplicates' => [],
        'week_entries' => [],
        'unknown_genre_rows' => 0,
        'unknown_genre_streams' => 0,
        'unknown_artist_rows' => 0,
        'unknown_title_rows' => 0,
        'unknown_artists' => [],
        'other_rows' => 0,
        'other_streams' => 0,
        'other_tags' => [],
        'truncated' => 0,
    ];

    $seen = [];

    foreach ($rows as $line => $row) {

        $q['rows']++;

        // Datum
        $date = parseChartDate($row['date'] ?? '');

        if ($date === null) {
            $q['invalid_date'][] = "Zeile $line: «" . ($row['date'] ?? '') . '»';
            continue;
        }

        $day = $date->format('Y-m-d');

        // Jede Chart-Woche zählt zum Monat ihres Datums
        $monthKey = $date->format('Y-m');

        // Streams: nur ganze Zahlen ≥ 0
        $rawStreams = trim($row['streams'] ?? '');

        if (!preg_match('/^\d+(\.0+)?$/', $rawStreams)) {
            $q['invalid_streams'][] = "Zeile $line: «" . $rawStreams . '»';
            continue;
        }

        $streams = (int) $rawStreams;

        // Artist (nur der erste Artist zählt als Hauptartist)
        $artists = array_values(array_filter(
            array_map('trim', parsePythonList($row['artists'] ?? '')),
            fn($a) => $a !== ''
        ));

        if (!$artists) {
            $q['unknown_artist_rows']++;
        }

        $mainArtist = fitText($artists[0] ?? GENRE_UNKNOWN, TEXT_MAX, $q['truncated']);

        // Song
        $trackId = trim($row['track_id'] ?? '');
        $trackName = trim($row['name'] ?? '');

        if ($trackName === '') {
            $q['unknown_title_rows']++;
            $trackName = GENRE_UNKNOWN;
        }

        $trackName = fitText($trackName, TEXT_MAX, $q['truncated']);
        $trackKey = $trackId !== '' ? $trackId : $trackName . '|' . $mainArtist;

        // Duplikat: derselbe Song zweimal in derselben Chart-Woche
        if (isset($seen[$day][$trackKey])) {
            $q['duplicates'][] = "Zeile $line: $day · $trackName";
            continue;
        }

        $seen[$day][$trackKey] = true;

        // Genre
        $tags = parsePythonList($row['artist_genres'] ?? '');
        $mainGenre = fitText(getMainGenre($tags), GENRE_MAX, $q['truncated']);

        if ($mainGenre === GENRE_UNKNOWN) {
            $q['unknown_genre_rows']++;
            $q['unknown_genre_streams'] += $streams;
            $q['unknown_artists'][$mainArtist] = ($q['unknown_artists'][$mainArtist] ?? 0) + $streams;
        } elseif ($mainGenre === GENRE_OTHER) {
            $q['other_rows']++;
            $q['other_streams'] += $streams;

            foreach ($tags as $tag) {
                $tag = strtolower(trim($tag));
                $q['other_tags'][$tag] = ($q['other_tags'][$tag] ?? 0) + $streams;
            }
        }

        $explicit = in_array(strtolower(trim($row['explicit'] ?? '')), ['true', '1'], true);

        // Zählen
        $monthWeeks[$monthKey][$day] = true;
        $q['week_entries'][$day] = ($q['week_entries'][$day] ?? 0) + 1;
        $q['used_rows']++;
        $q['total_streams'] += $streams;

        $s = &$stats[$monthKey][$mainGenre];

        if ($s === null) {
            $s = [
                'streams' => 0,
                'entries' => 0,
                'explicit_streams' => 0,
                'artists' => [],
                'tracks' => []
            ];
        }

        $s['streams'] += $streams;
        $s['entries']++;

        if ($explicit) {
            $s['explicit_streams'] += $streams;
        }

        $s['artists'][$mainArtist] = ($s['artists'][$mainArtist] ?? 0) + $streams;

        if (!isset($s['tracks'][$trackKey])) {
            $s['tracks'][$trackKey] = [
                'name' => $trackName,
                'artist' => $mainArtist,
                'streams' => 0
            ];
        }

        $s['tracks'][$trackKey]['streams'] += $streams;

        unset($s);
    }

    ksort($stats);
    ksort($q['week_entries']);


    // --------------------------------------------------
    // Resultate vorbereiten
    // --------------------------------------------------

    $monthlyResults = [];
    $monthlyGenreStreams = [];

    foreach ($stats as $month => $genres) {

        // Genres nach Streams sortieren (grösste zuerst)
        uasort($genres, fn($a, $b) => $b['streams'] <=> $a['streams']);

        $weeks = count($monthWeeks[$month]);
        $first = true;

        foreach ($genres as $genre => $s) {

            arsort($s['artists']);
            $topArtist = array_key_first($s['artists']);

            usort($s['tracks'], fn($a, $b) => $b['streams'] <=> $a['streams']);
            $topTrack = $s['tracks'][0];

            $monthlyGenreStreams[] = [
                'month' => $month,
                'genre' => $genre,
                'streams' => $s['streams'],
                'chart_weeks' => $weeks,
                'chart_entries' => $s['entries'],
                'explicit_streams' => $s['explicit_streams'],
                'top_artist' => (string) $topArtist,
                'artist_streams' => $s['artists'][$topArtist],
                'top_track' => $topTrack['name'],
                'top_track_artist' => $topTrack['artist'],
                'top_track_streams' => $topTrack['streams']
            ];

            // Erstes Genre = Top Genre des Monats
            if ($first) {
                $monthlyResults[] = [
                    'month' => $month,
                    'top_genre' => $genre,
                    'genre_streams' => $s['streams'],
                    'top_artist' => (string) $topArtist,
                    'artist_streams' => $s['artists'][$topArtist]
                ];
                $first = false;
            }
        }
    }

    $q['month_weeks'] = array_map(fn($days) => array_keys($days), $monthWeeks);
    ksort($q['month_weeks']);

    return [
        'monthly_results' => $monthlyResults,
        'monthly_genre_streams' => $monthlyGenreStreams,
        'stats' => $q
    ];
}


// ------------------------------------------------------------
// Ausführen: Extract -> Transform -> Qualitätschecks
// ------------------------------------------------------------
// Fehler beim Lesen der CSV werfen eine ExtractException.
// load.php fängt sie ab und verändert die Datenbank dann nicht.

$transformIsMain = realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__;

if ($transformIsMain && is_file(__DIR__ . '/../../config.php')) {
    require_once __DIR__ . '/../../config.php';
}

$csvFile = extractCsvPath($csvFile ?? null);
$extractMeta = null;

try {
    $result = transformRows(extractRows($csvFile, $extractMeta));
} catch (ExtractException $e) {

    if (!$transformIsMain) {
        throw $e;
    }

    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(500);
    echo "Extract fehlgeschlagen: " . $e->getMessage() . "\n";
    exit(1);
}

$result['extract'] = $extractMeta;
$result['quality'] = qualityChecks($result);

// Grosse Hilfslisten werden nach den Checks nicht mehr gebraucht
unset($result['stats']['unknown_artists'], $result['stats']['other_tags']);


// Direkt aufgerufen: nur Bericht, keine Datenbank
if ($transformIsMain) {

    header('Content-Type: text/plain; charset=utf-8');

    echo "Probelauf (ohne Datenbank)\n";
    echo "CSV: " . basename($csvFile) . "\n";
    echo "Monate: " . count($result['monthly_results']) . "\n";
    echo "Genre-Monatswerte: " . count($result['monthly_genre_streams']) . "\n\n";
    echo qualityReport($result['quality']);
    exit(qualityHasErrors($result['quality']) ? 1 : 0);
}

return $result;
