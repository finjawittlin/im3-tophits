<?php

$file = "../../data/spotify_ch_2014_2022.csv";

$handle = fopen($file, "r");

$data = [];

$headers = fgetcsv($handle, 0, ",", '"', "\\");

while (($row = fgetcsv($handle, 0, ",", '"', "\\")) !== false) {
    $data[] = array_combine($headers, $row);
}

fclose($handle);

print_r($data);