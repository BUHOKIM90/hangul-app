'use strict';
/* State, voice queue, pointer layer, dress-up, praise. */
(function () {
  const KEY = 'hangul-v5';
  const C = () => window.V5C;
  function fresh() {
    return {
      v: 5, scoreV: 2, sound: true, colorHints: true, difficulty: 'mid',
      ms: 0, today: '', todayMs: 0, done: {}, skill: {}, last: null,
      stickers: [], unlocks: [], wear: {}, who: 'monggeul', freshItem: '', soloN: 0
    };
  }
  let S = fresh();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && o.v === 5) {
        const keepBoxes = o.scoreV === 2;
        S = Object.assign(fresh(), o);
        if (!keepBoxes) deflateScores();
      }
    } catch (e) { S = fresh(); }
    const day = stamp();
    if (S.today !== day) { S.today = day; S.todayMs = 0; }
  }
  function stamp() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function reset() {
    const keep = { sound: S.sound, colorHints: S.colorHints, difficulty: S.difficulty };
    S = fresh();
    Object.assign(S, keep);
    ensureStarters();
    save();
  }

  /* ---------- voice ---------- */
  const SILENT = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  const player = new Audio();
  let unlocked = false, q = [], playing = false, gen = 0;
  /* have.js / lines.js use top-level const. That is a global lexical binding, not a window property. */
  function hasAudio() { return typeof HAVE_AUDIO !== 'undefined'; }
  function hasLines() { return typeof LINES !== 'undefined'; }
  /* Caption = what the clip really says. V5C.CAPTION corrects lines.js where the recording differs. */
  function lineOf(key) {
    const fix = C() && C().CAPTION;
    if (fix && Object.prototype.hasOwnProperty.call(fix, key)) return fix[key];
    if (key === 'w_i_tooth') key = 'sy_C774';
    if (hasLines() && LINES[key]) return LINES[key];
    const row = C() && C().PRAISE && C().PRAISE.find(p => p[1] === key);
    return row ? row[0] : '';
  }
  function showLine(text) {
    const live = document.getElementById('live');
    if (live && text) live.textContent = text;
    const b = document.getElementById('bubble');
    if (b && text) {
      b.classList.remove('praise-line');
      b.textContent = text;
    }
  }
  /* One <audio>. A job owns the player until it ends, errors, times out or is stopped.
     dropQueue() stops the clip now, so a new screen never waits behind an old line. */
  let cur = null, runId = 0, lastVoice = 0;
  player.preload = 'auto';
  player.addEventListener('ended', () => { if (cur) cur.finish(); });
  player.addEventListener('error', () => { if (cur && (player.src || '').indexOf('data:') !== 0) cur.finish(); });
  player.addEventListener('loadedmetadata', () => { if (cur) cur.arm(); });
  function fileKey(key) {
    if (key === 'w_i_tooth') return 'sy_C774';
    return key;
  }
  function canPlay(key) {
    return !!(key && S.sound && hasAudio() && HAVE_AUDIO.has(fileKey(key)));
  }
  function playKey(key, g) {
    return new Promise(resolve => {
      if (g !== gen) return resolve();
      key = fileKey(key);
      if (!canPlay(key)) return resolve();
      let over = false, timer = 0;
      const job = {
        key,
        finish() {
          if (over) return;
          over = true;
          clearTimeout(timer);
          if (cur === job) { cur = null; document.documentElement.dataset.speaking = '0'; }
          resolve();
        },
        arm() {
          if (over) return;
          const d = player.duration;
          clearTimeout(timer);
          timer = setTimeout(job.finish, d && isFinite(d) ? Math.min(15000, d * 1000 + 1200) : 9000);
        }
      };
      cur = job;
      document.documentElement.dataset.speaking = '1';
      timer = setTimeout(job.finish, 9000);
      player.src = 'audio/' + key + '.mp3';
      let p;
      try { p = player.play(); } catch (e) { job.finish(); return; }
      if (p && p.then) p.then(() => { unlocked = true; }).catch(() => job.finish());
      else unlocked = true;
    });
  }
  function stopNow() {
    const c = cur;
    cur = null;
    if (c) c.finish();
    try { if (!player.paused) player.pause(); } catch (e) { /* ignore */ }
  }
  function caption(job) {
    if (!job.text) return;
    if (!job.keepBubble) showLine(job.text);
    else {
      const live = document.getElementById('live');
      if (live) live.textContent = job.text;
    }
  }
  function run(job) {
    playing = true;
    const me = ++runId;
    /* The caption appears when its line starts, never ahead of a line still speaking. */
    if (job.g === gen) caption(job);
    playKey(job.key, job.g).then(() => {
      lastVoice = performance.now();
      if (me !== runId) return;
      playing = false;
      pump();
    });
  }
  function pump() {
    if (playing) return;
    const job = q.shift();
    if (!job) return;
    run(job);
  }
  /* opts.now: cut whatever is speaking and say this at once (tap feedback, new prompt).
     opts.keepBubble: caption goes to the live region only (bubble already shows it). */
  function say(key, text, opts) {
    opts = opts || {};
    if (opts.now) dropQueue();
    const job = { key, g: gen, text: text || lineOf(key), keepBubble: !!opts.keepBubble };
    if (!playing && !q.length) run(job);
    else q.push(job);
  }
  function dropQueue() {
    gen++;
    q = [];
    runId++;
    playing = false;
    stopNow();
  }
  function busy() { return playing || q.length > 0; }
  /* Say several lines in order. Each row: [key, caption?]. First row may cut (opts.now). */
  function sayAll(rows, opts) {
    rows.filter(Boolean).forEach((r, i) => say(r[0], r[1] || '', Object.assign({}, opts || {}, { now: i === 0 && opts && opts.now, keepBubble: r[2] === 'keep' || (opts && opts.keepBubble) })));
  }

  /* ---------- idle guide ----------
     When a child does nothing for ~6 s after the voice stops, say the instruction again and
     show a hand doing the action. After three repeats it says "천천히 해도 돼" once and rests. */
  let idleSpec = null, idleAt = 0, idleN = 0, idleTimer = 0, lastTouch = 0;
  function setIdle(spec) {
    idleSpec = spec || null;
    idleN = 0;
    idleAt = performance.now();
    hideHand();
  }
  function touched() {
    lastTouch = performance.now();
    hideHand();
  }
  function idleTick() {
    if (!idleSpec || document.hidden) return;
    const gate = document.getElementById('gate'), parent = document.getElementById('parent');
    if ((gate && !gate.hidden) || (parent && !parent.hidden)) return;
    if (busy()) return;
    const now = performance.now();
    const quiet = now - Math.max(lastVoice, lastTouch, idleAt);
    const wait = (idleSpec.delay || 6000) + idleN * 2500;
    if (quiet < wait) return;
    if (idleN >= 3) {
      if (idleN === 3 && canPlay(C().UI.slow)) say(C().UI.slow, '', { keepBubble: true });
      idleN += 1;
      if (idleN > 3) { idleAt = now + 60000; idleN = 0; }
      return;
    }
    idleN += 1;
    idleAt = now;
    try { idleSpec.run(idleN); } catch (e) { /* ignore */ }
  }
  function startIdle() {
    if (idleTimer) return;
    idleTimer = setInterval(idleTick, 400);
  }
  /* hand pointer */
  function handEl() {
    let h = document.getElementById('hand');
    if (!h) {
      h = document.createElement('div');
      h.id = 'hand';
      h.setAttribute('aria-hidden', 'true');
      h.innerHTML = '<img alt="" src="assets/icons/hand.svg"><i></i>';
      document.body.appendChild(h);
    }
    return h;
  }
  function hideHand() {
    const h = document.getElementById('hand');
    if (h) { h.className = ''; h.style.display = 'none'; if (h._anim) { h._anim.cancel(); h._anim = null; } }
  }
  function showHand(el, mode) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const h = handEl();
    h.style.display = 'block';
    h.style.left = (r.left + r.width / 2) + 'px';
    h.style.top = (r.top + r.height * 0.55) + 'px';
    h.className = 'is-' + (mode || 'tap');
    clearTimeout(h._t);
    h._t = setTimeout(hideHand, 3600);
  }
  /* drag demo along client-space points */
  function dragHand(pts, ms) {
    if (!pts || pts.length < 2) return;
    const h = handEl();
    h.style.display = 'block';
    h.style.left = '0px';
    h.style.top = '0px';
    h.className = 'is-drag';
    if (h._anim) h._anim.cancel();
    const frames = pts.map(p => ({ transform: 'translate(' + p[0] + 'px,' + p[1] + 'px)' }));
    try {
      h._anim = h.animate(frames, { duration: ms || 1800, iterations: 2, easing: 'ease-in-out' });
      h._anim.onfinish = hideHand;
    } catch (e) { hideHand(); }
  }
  function unlock() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
    } catch (e) { /* ignore */ }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        if (!unlock.ctx) unlock.ctx = new Ctx();
        if (unlock.ctx.state !== 'running') unlock.ctx.resume().catch(() => {});
      }
    } catch (e) { /* ignore */ }
    /* Never touch the player while a line owns it: replaying its clip was the "아, 아" bug. */
    if (unlocked || playing || cur) return;
    try {
      player.src = SILENT;
      const p = player.play();
      if (p && p.then) p.then(() => { if (!cur) unlocked = true; }).catch(() => {});
      else unlocked = true;
    } catch (e) { /* ignore */ }
  }
  function syncSound() {
    const b = document.getElementById('soundBtn');
    if (!b) return;
    const on = !!S.sound;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? '소리 켜짐' : '소리 꺼짐');
    if (!b.querySelector('img')) b.innerHTML = '<img alt="" src="assets/icons/speaker.svg">';
  }
  let tapCtx = null;
  function armTap() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!tapCtx) tapCtx = new Ctx();
    if (tapCtx.state === 'suspended') tapCtx.resume();
  }
  function playTap() {
    if (!S.sound || !tapCtx) return;
    try {
      const t = tapCtx.currentTime;
      const o = tapCtx.createOscillator();
      const g = tapCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(720, t);
      o.frequency.exponentialRampToValueAtTime(440, t + 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g);
      g.connect(tapCtx.destination);
      o.start(t);
      o.stop(t + 0.08);
    } catch (e) { /* ignore */ }
  }

  /* Small rising ding for a finished stroke / step. Not speech, never blocks the voice queue. */
  function chime(step) {
    if (!S.sound) return;
    armTap();
    if (!tapCtx) return;
    try {
      const t = tapCtx.currentTime;
      const base = [523, 659, 784, 1047][Math.max(0, (step || 1) - 1) % 4];
      [0, 0.09].forEach((dt, i) => {
        const o = tapCtx.createOscillator();
        const g = tapCtx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(base * (i ? 1.5 : 1), t + dt);
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.06, t + dt + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.22);
        o.connect(g);
        g.connect(tapCtx.destination);
        o.start(t + dt);
        o.stop(t + dt + 0.25);
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------- pointer ---------- */
  let press = null;
  function installPointer() {
    const down = e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const gate = document.getElementById('gate');
      const parent = document.getElementById('parent');
      const modalOn = (gate && !gate.hidden) || (parent && !parent.hidden);
      if (modalOn && e.target.closest && e.target.closest('#app')) return;
      unlock();
      armTap();
      touched();
      const el = e.target.closest && e.target.closest('[data-tap]');
      if (!el || el.closest('[hidden]')) return;
      if (press) return;
      press = { id: e.pointerId, el };
      el.classList.add('is-pressed');
    };
    const up = e => {
      if (!press || e.pointerId !== press.id) return;
      const el = press.el;
      el.classList.remove('is-pressed');
      press = null;
      const r = el.getBoundingClientRect();
      const tol = 12;
      const x = e.clientX, y = e.clientY;
      const inside = x >= r.left - tol && x <= r.right + tol && y >= r.top - tol && y <= r.bottom + tol;
      if (!inside) { unlock(); return; }
      const now = performance.now();
      const last = el.dataset.tapAt ? +el.dataset.tapAt : -1000;
      if (now - last < 280) { unlock(); return; }
      el.dataset.tapAt = String(now);
      playTap();
      if (window.V5 && V5.onTap) V5.onTap(el);
      unlock();
    };
    const cancel = e => {
      if (!press || e.pointerId !== press.id) return;
      press.el.classList.remove('is-pressed');
      press = null;
    };
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', cancel, { passive: true });
    document.addEventListener('click', e => {
      if (e.button !== 0) return;
      const gate = document.getElementById('gate');
      const parent = document.getElementById('parent');
      const modalOn = (gate && !gate.hidden) || (parent && !parent.hidden);
      if (modalOn && e.target.closest && e.target.closest('#app')) return;
      unlock();
    });
    document.addEventListener('touchmove', e => {
      if (document.documentElement.dataset.adult === '1') return;
      if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    ['gesturestart', 'gesturechange'].forEach(name => {
      document.addEventListener(name, e => {
        if (document.documentElement.dataset.adult !== '1') e.preventDefault();
      }, { passive: false });
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = document.activeElement;
      if (!el || !el.dataset || !el.dataset.tap) return;
      e.preventDefault();
      playTap();
      if (window.V5 && V5.onTap) V5.onTap(el);
    });
  }

  /* ---------- dress ---------- */
  let DRESS = null;
  function dressData() { return DRESS; }
  function setDress(d) { DRESS = d; }
  function charBy(id) { return (DRESS.characters || []).find(c => c.id === id); }
  function itemBy(id) { return (DRESS.items || []).find(it => it.id === id); }
  function itemFile(it) {
    if (!it || !it.file) return '';
    if (it.character === 'monggeul' && typeof MONG_WEBP !== 'undefined' && MONG_WEBP.has(it.id)) {
      return 'assets/friends/items/' + it.id + '.webp';
    }
    return it.file;
  }
  function ensureStarters() {
    if (!DRESS) return;
    (DRESS.items || []).forEach(it => {
      if (it.starter && S.unlocks.indexOf(it.id) < 0) S.unlocks.push(it.id);
    });
    (DRESS.characters || []).forEach(ch => {
      if (!S.wear[ch.id]) S.wear[ch.id] = { hat: '', top: '', acc: '', shoes: '', bg: '' };
      const w = S.wear[ch.id];
      if (!w.bg) {
        const bg = (DRESS.items || []).find(it => it.character === ch.id && it.slot === 'bg' && it.starter);
        if (bg) w.bg = bg.id;
      }
    });
    save();
  }
  function isUnlocked(it) { return S.unlocks.indexOf(it.id) >= 0; }
  const MONG_PACE = [
    'monggeul_hat_cap', 'monggeul_top_shirt', 'monggeul_acc_brooch', 'monggeul_shoes_boots',
    'monggeul_hat_crown', 'monggeul_top_vest', 'monggeul_acc_bag', 'monggeul_shoes_slippers',
    'monggeul_top_smock', 'monggeul_acc_glasses', 'monggeul_top_chef', 'monggeul_acc_star',
    'monggeul_top_hanbok', 'monggeul_hat_beret', 'monggeul_top_pajamas', 'monggeul_shoes_sneakers',
    'monggeul_top_raincoat', 'monggeul_top_peach', 'monggeul_top_spacesuit', 'monggeul_top_mint',
    'monggeul_top_sky', 'monggeul_hat_linecrown', 'monggeul_bg_peach', 'monggeul_bg_mint', 'monggeul_bg_sky'
  ];
  /* One new piece of clothing per perfect step and per finished lesson: 몽글이 first, then every friend. */
  function markSoloCloth() {
    if (!DRESS) return null;
    S.soloN = (S.soloN || 0) + 1;
    const pool = MONG_PACE.concat(DRESS.unlock || []);
    const id = pool.find(k => S.unlocks.indexOf(k) < 0 && itemBy(k));
    if (!id) { save(); return null; }
    S.unlocks.push(id);
    S.freshItem = id;
    const it = itemBy(id);
    if (it) {
      S.who = it.character;
      if (!S.wear[it.character]) S.wear[it.character] = { hat: '', top: '', acc: '', shoes: '', bg: '' };
      if (!S.wear[it.character][it.slot]) S.wear[it.character][it.slot] = it.id;
    }
    save();
    return it || null;
  }
  function unlockNext() {
    if (!DRESS) return null;
    const id = (DRESS.unlock || []).find(k => S.unlocks.indexOf(k) < 0);
    if (!id) return null;
    S.unlocks.push(id);
    S.freshItem = id;
    const it = itemBy(id);
    if (it) S.who = it.character;
    save();
    return it;
  }
  function layerHTML(who, opts) {
    const ch = charBy(who);
    if (!ch) return '';
    const w = S.wear[who] || {};
    const skip = (opts && opts.skip) || [];
    return (DRESS.stack || []).map(slot => {
      if (skip.indexOf(slot) >= 0) return '';
      if (slot === 'body') return '<img data-slot="body" alt="" width="512" height="512" src="' + ch.body + '">';
      const it = w[slot] ? itemBy(w[slot]) : null;
      if (!it) return '';
      if (it.paint && it.paint.type === 'css') return '<div class="layer-fill" data-slot="' + slot + '" style="background:' + it.paint.background + '"></div>';
      return '<img data-slot="' + slot + '" alt="" width="512" height="512" src="' + itemFile(it) + '">';
    }).join('');
  }

  /* ---------- skill / praise ---------- */
  let praiseN = 0;
  function emptySkill() {
    return { box: 0, due: 0, seen: 0, ok: 0, help: 0, solo: 0, retry: 0, hold: 0, holdOccasion: '' };
  }
  /* Old boxes counted hinted and one-tap rounds as known. Drop them once. */
  function deflateScores() {
    const next = {};
    Object.keys(S.skill || {}).forEach(k => {
      const it = S.skill[k] || {};
      next[k] = Object.assign(emptySkill(), { seen: it.seen || 0 });
    });
    S.skill = next;
    S.done = {};
    S.last = null;
    S.scoreV = 2;
  }
  function admitThin(key, occasion) {
    if (!key || !occasion) return false;
    const it = S.skill[key];
    return !!(it && it.hold > 0 && it.holdOccasion && it.holdOccasion !== occasion);
  }
  function bump(key, grade, meta) {
    if (!key) return;
    if (grade === 2) grade = 'solo';
    else if (grade === 1) grade = 'retry';
    else if (grade === 0) grade = 'shown';
    const it = Object.assign(emptySkill(), S.skill[key] || {});
    it.seen += 1;
    const day = 86400000;
    if (grade === 'thin') {
      it.hold += 1;
      it.holdOccasion = (meta && meta.occasion) || '';
      it.due = Date.now();
    } else if (grade === 'solo') {
      it.ok += 1;
      it.solo += 1;
      it.box = Math.min(3, it.box + 1);
      it.due = Date.now() + (it.box >= 3 ? 3 : 1) * day;
    } else if (grade === 'retry') {
      it.ok += 1;
      it.retry += 1;
      it.due = Date.now() + day;
    } else if (grade === 'hint') {
      it.help += 1;
      it.due = Date.now();
    } else if (grade === 'shown') {
      it.help += 1;
      it.box = Math.max(0, it.box - 1);
      it.due = Date.now();
    }
    S.skill[key] = it;
    save();
  }
  function hintSoon(key) {
    if (!S.colorHints || !key) return false;
    const sk = S.skill[key];
    if (!sk) return false;
    return (sk.help || 0) > (sk.solo || 0) && (sk.solo || 0) < 3;
  }
  let fxN = 0;
  function confetti(n, kind) {
    const fx = document.getElementById('fx');
    if (!fx) return;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    fx.querySelectorAll('i').forEach(i => i.remove());
    if (reduce) return;
    const colors = ['#F4B59A', '#8FCBB0', '#8EB7E0', '#F2C14E', '#E7A0B4', '#FF8FB8', '#B9A4E8'];
    const shapes = kind === 'hearts' ? ['heart'] : kind === 'stars' ? ['star'] : ['star', 'heart', 'dot', 'ribbon'];
    const count = n || 26;
    fxN += 1;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('i');
      s.className = shapes[(i + fxN) % shapes.length];
      const lane = fxN % 3 === 0 ? 4 + Math.random() * 92 : (i % 2 === 0 ? 2 + Math.random() * 22 : 76 + Math.random() * 22);
      s.style.left = lane + '%';
      s.style.setProperty('--c', colors[(i + fxN) % colors.length]);
      s.style.setProperty('--dx', ((Math.random() - 0.5) * 120).toFixed(0) + 'px');
      s.style.setProperty('--rot', ((Math.random() - 0.5) * 720).toFixed(0) + 'deg');
      s.style.animationDelay = (Math.random() * 160) + 'ms';
      s.style.animationDuration = (0.9 + Math.random() * 0.5).toFixed(2) + 's';
      fx.appendChild(s);
    }
    setTimeout(() => { if (fx) fx.querySelectorAll('i').forEach(i => i.remove()); }, 1700);
  }
  /* A friend pops up from the bottom and cheers. Varies side, friend and pose so it never feels the same. */
  const POSES = ['assets/char/monggeul_cheer.webp', 'assets/char/monggeul_jump.webp', 'assets/char/monggeul_clap.webp',
    'assets/char/monggeul_laugh.webp', 'assets/char/monggeul_clap2.webp', 'assets/char/monggeul_surprise.webp'];
  let cheerN = 0;
  function cheer(text, big) {
    const fx = document.getElementById('fx');
    if (!fx) return;
    const old = fx.querySelector('.cheer');
    if (old) old.remove();
    cheerN += 1;
    const pals = (C().PALS || []).map(p => p[0]);
    const pool = cheerN % 2 ? POSES : pals.concat(POSES);
    const src = pool[Math.floor(Math.random() * pool.length)];
    const box = document.createElement('div');
    box.className = 'cheer ' + (cheerN % 2 ? 'from-right' : 'from-left') + (big ? ' is-big' : '');
    box.innerHTML = '<img alt="" src="' + src + '"><b></b>';
    box.querySelector('b').textContent = text || '';
    fx.appendChild(box);
    setTimeout(() => box.remove(), big ? 2300 : 1700);
  }
  let lastPraise = '';
  const bags = {};
  let palN = 0;
  function voiced(lines) {
    if (!lines || !lines.length) return [];
    if (!hasAudio()) return lines.slice();
    const hit = lines.filter(p => HAVE_AUDIO.has(p[1]));
    return hit.length ? hit : lines.slice();
  }
  function takeLine(id, lines) {
    const pool = voiced(lines);
    if (!pool.length) return ['잘했어!', 'ui_good1'];
    if (!bags[id] || !bags[id].length) {
      bags[id] = shuffle(pool);
      if (bags[id].length > 1 && bags[id][0][1] === lastPraise) bags[id].push(bags[id].shift());
    }
    const line = bags[id].shift();
    lastPraise = line[1];
    return line;
  }
  function fillPraise(row, focus, text, pal) {
    if (!row) return;
    row.classList.add('praise-line');
    row.replaceChildren();
    const img = document.createElement('img');
    img.alt = '';
    img.width = 512;
    img.height = 512;
    img.src = pal[0];
    row.appendChild(img);
    if (focus) {
      const mark = document.createElement('b');
      mark.className = 'who-focus';
      mark.textContent = focus;
      row.appendChild(mark);
    }
    const span = document.createElement('span');
    span.textContent = text;
    row.appendChild(span);
  }
  function praise(opts) {
    opts = opts || {};
    const typed = !!(opts.type || opts.focus || opts.helped || opts.beat);
    const type = opts.type || 'listen';
    const helped = !!opts.helped;
    const beat = !!opts.beat;
    const focus = opts.focus || '';
    let p;
    if (typed && C().praisePool) {
      p = takeLine((beat ? 'beat:' : 'end:') + type + (helped ? ':h' : ''), C().praisePool(beat ? 'beat' : type, !beat && helped));
    } else {
      const all = C().PRAISE.filter(row => hasAudio() && HAVE_AUDIO.has(row[1]));
      const list = all.length ? all : C().PRAISE;
      let pool = list.filter(row => row[1] !== lastPraise);
      if (!pool.length) pool = list;
      p = pool[Math.floor(Math.random() * pool.length)];
      lastPraise = p[1];
    }
    praiseN += 1;
    const m = document.getElementById('mascot');
    if (m) {
      const face = C().FACES[praiseN % C().FACES.length];
      m.src = praiseN % 2 ? face : 'assets/char/monggeul_jump.webp';
      m.classList.add('pop');
      setTimeout(() => m.classList.remove('pop'), 360);
    }
    const pals = C().PALS || [];
    const pal = pals.length ? pals[palN % pals.length] : ['assets/char/monggeul_cheer.webp', '몽글이'];
    palN += 1;
    fillPraise(document.getElementById('bubble'), focus, p[0], pal);
    if (!beat) { confetti(); cheer(p[0], !!opts.big); }
    say(p[1], p[0], { keepBubble: true, now: !!opts.now });
  }
  function takeAny(id, lines) {
    const pool = lines && lines.length ? lines.slice() : [];
    if (!pool.length) return ['같이 해 보자!', 'ui_together'];
    if (!bags[id] || !bags[id].length) bags[id] = shuffle(pool);
    return bags[id].shift();
  }
  function encourage(kind, focus) {
    const pool = C().encouragePool ? C().encouragePool(kind) : [];
    const p = takeAny('enc:' + (kind || 'shown'), pool);
    const pals = C().PALS || [];
    const pal = pals.length ? pals[palN % pals.length] : ['assets/char/monggeul_cheer.webp', '몽글이'];
    palN += 1;
    fillPraise(document.getElementById('bubble'), focus || '', p[0], pal);
    confetti(8, 'hearts');
    if (kind === 'hint') cheer(p[0]);
    if (p[1] && (!hasAudio() || HAVE_AUDIO.has(p[1]))) say(p[1], p[0], { keepBubble: true });
    else {
      const live = document.getElementById('live');
      if (live) live.textContent = p[0];
    }
  }
  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }

  window.V5X = {
    get S() { return S; }, save, load, reset, stamp, say, sayAll, dropQueue, busy, canPlay, unlock, setIdle, startIdle, showHand, hideHand, dragHand, touched, syncSound, installPointer,
    setDress, dressData, charBy, itemBy, itemFile, ensureStarters, isUnlocked, unlockNext, markSoloCloth, layerHTML,
    bump, admitThin, hintSoon, chime, cheer, praise, encourage, confetti, shuffle, lineOf
  };
})();
