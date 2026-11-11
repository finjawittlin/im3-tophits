// ============================================================
// Das Mixtape & die Jahreszeiten-Effekte
//
// ROTER FADEN: Die Reportage ist ein Mixtape.
//   Seite A (Pink/Pop):     Intro · 01 Pink · Kurze Frage
//   -> beim Farbwischer wird die Kassette umgedreht <-
//   Seite B (Neon/Hip-Hop): 02 Wandel · 03 Jahresuhr · 04 Gesichter · 05 Streams · 06 Fazit
//   Bonus:                  07 Dein Jahr (+ Hidden Track, wenn alle 5 Noten gefunden sind)
//
// DAS MIXTAPE (unten links) ist der Begleiter:
//   - zeigt, welcher Track (Kapitel) läuft und wie viel Band schon gelaufen ist
//   - die Spulen drehen sich nur, wenn gescrollt wird (Scrollen = Play)
//   - Liner Notes: kurzer, datenbasierter Kommentar; in Kapitel 2 und in der
//     Zeitmaschine live mit dem aktuellen Monat
//   - «Tipp»: macht auf das interaktive Element im Kapitel aufmerksam und
//     springt auf Klick dorthin (Spotlight)
//   - ⏮ ⏭ und Trackliste zum Navigieren, ✓ für gehörte Tracks
//   - reagiert auf Quiz, Wendepunkt, Zeitmaschine und versteckte Noten
//
// JAHRESZEITEN erscheinen nur dort, wo Inhalte von Jahreszeiten handeln,
// und nur auf Hover/Fokus/Tippen oder kurz beim ersten Hineinscrollen:
//   [data-season-fx="snow|leaves|bloom|sun"] (mehrere mit Leerzeichen)
//   Schnee bleibt unten liegen, Blumen wachsen aus dem Rand, Sonne wirft Strahlen.
//
// Keine Daten werden verändert. Bei prefers-reduced-motion: keine Effekte,
// keine Animation – das Mixtape funktioniert trotzdem als Wegweiser.
// ============================================================

