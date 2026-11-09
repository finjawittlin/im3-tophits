// ============================================================
// Die Chartjägerinnen – Was hört die Schweiz?
//
// Lädt die echten Daten aus der API (backend/api/index.php):
//   months  -> Top Genre + Top Artist pro Monat (monthly_results)
//   genres  -> Streams pro Monat und Genre (monthly_genre_streams)
//              optional: ist die Tabelle leer, funktioniert die Seite
//              mit den Monatsdaten allein.
// ============================================================

const API_URL = '../backend/api/';

const MONTHS_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = MONTHS_FULL.map(m => m.slice(0, 3));

// Jahreszeiten: Monat 0 = Dezember des Vorjahres
const PERIODS = {
    month: MONTHS_FULL.map((name, i) => ({ label: MONTHS_SHORT[i], full: name, months: [i + 1] })),
    season: [
        { label: 'Winter', full: 'Winter', months: [0, 1, 2] },
        { label: 'Frühling', full: 'Frühling', months: [3, 4, 5] },
        { label: 'Sommer', full: 'Sommer', months: [6, 7, 8] },
        { label: 'Herbst', full: 'Herbst', months: [9, 10, 11] },
    ],
};

// Feste Farben pro Hauptgenre (gleich wie im Transform)
const GENRE_COLORS = {
    'Pop': '#ff3eb5',
    'Hip-Hop / Rap': '#d4f23c',
    'Electronic / Dance': '#c8b0f5',
    'Rock': '#e8412c',
    'R&B / Soul': '#8fb8ff',
    'Latin': '#ff9f43',
    'Indie / Alternative': '#7ee8c1',
    'Other': '#b5aca0',
};
const EXTRA_COLORS = ['#ffe14d', '#ff8fab', '#5b8cff', '#b8f2e6'];

const ROW = 46;
const ARTISTS_PAGE = 12;

// ---------- Hilfsfunktionen ----------

const $ = id => document.getElementById(id);

// Text sicher in HTML einsetzen
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 2'700'059 -> ['2,7', 'Mio']
function fmt(n) {
    if (n >= 1e9) return [(n / 1e9).toLocaleString('de-CH', { maximumFractionDigits: 2 }), 'Mrd'];
    if (n >= 1e6) return [(n / 1e6).toLocaleString('de-CH', { maximumFractionDigits: 2 }), 'Mio'];
    if (n >= 1e4) return [(n / 1e3).toLocaleString('de-CH', { maximumFractionDigits: 0 }), 'Tsd'];
    return [Math.round(n).toLocaleString('de-CH'), ''];
}
const fmtText = n => fmt(n).join(' ').trim();
const fmtFull = n => Math.round(n).toLocaleString('de-CH');
const pct = (a, b) => (b > 0 ? (a / b * 100) : 0).toLocaleString('de-CH', { maximumFractionDigits: 1 }) + ' %';

const pad = n => String(n).padStart(2, '0');

// Monatsschlüssel "2019-03"; Monat 0 = Dezember des Vorjahres
function monthKey(year, month) {
    return month === 0 ? `${year - 1}-12` : `${year}-${pad(month)}`;
}
function keyLabel(key, short = false) {
    const [y, m] = key.split('-').map(Number);
    return `${(short ? MONTHS_SHORT : MONTHS_FULL)[m - 1]} ${y}`;
}

// Unbekannte Genres bekommen der Reihe nach eine Zusatzfarbe
const extraColors = {};
function genreColor(genre) {
    if (GENRE_COLORS[genre]) return GENRE_COLORS[genre];
    extraColors[genre] ??= EXTRA_COLORS[Object.keys(extraColors).length % EXTRA_COLORS.length];
    return extraColors[genre];
}
const chip = genre => `<span class="chip-dot" style="background:${genreColor(genre)}"></span>`;

// ---------- Zustand ----------

const state = {
    year: null,
    mode: 'month',
    metric: 'total',
    selected: 0,
    artist: null,
    artistGenre: null,
    artistQuery: '',
    artistsShown: ARTISTS_PAGE,
    hiddenGenres: new Set(),
};

const db = {
    months: [],          // Zeilen aus monthly_results
    monthByKey: new Map(),
    genreRows: [],       // Zeilen aus monthly_genre_streams (evtl. leer)
    genresByKey: new Map(),
    hasGenres: false,
    years: [],
    genres: [],          // alle vorkommenden Genres
};

// ---------- Laden ----------

async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}

async function loadData() {
    showStatus('loading');

    try {
        const [months, genres] = await Promise.all([
            fetchJson(API_URL + '?resource=months'),
            // Genre-Daten sind optional: Fehler hier stoppen die Seite nicht
            fetchJson(API_URL + '?resource=genres').catch(() => []),
        ]);

        if (!Array.isArray(months)) throw new Error(months?.error ?? 'Unerwartete Antwort der API');

        prepareData(months, Array.isArray(genres) ? genres : []);

        if (db.months.length === 0) {
            showStatus('empty');
            return;
        }

        showStatus('ready');
        init();

    } catch (err) {
        showStatus('error', err.message);
    }
}

