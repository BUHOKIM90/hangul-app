'use strict';
/* State, voice queue, pointer layer, dress-up, praise. */
(function () {
  const KEY = 'hangul-v5';
  const C = () => window.V5C;
  function fresh() {
    return {
      v: 5, sound: true, colorHints: true, difficulty: 'mid',
      ms: 0, today: '', todayMs: 0, done: {}, skill: {},
      stickers: [], unlocks: [], wear: {}, who: 'monggeul', freshItem: ''
    };
  }
  let S = fresh();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && o.v === 5) S = Object.assign(fresh(), o);
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
  function lineOf(key) {
    if (window.LINES && LINES[key]) return LINES[key];
    return '';
  }
  function showLine(text) {
    const live = document.getElementById('live');
    if (live && text) live.textContent = text;
    const b = document.getElementById('bubble');
    if (b && text) b.textContent = text;
  }
  function playKey(key, g) {
    return new Promise(resolve => {
      if (g !== gen) return resolve();
      if (!S.sound || !window.HAVE_AUDIO || !HAVE_AUDIO.has(key)) return resolve();
      const done = () => { player.onended = player.onerror = null; resolve(); };
      player.onended = done;
      player.onerror = done;
      player.src = 'audio/' + key + '.mp3';
      const p = player.play();
      if (p && p.catch) p.catch(() => done());
    });
  }
  function pump() {
    if (playing) return;
    const job = q.shift();
    if (!job) return;
    playing = true;
    playKey(job.key, job.g).then(() => { playing = false; pump(); });
  }
  function say(key, caption) {
    const text = caption || lineOf(key);
    showLine(text);
    const g = gen;
    if (!playing && !q.length) {
      playing = true;
      playKey(key, g).then(() => { playing = false; pump(); });
    } else q.push({ key, g });
  }
  function dropQueue() { gen++; q = []; }
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
    if (unlocked) return;
    try {
      player.src = SILENT;
      const p = player.play();
      unlocked = true;
      if (p && p.then) p.then(() => { if ((player.src || '').indexOf('data:audio/wav') === 0) player.pause(); }).catch(() => {});
    } catch (e) { /* ignore */ }
  }
  function syncSound() {
    const b = document.getElementById('soundBtn');
    if (!b) return;
    const on = !!S.sound;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? '소리 켜짐' : '소리 꺼짐');
    b.textContent = on ? '소리 켜짐' : '소리 꺼짐';
  }

  /* ---------- pointer ---------- */
  let press = null;
  function installPointer() {
    const down = e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      unlock();
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
      const tol = 28;
      const x = e.clientX, y = e.clientY;
      const inside = x >= r.left - tol && x <= r.right + tol && y >= r.top - tol && y <= r.bottom + tol;
      if (!inside) return;
      const now = performance.now();
      const last = el.dataset.tapAt ? +el.dataset.tapAt : -1000;
      if (now - last < 280) return;
      el.dataset.tapAt = String(now);
      if (window.V5 && V5.onTap) V5.onTap(el);
    };
    const cancel = e => {
      if (!press || e.pointerId !== press.id) return;
      press.el.classList.remove('is-pressed');
      press = null;
    };
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', cancel, { passive: true });
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
      if (window.V5 && V5.onTap) V5.onTap(el);
    });
  }

  /* ---------- dress ---------- */
  let DRESS = null;
  function dressData() { return DRESS; }
  function setDress(d) { DRESS = d; }
  function charBy(id) { return (DRESS.characters || []).find(c => c.id === id); }
  function itemBy(id) { return (DRESS.items || []).find(it => it.id === id); }
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
  function layerHTML(who) {
    const ch = charBy(who);
    if (!ch) return '';
    const w = S.wear[who] || {};
    return (DRESS.stack || []).map(slot => {
      if (slot === 'body') return '<img data-slot="body" alt="" width="512" height="512" src="' + ch.body + '">';
      const it = w[slot] ? itemBy(w[slot]) : null;
      if (!it) return '';
      if (it.paint && it.paint.type === 'css') return '<div class="layer-fill" data-slot="' + slot + '" style="background:' + it.paint.background + '"></div>';
      return '<img data-slot="' + slot + '" alt="" width="512" height="512" src="' + it.file + '">';
    }).join('');
  }

  /* ---------- skill / praise ---------- */
  let praiseN = 0;
  function bump(key, q) {
    if (!key) return;
    const it = S.skill[key] || { box: 0, due: 0, seen: 0, ok: 0, help: 0 };
    it.seen += 1;
    if (q >= 2) { it.ok += 1; it.box = Math.min(5, it.box + 1); }
    else if (q === 1) it.ok += 1;
    else { it.help += 1; it.box = Math.max(0, it.box - 1); }
    const gaps = [0, 1, 3, 7, 14, 21];
    it.due = Date.now() + gaps[it.box] * 86400000;
    S.skill[key] = it;
    save();
  }
  function hintOn(wordId) {
    if (!S.colorHints) return false;
    const sk = S.skill['w:' + wordId];
    return !(sk && sk.box >= 2);
  }
  function confetti() {
    const fx = document.getElementById('fx');
    if (!fx) return;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    fx.innerHTML = '';
    if (reduce) return;
    const colors = ['#F4B59A', '#8FCBB0', '#8EB7E0', '#F2C14E', '#E7A0B4', '#FF8FB8', '#FFF9EB'];
    for (let i = 0; i < 36; i++) {
      const s = document.createElement('i');
      if (i % 3 === 0) s.className = 'star';
      s.style.left = (4 + Math.random() * 92) + '%';
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (Math.random() * 180) + 'ms';
      s.style.animationDuration = (1.4 + Math.random() * 0.7) + 's';
      fx.appendChild(s);
    }
    setTimeout(() => { if (fx) fx.innerHTML = ''; }, 2300);
  }
  let lastPraise = '';
  function praise() {
    const all = C().PRAISE.filter(p => window.HAVE_AUDIO && HAVE_AUDIO.has(p[1]));
    const list = all.length ? all : C().PRAISE;
    let pool = list.filter(p => p[1] !== lastPraise);
    if (!pool.length) pool = list;
    const p = pool[Math.floor(Math.random() * pool.length)];
    lastPraise = p[1];
    praiseN += 1;
    const m = document.getElementById('mascot');
    if (m) {
      const face = C().FACES[praiseN % C().FACES.length];
      m.src = praiseN % 2 ? face : 'assets/char/monggeul_jump.webp';
      m.classList.add('pop');
      setTimeout(() => m.classList.remove('pop'), 360);
    }
    const pals = C().PALS || [];
    const pal = pals[Math.floor(Math.random() * pals.length)] || ['assets/char/monggeul_cheer.webp', '몽글이'];
    const pop = document.getElementById('praise');
    if (pop) {
      pop.hidden = false;
      pop.innerHTML = '<img alt="" width="512" height="512" src="' + pal[0] + '"><p>' + p[0] + '</p>';
      pop.classList.remove('is-in');
      void pop.offsetWidth;
      pop.classList.add('is-in');
      clearTimeout(praise.timer);
      praise.timer = setTimeout(() => { pop.hidden = true; }, 2200);
    }
    confetti();
    say(p[1], p[0]);
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
    get S() { return S; }, save, load, reset, stamp, say, dropQueue, unlock, syncSound, installPointer,
    setDress, dressData, charBy, itemBy, ensureStarters, isUnlocked, unlockNext, layerHTML,
    bump, hintOn, praise, confetti, shuffle, lineOf
  };
})();
