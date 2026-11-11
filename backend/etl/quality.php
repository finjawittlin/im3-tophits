<?php

// ------------------------------------------------------------
// Qualitätschecks
//
// Prüft das Resultat von transform.php, bevor etwas in die Datenbank
// geschrieben wird. Jeder Check liefert:
//
//   OK        alles in Ordnung
//   WARNUNG   auffällig, aber erklärbar – Load läuft weiter
//   FEHLER    Daten wären falsch oder unvollständig – Load bricht ab
//
// Geprüft wird:
//   1. Zeilen          ungültige Daten, Streams, Duplikate
//   2. Monate          lückenlos vom ersten bis zum letzten Monat
//   3. Wochen/Monat    jede Chart-Woche genau einem Monat zugeordnet,
//                      4–5 Wochen pro Monat, Abstand 7 Tage
//   4. Einträge/Woche  Wochen mit auffällig wenigen Chart-Einträgen
//   5. Unknown         Artists ohne Spotify-Genre, fehlende Namen
//   6. Other           Genres, die keine Regel trifft
//   7. Konsistenz      Summen, Top Genre, Duplikate pro Monat + Genre
// ------------------------------------------------------------

const QC_OK = 'OK';
const QC_WARN = 'WARNUNG';
const QC_ERROR = 'FEHLER';

// Ab diesem Anteil an allen Streams wird gewarnt
const QC_UNKNOWN_WARN_SHARE = 0.05;
const QC_OTHER_WARN_SHARE = 0.10;

// Ab diesem Anteil verworfener Zeilen bricht der Load ab
const QC_REJECT_ERROR_SHARE = 0.01;

// Wie viele Beispiele pro Check angezeigt werden
const QC_EXAMPLES = 5;


function qcCheck(string $name, string $status, string $message, array $details = []): array
{
    return [
        'check' => $name,
        'status' => $status,
        'message' => $message,
        'details' => array_slice($details, 0, QC_EXAMPLES),
        'more' => max(0, count($details) - QC_EXAMPLES),
    ];
}

function qcShare(float $part, float $total): string
{
    return number_format($total > 0 ? $part / $total * 100 : 0, 2, '.', "'") . ' %';
}

function qcNumber(int|float $n): string
{
    return number_format($n, 0, '.', "'");
}


