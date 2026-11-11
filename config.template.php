<?php

// ------------------------------------------------------------
// Vorlage für config.php
//
// 1. Diese Datei kopieren:   cp config.template.php config.php
// 2. In config.php die Platzhalter durch die echten Werte ersetzen
//    (Hostpoint: Control Panel -> Datenbanken)
//
// config.php ist in .gitignore eingetragen und darf NIE committet
// werden. Diese Vorlage enthält keine echten Zugangsdaten.
//
// Verwendet von: backend/api/index.php, backend/etl/load.php,
//                backend/etl/extract.php, backend/etl/transform.php
// ------------------------------------------------------------

// Datenbank (MySQL / MariaDB)
$host = 'DB_HOST';            // z.B. Server-Name aus dem Hostpoint-Panel
$dbname = 'DB_NAME';
$username = 'DB_USER';
$password = 'DB_PASSWORD';

$dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

// Geheimer Schlüssel, um load.php im Browser zu starten:
//   backend/etl/load.php?token=<etlToken>
// Leer lassen = Load nur per Terminal möglich (empfohlen).
// Einen zufälligen Wert erzeugen z.B. mit:  php -r "echo bin2hex(random_bytes(24));"
$etlToken = '';

// Optional: anderer Pfad zur CSV (Standard: data/spotify_ch_2014_2022.csv)
// $csvFile = __DIR__ . '/data/spotify_ch_2014_2022.csv';
