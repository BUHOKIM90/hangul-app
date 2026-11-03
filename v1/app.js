'use strict';
/* 한글 놀이 v1 — 네트워크 호출 없음. 기록은 이 기기의 localStorage에만. */

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main'), bar = $('#bar'), dots = $('#dots'), greet = $('#greet');
const wait = ms => new Promise(r => setTimeout(r, ms));
const rand = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const pad2 = n => String(n).padStart(2, '0');
const today = (plus = 0) => { const d = new Date(); d.setDate(d.getDate() + plus); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }; // 기기 로컬 날짜(UTC 아님)
const params = new URLSearchParams(location.search);

/* ---------- 저장 ---------- */
const KEY = 'hangul-play-v1';
const fresh = () => ({ settings: { name: '', timerMin: 10, sound: true, jump: 0 }, units: {}, review: {}, stickers: [], session: { usedMs: 0, ended: false } });
let S;
try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
S.settings = Object.assign(fresh().settings, S.settings);
// FIX2 이전 기록(숫자 0/1)은 날짜 없음으로 옮김 → 날짜 조건에서는 세지 않음
Object.values(S.units || {}).forEach(u => { u.hist = (u.hist || []).map(x => (typeof x === 'number' ? { ok: x, d: '' } : x)); });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 기기: 계속 진행 */ } };

/* ---------- 소리 ---------- */
const player = new Audio();
let sayToken = 0, pending = null, actx = null;
function localKoVoice() {
  if (!('speechSynthesis' in window)) return null;
  return speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ko') && v.localService) || null; // 원격 음성은 네트워크 → 사용 안 함
}
function speakFallback(key) {
  const v = localKoVoice(), text = (typeof LINES !== 'undefined' && LINES[key]) || '';
  if (!v || !text) return wait(350);
  return new Promise(res => { const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.85; u.onend = u.onerror = res; pending = res; speechSynthesis.speak(u); });
}
let playSeq = 0;
function playOne(key, onProgress) {
  if (!S.settings.sound) return wait(250);
  return new Promise(res => {
    const my = ++playSeq; let fin = false, guard = 0;
    const finish = () => {   // 한 번만. 다음 클립이 이미 시작했으면 그 클립의 처리기는 건드리지 않음
      if (fin) return; fin = true; clearTimeout(guard);
      if (playSeq === my) { player.ontimeupdate = player.onended = player.onerror = player.onpause = player.onloadedmetadata = null; pending = null; }
      res();
    };
    pending = finish;
    player.onended = finish;
    // FIX4: 'ended'를 놓쳐도 안내가 멈추지 않게 — 끝에서 멈추면 끝난 것으로, 그래도 안 끝나면 길이+2초 뒤 다음으로
    player.onpause = () => { if (player.ended || (player.duration && player.currentTime >= player.duration - 0.15)) finish(); };
    player.onloadedmetadata = () => { if (isFinite(player.duration)) guard = setTimeout(finish, (player.duration + 2) * 1000); };
    player.onerror = () => { player.onerror = null; speakFallback(key).then(finish); };
    player.ontimeupdate = onProgress ? () => player.duration && onProgress(player.currentTime / player.duration) : null;
    player.src = 'audio/' + key + '.mp3'; if (window.HP && HP.audioLog) HP.audioLog.push(key);   // 시험용 기록(QA가 켤 때만)
    player.play().catch(err => { if (err && err.name === 'NotAllowedError') finish(); else if (player.onerror) player.onerror(); });
  });
}
function stopAudio() { sayToken++; player.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); if (pending) pending(); }
function say(keys, each) {
  stopAudio(); const t = sayToken;
  return [].concat(keys).reduce((p, k, i) => p.then(() => { if (t !== sayToken) return; if (each) each(i, true); return playOne(k).then(() => each && t === sayToken && each(i, false)); }), Promise.resolve())
    .then(() => t === sayToken);
}
function ding(high = 1) { // 사인파 '딩동' 0.3초, 작은 음량
  if (!S.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [[784 * high, 0], [1047 * high, 0.13]].forEach(([f, t0]) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + t0;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.3);
    });
  } catch (e) { /* 소리 없이 진행 */ }
}

