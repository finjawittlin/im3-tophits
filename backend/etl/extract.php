<?php

// ------------------------------------------------------------
// Extract
//
// Prüft die CSV-Datei: Anzahl gültiger Zeilen, Zeitraum und Spalten.
// Die eigentliche Verarbeitung liest die CSV in transform.php.
//
// Liest nur – verändert keine Daten.
// ------------------------------------------------------------

header('Content-Type: text/plain; charset=utf-8');

$file = __DIR__ . "/../../data/spotify_ch_2014_2022.csv";

$handle = fopen($file, "r");

if ($handle === false) {
    exit("CSV-Datei konnte nicht geöffnet werden.\n");
}

$headers = fgetcsv($handle, 0, ",", '"', "\\");

$count = 0;
$skipped = 0;
$dates = [];

while (($row = fgetcsv($handle, 0, ",", '"', "\\")) !== false) {

    if (count($row) !== count($headers)) {
        $skipped++;
        continue;
    }

    $row = array_combine($headers, $row);
    $dates[$row["date"]] = true;

    $count++;
}

fclose($handle);

ksort($dates);

echo "Extract erfolgreich.\n";
echo "Spalten: " . implode(", ", $headers) . "\n";
echo "Gelesene Zeilen: " . $count . "\n";
echo "Übersprungene Zeilen: " . $skipped . "\n";
echo "Chart-Wochen: " . count($dates) . "\n";
echo "Zeitraum: " . array_key_first($dates) . " bis " . array_key_last($dates) . "\n";