(() => {
    const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const html = document.documentElement;
    const store = {
        get(key) { try { return localStorage.getItem(key); } catch { return null; } },
        set(key, v) { try { localStorage.setItem(key, v); } catch { /* egal */ } },
    };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lbl = r => keyLabel(r.key);
    let F = null;

    // Kalendermonat -> Jahreszeiten-Effekt
    const fxOfMonth = m => ([12, 1, 2].includes(m) ? 'snow' : m <= 5 ? 'bloom' : m <= 8 ? 'sun' : 'leaves');

    // =========================================================
    // 1. JAHRESZEITEN-EFFEKTE (lokal, ausgelöst)
    // =========================================================

    const fx = {
        canvas: null, ctx: null, w: 0, h: 0, zones: new Map(), running: false, last: 0,

        mount() {
            if (!motionOK) return;
            const c = document.createElement('canvas');
            c.className = 'season-fx';
            c.setAttribute('aria-hidden', 'true');
            document.body.appendChild(c);
            this.canvas = c;
            this.ctx = c.getContext('2d');
            this.resize();
            window.addEventListener('resize', () => this.resize());

            // Hover / Fokus / Tippen
            const enter = e => {
                const el = e.target.closest?.('[data-season-fx]');
                if (!el) return;
                if (e.pointerType === 'touch') this.pulse(el, null, 2600);
                else this.start(el);
            };
            const leave = e => {
                const el = e.target.closest?.('[data-season-fx]');
                if (el && !el.contains(e.relatedTarget)) this.stop(el);
            };
            document.addEventListener('pointerover', enter);
            document.addEventListener('pointerout', leave);
            document.addEventListener('focusin', enter);
            document.addEventListener('focusout', leave);
        },

        resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            this.w = window.innerWidth; this.h = window.innerHeight;
            this.canvas.width = Math.round(this.w * dpr);
            this.canvas.height = Math.round(this.h * dpr);
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        },

        zone(el) {
            let z = this.zones.get(el);
            if (!z) {
                z = { el, types: new Set(), on: false, until: 0, parts: [], pile: null, flowers: [], sun: 0, acc: 0 };
                this.zones.set(el, z);
            }
            return z;
        },

        start(el, types) {
            if (!this.canvas) return;
            const z = this.zone(el);
            z.types = new Set((types || el.dataset.seasonFx || '').split(/\s+/).filter(Boolean));
            z.on = true;
            el.classList.add('fx-on');
            if (z.types.has('bloom') && !z.flowers.some(f => f.g > 0)) this.plant(z);
            this.run();
        },

        stop(el) {
            const z = this.zones.get(el);
            if (!z || z.until > performance.now()) return;
            z.on = false;
            el.classList.remove('fx-on');
        },

        // zeitlich begrenzt (Tippen, Zeitmaschine, erstes Hineinscrollen)
        pulse(el, types, ms) {
            if (!this.canvas || !el) return;
            this.start(el, types);
            this.zone(el).until = performance.now() + ms;
        },

        plant(z) {
            const r = z.el.getBoundingClientRect();
            const n = clamp(Math.round(r.width / 58), 4, 12);
            const cols = ['#ff8fab', '#c8b0f5', '#ffe14d', '#ff3eb5', '#f2ede4'];
            z.flowers = Array.from({ length: n }, (_, i) => ({
                x: (i + .5 + (Math.random() - .5) * .7) / n, hgt: clamp(r.height * (.14 + Math.random() * .16), 14, 70),
                g: 0, delay: Math.random() * .5, sway: Math.random() * 6, color: cols[i % cols.length],
            }));
        },

        run() {
            if (this.running) return;
            this.running = true;
            this.last = performance.now();
            const step = now => {
                const dt = Math.min(.05, (now - this.last) / 1000);
                this.last = now;
                if (this.frame(dt, now)) requestAnimationFrame(step);
                else { this.running = false; this.ctx.clearRect(0, 0, this.w, this.h); }
            };
            requestAnimationFrame(step);
        },

        frame(dt, now) {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.w, this.h);
            let alive = false;
            for (const z of [...this.zones.values()]) {
                if (z.until && now > z.until) {
                    z.until = 0;
                    if (!z.el.matches(':hover') && !z.el.contains(document.activeElement)) { z.on = false; z.el.classList.remove('fx-on'); }
                }
                const r = z.el.getBoundingClientRect();
                const busy = this.update(z, r, dt);
                if (!busy) { this.zones.delete(z.el); continue; }
                alive = true;
                if (!(r.bottom > 0 && r.top < this.h && r.width > 0)) continue;
                ctx.save();
                const rad = parseFloat(getComputedStyle(z.el).borderTopLeftRadius) || 0;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(r.left, r.top, r.width, r.height, rad); else ctx.rect(r.left, r.top, r.width, r.height);
                ctx.clip();
                ctx.translate(r.left, r.top);
                this.draw(z, r);
                ctx.restore();
            }
            return alive;
        },

        update(z, r, dt) {
            const W = r.width, H = r.height, on = z.on, now = performance.now();
            if (on) {
                const rate = (z.types.has('snow') ? 40 : 0) + (z.types.has('leaves') ? 7 : 0) + (z.types.has('sun') ? 9 : 0);
                z.acc += rate * dt * clamp(W / 420, .5, 2.2);
                const pick = [...z.types].filter(t => t !== 'bloom');
                while (z.acc >= 1 && pick.length) {
                    z.acc--;
                    const t = pick[Math.floor(Math.random() * pick.length)];
                    if (t === 'snow') z.parts.push({ t, x: Math.random() * W, y: -6, r: 1.2 + Math.random() * 2.3, vy: 40 + Math.random() * 50, ph: Math.random() * 6 });
                    if (t === 'leaves') z.parts.push({ t, x: Math.random() * W, y: -16, r: 5 + Math.random() * 5, vy: 45 + Math.random() * 40, ph: Math.random() * 6,
                        rot: Math.random() * 6, vr: (Math.random() - .5) * 4, life: 1,
                        c: ['#ff7a3d', '#ffb347', '#d9480f', '#ff3eb5', '#d4f23c'][Math.floor(Math.random() * 5)] });
                    if (t === 'sun') z.parts.push({ t: 'glint', x: W * (.3 + Math.random() * .7), y: H * Math.random() * .8, r: 2 + Math.random() * 4, life: 1 });
                }
                if (!pick.length) z.acc = 0;
            }
            for (let i = z.parts.length - 1; i >= 0; i--) {
                const p = z.parts[i];
                if (p.t === 'snow') {
                    p.y += p.vy * dt; p.x += Math.sin(now / 600 + p.ph) * 18 * dt;
                    const cols = z.pile || (z.pile = new Float32Array(Math.max(8, Math.ceil(W / 6))));
                    const ci = clamp(Math.floor(p.x / W * cols.length), 0, cols.length - 1);
                    if (p.y >= H - cols[ci]) {
                        // Schnee bleibt liegen und verteilt sich etwas
                        cols[ci] = Math.min(16, cols[ci] + p.r * .55);
                        if (ci > 0) cols[ci - 1] = Math.min(16, cols[ci - 1] + p.r * .2);
                        if (ci < cols.length - 1) cols[ci + 1] = Math.min(16, cols[ci + 1] + p.r * .2);
                        z.parts.splice(i, 1);
                    }
                } else if (p.t === 'leaves') {
                    p.y += p.vy * dt; p.x += Math.sin(now / 420 + p.ph) * 55 * dt; p.rot += p.vr * dt;
                    if (p.y > H - 8) p.life -= dt * 1.5;
                    if (p.life <= 0) z.parts.splice(i, 1);
                } else {
                    p.life -= dt * 1.1;
                    if (p.life <= 0) z.parts.splice(i, 1);
                }
            }
            // Schnee schmilzt, wenn der Effekt aus ist
            let pileLeft = false;
            if (z.pile) for (let i = 0; i < z.pile.length; i++) {
                if (!on) z.pile[i] = Math.max(0, z.pile[i] - dt * 9);
                if (z.pile[i] > 0) pileLeft = true;
            }
            // Blumen wachsen / welken
            let flowersLeft = false;
            for (const f of z.flowers) {
                if (on && z.types.has('bloom')) { if ((f.delay -= dt) <= 0) f.g = Math.min(1, f.g + dt * 1.1); }
                else f.g = Math.max(0, f.g - dt * 1.6);
                if (f.g > 0) flowersLeft = true;
            }
            z.sun = clamp(z.sun + (on && z.types.has('sun') ? dt * 1.8 : -dt * 1.6), 0, 1);
            return on || z.parts.length > 0 || pileLeft || flowersLeft || z.sun > 0;
        },

        draw(z, r) {
            const ctx = this.ctx, W = r.width, H = r.height, t = performance.now() / 1000;
            // Sonne: warmes Licht und Strahlen aus der oberen rechten Ecke
            if (z.sun > 0) {
                const s = z.sun;
                const gl = ctx.createRadialGradient(W, 0, 0, W, 0, Math.max(W, H) * .9);
                gl.addColorStop(0, `rgba(255,210,94,${.42 * s})`);
                gl.addColorStop(.45, `rgba(255,179,71,${.14 * s})`);
                gl.addColorStop(1, 'rgba(255,179,71,0)');
                ctx.fillStyle = gl;
                ctx.fillRect(0, 0, W, H);
                const L = Math.hypot(W, H);
                ctx.fillStyle = `rgba(255,236,170,${.1 * s})`;
                for (let i = 0; i < 7; i++) {
                    const a = Math.PI / 2 + (i / 7) * (Math.PI / 2) + Math.sin(t * .5 + i) * .04 + t * .03;
                    ctx.beginPath();
                    ctx.moveTo(W, 0);
                    ctx.lineTo(W + Math.cos(a - .05) * L, Math.sin(a - .05) * L);
                    ctx.lineTo(W + Math.cos(a + .05) * L, Math.sin(a + .05) * L);
                    ctx.fill();
                }
            }
            for (const p of z.parts) {
                if (p.t === 'snow') {
                    ctx.globalAlpha = .9; ctx.fillStyle = '#fbf8f2';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
                } else if (p.t === 'leaves') {
                    ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c;
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.cos(t * 2 + p.ph) * .45 + .6, 1);
                    const k = p.r;
                    ctx.beginPath(); ctx.moveTo(0, -k * 1.6);
                    ctx.quadraticCurveTo(k * 1.3, -k * .2, 0, k * 1.6); ctx.quadraticCurveTo(-k * 1.3, -k * .2, 0, -k * 1.6); ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .8;
                    ctx.beginPath(); ctx.moveTo(0, -k * 1.3); ctx.lineTo(0, k * 1.9); ctx.stroke();
                    ctx.restore();
                } else {
                    const a = Math.sin(p.life * Math.PI);
                    ctx.globalAlpha = a; ctx.fillStyle = '#fff6d0';
                    const k = p.r * (.6 + a * .6);
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y - k * 2.2); ctx.lineTo(p.x + k * .35, p.y - k * .35); ctx.lineTo(p.x + k * 2.2, p.y);
                    ctx.lineTo(p.x + k * .35, p.y + k * .35); ctx.lineTo(p.x, p.y + k * 2.2); ctx.lineTo(p.x - k * .35, p.y + k * .35);
                    ctx.lineTo(p.x - k * 2.2, p.y); ctx.lineTo(p.x - k * .35, p.y - k * .35); ctx.closePath(); ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
            // Schneedecke
            if (z.pile) {
                const n = z.pile.length;
                ctx.fillStyle = '#fbf8f2';
                ctx.beginPath(); ctx.moveTo(0, H);
                for (let i = 0; i < n; i++) {
                    const v = (z.pile[Math.max(0, i - 1)] + z.pile[i] * 2 + z.pile[Math.min(n - 1, i + 1)]) / 4;
                    ctx.lineTo((i + .5) / n * W, H - v);
                }
                ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
            }
            // Blumen
            for (const f of z.flowers) {
                if (f.g <= 0) continue;
                const grow = clamp(f.g / .65, 0, 1), bloom = clamp((f.g - .55) / .45, 0, 1);
                const x0 = f.x * W, top = H - f.hgt * (1 - Math.pow(1 - grow, 3));
                const sway = Math.sin(t * 1.4 + f.sway) * 4 * grow;
                ctx.strokeStyle = '#7bd88f'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(x0, H); ctx.quadraticCurveTo(x0 - 6, (H + top) / 2, x0 + sway, top); ctx.stroke();
                if (grow > .5) {
                    ctx.fillStyle = '#7bd88f';
                    ctx.beginPath(); ctx.ellipse(x0 - 2, H - f.hgt * .35, 6 * grow, 2.6 * grow, -.6, 0, Math.PI * 2); ctx.fill();
                }
                if (bloom > 0) {
                    const pr = 5.5 * bloom;
                    ctx.fillStyle = f.color;
                    for (let k = 0; k < 5; k++) {
                        const a = k / 5 * Math.PI * 2 + t * .3;
                        ctx.beginPath(); ctx.arc(x0 + sway + Math.cos(a) * pr, top + Math.sin(a) * pr, pr * .75, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.fillStyle = '#ffe14d';
                    ctx.beginPath(); ctx.arc(x0 + sway, top, pr * .55, 0, Math.PI * 2); ctx.fill();
                }
            }
        },
    };

    // =========================================================
    // 2. DAS MIXTAPE
    // =========================================================

    const TRACKS = [
        { id: 'hero', side: 'A', title: 'Intro' },
        { id: 'kapitel-1', side: 'A', title: 'Am Anfang war Pink' },
        { id: 'quiz', side: 'A', title: 'Kurze Frage' },
        { id: 'kapitel-2', side: 'B', title: 'Der Wandel' },
        { id: 'kapitel-3', side: 'B', title: 'Die Jahresuhr' },
        { id: 'kapitel-4', side: 'B', title: 'Die Gesichter' },
        { id: 'kapitel-5', side: 'B', title: 'Die Streams' },
        { id: 'kapitel-6', side: 'B', title: 'Fazit' },
        { id: 'app', side: 'Bonus', title: 'Dein Jahr', anchor: 'kapitel-7' },
    ];

    const CASSETTE = `
    <svg viewBox="0 0 160 100" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="156" height="96" rx="9" class="c-body"/>
        <circle cx="10" cy="10" r="2" class="c-screw"/><circle cx="150" cy="10" r="2" class="c-screw"/>
        <circle cx="10" cy="90" r="2" class="c-screw"/><circle cx="150" cy="90" r="2" class="c-screw"/>
        <rect x="13" y="8" width="134" height="52" rx="5" class="c-label"/>
        <text x="19" y="24" class="c-side">A</text>
        <text x="36" y="19" class="c-title">PINK GEGEN NEON</text>
        <path d="M36 23 H140" class="c-rule"/>
        <rect x="38" y="29" width="84" height="26" rx="13" class="c-window"/>
        <circle cx="59" cy="42" r="10" class="c-tape c-tape-l"/>
        <circle cx="101" cy="42" r="10" class="c-tape c-tape-r"/>
        <g class="c-reel c-reel-l"><circle cx="59" cy="42" r="5.5"/><path d="M59 36.5V39M59 45v2.5M53.5 42H56M62 42h2.5"/></g>
        <g class="c-reel c-reel-r"><circle cx="101" cy="42" r="5.5"/><path d="M101 36.5V39M101 45v2.5M95.5 42H98M104 42h2.5"/></g>
        <path d="M42 98 L50 76 H110 L118 98" class="c-foot"/>
        <circle cx="62" cy="88" r="3" class="c-hole"/><circle cx="98" cy="88" r="3" class="c-hole"/>
    </svg>`;

    const tape = {
        el: null, tracks: [], idx: -1, side: 'A', visited: new Set(), angle: 0, vel: 0, lastY: window.scrollY,
        liner: '', flashTimer: 0, notesFound: 0, notesTotal: 0, hidden: null, hint: null,
        collapsed: store.get('mixtape-min') === '1',

        mount() {
            const el = document.createElement('aside');
            el.className = 'mixtape';
            el.id = 'mixtape';
            el.dataset.side = 'A';
            el.setAttribute('aria-label', 'Mixtape: Wegweiser durch die Geschichte');
            el.innerHTML = `
                <div class="mt-list" id="mt-list" hidden>
                    <p class="mt-list-head">Trackliste</p>
                    <ol id="mt-tracks"></ol>
                </div>
                <div class="mt-player">
                    <button type="button" class="mt-cassette" id="mt-cassette" aria-expanded="false" aria-controls="mt-list" aria-label="Trackliste öffnen">
                        ${CASSETTE}<span class="mt-notes" id="mt-notes" hidden></span>
                    </button>
                    <div class="mt-info">
                        <p class="mt-meta"><span id="mt-state" class="mt-state" aria-hidden="true">❚❚</span> <span id="mt-num">Track 00</span> · <span id="mt-side">Seite A</span></p>
                        <p class="mt-title" id="mt-title">Kassette wird eingelegt …</p>
                        <p class="mt-liner" id="mt-liner"></p>
                        <div class="mt-controls">
                            <button type="button" id="mt-prev" aria-label="Vorheriges Kapitel">⏮</button>
                            <button type="button" id="mt-next" aria-label="Nächstes Kapitel">⏭</button>
                            <button type="button" id="mt-hint" class="mt-hint" hidden></button>
                        </div>
                    </div>
                    <button type="button" class="mt-min" id="mt-min" aria-pressed="false">–</button>
                </div>
                <p class="sr-only" id="mt-live" aria-live="polite"></p>`;
            document.body.appendChild(el);
            this.el = el;

            this.q('mt-cassette').addEventListener('click', () => this.toggleList());
            this.q('mt-prev').addEventListener('click', () => this.go(this.idx - 1));
            this.q('mt-next').addEventListener('click', () => this.go(this.idx + 1));
            this.q('mt-hint').addEventListener('click', () => this.spotlight());
            this.q('mt-min').addEventListener('click', () => this.setCollapsed(!this.collapsed));
            document.addEventListener('keydown', e => { if (e.key === 'Escape') this.toggleList(false); });
            document.addEventListener('pointerdown', e => { if (!el.contains(e.target)) this.toggleList(false); });
            this.setCollapsed(this.collapsed);
            requestAnimationFrame(() => el.classList.add('in'));
        },

        q(id) { return this.el.querySelector('#' + id); },

        setCollapsed(v) {
            this.collapsed = v;
            this.el.classList.toggle('collapsed', v);
            const b = this.q('mt-min');
            b.textContent = v ? '+' : '–';
            b.setAttribute('aria-label', v ? 'Mixtape-Infos einblenden' : 'Mixtape-Infos ausblenden');
            b.setAttribute('aria-pressed', v);
            store.set('mixtape-min', v ? '1' : '0');
        },

        ready() {
            this.tracks = TRACKS.filter(t => document.getElementById(t.id));
            this.update(true);
        },

        renderList() {
            const groups = [['A', 'Seite A · Pink'], ['B', 'Seite B · Neon'], ['Bonus', 'Bonus']];
            let n = 0;
            this.q('mt-tracks').innerHTML = groups.map(([side, name]) => {
                const items = this.tracks.map((t, i) => ({ t, i })).filter(x => x.t.side === side);
                if (!items.length) return '';
                return `<li class="mt-group">${name}</li>` + items.map(({ t, i }) => `
                    <li><button type="button" data-i="${i}" class="${i === this.idx ? 'now' : ''}${this.visited.has(i) ? ' done' : ''}"${i === this.idx ? ' aria-current="true"' : ''}>
                        <span class="mt-n">${String(++n).padStart(2, '0')}</span><span class="mt-t">${t.title}</span>
                        <span class="mt-tick" aria-hidden="true">${i === this.idx ? '▶' : this.visited.has(i) ? '✓' : ''}</span></button></li>`).join('');
            }).join('') + (this.hidden ? `<li class="mt-group">Hidden Track</li>
                <li><button type="button" data-hidden="1" class="hidden-track"><span class="mt-n">★</span><span class="mt-t">Alle Noten gefunden</span></button></li>` : '');
            this.q('mt-tracks').querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => { this.toggleList(false); this.go(+b.dataset.i); }));
            this.q('mt-tracks').querySelector('[data-hidden]')?.addEventListener('click', () => { this.toggleList(false); this.flash(this.hidden, 12000); });
        },

        toggleList(force) {
            const list = this.q('mt-list');
            const open = force ?? list.hidden;
            if (open === !list.hidden) return;
            list.hidden = !open;
            this.q('mt-cassette').setAttribute('aria-expanded', open);
            this.q('mt-cassette').setAttribute('aria-label', open ? 'Trackliste schliessen' : 'Trackliste öffnen');
            if (open) { this.renderList(); list.querySelector('button.now, button')?.focus({ preventScroll: true }); }
        },

        go(i) {
            const t = this.tracks[clamp(i, 0, this.tracks.length - 1)];
            if (!t) return;
            document.getElementById(t.anchor || t.id).scrollIntoView({ behavior: motionOK ? 'smooth' : 'auto', block: 'start' });
        },

        // aktuelles Kapitel = Abschnitt, der die Bildschirmmitte erreicht hat
        current() {
            const mid = window.innerHeight / 2;
            for (let i = this.tracks.length - 1; i >= 0; i--) {
                const el = document.getElementById(this.tracks[i].id);
                if (!el.hidden && el.getBoundingClientRect().top <= mid) return i;
            }
            return 0;
        },

        // Seite B beginnt in der Mitte des Farbwischers
        sideNow(i) {
            const wipe = document.getElementById('wipe');
            const vh = window.innerHeight;
            if (wipe) {
                const r = wipe.getBoundingClientRect();
                if (r.top < vh / 2 && r.bottom > vh / 2) return -r.top > (r.height - vh) / 2 ? 'B' : 'A';
                if (r.bottom <= vh / 2) return 'B';
                return 'A';
            }
            return this.tracks[i]?.side === 'A' ? 'A' : 'B';
        },

        update(force = false) {
            if (!this.tracks.length) return;
            const i = this.current();
            const side = this.sideNow(i);
            if (side !== this.side) this.flip(side);
            if (i !== this.idx || force) {
                this.idx = i;
                this.visited.add(i);
                const t = this.tracks[i];
                this.q('mt-num').textContent = `Track ${String(i + 1).padStart(2, '0')}/${String(this.tracks.length).padStart(2, '0')}`;
                const title = this.q('mt-title');
                title.textContent = t.title;
                if (motionOK) { title.classList.remove('swap'); void title.offsetWidth; title.classList.add('swap'); }
                this.q('mt-prev').disabled = i === 0;
                this.q('mt-next').disabled = i === this.tracks.length - 1;
                this.q('mt-live').textContent = `Track ${i + 1}: ${t.title}`;
                this.setHint(HINTS[t.id]);
                if (!this.q('mt-list').hidden) this.renderList();
                onTrack(t.id);
            }
            this.setLiner(linerFor(this.tracks[i].id));
            // Bandstand: links wird weniger, rechts mehr
            const max = html.scrollHeight - window.innerHeight;
            const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
            this.el.querySelector('.c-tape-l').setAttribute('r', (6.5 + 5.5 * Math.sqrt(1 - p)).toFixed(2));
            this.el.querySelector('.c-tape-r').setAttribute('r', (6.5 + 5.5 * Math.sqrt(p)).toFixed(2));
        },

        flip(side) {
            this.side = side;
            const apply = () => {
                this.el.dataset.side = side;
                this.el.querySelector('.c-side').textContent = side;
                this.q('mt-side').textContent = `Seite ${side}`;
            };
            if (!motionOK) { apply(); return; }
            const c = this.q('mt-cassette');
            c.classList.remove('flipping'); void c.offsetWidth; c.classList.add('flipping');
            setTimeout(apply, 260);
            if (F) this.flash(side === 'B' ? 'Kassette umgedreht – <b>Seite B</b> läuft.' : 'Zurückgespult auf Seite A.', 2600);
        },

        setLiner(text) {
            if (this.flashTimer || text === this.liner) return;
            this.liner = text;
            this.q('mt-liner').innerHTML = text;
        },

        // kurze Reaktion, danach wieder die Liner Notes
        flash(text, ms = 4200) {
            clearTimeout(this.flashTimer);
            const el = this.q('mt-liner');
            el.innerHTML = text;
            el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
            this.q('mt-live').textContent = el.textContent;
            this.flashTimer = setTimeout(() => {
                this.flashTimer = 0;
                el.classList.remove('flash');
                this.liner = '';
                this.update();
            }, ms);
        },

        setHint(h) {
            const b = this.q('mt-hint');
            this.hint = h && document.querySelector(h.target) ? h : null;
            b.hidden = !this.hint;
            if (!this.hint) return;
            b.innerHTML = `<span aria-hidden="true">✦</span> ${h.text}`;
            b.setAttribute('aria-label', `Tipp: ${h.text} – springt zum Element`);
            if (motionOK) { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); }
        },

        spotlight() {
            if (!this.hint) return;
            const h = this.hint;
            const el = document.querySelector(h.target);
            el.scrollIntoView({ behavior: motionOK ? 'smooth' : 'auto', block: 'center' });
            el.classList.remove('spotlight'); void el.offsetWidth; el.classList.add('spotlight');
            setTimeout(() => el.classList.remove('spotlight'), 2600);
            if (h.pulse) setTimeout(h.pulse, motionOK ? 700 : 0);
            const focusable = el.matches('button, input, a, [tabindex]') ? el : el.querySelector('button, input, a, [tabindex="0"]');
            focusable?.focus({ preventScroll: true });
        },

        // Spulen drehen sich nur beim Scrollen
        frame(dt) {
            const y = window.scrollY, dy = y - this.lastY;
            this.lastY = y;
            this.vel += ((dt > 0 ? dy / dt : 0) - this.vel) * .15;
            this.angle = (this.angle + clamp(this.vel * .9, -900, 900) * dt) % 360;
            const playing = Math.abs(this.vel) > 8;
            if (playing !== this.playing) {
                this.playing = playing;
                this.el.classList.toggle('playing', playing);
            }
            this.q('mt-state').textContent = playing ? (this.vel > 0 ? '▶' : '◀◀') : '❚❚';
            this.el.querySelector('.c-reel-l').setAttribute('transform', `rotate(${this.angle.toFixed(1)} 59 42)`);
            this.el.querySelector('.c-reel-r').setAttribute('transform', `rotate(${this.angle.toFixed(1)} 101 42)`);
        },
    };

    // ---------- Inhalte des Begleiters ----------

    let HINTS = {};
    function buildHints() {
        HINTS = {
            'hero': { text: 'Fahr über die Skyline', target: '#hero-skyline' },
            'kapitel-1': { text: 'Der Machtmoment', target: '#kapitel-1 .power' },
            'quiz': { text: 'Gib deinen Tipp ab', target: '#quiz .quiz-options' },
            'kapitel-2': { text: 'Fahr über die Felder', target: '#story-heatmap' },
            'kapitel-3': document.querySelector('#kapitel-3 .season-stats')
                ? { text: 'Jahreszeiten zum Anfassen', target: '#kapitel-3 .season-stats', pulse: () => previewSeasons(true) }
                : { text: 'Filtere die Uhr', target: '#kapitel-3 .clock-filter' },
            'kapitel-4': { text: 'Zwei Ären im Vergleich', target: '#kapitel-4 .versus' },
            'kapitel-5': { text: 'Fahr über die Kurve', target: '#story-line' },
            'kapitel-6': { text: 'Was die Daten nicht sagen', target: '#kapitel-6 .limits' },
            'app': { text: 'Zieh die Zeitmaschine', target: '#scrubber' },
        };
    }

    function linerFor(id) {
        if (!F) return '';
        const C = F.challenger;
        switch (id) {
            case 'hero': return `${F.n} Monate, zwei Farben, eine Frage. Scrollen = Play.`;
            case 'kapitel-1': return `${F.streaks[0].len} Monate ${esc(F.main)} am Stück. Die Repeat-Taste klemmt.`;
            case 'quiz': return typeof quiz !== 'undefined' && quiz.guess ? `Dein Tipp: ${quiz.guess}. Auflösung auf Seite B.` : 'Erst tippen, dann umdrehen.';
            case 'kapitel-2': {
                const r = F.rows[clamp((scrolly.revealed || 1) - 1, 0, F.n - 1)];
                return `<span class="mt-dot" style="--c:${genreColor(r.genre)}"></span>${lbl(r)} · ${esc(r.genre)}`;
            }
            case 'kapitel-3': {
                const S = F.season;
                return C && S.summer.total
                    ? `Jun–Nov: ${S.summer.wins}/${S.summer.total} ${esc(C)}. Dezember: ${S.december.total - S.december.wins}/${S.december.total} ${esc(F.main)}.`
                    : 'Hat Musik Jahreszeiten?';
            }
            case 'kapitel-4': return `${esc(F.artists[0].artist)}: ${F.artists[0].months}× Top Artist des Monats.`;
            case 'kapitel-5': return `Rekord: ${lbl(F.peak)}, ${fmtText(F.peak.streams)} Streams.`;
            case 'kapitel-6': return 'Drei Erkenntnisse – und ihre Grenzen.';
            case 'app': {
                const s = document.getElementById('scrubber');
                const r = s && F.rows[+s.value];
                return r ? `<span class="mt-dot" style="--c:${genreColor(r.genre)}"></span>${lbl(r)} · ${esc(r.genre)} · ★ ${esc(r.artist)}` : 'Jetzt bist du dran.';
            }
        }
        return '';
    }

    // einmalige Reaktionen beim Erreichen eines Kapitels
    const reacted = new Set();
    function onTrack(id) {
        if (!F || reacted.has(id)) return;
        reacted.add(id);
        if (id === 'kapitel-3') setTimeout(() => previewSeasons(false), 1200);
    }

    // Jahreszeiten-Karten spielen ihren Effekt einmal kurz an (zeigt: hier passiert etwas)
    function previewSeasons(again) {
        const cards = [...document.querySelectorAll('#kapitel-3 .season[data-season-fx]')];
        cards.forEach((c, i) => setTimeout(() => fx.pulse(c, null, 1500), (again ? 0 : 300) + i * 900));
    }

    // Wendepunkt: Reaktion auf den Quiz-Tipp
    function watchTurn() {
        const step = document.querySelector('[data-quiz-echo]')?.closest('.step');
        if (!step || !('IntersectionObserver' in window)) return;
        const io = new IntersectionObserver(es => es.forEach(e => {
            if (!e.isIntersecting) return;
            const t = F.rows[F.turnIdx];
            const guess = typeof quiz !== 'undefined' ? quiz.guess : null;
            tape.flash(guess == null ? `Da! Der erste neongrüne Monat: ${lbl(t)}.`
                : guess === t.year ? `Volltreffer! ${t.year} – du hast ein Ohr für Charts.`
                : Math.abs(guess - t.year) === 1 ? `Dein Tipp ${guess}: knapp daneben! Es war ${t.year}.`
                : `Dein Tipp ${guess}: ${Math.abs(guess - t.year)} Jahre zu ${guess < t.year ? 'früh' : 'spät'}. ${t.year} hat viele überrascht.`, 5500);
            io.disconnect();
        }), { rootMargin: '-35% 0px -50% 0px' });
        io.observe(step);
    }

    // =========================================================
    // 3. JAHRESZEITEN AN INHALTE KNÜPFEN
    // =========================================================

    function tagSeasons() {
        // Kapitel 3: Karten Juni–November, Januar–April, Dezember
        const kinds = ['sun leaves', 'snow bloom', 'snow'];
        document.querySelectorAll('#kapitel-3 .season').forEach((c, i) => {
            c.dataset.seasonFx = kinds[i] || 'snow';
            c.tabIndex = 0;
        });
        const clock = document.querySelector('#kapitel-3 .clock');
        // «Nur Dezember» lässt es über der Uhr schneien
        document.querySelector('#kapitel-3 [data-clock="dec"]')?.addEventListener('click', () => fx.pulse(clock, 'snow', 4000));
        // Uhr: Hover über einem Monat -> Effekt seiner Jahreszeit über der Uhr
        let last = null;
        clock?.addEventListener('pointerover', e => {
            const seg = e.target.closest('.clock-seg');
            if (!seg) return;
            const kind = fxOfMonth(F.rows[+seg.dataset.i].month);
            if (kind !== last) { last = kind; fx.pulse(clock, kind, 1400); }
        });
        clock?.addEventListener('pointerleave', () => (last = null));

        // Fazit: Erkenntnis über Sommer/Herbst und Dezember
        document.querySelectorAll('#kapitel-6 .takeaways li').forEach(li => {
            if (/Sommer|Herbst/.test(li.textContent)) { li.dataset.seasonFx = 'sun leaves'; li.tabIndex = 0; }
        });
        // Kapitel 2: Textschritt, in dem der Dezember vorkommt
        document.querySelectorAll('#steps .step-card').forEach(c => {
            const text = c.textContent.replace(/Schraffiert.*$/s, '');
            if (/Dezember/.test(text)) c.dataset.seasonFx = 'snow';
        });
        // Explorer: Jahreszeiten-Ansicht
        tagChart();
        new MutationObserver(tagChart).observe(document.getElementById('chart'), { childList: true });

        // Zeitmaschine: kurzer Gruss der Jahreszeit des gewählten Monats
        const s = document.getElementById('scrubber');
        let tmr = 0;
        s?.addEventListener('input', () => {
            tape.setLiner(linerFor('app'));
            clearTimeout(tmr);
            tmr = setTimeout(() => {
                const i = +s.value, r = F.rows[i];
                if (!r) return;
                fx.pulse(document.getElementById('machine-card'), fxOfMonth(r.month), 1700);
                if (F.rows.indexOf(F.peak) === i) tape.flash(`${lbl(r)}: der Rekordmonat!`, 3500);
                else if (r.incomplete) tape.flash(`⚠ ${lbl(r)} ist vermutlich unvollständig erfasst.`, 4000);
                else if (i === F.turnIdx) tape.flash(`${lbl(r)}: Hier wurde die Kassette umgedreht.`, 3500);
            }, 260);
        });
    }

    function tagChart() {
        const chart = document.getElementById('chart');
        const map = { Winter: 'snow', 'Frühling': 'bloom', Sommer: 'sun', Herbst: 'leaves' };
        chart.querySelectorAll('.col').forEach(col => {
            const wrap = col.querySelector('.bar-wrap');
            const kind = chart.classList.contains('seasons') ? map[col.querySelector('.col-label')?.textContent] : null;
            if (kind) wrap.dataset.seasonFx = kind; else delete wrap.dataset.seasonFx;
        });
    }

    // =========================================================
    // 4. VERSTECKTE NOTEN -> Hidden Track
    // =========================================================

    const NOTES = [
        { host: 'kapitel-1', style: 'top:22%;left:4%' },
        { host: 'quiz', style: 'bottom:14%;right:6%' },
        { host: 'kapitel-3', style: 'top:10%;left:48%' },
        { host: 'kapitel-4', style: 'bottom:8%;right:4%' },
        { host: 'kapitel-5', style: 'top:30%;right:3%' },
    ];

    function placeNotes() {
        const hosts = NOTES.filter(n => document.getElementById(n.host));
        tape.notesTotal = hosts.length;
        hosts.forEach((n, i) => {
            const host = document.getElementById(n.host);
            host.classList.add('note-host');
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'hidden-note';
            b.style.cssText = `${n.style};--tilt:${(i % 2 ? 1 : -1) * (8 + i * 3)}deg`;
            b.setAttribute('aria-label', 'Versteckte Note einsammeln');
            b.innerHTML = '<span aria-hidden="true">♪</span>';
            b.addEventListener('click', () => {
                tape.notesFound++;
                b.classList.add('caught');
                b.disabled = true;
                setTimeout(() => b.remove(), 600);
                const badge = tape.q('mt-notes');
                badge.hidden = false;
                badge.textContent = `♪ ${tape.notesFound}/${tape.notesTotal}`;
                if (tape.notesFound < tape.notesTotal) {
                    tape.flash(`Note ${tape.notesFound} von ${tape.notesTotal}. Noch ${tape.notesTotal - tape.notesFound} bis zum Hidden Track.`, 3500);
                } else {
                    tape.hidden = F.peak.genre === F.main
                        ? `★ Hidden Track: Der Rekordmonat aller Zeiten ist ${lbl(F.peak)} – und er gehört ${esc(F.main)}.`
                        : `★ Hidden Track: Der stärkste ${esc(F.main)}-Monat war ${lbl(F.peakMain)} (${fmtText(F.peakMain.streams)}). Den Rekord hält ${esc(F.peak.genre)}: ${lbl(F.peak)} mit ${fmtText(F.peak.streams)}.`;
                    tape.el.classList.add('unlocked');
                    tape.flash('Alle Noten gefunden! Der <b>Hidden Track</b> ist freigeschaltet – klick auf die Kassette.', 6000);
                }
            });
            host.appendChild(b);
        });
    }

    // =========================================================
    // START
    // =========================================================

    function onReady(facts) {
        if (F) return;
        F = facts;
        buildHints();
        tagSeasons();
        placeNotes();
        tape.ready();
        watchTurn();
        document.addEventListener('click', e => {
            const b = e.target.closest('.quiz-btn');
            if (b) tape.flash(`Tipp ${b.dataset.year} notiert. Die Auflösung kommt auf Seite B.`, 3500);
        });
    }

    function start() {
        tape.mount();
        fx.mount();
        const checkState = () => {
            if (html.dataset.state === 'error' || html.dataset.state === 'empty') {
                tape.q('mt-title').textContent = 'Bandsalat';
                tape.q('mt-liner').textContent = 'Die Chartdaten kommen gerade nicht an.';
            }
        };
        new MutationObserver(checkState).observe(html, { attributes: true, attributeFilter: ['data-state'] });
        checkState();
        if (window.storyReady) onReady(window.storyReady);

        let tick = false;
        const onScroll = () => {
            if (tick) return;
            tick = true;
            requestAnimationFrame(() => { tick = false; tape.update(); });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);

        if (motionOK) {
            let last = performance.now();
            const loop = now => {
                const dt = Math.min(.05, (now - last) / 1000);
                last = now;
                if (!document.hidden) tape.frame(dt);
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }
    }

    document.addEventListener('story:ready', e => onReady(e.detail));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