/* ---------- 몽글이 ---------- */
let charImg = null;
function charEl(expr = 'basic', big = false) { charImg = el('img', 'char' + (big ? ' big' : '')); charImg.alt = ''; setChar(expr); return charImg; }
function setChar(expr) { if (charImg) charImg.src = CHAR_DIR + expr + CHAR_EXT; }
function bounce() { if (!charImg) return; charImg.classList.remove('bounce'); void charImg.offsetWidth; charImg.classList.add('bounce'); }
/* FIX4-C1 박수: 03_clap 위에 07_clap_touch(같은 몸·같은 자리)를 겹쳐 놓고 투명도만 부드럽게 바꿈 → 0.8초 안에 손 닿기 2번(깜빡임 아님, CSS clapx 1회) */
function clapAnim() {
  if (!charImg) return; setChar('clap'); bounce();
  document.querySelectorAll('.clapov').forEach(x => x.remove());
  const r = charImg.getBoundingClientRect(); if (!r.width) return;
  const o = el('img', 'clapov'); o.alt = ''; o.src = CHAR_DIR + 'clap2' + CHAR_EXT;
  Object.assign(o.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  document.body.appendChild(o); void o.offsetWidth; o.classList.add('go');
  setTimeout(() => o.remove(), 900);
  if (window.HP) { const an = o.getAnimations().find(x => x.animationName === 'clapx'); HP.lastClap = { base: charImg.src.split('/').pop(), over: o.src.split('/').pop(), ms: an ? an.effect.getTiming().duration : 0, iter: an ? an.effect.getTiming().iterations : 0, op: an ? an.effect.getKeyframes().map(k => +k.opacity) : [] }; }
}
/* FIX4-C5 문제 안내: 말하는 동안 11_point(오른쪽 = 선택지 쪽을 가리킴), 다 말하면 생각하는 얼굴(힌트 05) */
function pointSay(keys, each) { setChar('point'); return say(keys, each).then(ok => { if (ok) setChar('think'); return ok; }); }

/* ---------- 아래 버튼(최대 3개) ---------- */
const ICON = {
  speak: '<svg viewBox="0 0 48 48"><path d="M8 18h8l10-8v28l-10-8H8z" fill="#5A3E36"/><path d="M32 16a10 10 0 0 1 0 16M36 10a17 17 0 0 1 0 28" fill="none" stroke="#5A3E36" stroke-width="4" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 48 48"><path d="M6 24 24 8l18 16" fill="none" stroke="#5A3E36" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22v18h24V22" fill="#fff" stroke="#5A3E36" stroke-width="5" stroke-linejoin="round"/><rect x="20" y="28" width="8" height="12" rx="2" fill="#5A3E36"/></svg>',
  play: '<svg viewBox="0 0 48 48"><path d="M14 8 40 24 14 40z" fill="#5A3E36" stroke="#5A3E36" stroke-width="4" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 48 48"><polygon points="24,4 30,18 45,18 33,28 37,43 24,34 11,43 15,28 3,18 18,18" fill="#fff" stroke="#5A3E36" stroke-width="3.5" stroke-linejoin="round"/></svg>',
  erase: '<svg viewBox="0 0 48 48"><path d="M10 24a14 14 0 1 0 5-10.7" fill="none" stroke="#5A3E36" stroke-width="5" stroke-linecap="round"/><path d="M8 8v10h10" fill="none" stroke="#5A3E36" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function setBar(btns) {
  bar.innerHTML = '';
  btns.slice(0, 3).forEach(b => {
    const x = el('button', 'btn ' + b.color + (b.wide ? ' wide' : ''), ICON[b.icon] + (b.label ? '<span class="lbl">' + b.label + '</span>' : ''));
    x.setAttribute('aria-label', b.label || b.icon); x.dataset.act = b.icon;
    x.addEventListener('click', b.on); bar.appendChild(x);
  });
}
const homeBtn = { icon: 'home', label: '집', color: 'mint', on: () => showHome() };

/* ---------- 진도·복습 ---------- */
const allUnits = STAGES.flatMap(s => s.units.map(u => Object.assign({ stage: s.id }, u)));
const unitById = id => allUnits.find(u => u.id === id);
const U = id => (S.units[id] = S.units[id] || { hist: [], mastered: false });
function currentUnit() {
  const pool = S.settings.jump ? allUnits.filter(u => u.stage === S.settings.jump) : allUnits;
  return pool.find(u => !U(u.id).mastered) || pool[pool.length - 1];
}
/* 숙달: 최근 5번 중 4번 첫 시도 정답 + 그 5번이 서로 다른 날짜 2개 이상(같은 날 연속은 숙달 아님) */
function isMastered(hist) {
  const h = hist.slice(-MASTERY.window);
  if (h.length < MASTERY.window || h.filter(x => x.ok).length < MASTERY.need) return false;
  return new Set(h.map(x => x.d).filter(Boolean)).size >= MASTERY.days;
}
function stageDone(st) { return STAGES[st - 1].units.every(u => U(u.id).mastered); }
function record(unitId, ok, isReview) {
  if (ok == null) return null;
  if (isReview) {
    const r = S.review[unitId]; if (!r) return null;
    r.box = ok ? Math.min(r.box + 1, REVIEW_DAYS.length - 1) : 0; r.due = today(REVIEW_DAYS[r.box]); return null;
  }
  const u = U(unitId); u.hist.push({ ok: ok ? 1 : 0, d: today() }); u.hist = u.hist.slice(-MASTERY.window);
  if (!u.mastered && isMastered(u.hist)) {
    u.mastered = true; S.review[unitId] = { box: 0, due: today(REVIEW_DAYS[0]) }; return unitId;
  }
  return null;
}

/* ---------- 타이머(부모 설정 10/15분) ---------- */
const limitMs = () => (params.get('t') ? +params.get('t') : S.settings.timerMin * 60) * 1000; // ?t=초 는 시험용
let ticking = false;
setInterval(() => { if (ticking && document.visibilityState === 'visible' && !S.session.ended) { S.session.usedMs += 1000; if (S.session.usedMs % 5000 === 0) save(); } }, 1000);
const timeUp = () => S.session.usedMs >= limitMs();

/* ---------- 화면 공통 ---------- */
let screenId = 0, roundInfo = null;
function screen(name) { screenId++; stopAudio(); document.querySelectorAll('.clapov').forEach(x => x.remove()); main.innerHTML = ''; main.classList.remove('tracing'); main.dataset.screen = name; dots.innerHTML = ''; greet.textContent = ''; charImg = null; roundInfo = null; ticking = false; window.HP && (HP.screen = name); return screenId; }
const alive = id => id === screenId;
function starPop() { const s = $('#star'); s.classList.remove('go'); void s.offsetWidth; s.classList.add('go'); setTimeout(() => s.classList.remove('go'), 820); }
let praiseFlip = 0;
async function success(id) {
  starPop(); ding(); if (praiseFlip++ % 2) { setChar('laugh'); bounce(); } else clapAnim();   // 칭찬: 03 박수(07과 번갈아) / 02 웃음
  await say('ui_good' + (1 + rand(3))); await wait(350);
  return alive(id);
}
async function retryFx(id, node) {
  if (node) { node.classList.remove('retry'); void node.offsetWidth; node.classList.add('retry'); setTimeout(() => node.classList.remove('retry'), 1300); }
  setChar('cheer'); await say('ui_retry'); if (alive(id)) setChar('think');
}

/* ---------- 홈/지도 ---------- */
/* FIX4-B3 홈 배경: 피자 bg_home_land/port 위에 정거장 6개를 bg_home_stations.json 비율 좌표에 놓음.
   배경을 화면에 '덮기(cover)'로 키우되 그림 위치·크기를 직접 계산해서, 같은 값으로 정거장 위치를 보정(화면 비율이 달라도 같이 맞음).
   정거장이 위(인사 줄)·아래(버튼 줄)에 가려질 만큼 잘리면 배경을 조금 덜 키움(남는 곳은 크림/민트 바탕). */
let STATIONS = (ARTS.stations) || { bg_home_land: { size: [2360, 1640], xy: [[.1, .62], [.27, .4], [.44, .62], [.6, .38], [.76, .6], [.9, .36]] },
                                    bg_home_port: { size: [780, 1688], xy: [[.3, .86], [.7, .73], [.3, .6], [.7, .47], [.3, .34], [.68, .21]] } };
if (location.protocol.startsWith('http')) fetch('assets/bg/bg_home_stations.json').then(r => (r.ok ? r.json() : null)).then(j => {   // 앱이 json을 직접 읽음(file://이면 art.js 값)
  if (!j) return; const o = {}; Object.keys(j).forEach(k => { o[k.split('.')[0]] = { size: j[k].size, xy: j[k].stations_pct_xy }; }); STATIONS = o; window.HP && (HP.stationsFrom = 'json'); layoutScene();
}).catch(() => {});
function layoutScene() {
  const sc = main.querySelector('.scene.home'); if (!sc) return;
  const port = innerHeight > innerWidth, name = port ? 'bg_home_port' : 'bg_home_land', st = STATIONS[name];
  const W = innerWidth, H = bar.getBoundingClientRect().top, [iw, ih] = st.size, xs = st.xy.map(p => p[0]), ys = st.xy.map(p => p[1]);
  const mT = $('#top').getBoundingClientRect().bottom + (port ? 34 : 40), mB = port ? 34 : 76, mX = port ? 110 : 50;   // 정거장(동그라미+이름)이 들어갈 여백
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min(Math.max(W / iw, H / ih), (H - mT - mB) / ((y1 - y0) * ih), (W - 2 * mX) / ((x1 - x0) * iw));
  const dw = iw * s, dh = ih * s, clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  let ox = (W - dw) / 2, oy = (H - dh) / 2;
  ox = clamp(ox, mX - x0 * dw, W - mX - x1 * dw); oy = clamp(oy, mT - y0 * dh, H - mB - y1 * dh);
  const img = sc.querySelector('.scenebg'), src = BG(name);
  if (src) { if (img.getAttribute('src') !== src) img.src = src; img.hidden = false; Object.assign(img.style, { left: ox + 'px', top: oy + 'px', width: dw + 'px', height: dh + 'px' }); } else img.hidden = true;
  sc.classList.toggle('port', port); sc.style.setProperty('--sceneH', H + 'px');
  sc.querySelectorAll('.stop').forEach((e, k) => { const [px, py] = st.xy[k]; e.style.left = (ox + px * dw) + 'px'; e.style.top = (oy + py * dh) + 'px'; e.classList.toggle('lt', port && px < 0.5); });
  window.HP && (HP.scene = { name, ox, oy, dw, dh, H });
}
addEventListener('resize', () => main.dataset.screen === 'home' && layoutScene());
function showHome() {
  const id = screen('home');
  if (S.session.ended) return showEnd();
  greet.textContent = S.settings.name ? '안녕, ' + S.settings.name + '!' : '안녕!';
  const cur = currentUnit().stage;
  const sc = el('div', 'scene home'); const bgi = el('img', 'scenebg'); bgi.alt = ''; sc.appendChild(bgi);
  STAGES.forEach(s => sc.appendChild(el('div', 'stop' + (stageDone(s.id) ? ' done' : '') + (s.id === cur ? ' now' : ''), '<i>' + s.id + '</i><span>' + s.name + '</span>')));
  const ch = charEl('basic'); ch.classList.add('homechar'); sc.appendChild(ch);
  main.append(sc); layoutScene();
  setBar([{ icon: 'play', label: '놀자!', color: 'pink', wide: true, on: () => startLesson() },
          { icon: 'star', label: '스티커', color: 'lemon', on: () => showBook() }]);
  say('ui_hello').then(() => alive(id));
}

/* ---------- 수업 ---------- */
let lesson = null;
function pickItems(unit, n) { const out = []; let bag = []; while (out.length < n) { if (!bag.length) bag = shuffle(unit.items); const x = bag.pop(); if (out[out.length - 1] !== x || unit.items.length === 1) out.push(x); } return out; }
function startLesson() {
  if (S.session.ended || timeUp()) { S.session.ended = true; save(); return showEnd(); }
  const unit = currentUnit();
  const rounds = pickItems(unit, ROUNDS_PER_LESSON).map(item => ({ unit, item, review: false }));
  const due = Object.keys(S.review).filter(k => k !== unit.id && S.review[k].due <= today());
  if (due.length) { const ru = unitById(due[rand(due.length)]); rounds[2] = { unit: ru, item: pickItems(ru, 1)[0], review: true }; }
  lesson = { rounds, i: 0, mastered: [], stageStart: unit.stage };
  const id = screen('intro'); main.append(charEl('laugh', true));
  setBar([]);
  say(STAGES[unit.stage - 1].voice).then(ok => ok && alive(id) && nextRound());
}
function drawDots() { dots.innerHTML = lesson.rounds.map((_, i) => '<i class="' + (i < lesson.i ? 'on' : '') + '"></i>').join(''); }
function nextRound() {
  if (lesson.i >= lesson.rounds.length) return showPraise();
  const r = lesson.rounds[lesson.i];
  const id = screen('round-' + r.unit.type); ticking = true; drawDots();
  roundInfo = { type: r.unit.type, unit: r.unit.id, item: r.item, review: r.review }; window.HP && (HP.round = roundInfo, HP.roundNo++);
  const done = ok => {
    if (!alive(id)) return;
    const m = record(r.unit.id, ok, r.review); if (m) lesson.mastered.push(m);
    lesson.i++; save();
    if (timeUp()) { S.session.ended = true; save(); return lesson.i > 1 ? showPraise(true) : showEnd(); }
    nextRound();
  };
  RUN[r.unit.type](r.item, r.unit, id, done);
}

/* 선택 카드 공통(최대 3개) */
function choiceRound(id, cards, correct, done, promptFn) {
  let first = true, locked = false;
  const row = el('div', 'choices');
  cards.forEach((c, i) => {
    c.addEventListener('click', async () => {
      if (locked || !alive(id)) return;
      if (i === correct) { locked = true; c.classList.add('ok'); if (await success(id)) done(first); }
      else { first = false; locked = true; await retryFx(id, c); locked = false; }
    });
    row.appendChild(c);
  });
  setBar([{ icon: 'speak', label: '다시 듣기', color: 'sky', on: promptFn }, homeBtn]);
  return row;
}
const picImg = (w, cls, style) => '<img alt=""' + (cls ? ' class="' + cls + '"' : '') + (style ? ' style="' + style + '"' : '') + ' src="' + PIC(w) + '">';
const picSlot = p => typeof p === 'string' ? picImg(p) : '<div class="combo">' + picImg(p.base) + picImg(p.top, 'deco', 'left:' + p.at[0] + '%;top:' + p.at[1] + '%;width:' + p.at[2] + '%') + '</div>';
const picCard = w => { const c = el('button', 'card'); c.innerHTML = '<img alt="" src="' + PIC(w) + '">'; c.dataset.k = w; c.setAttribute('aria-label', WORDS[w]); return c; };
const others = (pool, x, n) => shuffle(pool.filter(p => p !== x)).slice(0, n);

const RUN = {
  word2pic(w, unit, id, done) {
    const opts = shuffle([w, ...others(WORD_IDS, w, 2)]);
    const prompt = () => pointSay(['ui_listen', VOICE.word(w)]);
    const board = el('div', 'board');
    board.append(choiceRound(id, opts.map(picCard), opts.indexOf(w), done, prompt));
    main.append(charEl('think'), board); prompt();
  },
  clap(w, unit, id, done) {
    const n = WORDS[w].length;
    const hero = el('div', 'hero', '<img alt="" src="' + PIC(w) + '">');
    const cards = [1, 2, 3].map(k => { const c = el('button', 'card', '<div class="dotsrow">' + '<i></i>'.repeat(k) + '</div>'); c.dataset.k = k; c.setAttribute('aria-label', k + '번'); return c; });
    const prompt = async () => {
      setChar('point');
      if (!(await say(VOICE.word(w)))) return;
      const img = hero.querySelector('img');
      if (!(await say([...WORDS[w]].map(VOICE.syl), (i, start) => { img.classList.toggle('hop', start); if (start) ding(1.5 + i * 0.12); }))) return;
      pointSay('ui_clapq');
    };
    const board = el('div', 'board');
    board.append(hero, choiceRound(id, cards, n - 1, done, prompt));
    main.append(charEl('think'), board); prompt();
  },
  jamo(j, unit, id, done) { // 자모 또는 글자(2-1의 가·나·다): 같은 종류끼리만 선택지로
    const isSyl = c => c >= '가' && c <= '힣';
    const same = unit.items.filter(x => isSyl(x) === isSyl(j));
    const pool = same.length >= 3 ? same : Object.keys(STROKES);
    const opts = shuffle([j, ...others(pool, j, 2)]);
    const cards = opts.map(x => { const c = el('button', 'card', '<span class="glyph">' + x + '</span>'); c.dataset.k = x; return c; });
    const note = !isSyl(j) && JAMO_NOTE[j];   // FIX4-A3: ㅇ 설명 한 줄(그림 + 글씨 + jx_ 음성)
    const prompt = () => pointSay([isSyl(j) ? VOICE.syl(j) : VOICE.jamo(j)].concat(note ? [VOICE.jamoX(j)] : [], 'ui_find'));
    const board = el('div', 'board');
    if (note) board.append(el('div', 'jnote', '<img alt="" src="' + PIC(note.pic) + '"><span>' + note.text + '</span>'));
    board.append(choiceRound(id, cards, opts.indexOf(j), done, prompt));
    main.append(charEl('think'), board); prompt();
  },
  merge(s, unit, id, done) {
    const { cho, jung } = splitSyllable(s);
    const tb = !VERTICAL_VOWELS.includes(jung);
    const extra = rand(2) ? { t: 'c', g: others([...'ㄱㄴㄷㄹㅁㅂㅅㅈㅎ'], cho, 1)[0] } : { t: 'v', g: others([...'ㅏㅓㅗㅜㅣ'], jung, 1)[0] };
    const pieces = shuffle([{ t: 'c', g: cho }, { t: 'v', g: jung }, extra]);
    const frame = el('div', 'frame' + (tb ? ' tb' : ''));
    const slotC = el('div', 'slot c cho'), slotV = el('div', 'slot v');
    frame.append(slotC, slotV, el('div', 'whole', s));
    const col = el('div', 'pieces');
    let first = true, filled = 0, busy = false;
    const tryPlace = async (p, node) => {
      if (busy || !alive(id)) return false;
      const ok = (p.t === 'c' && p.g === cho && !slotC.textContent) || (p.t === 'v' && p.g === jung && !slotV.textContent);
      if (!ok) { first = false; busy = true; node.style.transform = ''; await retryFx(id, node); busy = false; return false; }
      const slot = p.t === 'c' ? slotC : slotV; slot.textContent = p.g; slot.classList.add('filled'); node.classList.add('used'); node.style.transform = '';
      ding(1.2); filled++;
      if (filled === 2) {
        busy = true; await wait(300); frame.classList.add('done');
        await say(VOICE.syl(s)); if (alive(id) && await success(id)) done(first);
      }
      return true;
    };
    pieces.forEach(p => {
      const n = el('div', 'piece ' + p.t, p.g); n.dataset.k = p.t + p.g;
      draggable(n, { onTap: () => tryPlace(p, n), onDrop: (x, y) => { if (!inside(frame, x, y)) return false; tryPlace(p, n); return true; } });
      col.appendChild(n);
    });
    const prompt = () => pointSay([VOICE.syl(s), 'ui_merge']);
    setBar([{ icon: 'speak', label: '다시 듣기', color: 'sky', on: prompt }, homeBtn]);
    const wrap = el('div', 'merge'); wrap.append(frame, col);
    main.append(charEl('think'), wrap); prompt();
  },
  match(w, unit, id, done) {
    const pair = [w, others(WORD_IDS, w, 1)[0]];
    const pics = shuffle(pair), words = shuffle(pair);
    let first = true, got = 0, sel = null, busy = false;
    const top = el('div', 'row'), low = el('div', 'row');
    const pcs = pics.map(p => { const c = el('button', 'card pcard', '<img alt="" src="' + PIC(p) + '"><div class="got"></div>'); c.dataset.k = p; top.appendChild(c); return c; });
    const attempt = async (wd, node, pc) => {
      if (busy || !alive(id)) return;
      sel = null; node.classList.remove('sel');
      if (pc.dataset.k !== wd) { first = false; busy = true; node.style.transform = ''; await retryFx(id, node); busy = false; return; }
      node.classList.add('used'); node.style.transform = ''; pc.classList.add('ok'); pc.querySelector('.got').textContent = WORDS[wd]; ding(1.2); got++;
      await say(VOICE.word(wd));
      if (got === 2 && alive(id) && await success(id)) done(first);
    };
    words.forEach(wd => {
      const n = el('div', 'wcard', WORDS[wd]); n.dataset.k = wd; low.appendChild(n);
      draggable(n, {
        onTap: () => { if (busy) return; low.querySelectorAll('.wcard').forEach(x => x.classList.remove('sel')); n.classList.add('sel'); sel = { wd, n }; say(VOICE.word(wd)); },
        onDrop: (x, y) => { const pc = pcs.find(c => inside(c, x, y) && !c.classList.contains('ok')); if (!pc) return false; attempt(wd, n, pc); return true; }
      });
    });
    pcs.forEach(pc => pc.addEventListener('click', () => { if (sel && !pc.classList.contains('ok')) attempt(sel.wd, sel.n, pc); }));
    const prompt = () => pointSay('ui_match');
    setBar([{ icon: 'speak', label: '다시 듣기', color: 'sky', on: prompt }, homeBtn]);
    const m = el('div', 'match'); m.append(top, low);
    main.append(charEl('think'), m); prompt();
  },
  sentence(i, unit, id, done) {
    const sen = SENTENCES[i];
    const opts = shuffle([i, ...others(SENTENCES.map((_, k) => k), i, 2)]);
    const cards = opts.map(k => { const c = el('button', 'card', (PHRASE(k) ? '<div class="pic2"><img alt="" class="phrase" src="' + PHRASE(k) + '"></div>' : '<div class="pic2">' + SENTENCES[k].pics.map(picSlot).join('') + '</div>')); c.dataset.k = k; return c; });
    const words = sen.text.split(' ');
    const line = el('div', 'sentence', words.map(w => '<span>' + w + '</span>').join(' '));
    const spans = [...line.children];
    const total = sen.text.length; const ends = []; let acc = 0; words.forEach(w => { acc += w.length + 1; ends.push(acc / (total + 1)); });
    const prompt = async () => {
      stopAudio(); setChar('point'); const t = sayToken; spans.forEach(s => s.classList.remove('lit'));
      await playOne(VOICE.sentence(i), p => { if (t === sayToken) spans.forEach((s, k) => s.classList.toggle('lit', k === 0 || p >= (ends[k - 1] - 0.04))); });
      if (t !== sayToken) return; spans.forEach(s => s.classList.add('lit')); pointSay('ui_which');
    };
    const board = el('div', 'board'); board.append(line, choiceRound(id, cards, opts.indexOf(i), done, prompt));
    main.append(charEl('think'), board); prompt();
  },
  trace(j, unit, id, done) { traceRound(j, id, done); }
};

/* 끌기(또는 누르기) */
function inside(node, x, y) { const r = node.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
function draggable(n, { onTap, onDrop }) {
  n.addEventListener('pointerdown', e => {
    if (n.classList.contains('used')) return;
    e.preventDefault(); n.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY; let moved = false;
    n.classList.remove('back'); n.classList.add('drag');
    const move = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.hypot(dx, dy) > 14) moved = true; n.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
    const up = ev => {
      n.removeEventListener('pointermove', move); n.removeEventListener('pointerup', up); n.removeEventListener('pointercancel', up);
      n.classList.remove('drag');
      const back = () => { n.classList.add('back'); n.style.transform = ''; };
      if (!moved) { back(); onTap(); return; }
      if (!onDrop(ev.clientX, ev.clientY)) back();
    };
    n.addEventListener('pointermove', move); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
  });
}

/* ---------- 따라 쓰기 ---------- */
/* 글자마다 획 경로 외곽을 판에 꽉 맞춰 그림(폰 세로에서도 글자 높이 ≥ 화면 40% 또는 너비 ≥ 85%).
   판정·잉크는 100×100 글자 단위로 저장하고, 화면에는 px로 바꿔 그림. 선 굵기는 px 고정. */
const TRACE_PX = { guide: 30, dash: 3, ink: 20, trail: 20, dot: 13, pad: 6 };
function strokePoints(s) {
  if (Array.isArray(s)) return s;
  const [cx, cy, r] = s.c, pts = [];
  for (let k = 0; k <= 48; k++) { const a = -Math.PI / 2 - k * (2 * Math.PI / 48); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
function densify(lines, step = 2) {
  const out = [];
  lines.forEach(pts => { for (let i = 0; i < pts.length; i++) { if (i === 0) { out.push(pts[0]); continue; } const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); } });
  return out;
}
function minDist(p, pts) { let m = 1e9; for (const q of pts) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < m) m = d; } return Math.sqrt(m); }
function judgeTrace(guide, ink) {
  const inkPts = densify(ink); if (inkPts.length < 4) return false;
  for (const g of guide) { const sm = densify([g], 2.5); const cov = sm.filter(p => minDist(p, inkPts) <= TRACE.tol).length / sm.length; if (cov < TRACE.cover) return false; }
  const gAll = densify(guide, 2.5); const stray = inkPts.filter(p => minDist(p, gAll) > TRACE.stray).length / inkPts.length;
  return stray <= TRACE.strayMax;
}
function traceRound(j, id, done) {
  const guide = STROKES[j].map(strokePoints);
  const xs = guide.flat().map(p => p[0]), ys = guide.flat().map(p => p[1]);
  const bb = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  main.classList.add('tracing');
  const box = el('div', 'trace');
  box.innerHTML = '<svg><path class="g1" fill="none" stroke="#e3d8d2" stroke-width="' + TRACE_PX.guide + '" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path class="g2" fill="none" stroke="#b9a79e" stroke-width="' + TRACE_PX.dash + '" stroke-dasharray="9 11" stroke-linecap="round"/>' +
    guide.map((_, k) => '<path class="tr" data-k="' + k + '" d="" fill="none" stroke="#FF8FAB" stroke-opacity=".55" stroke-width="' + TRACE_PX.trail + '" stroke-linecap="round" stroke-linejoin="round"/>').join('') +
    '<circle class="mover" r="' + TRACE_PX.dot + '" fill="#FF8FAB" stroke="#5A3E36" stroke-width="4" cx="-50" cy="-50"/></svg><canvas></canvas>';
  const svg = box.querySelector('svg'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), mover = box.querySelector('.mover');
  const trails = [...box.querySelectorAll('.tr')];
  const T = { s: 1, ox: 0, oy: 0 };
  const toPx = ([x, y]) => [T.ox + x * T.s, T.oy + y * T.s];
  const toU = ([x, y]) => [(x - T.ox) / T.s, (y - T.oy) / T.s];
  const dPx = pts => 'M' + pts.map(p => toPx(p).map(v => v.toFixed(1)).join(' ')).join(' L');
  let ink = [], cur = null, tries = 0, busy = false, demoTok = 0, parked = guide[0][0];
  const placeMover = p => { const [x, y] = toPx(p); mover.setAttribute('cx', x); mover.setAttribute('cy', y); };
  const fit = () => {
    const r = box.getBoundingClientRect(); if (!r.width) return;
    const W = r.width, Hh = r.height, pad = TRACE_PX.guide / 2 + TRACE_PX.pad;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    T.s = Math.min((W - 2 * pad) / Math.max(bb.x1 - bb.x0, 1), (Hh - 2 * pad) / Math.max(bb.y1 - bb.y0, 1));
    T.ox = W / 2 - T.s * (bb.x0 + bb.x1) / 2; T.oy = Hh / 2 - T.s * (bb.y0 + bb.y1) / 2;
    const all = guide.map(dPx).join(' ');
    svg.querySelector('.g1').setAttribute('d', all); svg.querySelector('.g2').setAttribute('d', all);
    trails.forEach(t => { const u = t.dataset.u ? JSON.parse(t.dataset.u) : []; t.setAttribute('d', u.length ? dPx(u) : ''); });
    placeMover(parked);
    const d = window.devicePixelRatio || 1; cv.width = W * d; cv.height = Hh * d; redraw();
  };
  const redraw = () => {
    const d = window.devicePixelRatio || 1; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#FF8FAB'; ctx.lineWidth = TRACE_PX.ink;
    ink.forEach(s => { ctx.beginPath(); s.forEach((p, i) => { const [x, y] = toPx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (s.length === 1) { const [x, y] = toPx(s[0]); ctx.lineTo(x + 0.1, y); } ctx.stroke(); });
  };
  const setTrail = (k, pts) => { trails[k].dataset.u = JSON.stringify(pts); trails[k].setAttribute('d', pts.length ? dPx(pts) : ''); };
  const clearTrails = () => trails.forEach((t, k) => setTrail(k, []));
  const toLocal = e => { const r = box.getBoundingClientRect(); return toU([e.clientX - r.left, e.clientY - r.top]); };
  async function demo() { // 움직이는 점: data.js 획 순서·방향대로. 끝난 획은 분홍으로 남김(숫자 대신)
    const tok = ++demoTok; clearTrails(); if (window.HP && HP.trace) HP.trace.demoDone = false;
    for (let k = 0; k < guide.length; k++) {
      const d = densify([guide[k]], 1), done = [];
      for (const p of d) {
        if (tok !== demoTok || !alive(id)) return;
        parked = p; placeMover(p); done.push(p); setTrail(k, done);
        await wait(22);
      }
      await wait(380);
    }
    if (window.HP && HP.trace) HP.trace.demoDone = true;
    await wait(1200);
    if (tok === demoTok && alive(id)) { clearTrails(); parked = guide[0][0]; placeMover(parked); }
  }
  const clear = () => { ink = []; redraw(); };
  const check = async () => {
    if (judgeTrace(guide, ink)) { busy = true; demoTok++; if (await success(id)) done(tries === 0); return; }
    const inkLen = densify(ink).length * 2, gLen = densify(guide).length * 2;
    if (ink.length >= guide.length + 2 || inkLen > gLen * 2.5) {
      tries++; busy = true;
      if (tries >= TRACE.maxTries) { setChar('cheer'); await say('ui_together'); clear(); await demo(); if (alive(id)) done(null); return; } // 숙달 계산 제외, 벌점 없음
      await retryFx(id, null); clear(); busy = false; demo();
    }
  };
  cv.addEventListener('pointerdown', e => { if (busy) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); demoTok++; clearTrails(); cur = [toLocal(e)]; ink.push(cur); redraw(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; cur.push(toLocal(e)); redraw(); });
  const end = () => { if (!cur) return; cur = null; check(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const prompt = () => { setChar('think'); say([VOICE.jamo(j), 'ui_trace']); demo(); };
  setBar([{ icon: 'speak', label: '듣기', color: 'sky', on: prompt }, { icon: 'erase', label: '지우기', color: 'apricot', on: () => { if (!busy) clear(); } }, homeBtn]);
  main.append(charEl('think'), box);
  fit(); requestAnimationFrame(fit); new ResizeObserver(fit).observe(box);
  window.HP && (HP.trace = { letter: j, guide, demoDone: false, inject: pts => { ink.push(pts); redraw(); return check(); } });
  prompt();
}
/* 시험용: 한 문제만 띄우기(진도 기록 안 함) — QA 캡처용 */
function roundOnly(unitId, item) { const u = unitById(unitId); const id = screen('round-' + u.type); roundInfo = { type: u.type, unit: 'qa', item }; window.HP && (HP.round = roundInfo); RUN[u.type](item, u, id, () => {}); }
/* 시험용: 따라 쓰기 한 글자만 띄우기(진도 기록 안 함) */
function traceOnly(j) { const id = screen('round-trace'); roundInfo = { type: 'trace', unit: 'qa', item: j }; window.HP && (HP.round = roundInfo); traceRound(j, id, () => {}); }

/* ---------- 칭찬·스티커 ---------- */
function showPraise(thenEnd) {
  const id = screen('praise');
  const sid = STICKER_IDS[S.stickers.length % STICKER_IDS.length]; S.stickers.push(sid); save();
  const st = el('div', 'newst', '<img alt="" src="' + STICKER(sid) + '">');
  main.append(charEl('surprise', true), st);
  if (BG('bg_praise_floor')) { const fl = el('img', 'floor'); fl.alt = ''; fl.src = BG('bg_praise_floor'); main.append(fl); }   // FIX4-B3 칭찬 바닥(꽃·구름, 투명)
  setBar([]);
  setTimeout(() => { if (!alive(id)) return; st.classList.add('show'); starPop(); ding(); }, 300);
  (async () => {
    await say('ui_sticker'); if (!alive(id)) return;
    clapAnim(); await say('ui_good' + (1 + rand(3))); if (!alive(id)) return;
    setBar([{ icon: 'play', label: '다음', color: 'mint', wide: true, on: () => afterPraise(thenEnd) }]);
  })();
}
function afterPraise(thenEnd) {
  if (thenEnd || S.session.ended) return showEnd();
  if (lesson && lesson.mastered.length) return showLevelUp();
  startLesson();
}
function showLevelUp() {
  const id = screen('levelup');
  const unitId = lesson.mastered.shift(); const st = unitById(unitId).stage;
  const lv = el('div', 'levelup'); const tr = el('div', 'trail');
  for (let k = 0; k < 5; k++) { const s = el('i'); s.style.animationDelay = (0.3 + k * 0.35) + 's'; tr.appendChild(s); }
  lv.append(charEl('jump', true), tr); main.append(lv); setBar([]);   // FIX4-C4 레벨업 = 10_jump 깡충
  (async () => {
    ding(); await say('ui_levelup'); if (!alive(id)) return;
    setBar([{ icon: 'play', label: '다음', color: 'mint', wide: true, on: () => (stageDone(st) ? showVideo(st) : (lesson.mastered.length ? showLevelUp() : startLesson())) }]);
  })();
}
/* 짧은 영상 자리표시(5~15초 그림책 느낌, CSS 애니). 피자 영상이 오면 <video src="assets/video/…">로 교체 */
const VIDEO = { 1: ['바나나', 'banana', 'w_banana'], 2: ['ㄱ', 'gicha', VOICE.jamo('ㄱ')], 3: ['나', 'nabi', VOICE.syl('나')], 4: ['오리', 'ori', 'w_ori'], 5: ['나무', 'namu', 'w_namu'], 6: ['ㅇ', 'oi', VOICE.jamo('ㅇ')] };   // FIX4-A2: ㅇ = 오이의 오
/* FIX4-C6: 몽글이 12_hold_card 가 든 흰 카드(그림의 왼 35.2%·위 50%·폭 30.1%·높이 18.8%) 안에 글자를 얹음. 글씨 크기는 카드 크기에 맞춤(cqw) */
const CARD_BOX = { l: 35.2, t: 50.0, w: 30.1, h: 18.8 };
function showVideo(st) {
  const id = screen('video'); const [g, pic, voice] = VIDEO[st];
  const fs = Math.min(CARD_BOX.h * 0.74, CARD_BOX.w * 0.86 / g.length).toFixed(2);
  const v = el('div', 'video', '<div class="vhold"><img alt="" src="' + CHAR_DIR + 'card' + CHAR_EXT + '"><div class="vcard" style="left:' + CARD_BOX.l + '%;top:' + CARD_BOX.t + '%;width:' + CARD_BOX.w + '%;height:' + CARD_BOX.h + '%;font-size:' + fs + 'cqw">' + g + '</div></div><img class="vpic" alt="" src="' + PIC(pic) + '">');
  main.append(v); setBar([]);
  (async () => {
    await wait(1600); if (!alive(id)) return; await say(voice); await wait(3800); if (!alive(id)) return;
    setBar([{ icon: 'play', label: '다음', color: 'mint', wide: true, on: () => (lesson && lesson.mastered.length ? showLevelUp() : startLesson()) }]);
  })();
}
function showBook() {
  screen('book');
  const n = S.stickers.length, page = Math.max(0, Math.floor((n - 1) / 24)), mine = S.stickers.slice(page * 24, page * 24 + 24);
  const book = el('div', 'book');
  for (let k = 0; k < 24; k++) { const c = el('div', mine[k] ? 'has' : ''); if (mine[k]) c.innerHTML = '<img alt="" src="' + STICKER(mine[k]) + '">'; book.appendChild(c); }
  main.append(charEl(n ? 'laugh' : 'basic'), book);
  setBar([homeBtn]); say('ui_book');
}
function showEnd() {
  const id = screen('end'); S.session.ended = true; save();
  const land = BG('bg_end_land'), port = BG('bg_end_port');   // FIX4: 배경 bg_end + 08_wave(인사) + 09_sleep(배경 쪽, 작게)
  if (land || port) main.append(el('div', 'scene end-bg', '<picture>' + (port ? '<source media="(orientation: portrait)" srcset="' + port + '">' : '') + '<img alt="" src="' + (land || port) + '"></picture><img class="sleep" alt="" src="' + CHAR_DIR + 'sleep' + CHAR_EXT + '">'));
  const e = el('div', 'end'); if (!land && !port) e.append(el('div', 'moon')); e.append(charEl('wave', true)); main.append(e);
  setBar([]); setTimeout(() => alive(id) && say('ui_end'), 400);
}

/* ---------- 부모 메뉴(3초 길게 누르기) ---------- */
const lock = $('#lock'), ring = $('#lockRing');
let lockT = null, lockStart = 0;
const lockReset = () => { cancelAnimationFrame(lockT); lockT = null; ring.style.strokeDashoffset = 107; };
lock.addEventListener('pointerdown', e => {
  e.preventDefault(); lockStart = performance.now();
  const step = t => { const p = Math.min(1, (t - lockStart) / 3000); ring.style.strokeDashoffset = 107 * (1 - p); if (p >= 1) { lockReset(); openParent(); } else lockT = requestAnimationFrame(step); };
  lockT = requestAnimationFrame(step);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => lock.addEventListener(ev, () => lockT && lockReset()));
lock.addEventListener('contextmenu', e => e.preventDefault());

function openParent() {
  stopAudio(); const was = ticking; ticking = false;
  const P = $('#parent'); P.hidden = false;
  const left = Math.max(0, Math.ceil((limitMs() - S.session.usedMs) / 60000));
  const seg = (name, vals, cur) => '<div class="seg" data-n="' + name + '">' + vals.map(([v, t]) => '<button data-v="' + v + '" class="' + (String(v) === String(cur) ? 'on' : '') + '">' + t + '</button>').join('') + '</div>';
  P.innerHTML = '<div class="pm" role="dialog" aria-label="부모 메뉴"><h2>부모 메뉴</h2>' +
    '<label>표시 이름 (이 기기에만 저장, 음성으로는 부르지 않음)<input id="pmName" maxlength="10" autocomplete="off"></label>' +
    '<div>놀이 시간 ' + seg('timerMin', [[10, '10분'], [15, '15분']], S.settings.timerMin) + '<small>오늘 남은 시간: 약 ' + left + '분' + (S.session.ended ? ' (끝 화면 상태)' : '') + '</small></div>' +
    '<div>소리 ' + seg('sound', [[1, '켜기'], [0, '끄기']], S.settings.sound ? 1 : 0) + '</div>' +
    '<div>단계 바로 가기 ' + seg('jump', [[0, '진도대로']].concat(STAGES.map(s => [s.id, s.id + '. ' + s.name])), S.settings.jump) + '</div>' +
    '<div class="row2"><button class="act" id="pmRestart">놀이 다시 시작</button><button class="act warn" id="pmReset">진도 초기화</button><button class="act" id="pmClose">닫기</button></div>' +
    '<small>진도: ' + allUnits.filter(u => U(u.id).mastered).length + '/' + allUnits.length + '단원 · 스티커 ' + S.stickers.length + '장. 종이에 연필로 같이 써 보는 놀이도 함께 해 주세요. 하루 화면 시간은 짧게(만 3~4세 1시간 이하 권고).</small></div>';
  const nm = $('#pmName'); nm.value = S.settings.name;
  nm.addEventListener('input', () => { S.settings.name = nm.value.trim().slice(0, 10); save(); });
  P.querySelectorAll('.seg').forEach(sg => sg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const n = sg.dataset.n; let v = +b.dataset.v;
    S.settings[n] = n === 'sound' ? !!v : v; save(); sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  }));
  $('#pmRestart').addEventListener('click', () => { S.session = { usedMs: 0, ended: false }; save(); closeParent(true); });
  let armed = false;
  $('#pmReset').addEventListener('click', e => {
    if (!armed) { armed = true; e.target.textContent = '정말 지울까요? 한 번 더 누르세요'; return; }
    const keep = S.settings; S = fresh(); S.settings = keep; save(); closeParent(true);
  });
  $('#pmClose').addEventListener('click', () => closeParent(false, was));
}
function closeParent(toHome, resume) {
  const P = $('#parent'); P.hidden = true; P.innerHTML = '';
  if (toHome || ['home', 'book', 'end'].includes(main.dataset.screen) || !resume) return showHome();
  ticking = resume; // 수업 중이면 같은 문제로 계속
}

/* ---------- 시작 ---------- */
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { save(); stopAudio(); } });
if ('speechSynthesis' in window) speechSynthesis.getVoices();
window.HP = { get S() { return S; }, save, limitMs, clapAnim, layoutScene, screen: '', round: null, roundNo: 0, trace: null, judgeTrace, STROKES, traceOnly, strokePoints, record, isMastered, today, roundOnly, U };
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
showHome();
