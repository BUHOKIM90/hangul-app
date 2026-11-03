'use strict';
/* 한글 놀이 v2 — 잠금 없는 열린 길 + 오늘의 놀이 + 놀이 정원. 네트워크 호출 없음. 기록은 이 기기의 localStorage에만.
   v1(app/app.js)의 소리·문제 엔진·따라 쓰기 판정을 그대로 가져와 새 화면에 맞춤. */
const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const wait = ms => new Promise(r => setTimeout(r, ms));
const rand = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const pad2 = n => String(n).padStart(2, '0');
const today = (plus = 0) => { const d = new Date(); d.setDate(d.getDate() + plus); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const params = new URLSearchParams(location.search);
const ICON = n => 'assets/icons/' + n + '.svg';
const isSyl = c => c >= '가' && c <= '힣';
const JNAME = { 'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음', 'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅎ': '히읗', 'ㅏ': '아', 'ㅓ': '어', 'ㅗ': '오', 'ㅜ': '우', 'ㅡ': '으', 'ㅣ': '이' };
const playById = id => PLAYS.find(p => p.id === id);
const rowOf = p => ROWS.find(r => r.id === p.row);

/* ---------- 저장 (v2 새 키, v1 기록은 읽기만 하고 지우지 않음) ---------- */
const KEY = 'hangul-play-v2', KEY_V1 = 'hangul-play-v1';
const fresh = () => ({ v: 2, settings: { timerMin: 10, sound: true, volume: 0.9, autoPick: true, manual: [] }, plays: {}, review: {}, stickers: [], log: [], met: {}, session: { date: '', usedMs: 0, ended: false, done: [], stickers: [], list: null } });
let S;
function load() {
  let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
  if (raw) { S = Object.assign(fresh(), raw); S.settings = Object.assign(fresh().settings, raw.settings); S.session = Object.assign(fresh().session, raw.session); return; }
  S = fresh();
  try {   // v1 → v2 옮기기: 스티커·설정·단원 기록(숙달)·복습 상자
    const o = JSON.parse(localStorage.getItem(KEY_V1) || 'null');
    if (o) {
      S.stickers = (o.stickers || []).slice(); S.migratedFrom = 'v1';
      if (o.settings) { S.settings.timerMin = [10, 12, 15].includes(o.settings.timerMin) ? o.settings.timerMin : (o.settings.timerMin > 12 ? 15 : 10); S.settings.sound = o.settings.sound !== false; }
      Object.entries(o.units || {}).forEach(([u, rec]) => (V1_MAP[u] || []).forEach(pid => {
        const hist = (rec.hist || []).map(x => (typeof x === 'number' ? { ok: x, d: '' } : x));
        S.plays[pid] = { hist: hist.slice(-MASTERY.window), mastered: !!rec.mastered, count: hist.length };
        if (o.review && o.review[u]) S.review[pid] = Object.assign({}, o.review[u]);
      }));
    }
  } catch (e) { /* v1 기록이 깨졌으면 새로 시작 */ }
}
load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가: 계속 */ } };
function ensureSession() { if (S.session.date !== today()) { S.session = Object.assign(fresh().session, { date: today() }); save(); } }
ensureSession();

/* ---------- 소리 (v1과 같음 + 소리 크기) ---------- */
const player = new Audio();
let sayToken = 0, pending = null, actx = null, playSeq = 0;
function localKoVoice() { if (!('speechSynthesis' in window)) return null; return speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ko') && v.localService) || null; }
function speakFallback(key) {
  const v = localKoVoice(), text = (typeof LINES !== 'undefined' && LINES[key]) || '';
  if (!v || !text) return wait(350);
  return new Promise(res => { const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.85; u.onend = u.onerror = res; pending = res; speechSynthesis.speak(u); });
}
function playOne(key, onProgress) {
  if (!S.settings.sound) return wait(250);
  return new Promise(res => {
    const my = ++playSeq; let fin = false, guard = 0;
    const finish = () => { if (fin) return; fin = true; clearTimeout(guard); if (playSeq === my) { player.ontimeupdate = player.onended = player.onerror = player.onpause = player.onloadedmetadata = null; pending = null; } res(); };
    pending = finish; player.onended = finish;
    player.onpause = () => { if (player.ended || (player.duration && player.currentTime >= player.duration - 0.15)) finish(); };
    player.onloadedmetadata = () => { if (isFinite(player.duration)) guard = setTimeout(finish, (player.duration + 2) * 1000); };
    player.onerror = () => { player.onerror = null; if (window.HP) HP.audioErr.push(key); speakFallback(key).then(finish); };
    player.ontimeupdate = onProgress ? () => player.duration && onProgress(player.currentTime / player.duration) : null;
    player.volume = S.settings.volume; player.src = 'audio/' + key + '.mp3'; if (window.HP) HP.audioLog.push(key);
    player.play().catch(err => { if (err && err.name === 'NotAllowedError') finish(); else if (player.onerror) player.onerror(); });
  });
}
function stopAudio() { sayToken++; player.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); if (pending) pending(); }
function say(keys, each) {
  stopAudio(); const t = sayToken;
  return [].concat(keys).reduce((p, k, i) => p.then(() => { if (t !== sayToken) return; if (each) each(i, true); return playOne(k).then(() => each && t === sayToken && each(i, false)); }), Promise.resolve()).then(() => t === sayToken);
}
function ding(high = 1) {
  if (!S.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [[784 * high, 0], [1047 * high, 0.13]].forEach(([f, t0]) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + t0, peak = 0.12 * S.settings.volume + 0.0002;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.3);
    });
  } catch (e) { /* 소리 없이 */ }
}

/* ---------- 몽글이 ---------- */
let charImg = null;
function mg(expr = 'basic', cls = 'mg') { const i = el('img', cls); i.alt = '몽글이'; i.src = CHAR_DIR + expr + CHAR_EXT; return i; }
function charEl(expr) { charImg = mg(expr); return charImg; }
function setChar(expr) { if (charImg) charImg.src = CHAR_DIR + expr + CHAR_EXT; }
function bounce(n = charImg) { if (!n) return; n.classList.remove('bounce'); void n.offsetWidth; n.classList.add('bounce'); }
let bubbleEl = null;
function guide(expr, text, low) { const g = el('div', 'guide' + (low ? ' low' : '')); bubbleEl = el('div', 'bubble', text); g.append(charEl(expr), bubbleEl); return g; }
const setBubble = t => { if (bubbleEl) bubbleEl.innerHTML = t; };
function pointSay(keys, each) { setChar('point'); return say(keys, each).then(ok => { if (ok) setChar('think'); return ok; }); }

/* ---------- 그림 (없으면 첫 글자 자리표시: 그림 파일만 넣으면 바로 바뀜) ---------- */
const hasPic = w => ARTS.pic.includes(w);
const picHTML = (w, label, cls = '') => hasPic(w) ? '<img class="' + cls + '" alt="' + (label || '') + '" src="' + PIC(w) + '">' : '<div class="ph ' + cls + '" aria-label="' + (label || '') + '">' + ((label || WORDS[w] || '?')[0]) + '</div>';
const exPic = j => { const e = JAMO_EX[j]; return e ? picHTML(e.pic, e.word) : ''; };