function showStatus(type, message = '') {
    const el = $('status');
    $('app').hidden = type !== 'ready';
    el.hidden = type === 'ready';
    el.className = 'status ' + type;

    if (type === 'loading') {
        el.innerHTML = '<div class="loader"><span></span><span></span><span></span></div><p>Lade Daten aus der Datenbank …</p>';
    } else if (type === 'empty') {
        el.innerHTML = '<p><strong>Noch keine Daten vorhanden.</strong><br>Die Datenbank enthält aktuell keine Monatsresultate.</p>';
    } else if (type === 'error') {
        el.innerHTML = `<p><strong>Die Daten konnten nicht geladen werden.</strong><br>${esc(message)}</p><button type="button" class="retry">Erneut versuchen</button>`;
        el.querySelector('.retry').addEventListener('click', loadData);
    }
}

function prepareData(months, genres) {
    db.months = months
        .filter(r => r && /^\d{4}-\d{2}$/.test(r.month) && r.top_genre)
        .map(r => ({
            key: r.month,
            year: +r.month.slice(0, 4),
            month: +r.month.slice(5, 7),
            genre: r.top_genre,
            streams: +r.genre_streams || 0,
            artist: r.top_artist || 'Unbekannt',
            artistStreams: +r.artist_streams || 0,
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
    db.monthByKey = new Map(db.months.map(r => [r.key, r]));

    // Nur gültige Genre-Zeilen verwenden (ältere API-Versionen ignorieren ?resource)
    db.genreRows = genres
        .filter(r => r && r.genre && /^\d{4}-\d{2}$/.test(r.month) && 'streams' in r)
        .map(r => ({
            key: r.month,
            genre: r.genre,
            streams: +r.streams || 0,
            weeks: +r.chart_weeks || 0,
            entries: +r.chart_entries || 0,
            explicit: +r.explicit_streams || 0,
            artist: r.top_artist || 'Unbekannt',
            artistStreams: +r.artist_streams || 0,
            track: r.top_track || '',
            trackArtist: r.top_track_artist || '',
            trackStreams: +r.top_track_streams || 0,
        }));
    db.hasGenres = db.genreRows.length > 0;
    db.genresByKey = new Map();
    db.genreRows.forEach(r => {
        if (!db.genresByKey.has(r.key)) db.genresByKey.set(r.key, []);
        db.genresByKey.get(r.key).push(r);
    });

    db.years = [...new Set(db.months.map(r => r.year))].sort((a, b) => a - b);

    const all = new Set([...db.months.map(r => r.genre), ...db.genreRows.map(r => r.genre)]);
    const order = Object.keys(GENRE_COLORS);
    db.genres = [...all].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b));
}

// ---------- Auswertung ----------

// Monatsschlüssel eines Zeitraums im gewählten Jahr
function periodKeys(year, period) {
    return period.months.map(m => monthKey(year, m));
}

// Chart-Wochen eines Monats (nur mit Genre-Daten bekannt)
function weeksOf(key) {
    return db.genresByKey.get(key)?.[0]?.weeks || 0;
}

// Wert je nach Messgrösse: Summe oder Durchschnitt pro Chart-Woche
function metricValue(streams, weeks) {
    return state.metric === 'weekly' && weeks > 0 ? streams / weeks : streams;
}

// Fasst einen Zeitraum zusammen.
// Mit Genre-Daten: echte Summen pro Genre über alle Monate.
// Ohne: Top Genre des Monats bzw. Genre mit den meisten Monatssiegen.
function summarize(keys) {
    const present = keys.filter(k => db.monthByKey.has(k) || db.genresByKey.has(k));
    if (present.length === 0) return null;

    if (db.hasGenres) {
        const by = {};
        let weeks = 0;
        present.forEach(k => {
            weeks += weeksOf(k);
            (db.genresByKey.get(k) ?? []).forEach(r => {
                const g = (by[r.genre] ??= { genre: r.genre, streams: 0, explicit: 0, entries: 0, artists: {}, tracks: {} });
                g.streams += r.streams;
                g.explicit += r.explicit;
                g.entries += r.entries;
                g.artists[r.artist] = (g.artists[r.artist] || 0) + r.artistStreams;
                const t = r.track + '|' + r.trackArtist;
                g.tracks[t] = g.tracks[t] ?? { name: r.track, artist: r.trackArtist, streams: 0 };
                g.tracks[t].streams += r.trackStreams;
            });
        });
        const ranking = Object.values(by).map(g => {
            const [artist, artistStreams] = Object.entries(g.artists).sort((a, b) => b[1] - a[1])[0];
            const track = Object.values(g.tracks).sort((a, b) => b.streams - a.streams)[0];
            return { ...g, value: metricValue(g.streams, weeks), artist, artistStreams, track };
        }).sort((a, b) => b.streams - a.streams);
        if (ranking.length === 0) return null;
        const total = ranking.reduce((s, g) => s + g.streams, 0);
        return { keys: present, weeks, total, ranking, top: ranking[0], exact: true };
    }

    const rows = present.map(k => db.monthByKey.get(k)).filter(Boolean);
    if (rows.length === 1) {
        const r = rows[0];
        return { keys: present, rows, top: { genre: r.genre, value: r.streams, streams: r.streams, artist: r.artist, artistStreams: r.artistStreams, wins: 1 }, exact: true };
    }

    // Jahreszeit ohne Genre-Daten: Genre mit den meisten Monatssiegen
    const wins = {};
    rows.forEach(r => {
        const w = (wins[r.genre] ??= { genre: r.genre, wins: 0, streams: 0, best: r });
        w.wins++;
        w.streams += r.streams;
        if (r.artistStreams > w.best.artistStreams) w.best = r;
    });
    const top = Object.values(wins).sort((a, b) => b.wins - a.wins || b.streams - a.streams)[0];
    return {
        keys: present, rows, exact: false,
        top: { genre: top.genre, value: top.streams / top.wins, streams: top.streams, artist: top.best.artist, artistStreams: top.best.artistStreams, wins: top.wins },
    };
}

// ---------- Initialisierung ----------

function init() {
    const first = db.years[0], last = db.years[db.years.length - 1];
    $('range').textContent = first === last ? first : `${first}–${last}`;

    const yearSelect = $('year-select');
    yearSelect.innerHTML = db.years.map(y => `<option value="${y}">${y}</option>`).join('');
    state.year = last;
    yearSelect.value = last;
    yearSelect.addEventListener('change', () => { state.year = +yearSelect.value; update(); });

    document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
        setToggle('[data-mode]', btn);
        state.mode = btn.dataset.mode;
        state.selected = 0;
        buildChart();
        update();
    }));

    if (db.hasGenres) {
        $('metric-toggle').hidden = false;
        document.querySelectorAll('[data-metric]').forEach(btn => btn.addEventListener('click', () => {
            setToggle('[data-metric]', btn);
            state.metric = btn.dataset.metric;
            update();
        }));
        $('ranking-wrap').hidden = false;
        buildRanking();
    }

    $('artist-search').addEventListener('input', e => {
        state.artistQuery = e.target.value.trim().toLowerCase();
        state.artistsShown = ARTISTS_PAGE;
        renderArtists();
    });
    $('artists-more').addEventListener('click', () => { state.artistsShown += ARTISTS_PAGE * 2; renderArtists(); });

    buildChart();
    buildHeatmap();
    renderPattern();
    renderMethod();
    update();
}

