<?php

// ------------------------------------------------------------
// Unload
//
// Liest die gespeicherten Daten aus der Datenbank und gibt sie als
// JSON aus. Die Logik liegt in der API, damit es sie nur einmal gibt:
//   unload.php                   -> monthly_results
//   unload.php?resource=genres   -> monthly_genre_streams
// ------------------------------------------------------------

require __DIR__ . '/../api/index.php';