/* ---------- 진도·복습 ---------- */
const P = id => (S.plays[id] = S.plays[id] || { hist: [], mastered: false, count: 0 });
function isMastered(hist) {
  const h = hist.slice(-MASTERY.window);
  if (h.length < MASTERY.window || h.filter(x => x.ok).length < MASTERY.need) return false;
  return new Set(h.map(x => x.d).filter(Boolean)).size >= MASTERY.days;
}
function record(pid, ok) {   // ok: true/false(첫 시도), null = 계산 제외
  if (ok == null) return false;
  const u = P(pid); u.hist.push({ ok: ok ? 1 : 0, d: today() }); u.hist = u.hist.slice(-MASTERY.window);
  if (!u.mastered && isMastered(u.hist)) { u.mastered = true; S.review[pid] = { box: 0, due: today(REVIEW_DAYS[0]) }; return true; }
  return false;
}
function reviewDone(pid, okRate) { const r = S.review[pid]; if (!r) return; r.box = okRate >= 0.8 ? Math.min(r.box + 1, REVIEW_DAYS.length - 1) : 0; r.due = today(REVIEW_DAYS[r.box]); }
const stage = pid => { const u = P(pid); return u.count >= FRUIT_AT ? 'fruit' : u.mastered ? 'flower' : 'sprout'; };
const STAGE_ICON = { sprout: 'sprout', flower: 'flower', fruit: 'fruit' };

/* ---------- 오늘의 놀이: 복습 1 + 새 놀이 1~2 + 좋아하는 놀이 1, 쓰기는 이틀에 한 번 ---------- */
function computeToday() {
  const out = [], has = id => out.some(x => x.id === id), push = (p, tag) => { if (p && !has(p.id) && out.length < 4) out.push({ id: p.id, tag }); };
  if (!S.settings.autoPick && S.settings.manual.length) { S.settings.manual.map(playById).filter(Boolean).forEach(p => push(p, 'pick')); return out; }
  const t = today();
  const due = PLAYS.filter(p => S.review[p.id] && S.review[p.id].due <= t).sort((a, b) => (S.review[a.id].due < S.review[b.id].due ? -1 : 1));
  if (due.length) push(due[0], 'again');
  const fresh1 = PLAYS.filter(p => !P(p.id).mastered && p.row !== 'write');
  push(fresh1[0], P((fresh1[0] || {}).id || '').count ? 'again' : 'new');
  if (S.settings.timerMin >= 12 && fresh1[1] && fresh1[1].row === (fresh1[0] || {}).row) push(fresh1[1], P(fresh1[1].id).count ? 'again' : 'new');
  const cnt = {}; S.log.filter(x => x.d >= today(-7) && x.src === 'garden').forEach(x => (cnt[x.play] = (cnt[x.play] || 0) + 1));
  const fav = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map(playById).find(p => p && !has(p.id));
  if (fav) push(fav, 'fav');
  const wroteRecently = S.log.some(x => x.d >= today(-1) && playById(x.play) && playById(x.play).row === 'write');
  if (!wroteRecently && out.length < 4) push(PLAYS.filter(p => p.row === 'write').find(p => !P(p.id).mastered) || playById('trace-v'), 'write');
  PLAYS.filter(p => !has(p.id) && !P(p.id).mastered).forEach(p => out.length < 3 && push(p, P(p.id).count ? 'again' : 'new'));
  PLAYS.filter(p => !has(p.id)).forEach(p => out.length < 3 && push(p, 'again'));
  return out;
}
function todayList() {
  ensureSession();
  if (!S.session.list) { S.session.list = computeToday(); save(); }
  return S.session.list.filter(x => playById(x.id));
}
const TAG = { new: ['sprout', '처음'], again: ['', '또 놀기'], fav: ['', '좋아해요'], write: ['pencil', '쓰기'], pick: ['', '오늘 할 것'] };

/* ---------- 타이머 ---------- */
const limitMs = () => (params.get('t') ? +params.get('t') : S.settings.timerMin * 60) * 1000;   // ?t=초 는 시험용
let ticking = false;
setInterval(() => {
  if (ticking && document.visibilityState === 'visible' && !S.session.ended) { S.session.usedMs += 1000; if (S.session.usedMs % 5000 === 0) save(); drawTime(); }
}, 1000);
const timeUp = () => S.session.usedMs >= limitMs();
function drawTime() {
  const p = Math.min(1, S.session.usedMs / limitMs()) * 100;
  $('#top .fill').style.width = p + '%'; $('#top .knob').style.left = Math.min(p, 96) + '%';
}

/* ---------- 화면 공통 ---------- */
let screenId = 0, run = null, roundTok = 0;
function screen(name, opts = {}) {
  screenId++; stopAudio(); main.innerHTML = ''; main.dataset.screen = name; charImg = null; bubbleEl = null; ticking = false;
  $('#homeBtn').hidden = !opts.home; document.body.classList.toggle('night', !!opts.night);
  drawTime(); if (window.HP) HP.screen = name;
  const s = el('div', 'scr s-' + name + (opts.scroll ? ' scroll' : '')); main.appendChild(s); return [screenId, s];
}
const alive = id => id === screenId;
const spark = el('img'); spark.id = 'spark'; spark.alt = ''; spark.src = ICON('flower'); document.body.appendChild(spark);
function sparkPop() { spark.classList.remove('go'); void spark.offsetWidth; spark.classList.add('go'); }
let praiseFlip = 0;
async function success(id) { sparkPop(); ding(); setChar(praiseFlip++ % 2 ? 'laugh' : 'clap'); bounce(); await say('ui_good' + (1 + rand(3))); await wait(300); return alive(id); }
async function retryFx(id, node) {
  if (node) { node.classList.remove('retry'); void node.offsetWidth; node.classList.add('retry'); setTimeout(() => node.classList.remove('retry'), 1100); }
  setChar('cheer'); await say('ui_retry'); if (alive(id)) setChar('think');
}
$('#homeBtn').addEventListener('click', () => showHome());

/* ---------- 놀이 카드 그림 ---------- */
function playArt(p, big) {
  const it = p.items;
  if (p.kind === 'letter') { const j = it[(P(p.id).count * 3) % it.length]; return '<span class="glyph">' + j + '</span>' + exPic(j); }
  if (p.kind === 'pick') return '<span class="glyph' + (big ? '' : ' s') + '">' + it.slice(0, 3).join(' ') + '</span>';
  if (p.kind === 'merge') return '<span class="glyph">' + it[0] + '</span>';
  if (p.kind === 'trace' || p.kind === 'copy') return '<span class="glyph">' + it[0] + '</span><img alt="" src="' + ICON('pencil') + '" style="width:40px;height:40px">';
  if (p.kind === 'clap') return picHTML(p.pic, WORDS[p.pic]);
  if (p.kind === 'listen') return picHTML('podo') + picHTML('ori');
  return picHTML(p.pic, WORDS[p.pic]);
}
function playName(p) {
  if (p.kind === 'letter') { const j = p.items[(P(p.id).count * 3) % p.items.length], e = JAMO_EX[j]; return JNAME[j] + ' <span class="muted">· ' + e.word + '</span>'; }
  return p.name;
}

