<?php

$file = __DIR__ . "/../../data/spotify_ch_2014_2022.csv";

$handle = fopen($file, "r");

if ($handle === false) {
    exit("CSV-Datei konnte nicht geöffnet werden.");
}

$headers = fgetcsv($handle, 0, ",", '"', "\\");

$count = 0;

while (($row = fgetcsv($handle, 0, ",", '"', "\\")) !== false) {

    if (count($row) !== count($headers)) {
        continue;
    }

    $data = array_combine($headers, $row);

    $count++;
}

fclose($handle);

echo "Extract erfolgreich.\n";
echo "Gelesene Zeilen: " . $count . "\n";