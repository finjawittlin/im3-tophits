<?php

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../../config.php';

try {

    $pdo = new PDO(
        $dsn,
        $username,
        $password,
        $options
    );

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "error" => "Datenbankverbindung fehlgeschlagen"
    ]);

    exit;
}

$sql = "
    SELECT
        DATE_FORMAT(month, '%Y-%m') AS month,
        top_genre,
        genre_streams,
        top_artist,
        artist_streams
    FROM monthly_results
    ORDER BY month
";

$stmt = $pdo->query($sql);

$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($data as &$row) {
    $row['genre_streams'] = (int) $row['genre_streams'];
    $row['artist_streams'] = (int) $row['artist_streams'];
}

echo json_encode(
    $data,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE
);