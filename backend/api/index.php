<?php

header('Content-Type: application/json; charset=utf-8');

$result = include __DIR__ . '/../etl/transform.php';

echo json_encode(
    $result,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
);