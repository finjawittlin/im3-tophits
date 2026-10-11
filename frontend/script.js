// ===== Einstellungen =====
// Später nur diese Zeile ändern: 'mock-data.json' -> URL von unload.php
const DATA_URL = 'mock-data.json';
// Feldnamen laut Datenvertrag (bei Umbenennung nur hier anpassen)
const F = { genre: 'genre', date: 'date', streams: 'streamscount', artist: 'top_artist' };

const MONTHS_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const PERIODS = {
    month: MONTHS_FULL.map((name, i) => ({ label: name.slice(0, 3), full: name, months: [i + 1] })),
    season: [
        { label: 'Winter', full: 'Winter', months: [12, 1, 2] },
        { label: 'Frühling', full: 'Frühling', months: [3, 4, 5] },
        { label: 'Sommer', full: 'Sommer', months: [6, 7, 8] },
        { label: 'Herbst', full: 'Herbst', months: [9, 10, 11] },
    ],
};
const COLORS = ['#ff3eb5', '#c8b0f5', '#e8412c', '#8fb8ff', '#d4f23c', '#ff9f43', '#f2ede4', '#7ee8c1', '#ffe14d', '#ff8fab', '#5b8cff', '#b8f2e6'];
const ROW = 46, TOP_N = 10;

const $ = id => document.getElementById(id);
const chartEl = $('chart'), rankEl = $('ranking'), statusEl = $('status'), yearSelect = $('year-select');
const state = { year: null, mode: 'month', selected: 0 };
let allData = [];
const genreColors = {}, rows = {};

// Unterstützt "2022-03-01" (ISO) und "01.03.2022"
function parseDate(str) {
    const iso = /^(\d{4})-(\d{2})/.exec(str);
    if (iso) return { year: +iso[1], month: +iso[2] };
    const de = /^\d{1,2}\.(\d{1,2})\.(\d{4})/.exec(str);
    return de ? { year: +de[2], month: +de[1] } : null;
}

function fmt(n) {
    const big = n >= 1e6;
    return [(big ? n / 1e6 : n / 1e3).toLocaleString('de-CH', { maximumFractionDigits: big ? 2 : 0 }), big ? 'Mio' : 'Tsd'];
}

// Genres eines Zeitraums (Monat oder Jahreszeit) summieren und nach Streams sortieren
function ranking(year, months) {
    const by = {};
    allData.filter(r => r.year === year && months.includes(r.month)).forEach(r => {
        const g = (by[r[F.genre]] ??= { genre: r[F.genre], streams: 0, artists: {} });
        g.streams += r[F.streams];
        g.artists[r[F.artist]] = (g.artists[r[F.artist]] || 0) + r[F.streams];
    });
    return Object.values(by)
        .map(g => ({ genre: g.genre, streams: g.streams, artist: Object.entries(g.artists).sort((a, b) => b[1] - a[1])[0][0] }))
        .sort((a, b) => b.streams - a.streams);
}

async function loadData() {
    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        allData = (await res.json()).map(r => ({ ...r, ...parseDate(r[F.date]) })).filter(r => r.year && r.month);
        init();
    } catch (err) {
        statusEl.textContent = 'Daten konnten nicht geladen werden: ' + err.message;
    }
}

function init() {
    const genres = [...new Set(allData.map(r => r[F.genre]))].sort();
    genres.forEach((g, i) => (genreColors[g] = COLORS[i % COLORS.length]));
    buildRanking(genres);

    const years = [...new Set(allData.map(r => r.year))].sort();
    yearSelect.innerHTML = years.map(y => `<option>${y}</option>`).join('');
    state.year = years[years.length - 1];
    yearSelect.value = state.year;
    yearSelect.addEventListener('change', () => { state.year = +yearSelect.value; update(); });

    document.querySelectorAll('.toggle button').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle button').forEach(b => b.classList.toggle('active', b === btn));
        state.mode = btn.dataset.mode;
        state.selected = 0;
        buildChart();
        update();
    }));
    buildChart();
    update();
}

