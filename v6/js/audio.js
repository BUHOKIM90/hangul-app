'use strict';
/* v6 audio: Web Audio playback of pre-decoded clips, trimmed by TRIM (silence/breath measured offline),
   onStart fires when the sound actually reaches the speaker, synthesized effects. */
(function (G) {
  const A = { ready: false, log: [] };
  const TRIM = G.TRIM || {};
  let ctx = null, master, voiceBus, sfxBus, musicBus, duck;
  const bufs = new Map(), pending = new Map(), voices = new Set();
  let gen = 0;
  const settings = { voice: 1, sfx: 0.6, music: 0.5 };
  /* Family recordings (IndexedDB, see rec.js) override studio clips with the same key; spans are measured on decode. */
  const custom = new Map(), customSpan = new Map();

  A.url = key => 'audio/' + key + '.mp3';
  A.ctx = () => ctx;

  A.init = function () {
    const AC = G.AudioContext || G.webkitAudioContext;
    if (!AC) return;
    /* Safari 16.4+: play even when the ring/silent switch is on. */
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      master = ctx.createGain(); master.connect(ctx.destination);
      voiceBus = ctx.createGain(); voiceBus.gain.value = settings.voice; voiceBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(master);
      /* music goes through `duck`, which drops while a voice speaks and comes back after */
      duck = ctx.createGain(); duck.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = settings.music * Math.min(1, settings.sfx * 1.6); musicBus.connect(duck);
      const kick = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
      ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, kick, true));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    }
    /* iOS unlock: a 1-sample silent buffer started inside the user gesture. */
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = b; s.connect(master); s.start(0);
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    A.ready = true;
  };
  A.setVolume = function (voice, sfx) {
    settings.voice = voice; settings.sfx = sfx;
    if (voiceBus) { voiceBus.gain.value = voice; sfxBus.gain.value = sfx; musicBus.gain.value = settings.music * Math.min(1, sfx * 1.6); }
  };

  function decode(ab) {
    return new Promise((res, rej) => {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }
  /* Speech span of a recording made at home: skip quiet lead-in/tail (threshold 4% of the peak). */
  function autoSpan(b) {
    const ch = b.getChannelData(0), n = ch.length;
    let peak = 0;
    for (let i = 0; i < n; i += 4) peak = Math.max(peak, Math.abs(ch[i]));
    const th = Math.max(0.01, peak * 0.04), win = Math.floor(b.sampleRate * 0.01);
    let a = 0, z = n - 1;
    while (a < n && Math.abs(ch[a]) < th) a += win;
    while (z > a && Math.abs(ch[z]) < th) z -= win;
    const pad = 0.06;
    /* home recordings differ in loudness: bring each to about the level of the app's clips (never clipping) */
    let sum = 0, cnt = 0;
    for (let i = a; i <= z; i += 2) { sum += ch[i] * ch[i]; cnt++; }
    const rms = Math.sqrt(sum / Math.max(1, cnt));
    customGain.set(b, Math.max(0.4, Math.min(5, 0.11 / Math.max(1e-4, rms), 0.98 / Math.max(1e-4, peak))));
    return [Math.max(0, a / b.sampleRate - pad), Math.min(b.duration, z / b.sampleRate + pad)];
  }
  const customGain = new WeakMap();
  A.setCustom = function (key, ab) {
    bufs.delete(key); customSpan.delete(key);
    if (ab) custom.set(key, ab); else custom.delete(key);
  };
  A.hasCustom = key => custom.has(key);
  A.decode = ab => (ctx ? decode(ab.slice(0)) : Promise.reject(new Error('no audio')));
  /* p_* instruction keys map to studio clips (data.js PROMPT_CLIP) unless a family recording exists for the key. */
  function realKey(key) {
    if (!key || custom.has(key)) return key;
    const D = G.D, m = D && D.PROMPT_CLIP && D.PROMPT_CLIP[key];
    return m ? m[0] : key;
  }
  A.realKey = realKey;
  A.load = function (key) {
    key = realKey(key);
    if (!key) return Promise.resolve(null);
    if (bufs.has(key)) return Promise.resolve(bufs.get(key));
    if (pending.has(key)) return pending.get(key);
    if (!ctx) return Promise.resolve(null);
    if (custom.has(key)) {
      const pc = decode(custom.get(key).slice(0)).then(b => { bufs.set(key, b); customSpan.set(key, autoSpan(b)); pending.delete(key); return b; })
        .catch(() => { pending.delete(key); custom.delete(key); return A.load(key); });
      pending.set(key, pc);
      return pc;
    }
    /* only clips the build found in audio/ (TRIM lists them) — no 404 round trips for spoken-only lines */
    if (!TRIM[key]) return Promise.resolve(null);
    const p = fetch(A.url(key)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(decode).then(b => { bufs.set(key, b); pending.delete(key); return b; })
      .catch(() => { pending.delete(key); A.log.push('missing ' + key); return null; });
    pending.set(key, p);
    return p;
  };
  A.preload = keys => Promise.all(Array.from(new Set(keys.filter(Boolean))).map(A.load));
  A.loaded = key => bufs.has(key);

  /* Time the speaker is playing now, in ctx time. Uses getOutputTimestamp when the browser has it,
     otherwise subtracts the reported output latency (Safari reports baseLatency). */
  function heardNow() {
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  }
  A.heardNow = () => (ctx ? heardNow() : 0);
  /* Call fn when the sample at ctx time `when` reaches the speaker. */
  function atHeard(when, fn, myGen) {
    let done = false;
    const fire = () => { if (!done) { done = true; if (myGen === undefined || myGen === gen) fn(); } };
    const tick = () => { if (done) return; if (heardNow() >= when - 0.004) fire(); else requestAnimationFrame(tick); };
    tick();
    /* Hidden tabs pause rAF; a timer keeps the light from getting stuck. */
    setTimeout(fire, Math.max(0, (when - ctx.currentTime + (ctx.outputLatency || ctx.baseLatency || 0)) * 1000) + 60);
  }
  A.atHeard = (when, fn) => atHeard(when, fn);

  function clipSpan(key, b) {
    if (customSpan.has(key)) { const [o, e] = customSpan.get(key); return [o, Math.max(0.05, e - o)]; }
    const t = custom.has(key) ? null : TRIM[key];
    let off = 0, end = b.duration;
    if (t) { off = Math.min(t[0], b.duration); end = Math.min(t[1], b.duration); }
    return [off, Math.max(0.05, end - off)];
  }
  A.dur = function (key) {
    const b = bufs.get(key);
    if (b) return clipSpan(key, b)[1];
    key = realKey(key);
    const t = TRIM[key];
    if (t && !custom.has(key)) return t[1] - t[0];
    return 0.8;
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* Play a clip. opt: at (ctx time), onStart(), keep (do not stop others). Resolves true when it ends. */
  A.play = async function (key, opt) {
    opt = opt || {};
    if (!opt.keep) A.stop();
    const myGen = gen;
    if (!ctx) { if (opt.onStart) opt.onStart(); return false; }
    key = realKey(key);
    const b = await A.load(key);
    if (myGen !== gen) return false;
    /* no recording: stay silent (never a synthetic voice) */
    if (!b) { if (opt.onStart) opt.onStart(); return false; }
    return playBuf(key, b, clipSpan(key, b), opt, myGen);
  };
  /* A decoded buffer that is not a named clip (the child's own recording). */
  A.playBuffer = function (b, opt) {
    opt = opt || {};
    if (!opt.keep) A.stop();
    if (!ctx || !b) return Promise.resolve(false);
    return playBuf('buffer', b, [0, b.duration], opt, gen);
  };
  function playBuf(key, b, span, opt, myGen) {
    const [off, dur] = span;
    const when = Math.max(opt.at || 0, ctx.currentTime + 0.012);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b;
    const fadeIn = 0.006, fadeOut = Math.min(0.025, dur / 4);
    const lvl = customGain.get(b) || 1;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(lvl, when + fadeIn);
    g.gain.setValueAtTime(lvl, when + dur - fadeOut);
    g.gain.linearRampToValueAtTime(0, when + dur);
    src.connect(g); g.connect(voiceBus);
    src.start(when, off, dur);
    const node = { src, g, when, end: when + dur };
    voices.add(node);
    if (!opt.sing) atHeard(when, () => { if (voices.has(node)) document.body.classList.add('talking'); }, myGen);
    if (!opt.sing) { duck.gain.cancelScheduledValues(when); duck.gain.setTargetAtTime(0.22, Math.max(ctx.currentTime, when - 0.05), 0.04); A.ducked = true; }
    if (opt.onStart) atHeard(when, () => opt.onStart(when), myGen);
    A.log.push({ key, when, dur });
    if (A.log.length > 200) A.log.splice(0, 100);
    return new Promise(res => {
      node.res = res;
      src.onended = () => { voices.delete(node); lastEnd = performance.now(); unduck(); res(myGen === gen); };
    });
  }
  function unduck() { if (!voices.size) document.body.classList.remove('talking'); if (ctx && !voices.size && A.ducked) { A.ducked = false; duck.gain.cancelScheduledValues(ctx.currentTime); duck.gain.setTargetAtTime(1, ctx.currentTime + 0.08, 0.22); } }
  A.say = (key, opt) => A.play(key, opt);
  A.stop = function () {
    gen++;
    voices.forEach(n => { try { n.src.onended = null; n.src.stop(); } catch (e) { /* already stopped */ } if (n.res) n.res(false); });
    voices.clear();
    unduck();
  };
  A.gen = () => gen;
  let lastEnd = 0;
  A.busy = () => voices.size > 0;
  A.lastVoiceEnd = () => lastEnd;
  A.now = () => (ctx ? ctx.currentTime : 0);

  /* Play clips one after another; onEach(i) fires when clip i is heard. gap in seconds. */
  A.sequence = async function (keys, onEach, gap) {
    A.stop();
    const myGen = gen;
    await A.preload(keys);
    if (myGen !== gen || !ctx) return false;
    const g = gap === undefined ? 0.12 : gap;
    keys = keys.map(realKey);
    if (keys.some(k => !bufs.has(k))) return oneByOne(keys, onEach, g, myGen);
    let t = ctx.currentTime + 0.05;
    const ps = keys.map((k, i) => {
      const p = A.play(k, { at: t, keep: true, onStart: () => onEach && onEach(i) });
      t += A.dur(k) + g;
      return p;
    });
    const r = await Promise.all(ps);
    return r.every(Boolean) && myGen === gen;
  };

  /* Some keys are spoken by the device voice: play strictly one after another. */
  async function oneByOne(keys, onEach, g, myGen) {
    for (let i = 0; i < keys.length; i++) {
      if (myGen !== gen) return false;
      await A.play(keys[i], { keep: true, onStart: () => onEach && onEach(i) });
      if (myGen !== gen) return false;
      await sleep(g * 1000);
    }
    return myGen === gen;
  }
  /* Letter song: clip i starts on beat i (the beat grows if a clip is longer), over a little tune:
     a melody note with every letter, bass on the strong beats, a soft chord after it, and a closing "짠". */
  const SONG_MEL = [[0, 2, 4, 2, 5, 4, 2, 0], [4, 2, 0, 2, 4, 4, 4, 2], [0, 0, 4, 4, 5, 5, 4, 2], [0, 2, 4, 7, 5, 4, 2, 4]];
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];   /* C pentatonic, two octaves */
  let songNo = 0;
  A.song = async function (keys, onEach, beat) {
    A.stop();
    const myGen = gen;
    await A.preload(keys);
    if (myGen !== gen || !ctx) return false;
    keys = keys.map(realKey);
    const mel = SONG_MEL[songNo++ % SONG_MEL.length];
    document.body.classList.add('singing');
    const endSong = () => document.body.classList.remove('singing');
    if (keys.some(k => !bufs.has(k))) return oneByOne(keys, (i) => { drum(ctx.currentTime + 0.003, i % 2 === 0); if (onEach) onEach(i); }, 0.15, myGen).then(r => { endSong(); return r; });
    let t = ctx.currentTime + 0.08;
    const ps = keys.map((k, i) => {
      const d = A.dur(k), step = Math.max(beat || 0.62, d + 0.1), f = SCALE[mel[i % mel.length]];
      drum(t, i % 2 === 0);
      mnote(f * 2, t, step * 0.8, 'triangle', 0.11);
      if (i % 2 === 0) mnote(f / 2, t, step * 1.6, 'sine', 0.16);
      else { mnote(SCALE[0] * 2, t + step * 0.5, 0.14, 'sine', 0.05); mnote(SCALE[2] * 2, t + step * 0.5, 0.14, 'sine', 0.05); }
      const p = A.play(k, { at: t, keep: true, sing: true, onStart: () => onEach && onEach(i) });
      t += step;
      return p;
    });
    [SCALE[3], SCALE[5]].forEach((f, i) => mnote(f * 2, t + i * 0.12, i ? 0.5 : 0.14, 'triangle', 0.12));
    mnote(SCALE[0], t + 0.12, 0.6, 'sine', 0.14);
    const r = await Promise.all(ps);
    endSong();
    return r.every(Boolean) && myGen === gen;
  };

  /* ---------- synthesized effects (no files, start within a few ms) ---------- */
  function env(t, a, d, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(sfxBus);
    return g;
  }
  function tone(f, t, d, type, peak, f2) {
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    o.connect(env(t, 0.005, d, peak || 0.3));
    o.start(t); o.stop(t + d + 0.05);
  }
  function noise(t, d, peak, hp) {
    const len = Math.floor(ctx.sampleRate * d), b = ctx.createBuffer(1, len, ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    s.buffer = b; f.type = 'highpass'; f.frequency.value = hp || 1000;
    s.connect(f); f.connect(env(t, 0.002, d, peak || 0.2)); s.start(t);
  }
  function drum(t, strong) {
    if (!ctx) return;
    tone(strong ? 150 : 220, t, 0.12, 'sine', strong ? 0.35 : 0.18, 60);
    noise(t, 0.04, strong ? 0.05 : 0.08, 4000);
  }
  const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };
  A.sfx = function (name) {
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const t = ctx.currentTime + 0.003;
    switch (name) {
      case 'correct': tone(N.G5, t, 0.12, 'triangle', 0.35); tone(N.C6, t + 0.08, 0.28, 'triangle', 0.35); break;
      case 'yay1': [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, t + i * 0.06, 0.16, 'triangle', 0.25)); break;
      case 'yay2': [N.G5, N.E6, N.C6, N.G6].forEach((f, i) => tone(f, t + i * 0.07, 0.15, 'sine', 0.25)); break;
      case 'yay3': tone(N.E5, t, 0.1, 'square', 0.08); tone(N.A5, t + 0.08, 0.1, 'square', 0.08); tone(N.E6, t + 0.16, 0.25, 'triangle', 0.25); break;
      case 'yay4': for (let i = 0; i < 6; i++) tone(1200 + i * 260, t + i * 0.035, 0.09, 'sine', 0.15); break;
      case 'wrong': tone(330, t, 0.18, 'sine', 0.2, 220); break;
      case 'pop': tone(600, t, 0.08, 'sine', 0.3, 1400); noise(t, 0.05, 0.12, 2000); break;
      case 'tap': tone(520, t, 0.07, 'sine', 0.22, 980); tone(1400, t + 0.025, 0.05, 'sine', 0.06); break;
      case 'open': tone(392, t, 0.12, 'sine', 0.16, 784); tone(1175, t + 0.08, 0.16, 'triangle', 0.1); break;
      case 'whoosh': noise(t, 0.25, 0.08, 600); break;
      case 'snap': tone(900, t, 0.05, 'square', 0.08); tone(1350, t + 0.04, 0.08, 'triangle', 0.2); break;
      case 'star': tone(N.E6, t, 0.08, 'sine', 0.18); tone(N.G6, t + 0.06, 0.14, 'sine', 0.18); break;
      case 'chest': for (let i = 0; i < 4; i++) noise(t + i * 0.09, 0.05, 0.12, 1500); break;
      case 'fanfare': [[N.C5, 0], [N.C5, 0.12], [N.C5, 0.24], [N.G5, 0.36], [N.E5, 0.6], [N.G5, 0.72], [N.C6, 0.84]]
        .forEach(([f, d], i) => tone(f, t + d, i === 6 ? 0.6 : 0.13, 'triangle', 0.3)); break;
      case 'sparkle': for (let i = 0; i < 8; i++) tone(N.C6 + Math.random() * 1200, t + i * 0.05, 0.12, 'sine', 0.1); break;
      case 'ink': tone(1800 + Math.random() * 600, t, 0.03, 'sine', 0.03); break;
      default: tone(800, t, 0.06, 'sine', 0.15);
    }
  };
  /* a soft musical note on the music bus (ducked under voices) */
  function mnote(f, t, d, type, peak) {
    if (!ctx || !f) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak || 0.1, t + 0.015);
    g.gain.exponentialRampToValueAtTime((peak || 0.1) * 0.5, t + d * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + d + 0.05);
  }
  /* Background music for the home screens: three gentle tunes (melody, bass, off-beat chord), scheduled on the audio clock.
     It keeps playing under voices but ducks (see playBuf). Never during learning plays. */
  const M = n => 440 * Math.pow(2, (n - 69) / 12);
  const TUNES = [
    { step: 0.3, mel: [72, 0, 76, 79, 0, 76, 72, 0, 74, 0, 77, 81, 0, 77, 74, 0, 76, 0, 79, 84, 0, 79, 76, 0, 77, 76, 74, 72, 0, 67, 72, 0], bass: [48, 53, 48, 55] },
    { step: 0.34, mel: [79, 76, 72, 0, 76, 79, 81, 0, 79, 76, 74, 0, 72, 74, 76, 0, 77, 74, 72, 0, 69, 72, 74, 0, 76, 74, 72, 0, 67, 0, 72, 0], bass: [48, 45, 53, 55] },
    { step: 0.28, mel: [67, 72, 76, 72, 79, 0, 76, 0, 65, 69, 72, 69, 77, 0, 72, 0, 67, 71, 74, 71, 79, 0, 74, 0, 72, 76, 79, 76, 84, 0, 0, 0], bass: [48, 53, 55, 48] }
  ];
  let bgmTimer = null, bgmOn = false;
  A.bgm = function (on, n) {
    clearInterval(bgmTimer); bgmTimer = null; bgmOn = false;
    if (!on || !ctx) return;
    const T = TUNES[(n === undefined ? Math.floor(Math.random() * TUNES.length) : n) % TUNES.length];
    let i = 0, next = ctx.currentTime + 0.3;
    bgmOn = true;
    const run = () => {
      if (!bgmOn || ctx.state !== 'running') { next = Math.max(next, ctx.currentTime + 0.1); return; }
      while (next < ctx.currentTime + 0.5) {
        const k = i % T.mel.length, m = T.mel[k];
        if (m) mnote(M(m), next, T.step * 1.7, 'triangle', 0.075);
        if (k % 8 === 0) mnote(M(T.bass[(k / 8) % T.bass.length]), next, T.step * 7, 'sine', 0.1);
        if (k % 4 === 2) { const r = T.bass[Math.floor(k / 8) % T.bass.length] + 12; [0, 4, 7].forEach(x => mnote(M(r + x), next, T.step * 1.2, 'sine', 0.028)); }
        next += T.step; i++;
      }
    };
    bgmTimer = setInterval(run, 120); run();
  };
  A.musicOn = () => bgmOn;
  A.drum = strong => { if (ctx) drum(ctx.currentTime + 0.003, strong); };

  G.A = A;
})(window);