/* ---------- 홈 ---------- */
function showHome() {
  ensureSession();
  if (S.session.ended) return showRest();
  const [, s] = screen('home');
  let list = todayList(); const left = list.filter(x => !S.session.done.includes(x.id));
  const allDone = !left.length;
  const hero = el('div', 'hero'); hero.append(charEl(allDone ? 'laugh' : 'wave'), el('div', 'bubble', allDone ? '오늘 놀이 다 했어!<br>정원에서 더 놀까?' : '안녕! 오늘은<br>이렇게 놀아 볼까?'));
  const R = el('div', 'homeR');
  R.append(el('div', 'label', '<span>오늘의 놀이</span><span class="faint">' + list.length + '개</span>'));
  const grid = el('div', 'plays');
  const order = left.concat(list.filter(x => S.session.done.includes(x.id)));
  order.forEach((x, i) => {
    const p = playById(x.id), col = rowOf(p).color, done = S.session.done.includes(x.id), big = i === 0 && !done;
    const [ic, tx] = TAG[x.tag] || TAG.again;
    const c = el('button', 'pcard ' + (big ? 'big' : 'small') + ' c-' + col + (done ? ' done' : ''));
    c.dataset.play = p.id;
    c.innerHTML = '<span class="tag ' + x.tag + '">' + (ic ? '<img alt="" src="' + ICON(ic) + '">' : '') + tx + '</span>' +
      '<div class="art' + (p.kind === 'listen' ? ' pair' : '') + '">' + playArt(p, big) + '</div><div class="name">' + playName(p) + '</div>' +
      (big ? '<span class="go"><img alt="" src="' + ICON('play') + '"></span>' : '<span class="play"><img alt="" src="' + ICON('play') + '"></span>') +
      (done ? '<span class="chk"><img alt="" src="' + ICON('check') + '"></span>' : '');
    c.setAttribute('aria-label', p.name + ' 시작');
    c.addEventListener('click', () => startPlay(p.id, 'today'));
    grid.appendChild(c);
  });
  if (allDone) grid.appendChild(el('div', 'allDone', '오늘의 놀이를 다 했어요. 놀이 정원에서 아무거나 골라도 돼요.'));
  R.append(grid);
  const dock = el('div', 'dock');
  const gb = el('button', 'kid-btn', '<img alt="" src="' + ICON('garden') + '">놀이 정원'); gb.id = 'gardenBtn'; gb.addEventListener('click', showGarden);
  const sb = el('button', 'kid-btn', '<img alt="" src="' + ICON('sticker') + '">스티커'); sb.id = 'bookBtn'; sb.addEventListener('click', showBook);
  dock.append(gb, sb);
  s.append(hero, R, dock);
  if (!showHome.greeted) { showHome.greeted = true; say('ui_hello'); }
}

/* ---------- 놀이 정원 ---------- */
function showGarden() {
  const [, s] = screen('garden', { scroll: true });
  const st = PLAYS.map(p => stage(p.id));
  const head = el('div', 'ghead');
  const back = el('button', 'icon-btn', '<img alt="뒤로" src="' + ICON('back') + '">'); back.style.cssText = 'width:56px;height:56px'; back.addEventListener('click', showHome);
  head.append(back, el('h1', '', '놀이 정원'), el('div', 'count', '<span><img alt="꽃" src="' + ICON('flower') + '">' + st.filter(x => x !== 'sprout').length + '</span><span><img alt="열매" src="' + ICON('fruit') + '">' + st.filter(x => x === 'fruit').length + '</span>'));
  const g = el('div', 'garden', '<div class="ground"></div>'); g.append(mg('laugh'));
  const plants = el('div', 'plants'); st.slice(0, 14).forEach(x => plants.insertAdjacentHTML('beforeend', '<img alt="" class="' + (x === 'sprout' ? 's' : '') + '" src="' + ICON(STAGE_ICON[x]) + '">')); g.append(plants);
  const legend = el('div', 'legend', '<span><img alt="" src="' + ICON('sprout') + '">처음</span><span><img alt="" src="' + ICON('flower') + '">해 봤어요</span><span><img alt="" src="' + ICON('fruit') + '">자주 놀아요</span><span><i></i>오늘</span>');
  const rows = el('div', 'rows'); const todays = todayList().map(x => x.id);
  ROWS.forEach(r => {
    const row = el('div', 'row', '<div class="nm"><i style="background:var(--' + r.color + ')"></i>' + r.name + '</div>'); const items = el('div', 'items');
    PLAYS.filter(p => p.row === r.id).forEach(p => {
      let inner;
      if (['letter', 'pick', 'merge', 'trace', 'copy'].includes(p.kind)) inner = '<span class="glyph' + (p.kind === 'pick' ? ' s' : '') + '">' + (p.kind === 'pick' ? p.items.slice(0, 3).join('') : p.items[0]) + '</span>';
      else if (p.kind === 'clap') inner = '<img class="p" alt="" src="' + ICON('clap') + '" style="width:40px;height:40px">';
      else inner = hasPic(p.pic) ? '<img class="p" alt="" src="' + PIC(p.pic) + '">' : '<span class="glyph">' + (WORDS[p.pic] || '?')[0] + '</span>';
      const b = el('button', 'b t-' + r.color + (todays.includes(p.id) ? ' is-today' : ''), inner + '<span class="st"><img alt="" src="' + ICON(STAGE_ICON[stage(p.id)]) + '"></span>');
      b.dataset.play = p.id; b.setAttribute('aria-label', p.name);
      b.addEventListener('click', () => startPlay(p.id, 'garden'));
      items.appendChild(b);
    });
    row.appendChild(items); rows.appendChild(row);
  });
  s.append(head, g, legend, rows);
}

/* ---------- 스티커 책 ---------- */
function showBook() {
  const [, s] = screen('bookscr', { scroll: true, home: true });
  const n = S.stickers.length, page = Math.max(0, Math.floor((n - 1) / 24)), mine = S.stickers.slice(page * 24, page * 24 + 24);
  s.append(guide(n ? 'laugh' : 'basic', n ? '스티커 ' + n + '장 모았어!' : '놀이를 하면 스티커가 생겨!'));
  const book = el('div', 'book');
  for (let k = 0; k < 24; k++) { const c = el('div'); if (mine[k]) c.innerHTML = '<img alt="" src="' + STICKER(mine[k]) + '">'; book.appendChild(c); }
  s.append(book); say('ui_book');
}

/* ---------- 놀이 한 판 ---------- */
function startPlay(pid, src) {
  ensureSession();
  if (S.session.ended) return showRest();
  if (timeUp()) return showEnd();
  const p = playById(pid);
  const n = p.kind === 'letter' ? 3 : ROUNDS;
  let queue;
  if (p.kind === 'letter') { const st0 = (P(pid).count * 3) % p.items.length; queue = [0, 1, 2].map(k => p.items[(st0 + k) % p.items.length]); }
  else { queue = []; while (queue.length < n) queue.push(...shuffle(p.items)); queue = queue.slice(0, n); for (let k = 1; k < queue.length; k++) if (queue[k] === queue[k - 1]) queue.push(queue.splice(k, 1)[0]); }
  run = { pid, p, src, queue, i: 0, ok: 0, first: 0, newlyMastered: false, t0: Date.now(), isReview: !!(S.review[pid] && S.review[pid].due <= today()) };
  P(pid).count++; save();
  nextRound();
}
function nextRound() {
  if (!run) return showHome();
  if (run.i >= run.queue.length) return finishPlay();
  if (timeUp()) return finishPlay(true);
  const item = run.queue[run.i];
  const [id, s] = screen('round-' + run.p.kind, { home: true });
  ticking = true; if (window.HP) HP.round = { play: run.pid, kind: run.p.kind, item, no: run.i };
  const tok = ++roundTok;   // 화면이 바뀌어도(글자 친구 → 써 보기 → 돌아오기) 같은 문제면 이어서 진행
  RUN[run.p.kind](item, id, s, ok => {
    if (tok !== roundTok || !run) return; roundTok++;
    if (ok != null) { run.first++; if (ok) run.ok++; if (record(run.pid, ok)) run.newlyMastered = true; }
    if (run.p.kind === 'letter') S.met[item] = today();
    if (['pick', 'trace', 'copy'].includes(run.p.kind) && !isSyl(item)) S.met[item] = today();
    run.i++; save(); nextRound();
  });
}
function finishPlay(cut) {
  const r = run; run = null; ticking = false;
  if (r.isReview) reviewDone(r.pid, r.first ? r.ok / r.first : 1);
  if (!S.session.done.includes(r.pid)) S.session.done.push(r.pid);
  S.log.push({ d: today(), play: r.pid, src: r.src, ms: Date.now() - r.t0, n: r.i }); S.log = S.log.slice(-120);
  if (r.i === 0) { save(); return showEnd(); }
  showSticker(r, cut || timeUp());
}