function qualityChecks(array $t): array
{
    $q = $t['stats'];
    $results = $t['monthly_results'];
    $genreRows = $t['monthly_genre_streams'];
    $extract = $t['extract'] ?? ['rows' => $q['rows'], 'skipped' => 0, 'skipped_lines' => []];
    $checks = [];


    // ---------- 1. Zeilen ----------

    $rejected = array_merge(
        $extract['skipped_lines'],
        $q['invalid_date'],
        $q['invalid_streams'],
        $q['duplicates']
    );
    $rejectedCount = $extract['skipped'] + count($q['invalid_date']) + count($q['invalid_streams']) + count($q['duplicates']);
    $allRows = $extract['rows'] + $extract['skipped'];

    if ($q['used_rows'] === 0) {
        $checks[] = qcCheck('Zeilen', QC_ERROR, 'Keine gültige Zeile gefunden – CSV leer oder falsches Format.');
    } elseif ($rejectedCount === 0) {
        $checks[] = qcCheck('Zeilen', QC_OK, qcNumber($q['used_rows']) . ' Zeilen verarbeitet, keine verworfen.');
    } else {
        $message = sprintf(
            '%s von %s Zeilen verworfen (%s): %d falsche Spaltenzahl, %d ungültiges Datum, %d ungültige Streams, %d Duplikate (gleicher Song in derselben Woche).',
            qcNumber($rejectedCount), qcNumber($allRows), qcShare($rejectedCount, $allRows),
            $extract['skipped'], count($q['invalid_date']), count($q['invalid_streams']), count($q['duplicates'])
        );
        $status = $rejectedCount / max(1, $allRows) > QC_REJECT_ERROR_SHARE ? QC_ERROR : QC_WARN;
        $checks[] = qcCheck('Zeilen', $status, $message, $rejected);
    }


    // ---------- 2. Monate lückenlos ----------

    $months = array_column($results, 'month');

    if ($months) {
        $missing = [];
        $cursor = new DateTimeImmutable($months[0] . '-01');
        $end = new DateTimeImmutable(end($months) . '-01');

        while ($cursor <= $end) {
            if (!in_array($cursor->format('Y-m'), $months, true)) {
                $missing[] = $cursor->format('Y-m');
            }
            $cursor = $cursor->modify('+1 month');
        }

        $checks[] = $missing
            ? qcCheck('Monate', QC_ERROR, count($missing) . ' Monat(e) ohne Daten zwischen ' . $months[0] . ' und ' . end($months) . '.', $missing)
            : qcCheck('Monate', QC_OK, count($months) . ' Monate lückenlos von ' . $months[0] . ' bis ' . end($months) . '.');
    }


    // ---------- 3. Wochen pro Monat ----------

    $monthWeeks = $q['month_weeks'];
    $allDays = array_keys($q['week_entries']);
    $assigned = array_merge(...array_values($monthWeeks ?: [[]]));

    // Jede Woche genau einmal einem Monat zugeordnet?
    if (count($assigned) !== count($allDays) || array_diff($allDays, $assigned)) {
        $checks[] = qcCheck('Wochen pro Monat', QC_ERROR, 'Chart-Wochen sind nicht eindeutig einem Monat zugeordnet.');
    } else {
        $odd = [];
        $count = [];

        foreach ($monthWeeks as $month => $days) {
            $n = count($days);
            $count[$n] = ($count[$n] ?? 0) + 1;

            if ($n < 4 || $n > 5) {
                $odd[] = "$month: $n Woche(n) (" . implode(', ', $days) . ')';
            }
        }

        // Abstand zwischen Chart-Wochen: normal 7 Tage
        $gaps = [];
        for ($i = 1; $i < count($allDays); $i++) {
            $diff = (new DateTimeImmutable($allDays[$i - 1]))->diff(new DateTimeImmutable($allDays[$i]))->days;

            if ($diff !== 7) {
                $gaps[] = $allDays[$i - 1] . ' → ' . $allDays[$i] . ": $diff Tage";
            }
        }

        ksort($count);
        $summary = implode(', ', array_map(fn($n, $c) => "$c Monate mit $n Wochen", array_keys($count), $count));

        $checks[] = ($odd || $gaps)
            ? qcCheck('Wochen pro Monat', QC_WARN, count($allDays) . " Chart-Wochen, jede genau einem Monat zugeordnet ($summary). Auffällig: " . count($odd) . ' Monat(e) mit weniger als 4 oder mehr als 5 Wochen, ' . count($gaps) . ' Abstand/Abstände ≠ 7 Tage.', array_merge($odd, $gaps))
            : qcCheck('Wochen pro Monat', QC_OK, count($allDays) . " Chart-Wochen, jede genau einem Monat zugeordnet ($summary), Abstand immer 7 Tage.");
    }


    // ---------- 4. Einträge pro Woche ----------

    if ($q['week_entries']) {
        $entries = array_values($q['week_entries']);
        sort($entries);
        $median = $entries[intdiv(count($entries), 2)];
        $low = [];

        foreach ($q['week_entries'] as $day => $n) {
            if ($n < $median / 2) {
                $low[] = "$day: $n Einträge";
            }
        }

        $range = 'min ' . min($entries) . ', Median ' . $median . ', max ' . max($entries) . '.';

        $checks[] = $low
            ? qcCheck('Einträge pro Woche', QC_WARN, $range . ' ' . count($low) . ' Woche(n) mit weniger als der Hälfte des Medians – vermutlich unvollständig erfasst.', $low)
            : qcCheck('Einträge pro Woche', QC_OK, $range);
    }


    // ---------- 5. Unknown ----------

    $total = $q['total_streams'];
    $unknownShare = $total > 0 ? $q['unknown_genre_streams'] / $total : 0;

    arsort($q['unknown_artists']);
    $unknownExamples = array_map(
        fn($artist, $streams) => "$artist (" . qcNumber($streams) . ' Streams)',
        array_keys($q['unknown_artists']), $q['unknown_artists']
    );

    $unknownTop = array_column(array_filter($results, fn($r) => $r['top_genre'] === GENRE_UNKNOWN), 'month');

    $message = sprintf(
        '%s Zeilen ohne Spotify-Genre → Genre «Unknown» (%s der Streams). %d Zeilen ohne Artist, %d ohne Songtitel → «Unknown».',
        qcNumber($q['unknown_genre_rows']), qcShare($q['unknown_genre_streams'], $total),
        $q['unknown_artist_rows'], $q['unknown_title_rows']
    );

    if ($unknownTop) {
        $message .= ' «Unknown» ist Top Genre in: ' . implode(', ', $unknownTop) . '.';
    }

    $status = ($unknownShare > QC_UNKNOWN_WARN_SHARE || $unknownTop) ? QC_WARN : QC_OK;

    $checks[] = qcCheck('Unknown', $status, $message, $unknownExamples);


    // ---------- 6. Other ----------

    $otherShare = $total > 0 ? $q['other_streams'] / $total : 0;

    arsort($q['other_tags']);
    $tagExamples = array_map(
        fn($tag, $streams) => '«' . $tag . '» (' . qcNumber($streams) . ' Streams)',
        array_keys($q['other_tags']), $q['other_tags']
    );

    $otherTop = array_column(array_filter($results, fn($r) => $r['top_genre'] === GENRE_OTHER), 'month');

    $message = sprintf(
        '%s Zeilen mit Spotify-Genres, die keine Regel trifft → «Other» (%s der Streams).',
        qcNumber($q['other_rows']), qcShare($q['other_streams'], $total)
    );

    if ($otherTop) {
        $message .= ' «Other» ist Top Genre in: ' . implode(', ', $otherTop) . '.';
    }

    if ($tagExamples) {
        $message .= ' Häufigste Genres darin (Kandidaten für neue Regeln in GENRE_RULES):';
    }

    $status = ($otherShare > QC_OTHER_WARN_SHARE || $otherTop) ? QC_WARN : QC_OK;
    $checks[] = qcCheck('Other', $status, $message, $tagExamples);


    // ---------- 7. Konsistenz ----------

    $problems = [];

    // Monat + Genre eindeutig (UNIQUE KEY in der Datenbank)
    $keys = array_map(fn($r) => $r['month'] . ' · ' . $r['genre'], $genreRows);
    foreach (array_diff_assoc($keys, array_unique($keys)) as $dup) {
        $problems[] = "doppelt: $dup";
    }

    // Ein Resultat pro Monat
    foreach (array_diff_assoc($months, array_unique($months)) as $dup) {
        $problems[] = "Monat doppelt: $dup";
    }

    // Summe aller Genre-Streams = alle verarbeiteten Streams
    $sum = array_sum(array_column($genreRows, 'streams'));
    if ($sum !== $total) {
        $problems[] = 'Summe Genre-Streams ' . qcNumber($sum) . ' ≠ verarbeitete Streams ' . qcNumber($total);
    }

    // Top Genre = Genre mit den meisten Streams im Monat
    $max = [];
    foreach ($genreRows as $r) {
        $max[$r['month']] = max($max[$r['month']] ?? 0, $r['streams']);

        if ($r['artist_streams'] > $r['streams'] || $r['top_track_streams'] > $r['streams'] || $r['explicit_streams'] > $r['streams']) {
            $problems[] = "{$r['month']} · {$r['genre']}: Teilwert grösser als Genre-Streams";
        }
    }
    foreach ($results as $r) {
        if (($max[$r['month']] ?? null) !== $r['genre_streams']) {
            $problems[] = "{$r['month']}: Top Genre hat nicht die meisten Streams";
        }
    }

    if ($q['truncated'] > 0) {
        $checks[] = qcCheck('Textlänge', QC_WARN, $q['truncated'] . ' Text(e) länger als die Datenbankspalte – gekürzt (mit «…»).');
    }

    $checks[] = $problems
        ? qcCheck('Konsistenz', QC_ERROR, count($problems) . ' Widerspruch/Widersprüche in den Resultaten.', $problems)
        : qcCheck('Konsistenz', QC_OK, 'Monat + Genre eindeutig, Summen stimmen (' . qcNumber($total) . ' Streams), Top Genre korrekt.');

    return $checks;
}


function qualityHasErrors(array $checks): bool
{
    return in_array(QC_ERROR, array_column($checks, 'status'), true);
}


function qualityReport(array $checks): string
{
    $out = "Qualitätschecks\n";

    foreach ($checks as $c) {
        $out .= sprintf("[%-7s] %s: %s\n", $c['status'], $c['check'], $c['message']);

        foreach ($c['details'] as $detail) {
            $out .= "            - $detail\n";
        }

        if ($c['more'] > 0) {
            $out .= "            … und {$c['more']} weitere\n";
        }
    }

    $out .= qualityHasErrors($checks)
        ? "\nErgebnis: FEHLER gefunden – Daten werden nicht geladen.\n"
        : "\nErgebnis: keine Fehler – Daten können geladen werden.\n";

    return $out;
}