// Balken-Spalten einmal aufbauen (bleiben beim Jahreswechsel bestehen -> Animation)
function buildChart() {
    chartEl.innerHTML = '';
    chartEl.className = state.mode === 'season' ? 'seasons' : '';
    $('mode-label').textContent = state.mode === 'season' ? 'Jahreszeit' : 'Monat';
    $('hint').textContent = (state.mode === 'season'
        ? 'Winter = Dez, Jan, Feb · Frühling = Mär–Mai · Sommer = Jun–Aug · Herbst = Sep–Nov. '
        : '') + 'Fahre über einen Balken oder eine Beschriftung (am Handy: antippen), um darunter die Top 10 zu sehen.';
    PERIODS[state.mode].forEach((p, i) => {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `<div class="bar-wrap"><div class="bar"></div></div><button class="col-label">${p.label}</button>`;
        ['pointerenter', 'click', 'focusin'].forEach(ev => col.addEventListener(ev, () => select(i)));
        chartEl.appendChild(col);
    });
    void chartEl.offsetHeight; // Reflow, damit die Balken von 0 aus "hochwachsen"
}

function renderChart() {
    const tops = PERIODS[state.mode].map(p => ranking(state.year, p.months)[0]);
    const max = Math.max(...tops.filter(Boolean).map(t => t.streams));
    tops.forEach((t, i) => {
        const bar = chartEl.children[i].querySelector('.bar');
        if (!t) { bar.style.height = '0%'; return; }
        const [num, unit] = fmt(t.streams);
        bar.style.height = (t.streams / max * 100) + '%';
        bar.style.backgroundColor = genreColors[t.genre];
        bar.title = `${t.genre}: ${t.streams.toLocaleString('de-CH')} Streams`;
        bar.innerHTML = `<div class="streams">${num}<small>${unit} Streams</small></div>
      <div class="genre">${t.genre}</div>
      <div class="artist"><small>★ Top Artist</small>${t.artist}</div>`;
    });
}

// Pro Genre eine feste Zeile: beim Wechsel ändert sich nur die Position -> Balken "überholen" sich
function buildRanking(genres) {
    rankEl.style.setProperty('--row', ROW + 'px');
    rankEl.style.height = TOP_N * ROW + 'px';
    genres.forEach(g => {
        const li = document.createElement('li');
        li.className = 'out';
        li.style.transform = `translateY(${TOP_N * ROW}px)`;
        li.innerHTML = `<span class="pos"></span><span class="name">${g}</span>
      <div class="track"><div class="fill" style="background:${genreColors[g]}"></div></div><span class="val"></span>`;
        rankEl.appendChild(li);
        rows[g] = li;
    });
}

function renderRanking() {
    const p = PERIODS[state.mode][state.selected];
    $('rank-title').textContent = `${p.full} ${state.year}`;
    const top = ranking(state.year, p.months).slice(0, TOP_N);
    const max = top.length ? top[0].streams : 1;
    Object.entries(rows).forEach(([g, li]) => {
        const idx = top.findIndex(t => t.genre === g);
        li.classList.toggle('out', idx < 0);
        if (idx < 0) { li.style.transform = `translateY(${TOP_N * ROW}px)`; return; }
        const [num, unit] = fmt(top[idx].streams);
        li.style.transform = `translateY(${idx * ROW}px)`;
        li.querySelector('.pos').textContent = String(idx + 1).padStart(2, '0');
        li.querySelector('.fill').style.width = (top[idx].streams / max * 100) + '%';
        li.querySelector('.val').textContent = `${num} ${unit}`;
    });
}

function select(i) {
    if (i === state.selected) return;
    state.selected = i;
    markActive();
    renderRanking();
}
function markActive() { [...chartEl.children].forEach((c, i) => c.classList.toggle('active', i === state.selected)); }
function update() { renderChart(); markActive(); renderRanking(); }

loadData();