/* ---------- 문제 엔진 ---------- */
const others = (pool, x, n) => shuffle(pool.filter(p => p !== x)).slice(0, n);
function speakerBtn(fn, cls = 'spk', label = '다시 듣기') { const b = el('button', cls, '<img alt="' + label + '" src="' + ICON('speaker') + '">'); b.addEventListener('click', fn); return b; }
function choiceRound(id, cards, correct, done) {
  let first = true, locked = false;
  const row = el('div', 'choices');
  cards.forEach((c, i) => {
    c.insertAdjacentHTML('beforeend', '<span class="badge"><img alt="" src="' + ICON('check') + '"></span>');
    c.addEventListener('click', async () => {
      if (locked || !alive(id)) return;
      if (i === correct) { locked = true; c.classList.add('ok'); if (await success(id)) done(first); }
      else { first = false; locked = true; await retryFx(id, c); locked = false; }
    });
    row.appendChild(c);
  });
  return row;
}
const picCard = w => { const c = el('button', 'ch', picHTML(w, WORDS[w])); c.dataset.k = w; c.setAttribute('aria-label', WORDS[w]); return c; };
const glyphCard = g => { const c = el('button', 'ch', '<span class="glyph">' + g + '</span>'); c.dataset.k = g; c.setAttribute('aria-label', g); return c; };
const picSlot = p => typeof p === 'string' ? picHTML(p) : '<div class="combo">' + picHTML(p.base) + '<img alt="" src="' + PIC(p.top) + '" style="left:' + p.at[0] + '%;top:' + p.at[1] + '%;width:' + p.at[2] + '%">' + '</div>';

