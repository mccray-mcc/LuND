/* LuND — location-driven sound engine.
   Three channels (① CITY, ② TRANSIT, ③ NATURE). Each mixes real London field recordings
   streamed from Wikimedia Commons with synthesized layers (traffic rumble, tyre hiss,
   car pass-bys, two-tone sirens, horns, wind in leaves). app.js calls update() with the
   listener's modelled levels; gains glide so walking through the city crossfades smoothly. */
window.LAudio = (function () {
  const WM = 'https://upload.wikimedia.org/wikipedia/commons/';
  const T = (hash, file) => `${WM}transcoded/${hash}/${file}/${file}.mp3`;

  // Real recordings. All London unless noted. Licences listed in the SOUND SOURCES panel.
  const REC = {
    street:     { ch: 'city', url: T('5/5d', 'Sunday_in_the_city_street_noise1.ogg'), title: 'Sunday in the city street noise', author: 'cori', lic: 'Public domain', where: 'English city street (not London)', page: 'File:Sunday_in_the_city_street_noise1.ogg' },
    bigben:     { ch: 'city', url: T('8/89', 'Big_Ben_recorded_in_1890.ogg'), title: 'Big Ben recorded in 1890', author: 'Miss Ferguson & Graham Hope', lic: 'Public domain', where: 'Westminster', page: 'File:Big_Ben_recorded_in_1890.ogg' },
    chinook:    { ch: 'city', loop: false, url: T('3/3c', 'Chinook_helicopter_flying_over_Greenwich_in_London.ogg'), title: 'Chinook helicopter flying over Greenwich', author: 'JoBrodie', lic: 'CC0', where: 'Greenwich', page: 'File:Chinook_helicopter_flying_over_Greenwich_in_London.ogg' },
    tube:       { ch: 'transit', url: T('5/54', 'London_Underground_1995_Stock_train_going_from_Old_Street_station_to_Angel_station.ogg'), title: 'Underground train, Old Street to Angel', author: 'Philt3r', lic: 'CC BY 4.0', where: 'Northern line', page: 'File:London_Underground_1995_Stock_train_going_from_Old_Street_station_to_Angel_station.ogg' },
    tubeIn:     { ch: 'transit', loop: false, url: T('a/a3', 'London_Underground_1996_Stock_train_arriving_in_a_station.ogg'), title: 'Underground train arriving in a station', author: 'Philt3r', lic: 'CC BY 4.0', where: 'Jubilee line', page: 'File:London_Underground_1996_Stock_train_arriving_in_a_station.ogg' },
    tubeOut:    { ch: 'transit', loop: false, url: T('c/cc', 'London_Underground_1996_Stock_train_departing_a_station.ogg'), title: 'Underground train departing a station', author: 'Philt3r', lic: 'CC BY 4.0', where: 'Jubilee line', page: 'File:London_Underground_1996_Stock_train_departing_a_station.ogg' },
    kingsx:     { ch: 'transit', loop: false, url: T('8/82', 'London_Underground_1995_Stock_train_departing_from_Kings_Cross_Saint_Pancras_station.ogg'), title: "Underground train departing King's Cross St Pancras", author: 'Philt3r', lic: 'CC BY 4.0', where: "King's Cross", page: 'File:London_Underground_1995_Stock_train_departing_from_Kings_Cross_Saint_Pancras_station.ogg' },
    pier:       { ch: 'nature', url: T('9/96', 'Squeaks_and_twangs_of_greenwich_pier.ogg'), title: 'Squeaks and twangs of Greenwich Pier', author: 'JoBrodie', lic: 'CC BY-SA 3.0', where: 'River Thames, Greenwich', page: 'File:Squeaks_and_twangs_of_greenwich_pier.ogg' },
    robin:      { ch: 'nature', bird: true, url: WM + '4/4c/Erithacus_rubecula_-_European_Robin_XC178578.mp3', title: 'European robin', author: 'Dan Stowell', lic: 'CC BY-SA 4.0', where: 'Woodford', page: 'File:Erithacus_rubecula_-_European_Robin_XC178578.mp3' },
    greenfinch: { ch: 'nature', bird: true, url: WM + '3/38/Chloris_chloris_-_European_Greenfinch_XC183761.mp3', title: 'European greenfinch', author: 'Dan Stowell', lic: 'CC BY-SA 4.0', where: 'Woodford', page: 'File:Chloris_chloris_-_European_Greenfinch_XC183761.mp3' },
    bluetit:    { ch: 'nature', bird: true, url: T('4/42', 'Cyanistes_caeruleus_-_Eurasian_Blue_Tit_XC131316.ogg'), title: 'Eurasian blue tit', author: 'Dan Stowell', lic: 'CC BY-SA 3.0', where: 'Woodford', page: 'File:Cyanistes_caeruleus_-_Eurasian_Blue_Tit_XC131316.ogg' },
    chiffchaff: { ch: 'nature', bird: true, url: T('3/3e', 'Phylloscopus_collybita_-_Common_Chiffchaff_XC132316.ogg'), title: 'Common chiffchaff', author: 'Dan Stowell', lic: 'CC BY-SA 3.0', where: 'Epping Forest', page: 'File:Phylloscopus_collybita_-_Common_Chiffchaff_XC132316.ogg' },
    redstart:   { ch: 'nature', bird: true, url: T('9/91', 'Black_Redstart_%28Phoenicurus_ochruros%29_%28W1CDR0000253_BD17%29.ogg'), title: 'Black redstart', author: 'British Library', lic: 'CC BY 4.0', where: 'London', page: 'File:Black_Redstart_(Phoenicurus_ochruros)_(W1CDR0000253_BD17).ogg' },
    crow:       { ch: 'nature', bird: true, url: WM + '7/7a/Corvus_corone_-_Carrion_Crow_XC147235.mp3', title: 'Carrion crow', author: 'Harry Rutherford', lic: 'CC BY-SA 3.0', where: 'Bromley', page: 'File:Corvus_corone_-_Carrion_Crow_XC147235.mp3' },
    cow:        { ch: 'nature', loop: false, url: T('4/48', 'Mudchute_cow_1.ogg'), title: 'Mudchute cow', author: 'Secretlondon', lic: 'CC BY-SA 3.0', where: 'Mudchute City Farm', page: 'File:Mudchute_cow_1.ogg' },
    rain:       { ch: 'weather', url: T('7/73', 'Rain_and_wind_in_London_2026_08_28.wav'), title: 'Rain and wind in London', author: 'Acabashi', lic: 'CC BY-SA 4.0', where: 'London', page: 'File:Rain_and_wind_in_London_2026_08_28.wav' },
  };

  let ctx = null, master, masterAn, weather;
  const ch = {};
  const layers = {};
  const shots = {};
  const noise = {};
  let enabled = false, rainOn = false;
  let p = { db: 55, road: 50, rail: 0, tube: 0, station: 0, air: 0, green: 0, water: 0, bigben: 0, cow: 0 };
  const last = { siren: -1e9, horn: -1e9, chinook: -1e9, tube: -1e9, cow: -1e9, train: -1e9, jet: -1e9 };
  const lerpJet = a => 70 - 50 * a; // seconds between landings: ~20 s right under the approach
  const birdPhase = {};
  let testEl = null;

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  function unlock() {
    if (!ctx) build();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.02; comp.release.value = 0.35;
    master = ctx.createGain(); master.gain.value = 0;
    masterAn = ctx.createAnalyser(); masterAn.fftSize = 1024; masterAn.smoothingTimeConstant = 0.78;
    master.connect(comp); comp.connect(masterAn); masterAn.connect(ctx.destination);

    for (const name of ['city', 'transit', 'nature']) {
      const g = ctx.createGain(); g.gain.value = 0;
      const sw = ctx.createGain(); sw.gain.value = 1;
      const an = ctx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.5;
      g.connect(sw); sw.connect(an); an.connect(master);
      ch[name] = { g, sw, an, on: true, buf: new Float32Array(512) };
    }
    weather = ctx.createGain(); weather.gain.value = 0; weather.connect(master);

    noise.white = makeNoise('white'); noise.pink = makeNoise('pink'); noise.brown = makeNoise('brown');

    layers.rumble = synthBed(noise.brown, 'city', [['lowpass', 160, 0.7]]);
    layers.hiss = synthBed(noise.pink, 'city', [['bandpass', 900, 0.45], ['lowpass', 3200, 0.5]]);
    layers.leaves = synthBed(noise.pink, 'nature', [['bandpass', 2400, 0.8]], 0.11);

    for (const [name, r] of Object.entries(REC)) {
      if (r.loop === false) continue;
      layers[name] = recLayer(r);
      if (r.bird) birdPhase[name] = { w: 0.6 + Math.random() * 0.9, ph: Math.random() * 6.28 };
    }
    setInterval(tick, 200);
  }

  function makeNoise(kind) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, lastOut = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.5;
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { lastOut = (lastOut + 0.02 * w) / 1.02; d[i] = lastOut * 3.5; }
      }
    }
    return buf;
  }

  function synthBed(buf, chan, filters, lfoHz) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    let node = src;
    for (const [type, f, q] of filters) {
      const bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q;
      node.connect(bq); node = bq;
    }
    const g = ctx.createGain(); g.gain.value = 0;
    if (lfoHz) {
      const sway = ctx.createGain(); sway.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = lfoHz;
      const depth = ctx.createGain(); depth.gain.value = 0.4;
      lfo.connect(depth); depth.connect(sway.gain); lfo.start();
      node.connect(sway); sway.connect(g);
    } else node.connect(g);
    g.connect(ch[chan].g);
    src.start(0, Math.random() * 3);
    return { g, target: 0 };
  }

  function mediaEl(r, loop) {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.loop = loop; el.preload = 'none'; el.src = r.url;
    return el;
  }

  function recLayer(r) {
    const el = mediaEl(r, true);
    const g = ctx.createGain(); g.gain.value = 0;
    ctx.createMediaElementSource(el).connect(g);
    g.connect(r.ch === 'weather' ? weather : ch[r.ch].g);
    const L = { g, el, target: 0, quietAt: 0, failed: false, seeded: false };
    el.addEventListener('error', () => { L.failed = true; });
    el.addEventListener('loadedmetadata', () => {
      if (!L.seeded && isFinite(el.duration)) { L.seeded = true; el.currentTime = Math.random() * el.duration * 0.85; }
    });
    return L;
  }

  function shot(name, gain) {
    const r = REC[name];
    if (!shots[name]) {
      const el = mediaEl(r, false);
      el.preload = 'auto';
      const g = ctx.createGain();
      ctx.createMediaElementSource(el).connect(g);
      g.connect(ch[r.ch].g);
      shots[name] = { el, g };
    }
    const s = shots[name];
    s.g.gain.value = gain;
    try { s.el.currentTime = 0; } catch (e) { /* not loaded yet */ }
    s.el.play().catch(() => {});
  }

  // ---------- synthesized events ----------
  function passby(heavy) {
    const t = ctx.currentTime + 0.02;
    const dur = heavy ? 4.5 + Math.random() * 2 : 2 + Math.random() * 1.8;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const src = ctx.createBufferSource(); src.buffer = heavy ? noise.brown : noise.pink; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    const f0 = heavy ? 220 : 520;
    bp.frequency.setValueAtTime(f0 * 0.7, t);
    bp.frequency.linearRampToValueAtTime(f0 * 1.5, t + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(f0 * 0.6, t + dur);
    const g = ctx.createGain();
    const peak = (heavy ? 0.9 : 0.55) * (0.5 + Math.random() * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.85 * dir, t); pan.pan.linearRampToValueAtTime(0.85 * dir, t + dur);
      g.connect(pan); out = pan;
    }
    src.connect(bp); bp.connect(g); out.connect(ch.city.g);
    if (heavy) { // diesel engine body: a London bus or lorry
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(48, t); o.frequency.linearRampToValueAtTime(58, t + dur * 0.5); o.frequency.linearRampToValueAtTime(44, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
      const og = ctx.createGain(); og.gain.value = 0.22;
      o.connect(lp); lp.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.1);
    }
    src.start(t, Math.random() * 3); src.stop(t + dur + 0.1);
  }

  function siren() { // UK two-tone, Doppler shifted as it passes
    const t = ctx.currentTime + 0.05, dur = 9 + Math.random() * 4, step = 0.62;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    for (let k = 0; k * step < dur; k++) {
      const dop = 1.035 - 0.07 * (k * step / dur);
      o.frequency.setValueAtTime((k % 2 ? 640 : 820) * dop, t + k * step);
    }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2600, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(800, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(ch.city.g);
    o.start(t); o.stop(t + dur + 0.1);
  }

  function horn() {
    const t = ctx.currentTime + 0.02;
    const n = Math.random() < 0.35 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const s = t + k * 0.32, d = 0.16 + Math.random() * 0.3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.08, s + 0.02); g.gain.setValueAtTime(0.08, s + d); g.gain.exponentialRampToValueAtTime(0.0001, s + d + 0.06);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
      for (const f of [405, 510]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(lp); o.start(s); o.stop(s + d + 0.1); }
      lp.connect(g); g.connect(ch.city.g);
    }
  }

  function trainPass() { // overground / national rail passing nearby
    const t = ctx.currentTime + 0.05, dur = 7 + Math.random() * 4;
    const src = ctx.createBufferSource(); src.buffer = noise.brown; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); lp.connect(g); g.connect(ch.transit.g);
    src.start(t); src.stop(t + dur + 0.1);
    for (let c = t + 0.6; c < t + dur - 0.6; c += 0.55 + Math.random() * 0.1) { // wheel clack over rail joints
      const cs = ctx.createBufferSource(); cs.buffer = noise.white;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
      const cg = ctx.createGain(); const env = Math.sin(Math.PI * (c - t) / dur);
      cg.gain.setValueAtTime(0.0001, c); cg.gain.exponentialRampToValueAtTime(0.25 * env + 0.001, c + 0.005); cg.gain.exponentialRampToValueAtTime(0.0001, c + 0.07);
      cs.connect(bp); bp.connect(cg); cg.connect(ch.transit.g);
      cs.start(c, Math.random()); cs.stop(c + 0.09);
    }
  }

  function jet(level) { // aircraft on approach: a long filtered roar sweeping overhead
    const t = ctx.currentTime + 0.05, dur = 14 + Math.random() * 6;
    const src = ctx.createBufferSource(); src.buffer = noise.pink; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.5;
    bp.frequency.setValueAtTime(260, t); bp.frequency.linearRampToValueAtTime(900, t + dur * 0.45); bp.frequency.linearRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * level + 0.05, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(ch.city.g);
    src.start(t); src.stop(t + dur + 0.1);
  }

  function chirp() { // fallback birds if recordings can't stream
    const t = ctx.currentTime + 0.02, n = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1800;
    for (let k = 0; k < n; k++) {
      const s = t + k * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.05, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
      o.connect(g); g.connect(ch.nature.g); o.start(s); o.stop(s + 0.1);
    }
  }

  // ---------- mixing ----------
  function glide(param, v, tc = 0.35) { param.setTargetAtTime(v, ctx.currentTime, tc); }

  function mix() {
    if (!ctx) return;
    const city = clamp((p.road - 44) / 34);
    const transit = clamp(Math.max(p.rail, p.tube * 0.85, p.station * 0.6));
    const nature = clamp(p.green * 1.15 + 0.05) * (1 - 0.6 * city) + (p.db < 50 ? 0.15 : 0);
    const loud = clamp((p.db - 38) / 44);

    glide(master.gain, enabled ? (0.42 + 0.58 * loud) * 0.95 : 0, 0.25);
    glide(ch.city.g.gain, Math.pow(city, 1.1));
    glide(ch.transit.g.gain, transit);
    glide(ch.nature.g.gain, clamp(nature));
    glide(weather.gain, rainOn ? 0.55 : 0, 0.6);

    layers.rumble.target = 0.35 + 0.65 * city;
    layers.hiss.target = 0.15 + 0.7 * city * city;
    layers.street.target = 0.7;
    layers.bigben.target = p.bigben * 1.4;
    layers.tube.target = clamp(Math.max(p.tube, p.rail * 0.5));
    layers.leaves.target = 0.15 + 0.55 * p.green;
    layers.pier.target = p.water * 0.9;
    layers.rain.target = rainOn ? 1 : 0;
    const now = performance.now() / 1000;
    for (const name in birdPhase) {
      const b = birdPhase[name];
      const w = 0.5 + 0.5 * Math.sin(now * (6.28 / 70) * b.w + b.ph); // each bird drifts in and out
      layers[name].target = clamp(w * 1.3 - 0.3) * 0.75;
    }
    for (const name in layers) {
      const L = layers[name];
      glide(L.g.gain, L.target, 0.5);
      if (!L.el) continue;
      const audible = enabled && L.target > 0.01 && !L.failed;
      if (audible) {
        L.quietAt = 0;
        if (L.el.paused) L.el.play().catch(() => {});
      } else if (!L.el.paused) {
        if (!L.quietAt) L.quietAt = now;
        if (now - L.quietAt > 4) L.el.pause();
      }
    }
  }

  function tick() {
    if (!ctx || !enabled || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const city = clamp((p.road - 44) / 34);
    if (ch.city.on) {
      if (Math.random() < Math.pow(city, 1.6) * 0.32) passby(Math.random() < 0.18);
      if (city > 0.55 && now - last.horn > 6 && Math.random() < 0.012 * city) { horn(); last.horn = now; }
      if (p.db > 66 && now - last.siren > 28 && Math.random() < 0.004 * (p.db - 64)) { siren(); last.siren = now; }
      if (p.db > 63 && now - last.chinook > 150 && Math.random() < 0.0015) { shot('chinook', 0.5); last.chinook = now; }
      if (p.air > 0.15 && now - last.jet > lerpJet(p.air) && Math.random() < 0.05) { jet(p.air); last.jet = now; }
    }
    if (ch.transit.on) {
      if (p.station > 0.3 && now - last.tube > 22 && Math.random() < 0.035) {
        const pick = ['tubeIn', 'tubeOut', 'kingsx'][Math.floor(Math.random() * 3)];
        shot(pick, 0.5 + 0.4 * p.station); last.tube = now;
      }
      if (p.rail > 0.35 && now - last.train > 16 && Math.random() < 0.03 * p.rail) { trainPass(); last.train = now; }
    }
    if (ch.nature.on) {
      if (p.cow > 0 && now - last.cow > 7 && Math.random() < 0.1) { shot('cow', 0.7 * p.cow); last.cow = now; }
      const birdsDown = Object.keys(birdPhase).every(n => layers[n].failed);
      if (birdsDown && Math.random() < p.green * 0.25) chirp();
    }
  }

  // ---------- public ----------
  function update(next) { Object.assign(p, next); mix(); }

  function setEnabled(on) {
    enabled = !!on;
    if (enabled) unlock();
    mix();
  }

  function setChannel(name, on) {
    if (!ch[name]) return;
    ch[name].on = on;
    glide(ch[name].sw.gain, on ? 1 : 0, 0.15);
  }

  function setRain(on) { rainOn = on; if (on) unlock(); mix(); }

  function rms(an, buf) {
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  function levels() {
    if (!ctx || !enabled) return null;
    const o = {};
    for (const n in ch) o[n] = ch[n].on ? clamp(Math.pow(rms(ch[n].an, ch[n].buf) * 4, 0.6)) : 0;
    return o;
  }

  const specBuf = new Uint8Array(512);
  function spectrum(bars) {
    const out = new Array(bars).fill(0);
    if (!ctx || !enabled) return out;
    masterAn.getByteFrequencyData(specBuf);
    const n = masterAn.frequencyBinCount, nyq = ctx.sampleRate / 2;
    for (let i = 0; i < bars; i++) { // log-spaced 40 Hz – 12 kHz
      const f0 = 40 * Math.pow(300, i / bars), f1 = 40 * Math.pow(300, (i + 1) / bars);
      const a = Math.max(1, Math.floor(f0 / nyq * n)), b = Math.max(a + 1, Math.floor(f1 / nyq * n));
      let m = 0; for (let k = a; k < b && k < n; k++) m = Math.max(m, specBuf[k]);
      out[i] = m / 255;
    }
    return out;
  }

  const waveBuf = new Float32Array(1024);
  function wave() {
    if (!ctx || !enabled) return null;
    masterAn.getFloatTimeDomainData(waveBuf);
    return waveBuf;
  }

  function test(on) { // Scene 2 audio test: the project's own sound (Audio_1.wav)
    unlock();
    if (!testEl) { testEl = new Audio('audio/Audio_1.wav'); testEl.loop = true; }
    if (on) { testEl.currentTime = 0; testEl.play().catch(() => {}); } else testEl.pause();
  }

  return {
    REC, unlock, update, setEnabled, setChannel, setRain, levels, spectrum, wave, test,
    get enabled() { return enabled; },
    get channels() { return { city: ch.city ? ch.city.on : true, transit: ch.transit ? ch.transit.on : true, nature: ch.nature ? ch.nature.on : true }; },
  };
})();
