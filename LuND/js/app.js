/* LuND — London Urban Noise Distribution
   1. Intro: scene videos + animated data scenes, fades to white between each.
   2. Map: OpenStreetMap streets (city-roads style). The listener follows the cursor; local noise
      is modelled from nearby road classes, rail, airports and green cover, then drives the sound
      mix, the AREA / HEALTH panels and the sound-wave rings around the cursor. */
(function () {
  'use strict';

  const D = window.LUND_DATA;
  const A = window.LAudio;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = n => Math.round(n).toLocaleString('en-GB');
  const root = document.documentElement;
  const isNarrow = () => innerWidth <= 860;

  /* ================================================================
     HEALTH + COMPARISON MODEL (WHO Environmental Noise Guidelines 2018)
     ================================================================ */
  const zoneOf = db => db < 50 ? 1 : db < 55 ? 2 : db < 65 ? 3 : db < 75 ? 4 : 5;
  const bpmOf = db => Math.round(66 + 0.32 * Math.max(0, db - 45));
  const ihdRisk = db => db <= 53 ? 0 : Math.round((Math.pow(1.08, (db - 53) / 10) - 1) * 100);
  function risksOf(db) {
    const z = zoneOf(db), r = ihdRisk(db);
    return [
      null,
      ['NONE', 'NONE', 'BASELINE RISK'],
      ['MILD ANNOYANCE', 'LIGHT SLEEP LOSS', 'BASELINE RISK'],
      ['SLEEP DISRUPTION', 'RAISED BLOOD PRESSURE', `+${r}% HEART DISEASE`],
      ['CHRONIC FATIGUE', 'HYPERTENSION', `+${r}% HEART DISEASE`],
      db >= 82 ? ['CHRONIC FATIGUE', '20% HEARING LOSS', '80% HEARING LOSS'] : ['CHRONIC FATIGUE', 'HYPERTENSION', `+${r}% HEART DISEASE`],
    ][z];
  }

  const ICONS = {
    bird: '<svg viewBox="0 0 30 20"><path d="M3 11c3-1 5-3 7-6 1 3 3 5 6 5l5-3c1-1 3-1 4 0l3 1-3 1c-1 3-3 6-7 7-4 1-8 0-11-2l3-1c-3 0-5-1-7-2z"/></svg>',
    rain: '<svg viewBox="0 0 30 20"><path d="M8 11a5 5 0 0 1 1-10 7 7 0 0 1 12 1 4.5 4.5 0 0 1 1 9z"/><path d="M9 13l-2 5M15 13l-2 5M21 13l-2 5" stroke="#000" stroke-width="1.6"/></svg>',
    music: '<svg viewBox="0 0 30 20"><path d="M12 2l11-2v13.5a3 3 0 1 1-2-2.8V4.2l-7 1.3v10a3 3 0 1 1-2-2.8z"/></svg>',
    talk: '<svg viewBox="0 0 30 20"><path d="M2 2h14v9H8l-4 3v-3H2zM18 6h10v9h-2v3l-4-3h-4V13h-2V6z"/></svg>',
    office: '<svg viewBox="0 0 30 20"><path d="M5 1h20v13H5zM7 3v9h16V3zM13 15h4l1 3h3v1H9v-1h3z"/></svg>',
    traffic: '<svg viewBox="0 0 30 20"><path d="M3 10l3-6h15l4 6h2v6h-3a3 3 0 0 1-6 0h-6a3 3 0 0 1-6 0H3zm5-4l-2 4h6V6zm6 0v4h8l-3-4z"/><circle cx="9" cy="16" r="2"/><circle cx="21" cy="16" r="2"/></svg>',
    bus: '<svg viewBox="0 0 30 20"><path d="M2 2h24c1 0 2 1 2 2v11h-3a3 3 0 0 1-6 0h-8a3 3 0 0 1-6 0H2zm2 2v4h5V4zm7 0v4h5V4zm7 0v4h5V4z"/><circle cx="8" cy="16" r="2"/><circle cx="22" cy="16" r="2"/></svg>',
    mower: '<svg viewBox="0 0 30 20"><path d="M2 1l2-1 7 9h11l5 4v3h-2a3 3 0 0 0-6 0h-7a3 3 0 0 0-6 0H4v-4h4z"/><circle cx="9" cy="16.5" r="2.5"/><circle cx="23" cy="16.5" r="2.5"/></svg>',
  };
  function comparisonOf(db) {
    if (db < 45) return ['bird', 'BIRDSONG IN A PARK'];
    if (db < 55) return ['rain', 'LIGHT RAIN · QUIET STREET'];
    if (db < 60.5) return ['music', 'BACKGROUND MUSIC'];
    if (db < 63.4) return ['talk', 'NORMAL CONVERSATION'];
    if (db < 64) return ['talk', 'CONVERSATION AT 3FT'];
    if (db < 68) return ['office', 'LOUD OFFICE / BACKGROUND TV'];
    if (db < 75) return ['traffic', 'BUSY TRAFFIC'];
    if (db < 82) return ['bus', 'PASSING LONDON BUS'];
    return ['mower', 'LAWNMOWER'];
  }

  /* ================================================================
     LAYOUT
     ================================================================ */
  function fit() {
    const w = innerWidth, h = innerHeight;
    root.style.setProperty('--fit', Math.min(w / 1440, h / 900));
    root.style.setProperty('--lfit', clamp(w / 1440, 0.62, 1.2));
    const nat = $('#panels').scrollHeight + 30;
    const pf = isNarrow() ? Math.min(1, (w - 24) / 330) : Math.min(1, (h - 34 - 40) / nat);
    root.style.setProperty('--pfit', pf.toFixed(3));
    if (map) {
      map.resize();
      map.setPadding(isNarrow() ? { top: 0, right: 0, bottom: h * 0.4, left: 0 } : { top: 0, right: 330 * pf + 40, bottom: 0, left: 0 });
    }
    sizeCanvas();
    layoutLoud();
  }

  // speaker dot grids (from icons_states_audio_on-22.svg)
  const DOT_X = [30.1, 35.47, 40.84, 46.33], DOT_Y = [6.55, 12.38, 18.22, 23.57];
  $$('.spk-dots').forEach(g => {
    g.innerHTML = DOT_X.map((x, ci) => DOT_Y.map(y => `<circle data-c="${ci}" cx="${x}" cy="${y}" r="1.67"/>`).join('')).join('');
  });

  /* ================================================================
     INTRO
     ================================================================ */
  const scenes = $$('#intro .scene');
  const fader = $('#fader');
  const logoVid = $('#logoVid');
  let cur = -1, sceneStart = 0, sceneDur = 0, sceneTimer = 0, inApp = false, audioPref = null, busy = false;

  scenes.forEach((s, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Scene ' + (i + 1));
    b.innerHTML = '<i></i>';
    b.addEventListener('click', () => go(i));
    $('#ticks').appendChild(b);
  });

  function fade(mid) {
    if (busy) return;
    busy = true;
    fader.classList.add('on');
    setTimeout(() => {
      mid();
      setTimeout(() => { fader.classList.remove('on'); busy = false; }, 60);
    }, 720);
  }

  function go(i) {
    if (i === cur || busy) return;
    if (i >= scenes.length) return enterApp();
    fade(() => {
      if (cur >= 0) leave(scenes[cur]);
      cur = i;
      scenes.forEach((s, k) => s.classList.toggle('active', k === i));
      enter(scenes[i]);
    });
  }

  function playLogo() {
    try { logoVid.currentTime = 0; logoVid.play().catch(() => {}); } catch (e) { /* ignore */ }
  }

  function enter(s) {
    clearTimeout(sceneTimer);
    sceneStart = performance.now();
    const story = s.classList.contains('story');
    const wasShown = document.body.classList.contains('show-logo');
    document.body.classList.toggle('show-logo', story);
    if (story && !wasShown) playLogo();
    const at = $('#audioTest', s);
    if (at && at.getAttribute('aria-pressed') === 'true') A.test(true);
    const v = $('video', s);
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
      sceneDur = 1;
      v.onended = () => { if (scenes[cur] === s) go(cur + 1); };
      v.onerror = () => { if (scenes[cur] === s) sceneTimer = setTimeout(() => go(cur + 1), 1500); };
    } else {
      const d = s.dataset.dur;
      sceneDur = d === 'hold' ? 0 : (+d) * 1000;
      if (sceneDur) sceneTimer = setTimeout(() => go(cur + 1), sceneDur);
      const fn = STORY[s.id];
      if (fn) fn.play();
    }
  }

  function leave(s) {
    clearTimeout(sceneTimer);
    if ($('#audioTest', s)) A.test(false); // the audio test stops when you move on
    const v = $('video', s);
    if (v) v.pause();
    const fn = STORY[s.id];
    if (fn && fn.reset) fn.reset();
  }

  function tickProgress() {
    const v = cur >= 0 && $('video', scenes[cur]);
    $$('#ticks button').forEach((b, k) => {
      b.classList.toggle('done', k < cur);
      let f = 0;
      if (k === cur) f = v ? (v.duration ? v.currentTime / v.duration : 0) : sceneDur ? clamp((performance.now() - sceneStart) / sceneDur) : 1;
      b.firstChild.style.width = f * 100 + '%';
    });
  }

  // resume the current scene video if the tab was hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || inApp || cur < 0) return;
    const v = $('video', scenes[cur]);
    if (v && v.paused && !v.ended) v.play().catch(() => {});
  });

  $('#nextBtn').addEventListener('click', () => { A.unlock(); go(cur + 1); });
  $('#skipBtn').addEventListener('click', () => { A.unlock(); enterApp(); });
  $('#enterBtn').addEventListener('click', () => { A.unlock(); enterApp(); });

  // click anywhere on the intro to move on (buttons keep their own behaviour; the last click enters the map)
  $('#intro').addEventListener('click', e => {
    if (e.target.closest('button, a, #introNav')) return;
    A.unlock();
    go(cur + 1);
  });

  // Scene 2 audio test — toggles the on/off icon state and plays the test sound
  $('#audioTest').addEventListener('click', e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', on);
    audioPref = on;
    A.test(on);
  });

  function enterApp() {
    if (inApp) return;
    A.test(false);
    fade(() => {
      if (cur >= 0) leave(scenes[cur]);
      inApp = true;
      document.body.classList.remove('mode-intro');
      document.body.classList.add('mode-app', 'show-logo');
      playLogo();
      setAudio(audioPref !== false);
      fit();
      flyIn();
    });
  }

  function replayIntro() {
    inApp = false;
    A.setEnabled(false);
    $('#spkBtn').setAttribute('aria-pressed', 'false');
    fade(() => {
      document.body.classList.remove('mode-app', 'show-logo');
      document.body.classList.add('mode-intro');
      cur = -1;
      scenes.forEach(s => s.classList.remove('active'));
      busy = false;
      setTimeout(() => go(0), 30);
    });
  }
  $('#replayBtn').addEventListener('click', replayIntro);

  addEventListener('keydown', e => {
    if (!inApp) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); A.unlock(); go(cur + 1); }
      if (e.key === 'ArrowLeft' && cur > 0) go(cur - 1);
      if (e.key === 'Escape') { A.unlock(); enterApp(); }
      return;
    }
    walk(e);
  });

  /* ---------- story scene 1: road noise by borough ---------- */
  const loudSorted = D.list.slice().sort((a, b) => b.road - a.road);
  const shortName = n => n.replace('upon Thames', 'u. Thames').replace('Hammersmith & Fulham', 'Hammersmith & F.').replace('Kensington & Chelsea', 'Kensington & C.').replace('Barking & Dagenham', 'Barking & D.').toUpperCase();
  (function buildLoud() {
    const wrap = $('#loudCols');
    wrap.innerHTML = loudSorted.map(b => {
      const n = Math.round(b.road);
      let dots = '';
      for (let k = 0; k < n; k++) dots += `<i style="transition-delay:${k * 11}ms"></i>`;
      return `<div class="col"><span class="val">${n}</span>${dots}<span class="lab">${shortName(b.name)}</span></div>`;
    }).join('');
    $('#loudTopN').textContent = Math.round(loudSorted[0].road) + '%';
    $('#loudTopL').textContent = loudSorted[0].name.toUpperCase();
    const low = loudSorted[loudSorted.length - 1];
    $('#loudLowN').textContent = Math.round(low.road) + '%';
    $('#loudLowL').textContent = low.name.toUpperCase();
  })();
  function layoutLoud() {
    const c = $('#loudCols');
    if (!c) return;
    const H = c.clientHeight - 92, W = c.clientWidth - 30;
    const max = Math.ceil(loudSorted[0].road);
    const d = clamp(Math.min(H / (max * 1.3), W / (33 * 1.8)), 2.5, 10);
    c.style.setProperty('--d', d.toFixed(2) + 'px');
  }

  /* ---------- story scene 2: green cover vs road noise scatter ---------- */
  (function buildScatter() {
    const svg = $('#scatter');
    const W = 640, H = 400, m = { l: 46, r: 14, t: 12, b: 44 };
    const x = g => m.l + (g / 70) * (W - m.l - m.r);
    const y = r => H - m.b - (r / 50) * (H - m.t - m.b);
    let s = `<line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="#000"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" stroke="#000"/>`;
    for (let g = 0; g <= 70; g += 10) s += `<line x1="${x(g)}" y1="${H - m.b}" x2="${x(g)}" y2="${H - m.b + 5}" stroke="#000"/><text x="${x(g)}" y="${H - m.b + 17}" text-anchor="middle">${g}</text>`;
    for (let r = 0; r <= 50; r += 10) s += `<line x1="${m.l - 5}" y1="${y(r)}" x2="${m.l}" y2="${y(r)}" stroke="#000"/><text x="${m.l - 9}" y="${y(r) + 3}" text-anchor="end">${r}</text>`;
    s += `<text x="${W - m.r}" y="${H - 6}" text-anchor="end">GREEN COVER % →</text>`;
    s += `<text x="${m.l + 6}" y="${m.t + 4}">↑ RESIDENTS ≥ 55 dB ROAD NOISE %</text>`;
    const pts = D.list.slice().sort((a, b) => a.green - b.green);
    pts.forEach((b, i) => {
      s += `<circle class="pt" cx="${x(b.green)}" cy="${y(b.road)}" r="5.5" fill="${b.green > 50 ? '#7fb36f' : '#000'}" stroke="#000" stroke-width="1" style="transition-delay:${i * 40}ms"><title>${b.name}: ${b.green.toFixed(0)}% green, ${b.road}% exposed</title></circle>`;
    });
    const call = [['city of london', 14, -16], ['bromley', -10, -16], ['harrow', 12, -6], ['merton', 12, 14], ['lambeth', 12, -8], ['havering', -8, 20]];
    for (const [k, dx, dy] of call) {
      const b = D.boroughs[k], cx = x(b.green), cy = y(b.road);
      const anchor = dx < 0 ? 'end' : 'start';
      s += `<g class="callout"><line x1="${cx}" y1="${cy}" x2="${cx + dx}" y2="${cy + dy}" stroke="#000" stroke-width=".8"/><text x="${cx + dx + (dx < 0 ? -3 : 3)}" y="${cy + dy + 3}" text-anchor="${anchor}">${b.name.toUpperCase()}</text></g>`;
    }
    s += `<g class="callout" transform="translate(${m.l + 20},${m.t + 34})"><circle r="5.5" fill="#7fb36f" stroke="#000"/><text x="12" y="3">OVER HALF GREEN</text><circle cy="18" r="5.5" fill="#000"/><text x="12" y="21">UNDER HALF GREEN</text></g>`;
    svg.innerHTML = s;
    $('#greenAll').textContent = Math.round(D.londonGreenPct) + '%';
  })();

  /* ---------- story scene 3: the decibel ruler + body ---------- */
  const RULER_MARKS = [
    { db: 40, t: 'WHO NIGHT-TIME LIMIT', pos: 'up' },
    { db: 53, t: 'WHO ROAD-TRAFFIC GUIDELINE', pos: 'down' },
    { db: 55, t: 'EU NOISE-MAPPING THRESHOLD', pos: 'up' },
    { db: 62, t: 'LONDON BOROUGH AVERAGES 60–64 dB', pos: 'down', band: [60, 64.1] },
    { db: 65, t: 'STRESS RESPONSE · CORTISOL ↑', pos: 'up' },
    { db: 85, t: 'HEARING DAMAGE AFTER 8 HOURS', pos: 'up' },
  ];
  const rx = db => ((db - 30) / 60) * 100;
  (function buildRuler() {
    const r = $('#ruler');
    let h = '';
    for (let db = 30; db <= 90; db += 5) h += `<div class="tick" style="left:${rx(db)}%;${db % 10 ? 'height:5px;top:72px' : ''}">${db % 10 ? '' : `<span>${db}</span>`}</div>`;
    for (const m of RULER_MARKS) {
      if (m.band) h += `<div class="band" style="left:${rx(m.band[0])}%;width:${rx(m.band[1]) - rx(m.band[0])}%"></div>`;
      const right = m.db > 78;
      h += `<div class="mark ${m.pos}" data-db="${m.db}" style="${right ? `right:${100 - rx(m.db)}%;border-left:0;border-right:1px solid #000;padding-left:0;padding-right:6px;text-align:right` : `left:${rx(m.db)}%`}">${m.db} dB<br>${m.t}</div>`;
    }
    r.insertAdjacentHTML('beforeend', h);
  })();

  function setGlyphs(el, zone) { $$('i', el).forEach((b, k) => b.classList.toggle('on', k < zone)); }

  const STORY = {
    stLoud: {
      play() { layoutLoud(); $$('#loudCols .col').forEach((c, i) => setTimeout(() => c.classList.add('lit'), 300 + i * 55)); },
      reset() { $$('#loudCols .col').forEach(c => c.classList.remove('lit')); },
    },
    stGreen: {
      play() { setTimeout(() => $('#scatter').classList.add('lit'), 250); },
      reset() { $('#scatter').classList.remove('lit'); },
    },
    stBody: {
      raf: 0,
      play() {
        const t0 = performance.now(), dur = 10500;
        const needle = $('#needle'), lab = $('#needleDb'), marks = $$('#ruler .mark');
        const step = now => {
          const k = clamp((now - t0 - 600) / dur);
          const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          const db = 30 + e * 58;
          needle.style.left = rx(db) + '%';
          lab.textContent = Math.round(db) + ' dB';
          marks.forEach(m => m.classList.toggle('hit', db >= +m.dataset.db));
          const z = zoneOf(db), bpm = bpmOf(db);
          $('#bodyBpm').textContent = bpm;
          setGlyphs($('#bodyAmyg'), z); setGlyphs($('#bodyCort'), z);
          drawECG($('#bodyEcg'), bpm, now / 1000, '#000', 2);
          this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
      },
      reset() { cancelAnimationFrame(this.raf); },
    },
  };

  /* ---------- ECG trace ---------- */
  function ecgShape(ph) {
    const g = (c, w, a) => a * Math.exp(-Math.pow((ph - c) / w, 2));
    return g(.18, .035, .12) - g(.30, .012, .14) + g(.33, .014, 1) - g(.36, .014, .28) + g(.58, .055, .26);
  }
  function drawECG(cv, bpm, t, color, lw) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = color; c.lineWidth = lw || 1.5; c.lineJoin = 'round';
    c.beginPath();
    const beatsVisible = 2.6, pxPerBeat = w / beatsVisible, phase = t * bpm / 60;
    for (let x = 0; x <= w; x += 1) {
      let ph = (phase - (w - x) / pxPerBeat) % 1; if (ph < 0) ph += 1;
      const y = h * 0.72 - ecgShape(ph) * h * 0.62;
      x ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }

  /* ================================================================
     MAP
     ================================================================ */
  const OMT = 'omt';
  const MPX = (m, z) => m / (78271.517 * 0.6225 / Math.pow(2, z)); // metres → px at London's latitude
  // typical London Leq at 10 m from the kerb, by OSM road class
  const ROAD_SRC = { motorway: 78, trunk: 74, primary: 71, secondary: 68, tertiary: 64, minor: 56, service: 50, busway: 62 };
  const RAIL_SRC = { rail: 70, transit: 64 };

  // risk zones: green = quiet refuge → blue = loud (zones 1–5)
  const RISK_COLORS = ['#2f8f4e', '#86c98a', '#c9c4f2', '#7a6dff', '#2a1cd9'];
  const DB_RAMP = ['interpolate', ['linear'], ['get', 'db'], 45, RISK_COLORS[0], 52, RISK_COLORS[1], 60, RISK_COLORS[2], 68, RISK_COLORS[3], 76, RISK_COLORS[4]];
  const BOROUGH_RAMP = ['match', ['get', 'risk'], 1, RISK_COLORS[0], 2, RISK_COLORS[1], 3, RISK_COLORS[2], 4, RISK_COLORS[3], RISK_COLORS[4]];
  const EMPTY = { type: 'FeatureCollection', features: [] };

  function graticule() { // the wireframe globe from the original Scene 4 design
    const f = [], line = c => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } });
    for (let lon = -180; lon < 180; lon += 15) { const c = []; for (let lat = -80; lat <= 80; lat += 2) c.push([lon, lat]); f.push(line(c)); }
    for (let lat = -75; lat <= 75; lat += 15) { const c = []; for (let lon = -180; lon <= 180; lon += 2) c.push([lon, lat]); f.push(line(c)); }
    return { type: 'FeatureCollection', features: f };
  }

  function buildStyle() {
    const cls = list => ['in', ['get', 'class'], ['literal', list]];
    const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];
    const isTunnel = ['==', ['get', 'brunnel'], 'tunnel'];
    const W = stops => ['interpolate', ['exponential', 1.6], ['zoom'], ...stops];
    const hidden = { visibility: 'none' };
    return {
      version: 8,
      projection: { type: 'globe' },
      sky: { 'sky-color': '#ffffff', 'horizon-color': '#ffffff', 'fog-color': '#ffffff', 'sky-horizon-blend': 0, 'horizon-fog-blend': 0, 'atmosphere-blend': 0 },
      light: { anchor: 'viewport', color: '#ffffff', intensity: 0.38, position: [1.2, 210, 35] },
      sources: {
        [OMT]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
        boroughs: { type: 'geojson', data: EMPTY },
        active: { type: 'geojson', data: EMPTY },
        riskgrid: { type: 'geojson', data: EMPTY },
        graticule: { type: 'geojson', data: graticule() },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } },
        { id: 'water', type: 'fill', source: OMT, 'source-layer': 'water', paint: { 'fill-color': '#d6e3ef' } },
        { id: 'graticule', type: 'line', source: 'graticule', maxzoom: 7, paint: { 'line-color': '#9a9a9a', 'line-width': 0.6, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 2.5, 0.8, 5.5, 0] } },
        { id: 'country', type: 'line', source: OMT, 'source-layer': 'boundary', maxzoom: 8, filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': '#9c9c9c', 'line-width': 0.6 } },
        { id: 'green-wood', type: 'fill', source: OMT, 'source-layer': 'landcover', filter: cls(['wood']), paint: { 'fill-color': '#b6d4a9', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 0.9] } },
        { id: 'green-grass', type: 'fill', source: OMT, 'source-layer': 'landcover', filter: cls(['grass', 'farmland', 'wetland']), paint: { 'fill-color': '#cfe5c4', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 0.9] } },
        { id: 'green-park', type: 'fill', source: OMT, 'source-layer': 'park', paint: { 'fill-color': '#cfe5c4', 'fill-opacity': 0.7 } },
        { id: 'green-landuse', type: 'fill', source: OMT, 'source-layer': 'landuse', filter: cls(['cemetery', 'pitch', 'playground', 'grass']), paint: { 'fill-color': '#dcecd4' } },
        { id: 'waterway', type: 'line', source: OMT, 'source-layer': 'waterway', paint: { 'line-color': '#c4d6e7', 'line-width': W([10, 0.4, 16, 2]) } },
        { id: 'building', type: 'fill', source: OMT, 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': '#f1f1f1', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1] } },
        { id: 'aeroway', type: 'line', source: OMT, 'source-layer': 'aeroway', filter: cls(['runway']), paint: { 'line-color': '#000', 'line-opacity': 0.75, 'line-width': W([9, 0.8, 16, 26]) } },
        // risk views (flat)
        { id: 'borough-risk-flat', type: 'fill', source: 'boroughs', layout: hidden, paint: { 'fill-color': BOROUGH_RAMP, 'fill-opacity': 0.62 } },
        { id: 'risk-flat', type: 'fill', source: 'riskgrid', layout: hidden, paint: { 'fill-color': DB_RAMP, 'fill-opacity': 0.72 } },
        // the noise field: a blurred corridor around every busy road, sized in metres
        {
          id: 'noise-field', type: 'line', source: OMT, 'source-layer': 'transportation',
          filter: ['all', cls(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']), notTunnel],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#3a2cff',
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.07, 13, 0.055, 16, 0.045],
            'line-width': ['interpolate', ['exponential', 2], ['zoom'],
              9, ['match', ['get', 'class'], 'motorway', MPX(380, 9), 'trunk', MPX(280, 9), 'primary', MPX(200, 9), 'secondary', MPX(140, 9), MPX(80, 9)],
              18, ['match', ['get', 'class'], 'motorway', MPX(380, 18), 'trunk', MPX(280, 18), 'primary', MPX(200, 18), 'secondary', MPX(140, 18), MPX(80, 18)]],
            'line-blur': ['interpolate', ['exponential', 2], ['zoom'],
              9, ['match', ['get', 'class'], 'motorway', MPX(280, 9), 'trunk', MPX(200, 9), 'primary', MPX(140, 9), 'secondary', MPX(100, 9), MPX(55, 9)],
              18, ['match', ['get', 'class'], 'motorway', MPX(280, 18), 'trunk', MPX(200, 18), 'primary', MPX(140, 18), 'secondary', MPX(100, 18), MPX(55, 18)]],
          },
        },
        { id: 'rail-tunnel', type: 'line', source: OMT, 'source-layer': 'transportation', minzoom: 11, filter: ['all', cls(['rail', 'transit']), isTunnel], paint: { 'line-color': '#000', 'line-opacity': 0.22, 'line-width': W([11, 0.5, 16, 1.4]), 'line-dasharray': [1, 2.5] } },
        { id: 'path', type: 'line', source: OMT, 'source-layer': 'transportation', minzoom: 14, filter: ['all', cls(['path']), notTunnel], paint: { 'line-color': '#b7b7b7', 'line-width': W([14, 0.3, 18, 1.2]) } },
        { id: 'road-service', type: 'line', source: OMT, 'source-layer': 'transportation', filter: ['all', cls(['service', 'track']), notTunnel], paint: { 'line-color': '#8a8a8a', 'line-width': W([13, 0.25, 18, 2.4]) } },
        { id: 'road-minor', type: 'line', source: OMT, 'source-layer': 'transportation', filter: ['all', cls(['minor', 'busway']), notTunnel], layout: { 'line-join': 'round' }, paint: { 'line-color': '#3d3d3d', 'line-width': W([11, 0.25, 14, 0.6, 18, 4]) } },
        { id: 'road-tertiary', type: 'line', source: OMT, 'source-layer': 'transportation', filter: ['all', cls(['tertiary']), notTunnel], layout: { 'line-join': 'round' }, paint: { 'line-color': '#111', 'line-width': W([9, 0.3, 13, 0.75, 18, 5.5]) } },
        { id: 'road-secondary', type: 'line', source: OMT, 'source-layer': 'transportation', filter: ['all', cls(['secondary']), notTunnel], layout: { 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': W([8, 0.35, 12, 0.9, 18, 7]) } },
        { id: 'road-primary', type: 'line', source: OMT, 'source-layer': 'transportation', filter: ['all', cls(['primary', 'trunk']), notTunnel], layout: { 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': W([7, 0.4, 12, 1.2, 18, 9]) } },
        { id: 'road-motorway', type: 'line', source: OMT, 'source-layer': 'transportation', filter: ['all', cls(['motorway']), notTunnel], layout: { 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': W([6, 0.5, 12, 1.7, 18, 11]) } },
        { id: 'rail', type: 'line', source: OMT, 'source-layer': 'transportation', filter: ['all', cls(['rail', 'transit']), notTunnel], paint: { 'line-color': '#000', 'line-width': W([9, 0.5, 16, 1.6]), 'line-dasharray': [2, 1.6] } },
        { id: 'borough-line', type: 'line', source: 'boroughs', paint: { 'line-color': '#000', 'line-opacity': 0.6, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 14, 1.4], 'line-dasharray': [4, 3] } },
        { id: 'active-fill', type: 'fill', source: 'active', paint: { 'fill-color': '#e07b1a', 'fill-opacity': 0.035 } },
        { id: 'active-line', type: 'line', source: 'active', paint: { 'line-color': '#e07b1a', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.6, 14, 3] } },
        // 3D noise: columns rise out of the streets — height = modelled dB, colour = risk zone
        { id: 'borough-risk-3d', type: 'fill-extrusion', source: 'boroughs', layout: hidden, paint: { 'fill-extrusion-color': BOROUGH_RAMP, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.88, 'fill-extrusion-vertical-gradient': true } },
        // invisible helpers for querying street names and stations
        { id: 'q-names', type: 'line', source: OMT, 'source-layer': 'transportation_name', paint: { 'line-opacity': 0, 'line-width': 16 } },
        { id: 'q-stations', type: 'circle', source: OMT, 'source-layer': 'poi', filter: ['==', ['get', 'class'], 'railway'], paint: { 'circle-opacity': 0, 'circle-stroke-opacity': 0, 'circle-radius': 14 } },
      ],
    };
  }

  const ROAD_Q = ['road-service', 'road-minor', 'road-tertiary', 'road-secondary', 'road-primary', 'road-motorway', 'rail', 'rail-tunnel'];
  const GREEN_Q = ['green-wood', 'green-grass', 'green-park', 'green-landuse'];
  const LONDON = [-0.118, 51.509];
  const GLOBE_START = [-42, 26];
  let map = null, mapReady = false;

  try {
    map = new maplibregl.Map({
      container: 'map', style: buildStyle(), center: GLOBE_START, zoom: 1.3, minZoom: 0.8, maxZoom: 18.5,
      attributionControl: false, dragRotate: false, touchPitch: false, maxPitch: 68, renderWorldCopies: false,
      fadeDuration: 150,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable();
    map.doubleClickZoom.disable(); // a single click already steps closer
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Noise: Strategic Noise Mapping · Green cover: GLA · Sounds: Wikimedia Commons' }), 'bottom-right');
    map.on('load', () => {
      mapReady = true;
      if (window.THREE) map.addLayer(SPH, 'q-names');
      loadBoroughs(); fit();
      applyFilters(); // in case a filter was picked before the map finished loading
      setNames(namesOn);
    });
    map.on('zoom', () => updateLabelVis());
    map.on('error', e => console.warn('[LuND map]', e && e.error && e.error.message));
  } catch (e) {
    console.error('Map failed to start', e);
  }

  // arrive as a globe: spin across the Atlantic to the UK, then dive into London
  function flyIn() {
    if (!map) return;
    if (!mapReady) { map.once('load', flyIn); return; } // skipped before the map finished loading
    listener.mode = 'center';
    const z0 = isNarrow() ? 0.9 : 1.3;
    map.stop();
    map.setProjection({ type: 'globe' });
    map.jumpTo({ center: GLOBE_START, zoom: z0, pitch: 0, bearing: 0 });
    map.easeTo({ center: [-1.5, 50], zoom: z0 + 0.5, duration: 2800, easing: t => 1 - Math.pow(1 - t, 2), essential: true });
    map.once('moveend', () => {
      const d3 = is3DView();
      map.flyTo({ center: LONDON, zoom: isNarrow() ? 10.6 : 11.4, pitch: d3 ? (F.view === 'waves' ? 66 : 58) : 0, bearing: d3 ? -18 : 0, duration: 5600, curve: 1.7, essential: true });
      if (d3) map.once('moveend', () => { map.setProjection({ type: 'mercator' }); growIn(); scheduleGrid(0); });
    });
  }

  /* ---------- borough outlines from OpenStreetMap (Overpass), cached ---------- */
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  const CACHE_KEY = 'lund-boroughs-v2';
  let boroughFeats = [];

  async function loadBoroughs() {
    let fc = null;
    try { const c = localStorage.getItem(CACHE_KEY); if (c) fc = JSON.parse(c); } catch (e) { /* storage blocked */ }
    if (!fc) {
      fc = await fetchBoroughs();
      if (fc) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(fc)); } catch (e) { /* quota */ } }
    }
    if (!fc) { buildLabels(D.list.map(b => [b.key, b.c])); return; } // no outlines: label at rough centres
    boroughFeats = fc.features.map(f => ({ key: f.properties.key, polys: f.geometry.coordinates, bbox: bboxOf(f.geometry.coordinates) }));
    for (const f of fc.features) { // attach risk for the BOROUGHS view
      const r = BRISK[f.properties.key];
      Object.assign(f.properties, { risk: r.cls, score: r.score, rank: r.rank, h: 120 + r.score * 1300 });
    }
    map.getSource('boroughs').setData(fc);
    buildLabels(boroughFeats.map(f => [f.key, labelPoint(f.polys)]));
    dirty = true;
    gridDirty = true;
  }

  /* ---------- small borough name tags ---------- */
  const labels = {};
  function labelPoint(polys) { // a point well inside the largest piece (cheap pole-of-inaccessibility)
    const ring = polys.map(p => p[0]).sort((a, b) => b.length - a.length)[0];
    const bb = bboxOf([[ring]]);
    const segDist = (x, y) => {
      let m = Infinity;
      for (let i = 1; i < ring.length; i++) {
        const [ax, ay] = ring[i - 1], [bx, by] = ring[i], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-12;
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / L), ex = ax + t * dx - x, ey = ay + t * dy - y;
        m = Math.min(m, ex * ex + ey * ey * 2.6); // latitude degrees are ~1.6× longer here
      }
      return m;
    };
    let best = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], bd = -1;
    for (let i = 1; i < 18; i++) for (let j = 1; j < 18; j++) {
      const x = bb[0] + (bb[2] - bb[0]) * i / 18, y = bb[1] + (bb[3] - bb[1]) * j / 18;
      if (!inRing(x, y, ring)) continue;
      const d = segDist(x, y);
      if (d > bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  function buildLabels(points) {
    for (const k in labels) labels[k].remove();
    for (const [key, ll] of points) {
      const el = document.createElement('div');
      el.className = 'blabel';
      el.textContent = D.boroughs[key].name.replace(' upon ', ' u. ').toUpperCase();
      labels[key] = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(ll).addTo(map);
    }
    if (activeKey && labels[activeKey]) labels[activeKey].getElement().classList.add('on');
    updateLabelVis();
  }
  function updateLabelVis() {
    const z = map.getZoom();
    $('#app').classList.toggle('labels-off', z < 9.2 || z > 14.6);
    root.style.setProperty('--lblsize', (z < 10.5 ? 8.5 : z < 12 ? 9.5 : 10.5) + 'px');
  }

  /* ---------- borough risk score: road-noise exposure, average dB and lack of green cover ---------- */
  const BRISK = (function () {
    const L = D.list, rng = k => [Math.min(...L.map(b => b[k])), Math.max(...L.map(b => b[k]))];
    const [r0, r1] = rng('road'), [d0, d1] = rng('db'), [g0, g1] = rng('green');
    const scored = L.map(b => ({ key: b.key, score: 0.5 * (b.road - r0) / (r1 - r0) + 0.25 * (b.db - d0) / (d1 - d0) + 0.25 * (1 - (b.green - g0) / (g1 - g0)) }))
      .sort((a, b) => b.score - a.score);
    const out = {};
    scored.forEach((s, i) => { out[s.key] = { score: s.score, rank: i + 1, cls: 5 - Math.floor(i / (scored.length / 5)) }; });
    return out;
  })();

  async function fetchBoroughs() {
    const q = '[out:json][timeout:60];area(id:3600175342)->.lon;(relation["boundary"="administrative"]["admin_level"="8"](area.lon);relation["boundary"="administrative"]["name"="City of London"](area.lon););out geom qt;';
    for (const ep of OVERPASS) {
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 30000);
        const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
        clearTimeout(to);
        if (!r.ok) continue;
        const fc = toGeoJSON(await r.json());
        if (fc.features.length >= 30) return fc;
      } catch (e) { /* try next mirror */ }
    }
    return null;
  }

  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  function assemble(ways) {
    const pool = ways.map(w => w.slice()), rings = [];
    while (pool.length) {
      let ring = pool.shift(), guard = 0;
      while (!same(ring[0], ring[ring.length - 1]) && guard++ < 5000) {
        const end = ring[ring.length - 1];
        let i = pool.findIndex(w => same(w[0], end));
        if (i >= 0) { ring = ring.concat(pool.splice(i, 1)[0].slice(1)); continue; }
        i = pool.findIndex(w => same(w[w.length - 1], end));
        if (i >= 0) { ring = ring.concat(pool.splice(i, 1)[0].reverse().slice(1)); continue; }
        break;
      }
      if (ring.length >= 4) { if (!same(ring[0], ring[ring.length - 1])) ring.push(ring[0]); rings.push(ring); }
    }
    return rings;
  }
  function simplify(pts, tol) { // Douglas–Peucker
    if (pts.length < 5) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]], t2 = tol * tol;
    while (stack.length) {
      const [a, b] = stack.pop();
      let md = 0, mi = -1;
      const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-12;
      for (let i = a + 1; i < b; i++) {
        const t = clamp(((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / L);
        const ex = ax + t * dx - pts[i][0], ey = ay + t * dy - pts[i][1], d = ex * ex + ey * ey;
        if (d > md) { md = d; mi = i; }
      }
      if (md > t2 && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function toGeoJSON(j) {
    const features = [];
    for (const el of j.elements || []) {
      if (el.type !== 'relation') continue;
      const key = D.keyFromName(el.tags && el.tags.name);
      if (!key) continue;
      const outer = [], inner = [];
      for (const m of el.members) {
        if (m.type !== 'way' || !m.geometry) continue;
        const pts = m.geometry.map(g => [Math.round(g.lon * 1e5) / 1e5, Math.round(g.lat * 1e5) / 1e5]);
        (m.role === 'inner' ? inner : outer).push(pts);
      }
      const polys = assemble(outer).map(r => [simplify(r, 0.00008)]);
      for (const ir of assemble(inner)) { const p = polys.find(pp => inRing(ir[0][0], ir[0][1], pp[0])); if (p) p.push(simplify(ir, 0.00008)); }
      if (polys.length) features.push({ type: 'Feature', properties: { key, name: D.boroughs[key].name }, geometry: { type: 'MultiPolygon', coordinates: polys } });
    }
    return { type: 'FeatureCollection', features };
  }
  function bboxOf(polys) {
    const b = [180, 90, -180, -90];
    for (const p of polys) for (const [x, y] of p[0]) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
    return b;
  }
  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const inPoly = (x, y, poly) => inRing(x, y, poly[0]) && !poly.slice(1).some(h => inRing(x, y, h));
  function boroughAt(lng, lat) {
    if (boroughFeats.length) {
      for (const f of boroughFeats) {
        const b = f.bbox;
        if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
        if (f.polys.some(p => inPoly(lng, lat, p))) return f.key;
      }
      return null;
    }
    // fallback: nearest borough centre, only inside the rough Greater London box
    if (lng < -0.52 || lng > 0.34 || lat < 51.28 || lat > 51.70) return null;
    let best = null, bd = 1e9;
    for (const b of D.list) { const d = Math.hypot((b.c[0] - lng) * 0.62, b.c[1] - lat); if (d < bd) { bd = d; best = b.key; } }
    return best;
  }

  /* ================================================================
     LISTENER + NOISE MODEL
     ================================================================ */
  const listener = { px: null, lngLat: null, mode: 'center' };
  let dirty = true, lastSample = 0, activeKey = undefined;
  const S = { db: 55, shown: 0, zone: 2, bpm: 70, green: 0, borough: null, street: '', loud: 0.3, ready: false };

  function setListenerFromPoint(pt) {
    listener.mode = 'mouse';
    listener.px = { x: pt.x, y: pt.y };
    listener.lngLat = map.unproject(pt);
    dirty = true;
  }
  if (map) {
    map.on('mousemove', e => setListenerFromPoint(e.point));
    map.on('touchstart', e => setListenerFromPoint(e.point));
    map.on('touchmove', e => setListenerFromPoint(e.point));
    map.on('move', () => {
      if (listener.mode === 'center' || !listener.px) {
        const c = map.project(map.getCenter());
        listener.px = { x: c.x, y: c.y };
        listener.lngLat = map.getCenter();
      } else listener.lngLat = map.unproject([listener.px.x, listener.px.y]);
      dirty = true;
    });
    map.on('data', e => { if (e.dataType === 'source' && e.tile && e.sourceId === OMT) { dirty = true; gridDirty = true; } });
    map.on('click', e => {
      setListenerFromPoint(e.point);
      map.easeTo({ zoom: Math.min(map.getZoom() + 1.3, 17.6), around: e.lngLat, duration: 900 });
    });
  }

  function walk(e) {
    const k = e.key.toLowerCase(), step = 140;
    const dir = { arrowup: [0, -step], w: [0, -step], arrowdown: [0, step], s: [0, step], arrowleft: [-step, 0], a: [-step, 0], arrowright: [step, 0], d: [step, 0] }[k];
    if (!dir || !map) return;
    e.preventDefault();
    listener.mode = 'center';
    map.panBy(dir, { duration: 320 });
  }

  function distToGeom(geom, toM) {
    let best = Infinity;
    const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : geom.type === 'Point' ? [[geom.coordinates, geom.coordinates]] : [];
    for (const line of lines) {
      let prev = toM(line[0][0], line[0][1]);
      if (line.length === 1) best = Math.min(best, Math.hypot(prev[0], prev[1]));
      for (let i = 1; i < line.length; i++) {
        const q = toM(line[i][0], line[i][1]);
        const dx = q[0] - prev[0], dy = q[1] - prev[1], L = dx * dx + dy * dy || 1e-9;
        const t = clamp((-prev[0] * dx - prev[1] * dy) / L);
        best = Math.min(best, Math.hypot(prev[0] + t * dx, prev[1] + t * dy));
        prev = q;
      }
    }
    return best;
  }
  const esum = arr => 10 * Math.log10(arr.reduce((s, l) => s + Math.pow(10, l / 10), 0) || 1e-9);
  const lineSource = (Ls, d) => Ls - 10 * Math.log10(Math.max(d, 6) / 10) - 0.03 * Math.max(0, d - 20);
  // aircraft noise stretched along each airport's east–west runway: planes mostly land from the east over London
  const AIRPORTS = [
    { c: [-0.4543, 51.4700], L: 72, r0: 900, east: 3.5, west: 2, name: 'HEATHROW' },
    { c: [0.0553, 51.5048], L: 66, r0: 600, east: 2.5, west: 2.5, name: 'LONDON CITY AIRPORT' },
  ];
  function airL(a, lng, lat) {
    const dx = (lng - a.c[0]) * 111320 * Math.cos(lat * Math.PI / 180), dy = (lat - a.c[1]) * 110574;
    const d = Math.hypot(dx / (dx > 0 ? a.east : a.west), dy);
    return a.L - 18 * Math.log10(Math.max(d, a.r0) / a.r0);
  }
  const BIGBEN = [-0.12463, 51.50073], MUDCHUTE = [-0.0108, 51.4905];

  function fractionInside(polys, samples) {
    if (!polys.length) return 0;
    let w = 0, tot = 0;
    for (const [x, y, wt] of samples) {
      tot += wt;
      for (const f of polys) {
        const g = f.geometry;
        const P = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        if (P.some(p => inPoly(x, y, p))) { w += wt; break; }
      }
    }
    return w / tot;
  }

  function sample() {
    const ll = listener.lngLat;
    if (!ll || !mapReady) return;
    const z = map.getZoom(), lat = ll.lat, cosLat = Math.cos(lat * Math.PI / 180);
    const mpp = 78271.517 * cosLat / Math.pow(2, z);
    const toM = (lng, la) => [(lng - ll.lng) * 111320 * cosLat, (la - lat) * 110574];
    const dM = (c) => Math.hypot(...toM(c[0], c[1]));
    const p = map.project(ll);
    const box = r => { const R = clamp(r / mpp, 3, 260); return [[p.x - R, p.y - R], [p.x + R, p.y + R]]; };

    const key = boroughAt(ll.lng, lat);
    const B = key ? D.boroughs[key] : null;
    const bdb = B ? B.db : 58;

    // roads + rail
    const near = {};
    let tubeD = Infinity;
    for (const f of map.queryRenderedFeatures(box(450), { layers: ROAD_Q })) {
      const cls = f.properties.class, tunnel = f.properties.brunnel === 'tunnel';
      const d = distToGeom(f.geometry, toM);
      if (tunnel) { if (cls === 'rail' || cls === 'transit') tubeD = Math.min(tubeD, d); continue; }
      const id = cls + '|' + (f.properties.name || f.properties.ref || (f.properties.subclass || '') + Math.round(d / 15));
      if (!(id in near) || near[id].d > d) near[id] = { cls, d, ramp: f.properties.ramp };
    }
    // nearest few roads of each class count; buildings shield the rest
    const roadL = [], railL = [], perClass = {};
    for (const n of Object.values(near).sort((a, b) => a.d - b.d)) {
      perClass[n.cls] = (perClass[n.cls] || 0) + 1;
      if (perClass[n.cls] > 4) continue;
      if (ROAD_SRC[n.cls] != null) roadL.push(lineSource(ROAD_SRC[n.cls] - (n.ramp ? 2 : 0), n.d));
      else if (RAIL_SRC[n.cls] != null) railL.push(lineSource(RAIL_SRC[n.cls], n.d));
    }
    const airLv = AIRPORTS.map(a => airL(a, ll.lng, lat));
    const bg = bdb - 14;
    const Lroad = roadL.length ? esum(roadL) : 0;
    const Lrail = railL.length ? esum(railL) : 0;
    const Lair = esum(airLv);
    let L = esum([bg, Lroad || -99, Lrail || -99, Lair]);
    const wz = clamp((12.8 - z) / 2.3);
    L = clamp(lerp(L, bdb, wz * 0.7), 36, 92);
    if (!B && wz > 0.5) L = clamp(L - 4, 36, 92); // outside London, zoomed out

    // green + water: sample a small disc around the listener
    const rings = [[0, 0, 4]];
    for (const [r, n] of [[55, 6], [115, 8]]) for (let i = 0; i < n; i++) { const a = i / n * 6.283; rings.push([r * Math.cos(a), r * Math.sin(a), 1]); }
    const samples = rings.map(([dx, dy, w]) => [ll.lng + dx / (111320 * cosLat), lat + dy / 110574, w]);
    const greens = map.queryRenderedFeatures(box(140), { layers: GREEN_Q });
    let g = fractionInside(greens, samples);
    const parkName = (greens.find(f => f.properties.name && fractionInside([f], [[ll.lng, lat, 1]]) > 0) || { properties: {} }).properties.name || '';
    const water = fractionInside(map.queryRenderedFeatures(box(140), { layers: ['water'] }), samples);
    const wg = clamp((12 - z) / 2);
    if (B) g = lerp(g, B.green / 100, wg);

    // street + station names
    let street = '', bestD = Infinity;
    for (const f of map.queryRenderedFeatures(box(40), { layers: ['q-names'] })) {
      const nm = f.properties.name || f.properties['name:latin'] || f.properties.name_en;
      if (!nm || f.properties.class === 'path') continue;
      const d = distToGeom(f.geometry, toM);
      if (d < bestD) { bestD = d; street = (f.properties.ref ? f.properties.ref + ' · ' : '') + nm; }
    }
    let station = 0, stationName = '', sd = Infinity;
    for (const f of map.queryRenderedFeatures(box(260), { layers: ['q-stations'] })) {
      const d = dM(f.geometry.coordinates);
      if (d < sd) { sd = d; stationName = f.properties.name || ''; }
    }
    if (sd < Infinity) station = clamp(1 - sd / 240);

    const airNear = AIRPORTS.find(a => dM(a.c) < 3000);
    if (parkName && (!street || bestD > 25)) street = parkName;
    if (!street) street = airNear ? airNear.name : station > 0.4 ? stationName : g > 0.6 ? 'GREEN SPACE' : water > 0.5 ? 'RIVER THAMES' : '';

    S.db = L; S.zone = zoneOf(L); S.green = g; S.borough = B; S.street = street; S.ready = true;
    S.road = Lroad || 0; S.rail = Lrail || 0; S.air = Lair;
    S.loud = clamp((L - 38) / 44);
    S.bpm = bpmOf(L);

    const roadOnly = clamp(lerp(Math.max(Lroad || 0, bg + 4, Lair - 3), bdb + 2, wz * 0.7), 30, 95);
    A.update({
      db: L, road: roadOnly,
      rail: clamp(((Lrail || 0) - 50) / 22), tube: clamp(1 - tubeD / 140), station, air: clamp((Lair - 52) / 20),
      green: g, water: clamp(water * 1.6), bigben: Math.pow(clamp(1 - dM(BIGBEN) / 1400), 1.5),
      cow: dM(MUDCHUTE) < 350 ? 1 - dM(MUDCHUTE) / 350 : 0,
    });
    renderReadout();
    if (key !== activeKey) setActive(key);
    $('#zoomHint').classList.toggle('off', !inApp || z >= 12.6);
  }

  function setActive(key) {
    if (labels[activeKey]) labels[activeKey].getElement().classList.remove('on');
    if (labels[key]) labels[key].getElement().classList.add('on');
    activeKey = key;
    if (!map || !map.getSource('active')) return;
    const f = key && boroughFeats.find(b => b.key === key);
    map.getSource('active').setData(f ? { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: f.polys } } : { type: 'FeatureCollection', features: [] });
  }

  /* ================================================================
     RISK GRID (flat squares or 3D columns) + FILTERS
     The same noise model as the listener, run over a grid of cells in view.
     ================================================================ */
  const F = { view: 'flat', risk: 'all', scale: 'streets', src: 'all' };
  let gridDirty = true, gridTimer = 0, growTimer = 0, noiseOn = true;
  const CELL_STEPS = [25, 35, 50, 70, 100, 140, 200, 280, 400, 560, 800];
  const LONDON_BOX = [-0.53, 51.27, 0.35, 51.70];
  const is3DView = () => F.view !== 'flat';
  const needsGrid = () => F.scale === 'streets' && (is3DView() || F.risk !== 'all' || F.src !== 'all');
  const scheduleGrid = (ms = 200) => { clearTimeout(gridTimer); gridTimer = setTimeout(buildGrid, ms); };

  function buildGrid() {
    if (!mapReady || !needsGrid()) return;
    const src = map.getSource('riskgrid');
    const b = map.getBounds();
    const west = Math.max(b.getWest(), LONDON_BOX[0]), east = Math.min(b.getEast(), LONDON_BOX[2]);
    const south = Math.max(b.getSouth(), LONDON_BOX[1]), north = Math.min(b.getNorth(), LONDON_BOX[3]);
    if (east <= west || north <= south || map.getZoom() < 8.5) { src.setData(EMPTY); SPH.setCells([], 100, F.view); return; }
    const lat0 = (south + north) / 2, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110574;
    const wM = (east - west) * kx, hM = (north - south) * ky;
    const viewW = map.getCanvas().clientWidth || innerWidth;
    const pxPerCell = F.view === 'pins' ? 13 : F.view === 'waves' ? 9 : 11; // pins put several per cell
    let cell = CELL_STEPS.find(c => c >= wM / Math.max(50, viewW / pxPerCell)) || 800;
    while ((wM / cell) * (hM / cell) > 14000) cell = CELL_STEPS[CELL_STEPS.indexOf(cell) + 1] || cell * 1.4;
    // snap to a fixed origin so cells don't shimmer while panning
    const ox = Math.floor((west - LONDON_BOX[0]) * kx / cell) * cell, oy = Math.floor((south - LONDON_BOX[1]) * ky / cell) * cell;
    const nx = Math.ceil(((east - LONDON_BOX[0]) * kx - ox) / cell), ny = Math.ceil(((north - LONDON_BOX[1]) * ky - oy) / cell);
    const ER = new Float64Array(nx * ny), EL = new Float64Array(nx * ny); // road / rail energy
    const toCell = (lng, lat) => [((lng - LONDON_BOX[0]) * kx - ox) / cell, ((lat - LONDON_BOX[1]) * ky - oy) / cell];
    const energy = (Ls, d) => Math.pow(10, lineSource(Ls, d) / 10) * 0.5; // two samples per cell crossing
    const dC = Math.max(cell * 0.35, 6), step = cell * 0.5;

    for (const f of map.querySourceFeatures(OMT, { sourceLayer: 'transportation' })) {
      const pr = f.properties;
      if (pr.brunnel === 'tunnel') continue;
      const rail = RAIL_SRC[pr.class] != null;
      const Ls = rail ? RAIL_SRC[pr.class] : ROAD_SRC[pr.class];
      if (Ls == null) continue;
      const E = rail ? EL : ER;
      const eC = energy(Ls, dC), eN = energy(Ls, cell), eD = energy(Ls, cell * 1.41);
      const g = f.geometry, lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const ln of lines) for (let i = 1; i < ln.length; i++) {
        const [x0, y0] = toCell(ln[i - 1][0], ln[i - 1][1]), [x1, y1] = toCell(ln[i][0], ln[i][1]);
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) * cell / step));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n, cx = Math.floor(x0 + (x1 - x0) * t), cy = Math.floor(y0 + (y1 - y0) * t);
          if (cx < -1 || cy < -1 || cx > nx || cy > ny) continue;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const X = cx + dx, Y = cy + dy;
            if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
            E[Y * nx + X] += dx === 0 && dy === 0 ? eC : (dx === 0 || dy === 0) ? eN : eD;
          }
        }
      }
    }

    const feats = [], cells = [], gap = cell * 0.12, floor = Math.pow(10, 3.8); // 38 dB floor for single-source views
    const keep = F.risk === 'high' ? db => db >= 65 : F.risk === 'low' ? db => db < 55 : () => true;
    for (let Y = 0; Y < ny; Y++) for (let X = 0; X < nx; X++) {
      const mx = ox + X * cell, my = oy + Y * cell;
      const lng = LONDON_BOX[0] + (mx + cell / 2) / kx, lat = LONDON_BOX[1] + (my + cell / 2) / ky;
      const key = boroughAt(lng, lat);
      if (!key) continue; // keep London's outline
      let air = 0;
      for (const a of AIRPORTS) air += Math.pow(10, airL(a, lng, lat) / 10);
      const i = Y * nx + X;
      const e = F.src === 'road' ? ER[i] + floor : F.src === 'rail' ? EL[i] + floor : F.src === 'air' ? air + floor
        : ER[i] + EL[i] + air + Math.pow(10, (D.boroughs[key].db - 14) / 10);
      const db = 10 * Math.log10(e);
      if (!keep(db)) continue;
      if (F.src !== 'all' && F.risk !== 'low' && db < 46) continue; // single-source views: only where that source reaches
      if (is3DView()) { cells.push({ lng, lat, db, ix: X, iy: Y }); continue; }
      const w0 = LONDON_BOX[0] + (mx + gap) / kx, w1 = LONDON_BOX[0] + (mx + cell - gap) / kx;
      const s0 = LONDON_BOX[1] + (my + gap) / ky, s1 = LONDON_BOX[1] + (my + cell - gap) / ky;
      feats.push({ type: 'Feature', properties: { db: Math.round(db * 10) / 10 }, geometry: { type: 'Polygon', coordinates: [[[w0, s0], [w1, s0], [w1, s1], [w0, s1], [w0, s0]]] } });
    }
    if (is3DView()) { SPH.setCells(cells, cell, F.view); src.setData(EMPTY); }
    else { src.setData({ type: 'FeatureCollection', features: feats }); SPH.setCells([], cell, F.view); }
    gridDirty = false;
  }

  /* ---------- 3D: PINS (clusters of thin pins) or WAVES (stippled dot ridgelines) ----------
     Built in three.js inside MapLibre; heights animate on the GPU so tens of thousands of marks stay smooth.
     Height + colour = modelled dB. The field builds up row by row, then ripples outward from the listener. */
  const LINE_COLORS = ['#2f8f4e', '#5fae6c', '#9a92ee', '#5d4eff', '#2a1cd9']; // darker mid-tones so thin marks read on white
  const dbColor = (() => {
    const stops = [45, 52, 60, 68, 76];
    let cols = null;
    return (db, out) => {
      cols = cols || LINE_COLORS.map(h => new THREE.Color(h));
      if (db <= stops[0]) return out.copy(cols[0]);
      for (let i = 1; i < stops.length; i++) if (db <= stops[i]) return out.copy(cols[i - 1]).lerp(cols[i], (db - stops[i - 1]) / (stops[i] - stops[i - 1]));
      return out.copy(cols[cols.length - 1]);
    };
  })();
  const hash = (a, b, k) => { const s = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };

  const GLSL_LIFT = `
    uniform float uTime; uniform float uSince; uniform float uLambda; uniform vec2 uListener;
    float liftAt(vec2 xy, float row, vec4 wv) {
      float k = clamp((uSince - row * 1.1) / 0.9, 0.0, 1.0);
      float e = 1.0 - pow(1.0 - k, 3.0);
      float d = distance(xy, uListener);
      float w = 0.5 + 0.5 * sin(uTime * wv.z - d / uLambda * 6.2831 + wv.w);
      return (wv.x + wv.y * w) * e;
    }`;
  const BAR_VS = GLSL_LIFT + `
    attribute vec3 iPos; attribute vec4 iWave; attribute vec3 iColor;
    uniform float uBarW;
    varying vec3 vColor; varying float vZ; varying float vShade;
    void main() {
      float h = max(0.5, liftAt(iPos.xy, iPos.z, iWave));
      vec3 p = vec3(iPos.xy + position.xy * uBarW, position.z * h);
      vColor = iColor; vZ = position.z;
      vShade = 0.82 + 0.18 * dot(normal, normalize(vec3(-0.45, -0.7, 0.55)));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const BAR_FS = `
    varying vec3 vColor; varying float vZ; varying float vShade;
    void main() {
      vec3 c = mix(mix(vColor, vec3(1.0), 0.55), vColor, smoothstep(0.0, 0.7, vZ));
      gl_FragColor = vec4(c * vShade, 1.0);
    }`;
  const DOT_VS = GLSL_LIFT + `
    attribute vec4 iWave; attribute vec3 iColor; attribute float aSize; attribute float aLift;
    uniform float uDot;
    varying vec3 vColor;
    void main() {
      float h = max(0.0, liftAt(position.xy, position.z, iWave) + aLift);
      vColor = iColor;
      gl_PointSize = uDot * aSize;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, h, 1.0);
    }`;
  const DOT_FS = `
    varying vec3 vColor;
    void main() {
      vec2 q = gl_PointCoord - 0.5;
      if (dot(q, q) > 0.25) discard;
      gl_FragColor = vec4(vColor, 1.0);
    }`;

  const SPH = {
    id: 'noise-3d', type: 'custom', renderingMode: '3d',
    on: false, pending: null, riseT0: 0, objs: [],
    onAdd(m, gl) {
      this.map = m;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      this.renderer.autoClear = false;
      this.U = {
        uTime: { value: 0 }, uSince: { value: 0 }, uLambda: { value: 1000 }, uListener: { value: new THREE.Vector2() },
        uBarW: { value: 10 }, uDot: { value: 3 },
      };
      this.box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5); // pin base sits on the ground
      this.barMat = new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: BAR_VS, fragmentShader: BAR_FS });
      this.dotMat = new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: DOT_VS, fragmentShader: DOT_FS });
      this.col = new THREE.Color();
      if (this.pending) this.setCells(...this.pending);
    },
    setCells(cells, cell, mode) {
      if (!this.scene) { this.pending = [cells, cell, mode]; return; }
      for (const o of this.objs) { this.scene.remove(o); o.geometry.dispose(); }
      this.objs = [];
      if (!cells.length) return;
      // local metric frame around the first cell keeps float precision
      this.oLng = cells[0].lng; this.oLat = cells[0].lat;
      this.kx = 111320 * Math.cos(this.oLat * Math.PI / 180); this.ky = 110574;
      this.o = maplibregl.MercatorCoordinate.fromLngLat([this.oLng, this.oLat], 0);
      this.s = this.o.meterInMercatorCoordinateUnits();
      this.U.uLambda.value = cell * 9;
      let minY = Infinity, maxY = -Infinity;
      for (const c of cells) { minY = Math.min(minY, c.iy); maxY = Math.max(maxY, c.iy); }
      this.rowOf = iy => (iy - minY) / Math.max(1, maxY - minY); // build-up order, south → north
      if (mode === 'waves') this.buildWaves(cells, cell); else this.buildPins(cells, cell);
      for (const o of this.objs) { o.frustumCulled = false; this.scene.add(o); }
      if (this.on) this.map.triggerRepaint();
    },
    terrain(db, cell, loud, k = 1) {
      return {
        base: (cell * 0.2 + Math.pow(clamp((db - 56) / 22), 2) * cell * 6.5) * k, // low ground, peaks only on loud corridors
        amp: cell * (0.08 + 1.0 * loud * loud) * k,                               // louder → bigger waves
        w: 6.283 * (0.2 + 0.45 * loud),                                       // louder → faster
      };
    },
    pointsObj(pos, wave, color, size, lift) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('iWave', new THREE.BufferAttribute(wave, 4));
      g.setAttribute('iColor', new THREE.BufferAttribute(color, 3));
      g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      g.setAttribute('aLift', new THREE.BufferAttribute(lift, 1));
      return new THREE.Points(g, this.dotMat);
    },
    buildPins(cells, cell) {
      const P = [], W = [], C = [];
      for (const c of cells) {
        const loud = clamp((c.db - 50) / 28);
        const n = 1 + Math.round(Math.pow(loud, 1.3) * 7); // dense clusters where it's loud
        for (let k = 0; k < n; k++) {
          const dbj = c.db + (hash(c.ix + 3, c.iy, k) - 0.5) * 3, hf = 0.5 + hash(c.ix, c.iy + 5, k) * 0.7;
          const t = this.terrain(dbj, cell, loud);
          P.push((c.lng - this.oLng) * this.kx + (hash(c.ix, c.iy, k) - 0.5) * cell * 0.92,
            (c.lat - this.oLat) * this.ky + (hash(c.iy, c.ix, k + 9) - 0.5) * cell * 0.92, this.rowOf(c.iy));
          W.push(t.base * hf, t.amp * hf, t.w, hash(k, c.ix, c.iy) * 0.6);
          dbColor(dbj, this.col); C.push(this.col.r, this.col.g, this.col.b);
        }
      }
      const n = P.length / 3, pos = Float32Array.from(P), wave = Float32Array.from(W), color = Float32Array.from(C);
      const g = new THREE.InstancedBufferGeometry();
      g.index = this.box.index;
      g.setAttribute('position', this.box.attributes.position);
      g.setAttribute('normal', this.box.attributes.normal);
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
      g.setAttribute('iWave', new THREE.InstancedBufferAttribute(wave, 4));
      g.setAttribute('iColor', new THREE.InstancedBufferAttribute(color, 3));
      g.instanceCount = n;
      this.U.uBarW.value = cell * 0.1;
      this.U.uDot.value = 3 * (devicePixelRatio || 1);
      this.objs.push(new THREE.Mesh(g, this.barMat));
      this.objs.push(this.pointsObj(pos, wave, color, new Float32Array(n).fill(1), new Float32Array(n)));
    },
    buildWaves(cells, cell) {
      // smooth the noise field so each row flows like a ridgeline, then draw every other row as a dotted line
      const grid = new Map(cells.map(c => [c.ix + ',' + c.iy, c]));
      const smooth = new Map();
      const sdb = c => {
        const key = c.ix + ',' + c.iy;
        if (smooth.has(key)) return smooth.get(key);
        let sum = 0, wsum = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nb = grid.get((c.ix + dx) + ',' + (c.iy + dy));
          if (!nb) continue;
          const wt = Math.exp(-(dx * dx + dy * dy) / 2.2);
          sum += nb.db * wt; wsum += wt;
        }
        const v = sum / wsum;
        smooth.set(key, v);
        return v;
      };
      const rows = new Map();
      for (const c of cells) { if (c.iy % 2) continue; if (!rows.has(c.iy)) rows.set(c.iy, []); rows.get(c.iy).push(c); }
      const P = [], W = [], C = [], S = [], L = [], SUB = 6;
      const add = (lng, lat, db, iy, size, lift, seed) => {
        const loud = clamp((db - 50) / 28), t = this.terrain(db, cell, loud, 3.2); // tall relief so ridgelines read
        P.push((lng - this.oLng) * this.kx, (lat - this.oLat) * this.ky, this.rowOf(iy));
        W.push(t.base, t.amp, t.w, 0);
        dbColor(db, this.col); C.push(this.col.r, this.col.g, this.col.b);
        S.push(size); L.push(lift);
      };
      for (const [iy, row] of rows) {
        row.sort((p, q) => p.ix - q.ix);
        for (let i = 0; i < row.length; i++) {
          const a = row[i], b = row[i + 1], joined = b && b.ix === a.ix + 1;
          const da = sdb(a), dbb = joined ? sdb(b) : da;
          for (let s = 0; s < (joined ? SUB : 1); s++) { // dots along the ridge, interpolated between cells
            const t = s / SUB, db = da + (dbb - da) * t;
            const lng = joined ? a.lng + (b.lng - a.lng) * t : a.lng, lat = joined ? a.lat + (b.lat - a.lat) * t : a.lat;
            add(lng, lat, db, iy, 0.9, 0, a.ix * SUB + s);
            // spray: a few loose dots lifting off the highest crests
            if (db > 69 && hash(a.ix + s, iy, 7) < 0.12) add(lng, lat, db, iy, 0.7, cell * (1 + hash(iy, a.ix, s) * 3.5), a.ix * SUB + s + 0.5);
          }
        }
      }
      this.U.uDot.value = 2.6 * (devicePixelRatio || 1);
      this.objs.push(this.pointsObj(Float32Array.from(P), Float32Array.from(W), Float32Array.from(C), Float32Array.from(S), Float32Array.from(L)));
    },
    rise() { this.riseT0 = performance.now(); },
    render(gl, args) {
      if (!this.on || !this.objs.length) return;
      const mat = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix) || (args && args.modelViewProjectionMatrix) || args;
      const now = performance.now();
      this.U.uTime.value = now / 1000;
      this.U.uSince.value = (now - this.riseT0) / 1000;
      const Lg = listener.lngLat;
      if (Lg) this.U.uListener.value.set((Lg.lng - this.oLng) * this.kx, (Lg.lat - this.oLat) * this.ky);
      const l = new THREE.Matrix4().makeTranslation(this.o.x, this.o.y, this.o.z).scale(new THREE.Vector3(this.s, -this.s, this.s));
      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(mat).multiply(l);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.map.triggerRepaint(); // keep the waves moving
    },
  };

  function growIn() { // heat lines and borough blocks build up from the ground
    clearTimeout(growTimer);
    SPH.rise();
    const t0 = performance.now();
    const stepFn = () => {
      const k = Math.min(1, (performance.now() - t0) / 1400), e = 1 - Math.pow(1 - k, 3);
      map.setPaintProperty('borough-risk-3d', 'fill-extrusion-height', k < 1 ? ['*', ['get', 'h'], e] : ['get', 'h']);
      if (k < 1) growTimer = setTimeout(stepFn, 60);
    };
    stepFn();
  }

  const countRisk = test => Object.values(BRISK).filter(r => test(r.cls)).length;
  const vis = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };

  function applyFilters(changed, prev) {
    if (!mapReady) return;
    const is3D = is3DView(), streets = F.scale === 'streets', single = F.src !== 'all';
    const cellF = F.risk === 'high' ? ['>=', ['get', 'db'], 65] : F.risk === 'low' ? ['<', ['get', 'db'], 55] : null;
    const borF = F.risk === 'high' ? ['>=', ['get', 'risk'], 4] : F.risk === 'low' ? ['<=', ['get', 'risk'], 2] : null;
    map.setFilter('risk-flat', cellF);
    map.setFilter('borough-risk-flat', borF); map.setFilter('borough-risk-3d', borF);
    vis('risk-flat', !is3D && streets && (F.risk !== 'all' || single));
    SPH.on = is3D && streets;
    if (SPH.on) map.triggerRepaint();
    vis('borough-risk-flat', !is3D && !streets);
    vis('borough-risk-3d', is3D && !streets);
    vis('noise-field', noiseOn && !is3D && streets && F.risk === 'all' && !single);
    vis('building', !is3D);
    for (const id of ['road-service', 'road-minor', 'road-tertiary', 'road-secondary', 'road-primary', 'road-motorway', 'rail', 'path'])
      map.setPaintProperty(id, 'line-opacity', is3D ? 0.32 : 1); // let the 3D marks lead
    const switched = changed === 'view' && (prev === 'flat') !== (F.view === 'flat'); // flat ↔ 3D
    const tilt = F.view === 'waves' ? 66 : 58;
    if (changed === 'view' && !switched && is3D) map.easeTo({ pitch: tilt, duration: 900 });
    if (switched) {
      // three.js draws in mercator space; at city zoom mercator and globe look the same
      map.setProjection({ type: is3D ? 'mercator' : 'globe' });
      if (is3D) {
        map.dragRotate.enable(); map.touchPitch.enable(); map.touchZoomRotate.enableRotation();
        const z = map.getZoom();
        map.easeTo({ pitch: tilt, bearing: -18, zoom: z < 12.5 ? (isNarrow() ? 9.9 : 10.7) : z, duration: 1600 });
      } else {
        map.dragRotate.disable(); map.touchPitch.disable(); map.touchZoomRotate.disableRotation();
        map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      }
    }
    if (is3D && changed) growIn();
    if (changed) gridDirty = true; // cell size / filter differs
    if (needsGrid()) scheduleGrid(changed ? 0 : 200);
    else SPH.setCells([], 100, F.view);

    const showKey = is3D || F.risk !== 'all' || !streets || single;
    $('#riskKey').classList.toggle('on', showKey);
    document.body.classList.toggle('key-on', showKey);
    const what = single ? F.src.toUpperCase() + ' NOISE' : 'MODELLED dB';
    $('#rkTitle').textContent = streets ? (is3D ? 'HEIGHT + COLOUR = ' + what + ' · WAVES = LOUDNESS' : 'RISK ZONE · ' + what) : 'BOROUGH RISK · LOW → HIGH';
    const labs = $('#rkLabels');
    labs.classList.toggle('ends', !streets);
    labs.innerHTML = streets ? '<span>50</span><span>55</span><span>65</span><span>75 dB</span>' : '<span>LOW</span><span>HIGH</span>';
    const srcNote = { road: 'ROAD TRAFFIC ONLY', rail: 'RAIL, OVERGROUND, DLR & TRAM ONLY (UNDERGROUND TUNNELS EXCLUDED)', air: 'AIRCRAFT ONLY — HEATHROW & LONDON CITY APPROACH PATHS' }[F.src];
    const riskNote = F.risk === 'high' ? 'SHOWING ≥ 65 dB — ABOVE THE STRESS-RESPONSE LEVEL' : F.risk === 'low' ? 'SHOWING < 55 dB — QUIET REFUGES' : '';
    $('#rkNote').textContent = streets
      ? [srcNote, riskNote].filter(Boolean).join(' · ')
      : (F.risk === 'high' ? `TOP ${countRisk(c => c >= 4)} BOROUGHS · ` : F.risk === 'low' ? `LOWEST ${countRisk(c => c <= 2)} BOROUGHS · ` : '') + 'SCORE = ROAD-NOISE EXPOSURE 50% · AVG dB 25% · LACK OF GREEN 25%';
  }

  // show / hide the borough name tags (remembered between visits)
  let namesOn = true;
  try { namesOn = localStorage.getItem('lund-names') !== 'off'; } catch (e) { /* storage blocked */ }
  function setNames(on) {
    namesOn = on;
    const b = $('#tglNames');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    $('#app').classList.toggle('names-off', !on);
    if (mapReady) for (const id of ['borough-line', 'active-fill', 'active-line']) vis(id, on);
    try { localStorage.setItem('lund-names', on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
  }
  setNames(namesOn);
  $('#tglNames').addEventListener('click', () => setNames(!namesOn));

  $$('#filters .fgroup').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const k = g.dataset.key, v = b.dataset.v;
    if (F[k] === v) return;
    const prev = F[k];
    F[k] = v;
    $$('button', g).forEach(x => x.classList.toggle('on', x === b));
    applyFilters(k, prev);
  }));

  if (map) {
    map.on('moveend', () => { if (needsGrid()) scheduleGrid(); });
    map.on('idle', () => { if (needsGrid() && gridDirty) buildGrid(); });
  }

  /* ================================================================
     PANELS
     ================================================================ */
  const matrix = $('#matrix');
  matrix.innerHTML = '<i></i>'.repeat(90);
  const dots = $$('i', matrix);
  const spec = $('#spectrum');
  spec.innerHTML = '<i></i>'.repeat(16);
  const specBars = $$('i', spec);
  $('#greenBar').insertAdjacentHTML('beforeend', '<b></b>');
  let lastCmp = '';

  function renderReadout() {
    const B = S.borough, db = Math.round(S.db);
    const name = B ? B.name.toUpperCase() : 'OUTSIDE GREATER LONDON';
    $('#areaName').textContent = name;
    $('#tagBorough').textContent = name;
    $('#streetName').textContent = (S.street || name).toUpperCase();
    $('#tagStreet').textContent = S.street.toUpperCase();
    $('#dbVal').textContent = db;
    $('#tagDb').textContent = db;
    $('#tagZone').textContent = S.zone;
    $('#zoneNow').textContent = S.zone;
    $('#popNum').textContent = B ? fmt(B.roadPop) : '—';
    $('#greenPct').textContent = B ? Math.round(B.green) + '%' : '—';
    $('#greenLocal').textContent = Math.round(S.green * 100) + '%';
    $('#boroughDb').textContent = B ? B.db.toFixed(1) : '—';
    for (const [k, id] of [['road', 'Road'], ['rail', 'Rail'], ['air', 'Air']]) {
      const v = S[k] || 0;
      $('#src' + id).textContent = v > 30 ? Math.round(v) : '—';
      $('#src' + id + 'Bar').style.width = clamp((v - 35) / 50) * 100 + '%';
    }
    $('#bRisk').textContent = B ? BRISK[B.key].cls : '-';
    $('#bRank').textContent = B ? BRISK[B.key].rank : '-';
    $('#greenBar i').style.width = (B ? B.green : 0) + '%';
    $('#greenBar b').style.left = (S.green * 100) + '%';
    const [ic, lab] = comparisonOf(S.db);
    if (ic + lab !== lastCmp) { $('#cmpIcon').innerHTML = ICONS[ic]; $('#cmpLabel').textContent = '≈ ' + lab; lastCmp = ic + lab; }
    setGlyphs($('#amyg'), S.zone);
    setGlyphs($('#cort'), S.zone);
    $('#bpm').textContent = S.bpm;
    const r = risksOf(S.db);
    $('#risk1').textContent = r[0]; $('#risk5').textContent = r[1]; $('#risk10').textContent = r[2];
  }

  const chanMeters = $$('.chan').map(b => ({ name: b.dataset.ch, bars: $$('.meter i', b) }));
  const spkDots = $$('#spkBtn .spk-dots circle');
  let modelSpec = new Array(16).fill(0);

  function animatePanels(t) {
    // dot matrix eases toward the local dB
    S.shown += ((S.ready ? S.db : 0) - S.shown) * 0.12;
    const n = Math.round(S.shown);
    for (let i = 0; i < 90; i++) {
      const row = 17 - Math.floor(i / 5); // fill from the bottom
      const on = (row * 5 + (i % 5)) < n;
      if (dots[i]._on !== on) { dots[i].classList.toggle('on', on); dots[i]._on = on; }
    }
    // spectrum: real analyser when sound is on; modelled shape when muted
    let sp = A.spectrum(16);
    if (!A.enabled) {
      sp = modelSpec = modelSpec.map((v, i) => {
        const f = i / 15, city = S.loud, nat = S.green;
        const target = (city * (1 - f * 0.75) * 0.85 + nat * Math.exp(-Math.pow((f - 0.78) / 0.12, 2)) * 0.6) * (0.75 + 0.5 * Math.random());
        return lerp(v, target * 0.6, 0.25);
      });
    }
    specBars.forEach((b, i) => { b.style.height = Math.max(1, sp[i] * 30) + 'px'; });
    // channel meters
    const lv = A.levels() || { city: A.channels.city ? S.loud * 0.6 : 0, transit: 0, nature: A.channels.nature ? S.green * 0.6 : 0 };
    for (const m of chanMeters) {
      const k = Math.round(clamp(lv[m.name] || 0) * 6);
      m.bars.forEach((b, i) => b.classList.toggle('on', i < k));
    }
    // speaker dots act as a 4-column level meter
    const ml = A.enabled ? clamp((lv.city + lv.transit + lv.nature) * 0.9) : 0;
    spkDots.forEach(c => { c.style.opacity = A.enabled ? (+c.dataset.c < Math.ceil(ml * 4) ? 1 : 0.25) : 1; });
    drawECG($('#ecg'), S.bpm, t / 1000, '#000', 1.6);
  }

  /* ---------- controls ---------- */
  function setAudio(on) {
    audioPref = on;
    A.setEnabled(on);
    $('#spkBtn').setAttribute('aria-pressed', String(on));
    for (const m of chanMeters) A.setChannel(m.name, $(`.chan[data-ch="${m.name}"]`).classList.contains('on'));
    dirty = true;
  }
  $('#spkBtn').addEventListener('click', () => setAudio(!A.enabled));
  $$('.chan').forEach(b => b.addEventListener('click', () => {
    const on = !b.classList.contains('on');
    b.classList.toggle('on', on);
    A.unlock();
    A.setChannel(b.dataset.ch, on);
  }));
  $$('.collapse').forEach(b => b.addEventListener('click', () => {
    const p = document.getElementById(b.dataset.target);
    const c = p.classList.toggle('collapsed');
    b.textContent = c ? 'EXPAND' : 'COLLAPSE';
    setTimeout(fit, 480);
  }));
  $('#tglNoise').addEventListener('click', e => {
    noiseOn = !e.currentTarget.classList.contains('on');
    e.currentTarget.classList.toggle('on', noiseOn);
    applyFilters();
  });
  $('#tglRain').addEventListener('click', e => {
    const on = !e.currentTarget.classList.contains('on');
    e.currentTarget.classList.toggle('on', on);
    A.setRain(on);
  });

  const PLACES = [
    ['OXFORD CIRCUS', [-0.1415, 51.5152], 16.3],
    ['HYDE PARK', [-0.1657, 51.5073], 15.6],
    ['BIG BEN', [-0.1246, 51.5007], 16.2],
    ['HAMPSTEAD HEATH', [-0.1652, 51.5608], 15.2],
    ['RICHMOND PARK', [-0.2750, 51.4430], 14.8],
    ['CANARY WHARF', [-0.0195, 51.5045], 16],
    ["KING'S CROSS", [-0.1238, 51.5305], 16.2],
    ['A40 · HANGER LANE', [-0.2932, 51.5302], 16],
    ['HEATHROW', [-0.4543, 51.4700], 14],
    ['MUDCHUTE FARM', [-0.0108, 51.4905], 16.4],
  ];
  const placesEl = $('#places');
  for (const [name, c, z] of PLACES) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => {
      $$('.places button').forEach(x => x.classList.toggle('on', x === b));
      listener.mode = 'center';
      map.flyTo({ center: c, zoom: z, duration: 2600, essential: true });
    });
    placesEl.appendChild(b);
  }

  // credits
  $('#creditList').innerHTML = Object.values(A.REC).map(r =>
    `<li><b>${r.title}</b> — ${r.author} · ${r.where} · <span class="lic">${r.lic}</span> · <a href="https://commons.wikimedia.org/wiki/${encodeURI(r.page)}" target="_blank" rel="noopener">Commons ↗</a></li>`).join('');
  $('#dockBtn').addEventListener('click', e => {
    const min = $('#dock').classList.toggle('min');
    e.currentTarget.textContent = min ? 'SHOW KEY' : 'HIDE KEY';
  });
  $('#creditsBtn').addEventListener('click', () => { $('#credits').hidden = false; });
  $('#creditsClose').addEventListener('click', () => { $('#credits').hidden = true; });
  $('#credits').addEventListener('click', e => { if (e.target.id === 'credits') e.currentTarget.hidden = true; });

  /* ================================================================
     SOUND-WAVE RINGS AROUND THE LISTENER
     ================================================================ */
  const cv = $('#waves'), cx = cv.getContext('2d');
  let dpr = 1;
  function sizeCanvas() {
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  }
  const rings = [];
  let lastEmit = 0;
  const pfitNow = () => +root.style.getPropertyValue('--pfit') || 1;
  const mixColor = g => {
    const a = [58, 44, 255], b = [52, 150, 80];
    return a.map((v, i) => Math.round(lerp(v, b[i], clamp(g * 1.2))));
  };

  function drawWaves(t) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, innerWidth, innerHeight);
    const tag = $('#tag');
    if (!inApp || !listener.px || !S.ready || map.getZoom() < 8) { tag.classList.remove('on'); return; }
    const { x, y } = listener.px;
    const loud = S.loud, sec = t / 1000;
    const interval = lerp(1300, 380, loud);
    if (t - lastEmit > interval) { rings.push({ born: sec, seed: Math.random() * 100 }); lastEmit = t; }
    const wave = A.wave();
    const [r, g, b] = mixColor(S.green);
    // compact rings (≈60 px max), laid flat on the ground so they read correctly in 3D
    const life = 1.7, speed = lerp(14, 34, loud), amp = lerp(0.6, 3.2, loud);
    const ll = listener.lngLat, cosLat = Math.cos(ll.lat * Math.PI / 180);
    const mpp = 78271.517 * cosLat / Math.pow(2, map.getZoom());
    const pitched = map.getPitch() > 1;
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i], age = sec - ring.born;
      if (age > life) { rings.splice(i, 1); continue; }
      const R = 4 + age * speed, alpha = Math.pow(1 - age / life, 1.3) * 0.9;
      for (let pass = 0; pass < 2; pass++) {
        cx.beginPath();
        const N = 72, s = ring.seed + pass * 13.7;
        for (let k = 0; k <= N; k++) {
          const th = k / N * Math.PI * 2;
          let j = Math.sin(th * 5 + sec * 2.1 + s) * 0.5 + Math.sin(th * 11 - sec * 3.3 + s * 1.7) * 0.32 + Math.sin(th * 23 + s * 3.1) * 0.18;
          if (wave) j += wave[(k * 13 + Math.floor(age * 300)) % wave.length] * 5;
          const rr = R + j * amp * (0.6 + age * 0.4);
          let px = x + Math.cos(th) * rr, py = y + Math.sin(th) * rr;
          if (pitched) {
            const q = map.project([ll.lng + Math.cos(th) * rr * mpp / (111320 * cosLat), ll.lat + Math.sin(th) * rr * mpp / 110574]);
            px = q.x; py = q.y;
          }
          k ? cx.lineTo(px, py) : cx.moveTo(px, py);
        }
        cx.strokeStyle = `rgba(${r},${g},${b},${alpha * (pass ? 0.45 : 1)})`;
        cx.lineWidth = pass ? 0.7 : 1.1;
        cx.stroke();
      }
    }
    if (listener.mode === 'center') { // show a cross when the listener isn't under the cursor
      cx.strokeStyle = '#000'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(x - 10, y); cx.lineTo(x + 10, y); cx.moveTo(x, y - 10); cx.lineTo(x, y + 10); cx.stroke();
    }
    // leader-line tag (flips left near the panels)
    const flip = !isNarrow() && x > innerWidth - 330 * pfitNow() - 280;
    tag.classList.toggle('flip', flip);
    tag.style.transform = `translate(${flip ? x - tag.offsetWidth : x}px, ${y - 48}px)`;
    tag.classList.add('on');
  }

  /* ================================================================
     MAIN LOOP
     ================================================================ */
  function frame(t) {
    if (!inApp) tickProgress();
    if (mapReady && dirty && t - lastSample > 70) { dirty = false; lastSample = t; try { sample(); } catch (e) { console.warn(e); } }
    if (inApp) { animatePanels(t); drawWaves(t); }
    requestAnimationFrame(frame);
  }

  if (isNarrow()) { // phones: keep HEALTH folded so the map stays visible
    $('#healthPanel').classList.add('collapsed');
    $('#healthPanel .collapse').textContent = 'EXPAND';
  }
  addEventListener('resize', fit);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fit);
  fit();
  requestAnimationFrame(frame);
  go(0);
})();
