// ============================================================
// Scrollytelling: «Was hört die Schweiz?»
//
// Alle Zahlen und Aussagen werden aus den geladenen Daten berechnet
// (db.months aus script.js). Ändern sich die Daten, passt sich die
// Geschichte an – Überschriften mit festen Behauptungen erscheinen nur,
// wenn die Daten sie stützen.
//
// LADEZUSTÄNDE (siehe showStatus in script.js)
//   loading  Hero sichtbar, Lade-Animation, Story + Explorer verborgen
//   ready    Story + Explorer sichtbar, Hero-Zahlen zählen hoch
//   empty    Hinweis «keine Daten», Story verborgen
//   error    Fehlermeldung + «Erneut versuchen» (auch bei Timeout)
//   Genre-Daten (?resource=genres) sind optional: fehlen sie, läuft
//   alles mit den Monatsdaten.
//
// SCROLLZUSTÄNDE
//   .reveal        Element blendet ein, sobald 15 % sichtbar (einmalig)
//   [data-count]   Zahl zählt hoch, sobald sichtbar
//   .draw          Linie zeichnet sich, sobald sichtbar
//   Kapitel 2      Heatmap bleibt fixiert (sticky). Der aktive Schritt ist
//                  der letzte, dessen Oberkante über 65 % der Fensterhöhe
//                  liegt. Innerhalb des Schritts wächst die Heatmap
//                  Monat für Monat mit dem Scrollfortschritt.
//   --story-mix    0 = Pink, 1 = Neongrün. In Kapitel 2: liegt der Hip-Hop-
//                  Anteil der letzten 12 aufgedeckten Monate bei mind. 50 %,
//                  wird die Seite grün. Sonst data-mix des Kapitels in der
//                  Bildschirmmitte (gleiche 50-%-Schwelle).
//   prefers-reduced-motion: alles sofort sichtbar, Heatmap springt
//                  schrittweise statt monatsweise, keine Zähl-Animation.
// ============================================================

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Aufeinanderfolgende Monate mit gleichem Top Genre
function streaksOf(rows) {
    const out = [];
    rows.forEach((r, i) => {
        const last = out[out.length - 1];
        if (last && last.genre === r.genre) { last.end = i; last.len++; }
        else out.push({ genre: r.genre, start: i, end: i, len: 1 });
    });
    return out;
}

function countBy(list, fn) {
    const c = new Map();
    list.forEach(r => { const k = fn(r); c.set(k, (c.get(k) || 0) + 1); });
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
}

