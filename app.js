'use strict';
/* 한글 놀이 v3 — 10주 주제 화단(잠금 없음) + 하루 흐름(인사→다시 보기→이번 주 놀이→몸으로 글자→고르기→잘 자) + 글자 친구 도감. v2 기반. 네트워크 호출 없음. 기록은 이 기기의 localStorage에만.
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
const JNAME = { 'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음', 'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅎ': '히읗', 'ㅏ': '아', 'ㅓ': '어', 'ㅗ': '오', 'ㅜ': '우', 'ㅡ': '으', 'ㅣ': '이', 'ㅊ': '치읓', 'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅑ': '야', 'ㅕ': '여', 'ㅛ': '요', 'ㅠ': '유' };
const playById = id => PLAYS.find(p => p.id === id);
const rowOf = p => topicById(p.topic) || TOPICS[0];
const curTopic = () => topicById(S.topic) || TOPICS[0];
const realIds = a => a.filter(x => x[0] !== '@');
const compose = (c, v) => String.fromCharCode(0xAC00 + CHO.indexOf(c) * 588 + JUNG.indexOf(v) * 28);

/* ---------- 저장 (v3 새 키. v2·v1 기록은 읽기만 하고 지우지 않음) ---------- */
const KEY = 'hangul-play-v3', KEY_V2 = 'hangul-play-v2', KEY_V1 = 'hangul-play-v1';
const fresh = () => ({ v: 3, topic: 't1', suggestOff: '', settings: { timerMin: 10, sound: true, volume: 0.9, autoPick: true, manual: [] }, plays: {}, review: {}, stickers: [], log: [], met: {}, words: {}, pw: { stars: 0, jars: 0, streak: {} }, hid: {}, session: { date: '', usedMs: 0, ended: false, done: [], stickers: [], list: null, moved: false } });
let S;
function v1toV2(o) {   // v2 앱의 v1 → v2 옮기기와 같음
  const r = { stickers: (o.stickers || []).slice(), settings: {}, plays: {}, review: {}, met: {}, log: [] };
  if (o.settings) { r.settings.timerMin = [10, 12, 15].includes(o.settings.timerMin) ? o.settings.timerMin : (o.settings.timerMin > 12 ? 15 : 10); r.settings.sound = o.settings.sound !== false; }
  Object.entries(o.units || {}).forEach(([u, rec]) => (V1_MAP[u] || []).forEach(pid => {
    const hist = (rec.hist || []).map(x => (typeof x === 'number' ? { ok: x, d: '' } : x));
    r.plays[pid] = { hist: hist.slice(-MASTERY.window), mastered: !!rec.mastered, count: hist.length };
    if (o.review && o.review[u]) r.review[pid] = Object.assign({}, o.review[u]);
  }));
  return r;
}
function load() {
  let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
  if (raw) { S = Object.assign(fresh(), raw); S.pw = Object.assign(fresh().pw, raw.pw); S.settings = Object.assign(fresh().settings, raw.settings); S.session = Object.assign(fresh().session, raw.session); return; }
  S = fresh();
  try {   // v2(또는 v1) → v3 옮기기: 스티커·설정·만난 글자·놀이 기록(숙달)·다시 보기
    let o = JSON.parse(localStorage.getItem(KEY_V2) || 'null'), from = 'v2';
    if (!o) { const o1 = JSON.parse(localStorage.getItem(KEY_V1) || 'null'); if (o1) { o = v1toV2(o1); from = 'v1'; } }
    if (o) {
      S.migratedFrom = from; S.stickers = (o.stickers || []).slice(); S.met = Object.assign({}, o.met || {});
      const st = o.settings || {}; ['timerMin', 'sound', 'volume', 'autoPick'].forEach(k => { if (st[k] != null) S.settings[k] = st[k]; });
      S.settings.manual = (st.manual || []).map(id => (V2_MAP[id] || [])[0]).filter(Boolean).slice(0, 3);
      Object.entries(o.plays || {}).forEach(([pid, rec]) => (V2_MAP[pid] || []).forEach(nid => {
        if (!playById(nid)) return; S.plays[nid] = { hist: (rec.hist || []).slice(), mastered: !!rec.mastered, count: rec.count || 0 };
        if (o.review && o.review[pid]) S.review[nid] = Object.assign({}, o.review[pid]);
      }));
      S.log = (o.log || []).map(x => Object.assign({}, x, { play: (V2_MAP[x.play] || [])[0] })).filter(x => x.play);
    }
  } catch (e) { /* 옛 기록이 깨졌으면 새로 시작 */ }
}
load();
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
    player.play().catch(err => { if (playSeq !== my || (err && (err.name === 'NotAllowedError' || err.name === 'AbortError'))) finish(); else if (player.onerror) player.onerror(); });   // v3: 새 소리로 끊긴 것(AbortError)은 오류가 아님
  });
}
function stopAudio() { sayToken++; player.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); if (pending) pending(); }
function say(keys, each) {
  stopAudio(); const t = sayToken;
  return [].concat(keys).reduce((p, k, i) => p.then(() => { if (t !== sayToken) return; if (each) each(i, true); return playOne(k).then(() => each && t === sayToken && each(i, false)); }), Promise.resolve()).then(() => t === sayToken);
}
async function sayGap(keys, gap, each) {   // 낱말 사이에 쉼(뚝딱 소리 붙이기 "하… 마")
  stopAudio(); const t = sayToken;
  for (let i = 0; i < keys.length; i++) { if (t !== sayToken) return false; if (each) each(i); await playOne(keys[i]); if (t !== sayToken) return false; if (i < keys.length - 1) await wait(gap); }
  return t === sayToken;
}
function clapFx() {   // 손뼉 소리(짧은 잡음, 기기 안에서 만듦)
  if (!S.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const len = Math.floor(actx.sampleRate * 0.09), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8; g.gain.value = 0.9 * S.settings.volume;
    src.connect(f).connect(g).connect(actx.destination); src.start();
  } catch (e) { /* 소리 없이 */ }
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
const picHTML = (w, label, cls = '') => hasPic(w) ? '<img class="' + cls + '" alt="' + (label || '') + '" src="' + PIC(w) + '">' : '<div class="ph ' + (PH_EMOJI[w] ? 'emo ' : '') + cls + '" aria-label="' + (label || WORDS[w] || '') + '">' + (PH_EMOJI[w] || (label || WORDS[w] || '?')[0]) + '</div>';
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
  if (!u.mastered && isMastered(u.hist)) { u.mastered = true; if (!S.review[pid]) S.review[pid] = { box: 0, due: today(REVIEW_DAYS[0]) }; return true; }
  return false;
}
function reviewDone(pid, okRate) { const r = S.review[pid]; if (!r) return; r.box = okRate >= 0.8 ? Math.min(r.box + 1, REVIEW_DAYS.length - 1) : 0; r.due = today(REVIEW_DAYS[r.box]); }
const stage = pid => { const u = P(pid); return u.count >= FRUIT_AT ? 'fruit' : u.mastered ? 'flower' : 'sprout'; };
const STAGE_ICON = { sprout: 'sprout', flower: 'flower', fruit: 'fruit' };

/* ---------- 오늘의 놀이(하루 흐름): 다시 보기 1 → 이번 주 놀이 2(12·15분이면 3) → [몸으로 글자] → 내가 고르기 → 잘 자
   쓰기는 이틀에 한 번. 토요일은 '모아 놀기'(이번 주 놀이를 하나씩, 새 내용 없음). ---------- */
const isWeekend = () => new Date().getDay() === WEEKEND_DAY;
function computeToday() {
  const out = [], has = id => out.some(x => x.id === id), push = (p, tag) => { if (p && !has(p.id)) out.push({ id: p.id, tag }); };
  if (!S.settings.autoPick && S.settings.manual.length) { S.settings.manual.map(playById).filter(Boolean).forEach(p => push(p, 'pick')); out.push({ id: '@pick', tag: 'choose' }); return out; }
  const t = today(), T = curTopic(), tp = T.plays;
  const isW = p => p.kind === 'trace' || p.kind === 'copy';
  const wroteRecently = S.log.some(x => x.d >= today(-1) && playById(x.play) && isW(playById(x.play)));
  // 1. 다시 보기: 날짜가 된 것 중 가장 오래된 것(다른 주제 먼저), 없으면 지난 주제에서 해 본 놀이 하나
  const due = PLAYS.filter(p => S.review[p.id] && S.review[p.id].due <= t && !(isW(p) && wroteRecently))
    .sort((a, b) => ((a.topic === T.id) - (b.topic === T.id)) || (S.review[a.id].due < S.review[b.id].due ? -1 : 1));
  if (due.length) push(due[0], 'again');
  else { const prev = TOPICS[T.n - 2]; if (prev) push(prev.plays.filter(p => P(p.id).count && !isW(p)).sort((a, b) => P(a.id).count - P(b.id).count)[0], 'again'); }
  if (isWeekend()) {   // 모아 놀기
    tp.filter(p => P(p.id).count && !(isW(p) && wroteRecently)).forEach(p => out.length < 4 && push(p, 'gather'));
    tp.forEach(p => out.length < 3 && !(isW(p) && wroteRecently) && push(p, 'gather'));
  } else {
    const n = S.settings.timerMin >= 12 ? 3 : 2;
    let cand = tp.filter(p => !has(p.id) && !(isW(p) && wroteRecently));
    cand = cand.filter(p => !P(p.id).mastered).concat(cand.filter(p => P(p.id).mastered));
    const w = !wroteRecently && cand.find(isW);
    const pick = cand.filter(p => !isW(p)).slice(0, w ? n - 1 : n); if (w) pick.splice(1, 0, w);
    pick.forEach(p => push(p, P(p.id).count ? 'week' : 'new'));
  }
  out.push({ id: '@pick', tag: 'choose' });
  return out;
}
function todayList() {
  ensureSession();
  if (!S.session.list) { S.session.list = computeToday(); save(); }
  return S.session.list.filter(x => x.id === '@pick' || playById(x.id));
}
const TAG = { new: ['sprout', '처음'], again: ['', '다시 보기'], week: ['', '이번 주'], gather: ['', '모아 놀기'], write: ['pencil', '쓰기'], pick: ['', '오늘 할 것'], choose: ['', '내가 고르기'], fav: ['', '좋아해요'] };
const flowersIn = T => T.plays.filter(p => stage(p.id) !== 'sprout').length;
function suggestion() {   // 꽃 2개 이상 → 다음 주제 추천(잠금 아님)
  const T = curTopic(), nx = TOPICS[T.n];
  return nx && flowersIn(T) >= FLOWERS_TO_SUGGEST && S.suggestOff !== T.id ? nx : null;
}
function setTopic(id) { S.topic = id; S.session.list = null; save(); }

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
const EMO = k => '<span class="emo">' + KINDS[k].icon + '</span>';
function playArt(p, big) {
  const it = p.items;
  if (p.kind === 'letter') { const j = it[(P(p.id).count * 3) % it.length]; return '<span class="glyph">' + j + '</span>' + exPic(j); }
  if (p.kind === 'pick') return '<span class="glyph' + (big ? '' : ' s') + '">' + it.slice(0, 3).join(' ') + '</span>';
  if (p.kind === 'merge') return '<span class="glyph">' + it[0] + '</span>';
  if (p.kind === 'trace' || p.kind === 'copy') return '<span class="glyph">' + it[0] + '</span><img alt="" src="' + ICON('pencil') + '" style="width:40px;height:40px">';
  if (p.kind === 'name') return '<span class="glyph s namegl">' + WORDS.ryeowon + '</span>';
  if (p.kind === 'clap') return picHTML(it[0], WORDS[it[0]]) + '<img alt="" src="' + ICON('clap') + '" style="width:44px;height:44px">';
  if (p.kind === 'train') return (hasPic('train_engine') ? picHTML('train_engine') : EMO('train')) + '<span class="glyph s">가나다</span>';
  if (p.kind === 'story') return hasPic('story_1') ? picHTML('story_1') : EMO('story');
  if (p.kind === 'same') return EMO('same') + picHTML(SAME[it[0]]);
  if (p.kind === 'listen') return picHTML(it[0]) + picHTML(it[1]);
  return picHTML(it[0], WORDS[it[0]]);
}
function playName(p) {
  if (p.kind === 'letter') { const j = p.items[(P(p.id).count * 3) % p.items.length]; return KINDS.letter.kid + ' <span class="muted">· ' + JNAME[j] + '</span>'; }
  return p.name;
}
function smallInner(p) {   // 정원 버튼 안
  if (['letter', 'pick', 'merge', 'trace', 'copy'].includes(p.kind)) return '<span class="glyph' + (p.kind === 'pick' ? ' s' : '') + '">' + (p.kind === 'pick' ? p.items.slice(0, 3).join('') : p.items[0]) + '</span>';
  if (p.kind === 'clap') return '<img class="p" alt="" src="' + ICON('clap') + '" style="width:40px;height:40px">';
  if (p.kind === 'name') return '<span class="glyph s">' + WORDS.ryeowon + '</span>';
  return EMO(p.kind);
}