const RUN = {
  /* 글자 친구: 큰 글자 + 이름 + 예시 낱말(첫 글자 강조) + 음성 "기역, 기차 할 때 기역." */
  letter(j, id, s, done) {
    const e = JAMO_EX[j], word = e.word, k = run.i;
    const voice = () => { setChar('point'); say(VOICE.jamo(j)).then(ok => ok && setChar('basic')); };
    const wordVoice = () => { const w = Object.keys(WORDS).find(x => WORDS[x] === word); say(w ? VOICE.word(w) : VOICE.jamo(j)); };
    const note = JAMO_NOTE[j];
    s.append(guide('point', '이건 <b>' + JNAME[j] + '</b>' + (isSyl(j) || JNAME[j].length > 1 ? '이야!' : '야!')));
    const wrap = el('div', 'lt');
    const L = el('div', 'letter', '<div class="hint">' + run.queue.map((_, q) => '<i class="' + (q === k ? 'on' : '') + '"></i>').join('') + '</div><div class="g">' + j + '</div><div class="nm">' + JNAME[j] + '</div>' + (note ? '<div class="note">' + note.text + '</div>' : ''));
    L.append(speakerBtn(voice));
    const W = el('div', 'word', exPic(j) + '<div class="w' + (word.length > 2 ? ' long' : '') + '"><b>' + word[0] + '</b><span>' + word.slice(1) + '</span></div>');
    W.append(speakerBtn(wordVoice, 'spk', word + ' 듣기'));
    wrap.append(L, W); s.append(wrap);
    const dock = el('div', 'dock');
    const tb = el('button', 'kid-btn', '<img alt="" src="' + ICON('pencil') + '">써 보기'); tb.id = 'tryWrite';
    tb.addEventListener('click', () => { const [id2, s2] = screen('round-trace', { home: true }); ticking = true; traceRound(j, id2, s2, () => { if (!alive(id2)) return; const [id3, s3] = screen('round-letter', { home: true }); ticking = true; RUN.letter(j, id3, s3, done); }, false); });
    const nb = el('button', 'kid-btn next', '다음<img alt="" src="' + ICON('arrow') + '">'); nb.id = 'nextBtn';
    nb.addEventListener('click', () => { ding(1.3); done(true); });
    dock.append(tb, nb); s.append(dock);
    (async () => { await say(VOICE.jamo(j)); if (!alive(id)) return; if (note) await say(VOICE.jamoX(j)); if (alive(id)) setChar('basic'); })();
  },
  /* 소리 듣고 그림 찾기 */
  listen(w, id, s, done) {
    const opts = shuffle([w, ...others(WORD_IDS, w, 2)]);
    const prompt = () => pointSay(['ui_listen', VOICE.word(w)]);
    const pr = el('div', 'prompt', '<div class="body syl">' + [...WORDS[w]].map(() => '<span class="q">?</span>').join('') + '</div>'); pr.append(speakerBtn(prompt));
    s.append(pr, el('div', 'ask', '어느 그림일까?'), choiceRound(id, opts.map(picCard), opts.indexOf(w), done), guide('think', '잘 듣고 골라 봐', true));
    // 소리 놀이: 글자는 맞힌 뒤에 보여 줌(그 전엔 글자 수만큼 ? 칸)
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === w) { pr.querySelectorAll('.syl span').forEach((x, k) => { x.textContent = WORDS[w][k]; x.classList.remove('q'); }); pr.querySelectorAll('.syl span')[0].classList.add('on'); setBubble(WORDS[w] + ' 찾았네!<small>' + [...WORDS[w]].join('·') + ', ' + WORDS[w].length + '글자야</small>'); } }));
    prompt();
  },
  /* 박수 세기 */
  clap(w, id, s, done) {
    const n = WORDS[w].length;
    const pr = el('div', 'prompt', '<div class="body">' + picHTML(w, WORDS[w], 'hero-pic') + '<span class="eye">몇 번 손뼉 칠까?</span></div>');
    const prompt = async () => {
      setChar('point'); if (!(await say(VOICE.word(w)))) return;
      const img = pr.querySelector('.hero-pic');
      if (!(await say([...WORDS[w]].map(VOICE.syl), (i, start) => { if (img) img.classList.toggle('hop', start); if (start) { ding(1.5 + i * 0.12); setChar(i % 2 ? 'clap2' : 'clap'); } }))) return;
      pointSay('ui_clapq');
    };
    pr.append(speakerBtn(prompt));
    const cards = [1, 2, 3].map(k => { const c = el('button', 'ch', '<div class="dots">' + '<i></i>'.repeat(k) + '</div>'); c.dataset.k = k; c.setAttribute('aria-label', k + '번'); return c; });
    s.append(pr, el('div', 'ask', '박수 몇 번?'), choiceRound(id, cards, n - 1, done), guide('think', '짝짝! 같이 세어 봐', true));
    prompt();
  },
  /* 글자 고르기 */
  pick(j, id, s, done) {
    const same = run.p.items.filter(x => isSyl(x) === isSyl(j));
    const opts = shuffle([j, ...others(same.length >= 3 ? same : Object.keys(STROKES), j, 2)]);
    const note = !isSyl(j) && JAMO_NOTE[j];
    const prompt = () => pointSay([isSyl(j) ? VOICE.syl(j) : VOICE.jamo(j)].concat(note ? [VOICE.jamoX(j)] : [], 'ui_find'));
    const pr = el('div', 'prompt', '<div class="body">' + (isSyl(j) ? '<span class="eye">어떤 글자일까?</span>' : exPic(j).replace('<img ', '<img class="hero-pic" ').replace('class="" ', '') + '<span class="eye">' + JAMO_EX[j].word + ' 할 때 ' + JNAME[j] + '</span>') + '</div>');
    pr.append(speakerBtn(prompt));
    s.append(pr, el('div', 'ask', '글자를 찾아 봐'), choiceRound(id, opts.map(glyphCard), opts.indexOf(j), done), guide('think', '어디 있을까?', true));
    prompt();
  },
  /* 합치기 (끌거나 누르기) */
  merge(sy, id, s, done) {
    const { cho, jung } = splitSyllable(sy), tb = !VERTICAL_VOWELS.includes(jung);
    const extra = rand(2) ? { t: 'c', g: others([...'ㄱㄴㄷㄹㅁㅂㅅㅈㅎ'], cho, 1)[0] } : { t: 'v', g: others([...'ㅏㅓㅗㅜㅣ'], jung, 1)[0] };
    const pieces = shuffle([{ t: 'c', g: cho }, { t: 'v', g: jung }, extra]);
    const frame = el('div', 'frame' + (tb ? ' tb' : '')), slotC = el('div', 'slot c'), slotV = el('div', 'slot v');
    frame.append(slotC, slotV, el('div', 'whole', sy));
    const col = el('div', 'pieces');
    let first = true, filled = 0, busy = false;
    const tryPlace = async (p, node) => {
      if (busy || !alive(id)) return false;
      const ok = (p.t === 'c' && p.g === cho && !slotC.textContent) || (p.t === 'v' && p.g === jung && !slotV.textContent);
      if (!ok) { first = false; busy = true; node.style.transform = ''; await retryFx(id, node); busy = false; return false; }
      const slot = p.t === 'c' ? slotC : slotV; slot.textContent = p.g; slot.classList.add('filled'); node.classList.add('used'); node.style.transform = '';
      ding(1.2); filled++;
      if (filled === 2) { busy = true; await wait(300); frame.classList.add('done'); setBubble('<b>' + sy + '</b>가 됐어!'); await say(VOICE.syl(sy)); if (alive(id) && await success(id)) done(first); }
      return true;
    };
    pieces.forEach(p => { const n = el('div', 'piece ' + p.t, p.g); n.dataset.k = p.t + p.g; draggable(n, { onTap: () => tryPlace(p, n), onDrop: (x, y) => { if (!inside(frame, x, y)) return false; tryPlace(p, n); return true; } }); col.appendChild(n); });
    const prompt = () => pointSay([VOICE.syl(sy), 'ui_merge']);
    const pr = el('div', 'prompt', '<div class="body"><span class="eye">두 조각을 넣어 <b style="color:var(--lav-ink);font-size:28px">' + sy + '</b> 만들기</span></div>'); pr.append(speakerBtn(prompt));
    const wrap = el('div', 'merge'); wrap.append(frame, col);
    s.append(pr, wrap, guide('think', '조각을 눌러 봐', true)); prompt();
  },
  /* 낱말 읽기: 글자 보고 그림 고르기 */
  readword(w, id, s, done) {
    const opts = shuffle([w, ...others(WORD_IDS, w, 2)]);
    const prompt = () => pointSay('ui_which');
    const pr = el('div', 'prompt', '<div class="body syl">' + [...WORDS[w]].map(c => '<span>' + c + '</span>').join('') + '</div>');
    pr.append(speakerBtn(() => say(VOICE.word(w)), 'spk', '낱말 듣기'));
    s.append(pr, el('div', 'ask', '어떤 그림일까?'), choiceRound(id, opts.map(picCard), opts.indexOf(w), done), guide('think', '글자를 읽어 봐', true));
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === w) { pr.querySelectorAll('.syl span').forEach(x => x.classList.add('on')); say(VOICE.word(w)); } }));
    prompt();
  },
  /* 낱말 짝 */
  match(w, id, s, done) {
    const pair = [w, others(WORD_IDS, w, 1)[0]], pics = shuffle(pair), words = shuffle(pair);
    let first = true, got = 0, sel = null, busy = false;
    const top = el('div', 'r'), low = el('div', 'r');
    const pcs = pics.map(p => { const c = el('button', 'mpic', picHTML(p, WORDS[p]) + '<div class="got"></div>'); c.dataset.k = p; top.appendChild(c); return c; });
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
    const m = el('div', 'match'); m.append(top, low);
    s.append(m, guide('think', '낱말을 그림에 짝지어 봐', true)); pointSay('ui_match');
  },
  /* 같이 읽기 */
  sentence(i, id, s, done) {
    const sen = SENTENCES[i], opts = shuffle([i, ...others(SENTENCES.map((_, k) => k), i, 2)]);
    const cards = opts.map(k => { const c = el('button', 'ch', PHRASE(k) ? '<img alt="" src="' + PHRASE(k) + '">' : '<div class="pair">' + SENTENCES[k].pics.map(picSlot).join('') + '</div>'); c.dataset.k = k; return c; });
    const words = sen.text.split(' ');
    const pr = el('div', 'prompt', '<div class="body sent">' + words.map(w => '<span>' + w + '</span>').join(' ') + '</div>');
    const spans = [...pr.querySelectorAll('.sent span')];
    const total = sen.text.length, ends = []; let acc = 0; words.forEach(w => { acc += w.length + 1; ends.push(acc / (total + 1)); });
    const prompt = async () => {
      stopAudio(); setChar('point'); const t = sayToken; spans.forEach(x => x.classList.remove('lit'));
      await playOne(VOICE.sentence(i), p => { if (t === sayToken) spans.forEach((x, k) => x.classList.toggle('lit', k === 0 || p >= (ends[k - 1] - 0.04))); });
      if (t !== sayToken) return; spans.forEach(x => x.classList.add('lit')); pointSay('ui_which');
    };
    pr.append(speakerBtn(prompt));
    s.append(pr, el('div', 'ask', '어떤 그림일까?'), choiceRound(id, cards, opts.indexOf(i), done), guide('think', '같이 읽어 보자', true));
    prompt();
  },
  trace(j, id, s, done) { traceRound(j, id, s, done, false); },
  copy(j, id, s, done) { traceRound(j, id, s, done, true); }
};

/* 끌기(또는 누르기) — v1과 같음 */
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
      n.classList.remove('drag'); const back = () => { n.classList.add('back'); n.style.transform = ''; };
      if (!moved) { back(); onTap(); return; }
      if (!onDrop(ev.clientX, ev.clientY)) back();
    };
    n.addEventListener('pointermove', move); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
  });
}