function setToggle(selector, active) {
    document.querySelectorAll(selector).forEach(b => {
        b.classList.toggle('active', b === active);
        b.setAttribute('aria-pressed', b === active);
    });
}

// Alles neu zeichnen, was vom Jahr / Modus / Messgrösse abhängt
function update() {
    renderKpis();
    renderChart();
    markActive();
    renderDetail();
    renderHeatmap();
    renderTimeline();
    renderArtists();
}

// ---------- Kennzahlen ----------

function renderKpis() {
    const rows = db.months.filter(r => r.year === state.year);
    $('kpi-year').textContent = state.year;
    if (rows.length === 0) { $('kpis').innerHTML = ''; return; }

    const count = (list, field) => {
        const c = {};
        list.forEach(r => (c[r[field]] = (c[r[field]] || 0) + 1));
        return Object.entries(c).sort((a, b) => b[1] - a[1]);
    };

    const [topGenre, genreWins] = count(rows, 'genre')[0];
    const [topArtist, artistWins] = count(rows, 'artist')[0];
    const peak = rows.reduce((a, b) => (b.streams > a.streams ? b : a));
    const share = rows.reduce((a, b) => (b.artistStreams / b.streams > a.artistStreams / a.streams ? b : a));

    const tiles = [
        { label: 'Genre des Jahres', value: topGenre, note: `${genreWins} von ${rows.length} Monaten an der Spitze`, color: genreColor(topGenre) },
        { label: 'Stärkster Monat', value: MONTHS_FULL[peak.month - 1], note: `${fmtText(peak.streams)} Streams · ${peak.genre}`, color: genreColor(peak.genre) },
        { label: 'Artist des Jahres', value: topArtist, note: `${artistWins}× Top Artist im Top Genre` },
        { label: 'Grösster Artist-Anteil', value: pct(share.artistStreams, share.streams), note: `${share.artist} im ${MONTHS_FULL[share.month - 1]} (${share.genre})` },
    ];

    $('kpis').innerHTML = tiles.map(t => `
        <div class="kpi"${t.color ? ` style="--accent:${t.color}"` : ''}>
            <small>${esc(t.label)}</small>
            <strong>${esc(t.value)}</strong>
            <span>${esc(t.note)}</span>
        </div>`).join('');
}

// ---------- Hauptdiagramm ----------