/* ---------- 홈 ---------- */
function showHome() {
  ensureSession();
  if (S.session.ended) return showRest();
  const [, s] = screen('home');
  const T = curTopic();
  let list = todayList(); const left = list.filter(x => !S.session.done.includes(x.id));
  const allDone = !left.length;
  const hero = el('div', 'hero'); hero.append(charEl(allDone ? 'laugh' : 'wave'), el('div', 'bubble', allDone ? '오늘 놀이 다 했어!<br>이제 잘 자러 갈까?' : '려원아, 안녕!<small>이번 주: ' + T.title + '</small>'));
  const R = el('div', 'homeR');
  const sug = suggestion();
  if (sug) {
    const sg = el('div', 'suggest', '<span class="ic">' + picHTML(sug.pic) + '</span><span class="tx">꽃이 피었어! <b>' + sug.short + '</b> 화단도 가 볼까?</span>');
    const yes = el('button', 'yes', '가 볼래'); yes.id = 'sugYes'; yes.addEventListener('click', () => { setTopic(sug.id); showHome(); });
    const no = el('button', 'no', '나중에'); no.addEventListener('click', () => { S.suggestOff = T.id; save(); showHome(); });
    sg.append(yes, no); R.append(sg);
  }
  R.append(el('div', 'label', '<span>오늘의 놀이' + (isWeekend() && S.settings.autoPick ? ' · 모아 놀기 날' : '') + '</span><span class="faint">' + realIds(list.map(x => x.id)).length + '개 + 내가 고르기</span>'));
  const grid = el('div', 'plays');
  const order = left.concat(list.filter(x => S.session.done.includes(x.id)));
  let bigUsed = false;
  order.forEach(x => {
    const done = S.session.done.includes(x.id), [ic, tx] = TAG[x.tag] || TAG.again;
    if (x.id === '@pick') {
      const c = el('button', 'pcard small c-mint choose' + (done ? ' done' : ''), '<span class="tag choose">' + tx + '</span><div class="art"><img alt="" src="' + ICON('garden') + '" style="width:76px;height:76px"></div><div class="name">정원에서 골라요</div><span class="play"><img alt="" src="' + ICON('play') + '"></span>' + (done ? '<span class="chk"><img alt="" src="' + ICON('check') + '"></span>' : ''));
      c.dataset.play = '@pick'; c.addEventListener('click', showGarden); grid.appendChild(c); return;
    }
    const p = playById(x.id), col = rowOf(p).color, big = !bigUsed && !done; if (big) bigUsed = true;
    const c = el('button', 'pcard ' + (big ? 'big' : 'small') + ' c-' + col + (done ? ' done' : ''));
    c.dataset.play = p.id;
    c.innerHTML = '<span class="tag ' + x.tag + '">' + (ic ? '<img alt="" src="' + ICON(ic) + '">' : '') + tx + '</span>' +
      '<div class="art' + (['listen', 'clap', 'same', 'train'].includes(p.kind) ? ' pair' : '') + '">' + playArt(p, big) + '</div><div class="name">' + playName(p) + '</div>' +
      (big ? '<span class="go"><img alt="" src="' + ICON('play') + '"></span>' : '<span class="play"><img alt="" src="' + ICON('play') + '"></span>') +
      (done ? '<span class="chk"><img alt="" src="' + ICON('check') + '"></span>' : '');
    c.setAttribute('aria-label', p.name + ' 시작');
    c.addEventListener('click', () => startPlay(p.id, 'today'));
    grid.appendChild(c);
  });
  if (allDone || realIds(S.session.done).length >= 3) { const nb = el('button', 'kid-btn lav sleepBtn', '<img alt="" src="' + ICON('moon') + '">잘 자, 몽글아'); nb.id = 'toEnd'; nb.addEventListener('click', showEnd); grid.appendChild(nb); }
  R.append(grid);
  const dock = el('div', 'dock');
  const gb = el('button', 'kid-btn', '<img alt="" src="' + ICON('garden') + '">정원'); gb.id = 'gardenBtn'; gb.addEventListener('click', showGarden);
  const db = el('button', 'kid-btn', '<span class="dexic">가</span>글자 친구'); db.id = 'dexBtn'; db.addEventListener('click', showDex);
  const sb = el('button', 'kid-btn', '<img alt="" src="' + ICON('sticker') + '">스티커'); sb.id = 'bookBtn'; sb.addEventListener('click', showBook);
  dock.append(gb, db, sb);
  s.append(hero, R, dock);
  if (!showHome.greeted) { showHome.greeted = true; say(['ui_hiname', 'ui_topic']); }
}

/* ---------- 놀이 정원: 주제 10개 화단(새싹 → 꽃 → 열매), 잠금 없음 ---------- */
function showGarden() {
  const [, s] = screen('garden', { scroll: true });
  const st = PLAYS.map(p => stage(p.id)), T = curTopic();
  const head = el('div', 'ghead');
  const back = el('button', 'icon-btn', '<img alt="뒤로" src="' + ICON('back') + '">'); back.style.cssText = 'width:56px;height:56px'; back.addEventListener('click', showHome);
  head.append(back, el('h1', '', '놀이 정원'), el('div', 'count', '<span><img alt="꽃" src="' + ICON('flower') + '">' + st.filter(x => x !== 'sprout').length + '</span><span><img alt="열매" src="' + ICON('fruit') + '">' + st.filter(x => x === 'fruit').length + '</span>'));
  const g = el('div', 'garden', '<div class="ground"></div>'); g.append(mg('laugh'));
  const plants = el('div', 'plants'); TOPICS.forEach(t => { const f = flowersIn(t), fr = t.plays.some(p => stage(p.id) === 'fruit'); plants.insertAdjacentHTML('beforeend', '<img alt="" class="' + (f ? '' : 's') + '" src="' + ICON(fr ? 'fruit' : f ? 'flower' : 'sprout') + '">'); }); g.append(plants);
  const legend = el('div', 'legend', '<span><img alt="" src="' + ICON('sprout') + '">처음</span><span><img alt="" src="' + ICON('flower') + '">해 봤어요</span><span><img alt="" src="' + ICON('fruit') + '">자주 놀아요</span><span><i></i>오늘</span>');
  const rows = el('div', 'rows'); const todays = todayList().map(x => x.id);
  TOPICS.forEach(t => {
    const row = el('div', 'row bed' + (t.id === T.id ? ' cur' : ''), '<div class="nm"><span class="no t-' + t.color + '">' + t.n + '</span>' + t.short + (t.id === T.id ? '<em>이번 주</em>' : '') + '</div>');
    row.dataset.topic = t.id; const items = el('div', 'items');
    t.plays.forEach(p => {
      const b = el('button', 'b t-' + t.color + (todays.includes(p.id) ? ' is-today' : ''), smallInner(p) + '<span class="st"><img alt="" src="' + ICON(STAGE_ICON[stage(p.id)]) + '"></span><span class="kn">' + p.name + '</span>');
      b.dataset.play = p.id; b.setAttribute('aria-label', p.name);
      b.addEventListener('click', () => startPlay(p.id, 'garden'));
      items.appendChild(b);
    });
    row.appendChild(items); rows.appendChild(row);
  });
  s.append(head, g, legend, rows);
  const cur = rows.querySelector('.bed.cur'); if (cur && T.n > 3) requestAnimationFrame(() => cur.scrollIntoView({ block: 'center' }));
}

/* ---------- 글자 친구 도감: 만난 글자가 그림과 함께 채워져요 ---------- */
function showDex() {
  const [, s] = screen('dex', { scroll: true, home: true });
  const all = [...V, ...C], met = all.filter(j => S.met[j]);
  s.append(guide(met.length ? 'laugh' : 'basic', met.length ? '글자 친구 <b>' + met.length + '</b>명 만났어!' : '놀이를 하면 글자 친구가 생겨!'));
  const g = el('div', 'dex');
  all.forEach(j => {
    const on = !!S.met[j], e = JAMO_EX[j];
    const c = el('button', 'dx' + (on ? ' on' : ''), on ? (hasPic(e.lp) ? picHTML(e.lp, e.word) : exPic(j)) + '<span class="g">' + j + '</span><span class="n">' + JNAME[j] + '</span>' : '<span class="g">' + j + '</span><span class="n">?</span>');
    c.dataset.j = j; c.addEventListener('click', () => { if (on) say(VOICE.jamo(j)); });
    g.appendChild(c);
  });
  s.append(g);
}

