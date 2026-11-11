<?php

// ------------------------------------------------------------
// Extract
//
// Liest die Schweizer Spotify-Charts aus der CSV und liefert sie
// Zeile für Zeile an transform.php (Generator: braucht wenig Speicher).
//
//   - Spalten werden über ihren Namen gefunden, nicht über die Position
//   - fehlt eine Pflichtspalte oder ist die Datei unlesbar, wird eine
//     ExtractException geworfen (Load verändert dann nichts)
//   - kaputte Zeilen werden übersprungen und mit Zeilennummer protokolliert
//
// Pfad der CSV (in dieser Reihenfolge):
//   1. Terminal-Argument   php extract.php --csv=pfad/zur/datei.csv
//   2. $csvFile in config.php
//   3. Standard            data/spotify_ch_2014_2022.csv
//
// Direkt aufgerufen gibt die Datei einen Bericht aus.
// Liest nur – verändert keine Daten.
// ------------------------------------------------------------

class ExtractException extends RuntimeException
{
}

const EXTRACT_DEFAULT_CSV = __DIR__ . '/../../data/spotify_ch_2014_2022.csv';

// Diese Spalten braucht Transform; weitere Spalten sind erlaubt
const EXTRACT_REQUIRED_COLUMNS = [
    'date', 'streams', 'track_id', 'artists', 'artist_genres', 'explicit', 'name'
];

// Maximal so viele übersprungene Zeilen werden einzeln gemeldet
const EXTRACT_MAX_LOGGED = 20;


function extractCsvPath(?string $configured = null): string
{
    if (PHP_SAPI === 'cli') {
        foreach ($GLOBALS['argv'] ?? [] as $arg) {
            if (str_starts_with($arg, '--csv=')) {
                return substr($arg, 6);
            }
        }
    }

    return $configured !== null && $configured !== '' ? $configured : EXTRACT_DEFAULT_CSV;
}


// Liefert jede gültige Zeile als ['spalte' => 'wert', …].
// $meta wird laufend befüllt: Spalten, gelesene/übersprungene Zeilen.
function extractRows(string $file, ?array &$meta = null): Generator
{
    $meta = [
        'file' => $file,
        'columns' => [],
        'rows' => 0,
        'skipped' => 0,
        'skipped_lines' => [],
    ];

    if (!is_file($file) || !is_readable($file)) {
        throw new ExtractException("CSV-Datei nicht gefunden oder nicht lesbar: " . basename($file));
    }

    $handle = fopen($file, 'r');

    if ($handle === false) {
        throw new ExtractException("CSV-Datei konnte nicht geöffnet werden: " . basename($file));
    }

    try {
        $headers = fgetcsv($handle, 0, ',', '"', '\\');

        if ($headers === false || $headers === [null]) {
            throw new ExtractException("CSV-Datei ist leer (keine Kopfzeile).");
        }

        // BOM und Leerzeichen entfernen, damit "date" sicher gefunden wird
        $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]);
        $headers = array_map(fn($h) => strtolower(trim((string) $h)), $headers);
        $meta['columns'] = $headers;

        $missing = array_diff(EXTRACT_REQUIRED_COLUMNS, $headers);

        if ($missing) {
            throw new ExtractException("Pflichtspalten fehlen in der CSV: " . implode(', ', $missing));
        }

        $line = 1;

        while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {

            $line++;

            // Leere Zeile (z.B. am Dateiende) still ignorieren
            if ($row === [null]) {
                continue;
            }

            if (count($row) !== count($headers)) {
                $meta['skipped']++;

                if (count($meta['skipped_lines']) < EXTRACT_MAX_LOGGED) {
                    $meta['skipped_lines'][] = "Zeile $line: " . count($row) . " statt " . count($headers) . " Spalten";
                }
                continue;
            }

            $meta['rows']++;

            yield $line => array_combine($headers, $row);
        }
    } finally {
        fclose($handle);
    }
}


// ------------------------------------------------------------
// Direkter Aufruf: Bericht ausgeben
// ------------------------------------------------------------

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {

    header('Content-Type: text/plain; charset=utf-8');

    if (is_file(__DIR__ . '/../../config.php')) {
        require __DIR__ . '/../../config.php';
    }

    $file = extractCsvPath($csvFile ?? null);
    $dates = [];

    try {
        foreach (extractRows($file, $meta) as $row) {
            $dates[$row['date']] = true;
        }
    } catch (ExtractException $e) {
        http_response_code(500);
        echo "Extract fehlgeschlagen: " . $e->getMessage() . "\n";
        exit(1);
    }

    ksort($dates);

    echo "Extract erfolgreich.\n";
    echo "Spalten: " . implode(', ', $meta['columns']) . "\n";
    echo "Gelesene Zeilen: " . $meta['rows'] . "\n";
    echo "Übersprungene Zeilen: " . $meta['skipped'] . "\n";

    foreach ($meta['skipped_lines'] as $info) {
        echo "  - $info\n";
    }

    echo "Chart-Wochen: " . count($dates) . "\n";

    if ($dates) {
        echo "Zeitraum: " . array_key_first($dates) . " bis " . array_key_last($dates) . "\n";
    }
}