// Spalten einmal aufbauen (bleiben beim Jahreswechsel bestehen -> Animation)
function buildChart() {
    const chartEl = $('chart');
    chartEl.innerHTML = '';
    chartEl.className = state.mode === 'season' ? 'seasons' : '';
    $('mode-label').textContent = state.mode === 'season' ? 'Jahreszeit' : 'Monat';
    $('hint').textContent = (state.mode === 'season'
        ? 'Winter = Dezember (Vorjahr), Januar, Februar · Frühling = Mär–Mai · Sommer = Jun–Aug · Herbst = Sep–Nov. '
        : '') + 'Fahre über einen Balken oder tippe ihn an, um darunter die Details zu sehen.';

    PERIODS[state.mode].forEach((p, i) => {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `<div class="bar-wrap"><div class="bar"></div></div><button type="button" class="col-label">${p.label}</button>`;
        col.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') select(i); });
        col.addEventListener('click', () => select(i));
        col.addEventListener('focusin', () => select(i));
        chartEl.appendChild(col);
    });
    void chartEl.offsetHeight; // Reflow, damit die Balken von 0 aus "hochwachsen"
}

function renderChart() {
    const chartEl = $('chart');
    const sums = PERIODS[state.mode].map(p => summarize(periodKeys(state.year, p)));
    const max = Math.max(1, ...sums.filter(Boolean).map(s => s.top.value));

    sums.forEach((s, i) => {
        const bar = chartEl.children[i].querySelector('.bar');
        if (!s) {
            bar.style.height = '0%';
            bar.innerHTML = '';
            bar.removeAttribute('title');
            return;
        }
        const t = s.top;
        const [num, unit] = fmt(t.value);
        const label = db.hasGenres
            ? (state.metric === 'weekly' ? 'Streams / Woche' : 'Streams')
            : (s.exact ? 'Streams' : 'Ø Streams / Monat');
        const wins = !db.hasGenres && !s.exact ? `<small class="wins">${t.wins} von ${s.rows.length} Monaten</small>` : '';

        bar.style.height = (t.value / max * 100) + '%';
        bar.style.backgroundColor = genreColor(t.genre);
        bar.title = `${t.genre}: ${fmtFull(t.value)} ${label}`;
        bar.innerHTML = `<div class="streams">${num}<small>${unit} ${label}</small></div>
            <div class="genre">${esc(t.genre)}${wins}</div>
            <div class="artist"><small>★ Top Artist</small>${esc(t.artist)}</div>`;
    });
}

function select(i) {
    if (i === state.selected) return;
    state.selected = i;
    markActive();
    renderDetail();
    renderHeatmap();
}

function markActive() {
    [...$('chart').children].forEach((c, i) => c.classList.toggle('active', i === state.selected));
}

// ---------- Detailkarte ----------

function renderDetail() {
    const p = PERIODS[state.mode][state.selected];
    const keys = periodKeys(state.year, p);
    const s = summarize(keys);

    const range = state.mode === 'season' ? ` <small>(${keyLabel(keys[0], true)} – ${keyLabel(keys[2], true)})</small>` : '';
    $('detail-kicker').textContent = state.mode === 'season' ? 'Jahreszeit' : 'Monat';
    $('rank-title').innerHTML = `${esc(p.full)} ${state.year}${range}`;

    const detail = $('detail');
    if (!s) {
        detail.innerHTML = '<p class="empty">Für diesen Zeitraum sind keine Daten vorhanden.</p>';
        renderRanking(null);
        return;
    }

    const t = s.top;
    const facts = [];

    facts.push(fact('Top Genre', `${chip(t.genre)}${esc(t.genre)}`,
        s.exact || db.hasGenres
            ? `${fmtFull(t.streams)} Streams` + (db.hasGenres ? ` · ${pct(t.streams, s.total)} aller Chart-Streams` : '')
            : `${t.wins} von ${s.rows.length} Monaten an der Spitze`));

    // Artist-Anteil am Genre
    const genreStreams = db.hasGenres || s.exact ? t.streams : null;
    facts.push(fact('★ Top Artist', esc(t.artist),
        `${fmtFull(t.artistStreams)} Streams` + (genreStreams ? ` · ${pct(t.artistStreams, genreStreams)} des Genres` : ''),
        genreStreams ? t.artistStreams / genreStreams : null));

    if (db.hasGenres && t.track?.name) {
        facts.push(fact('♫ Top Song im Genre', esc(t.track.name), `${esc(t.track.artist)} · ${fmtFull(t.track.streams)} Streams`));
        facts.push(fact('Explicit-Anteil', pct(t.explicit, t.streams), `der ${esc(t.genre)}-Streams stammen von Songs mit Explicit-Kennzeichnung`, t.explicit / t.streams));
        facts.push(fact('Chart-Wochen', String(s.weeks), `Ø ${fmtText(t.streams / (s.weeks || 1))} Streams pro Woche im Top Genre`));
    }

    // Monat: Vergleich mit Vormonat; Jahreszeit: die einzelnen Monate
    if (state.mode === 'month') {
        const prevKey = monthKey(p.months[0] === 1 ? state.year - 1 : state.year, p.months[0] === 1 ? 12 : p.months[0] - 1);
        const prev = db.monthByKey.get(prevKey);
        const cur = db.monthByKey.get(keys[0]);
        if (prev && cur) {
            const change = (cur.streams - prev.streams) / prev.streams * 100;
            const same = prev.genre === cur.genre;
            facts.push(fact('Vormonat', `${chip(prev.genre)}${esc(prev.genre)}`,
                `${keyLabel(prevKey)} · ${fmtFull(prev.streams)} Streams` +
                (same ? ` · ${change >= 0 ? '+' : ''}${change.toLocaleString('de-CH', { maximumFractionDigits: 1 })} %` : ' · anderes Top Genre')));
        }
    } else {
        const list = keys.map(k => {
            const r = db.monthByKey.get(k);
            return r
                ? `<li>${chip(r.genre)}<b>${keyLabel(k, true)}</b> ${esc(r.genre)} · ${esc(r.artist)}</li>`
                : `<li class="muted"><b>${keyLabel(k, true)}</b> keine Daten</li>`;
        }).join('');
        facts.push(`<div class="fact wide"><small>Die Monate</small><ul class="months-list">${list}</ul></div>`);
    }

    detail.innerHTML = facts.join('');
    renderRanking(s);
}