/* ---------- 몸으로 글자 만들기(쉬어 가기, 하루 한 번) ---------- */
function showMove(next) {
  S.session.moved = true; save();
  const [id, s] = screen('move', { home: true });
  const T = curTopic(), pose = POSES.find(x => x.j === T.move) || POSES[0];
  s.append(guide('jump', '일어나서 몸으로 <b>' + pose.j + '</b> 만들어 볼까?'));
  const box = el('div', 'movebox', (hasPic(pose.pic) ? picHTML(pose.pic) : '<img class="mgbig" alt="몽글이" src="' + CHAR_DIR + 'jump' + CHAR_EXT + '">') + '<div class="g">' + pose.j + '</div><p>' + pose.how + '</p>');
  s.append(box);
  const dock = el('div', 'dock'); const b = el('button', 'kid-btn next', '다 했어!<img alt="" src="' + ICON('arrow') + '">'); b.id = 'moveDone';
  b.addEventListener('click', () => { ding(1.3); (next || showHome)(); }); dock.append(b); s.append(dock);
  (async () => { await say(['ui_move', VOICE.jamo(pose.j)]); if (alive(id)) setChar('cheer'); })();
}
const needMove = () => !S.session.moved && realIds(S.session.done).length >= 2;

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
  const n = { letter: Math.min(3, p.items.length), train: 3, story: 4, trace: 4, copy: 3, name: 4, clap: 4, hidden: 4, picword: 5 }[p.kind] || ROUNDS;
  let queue;
  if (p.kind === 'letter') { const st0 = (P(pid).count * 3) % p.items.length; queue = Array.from({ length: n }, (_, k) => p.items[(st0 + k) % p.items.length]); }
  else if (p.kind === 'story') queue = p.items.slice();
  else if (p.kind === 'trace' || p.kind === 'copy') {   // 이번 주 글자를 차례로 돌아가며(한 번에 3개, 짧게) + 지난 글자 다시 쓰기 1개
    const it = p.items, rv = (p.review || []).filter(x => !it.includes(x)), m = rv.length ? n - 1 : n, st0 = (P(pid).count * m) % it.length;
    queue = Array.from({ length: Math.min(m, it.length) }, (_, k) => it[(st0 + k) % it.length]);
    if (rv.length) queue.push(rv[rand(rv.length)]);
  }
  else if (p.kind === 'name') queue = ['ryeowon'].concat(shuffle(p.items.filter(x => x !== 'ryeowon'))).slice(0, n);
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
    if (ok && ['readword', 'match', 'name', 'listen', 'blend', 'hidden', 'picword'].includes(run.p.kind) && WORDS[item]) S.words[item] = today();
    run.i++; save(); nextRound();
  });
}
function finishPlay(cut) {
  const r = run; run = null; ticking = false;
  if (r.p.kind === 'hidden' && r.hs) hidUpdate(r.p, r.hs);
  if (r.isReview) reviewDone(r.pid, r.first ? r.ok / r.first : 1);
  if (!S.session.done.includes(r.pid)) S.session.done.push(r.pid);
  if (r.src === 'garden' && !S.session.done.includes('@pick') && (S.session.list || []).some(x => x.id === '@pick')) S.session.done.push('@pick');
  if (REVIEW_AFTER_FIRST && !S.review[r.pid] && r.i > 0) S.review[r.pid] = { box: 0, due: today(REVIEW_DAYS[0]) };
  S.log.push({ d: today(), play: r.pid, src: r.src, ms: Date.now() - r.t0, n: r.i }); S.log = S.log.slice(-120);
  if (r.i === 0) { save(); return showEnd(); }
  showSticker(r, cut || timeUp());
}

/* ---------- 문제 엔진 ---------- */
const others = (pool, x, n) => shuffle(pool.filter(p => p !== x)).slice(0, n);
const pool3 = () => (run && run.p.items.length >= 3 ? run.p.items : WORD_IDS);
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

