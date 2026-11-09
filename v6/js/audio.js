'use strict';
/* v6 audio: Web Audio playback of pre-decoded clips, trimmed by TRIM (silence/breath measured offline),
   onStart fires when the sound actually reaches the speaker, synthesized effects. */
(function (G) {
  const A = { ready: false, log: [] };
  const TRIM = G.TRIM || {};
  let ctx = null, master, voiceBus, sfxBus;
  const bufs = new Map(), pending = new Map(), voices = new Set();
  let gen = 0;
  const settings = { voice: 1, sfx: 0.6 };

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
    if (voiceBus) { voiceBus.gain.value = voice; sfxBus.gain.value = sfx; }
  };

  function decode(ab) {
    return new Promise((res, rej) => {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }
  A.load = function (key) {
    if (!key) return Promise.resolve(null);
    if (bufs.has(key)) return Promise.resolve(bufs.get(key));
    if (pending.has(key)) return pending.get(key);
    if (!ctx) return Promise.resolve(null);
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
    const t = TRIM[key];
    let off = 0, end = b.duration;
    if (t) { off = Math.min(t[0], b.duration); end = Math.min(t[1], b.duration); }
    return [off, Math.max(0.05, end - off)];
  }
  A.dur = function (key) {
    const b = bufs.get(key);
    if (b) return clipSpan(key, b)[1];
    const t = TRIM[key];
    return t ? t[1] - t[0] : 0.8;
  };

  /* Play a clip. opt: at (ctx time), onStart(), keep (do not stop others). Resolves true when it ends. */
  A.play = async function (key, opt) {
    opt = opt || {};
    if (!opt.keep) A.stop();
    const myGen = gen;
    if (!ctx) { if (opt.onStart) opt.onStart(); return false; }
    const b = await A.load(key);
    if (myGen !== gen) return false;
    if (!b) { if (opt.onStart) opt.onStart(); return false; }
    const [off, dur] = clipSpan(key, b);
    const when = Math.max(opt.at || 0, ctx.currentTime + 0.012);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b;
    const fadeIn = 0.006, fadeOut = Math.min(0.025, dur / 4);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(1, when + fadeIn);
    g.gain.setValueAtTime(1, when + dur - fadeOut);
    g.gain.linearRampToValueAtTime(0, when + dur);
    src.connect(g); g.connect(voiceBus);
    src.start(when, off, dur);
    const node = { src, g, when, end: when + dur };
    voices.add(node);
    if (opt.onStart) atHeard(when, () => opt.onStart(when), myGen);
    A.log.push({ key, when, dur });
    if (A.log.length > 200) A.log.splice(0, 100);
    return new Promise(res => {
      node.res = res;
      src.onended = () => { voices.delete(node); lastEnd = performance.now(); res(myGen === gen); };
    });
  };
  A.say = (key, opt) => A.play(key, opt);
  A.stop = function () {
    gen++;
    voices.forEach(n => { try { n.src.onended = null; n.src.stop(); } catch (e) { /* already stopped */ } if (n.res) n.res(false); });
    voices.clear();
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
    let t = ctx.currentTime + 0.05;
    const g = gap === undefined ? 0.12 : gap;
    const ps = keys.map((k, i) => {
      const p = A.play(k, { at: t, keep: true, onStart: () => onEach && onEach(i) });
      t += A.dur(k) + g;
      return p;
    });
    const r = await Promise.all(ps);
    return r.every(Boolean) && myGen === gen;
  };

  /* Beat song: clip i starts on beat i (beat grows if a clip is longer). Drum on each beat. */
  A.song = async function (keys, onEach, beat) {
    A.stop();
    const myGen = gen;
    await A.preload(keys);
    if (myGen !== gen || !ctx) return false;
    let t = ctx.currentTime + 0.08;
    const ps = keys.map((k, i) => {
      const d = A.dur(k);
      drum(t, i % 2 === 0);
      const p = A.play(k, { at: t, keep: true, onStart: () => onEach && onEach(i) });
      t += Math.max(beat || 0.62, d + 0.1);
      return p;
    });
    const r = await Promise.all(ps);
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
  /* Soft background tune for home screens only (never during learning plays). */
  let bgmTimer = null, bgmStep = 0;
  const TUNE = [N.C5, N.E5, N.G5, N.E5, N.A5, N.G5, N.E5, N.D5, N.C5, N.E5, N.G5, N.C6, N.A5, N.G5, N.E5, 0];
  A.bgm = function (on) {
    clearInterval(bgmTimer); bgmTimer = null;
    if (!on || !ctx) return;
    bgmTimer = setInterval(() => {
      if (ctx.state !== 'running' || voices.size) return;
      const f = TUNE[bgmStep++ % TUNE.length], t = ctx.currentTime + 0.02;
      if (f) { tone(f, t, 0.32, 'sine', 0.045); if (bgmStep % 4 === 1) tone(f / 2, t, 0.5, 'triangle', 0.03); }
    }, 360);
  };
  A.drum = strong => { if (ctx) drum(ctx.currentTime + 0.003, strong); };

  G.A = A;
})(window);