function fact(label, value, note, share = null) {
    const bar = share !== null ? `<div class="share"><div style="width:${Math.min(100, share * 100)}%"></div></div>` : '';
    return `<div class="fact"><small>${label}</small><strong>${value}</strong>${bar}<span>${note}</span></div>`;
}

// ---------- Genre-Rangliste (nur mit Genre-Daten) ----------

const rankRows = {};

// Pro Genre eine feste Zeile: beim Wechsel ändert sich nur die Position -> Balken "überholen" sich
function buildRanking() {
    const el = $('ranking');
    el.innerHTML = '';
    el.style.setProperty('--row', ROW + 'px');
    el.style.height = db.genres.length * ROW + 'px';
    db.genres.forEach(g => {
        const li = document.createElement('li');
        li.className = 'out';
        li.style.transform = `translateY(${db.genres.length * ROW}px)`;
        li.innerHTML = `<span class="pos"></span><span class="name" title="${esc(g)}">${esc(g)}</span>
            <div class="track"><div class="fill" style="background:${genreColor(g)}"></div></div><span class="val"></span>`;
        el.appendChild(li);
        rankRows[g] = li;
    });
}

function renderRanking(s) {
    if (!db.hasGenres) return;
    const list = s?.ranking ?? [];
    const max = list.length ? list[0].value : 1;
    $('ranking').style.height = Math.max(1, list.length) * ROW + 'px';

    Object.entries(rankRows).forEach(([g, li]) => {
        const idx = list.findIndex(t => t.genre === g);
        li.classList.toggle('out', idx < 0);
        if (idx < 0) { li.style.transform = `translateY(${db.genres.length * ROW}px)`; return; }
        const r = list[idx];
        li.style.transform = `translateY(${idx * ROW}px)`;
        li.title = `${g} · Top Artist: ${r.artist}`;
        li.querySelector('.pos').textContent = pad(idx + 1);
        li.querySelector('.fill').style.width = (r.value / max * 100) + '%';
        li.querySelector('.val').textContent = fmtText(r.value);
    });
}

// ---------- Heatmap: alle Monate ----------

function buildHeatmap() {
    const el = $('heatmap');
    let html = '<span></span>' + MONTHS_SHORT.map(m => `<span class="hm-head">${m}</span>`).join('');
    db.years.forEach(y => {
        html += `<button type="button" class="hm-year" data-year="${y}">${y}</button>`;
        for (let m = 1; m <= 12; m++) {
            const r = db.monthByKey.get(monthKey(y, m));
            html += r
                ? `<button type="button" class="hm-cell" data-key="${r.key}" style="background:${genreColor(r.genre)}"
                     aria-label="${keyLabel(r.key)}: ${esc(r.genre)}, ${esc(r.artist)}"></button>`
                : '<span class="hm-cell empty"></span>';
        }
    });
    el.innerHTML = html;

    el.querySelectorAll('.hm-cell[data-key]').forEach(cell => {
        const r = db.monthByKey.get(cell.dataset.key);
        cell.addEventListener('pointerenter', e => showTooltip(e, monthTooltip(r)));
        cell.addEventListener('pointermove', moveTooltip);
        cell.addEventListener('pointerleave', hideTooltip);
        cell.addEventListener('click', () => goToMonth(r.year, r.month));
    });
    el.querySelectorAll('.hm-year').forEach(btn => btn.addEventListener('click', () => {
        state.year = +btn.dataset.year;
        $('year-select').value = state.year;
        update();
    }));

    // Legende mit Anzahl Monatssiegen
    const wins = {};
    db.months.forEach(r => (wins[r.genre] = (wins[r.genre] || 0) + 1));
    $('legend').innerHTML = db.genres.filter(g => wins[g]).map(g =>
        `<span class="legend-item">${chip(g)}${esc(g)} <b>${wins[g]}</b></span>`).join('') +
        `<span class="legend-note">Anzahl Monate an der Spitze (von ${db.months.length})</span>`;
}