/* ---------- 그림 놀이 도우미(11/03): 별 병·깜짝 축하·반짝 ---------- */
const WCAT_OF = {}; Object.entries(WCAT).forEach(([k, ws]) => ws.forEach(x => { WCAT_OF[x] = k; }));
function sparkAt(node) { const r = node.getBoundingClientRect(); spark.style.left = (r.left + r.width / 2) + 'px'; spark.style.top = (r.top + r.height / 2) + 'px'; sparkPop(); setTimeout(() => { spark.style.left = ''; spark.style.top = ''; }, 900); }
function starJar() {   // 별 10개 = 별 병 하나(이 기기에만 저장)
  const j = el('div', 'jar', '<div class="glass"><div class="fill"></div><span class="cnt"></span></div><span class="jars"></span>'); drawJar(j); return j;
}
function drawJar(j) { const n = S.pw.stars % 10; j.querySelector('.fill').style.height = (n * 10) + '%'; j.querySelector('.cnt').textContent = '★' + n; j.querySelector('.jars').textContent = S.pw.jars ? '🫙×' + S.pw.jars : ''; }
function addStar(j) { S.pw.stars++; const full = S.pw.stars % 10 === 0; if (full) S.pw.jars++; j.classList.remove('pop'); void j.offsetWidth; j.classList.add('pop'); if (full) { j.querySelector('.fill').style.height = '100%'; j.querySelector('.cnt').textContent = '★10'; setTimeout(() => drawJar(j), 2600); } else drawJar(j); return full; }
async function surprise(s, big) {   // 가끔 깜짝: 몽글이 점프 + 별·꽃 비
  const box = el('div', 'confetti' + (big ? ' big' : ''));
  for (let i = 0; i < (big ? 26 : 12); i++) { const c = el('i', '', ['★', '✿', '♥', '●'][i % 4]); c.style.left = (Math.random() * 100) + '%'; c.style.color = CARD_COLORS[i % CARD_COLORS.length]; c.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's'; box.append(c); }
  document.body.append(box); setChar('jump'); bounce(); await wait(big ? 1600 : 1100); box.remove();
}
/* 비슷한 가짜 글자(11/03): 같은 자음+다른 모음, 같은 모음+다른 자음(소리 파일 있는 10자음×6모음 안에서). lv2 = 모양 차이 큰 것, lv3 = 모양이 가까운 것 */
const hasBatchim = c => (c.charCodeAt(0) - 0xAC00) % 28 !== 0;
const BASE_C = { 'ㅋ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㅃ': 'ㅂ', 'ㅊ': 'ㅈ', 'ㅌ': 'ㄷ', 'ㅍ': 'ㅂ', 'ㄸ': 'ㄷ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' }, BASE_V = { 'ㅕ': 'ㅓ', 'ㅑ': 'ㅏ', 'ㅛ': 'ㅗ', 'ㅠ': 'ㅜ', 'ㅝ': 'ㅜ' };
const SIM = { 'ㅏㅓ': 3, 'ㅗㅜ': 3, 'ㅜㅡ': 2, 'ㅗㅡ': 2, 'ㅏㅣ': 2, 'ㅓㅣ': 2, 'ㅁㅂ': 3, 'ㅅㅈ': 3, 'ㄷㄹ': 2, 'ㄱㄴ': 2, 'ㄴㄷ': 2, 'ㅇㅎ': 2, 'ㄱㅈ': 1, 'ㄴㄹ': 1 };
const sim = (a, b) => SIM[a + b] || SIM[b + a] || 0;
function lookAlikes(syl, lv, want) {
  if (!want) return [];
  const per = syl.map(t => { const { cho, jung } = splitSyllable(t), c = BASE_C[cho] || cho, v = BASE_V[jung] || jung, out = [];
    if (C.includes(c)) V.forEach(v2 => { if (v2 !== jung) out.push({ c: compose(c, v2), src: t, sc: sim(v, v2) + (v2 === v ? 3 : 0) }); });
    if (V.includes(v)) C.forEach(c2 => { if (c2 !== cho) out.push({ c: compose(c2, v), src: t, sc: sim(c, c2) + (c2 === c ? 3 : 0) }); });
    (LOOK[t] || []).forEach(c2 => out.push({ c: c2, src: t, sc: 4 }));
    return out.filter(d => !syl.includes(d.c)).map(d => ({ ...d, r: (lv >= 3 ? d.sc : -d.sc) + Math.random() * 1.6 })).sort((a, b) => b.r - a.r); });
  const got = [], seen = new Set();
  for (let round = 0; got.length < want && round < 6; round++) per.forEach(list => { while (list.length && got.length < want) { const d = list.shift(); if (!seen.has(d.c)) { seen.add(d.c); got.push(d); break; } } });
  return got;
}
/* 아이마다 단계(그 놀이 낱말 묶음 기준). 주는 lvMin~lvMax 범위만 */
const hidLevel = p => { const r = S.hid[p.id]; return Math.max(p.lvMin || 1, Math.min(p.lvMax || 3, r ? r.lv : (p.lvMin || 1))); };
function hidUpdate(p, hs) {   // 한 판 끝: 올라가기·내려가기
  const r = S.hid[p.id] || (S.hid[p.id] = { lv: p.lvMin || 1, good: 0, hist: [] });
  r.lv = hidLevel(p); const tries = hs.finds + hs.decoys, acc = tries ? hs.finds / tries : 0;
  const good = tries > 0 && acc >= HIDDEN.up.acc && hs.reveals === 0, bad = (tries > 0 && acc < HIDDEN.down.acc) || hs.reveals >= HIDDEN.down.reveals;
  r.hist.push({ d: today(), lv: r.lv, acc: Math.round(acc * 100) / 100, rv: hs.reveals }); r.hist = r.hist.slice(-10);
  if (good) { r.good++; if (r.good >= HIDDEN.up.need && r.lv < (p.lvMax || 3)) { r.lv++; r.good = 0; } }
  else { r.good = 0; if (bad && r.lv > (p.lvMin || 1)) r.lv--; }
  return r.lv;
}
const RUN = {
  /* 그림 속 글자 찾기(11/03 음절판): 낱말 글자를 하나씩 그림 속 여러 자리에 숨김(모자 → 모, 자). 위 카드의 빈칸을 채우며 찾음(순서 상관없이, 맞는 칸으로).
     단계(아이마다 S.hid): 1 정답 글자만 / 2 비슷한 가짜 글자 / 3 가짜 더 많고 작고 모양이 더 비슷함. 찾으면 글자가 칸으로 날아가며 "모!", 다 찾으면 "찾았다! 모자!" */
  hidden(w, id, s, done) {
    const lv = hidLevel(run.p), L = HIDDEN.lv[lv], H = HSPOT[w] || { q: [] }, syl = [...WORDS[w]], n = syl.length;
    if (!H.q || H.q.length < n) return done(null);
    const order = H.q.map((_, k) => k);   // 큰 자리부터
    const tk = lv === 1 ? order.slice(0, n) : lv === 2 ? shuffle(order.slice(0, Math.min(order.length, n + 2))).slice(0, n) : shuffle(order).slice(0, n);
    const free = shuffle(order.filter(k => !tk.includes(k)));
    const want = lv === 1 ? 0 : lv === 2 ? Math.min(3, n + (Math.random() < 0.5 ? 1 : 0)) : Math.min(4, Math.max(3, 2 * n));
    const dec = lookAlikes(syl, lv, Math.min(want, free.length));
    const marks = syl.map((c, i) => ({ c, slot: i, target: true, k: tk[i] })).concat(dec.map((d, q) => ({ c: d.c, src: d.src, k: free[q] })));
    const hs = run.hs || (run.hs = { finds: 0, decoys: 0, reveals: 0, hints: 0 });
    let first = true, finished = false, busy = false, hintT = 0, revT = 0, revealedHere = false;
    const filled = new Array(n).fill(false);
    const card = el('div', 'hwcard'), slots = el('div', 'hwslots');
    syl.forEach((c, i) => { const sl = el('span', 'slot', c); sl.dataset.i = i; slots.append(sl); });
    card.append(slots, speakerBtn(() => pointSay(VOICE.hw(w))));
    const box = el('div', 'hwbox'), img = el('img'); img.alt = ''; img.src = PIC(w); img.draggable = false; box.append(img);
    const ring = el('div', 'hwring'); box.append(ring);
    const mix = (c, d) => { const lum = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114; return 'rgb(' + c.map(v => Math.round(lum < 110 ? v + (255 - v) * d : v * (1 - d))).join(',') + ')'; };
    marks.forEach(m => {
      const [cx, cy, sw, , col] = H.q[m.k];
      const sp = el('span', 'hw' + (m.target ? ' tgt' : ' decoy'), m.c); sp.dataset.c = m.c;
      sp.style.left = cx + '%'; sp.style.top = cy + '%'; sp.style.color = mix(col, L.delta);
      m.rot = (Math.random() * 2 - 1) * L.rot; m.sw = sw; m.el = sp; box.append(sp);
    });
    const nextIdx = () => filled.indexOf(false);
    const placeRing = () => { const k = nextIdx(); const m = marks.find(x => x.target && x.slot === k); if (!m) return; const t = m.el.getBoundingClientRect(), b = box.getBoundingClientRect(), pad = 22;
      ring.style.left = (t.left - b.left - pad) + 'px'; ring.style.top = (t.top - b.top - pad) + 'px'; ring.style.width = (t.width + 2 * pad) + 'px'; ring.style.height = (t.height + 2 * pad) + 'px'; };
    const fit = () => { const W = box.getBoundingClientRect().width; if (!W) return;
      marks.forEach(m => { m.el.style.fontSize = Math.max(16, m.sw * 0.78 * L.size * W / 100).toFixed(1) + 'px'; m.el.style.transform = 'translate(-50%,-50%) rotate(' + m.rot.toFixed(1) + 'deg)'; });
      const R = marks.map(m => m.el.getBoundingClientRect()), hit = (a, c) => a.left < c.right + 4 && c.left < a.right + 4 && a.top < c.bottom + 4 && c.top < a.bottom + 4;
      for (let q = marks.length - 1; q >= n; q--) if (R.some((r, k) => k !== q && hit(R[q], r))) { marks[q].el.remove(); marks.splice(q, 1); R.splice(q, 1); }   // 작은 화면에서 겹치면 가짜를 뺌
      placeRing(); };
    s.append(guide('think', '<b>' + WORDS[w] + '</b> 글자를 찾아봐!'), card, box);
    fit(); requestAnimationFrame(fit); new ResizeObserver(fit).observe(box);
    const arm = () => { clearTimeout(hintT); clearTimeout(revT); ring.classList.remove('on');
      hintT = setTimeout(() => { if (!alive(id) || finished) return; placeRing(); ring.classList.add('on'); hs.hints++; first = false; setBubble('반짝이는 데를 봐!'); say('ui_hwhint'); }, HIDDEN.hint);
      revT = setTimeout(() => { if (!alive(id) || finished) return; revealAll(); }, HIDDEN.reveal); };
    async function fly(m) {   // 찾은 글자가 위 칸으로 날아감
      const a = m.el.getBoundingClientRect(), sl = slots.children[m.slot], b = sl.getBoundingClientRect();
      const f = el('span', 'hwfly', m.c); f.style.left = (a.left + a.width / 2) + 'px'; f.style.top = (a.top + a.height / 2) + 'px'; f.style.fontSize = Math.max(28, a.height) + 'px'; document.body.append(f);
      requestAnimationFrame(() => { f.style.transform = 'translate(-50%,-50%) translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' + (b.top + b.height / 2 - a.top - a.height / 2) + 'px) scale(.9)'; });
      await wait(560); f.remove(); sl.classList.add('on'); sl.classList.remove('pop'); void sl.offsetWidth; sl.classList.add('pop');
    }
    async function take(m, revealed) {
      // 같은 글자가 두 번(바나나의 '나')이면 비어 있는 맞는 칸 아무거나
      if (filled[m.slot]) { const alt = syl.findIndex((c, i) => c === m.c && !filled[i]); if (alt < 0) return; m.slot = alt; }
      filled[m.slot] = true; m.found = true; if (revealed) hs.reveals++; else hs.finds++;
      m.el.classList.add('found'); sparkAt(m.el); ding(1 + 0.1 * filled.filter(Boolean).length);
      const fl = fly(m); setChar('clap'); bounce();
      if (filled.every(Boolean)) {
        finished = true; clearTimeout(hintT); clearTimeout(revT); ring.classList.remove('on'); await fl;
        setBubble((revealed ? '여기 있었어! ' : '찾았다! ') + '<b>' + WORDS[w] + '</b>!'); await say(VOICE.syl(m.c)); if (!alive(id)) return;
        await say(['ui_found', VOICE.word(w)]); await wait(450); if (alive(id)) done(revealed || revealedHere ? null : first);
        return;
      }
      setBubble('<b>' + m.c + '</b>! 또 찾아볼까?'); await say(VOICE.syl(m.c)); await fl; if (!alive(id)) return; arm(); placeRing();
    }
    async function revealAll() {   // 30초: 남은 글자를 하나씩 보여 줌
      revealedHere = true; first = false; busy = true;
      for (const m of marks.filter(x => x.target && !x.found)) { if (!alive(id)) return; await take(m, true); }
    }
    box.addEventListener('pointerdown', async e => {
      if (finished || busy || !alive(id)) return;
      const hit = marks.filter(m => !m.found && m.el.isConnected).map(m => { const r = m.el.getBoundingClientRect(), g = Math.max(22, r.height * 0.5); const inside = e.clientX >= r.left - g && e.clientX <= r.right + g && e.clientY >= r.top - g && e.clientY <= r.bottom + g;
        return { m, inside, d: Math.hypot(e.clientX - (r.left + r.right) / 2, e.clientY - (r.top + r.bottom) / 2) }; }).filter(x => x.inside).sort((a, b) => a.d - b.d)[0];
      if (!hit) return;
      if (hit.m.target) { busy = true; await take(hit.m, false); busy = false; return; }
      first = false; hs.decoys++; busy = true; hit.m.el.classList.remove('seen'); void hit.m.el.offsetWidth; hit.m.el.classList.add('seen'); setChar('think');
      const want1 = filled[syl.indexOf(hit.m.src)] === false ? hit.m.src : syl[nextIdx()];
      setBubble('그건 <b>' + hit.m.c + '</b>야. <b>' + want1 + '</b>' + (hasBatchim(want1) ? '을' : '를') + ' 찾아볼까?');
      await say([VOICE.dy(hit.m.c), VOICE.fy(want1)]); busy = false;
    });
    if (window.HP) HP.hidden = { target: w, syl, lv, get marks() { return marks.map(m => ({ c: m.c, target: !!m.target, slot: m.slot, found: !!m.found, on: m.el.isConnected })); },
      rect: k => { const r = marks[k].el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, get filled() { return filled.slice(); }, get found() { return finished; }, get busy() { return busy; }, ring: () => ring.classList.contains('on'), stats: hs };
    arm(); pointSay(VOICE.hw(w));
  },
  /* 그림 보고 글자 고르기(11/03): 큰 그림 + 낱말 카드 2~5장. 색 힌트 = 그림 테두리와 정답 카드 색이 같음(주가 갈수록·잘 맞히면 옅어짐). 맞으면 카드가 그림으로 쏙 + 별 병 */
  picword(w, id, s, done) {
    const p = run.p, n = Math.min(p.cards || 2, PW_WORDS.length), st = S.pw.streak[w] || 0;
    const hint = Math.max(0, (p.hint == null ? 2 : p.hint) - (st >= 2 ? 1 : 0));
    const easy = n <= 3;
    const score = x => (WORDS[x][0] === WORDS[w][0] ? 3 : 0) + (WCAT_OF[x] === WCAT_OF[w] ? 2 : 0) + ([...WORDS[x]].some(c => WORDS[w].includes(c)) ? 1 : 0) + Math.random() * 1.5;
    const cand = PW_WORDS.filter(x => x !== w && WORDS[x] !== WORDS[w]);
    const dis = easy ? shuffle(cand.filter(x => WCAT_OF[x] !== WCAT_OF[w] && WORDS[x][0] !== WORDS[w][0])).slice(0, n - 1)
      : cand.sort((a, b) => score(b) - score(a)).slice(0, n - 1);
    const opts = shuffle([w, ...dis]);
    const base = (HSPOT[w] && HSPOT[w].c) || [242, 123, 166];
    const hexC = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const strong = c => {   // 그림 대표 색을 카드·테두리용으로: 채도 높이고 밝기는 중간(파스텔 그림도 색이 또렷하게)
      const [r, g, b] = c.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, l = (mx + mn) / 2, d = mx - mn;
      if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      const S2 = Math.max(0.6, d ? d / (1 - Math.abs(2 * l - 1)) : 0), L2 = Math.min(0.66, Math.max(0.52, l)), C = (1 - Math.abs(2 * L2 - 1)) * S2, X = C * (1 - Math.abs(h % 2 - 1)), m = L2 - C / 2;
      const t = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(h) % 6]; return t.map(v => (v + m) * 255); };   // 그림 색을 카드용으로 조금 진하게
    const tc = strong(base), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const pal = shuffle(CARD_COLORS.map(rgb).filter(c => dist(c, tc) > 170));
    const tint = (c, k) => hexC(c.map(v => v + (255 - v) * k));
    const colOf = x => x === w ? tc : pal[(dis.indexOf(x)) % Math.max(1, pal.length)] || [200, 200, 200];
    const frame = el('div', 'pwframe' + (hint ? ' h' + hint : ''));
    frame.style.borderColor = hint === 2 ? hexC(tc) : hint === 1 ? tint(tc, 0.55) : '#EFE6DA';
    frame.innerHTML = picHTML(w);
    const jar = starJar();
    const row = el('div', 'pwcards n' + n);
    let first = true, locked = false;
    opts.forEach(x => {
      const c = el('button', 'pwcard', '<span>' + WORDS[x] + '</span>'); c.dataset.k = x; c.setAttribute('aria-label', WORDS[x]);
      const cc = colOf(x);
      if (hint === 2) { c.style.background = tint(cc, x === w ? 0.35 : 0.6); c.style.borderColor = hexC(cc); }
      else if (hint === 1) { c.style.background = tint(cc, 0.82); c.style.borderColor = tint(cc, 0.55); }
      c.addEventListener('click', async () => {
        if (locked || !alive(id)) return;
        if (x === w) {
          locked = true; S.pw.streak[w] = first ? st + 1 : 0;
          const a = c.getBoundingClientRect(), b = frame.getBoundingClientRect();
          c.style.setProperty('--dx', (b.left + b.width / 2 - a.left - a.width / 2) + 'px'); c.style.setProperty('--dy', (b.top + b.height * 0.62 - a.top - a.height / 2) + 'px');
          c.classList.add('fly'); frame.classList.add('got'); sparkAt(frame); ding(); setChar('clap'); bounce(); setBubble('맞아! <b>' + WORDS[w] + '</b>!');
          const full = addStar(jar); save();
          await say(VOICE.word(w)); if (!alive(id)) return;
          if (full) { await surprise(s, true); if (!alive(id)) return; await say('ui_jarfull'); }
          else if (Math.random() < 0.2) await surprise(s, false);
          if (!alive(id)) return; await say('ui_good' + (1 + rand(3))); await wait(250); if (alive(id)) done(first);
        } else {
          first = false; locked = true; S.pw.streak[w] = 0; c.classList.remove('retry'); void c.offsetWidth; c.classList.add("retry", "pwno"); setChar('cheer');
          setBubble('그건 <b>' + WORDS[x] + '</b>야!'); await say(VOICE.hy(x)); locked = false; if (alive(id)) { setChar('think'); setBubble('이건 뭘까?'); }
        }
      });
      row.append(c);
    });
    s.append(guide('think', '이건 뭘까?'), jar, frame, row);
    if (window.HP) HP.pw = { target: w, opts, hint, cards: n, colors: opts.map(x => [...row.querySelectorAll('.pwcard')].find(c => c.dataset.k === x).style.background) };
    pointSay('ui_pw');
  },
  /* 글자 친구: 큰 글자 + 이름 + 예시 낱말(첫 글자 강조) + 음성 "기역, 기차 할 때 기역." */
  letter(j, id, s, done) {
    const e = JAMO_EX[j], word = e.word, k = run.i;
    const voice = () => { setChar('point'); say(VOICE.jamo(j)).then(ok => ok && setChar('basic')); };
    const wordVoice = () => { const w = Object.keys(WORDS).find(x => WORDS[x] === word); say(w ? VOICE.word(w) : VOICE.jamo(j)); };
    const note = JAMO_NOTE[j];
    s.append(guide('point', '이건 <b>' + JNAME[j] + '</b>' + (isSyl(j) || JNAME[j].length > 1 ? '이야!' : '야!')));
    const wrap = el('div', 'lt');
    const lp = hasPic(e.lp) ? '<div class="lpic">' + picHTML(e.lp, e.word) + '</div>' : '';   // 그림 속 글자 → 글자만 남기
    const L = el('div', 'letter' + (lp ? ' haslp' : ''), lp + '<div class="hint">' + run.queue.map((_, q) => '<i class="' + (q === k ? 'on' : '') + '"></i>').join('') + '</div><div class="g">' + j + '</div><div class="nm">' + JNAME[j] + '</div>' + (note ? '<div class="note">' + note.text + '</div>' : ''));
    if (lp) setTimeout(() => alive(id) && L.classList.add('lpdone'), 2200);
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
    const opts = shuffle([w, ...others(pool3(), w, 2)]);
    const prompt = () => pointSay(['ui_listen', VOICE.word(w)]);
    const pr = el('div', 'prompt', '<div class="body syl">' + [...WORDS[w]].map(() => '<span class="q">?</span>').join('') + '</div>'); pr.append(speakerBtn(prompt));
    s.append(pr, el('div', 'ask', '어느 그림일까?'), choiceRound(id, opts.map(picCard), opts.indexOf(w), done), guide('think', '잘 듣고 골라 봐', true));
    // 소리 놀이: 글자는 맞힌 뒤에 보여 줌(그 전엔 글자 수만큼 ? 칸)
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === w) { pr.querySelectorAll('.syl span').forEach((x, k) => { x.textContent = WORDS[w][k]; x.classList.remove('q'); }); pr.querySelectorAll('.syl span')[0].classList.add('on'); setBubble(WORDS[w] + ' 찾았네!<small>' + [...WORDS[w]].join('·') + ', ' + WORDS[w].length + '글자야</small>'); } }));
    prompt();
  },
  /* 글자 고르기 */
  pick(j, id, s, done) {
    const same = run.p.items.filter(x => isSyl(x) === isSyl(j));
    const opts = shuffle([j, ...others(same.length >= 3 ? same : [...C, ...V], j, 2)]);
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
    const opts = shuffle([w, ...others(pool3(), w, 2)]);
    const prompt = () => pointSay('ui_which');
    const pr = el('div', 'prompt', '<div class="body syl">' + [...WORDS[w]].map(c => '<span>' + c + '</span>').join('') + '</div>');
    pr.append(speakerBtn(() => say(VOICE.word(w)), 'spk', '낱말 듣기'));
    s.append(pr, el('div', 'ask', '어떤 그림일까?'), choiceRound(id, opts.map(picCard), opts.indexOf(w), done), guide('think', '글자를 읽어 봐', true));
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === w) { pr.querySelectorAll('.syl span').forEach(x => x.classList.add('on')); say(VOICE.word(w)); } }));
    prompt();
  },
  /* 낱말 짝 */
  match(w, id, s, done) {
    const pair = [w, others(pool3(), w, 1)[0]], pics = shuffle(pair), words = shuffle(pair);
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
  trace(j, id, s, done) { traceRound(j, id, s, done, false); },
  /* ★ 내 이름 찾기: 낱말 카드 3장 중 이름(가족 낱말) 찾기. 10주차는 문장 카드("려원이도 모자") */
  name(w, id, s, done) {
    const opts = shuffle([w, ...others(FAMILY, w, 2)]), inS = run.p.inSentence;
    const label = x => inS ? (x === 'ryeowon' ? '려원이도' : WORDS[x] + '도') + ' 모자' : WORDS[x];
    const prompt = () => pointSay(w === 'ryeowon' ? 'ui_name' : [VOICE.word(w), 'ui_find']);
    const pr = el('div', 'prompt', '<div class="body"><span class="eye">' + (w === 'ryeowon' ? WORDS.ryeowon + '이 이름은 어디 있을까?' : '‘' + WORDS[w] + '’는 어디 있을까?') + '</span></div>'); pr.append(speakerBtn(prompt));
    const cards = opts.map(x => { const c = el('button', 'ch namecard' + (inS ? ' sent' : ''), '<span class="nmw">' + label(x) + '</span><span class="nmpic">' + picHTML(x, WORDS[x]) + '</span>'); c.dataset.k = x; c.setAttribute('aria-label', label(x)); return c; });
    s.append(pr, el('div', 'ask', '낱말 카드를 눌러 봐'), choiceRound(id, cards, opts.indexOf(w), done), guide('think', '어디 있을까?', true));
    cards.forEach(c => c.addEventListener('click', () => { if (c.dataset.k === w) { c.classList.add('reveal'); setBubble('<b>' + label(w) + '</b>!'); } }));
    prompt();
  },
  /* ◎ 짝짝 글자 세기: ① 몽글이 시범(글자 칸이 하나씩 빛나며 짝, 짝 "두 번!") ② 아이가 따라 짝짝 ③ 몇 번 쳤지? */
  clap(w, id, s, done) {
    const syl = [...WORDS[w]], n = syl.length, ct = CLAP_T[w];
    const pr = el('div', 'prompt clapP', '<div class="body">' + picHTML(w, WORDS[w], 'hero-pic') + '<div class="claprow">' + syl.map(c => '<span>' + c + '</span>').join('') + '</div></div>');
    const boxes = [...pr.querySelectorAll('.claprow span')];
    const pad = el('button', 'clappad off', '<img alt="" src="' + ICON('clap') + '"><b>짝!</b>'); pad.id = 'clapPad';
    const ask = el('div', 'ask', '몽글이를 잘 봐');
    const cards = [1, 2, 3, 4].map(k => { const c = el('button', 'ch', '<div class="dots">' + '<i></i>'.repeat(k) + '</div>'); c.dataset.k = k; c.setAttribute('aria-label', k + '번'); return c; });
    const choice = choiceRound(id, cards, n - 1, done); choice.classList.add('four'); choice.hidden = true;
    let phase = 0, taps = 0;
    const light = (k, cls) => { boxes.forEach((b, i) => b.classList.toggle(cls, i <= k)); };
    const demo = async () => {
      phase = 0; pad.classList.add('off'); choice.hidden = true; boxes.forEach(b => b.classList.remove('on', 'tap'));
      setChar('point'); setBubble('몽글이가 먼저 해 볼게!'); if (!(await say('ui_clapdemo'))) return;
      stopAudio(); const t = sayToken; let lit = -1; setChar('clap');
      const dur = (ct && ct.d) || 2, on = (ct && ct.t) || syl.map((_, k) => k * 0.5);
      await playOne(VOICE.clap(w), p => { if (t !== sayToken) return; const now = p * dur; while (lit < n - 1 && now >= on[lit + 1] - 0.03) { lit++; light(lit, 'on'); clapFx(); setChar(lit % 2 ? 'clap2' : 'clap'); } });
      if (t !== sayToken || !alive(id)) return;
      light(n - 1, 'on'); setBubble('<b>' + n + '번!</b><small>' + syl.join(' · ') + '</small>'); await wait(500); if (!alive(id)) return;
      phase = 1; boxes.forEach(b => b.classList.remove('on')); taps = 0; pad.classList.remove('off'); ask.textContent = '같이 짝짝 쳐 봐';
      setChar('wave'); setBubble('이제 ' + WORDS.ryeowon + '이 차례!'); say('ui_clapyou');
    };
    pad.addEventListener('click', async () => {
      if (phase !== 1 || !alive(id)) return;
      boxes[taps].classList.add('tap'); clapFx(); setChar(taps % 2 ? 'clap2' : 'clap'); bounce(); taps++;
      if (taps >= n) { phase = 2; pad.classList.add('off'); await wait(500); if (!alive(id)) return; ask.textContent = '몇 번 쳤지?'; choice.hidden = false; setChar('think'); setBubble('몇 번 쳤지?'); say('ui_clapcount'); }
    });
    pr.append(speakerBtn(demo, 'spk', '다시 보여 줘'));
    s.append(pr, pad, ask, choice, guide('point', '몽글이가 먼저 해 볼게!', true));
    demo();
  },
  /* ★ 뚝딱 소리 붙이기: "하… 마!" 나눠 듣고 그림 고르기(9주차는 글자도 보여 줌) */
  blend(w, id, s, done) {
    const syl = [...WORDS[w]], txt = run.p.showText, opts = shuffle([w, ...others(run.p.items.length >= 3 ? run.p.items : BLEND_WORDS, w, 2)]);
    const pr = el('div', 'prompt', '<div class="body syl">' + syl.map(c => '<span class="' + (txt ? '' : 'q') + '">' + (txt ? c : '?') + '</span>').join('') + '</div>');
    const spans = [...pr.querySelectorAll('.syl span')];
    const prompt = async () => {
      setChar('point'); if (run && run.i === 0 && !(await say('ui_blend'))) return;
      const ok = await sayGap(syl.map(VOICE.syl), 650, k => spans.forEach((x, i) => x.classList.toggle('on', i === k)));
      if (ok && alive(id)) { spans.forEach(x => x.classList.remove('on')); setChar('think'); }
    };
    pr.append(speakerBtn(prompt));
    s.append(pr, el('div', 'ask', '무슨 낱말일까?'), choiceRound(id, opts.map(picCard), opts.indexOf(w), done), guide('think', '소리를 붙여 봐', true));
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === w) { spans.forEach((x, k) => { x.textContent = syl[k]; x.classList.remove('q'); x.classList.add('on'); }); setBubble('<b>' + WORDS[w] + '</b>!'); say(VOICE.word(w)); } }));
    prompt();
  },
  /* ★ 누구랑 같은 소리? "나, 나비 할 때 나!" → 같은 첫 글자 그림 고르기 */
  same(f, id, s, done) {
    const ans = SAME[f], a0 = WORDS[f][0];
    const pool = ['moja', 'gicha', 'hama', 'lion', 'dubu', 'podo', 'gudu', 'eobu', 'radio', 'dari', 'jadu', 'kokkiri', 'geomi', 'so', 'meori', 'goguma'].filter(x => WORDS[x][0] !== a0);
    const opts = shuffle([ans, ...others(pool, ans, 2)]);
    const prompt = () => pointSay([VOICE.first(f), 'ui_same']);
    const pr = el('div', 'prompt', '<div class="body syl"><span class="q">' + a0 + '</span></div><span class="eye">' + a0 + ' 소리로 시작하는 건?</span>'); pr.append(speakerBtn(prompt));
    s.append(pr, el('div', 'ask', '같은 소리를 골라 봐'), choiceRound(id, opts.map(picCard), opts.indexOf(ans), done), guide('think', '잘 듣고 골라 봐', true));
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === ans) { pr.querySelector('.syl span').classList.replace('q', 'on'); setBubble('<b>' + a0 + '</b>' + WORDS[f].slice(1) + ', <b>' + a0 + '</b>' + WORDS[ans].slice(1) + '!'); say(VOICE.word(ans)); } }));
    prompt();
  },
  /* ★ 가나다 기차: 기관차 = 자음, 칸 = ㅏㅓㅗㅜㅡㅣ. 칸을 눌러 듣고 → "고! 어디 있을까?" */
  train(c, id, s, done) {
    const sy = TRAIN_V.map(v => compose(c, v)), heard = new Set();
    let phase = 0, target = null, first = true, busy = false;
    const tr = el('div', 'train');
    const eng = el('button', 'engine' + (hasPic('train_engine') ? ' pic' : ''), (hasPic('train_engine') ? picHTML('train_engine') : '<span class="emo">🚂</span>') + '<span class="g">' + c + '</span>');
    eng.addEventListener('click', () => { if (phase === 0 && !busy) sayGap(sy.map(VOICE.syl), 120, k => cars.forEach((x, i) => x.classList.toggle('lit', i === k))).then(() => cars.forEach(x => x.classList.remove('lit'))); });
    const cars = sy.map((x, k) => { const b = el('button', 'car' + (hasPic('train_car') ? ' pic' : ''), (hasPic('train_car') ? picHTML('train_car') : '') + '<span class="g">' + x + '</span><span class="v">' + TRAIN_V[k] + '</span>'); b.dataset.k = x; return b; });
    tr.append(eng, ...cars);
    const ask = el('div', 'ask', '기차 칸을 눌러 봐');
    const dock = el('div', 'dock'); const fb = el('button', 'kid-btn next', '찾기 놀이<img alt="" src="' + ICON('arrow') + '">'); fb.id = 'trainFind'; fb.hidden = true; dock.append(fb);
    const startFind = async () => {
      phase = 1; fb.hidden = true; cars.forEach(x => x.classList.remove('heard')); target = sy[rand(sy.length)];
      ask.textContent = '‘' + target + '’ 칸은 어디 있을까?'; setBubble('<b>' + target + '</b>는 어디 있지?'); await pointSay([VOICE.syl(target), 'ui_find']);
    };
    fb.addEventListener('click', startFind);
    cars.forEach(b => b.addEventListener('click', async () => {
      if (busy || !alive(id)) return;
      if (phase === 0) { cars.forEach(x => x.classList.remove('lit')); b.classList.add('lit', 'heard'); heard.add(b.dataset.k); await say(VOICE.syl(b.dataset.k)); b.classList.remove('lit'); if (heard.size >= 3) fb.hidden = false; if (heard.size === sy.length) startFind(); return; }
      if (b.dataset.k === target) { busy = true; b.classList.add('ok'); await say(VOICE.syl(target)); if (await success(id)) done(first); }
      else { first = false; busy = true; await retryFx(id, b); busy = false; }
    }));
    const pr = el('div', 'prompt', '<div class="body"><span class="eye"><b style="color:var(--peach-ink);font-size:30px">' + c + '</b> 기차에 모음 친구들이 탔어요</span></div>');
    pr.append(speakerBtn(() => { if (phase === 1) pointSay([VOICE.syl(target), 'ui_find']); else eng.click(); }));
    s.append(pr, tr, ask, guide('think', '칸을 눌러 봐', true), dock);
    if (run.i === 0) say('ui_train');
  },
  /* ◎ 몽글이 이야기: 4쪽 그림책. 읽는 낱말이 빛나고, 쪽마다 "어디 있는지 짚어 볼까?" */
  story(i, id, s, done) {
    const st = STORY[i], words = st.text.split(' ');
    const pg = el('div', 'storypg', '<div class="dotsP">' + STORY.map((_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('') + '</div><div class="spic">' + (hasPic(st.pic) ? picHTML(st.pic) : '<div class="pair">' + st.pics.map(picSlot).join('') + '</div>') + '</div>');
    const line = el('div', 'sline'); const spans = words.map((w, k) => { const b = el('button', 'sw', w); b.dataset.k = k; line.appendChild(b); return b; });
    pg.append(line);
    const total = st.text.length, ends = []; let acc = 0; words.forEach(w => { acc += w.length + 1; ends.push(acc / (total + 1)); });
    let asking = false, first = true, busy = false;
    const prompt = async () => {
      stopAudio(); setChar('point'); asking = false; const t = sayToken; spans.forEach(x => x.classList.remove('lit'));
      await playOne(VOICE.story(i), p => { if (t === sayToken) spans.forEach((x, k) => x.classList.toggle('lit', k === 0 || p >= (ends[k - 1] - 0.04))); });
      if (t !== sayToken || !alive(id)) return; spans.forEach(x => x.classList.add('lit'));
      asking = true; setBubble('‘' + WORDS[st.target] + '’ 어디 있지?'); await say(['ui_storyq', VOICE.word(st.target)]); if (alive(id)) setChar('think');
    };
    spans.forEach((b, k) => b.addEventListener('click', async () => {
      if (!asking || busy || !alive(id)) return;
      if (k === st.at) { busy = true; b.classList.add('ok'); S.words[st.target] = today(); if (await success(id)) done(first); }
      else { first = false; busy = true; await retryFx(id, b); busy = false; }
    }));
    const tools = el('div', 'tools'); const hb = el('button', 'kid-btn', '<img alt="" src="' + ICON('speaker') + '">다시 읽기'); hb.addEventListener('click', prompt); tools.append(hb);
    s.append(pg, tools, guide('think', '같이 읽어 보자', true));
    prompt();
  },
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

/* ---------- 따라 쓰기 / 보고 쓰기 (11/03 고침: 획 하나씩 판정) ----------
   예전: 손을 뗄 때마다 글자 전체를 한꺼번에 판정 + '잉크 점 개수'로 너무 많이 그렸는지 봄 → 천천히 그은 첫 획(ㅏ의 ㅣ)도 점이 많아 "다시 해 볼까?"가 뜸.
   지금: 손을 뗄 때 그 획 하나만 봄. 맞으면 반짝 + 다음 획 분홍 점, 다 쓰면 칭찬. 틀린 획만 지우고 그 획만 다시 보여 줌. 같은 획 3번 안 되면 같이 써 줌.
   방향·순서는 너그럽게(거꾸로 그어도, 남은 다른 획을 먼저 그어도, 두 획을 한 번에 이어 그어도 인정). 아주 짧은 터치는 조용히 무시. */
const TRACE_PX = { guide: 30, dash: 8, ink: 20, trail: 20, dot: 13, pad: 6 };
function strokePoints(st) { if (Array.isArray(st)) return st; const [cx, cy, r] = st.c, pts = []; for (let k = 0; k <= 48; k++) { const a = -Math.PI / 2 - k * (2 * Math.PI / 48); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return pts; }
/* 글자 → 획 목록(100칸 좌표) + 획마다 크기(sc, 판정 너비용). 받침 없는 음절은 자음+모음을 옆 짜임(ㅏㅑㅓㅕㅣ)·위아래 짜임(ㅗㅛㅜㅠㅡ)으로 배치 */
function strokesOf(ch) {
  const jp = j => STROKES[j].map(strokePoints);
  if (!isSyl(ch)) return { pts: jp(ch), sc: STROKES[ch].map(() => 1) };
  const { cho, jung } = splitSyllable(ch);
  const tf = (list, ax, bx, ay, by) => list.map(st => st.map(([x, y]) => [ax + x * bx, ay + y * by]));
  const side = VERTICAL_VOWELS.includes(jung);
  const L = side ? [[4, 0.5, 14, 0.72], [38, 0.62, 2, 0.96]] : [[20, 0.6, 0, 0.52], [4, 0.92, 26, 0.7]];
  const a = tf(jp(cho), ...L[0]), b = tf(jp(jung), ...L[1]);
  const sc = l => Math.sqrt(l[1] * l[3]);
  return { pts: a.concat(b), sc: a.map(() => sc(L[0])).concat(b.map(() => sc(L[1]))) };
}
function densify(lines, step = 2) { const out = []; lines.forEach(pts => { for (let i = 0; i < pts.length; i++) { if (i === 0) { out.push(pts[0]); continue; } const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); } }); return out; }
/* 점 개수가 아니라 실제 길이(같은 자리 점이 많아도 늘지 않음) */
const pathLen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function minDist(p, pts) { let m = 1e9; for (const q of pts) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < m) m = d; } return Math.sqrt(m); }
/* 획 묶음(set) 하나를 이 잉크 한 줄이 그렸는지: 묶음의 획마다 cover 이상 덮고, 획의 시작·끝 근처까지 갔고, 잉크 길이가 묶음 길이의 절반쯤은 되고,
   잉크가 묶음에서 크게 벗어난 비율이 strayMax 이하. 짧은 획은 판정 너비를 획 길이의 0.7배까지만(ㅏ의 ㅣ만 그었는데 옆 짧은 획까지 '덮은' 걸로 치지 않게) */