function median(values) {
    const v = [...values].sort((a, b) => a - b);
    if (!v.length) return 0;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const label = r => keyLabel(r.key);
const nameList = list => {
    const items = list.map(esc);
    return items.length > 1 ? items.slice(0, -1).join(', ') + ' und ' + items[items.length - 1] : items[0] ?? '';
};
const g = genre => `<b class="g" style="--c:${genreColor(genre)}">${esc(genre)}</b>`;

// ---------- Fakten aus den Daten ----------

function storyFacts() {
    const rows = db.months;
    const n = rows.length;
    const main = rows[0].genre;
    const turnIdx = rows.findIndex(r => r.genre !== main);
    const challenger = turnIdx >= 0 ? rows[turnIdx].genre : null;
    const streaks = streaksOf(rows);
    const firstYear = rows[0].year, lastYear = rows[n - 1].year;

    // Letzter Monat vor dem Jahr des Wendepunkts (für «X Jahre nur Pink»)
    let calmEnd = -1;
    if (turnIdx > 0) rows.forEach((r, i) => { if (i < turnIdx && r.year < rows[turnIdx].year) calmEnd = i; });

    const comeback = turnIdx < 0 ? null : streaks
        .filter(s => s.genre === main && s.start > turnIdx && s.len >= 3)
        .sort((a, b) => b.len - a.len)[0] ?? null;
    const takeoverEnd = comeback ? comeback.start - 1 : n - 1;

    const years = [...new Set(rows.map(r => r.year))].map(year => {
        const yr = rows.filter(r => r.year === year);
        return {
            year,
            total: yr.length,
            main: yr.filter(r => r.genre === main).length,
            challenger: yr.filter(r => r.genre === challenger).length,
            other: yr.filter(r => r.genre !== main && r.genre !== challenger).length,
            median: median(yr.filter(r => !r.incomplete).map(r => r.streams)),
        };
    });
    const bestChallengerYear = [...years].sort((a, b) => b.challenger - a.challenger)[0];

    const complete = rows.filter(r => !r.incomplete);
    const peak = complete.reduce((a, b) => (b.streams > a.streams ? b : a));
    const peakMain = complete.filter(r => r.genre === main).reduce((a, b) => (b.streams > a.streams ? b : a));
    const peakYear = [...years].sort((a, b) => b.median - a.median)[0];
    const lastYearStats = years[years.length - 1];

    const decembers = complete.filter(r => r.month === 12);

    const artistMonths = new Map();
    rows.forEach(r => {
        if (!artistMonths.has(r.artist)) artistMonths.set(r.artist, []);
        artistMonths.get(r.artist).push(r);
    });
    const artists = [...artistMonths.entries()]
        .map(([artist, list]) => ({ artist, list, months: list.length, genres: countBy(list, r => r.genre) }))
        .sort((a, b) => b.months - a.months || b.list[b.list.length - 1].key.localeCompare(a.list[a.list.length - 1].key));

    return {
        rows, n, main, challenger, turnIdx, streaks, firstYear, lastYear, calmEnd, comeback, takeoverEnd,
        years, bestChallengerYear, peak, peakMain, peakYear, lastYearStats, decembers, artists,
        wins: Object.fromEntries(countBy(rows, r => r.genre)),
        firstYearAllMain: rows.filter(r => r.year === firstYear).every(r => r.genre === main),
        incomplete: rows.filter(r => r.incomplete),
    };
}

// ---------- Start ----------

function initStory() {
    const F = storyFacts();
    renderHero(F);
    renderChapter1(F);
    buildScrolly(F);
    renderChapter3(F);
    renderChapter4(F);
    setupScrollEffects();
}

// ---------- Hero ----------

function renderHero(F) {
    $('hero-months').textContent = F.n;
    const stats = [
        { value: F.n, label: 'Monate Charts' },
        { value: F.artists.length, label: 'verschiedene Top Artists' },
        { value: F.wins[F.main] ?? 0, label: `Monate ${F.main} vorne`, color: genreColor(F.main) },
    ];
    if (F.challenger) stats.push({ value: F.wins[F.challenger] ?? 0, label: `Monate ${F.challenger} vorne`, color: genreColor(F.challenger) });

    $('hero-stats').innerHTML = stats.map(s => `
        <div class="hero-stat"${s.color ? ` style="--c:${s.color}"` : ''}>
            <strong data-count="${s.value}">${s.value}</strong><span>${esc(s.label)}</span>
        </div>`).join('');
}

// ---------- Kapitel 1: Am Anfang war Pop ----------

function renderChapter1(F) {
    const first = F.streaks[0];
    const eraRows = F.rows.slice(0, F.turnIdx > 0 ? F.turnIdx : F.n);
    const eraArtists = countBy(eraRows, r => r.artist).slice(0, 5);
    const title = F.firstYearAllMain && F.main === 'Pop'
        ? `${F.firstYear} war die Schweiz pink.`
        : `Am Anfang stand ${esc(F.main)}.`;

    $('kapitel-1').innerHTML = `
        <div class="chapter-inner">
            <p class="chapter-kicker reveal">Kapitel 1 · ${F.firstYear}–${F.rows[first.end].year}</p>
            <h2 class="chapter-title reveal">${title}</h2>
            <p class="chapter-lead reveal">
                ${F.firstYearAllMain
                    ? `In jedem einzelnen Monat des Jahres ${F.firstYear} hatte ${g(F.main)} in den Schweizer Spotify-Charts mehr Streams als jedes andere Genre.`
                    : `Zu Beginn liegt meistens ${g(F.main)} vorne.`}
                Und das blieb lange so.
            </p>

            <div class="big-number reveal" style="--c:${genreColor(first.genre)}">
                <strong data-count="${first.len}">${first.len}</strong>
                <span>Monate in Folge ${esc(first.genre)} an der Spitze<br>
                <small>${label(F.rows[first.start])} bis ${label(F.rows[first.end])} – ohne eine einzige Unterbrechung</small></span>
            </div>

            <h3 class="reveal">Die Stimmen der ${esc(F.main)}-Jahre</h3>
            <p class="reveal muted-text">Top Artists im Spitzengenre, ${label(eraRows[0])} bis ${label(eraRows[eraRows.length - 1])} – gezählt in Monaten.</p>
            <ol class="era-artists">
                ${eraArtists.map(([artist, months], i) => {
                    const list = eraRows.filter(r => r.artist === artist);
                    return `<li class="reveal" style="--d:${i * 90}ms">
                        <span class="era-rank">${pad(i + 1)}</span>
                        <strong>${esc(artist)}</strong>
                        <span class="era-months">${months} ${months === 1 ? 'Monat' : 'Monate'}</span>
                        <small>${list.map(r => keyLabel(r.key, true)).slice(0, 4).join(' · ')}${list.length > 4 ? ' …' : ''}</small>
                    </li>`;
                }).join('')}
            </ol>

            <aside class="note reveal">
                <b>Was heisst «an der Spitze»?</b>
                Wir summieren pro Monat die Streams aller Songs in den wöchentlichen Spotify-Charts der Schweiz – getrennt nach Genre.
                Das Genre mit den meisten Streams liegt vorne. Das heisst nicht, dass die Schweiz nur dieses Genre hörte,
                und es ist kein Marktanteil: Wir sehen nur, was es in die Charts geschafft hat.
            </aside>
        </div>`;
}

// ---------- Kapitel 2: Die Heatmap als Herzstück ----------

const scrolly = { steps: [], stepEls: [], cells: [], revealed: -1, active: -1, F: null };

function buildSteps(F) {
    const rows = F.rows;
    const steps = [];
    const C = F.challenger;

    steps.push({
        id: 'intro', reveal: 0, kicker: `${F.n} Monate`,
        title: 'Jedes Feld ist ein Monat.',
        text: `Die Farbe zeigt, welches Genre in diesem Monat die meisten Chart-Streams hatte.
               ${g(F.main)}${C ? ` und ${g(C)}` : ''} – mehr Farben braucht diese Geschichte kaum. Scrolle weiter, und die Heatmap füllt sich Monat für Monat.`,
    });

    if (F.calmEnd >= 0) {
        const calm = rows.slice(0, F.calmEnd + 1);
        const allMain = calm.every(r => r.genre === F.main);
        const yearsCount = rows[F.calmEnd].year - F.firstYear + 1;
        steps.push({
            id: 'calm', reveal: F.calmEnd + 1, kicker: `${F.firstYear}–${rows[F.calmEnd].year}`,
            title: allMain && F.main === 'Pop' ? `${yearsCount} Jahre lang: nur Pink.` : `${yearsCount} Jahre ${esc(F.main)}.`,
            text: `${calm.filter(r => r.genre === F.main).length} von ${calm.length} Monaten liegt ${g(F.main)} vorne.
                   Die Streams steigen in dieser Zeit stark – aber an der Spitze ändert sich nichts.`,
        });
    }

    if (F.turnIdx > 0) {
        const t = rows[F.turnIdx];
        steps.push({
            id: 'turn', reveal: F.turnIdx + 1, kicker: 'Der Wendepunkt', turn: true,
            title: 'Dann änderte sich der Beat.',
            text: `<b>${label(t)}:</b> Zum ersten Mal seit Beginn unserer Daten liegt ${g(C)} vorne –
                   nach ${F.streaks[0].len} Monaten ${esc(F.main)} in Folge.
                   Top Artist im Genre: <b>${esc(t.artist)}</b> mit ${fmtText(t.artistStreams)} Streams.`,
        });

        const phase = rows.slice(F.turnIdx, F.takeoverEnd + 1);
        const mainInPhase = phase.filter(r => r.genre === F.main);
        const onlyDec = mainInPhase.length > 0 && mainInPhase.every(r => r.month === 12);
        const b = F.bestChallengerYear;
        const share = phase.filter(r => r.genre === C).length / phase.length;
        steps.push({
            id: 'takeover', reveal: F.takeoverEnd + 1, kicker: `${label(phase[0])} – ${label(phase[phase.length - 1])}`,
            title: share >= .75 ? `${esc(C)} übernimmt die Charts.` : `${esc(C)} holt auf.`,
            text: `In ${phase.filter(r => r.genre === C).length} von ${phase.length} Monaten liegt ${g(C)} vorne.
                   ${b.challenger >= 10 ? `Im Jahr ${b.year} sogar in ${b.challenger} von ${b.total} Monaten.` : ''}
                   ${onlyDec ? `${esc(F.main)} gewinnt in dieser Phase nur noch im Dezember.` : ''}`,
        });

        if (F.comeback) {
            const cb = rows.slice(F.comeback.start, F.comeback.end + 1);
            const cbArtists = countBy(cb, r => r.artist).slice(0, 3);
            steps.push({
                id: 'comeback', reveal: F.comeback.end + 1, kicker: `${label(cb[0])} – ${label(cb[cb.length - 1])}`,
                title: `${esc(F.main)} schlägt zurück.`,
                text: `${F.comeback.len} Monate in Folge liegt wieder ${g(F.main)} vorne.
                       Die Gesichter dieses Comebacks: ${nameList(cbArtists.map(([a, m]) => `${a} (${m}×)`))}.`,
            });
        }

        const since = rows.slice(F.turnIdx);
        const sinceC = since.filter(r => r.genre === C).length;
        const switches = F.streaks.filter(s => s.start > F.turnIdx).length;
        steps.push({
            id: 'duel', reveal: F.n, kicker: `Bis ${label(rows[F.n - 1])}`,
            title: sinceC / since.length >= .5 ? 'Seither: ein Duell.' : `${esc(F.main)} hält dagegen.`,
            text: `Seit ${label(rows[F.turnIdx])} wechselt die Spitze noch ${switches}-mal.
                   ${g(C)} gewinnt in dieser Zeit <b>${sinceC} von ${since.length}</b> Monaten.
                   Über alle ${F.n} Monate gerechnet liegt aber ${g(F.main)} öfter vorne: ${F.wins[F.main]} zu ${F.wins[C]}.
                   ${F.incomplete.length ? `<br><small>Schraffiert: ${F.incomplete.map(label).join(', ')} – auffällig wenige Streams, vermutlich unvollständig erfasst.</small>` : ''}`,
        });
    } else {
        steps.push({
            id: 'all', reveal: F.n, kicker: 'Alle Monate', title: `${esc(F.main)} bleibt vorne.`,
            text: `In allen ${F.n} Monaten liegt ${g(F.main)} an der Spitze.`,
        });
    }

    // Dezember-Muster nur zeigen, wenn die Daten es tragen
    const dec = F.decembers;
    const decMain = dec.filter(r => r.genre === F.main);
    if (dec.length >= 3 && decMain.length === dec.length && F.turnIdx > 0) {
        const decArtists = [...new Set(dec.map(r => r.artist))];
        steps.push({
            id: 'december', reveal: F.n, kicker: 'Ein Muster', highlight: r => r.month === 12 && !r.incomplete,
            title: F.main === 'Pop' ? 'Nur der Dezember bleibt pink.' : `Der Dezember gehört ${esc(F.main)}.`,
            text: `In allen ${dec.length} vollständig erfassten Dezembern liegt ${g(F.main)} vorne – auch mitten in den ${esc(F.challenger)}-Jahren.
                   Top Artists dieser Dezember: ${nameList(decArtists)}.
                   Weihnachtsmusik? Möglich. Unsere Daten zeigen das Muster – den Grund kennen sie nicht.`,
        });
    }

    return steps;
}

function buildScrolly(F) {
    scrolly.F = F;
    scrolly.steps = buildSteps(F);

    // Heatmap-Raster
    const grid = $('story-heatmap');
    const index = new Map(F.rows.map((r, i) => [r.key, i]));
    let html = '<span></span>' + MONTHS_SHORT.map(m => `<span class="hm-head">${m}</span>`).join('');
    const years = [...new Set(F.rows.map(r => r.year))];
    years.forEach(y => {
        html += `<span class="hm-year">${y}</span>`;
        for (let m = 1; m <= 12; m++) {
            const i = index.get(monthKey(y, m));
            html += i === undefined
                ? '<span class="s-cell missing"></span>'
                : `<button type="button" class="s-cell${F.rows[i].incomplete ? ' incomplete' : ''}" data-i="${i}" style="--c:${genreColor(F.rows[i].genre)};--d:${(m - 1) * 25}ms" aria-label="${keyLabel(F.rows[i].key)}: ${esc(F.rows[i].genre)}"></button>`;
        }
    });
    grid.innerHTML = html;
    scrolly.cells = [];
    grid.querySelectorAll('.s-cell[data-i]').forEach(cell => {
        const r = F.rows[+cell.dataset.i];
        scrolly.cells[+cell.dataset.i] = cell;
        cell.addEventListener('pointerenter', e => { if (cell.classList.contains('on')) showTooltip(e, monthTooltip(r)); });
        cell.addEventListener('pointermove', moveTooltip);
        cell.addEventListener('pointerleave', hideTooltip);
        cell.addEventListener('click', e => { if (cell.classList.contains('on')) showTooltip(e, monthTooltip(r)); });
    });

    // Legende im Stage-Kopf
    const tallyGenres = [F.main, F.challenger].filter(Boolean);
    $('stage-tally').innerHTML = tallyGenres.map(genre => `
        <div class="tally-row" style="--c:${genreColor(genre)}">
            <span class="tally-name">${esc(genre)}</span>
            <span class="tally-bar"><span data-tally-bar="${esc(genre)}"></span></span>
            <strong data-tally="${esc(genre)}">0</strong>
        </div>`).join('');

    // Textschritte
    $('steps').innerHTML = scrolly.steps.map((s, i) => `
        <article class="step" data-step="${i}">
            <div class="step-card">
                <p class="step-kicker">${s.kicker}</p>
                <h3 class="step-title">${s.title}</h3>
                <p>${s.text}</p>
            </div>
        </article>`).join('');
    scrolly.stepEls = [...document.querySelectorAll('#steps .step')];
}

function renderScrolly(revealed, active) {
    const F = scrolly.F;
    const step = scrolly.steps[active];
    if (revealed === scrolly.revealed && active === scrolly.active) return;
    scrolly.revealed = revealed;
    scrolly.active = active;

    scrolly.cells.forEach((cell, i) => {
        const r = F.rows[i];
        const on = i < revealed;
        cell.classList.toggle('on', on);
        cell.classList.toggle('dim', on && !!step?.highlight && !step.highlight(r));
        cell.classList.toggle('turn', !!step?.turn && i === F.turnIdx && on);
    });

    // Zählstand
    const shown = F.rows.slice(0, revealed);
    [F.main, F.challenger].filter(Boolean).forEach(genre => {
        const c = shown.filter(r => r.genre === genre).length;
        document.querySelector(`[data-tally="${CSS.escape(genre)}"]`).textContent = c;
        document.querySelector(`[data-tally-bar="${CSS.escape(genre)}"]`).style.width = (c / F.n * 100) + '%';
    });
    const lastShown = shown[shown.length - 1];
    $('stage-year').textContent = lastShown ? lastShown.year : F.firstYear;
    $('stage-month').textContent = lastShown ? MONTHS_FULL[lastShown.month - 1] : 'Start';

    scrolly.stepEls.forEach((el, i) => el.classList.toggle('active', i === active));
}

// Farbmischung: Anteil Herausforderer in den letzten 12 aufgedeckten Monaten
function scrollyMix() {
    const F = scrolly.F;
    if (!F.challenger || scrolly.revealed <= 0) return 0;
    const recent = F.rows.slice(Math.max(0, scrolly.revealed - 12), scrolly.revealed);
    return recent.filter(r => r.genre === F.challenger).length / recent.length;
}

// ---------- Kapitel 3: Wer steckt hinter dem Wandel? ----------

function renderChapter3(F) {
    const rows = F.rows;
    const el = $('kapitel-3');
    const constant = F.artists[0];
    const cArtists = F.challenger ? countBy(rows.filter(r => r.genre === F.challenger), r => r.artist) : [];
    const face = cArtists[0];
    const faceRows = face ? rows.filter(r => r.artist === face[0] && r.genre === F.challenger) : [];
    const eraRows = rows.slice(0, F.turnIdx > 0 ? F.turnIdx : F.n);
    const eraArtists = countBy(eraRows, r => r.artist).slice(0, 5);
    const lanes = F.artists.slice(0, 10);
    const since = rows.slice(Math.max(0, F.turnIdx));
    el.dataset.mix = F.challenger ? (since.filter(r => r.genre === F.challenger).length / since.length).toFixed(2) : 0;

    const span = a => `${keyLabel(a.list[0].key, true)} – ${keyLabel(a.list[a.list.length - 1].key, true)}`;
    const years = [...new Set(rows.map(r => r.year))];

    el.innerHTML = `
        <div class="chapter-inner">
            <p class="chapter-kicker reveal">Kapitel 3 · Die Artists</p>
            <h2 class="chapter-title reveal">Die Gesichter hinter dem neuen Sound.</h2>
            <p class="chapter-lead reveal">${F.artists.length} verschiedene Artists waren mindestens einmal Top Artist im meistgehörten Genre eines Monats.
                Mit dem Wechsel an der Spitze wechseln auch die Namen.</p>

            <div class="versus">
                <div class="versus-col reveal" style="--c:${genreColor(F.main)}">
                    <small>${label(eraRows[0])} – ${label(eraRows[eraRows.length - 1])}</small>
                    <h3>Vor dem Wendepunkt</h3>
                    <ol>${eraArtists.map(([a, m]) => `<li><span>${esc(a)}</span><b>${m}×</b></li>`).join('')}</ol>
                </div>
                ${cArtists.length ? `
                <div class="versus-col reveal" style="--c:${genreColor(F.challenger)};--d:150ms">
                    <small>Alle ${F.wins[F.challenger]} ${esc(F.challenger)}-Monate</small>
                    <h3>Der neue Sound</h3>
                    <ol>${cArtists.slice(0, 5).map(([a, m]) => `<li><span>${esc(a)}</span><b>${m}×</b></li>`).join('')}</ol>
                </div>` : ''}
            </div>

            <div class="callouts">
                ${face ? `<p class="callout reveal" style="--c:${genreColor(F.challenger)}">
                    <strong>${esc(face[0])}</strong> ist das Gesicht des Wandels: ${face[1]} Monate Top Artist im ${esc(F.challenger)},
                    zwischen ${label(faceRows[0])} und ${label(faceRows[faceRows.length - 1])} – öfter als jeder andere Name im Genre.</p>` : ''}
                <p class="callout reveal" style="--c:${genreColor(constant.genres[0][0])}">
                    <strong>${esc(constant.artist)}</strong> ist die Konstante: ${constant.months} Monate als Top Artist,
                    vom ${label(constant.list[0])} bis zum ${label(constant.list[constant.list.length - 1])}.
                    ${constant.list.some(r => r.key >= rows[Math.max(0, F.turnIdx)].key) ? 'Auch nach dem Wendepunkt taucht der Name immer wieder auf.' : ''}</p>
            </div>

            <h3 class="reveal">Wer wann vorne lag</h3>
            <p class="reveal muted-text">Die zehn Artists mit den meisten Monaten als Top Artist. Jeder Punkt ist ein Monat, die Farbe zeigt das Genre.</p>
            <div class="lanes reveal">
                <div class="lane lane-axis"><span></span><div class="lane-track">${years.map(y => {
                    const i = rows.findIndex(r => r.year === y);
                    return `<span class="lane-year" style="left:${i / (rows.length - 1) * 100}%"><b>${String(y).slice(0, 2)}</b>${String(y).slice(2)}</span>`;
                }).join('')}${F.turnIdx > 0 ? `<span class="lane-turn" style="left:${F.turnIdx / (rows.length - 1) * 100}%"></span>` : ''}</div></div>
                ${lanes.map(a => `
                    <div class="lane">
                        <span class="lane-name">${esc(a.artist)}<small>${a.months}× · ${span(a)}</small></span>
                        <div class="lane-track">
                            ${F.turnIdx > 0 ? `<span class="lane-turn" style="left:${F.turnIdx / (rows.length - 1) * 100}%"></span>` : ''}
                            ${a.list.map(r => {
                                const i = rows.indexOf(r);
                                return `<span class="lane-dot" data-key="${r.key}" style="left:${i / (rows.length - 1) * 100}%;--c:${genreColor(r.genre)};--d:${i * 8}ms"></span>`;
                            }).join('')}
                        </div>
                    </div>`).join('')}
            </div>
            ${F.turnIdx > 0 ? `<p class="muted-text small">Gestrichelte Linie: ${label(rows[F.turnIdx])}, der erste ${esc(F.challenger)}-Monat.</p>` : ''}
        </div>`;

    el.querySelectorAll('.lane-dot').forEach(dot => {
        const r = db.monthByKey.get(dot.dataset.key);
        dot.addEventListener('pointerenter', e => showTooltip(e, monthTooltip(r)));
        dot.addEventListener('pointermove', moveTooltip);
        dot.addEventListener('pointerleave', hideTooltip);
    });
}

// ---------- Kapitel 4: Wie stark hat sich die Musik verändert? ----------

function renderChapter4(F) {
    const rows = F.rows;
    const el = $('kapitel-4');
    el.dataset.mix = '0.5';
    const first = rows[0];
    const factor = F.peak.streams / first.streams;
    const firstMedian = F.years[0].median;
    const late = F.lastYearStats;
    const decline = late.median < F.peakYear.median * .85 && late.year > F.peakYear.year;

    el.innerHTML = `
        <div class="chapter-inner">
            <p class="chapter-kicker reveal">Kapitel 4 · Die Streams</p>
            <h2 class="chapter-title reveal">Mehr Streams. Neue Spitze.</h2>
            <p class="chapter-lead reveal">
                Im ${label(first)} kam das meistgehörte Genre auf <b>${fmtText(first.streams)}</b> Chart-Streams.
                Im ${label(F.peak)} waren es <b>${fmtText(F.peak.streams)}</b> – rund ${Math.round(factor)}-mal so viel.
            </p>

            <div class="stat-row">
                <div class="stat reveal" style="--c:${genreColor(F.peak.genre)}">
                    <small>Rekordmonat</small><strong>${fmtText(F.peak.streams)}</strong>
                    <span>${label(F.peak)} · ${esc(F.peak.genre)} · ★ ${esc(F.peak.artist)}</span>
                </div>
                ${F.peakMain !== F.peak ? `<div class="stat reveal" style="--c:${genreColor(F.main)};--d:120ms">
                    <small>Bester ${esc(F.main)}-Monat</small><strong>${fmtText(F.peakMain.streams)}</strong>
                    <span>${label(F.peakMain)} · ★ ${esc(F.peakMain.artist)}</span>
                </div>` : ''}
                <div class="stat reveal" style="--d:240ms">
                    <small>Typischer Monat ${F.years[0].year} → ${F.peakYear.year}</small>
                    <strong>${fmtText(firstMedian)} → ${fmtText(F.peakYear.median)}</strong>
                    <span>Median der Spitzengenre-Streams pro Monat</span>
                </div>
            </div>

            <div class="story-chart reveal" id="story-line"></div>

            <aside class="note reveal">
                <b>Vorsicht beim Lesen:</b> Mehr Chart-Streams zeigen vor allem, dass Spotify in der Schweiz gewachsen ist.
                Ob ein Genre dabei Marktanteile gewonnen hat, lässt sich daraus nicht ablesen – wir kennen nur die Streams des jeweils führenden Genres.
            </aside>

            ${decline ? `<p class="chapter-lead reveal">Seit ${F.peakYear.year} sinken die Streams des Spitzengenres wieder:
                von typischerweise ${fmtText(F.peakYear.median)} auf ${fmtText(late.median)} pro Monat im Jahr ${late.year}.
                Ob sich die Streams stärker auf mehrere Genres verteilen oder insgesamt weniger in die Charts fliessen, können wir mit diesen Daten nicht unterscheiden.</p>` : ''}

            <h3 class="reveal">Das Duell, Jahr für Jahr</h3>
            <p class="reveal muted-text">Anzahl Monate an der Spitze pro Jahr.</p>
            <div class="duel">
                ${F.years.map((y, i) => `
                    <div class="duel-row reveal" style="--d:${i * 70}ms">
                        <span class="duel-year">${y.year}</span>
                        <div class="duel-bar">
                            <span style="--w:${y.main / 12 * 100}%;--c:${genreColor(F.main)}">${y.main || ''}</span>
                            ${F.challenger ? `<span style="--w:${y.challenger / 12 * 100}%;--c:${genreColor(F.challenger)}">${y.challenger || ''}</span>` : ''}
                            ${y.other ? `<span style="--w:${y.other / 12 * 100}%;--c:${genreColor('Other')}">${y.other}</span>` : ''}
                        </div>
                    </div>`).join('')}
                <div class="legend">${[F.main, F.challenger].filter(Boolean).map(x => `<span class="legend-item">${chip(x)}${esc(x)}</span>`).join('')}</div>
            </div>
        </div>`;

    drawStoryLine(F);

    // Beim Wechsel zwischen schmal/breit neu zeichnen
    let wasNarrow = narrowChart();
    window.addEventListener('resize', () => {
        if (narrowChart() === wasNarrow) return;
        wasNarrow = narrowChart();
        drawStoryLine(F);
        $('story-line').classList.add('is-visible');
    });
}

// Auf schmalen Bildschirmen schmaleres Koordinatensystem -> grössere Schrift, kein seitliches Scrollen
const narrowChart = () => window.matchMedia('(max-width: 600px)').matches;

function drawStoryLine(F) {
    const rows = F.rows;
    const narrow = narrowChart();
    const W = narrow ? 600 : 1000, H = narrow ? 460 : 380, L = narrow ? 92 : 60, R = 16, T = 34, B = narrow ? 44 : 34;
    const x = i => L + i / (rows.length - 1) * (W - L - R);
    const maxV = Math.max(...rows.map(r => r.streams));
    const step = niceStep(maxV / 4);
    const top = Math.ceil(maxV / step) * step;
    const y = v => T + (1 - v / top) * (H - T - B);

    let svg = '';
    for (let v = 0; v <= top + 1; v += step) {
        svg += `<line class="tl-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tl-axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(fmtText(v))}</text>`;
    }
    rows.forEach((r, i) => {
        if (r.month === 1 && (!narrow || r.year % 2 === 0)) svg += `<text class="tl-axis" x="${x(i)}" y="${H - 12}">${r.year}</text>`;
    });
    if (F.turnIdx > 0) svg += `<line class="turn-line" x1="${x(F.turnIdx)}" x2="${x(F.turnIdx)}" y1="${T - 10}" y2="${H - B}"/>
        <text class="turn-label" x="${x(F.turnIdx) + 6}" y="${T}">Wendepunkt</text>`;

    // Linie in Farbsegmenten (Farbe = Top Genre des Monats)
    const d = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.streams).toFixed(1)}`).join('');
    svg += `<path class="draw" pathLength="1" d="${d}" fill="none" stroke="url(#genre-gradient)" stroke-width="3" stroke-linejoin="round"/>`;
    const stops = rows.map((r, i) => `<stop offset="${(i / (rows.length - 1) * 100).toFixed(2)}%" stop-color="${genreColor(r.genre)}"/>`).join('');

    rows.forEach((r, i) => {
        svg += `<circle class="dot-in${r.incomplete ? ' incomplete-dot' : ''}" cx="${x(i)}" cy="${y(r.streams)}" r="3.2" fill="${genreColor(r.genre)}" style="--d:${600 + i * 8}ms"/>`;
    });

    // Anmerkungen
    // pos: 'above' oder 'below' – verhindert Überlappungen benachbarter Rekorde
    const notes = [
        { r: rows[0], pos: 'above', text: `${keyLabel(rows[0].key, true)}: ${fmtText(rows[0].streams)}` },
        { r: F.peak, pos: 'above', text: `Rekord ${keyLabel(F.peak.key, true)}: ${fmtText(F.peak.streams)}` },
    ];
    if (F.peakMain !== F.peak) notes.push({ r: F.peakMain, pos: 'below', text: `${esc(F.main)}-Rekord ${keyLabel(F.peakMain.key, true)}: ${fmtText(F.peakMain.streams)}` });
    F.incomplete.forEach(r => notes.push({ r, pos: 'above', text: `${keyLabel(r.key, true)}: unvollständig?` }));
    notes.forEach(nt => {
        const i = rows.indexOf(nt.r);
        const cx = x(i), cy = y(nt.r.streams);
        const anchor = cx > W * .6 ? 'end' : 'start';
        const ty = nt.pos === 'below' ? cy + 26 : (cy < T + 30 ? cy + 22 : cy - 14);
        svg += `<circle class="note-dot" cx="${cx}" cy="${cy}" r="7"/><text class="note-text" x="${cx + (anchor === 'end' ? -10 : 10)}" y="${ty}" text-anchor="${anchor}">${nt.text}</text>`;
    });

    $('story-line').innerHTML = `<div class="timeline-scroll"><div class="timeline"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Streams des Spitzengenres pro Monat, ${keyLabel(rows[0].key)} bis ${keyLabel(rows[rows.length - 1].key)}">
        <defs><linearGradient id="genre-gradient" x1="${L}" x2="${W - R}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>${svg}</svg></div></div>
        <p class="muted-text small">Streams des meistgehörten Genres pro Monat. Linien- und Punktfarbe = Genre an der Spitze.</p>`;

    $('story-line').querySelectorAll('circle.dot-in').forEach((c, i) => {
        c.addEventListener('pointerenter', e => showTooltip(e, monthTooltip(rows[i])));
        c.addEventListener('pointermove', moveTooltip);
        c.addEventListener('pointerleave', hideTooltip);
    });
}

// ---------- Scroll-Effekte ----------

function setupScrollEffects() {
    const root = document.documentElement;
    if (!reduceMotion && 'IntersectionObserver' in window) root.classList.add('anim');

    // Einblenden, Hochzählen, Linien zeichnen
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            e.target.classList.add('is-visible');
            if (e.target.matches('[data-count]')) countUp(e.target);
            io.unobserve(e.target);
        });
    }, { threshold: .15 }) : null;

    if (io && !reduceMotion) document.querySelectorAll('[data-count]').forEach(el => (el.textContent = '0'));
    document.querySelectorAll('.reveal, .story-chart, .lanes, [data-count]').forEach(el => {
        if (io) io.observe(el); else el.classList.add('is-visible');
    });

    const bar = $('progress-bar');
    const chapters = [...document.querySelectorAll('[data-chapter-section]')];
    const navLinks = [...document.querySelectorAll('#chapter-nav a')];
    const scrollyEl = $('kapitel-2');
    let ticking = false;

    function update() {
        ticking = false;
        const vh = window.innerHeight;
        const max = root.scrollHeight - vh;
        bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;

        // Heatmap-Fortschritt
        let active = 0;
        scrolly.stepEls.forEach((el, i) => { if (el.getBoundingClientRect().top < vh * .65) active = i; });
        const stepRect = scrolly.stepEls[active].getBoundingClientRect();
        const progress = reduceMotion ? 1 : clamp((vh * .95 - stepRect.top) / (vh * .55), 0, 1);
        const from = active === 0 ? 0 : scrolly.steps[active - 1].reveal;
        const to = scrolly.steps[active].reveal;
        renderScrolly(Math.round(from + (to - from) * progress), active);

        // Kapitel in der Bildschirmmitte -> Farbe + Navigation
        const current = chapters.find(c => {
            const r = c.getBoundingClientRect();
            return r.top <= vh / 2 && r.bottom > vh / 2;
        });
        const mix = current === scrollyEl ? scrollyMix() : +(current?.dataset.mix ?? 0);
        // Klar Pink oder Neongrün (Zwischentöne wirken schlammig); der Wechsel wird per CSS animiert
        root.style.setProperty('--story-mix', mix >= .5 ? '1' : '0');
        navLinks.forEach(a => a.classList.toggle('active', !!current && (current.id === a.dataset.chapter || !!current.querySelector('#' + a.dataset.chapter))));
    }

    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    window.addEventListener('scroll', hideTooltip, { passive: true });
    update();
}

function countUp(el) {
    const target = +el.dataset.count;
    if (reduceMotion || !Number.isFinite(target)) { el.textContent = target; return; }
    const start = performance.now(), duration = 1200;
    const tick = now => {
        const t = clamp((now - start) / duration, 0, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}