function renderHeatmap() {
    const el = $('heatmap');
    const activeKeys = new Set(periodKeys(state.year, PERIODS[state.mode][state.selected]));
    el.querySelectorAll('.hm-cell[data-key]').forEach(cell => {
        const r = db.monthByKey.get(cell.dataset.key);
        cell.classList.toggle('active', activeKeys.has(r.key));
        cell.classList.toggle('dim', state.artist !== null && r.artist !== state.artist);
        cell.classList.toggle('hit', state.artist !== null && r.artist === state.artist);
    });
    el.querySelectorAll('.hm-year').forEach(b => b.classList.toggle('active', +b.dataset.year === state.year));
}

function monthTooltip(r) {
    return `<b>${keyLabel(r.key)}</b><br>${chip(r.genre)}${esc(r.genre)} · ${fmtText(r.streams)} Streams<br>★ ${esc(r.artist)} · ${fmtText(r.artistStreams)}`;
}

// Monat oben im Hauptdiagramm anzeigen
function goToMonth(year, month) {
    state.year = year;
    $('year-select').value = year;
    if (state.mode !== 'month') {
        state.mode = 'month';
        setToggle('[data-mode]', document.querySelector('[data-mode="month"]'));
        buildChart();
    }
    state.selected = month - 1;
    update();
    $('chart').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- Saisonale Muster ----------

function renderPattern() {
    const years = db.years.length;
    $('pattern').innerHTML = MONTHS_SHORT.map((label, i) => {
        const rows = db.months.filter(r => r.month === i + 1);
        const c = {};
        rows.forEach(r => (c[r.genre] = (c[r.genre] || 0) + 1));
        const segs = db.genres.filter(g => c[g]).map(g =>
            `<div class="seg" style="height:${c[g] / years * 100}%;background:${genreColor(g)}"
                  title="${MONTHS_FULL[i]}: ${esc(g)} ${c[g]}× an der Spitze">${c[g] > 1 ? c[g] : ''}</div>`).join('');
        return `<div class="pcol"><div class="pstack">${segs}</div><span>${label}</span></div>`;
    }).join('');
}

// ---------- Zeitverlauf (SVG) ----------

function renderTimeline() {
    const el = $('timeline');
    const keys = db.months.map(r => r.key);
    const W = 1000, H = 320, L = 56, R = 12, T = 16, B = 34;
    const x = i => L + (keys.length <= 1 ? 0 : i / (keys.length - 1) * (W - L - R));

    let series;
    if (db.hasGenres) {
        $('timeline-title').textContent = 'Alle Genres im Zeitverlauf';
        $('timeline-sub').textContent = `${state.metric === 'weekly' ? 'Durchschnittliche Streams pro Chart-Woche' : 'Streams pro Monat'} je Genre. Klicke auf ein Genre in der Legende, um es ein- oder auszublenden.`;
        series = db.genres.map(g => ({
            name: g, color: genreColor(g), dashed: false,
            values: keys.map(k => {
                const r = db.genresByKey.get(k)?.find(row => row.genre === g);
                return r ? metricValue(r.streams, r.weeks) : null;
            }),
        })).filter(s => !state.hiddenGenres.has(s.name));
    } else {
        $('timeline-title').textContent = 'Streams im Zeitverlauf';
        $('timeline-sub').textContent = 'Streams des meistgehörten Genres (Punktfarbe = Genre) und Streams des jeweiligen Top Artists pro Monat.';
        series = [
            { name: 'Top Genre', color: 'var(--cream)', dots: true, values: db.months.map(r => r.streams) },
            { name: 'Top Artist', color: 'var(--lilac)', dashed: true, values: db.months.map(r => r.artistStreams) },
        ];
    }

    renderTimelineLegend();

    const maxV = Math.max(1, ...series.flatMap(s => s.values.filter(v => v !== null)));
    const step = niceStep(maxV / 4);
    const top = Math.ceil(maxV / step) * step;
    const y = v => T + (1 - v / top) * (H - T - B);

    let svg = '';

    // gewähltes Jahr hinterlegen
    const yi = keys.map((k, i) => (k.startsWith(state.year + '-') ? i : -1)).filter(i => i >= 0);
    if (yi.length) svg += `<rect class="tl-year" x="${x(yi[0]) - 4}" y="${T}" width="${x(yi[yi.length - 1]) - x(yi[0]) + 8}" height="${H - T - B}"/>`;

    // Gitternetz
    for (let v = 0; v <= top + 1; v += step) {
        svg += `<line class="tl-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tl-axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(fmtText(v))}</text>`;
    }
    keys.forEach((k, i) => {
        if (k.endsWith('-01')) svg += `<text class="tl-axis" x="${x(i)}" y="${H - 10}">${k.slice(0, 4)}</text>`;
    });

    // Linien
    series.forEach(s => {
        let d = '', pen = false;
        s.values.forEach((v, i) => {
            if (v === null) { pen = false; return; }
            d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
            pen = true;
        });
        svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
        if (s.dots) {
            db.months.forEach((r, i) => {
                const hit = state.artist && r.artist === state.artist;
                svg += `<circle cx="${x(i)}" cy="${y(s.values[i])}" r="${hit ? 6 : 3.4}" fill="${genreColor(r.genre)}" ${hit ? 'class="tl-hit"' : ''}/>`;
            });
        }
    });

    // Hervorgehobener Artist (mit Genre-Daten): Monate markieren
    if (db.hasGenres && state.artist) {
        db.genreRows.filter(r => r.artist === state.artist && !state.hiddenGenres.has(r.genre)).forEach(r => {
            const i = keys.indexOf(r.key);
            if (i >= 0) svg += `<circle class="tl-hit" cx="${x(i)}" cy="${y(metricValue(r.streams, r.weeks))}" r="5.5" fill="${genreColor(r.genre)}"/>`;
        });
    }

    svg += `<line id="tl-cursor" class="tl-cursor" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
    svg += `<rect id="tl-hover" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Streams pro Monat von ${keys[0]} bis ${keys[keys.length - 1]}">${svg}</svg>`;

    // Interaktion: nächsten Monat finden
    const svgEl = el.querySelector('svg');
    const hover = $('tl-hover');
    const cursor = $('tl-cursor');
    const indexAt = e => {
        const box = svgEl.getBoundingClientRect();
        const px = (e.clientX - box.left) / box.width * W;
        return Math.max(0, Math.min(keys.length - 1, Math.round((px - L) / (W - L - R) * (keys.length - 1))));
    };
    hover.addEventListener('pointermove', e => {
        const i = indexAt(e);
        cursor.setAttribute('x1', x(i));
        cursor.setAttribute('x2', x(i));
        cursor.setAttribute('visibility', 'visible');
        showTooltip(e, timelineTooltip(keys[i], series));
    });
    hover.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); hideTooltip(); });
    hover.addEventListener('click', e => {
        const r = db.monthByKey.get(keys[indexAt(e)]);
        if (r) goToMonth(r.year, r.month);
    });
}