function judgeStroke(guides, scs, inkSt, loose, strict) {   // strict = 두 획 한 번에·순서 바뀐 획(덤으로 인정할 때만 꼼꼼히)
  const k = loose ? 1.4 : 1, sc = Math.max(0.5, Math.min(...scs)), tol = TRACE.tol * k * sc, stray = TRACE.stray * k * sc;
  const inkPts = densify([inkSt], 1.5); if (inkPts.length < 3) return false;
  let need = 0;
  for (const g of guides) {
    const len = pathLen(g), t = strict ? Math.min(tol, Math.max(8, 0.45 * len)) : Math.min(tol, Math.max(11, 0.7 * len)), sm = densify([g], 2); need += len;
    if (sm.filter(p => minDist(p, inkPts) <= t).length / sm.length < TRACE.cover) return false;
    const a = g[0], b = g[g.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 5 && (minDist(a, inkPts) > t * 1.15 || minDist(b, inkPts) > t * 1.15)) return false;   // 끝까지 갔는지(원은 제외)
  }
  if (pathLen(inkSt) < (guides.length > 1 ? 0.9 : 0.45) * need) return false;   // 두 획을 한 번에: 잉크가 두 획 길이만큼은 돼야
  const gAll = densify(guides, 2); return inkPts.filter(p => minDist(p, gAll) > stray).length / inkPts.length <= TRACE.strayMax;
}
/* 글자 전체 판정(시험·옛 호환용): 획마다 하나씩 judgeStroke */
function judgeTrace(guide, ink, loose) { return guide.every((g, i) => ink[i] && judgeStroke([g], [1], ink[i], loose)); }
function traceRound(j, id, s, done, copyMode) {
  const SO = strokesOf(j), guideP = SO.pts, N = guideP.length;
  const xs = guideP.flat().map(p => p[0]), ys = guideP.flat().map(p => p[1]);
  const bb = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  s.append(guide('think', copyMode ? '<b>' + j + '</b> 보고 써 봐' : '점을 따라 <b>' + j + '</b> 써 봐'));
  const box = el('div', 'trace');
  box.innerHTML = '<svg><path class="g1" fill="none" stroke="' + (copyMode ? '#F4EFE9' : '#EFE6DA') + '" stroke-width="' + TRACE_PX.guide + '" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path class="g2" fill="none" stroke="#F27BA6" stroke-width="' + TRACE_PX.dash + '" stroke-dasharray="0.1 14" stroke-linecap="round"' + (copyMode ? ' opacity="0"' : '') + '/>' +
    guideP.map((_, k) => '<path class="tr" data-k="' + k + '" d="" fill="none" stroke="#F27BA6" stroke-opacity=".5" stroke-width="' + TRACE_PX.trail + '" stroke-linecap="round" stroke-linejoin="round"/>').join('') +
    '<circle class="mover" r="' + TRACE_PX.dot + '" fill="#F27BA6" stroke="#fff" stroke-width="4" cx="-50" cy="-50"/></svg><canvas></canvas>' +
    (N > 1 ? '<div class="sdots">' + guideP.map((_, k) => '<i data-k="' + k + '"></i>').join('') + '</div>' : '') + (copyMode ? '<div class="model">' + j + '</div>' : '');
  const svg = box.querySelector('svg'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), mover = box.querySelector('.mover');
  const trails = [...box.querySelectorAll('.tr')], T = { s: 1, ox: 0, oy: 0 };
  const toPx = ([x, y]) => [T.ox + x * T.s, T.oy + y * T.s], toU = ([x, y]) => [(x - T.ox) / T.s, (y - T.oy) / T.s];
  const dPx = pts => 'M' + pts.map(p => toPx(p).map(v => v.toFixed(1)).join(' ')).join(' L');
  const doneK = new Array(N).fill(false), helped = new Array(N).fill(false), badK = new Array(N).fill(0);
  let ink = [], cur = null, bad = 0, busy = false, finished = false, demoTok = 0;
  const nextK = () => doneK.indexOf(false);
  let parked = guideP[0][0];
  const placeMover = p => { const [x, y] = toPx(p); mover.setAttribute('cx', x); mover.setAttribute('cy', y); };
  const drawGuide = () => {   // 연한 길 = 글자 전체, 분홍 점 = 지금 쓸 획 하나
    svg.querySelector('.g1').setAttribute('d', guideP.map(dPx).join(' '));
    const k = nextK(); svg.querySelector('.g2').setAttribute('d', k < 0 ? '' : dPx(guideP[k]));
    box.querySelectorAll('.sdots i').forEach((d, q) => { d.className = doneK[q] ? 'on' : q === k ? 'now' : ''; });
  };
  const fit = () => {
    const r = box.getBoundingClientRect(); if (!r.width) return;
    const W = r.width, Hh = r.height, pad = TRACE_PX.guide / 2 + TRACE_PX.pad;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    T.s = Math.min((W - 2 * pad) / Math.max(bb.x1 - bb.x0, 1), (Hh - 2 * pad) / Math.max(bb.y1 - bb.y0, 1)) * 0.92;
    T.ox = W / 2 - T.s * (bb.x0 + bb.x1) / 2; T.oy = Hh / 2 - T.s * (bb.y0 + bb.y1) / 2;
    drawGuide();
    trails.forEach(t => { const u = t.dataset.u ? JSON.parse(t.dataset.u) : []; t.setAttribute('d', u.length ? dPx(u) : ''); });
    placeMover(parked); const d = window.devicePixelRatio || 1; cv.width = W * d; cv.height = Hh * d; redraw();
  };
  const redraw = () => {
    const d = window.devicePixelRatio || 1; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = TRACE_PX.ink;
    const line = (st, color) => { ctx.strokeStyle = color; ctx.beginPath(); st.forEach((p, i) => { const [x, y] = toPx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (st.length === 1) { const [x, y] = toPx(st[0]); ctx.lineTo(x + 0.1, y); } ctx.stroke(); };
    ink.forEach(st => line(st, '#F47B58'));
    guideP.forEach((g, k) => helped[k] && line(g, '#F7A98F'));   // 같이 써 준 획
    if (cur && !ink.includes(cur)) line(cur, '#F47B58');
  };
  const setTrail = (k, pts) => { trails[k].dataset.u = JSON.stringify(pts); trails[k].setAttribute('d', pts.length ? dPx(pts) : ''); };
  const clearTrails = () => trails.forEach((t, k) => setTrail(k, []));
  const toLocal = e => { const r = box.getBoundingClientRect(); return toU([e.clientX - r.left, e.clientY - r.top]); };
  const park = () => { const k = nextK(); if (k < 0) return; parked = guideP[k][0]; placeMover(parked); mover.style.display = copyMode ? 'none' : ''; drawGuide(); };
  async function demo(only) {   // only = 이 획만 다시 보여 주기(없으면 남은 획 전부, 처음엔 글자 전체)
    const tok = ++demoTok; clearTrails(); mover.style.display = ''; if (window.HP && HP.trace) HP.trace.demoDone = false;
    const ks = only != null ? [only] : guideP.map((_, k) => k).filter(k => !doneK[k]);
    for (const k of ks) {
      const dd = densify([guideP[k]], 1), got = [];
      for (const p of dd) { if (tok !== demoTok || !alive(id)) return; parked = p; placeMover(p); got.push(p); setTrail(k, got); await wait(22); }
      await wait(380);
    }
    if (window.HP && HP.trace) HP.trace.demoDone = true;
    await wait(900);
    if (tok === demoTok && alive(id)) { clearTrails(); park(); }
  }
  /* 손을 뗀 획 하나 판정 → { ok, took:[획 번호], retry, ignored } */
  const onStroke = async st => {
    const k0 = nextK(); if (k0 < 0 || finished) return { ok: false, ignored: true };
    const rem = guideP.map((_, k) => k).filter(k => !doneK[k]);
    const L = pathLen(st), need = pathLen(guideP[k0]) * SO.sc[k0];
    if (L < Math.max(4, TRACE.minLen * need) && st.length < 40) { ink = ink.filter(x => x !== st); redraw(); return { ok: false, ignored: true }; }   // 살짝 닿은 것
    let took = null;
    for (let m = rem.length; m >= 1 && !took; m--) { const set = rem.slice(0, m); if (judgeStroke(set.map(k => guideP[k]), set.map(k => SO.sc[k]), st, copyMode, m > 1)) took = set; }   // 지금 획(+이어 그은 다음 획들)
    if (!took) for (const k of rem.slice(1)) if (judgeStroke([guideP[k]], [SO.sc[k]], st, copyMode, true)) { took = [k]; break; }   // 순서가 바뀐 획도 인정
    if (took) {
      took.forEach(k => { doneK[k] = true; }); demoTok++; clearTrails();
      if (nextK() < 0) { finished = true; busy = true; drawGuide(); mover.style.display = 'none'; const ok = helped.some(Boolean) ? null : bad === 0; if (await success(id)) done(ok); return { ok: true, took, finished: true }; }
      ding(1.15 + 0.1 * took.length); sparkPop(); setBubble('좋아! 다음 획도 써 볼까?'); park(); return { ok: true, took };
    }
    // 틀린 획: 이 획만 지우고 이 획만 다시 보여 줌
    bad++; badK[k0]++; busy = true; ink = ink.filter(x => x !== st); redraw();
    if (badK[k0] >= TRACE.maxTries) {   // 같이 써 주고 다음 획으로(벌점 없음, 숙달 계산 제외)
      setChar('cheer'); await say('ui_together'); if (!alive(id)) return { ok: false, retry: true }; await demo(k0); if (!alive(id)) return { ok: false, retry: true };
      helped[k0] = true; doneK[k0] = true; redraw(); busy = false;
      if (nextK() < 0) { finished = true; busy = true; drawGuide(); mover.style.display = 'none'; if (await success(id)) done(null); return { ok: false, helped: k0, finished: true }; }
      park(); return { ok: false, helped: k0 };
    }
    await retryFx(id, null); busy = false; if (alive(id)) { setBubble(copyMode ? '<b>' + j + '</b> 보고 써 봐' : '분홍 점을 따라 써 봐'); demo(k0); }
    return { ok: false, retry: true, stroke: k0 };
  };
  cv.addEventListener('pointerdown', e => { if (busy || finished) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); demoTok++; clearTrails(); if (copyMode) mover.style.display = 'none'; cur = [toLocal(e)]; ink.push(cur); redraw(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; cur.push(toLocal(e)); redraw(); });
  const end = () => { if (!cur) return; const st = cur; cur = null; onStroke(st); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const prompt = () => { setChar('think'); say([isSyl(j) ? VOICE.syl(j) : VOICE.jamo(j), 'ui_trace']); demo(); };
  const tools = el('div', 'tools');
  const hb = el('button', 'kid-btn', '<img alt="" src="' + ICON('speaker') + '">' + (copyMode ? '보여 줘' : '다시 보기')); hb.addEventListener('click', prompt);
  const eb = el('button', 'kid-btn', '지우기'); eb.addEventListener('click', () => { if (busy || finished) return; ink = []; doneK.fill(false); helped.fill(false); badK.fill(0); demoTok++; clearTrails(); redraw(); park(); });
  tools.append(hb, eb);
  s.append(box, tools, el('div', '', '<div style="height:20px"></div>'));
  fit(); requestAnimationFrame(fit); new ResizeObserver(fit).observe(box);
  if (window.HP) HP.trace = { letter: j, guide: guideP, sc: SO.sc, demoDone: false, toPx: p => { const r = box.getBoundingClientRect(), q = toPx(p); return [r.left + q[0], r.top + q[1]]; }, get state() { return { done: doneK.slice(), helped: helped.slice(), bad, badK: badK.slice(), next: nextK(), finished, busy, ink: ink.length }; },
    inject: pts => { ink.push(pts); redraw(); return onStroke(pts); } };
  if (copyMode) { say([isSyl(j) ? VOICE.syl(j) : VOICE.jamo(j), 'ui_trace']); mover.style.display = 'none'; drawGuide(); } else prompt();
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
    b.addEventListener('click', () => (thenEnd ? showEnd() : needMove() ? showMove(showHome) : showHome())); dock.append(b);
  })();
}

/* ---------- 오늘 끝 / 쉬는 화면 ---------- */
function paperTip() {
  const met = Object.keys(S.met).filter(j => S.met[j] === today());
  const j = met[met.length - 1] || 'ㄱ', e = JAMO_EX[j];
  const T = curTopic();
  return T.home + (met.length ? ' 오늘 만난 글자 ' + j + '을(를) 종이에 크게 써 주고 따라 그려 보게 해도 좋아요(' + e.word + ' 할 때 ' + JNAME[j] + ').' : '');
}
function showEnd() {
  const [id, s] = screen('end', { night: true }); S.session.ended = true; save(); drawTime();
  const hero = el('div', 'endhero', '<img class="moon" alt="" src="' + ICON('moon') + '">'); hero.append(mg('sleep'), el('h1', '', '오늘 놀이 끝!'), el('p', '', '내일 또 만나'));
  const sts = S.session.stickers, last = sts[sts.length - 1];
  const done = S.session.done.map(playById).filter(Boolean);
  const card = el('div', 'today', '<div class="st">' + (last ? '<img alt="오늘 스티커" src="' + STICKER(last) + '">' : '<img alt="" src="' + ICON('sticker') + '" style="width:48px;height:48px">') + '</div>' +
    '<div class="txt"><b>' + (sts.length ? '오늘 스티커 ' + sts.length + '장 받았어' : '오늘도 잘 놀았어') + '</b><div class="played">' +
    done.slice(0, 5).map(p => { const col = rowOf(p).color; const inner = smallInner(p); return '<span class="t-' + col + '">' + inner + '</span>'; }).join('') +
    '</div><div class="note">' + (Object.keys(S.met).filter(j => S.met[j] === today()).length ? '오늘 만난 글자: ' + Object.keys(S.met).filter(j => S.met[j] === today()).join(' ') + ' · ' : '') + '정원: 꽃 ' + PLAYS.filter(p => stage(p.id) !== 'sprout').length + ' · 열매 ' + PLAYS.filter(p => stage(p.id) === 'fruit').length + '</div></div>');
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
  const words = Object.keys(S.words || {}).filter(w => S.words[w] >= today(-6)).map(w => WORDS[w]);
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
    '<div class="cap">읽은 낱말(이번 주)</div><div class="sec sum"><div class="met">' + (w.words.length ? w.words.map(x => '<span class="w">' + x + '</span>').join('') : '<span class="w">아직 없어요</span>') + '</div></div>' +
    '<div class="cap">이번 주 주제 · 10주 커리큘럼(잠금 없음, 언제든 바꿀 수 있어요)</div><div class="sec"><div class="topics" id="pmTopics">' + TOPICS.map(t => '<button data-t="' + t.id + '" class="' + (t.id === S.topic ? 'on' : '') + '"><b>' + t.n + '</b> ' + t.short + '<i>꽃 ' + flowersIn(t) + '/' + t.plays.length + '</i></button>').join('') + '</div>' +
    '<div class="tinfo"><b>' + curTopic().n + '주 · ' + curTopic().title + '</b>' + curTopic().plays.map(p => '<div class="pw"><span>' + p.name + (p.kind === 'letter' || p.kind === 'pick' || p.kind === 'trace' || p.kind === 'merge' ? ' (' + p.items.slice(0, 4).join(' ') + ')' : '') + '</span><small>이 놀이는 ' + KINDS[p.kind].why + '</small></div>').join('') +
    '<div class="pw"><span>집에서</span><small>' + curTopic().home + '</small></div></div>' +
    '<small class="flow">하루 흐름: 인사 → 다시 보기 1(1·3·7·14일 간격) → 이번 주 놀이 2(12·15분이면 3) → 몸으로 글자 → 아이가 고르기 → 잘 자. 쓰기는 이틀에 한 번, 토요일은 모아 놀기(새 내용 없음). 이번 주제에서 꽃이 2개 피면 다음 주제를 추천만 해요. 점수·순위 없음.</small></div>' +
    '<div class="cap">놀이</div><div class="sec">' +
    '<div class="r"><div class="l">한 번 놀이 시간</div>' + seg('timerMin', [[10, '10분'], [12, '12분'], [15, '15분']], S.settings.timerMin) + '</div>' +
    '<div class="r"><div class="l">오늘의 놀이 자동 추천<small>다시 보기 1 + 이번 주 놀이 2~3 + 아이가 고르기</small></div><button class="tg' + (S.settings.autoPick ? ' on' : '') + '" id="tgAuto" aria-label="자동 추천"></button></div>' +
    '<button class="r" id="rManual"><div class="l">직접 고르기<small>오늘 할 놀이 최대 3개 · 자동 추천을 끄면 이것만 나와요</small></div><div class="v"><img alt="" src="' + ICON('back') + '"></div></button>' +
    '<div class="more" id="mManual" hidden><div class="chips">' + PLAYS.map(p => '<button data-p="' + p.id + '" class="' + (S.settings.manual.includes(p.id) ? 'on' : '') + '">' + rowOf(p).n + '주 · ' + p.name + '</button>').join('') + '</div><small>고른 놀이는 지금 바로 오늘의 놀이에 반영돼요.</small></div>' +
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
  $('#pmTopics').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; setTopic(b.dataset.t); openParent(); });
  $('#pmClose').addEventListener('click', closeParent);
}
function closeParent() { const PM = $('#parent'); PM.hidden = true; PM.innerHTML = ''; run = null; showHome(); }

/* ---------- 시작 ---------- */
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { save(); stopAudio(); } });
if ('speechSynthesis' in window) speechSynthesis.getVoices();
window.HP = { hidLevel, hidUpdate, lookAlikes, testRound: (kind, item, p) => { run = { pid: 'test', p: Object.assign({ kind, items: [item] }, p || {}), queue: [item], i: 0, ok: 0, first: 0 }; const [id, s] = screen('round-' + kind, { home: true }); HP.lastDone = undefined; RUN[kind](item, id, s, ok => { HP.lastDone = ok; }); }, testTrace: (j, copy) => { const [id, s] = screen('round-trace', { home: true }); HP.lastDone = undefined; traceRound(j, id, s, ok => { HP.lastDone = ok; }, !!copy); }, get S() { return S; }, get run() { return run; }, save, limitMs, screen: '', round: null, trace: null, judgeTrace, STROKES, strokePoints, strokesOf, judgeStroke, record, isMastered, today, startPlay, showHome, showGarden, showEnd, showBook, openGate, computeToday, showDex, showMove, setTopic, todayList, audioLog: [], audioErr: [] };
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
showHome();