/* ---------- 따라 쓰기 / 보고 쓰기 (v1 판정 그대로) ---------- */
const TRACE_PX = { guide: 30, dash: 8, ink: 20, trail: 20, dot: 13, pad: 6 };
function strokePoints(st) { if (Array.isArray(st)) return st; const [cx, cy, r] = st.c, pts = []; for (let k = 0; k <= 48; k++) { const a = -Math.PI / 2 - k * (2 * Math.PI / 48); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return pts; }
function densify(lines, step = 2) { const out = []; lines.forEach(pts => { for (let i = 0; i < pts.length; i++) { if (i === 0) { out.push(pts[0]); continue; } const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); } }); return out; }
function minDist(p, pts) { let m = 1e9; for (const q of pts) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < m) m = d; } return Math.sqrt(m); }
function judgeTrace(guide, ink, loose) {
  const tol = TRACE.tol * (loose ? 1.4 : 1), stray = TRACE.stray * (loose ? 1.4 : 1);
  const inkPts = densify(ink); if (inkPts.length < 4) return false;
  for (const g of guide) { const sm = densify([g], 2.5); if (sm.filter(p => minDist(p, inkPts) <= tol).length / sm.length < TRACE.cover) return false; }
  const gAll = densify(guide, 2.5); return inkPts.filter(p => minDist(p, gAll) > stray).length / inkPts.length <= TRACE.strayMax;
}
function traceRound(j, id, s, done, copyMode) {
  const guideP = STROKES[j].map(strokePoints);
  const xs = guideP.flat().map(p => p[0]), ys = guideP.flat().map(p => p[1]);
  const bb = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  s.append(guide('think', copyMode ? '<b>' + j + '</b> 보고 써 봐' : '점을 따라 <b>' + j + '</b> 써 봐'));
  const box = el('div', 'trace');
  box.innerHTML = '<svg><path class="g1" fill="none" stroke="' + (copyMode ? '#F4EFE9' : '#EFE6DA') + '" stroke-width="' + TRACE_PX.guide + '" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path class="g2" fill="none" stroke="#F27BA6" stroke-width="' + TRACE_PX.dash + '" stroke-dasharray="0.1 14" stroke-linecap="round"' + (copyMode ? ' opacity="0"' : '') + '/>' +
    guideP.map((_, k) => '<path class="tr" data-k="' + k + '" d="" fill="none" stroke="#F27BA6" stroke-opacity=".5" stroke-width="' + TRACE_PX.trail + '" stroke-linecap="round" stroke-linejoin="round"/>').join('') +
    '<circle class="mover" r="' + TRACE_PX.dot + '" fill="#F27BA6" stroke="#fff" stroke-width="4" cx="-50" cy="-50"/></svg><canvas></canvas>' + (copyMode ? '<div class="model">' + j + '</div>' : '');
  const svg = box.querySelector('svg'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), mover = box.querySelector('.mover');
  const trails = [...box.querySelectorAll('.tr')], T = { s: 1, ox: 0, oy: 0 };
  const toPx = ([x, y]) => [T.ox + x * T.s, T.oy + y * T.s], toU = ([x, y]) => [(x - T.ox) / T.s, (y - T.oy) / T.s];
  const dPx = pts => 'M' + pts.map(p => toPx(p).map(v => v.toFixed(1)).join(' ')).join(' L');
  let ink = [], cur = null, tries = 0, busy = false, demoTok = 0, parked = guideP[0][0];
  const placeMover = p => { const [x, y] = toPx(p); mover.setAttribute('cx', x); mover.setAttribute('cy', y); };
  const fit = () => {
    const r = box.getBoundingClientRect(); if (!r.width) return;
    const W = r.width, Hh = r.height, pad = TRACE_PX.guide / 2 + TRACE_PX.pad;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    T.s = Math.min((W - 2 * pad) / Math.max(bb.x1 - bb.x0, 1), (Hh - 2 * pad) / Math.max(bb.y1 - bb.y0, 1)) * 0.92;
    T.ox = W / 2 - T.s * (bb.x0 + bb.x1) / 2; T.oy = Hh / 2 - T.s * (bb.y0 + bb.y1) / 2;
    const all = guideP.map(dPx).join(' '); svg.querySelector('.g1').setAttribute('d', all); svg.querySelector('.g2').setAttribute('d', all);
    trails.forEach(t => { const u = t.dataset.u ? JSON.parse(t.dataset.u) : []; t.setAttribute('d', u.length ? dPx(u) : ''); });
    placeMover(parked); const d = window.devicePixelRatio || 1; cv.width = W * d; cv.height = Hh * d; redraw();
  };
  const redraw = () => {
    const d = window.devicePixelRatio || 1; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#F47B58'; ctx.lineWidth = TRACE_PX.ink;
    ink.forEach(st => { ctx.beginPath(); st.forEach((p, i) => { const [x, y] = toPx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (st.length === 1) { const [x, y] = toPx(st[0]); ctx.lineTo(x + 0.1, y); } ctx.stroke(); });
  };
  const setTrail = (k, pts) => { trails[k].dataset.u = JSON.stringify(pts); trails[k].setAttribute('d', pts.length ? dPx(pts) : ''); };
  const clearTrails = () => trails.forEach((t, k) => setTrail(k, []));
  const toLocal = e => { const r = box.getBoundingClientRect(); return toU([e.clientX - r.left, e.clientY - r.top]); };
  async function demo() {
    const tok = ++demoTok; clearTrails(); mover.style.display = ''; if (window.HP && HP.trace) HP.trace.demoDone = false;
    for (let k = 0; k < guideP.length; k++) {
      const dd = densify([guideP[k]], 1), got = [];
      for (const p of dd) { if (tok !== demoTok || !alive(id)) return; parked = p; placeMover(p); got.push(p); setTrail(k, got); await wait(22); }
      await wait(380);
    }
    if (window.HP && HP.trace) HP.trace.demoDone = true;
    await wait(1200);
    if (tok === demoTok && alive(id)) { clearTrails(); parked = guideP[0][0]; placeMover(parked); if (copyMode) mover.style.display = 'none'; }
  }
  const clear = () => { ink = []; redraw(); };
  const check = async () => {
    if (judgeTrace(guideP, ink, copyMode)) { busy = true; demoTok++; if (await success(id)) done(tries === 0); return; }
    const inkLen = densify(ink).length * 2, gLen = densify(guideP).length * 2;
    if (ink.length >= guideP.length + 2 || inkLen > gLen * 2.5) {
      tries++; busy = true;
      if (tries >= TRACE.maxTries) { setChar('cheer'); await say('ui_together'); clear(); await demo(); if (alive(id)) done(null); return; }   // 숙달 계산 제외, 벌점 없음
      await retryFx(id, null); clear(); busy = false; demo();
    }
  };
  cv.addEventListener('pointerdown', e => { if (busy) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); demoTok++; clearTrails(); if (copyMode) mover.style.display = 'none'; cur = [toLocal(e)]; ink.push(cur); redraw(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; cur.push(toLocal(e)); redraw(); });
  const end = () => { if (!cur) return; cur = null; check(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const prompt = () => { setChar('think'); say([VOICE.jamo(j), 'ui_trace']); demo(); };
  const tools = el('div', 'tools');
  const hb = el('button', 'kid-btn', '<img alt="" src="' + ICON('speaker') + '">' + (copyMode ? '보여 줘' : '다시 보기')); hb.addEventListener('click', prompt);
  const eb = el('button', 'kid-btn', '지우기'); eb.addEventListener('click', () => { if (!busy) clear(); });
  tools.append(hb, eb);
  s.append(box, tools, el('div', '', '<div style="height:20px"></div>'));
  fit(); requestAnimationFrame(fit); new ResizeObserver(fit).observe(box);
  if (window.HP) HP.trace = { letter: j, guide: guideP, demoDone: false, inject: pts => { ink.push(pts); redraw(); return check(); } };
  if (copyMode) { say([VOICE.jamo(j), 'ui_trace']); mover.style.display = 'none'; } else prompt();
}

/* ---------- 스티커 받기 ---------- */
function showSticker(r, thenEnd) {
  const [id, s] = screen('reward', { home: false });
  const sid = STICKER_IDS[S.stickers.length % STICKER_IDS.length]; S.stickers.push(sid); S.session.stickers.push(sid); save();
  const box = el('div', 'reward');
  const stk = el('div', 'stk', '<img alt="스티커" src="' + STICKER(sid) + '">');
  const m = charEl('surprise');
  box.append(stk, el('h1', '', '스티커 받았어!'), m);
  const stg = stage(r.pid);
  if (r.newlyMastered || stg === 'fruit') box.append(el('div', 'grow', '<img alt="" src="' + ICON(stg === 'fruit' ? 'fruit' : 'flower') + '">정원에 ' + (stg === 'fruit' ? '열매가 열렸어요' : '꽃이 피었어요')));
  s.append(box);
  const dock = el('div', 'dock'); s.append(dock);
  setTimeout(() => { if (!alive(id)) return; stk.classList.add('show'); sparkPop(); ding(); }, 250);
  (async () => {
    await say('ui_sticker'); if (!alive(id)) return;
    setChar('clap'); bounce(); await say('ui_good' + (1 + rand(3))); if (!alive(id)) return;
    const b = el('button', 'kid-btn next', thenEnd ? '다음<img alt="" src="' + ICON('arrow') + '">' : '<img alt="" src="' + ICON('home') + '" style="filter:brightness(10)">처음으로'); b.id = 'afterReward';
    b.addEventListener('click', () => (thenEnd ? showEnd() : showHome())); dock.append(b);
  })();
}

/* ---------- 오늘 끝 / 쉬는 화면 ---------- */
function paperTip() {
  const met = Object.keys(S.met).filter(j => S.met[j] === today());
  const j = met[met.length - 1] || 'ㄱ', e = JAMO_EX[j];
  return '종이에 ' + j + '을(를) 크게 써 주고 따라 그려 보게 해 주세요. 집에서 ‘' + e.word[0] + '’로 시작하는 물건이나 ' + e.word + ' 그림을 함께 찾아봐도 좋아요.';
}
function showEnd() {
  const [id, s] = screen('end', { night: true }); S.session.ended = true; save(); drawTime();
  const hero = el('div', 'endhero', '<img class="moon" alt="" src="' + ICON('moon') + '">'); hero.append(mg('sleep'), el('h1', '', '오늘 놀이 끝!'), el('p', '', '내일 또 만나'));
  const sts = S.session.stickers, last = sts[sts.length - 1];
  const done = S.session.done.map(playById).filter(Boolean);
  const card = el('div', 'today', '<div class="st">' + (last ? '<img alt="오늘 스티커" src="' + STICKER(last) + '">' : '<img alt="" src="' + ICON('sticker') + '" style="width:48px;height:48px">') + '</div>' +
    '<div class="txt"><b>' + (sts.length ? '오늘 스티커 ' + sts.length + '장 받았어' : '오늘도 잘 놀았어') + '</b><div class="played">' +
    done.slice(0, 5).map(p => { const col = rowOf(p).color; const inner = ['letter', 'pick', 'merge', 'trace', 'copy'].includes(p.kind) ? '<span class="s">' + p.items[0] + '</span>' : (hasPic(p.pic) ? '<img alt="" src="' + PIC(p.pic) + '">' : '<img alt="" src="' + ICON('clap') + '">'); return '<span class="t-' + col + '">' + inner + '</span>'; }).join('') +
    '</div><div class="note">정원: 꽃 ' + PLAYS.filter(p => stage(p.id) !== 'sprout').length + ' · 열매 ' + PLAYS.filter(p => stage(p.id) === 'fruit').length + '</div></div>');
  const paper = el('div', 'paper', '<div class="h"><img alt="" src="' + ICON('pencil') + '">보호자께 · 종이 놀이 한 가지</div><p>' + paperTip() + '</p>');
  const dock = el('div', 'dock'); const b = el('button', 'kid-btn lav', '잘 자, 몽글아'); b.id = 'nightBtn'; b.addEventListener('click', showRest); dock.append(b);
  s.append(hero, card, paper, dock);
  setTimeout(() => alive(id) && say('ui_end'), 400);
}
function showRest() {
  const [, s] = screen('rest', { night: true });
  const r = el('div', 'rest'); r.append(mg('sleep'), el('div', '', '몽글이가 자고 있어요. 내일 또 만나요.'), el('div', 'faint', '어른 메뉴에서 다시 시작할 수 있어요'));
  s.append(r);
}

/* ---------- 어른 확인(셈 문제) ---------- */
$('#adultBtn').addEventListener('click', openGate);
let gateResume = false;
function openGate() {
  gateResume = ticking; ticking = false; stopAudio();
  const G = $('#gate'); G.hidden = false;
  let a, b, typed = '';
  const newQ = () => { a = 6 + rand(4); b = 4 + rand(6); if (a + b < 10) b = 10 - a + rand(3); typed = ''; draw(); };
  const draw = () => { G.querySelector('.qa').textContent = a + ' + ' + b + ' ='; const an = G.querySelector('.ans'); an.textContent = typed || '?'; an.classList.toggle('has', !!typed); };
  G.innerHTML = '<div class="dim"></div><div class="sheet" role="dialog" aria-label="어른 확인"><div class="grab"></div><div class="t"><h1>어른 확인</h1><button class="x" id="gateX"><img alt="닫기" src="' + ICON('close') + '"></button></div>' +
    '<p>설정은 어른이 바꿔요. 답을 눌러 주세요.</p><div class="q"><span class="qa"></span><span class="ans">?</span></div><div class="keys">' +
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button data-n="' + n + '">' + n + '</button>').join('') + '<button class="del" data-n="del">지우기</button><button data-n="0">0</button></div>' +
    '<div class="alt">문제는 매번 바뀌어요 · 틀려도 새 문제만 나와요</div></div>';
  const close = () => { G.hidden = true; G.innerHTML = ''; ticking = gateResume; };
  G.querySelector('.dim').addEventListener('click', close); $('#gateX').addEventListener('click', close);
  G.querySelector('.keys').addEventListener('click', e => {
    const k = e.target.closest('button'); if (!k) return;
    if (k.dataset.n === 'del') { typed = typed.slice(0, -1); return draw(); }
    typed += k.dataset.n; draw();
    const want = String(a + b);
    if (typed.length >= want.length) {
      if (typed === want) { G.hidden = true; G.innerHTML = ''; openParent(); }
      else { const sh = G.querySelector('.sheet'); sh.classList.remove('retry'); void sh.offsetWidth; sh.classList.add('retry'); setTimeout(newQ, 350); }
    }
  });
  newQ(); if (window.HP) HP.gate = { get a() { return a; }, get b() { return b; } };
}

/* ---------- 어른 메뉴 ---------- */
function weekStats() {
  const wk = S.log.filter(x => x.d >= today(-6));
  const ms = wk.reduce((t, x) => t + (x.ms || 0), 0);
  const met = Object.keys(S.met).filter(j => S.met[j] >= today(-6));
  const words = [...new Set(wk.map(x => playById(x.play)).filter(p => p && p.row === 'word').map(() => null))];
  const firsts = [...new Set(wk.map(x => x.play))].filter(pid => !S.log.some(y => y.play === pid && y.d < today(-6))).map(pid => playById(pid)).filter(Boolean).map(p => p.name);
  return { n: wk.length, min: Math.round(ms / 60000), met, firsts, words };
}
function openParent() {
  stopAudio(); ticking = false;
  const PM = $('#parent'); PM.hidden = false;
  const w = weekStats(), left = Math.max(0, Math.ceil((limitMs() - S.session.usedMs) / 60000));
  const seg = (name, vals, cur) => '<div class="seg" data-n="' + name + '">' + vals.map(([v, t]) => '<button data-v="' + v + '" class="' + (String(v) === String(cur) ? 'on' : '') + '">' + t + '</button>').join('') + '</div>';
  PM.innerHTML = '<div class="pm" role="dialog" aria-label="어른 메뉴"><div class="head"><h1>어른 메뉴</h1><button class="x" id="pmClose"><img alt="닫기" src="' + ICON('close') + '"></button></div>' +
    '<div class="cap">이번 주에 해 본 것</div><div class="sec sum"><div class="big">' + w.n + '번 놀았어요 <span class="muted">· 모두 ' + w.min + '분</span></div>' +
    '<div class="met">' + (w.met.length ? w.met.map(j => '<span>' + j + '</span>').join('') : '<span class="w">아직 없어요</span>') + '</div>' +
    '<div class="tip">' + (w.firsts.length ? '처음 해 본 놀이: ' + w.firsts.slice(0, 4).join(', ') : '오늘의 놀이부터 시작해 보세요.') + '<br>오늘 남은 시간: 약 ' + left + '분' + (S.session.ended ? ' (끝 화면)' : '') + ' · 스티커 ' + S.stickers.length + '장 · 꽃 ' + PLAYS.filter(p => stage(p.id) !== 'sprout').length + '/' + PLAYS.length + '</div></div>' +
    '<div class="cap">놀이</div><div class="sec">' +
    '<div class="r"><div class="l">한 번 놀이 시간</div>' + seg('timerMin', [[10, '10분'], [12, '12분'], [15, '15분']], S.settings.timerMin) + '</div>' +
    '<div class="r"><div class="l">오늘의 놀이 자동 추천<small>복습 1 + 새 놀이 1~2 + 좋아하는 놀이 1</small></div><button class="tg' + (S.settings.autoPick ? ' on' : '') + '" id="tgAuto" aria-label="자동 추천"></button></div>' +
    '<button class="r" id="rManual"><div class="l">직접 고르기<small>오늘 할 놀이 최대 3개 · 자동 추천을 끄면 이것만 나와요</small></div><div class="v"><img alt="" src="' + ICON('back') + '"></div></button>' +
    '<div class="more" id="mManual" hidden><div class="chips">' + PLAYS.map(p => '<button data-p="' + p.id + '" class="' + (S.settings.manual.includes(p.id) ? 'on' : '') + '">' + rowOf(p).name + ' · ' + p.name + '</button>').join('') + '</div><small>고른 놀이는 지금 바로 오늘의 놀이에 반영돼요.</small></div>' +
    '</div><div class="cap">소리</div><div class="sec">' +
    '<div class="r"><div class="l">소리 켜기</div><button class="tg' + (S.settings.sound ? ' on' : '') + '" id="tgSound" aria-label="소리"></button></div>' +
    '<div class="r"><div class="l">소리 크기</div><input type="range" id="vol" min="0.2" max="1" step="0.1" value="' + S.settings.volume + '" aria-label="소리 크기"></div>' +
    '<div class="r"><div class="l">목소리<small>AI 음성(Supertonic 3, 기기 안에서 만든 녹음 파일)</small></div></div>' +
    '</div><div class="sec" style="margin-top:12px"><button class="r" id="rPaper"><div class="l">종이 놀이 아이디어<small>이번 주 글자로 집에서 할 것 ' + PAPER_IDEAS.length + '가지</small></div><div class="v"><img alt="" src="' + ICON('back') + '"></div></button>' +
    '<div class="more" id="mPaper" hidden><ul>' + PAPER_IDEAS.map(t => '<li>' + t + '</li>').join('') + '</ul><small>오늘 추천: ' + paperTip() + '</small></div></div>' +
    '<div class="acts"><button id="pmRestart">놀이 다시 시작</button><button class="warn" id="pmReset">기록 지우기</button></div>' +
    '<div class="foot">기록은 이 기기에만 저장돼요 · 광고·로그인·수집 없음<br>하루 화면 시간은 짧게, 종이·책 놀이와 함께 해 주세요.</div></div>';
  PM.querySelectorAll('.seg').forEach(sg => sg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; S.settings[sg.dataset.n] = +b.dataset.v; save();
    sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); drawTime();
  }));
  const tgl = (idn, key, after) => $('#' + idn).addEventListener('click', e => { S.settings[key] = !S.settings[key]; e.currentTarget.classList.toggle('on', S.settings[key]); if (after) after(); save(); });
  tgl('tgAuto', 'autoPick', () => { S.session.list = null; }); tgl('tgSound', 'sound');
  $('#vol').addEventListener('input', e => { S.settings.volume = +e.target.value; save(); });
  const fold = (r, m) => $('#' + r).addEventListener('click', e => { const mm = $('#' + m); mm.hidden = !mm.hidden; e.currentTarget.classList.toggle('open', !mm.hidden); });
  fold('rManual', 'mManual'); fold('rPaper', 'mPaper');
  $('#mManual').addEventListener('click', e => {
    const b = e.target.closest('button[data-p]'); if (!b) return; const id = b.dataset.p, m = S.settings.manual;
    if (m.includes(id)) m.splice(m.indexOf(id), 1); else { if (m.length >= 3) m.shift(); m.push(id); }
    $('#mManual').querySelectorAll('button[data-p]').forEach(x => x.classList.toggle('on', m.includes(x.dataset.p)));
    S.session.list = null; save();
  });
  $('#pmRestart').addEventListener('click', () => { S.session = Object.assign(fresh().session, { date: today() }); save(); closeParent(); });
  let armed = false;
  $('#pmReset').addEventListener('click', e => {
    if (!armed) { armed = true; e.currentTarget.textContent = '정말 지울까요? 한 번 더'; return; }
    const keep = S.settings; S = fresh(); S.settings = keep; S.session.date = today(); save(); closeParent();
  });
  $('#pmClose').addEventListener('click', closeParent);
}
function closeParent() { const PM = $('#parent'); PM.hidden = true; PM.innerHTML = ''; run = null; showHome(); }

/* ---------- 시작 ---------- */
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { save(); stopAudio(); } });
if ('speechSynthesis' in window) speechSynthesis.getVoices();
window.HP = { get S() { return S; }, get run() { return run; }, save, limitMs, screen: '', round: null, trace: null, judgeTrace, STROKES, strokePoints, record, isMastered, today, startPlay, showHome, showGarden, showEnd, showBook, openGate, computeToday, audioLog: [], audioErr: [] };
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
showHome();