function timelineTooltip(key, series) {
    const r = db.monthByKey.get(key);
    if (!db.hasGenres) return monthTooltip(r);
    const i = db.months.findIndex(m => m.key === key);
    const lines = series
        .map(s => ({ name: s.name, v: s.values[i] }))
        .filter(s => s.v !== null)
        .sort((a, b) => b.v - a.v)
        .map(s => `${chip(s.name)}${esc(s.name)} · ${fmtText(s.v)}`);
    return `<b>${keyLabel(key)}</b><br>${lines.join('<br>')}`;
}

function renderTimelineLegend() {
    const el = $('timeline-legend');
    if (!db.hasGenres) {
        el.innerHTML = `<span class="legend-item"><span class="line-key"></span>Top Genre (Punkt = Genre)</span>
            <span class="legend-item"><span class="line-key dashed"></span>Top Artist</span>`;
        return;
    }
    el.innerHTML = db.genres.map(g =>
        `<button type="button" class="legend-item toggle-genre${state.hiddenGenres.has(g) ? ' off' : ''}" data-genre="${esc(g)}" aria-pressed="${!state.hiddenGenres.has(g)}">${chip(g)}${esc(g)}</button>`).join('');
    el.querySelectorAll('.toggle-genre').forEach(btn => btn.addEventListener('click', () => {
        const g = btn.dataset.genre;
        state.hiddenGenres.has(g) ? state.hiddenGenres.delete(g) : state.hiddenGenres.add(g);
        renderTimeline();
    }));
}

function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
}

// ---------- Top Artists ----------

// Wie oft war ein Artist die Nr. 1 seines Genres in einem Monat?
function artistStats() {
    const source = db.hasGenres
        ? db.genreRows.map(r => ({ key: r.key, genre: r.genre, artist: r.artist, artistStreams: r.artistStreams, streams: r.streams }))
        : db.months;
    const by = {};
    source.forEach(r => {
        const a = (by[r.artist] ??= { artist: r.artist, months: 0, streams: 0, share: 0, genres: {}, first: r.key, last: r.key });
        a.months++;
        a.streams += r.artistStreams;
        a.share += r.artistStreams / (r.streams || 1);
        a.genres[r.genre] = (a.genres[r.genre] || 0) + 1;
        if (r.key < a.first) a.first = r.key;
        if (r.key > a.last) a.last = r.key;
    });
    return Object.values(by).sort((a, b) => b.months - a.months || b.streams - a.streams);
}

function renderArtists() {
    const all = artistStats();
    all.forEach((a, i) => (a.rank = i + 1));

    $('artists-sub').textContent = db.hasGenres
        ? 'Wie oft war ein Artist in einem Monat die Nummer 1 innerhalb seines Genres? Klicke auf einen Artist, um seine Monate oben in der Übersicht und im Zeitverlauf hervorzuheben.'
        : 'Wie oft war ein Artist in einem Monat der Top Artist im meistgehörten Genre? Klicke auf einen Artist, um seine Monate in der Übersicht und im Zeitverlauf hervorzuheben.';

    // Genre-Filter
    const genresHere = db.genres.filter(g => all.some(a => a.genres[g]));
    $('artist-genres').innerHTML = ['Alle', ...genresHere].map(g => {
        const active = (g === 'Alle' && !state.artistGenre) || g === state.artistGenre;
        return `<button type="button" class="chip${active ? ' active' : ''}" data-genre="${esc(g)}" aria-pressed="${active}">${g === 'Alle' ? '' : chip(g)}${esc(g)}</button>`;
    }).join('');
    $('artist-genres').querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
        state.artistGenre = btn.dataset.genre === 'Alle' ? null : btn.dataset.genre;
        state.artistsShown = ARTISTS_PAGE;
        renderArtists();
    }));

    const list = all.filter(a =>
        (!state.artistGenre || a.genres[state.artistGenre]) &&
        (!state.artistQuery || a.artist.toLowerCase().includes(state.artistQuery)));
    const max = all[0]?.months || 1;

    $('artists').innerHTML = list.length === 0
        ? '<li class="empty">Kein Artist gefunden.</li>'
        : list.slice(0, state.artistsShown).map(a => {
            const genres = Object.entries(a.genres).sort((x, y) => y[1] - x[1]).map(([g]) => chip(g)).join('');
            const period = a.first === a.last ? keyLabel(a.first, true) : `${keyLabel(a.first, true)} – ${keyLabel(a.last, true)}`;
            return `<li>
                <button type="button" class="artist-row${a.artist === state.artist ? ' active' : ''}" data-artist="${esc(a.artist)}" aria-pressed="${a.artist === state.artist}">
                    <span class="pos">${pad(a.rank)}</span>
                    <span class="a-name">${esc(a.artist)}<small>${genres} ${period}</small></span>
                    <span class="a-bar"><span style="width:${a.months / max * 100}%"></span></span>
                    <span class="a-val">${a.months}<small>${a.months === 1 ? 'Monat' : 'Monate'}</small></span>
                    <span class="a-share">${pct(a.share, a.months)}<small>Ø Genre-Anteil</small></span>
                </button>
            </li>`;
        }).join('');

    $('artists').querySelectorAll('.artist-row').forEach(btn => btn.addEventListener('click', () => {
        state.artist = state.artist === btn.dataset.artist ? null : btn.dataset.artist;
        renderArtists();
        renderHeatmap();
        renderTimeline();
    }));

    const more = $('artists-more');
    more.hidden = list.length <= state.artistsShown;
    more.textContent = `Weitere Artists anzeigen (${list.length - Math.min(list.length, state.artistsShown)})`;

    const note = $('artist-highlight');
    note.hidden = !state.artist;
    if (state.artist) {
        note.innerHTML = `Hervorgehoben: <b>${esc(state.artist)}</b> <button type="button">Auswahl aufheben</button>`;
        note.querySelector('button').addEventListener('click', () => {
            state.artist = null;
            renderArtists();
            renderHeatmap();
            renderTimeline();
        });
    }
}

// ---------- Methode ----------

function renderMethod() {
    const first = db.months[0].key, last = db.months[db.months.length - 1].key;
    const items = [
        `Quelle: Kaggle-Datensatz <a href="https://www.kaggle.com/datasets/jfreyberg/spotify-chart-data/" target="_blank" rel="noopener">„Spotify Chart Data“</a> (jfreyberg), gefiltert auf die Schweiz.`,
        `Angezeigt werden ${db.months.length} Monate von ${keyLabel(first)} bis ${keyLabel(last)} – live aus unserer Datenbank geladen.`,
        'Die Charts sind wöchentlich. Jede Chart-Woche zählt zum Monat ihres Datums; die Streams werden pro Monat summiert. Monate mit fünf Chart-Wochen haben deshalb mehr Streams'
            + (db.hasGenres ? ' – die Ansicht „Ø pro Woche“ gleicht das aus.' : '.'),
        'Die Spotify-Genres jedes Artists werden zu Hauptgenres zusammengefasst (Pop, Hip-Hop / Rap, Electronic / Dance, Rock, R&amp;B / Soul, Latin, Indie / Alternative, Other).',
        'Bei Songs mit mehreren Artists zählt nur der erste Artist.',
        db.hasGenres
            ? 'Jahreszeiten und Ranglisten summieren die Streams aller Genres über die jeweiligen Monate.'
            : 'Jahreszeiten zeigen das Genre, das in den meisten der drei Monate an der Spitze war, mit den durchschnittlichen Streams dieser Monate.',
    ];
    $('method').innerHTML = items.map(i => `<li>${i}</li>`).join('');
}

// ---------- Tooltip ----------

function showTooltip(e, html) {
    const tip = $('tooltip');
    tip.innerHTML = html;
    tip.hidden = false;
    moveTooltip(e);
}
function moveTooltip(e) {
    const tip = $('tooltip');
    const gap = 14;
    let left = e.clientX + gap, top = e.clientY + gap;
    if (left + tip.offsetWidth > window.innerWidth - 8) left = e.clientX - tip.offsetWidth - gap;
    if (top + tip.offsetHeight > window.innerHeight - 8) top = e.clientY - tip.offsetHeight - gap;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
}
function hideTooltip() { $('tooltip').hidden = true; }

loadData();
