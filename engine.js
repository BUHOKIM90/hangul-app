'use strict';
/* 한글 놀이 v4 엔진: v3 app.js에서 그대로 가져온 부분(도우미·소리·몽글이·그림·문제 화면·놀이 16개·끌기·따라 쓰기 판정·어른 확인).
   v4 껍데기(지도·하루 열기·복습·어른 메뉴)는 app.js. 바꾼 곳: today()가 시험용 날짜 이동(DAY_OFFSET)을 따름, PLAYS/TOPICS 의존 줄 뺌. */
const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const wait = ms => new Promise(r => setTimeout(r, ms));
const rand = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const pad2 = n => String(n).padStart(2, '0');
let DAY_OFFSET = 0;   // 시험용(HP.setOffset): 기기 날짜를 n일 옮긴 것처럼
const today = (plus = 0) => { const d = new Date(Date.now() + DAY_OFFSET * 86400000); d.setDate(d.getDate() + plus); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const params = new URLSearchParams(location.search);
const ICON = n => 'assets/icons/' + n + '.svg';
const isSyl = c => c >= '가' && c <= '힣';
/* 11/07 조사 맞추기(받침 있으면 a, 없으면 b): 거북을/오리를, 곰이야/오리야 — 화면 말풍선 글이 어색하지 않게 */
const hasJong = w => { const c = String(w || '').slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
const jo = (w, a, b) => hasJong(w) ? a : b;
const JNAME = { 'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음', 'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅎ': '히읗', 'ㅏ': '아', 'ㅓ': '어', 'ㅗ': '오', 'ㅜ': '우', 'ㅡ': '으', 'ㅣ': '이', 'ㅊ': '치읓', 'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅑ': '야', 'ㅕ': '여', 'ㅛ': '요', 'ㅠ': '유' };
const realIds = a => a.filter(x => x[0] !== '@');
const compose = (c, v) => String.fromCharCode(0xAC00 + CHO.indexOf(c) * 588 + JUNG.indexOf(v) * 28);

/* ---------- 소리 (v1과 같음 + 소리 크기) ---------- */
const player = new Audio();
let sayToken = 0, pending = null, actx = null, playSeq = 0;
/* 11/07 TTS 대체(MDN voiceschanged · 브라우저별 특이점 정리글): 목소리 목록은 늦게 채워짐 → onvoiceschanged로 다시 읽어 둠. lang은 ko-KR/ko_KR 둘 다.
   기기 안 목소리(localService)만 씀 — 인터넷 목소리는 글을 밖으로 보내므로 쓰지 않음(개인정보 약속). 속도 0.9·높이 1.1(아이에게 조금 밝게) */
let KO_VOICE = null;
function pickKoVoice() { if (!('speechSynthesis' in window)) return null; const vs = speechSynthesis.getVoices() || []; KO_VOICE = vs.find(v => v.lang && /^ko([-_]|$)/i.test(v.lang) && v.localService) || null; return KO_VOICE; }
if ('speechSynthesis' in window) { pickKoVoice(); speechSynthesis.onvoiceschanged = pickKoVoice; }
function localKoVoice() { return KO_VOICE || pickKoVoice(); }
function speakFallback(key) {
  const v = localKoVoice(), text = (typeof LINES !== 'undefined' && LINES[key]) || '';
  if (!v || !text) return wait(350);
  return new Promise(res => { const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.9; u.pitch = 1.1; u.volume = S.settings.volume; u.onend = u.onerror = res; pending = res; speechSynthesis.speak(u); });
}
function playOne(key, onProgress) {
  if (key === 'w_i_tooth') key = 'sy_C774';
  if (!S.settings.sound) { syncSoftMuteChip(); const c = document.getElementById('softMute'); if (c) { c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); } return wait(250); }
  unlockAudio();
  return new Promise(res => {
    const my = ++playSeq; let fin = false, guard = 0;
    const finish = () => { if (fin) return; fin = true; clearTimeout(guard); if (playSeq === my) { player.ontimeupdate = player.onended = player.onerror = player.onpause = player.onloadedmetadata = null; pending = null; } res(); };
    pending = finish; player.onended = finish;
    player.onpause = () => { if (player.ended || (player.duration && player.currentTime >= player.duration - 0.15)) finish(); };
    player.onloadedmetadata = () => { if (isFinite(player.duration)) guard = setTimeout(finish, (player.duration + 2) * 1000); };
    player.onerror = () => { player.onerror = null; if (window.HP) HP.audioErr.push(key); speakFallback(key).then(finish); };
    player.ontimeupdate = onProgress ? () => player.duration && onProgress(player.currentTime / player.duration) : null;
    player.volume = S.settings.volume; player.src = 'audio/' + key + '.mp3'; if (window.HP) HP.audioLog.push(key);
    player.play().catch(err => { if (err && err.name === 'NotAllowedError') { playerUnlocked = false; audioGestureNeeded = true; syncSoftMuteChip(); } if (playSeq !== my || (err && (err.name === 'NotAllowedError' || err.name === 'AbortError'))) finish(); else if (player.onerror) player.onerror(); });
  });
}

/* §19 deep-learn Lycore: 다음 음성 미리 받기(아이들 대기 없음). 실패해도 무시 */
function prefetchAudio(keys) {
  try {
    [].concat(keys || []).slice(0, 3).forEach(k => {
      if (!k) return;
      const a = new Audio();
      a.preload = 'auto';
      a.src = 'audio/' + (k === 'w_i_tooth' ? 'sy_C774' : k) + '.mp3';
    });
  } catch (e) { /* ignore */ }
}
function stopAudio() { sayToken++; player.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); if (pending) pending(); }
function say(keys, each) {
  stopAudio(); const t = sayToken; const list = [].concat(keys); prefetchAudio(list.slice(1));
  return list.reduce((p, k, i) => p.then(() => { if (t !== sayToken) return; if (each) each(i, true); return playOne(k).then(() => each && t === sayToken && each(i, false)); }), Promise.resolve()).then(() => t === sayToken);
}
async function sayGap(keys, gap, each) {   // 낱말 사이에 쉼(뚝딱 소리 붙이기 "하… 마")
  stopAudio(); const t = sayToken;
  for (let i = 0; i < keys.length; i++) { if (t !== sayToken) return false; if (each) each(i); await playOne(keys[i]); if (t !== sayToken) return false; if (i < keys.length - 1) await wait(gap); }
  return t === sayToken;
}

/* §19 deep-learn 2026-11-07 (~40분): 웹·레딧·X·Flowy·Google Kids·Lycore·PWA UX
   1) iOS HTMLAudio는 AudioContext와 별개로 "제스처 안 play()"가 필요 → silent WAV data URL로 요소 unlock (flowy.fm)
   2) click/touchend에서 AudioContext.resume (touchstart만으로는 부족한 경우 있음)
   3) passive touchstart → iOS :active 누름표시 (progressivewebapps)
   4) Google Building for Kids: 소리 꺼진 줄 모르는 아이 → 시각 칩으로 소리 켜기
   5) Lycore offline-first: 진도 중간 저장(세션 중 autosave)
   6) iOS 가장자리 시스템 제스처 피하기 → 하단/측면 inset (이미 safe-area, dock 보강) */
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
let playerUnlocked = false, audioGestureNeeded = false;
function unlockAudio() {
  try {
    /* §19: Safari 16.4+ audioSession playback — 무음 스위치에 WebAudio가 죽지 않게(lans.cloud / unmute-ios) */
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
      try { navigator.audioSession.type = 'playback'; } catch (as) { /* ignore */ }
    }
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    /* interrupted도 running이 아님 — suspended만 보면 iOS 복귀 후 침묵 */
    if (actx.state !== 'running' && actx.state !== 'closed') actx.resume().catch(() => {});
    if (!actx._hangulStateHook) {
      actx._hangulStateHook = true;
      actx.addEventListener('statechange', () => {
        if (actx.state !== 'running' && actx.state !== 'closed') {
          audioGestureNeeded = true; syncSoftMuteChip();
        }
      });
    }
  } catch (e) { /* ignore */ }
  try {
    if (!playerUnlocked && player) {
      const cur = player.src || '';
      if (!cur || cur.indexOf('data:audio/wav') === 0) {
        const wasMuted = player.muted;
        player.muted = true;
        player.src = SILENT_WAV;
        const p = player.play();
        if (p && p.then) {
          p.then(() => {
            if ((player.src || '').indexOf('data:audio/wav') === 0) { player.pause(); player.currentTime = 0; }
            player.muted = wasMuted;
            playerUnlocked = true; audioGestureNeeded = false; syncSoftMuteChip();
          }).catch(() => { player.muted = wasMuted; });
        }
      } else {
        playerUnlocked = true;
      }
    }
  } catch (e2) { /* ignore */ }
  syncSoftMuteChip();
}
function syncSoftMuteChip() {
  try {
    let chip = document.getElementById('softMute');
    if (!S || !S.settings) return;
    const need = !S.settings.sound || audioGestureNeeded;
    if (!need) { if (chip) chip.remove(); return; }
    if (!chip) {
      chip = document.createElement('button');
      chip.id = 'softMute';
      chip.type = 'button';
      chip.className = 'soft-mute';
      chip.addEventListener('click', e => {
        e.stopPropagation();
        S.settings.sound = true;
        audioGestureNeeded = false;
        save();
        unlockAudio();
        syncSoftMuteChip();
        try { ding(1.1); } catch (er) {}
      });
      (document.getElementById('app') || document.body).appendChild(chip);
    }
    const label = !S.settings.sound ? '소리 켜기' : '톡! 소리 열기';
    chip.setAttribute('aria-label', label);
    chip.innerHTML = '<span aria-hidden="true">' + (!S.settings.sound ? '🔇' : '🔊') + '</span><span class="sm-txt">' + label + '</span>';
  } catch (e) { /* ignore */ }
}
(function wireAudioUnlock() {
  const once = () => { unlockAudio(); };
  ['click', 'touchend', 'pointerup', 'mousedown', 'keydown'].forEach(ev =>
    document.addEventListener(ev, once, { capture: true, passive: true }));
  document.addEventListener('touchstart', () => {}, { passive: true });
  // 세션 중 진도 중간 저장 (Lycore: never lose progress)
  setInterval(() => { try { if (typeof save === 'function' && S) save(); } catch (e) {} }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') try { save(); } catch (e) {}
    /* §19: 백그라운드 복귀 후 AudioContext interrupted/suspended → 칩으로 탭 유도(webkit 291892) */
    if (document.visibilityState === 'visible') {
      try {
        if (actx && actx.state !== 'running' && actx.state !== 'closed') {
          audioGestureNeeded = true; syncSoftMuteChip();
          actx.resume().catch(() => {});
        }
      } catch (ev) { /* ignore */ }
    }
  });
  setTimeout(syncSoftMuteChip, 0);
})();

/* §19 deep-learn: Android Vibration API — 짧은 탭만, prefers-reduced-motion·설정 존중 (iOS는 API 없음) */
function kidHaptic(kind) {
  try {
    if (typeof prefersReduce === 'function' && prefersReduce()) return;
    if (!('vibrate' in navigator)) return;
    if (kind === 'ok') navigator.vibrate(12);
    else if (kind === 'soft') navigator.vibrate(8);
    else if (kind === 'no') navigator.vibrate([10, 40, 10]);
  } catch (e) { /* ignore */ }
}
function clapFx() {   // 손뼉 소리(짧은 잡음, 기기 안에서 만듦)
  kidHaptic('ok');
  if (!S.settings.sound) return;
  unlockAudio();
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
  kidHaptic('ok');
  if (!S.settings.sound) return;
  unlockAudio();
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [[784 * high, 0], [1047 * high, 0.13]].forEach(([f, t0]) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + t0, peak = 0.12 * S.settings.volume + 0.0002;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.3);
    });
  } catch (e) { /* 소리 없이 */ }
}

/* 11/06 풍선 터짐 소리(기기 안에서 만듦, mp3 아님): 짧은 '퐁' + 높은 반짝. 틀렸을 때는 낮고 부드러운 '뿡'(꾸중 아님) */
function popFx() {
  if (!S.settings.sound) return;
  unlockAudio();
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, v = S.settings.volume;
    const len = Math.floor(actx.sampleRate * 0.06), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = 900; g.gain.value = 0.7 * v;
    src.connect(f).connect(g).connect(actx.destination); src.start(t);
    const o = actx.createOscillator(), og = actx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.16 * v + 0.0002, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(og).connect(actx.destination); o.start(t); o.stop(t + 0.25);
  } catch (e) { /* 소리 없이 */ }
}
function boopFx() {
  kidHaptic('no');
  if (!S.settings.sound) return;
  unlockAudio();
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * S.settings.volume + 0.0002, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.28);
  } catch (e) { /* 소리 없이 */ }
}
/* 풍선이 터질 때 색 조각 8개가 사방으로(움직임 줄이기면 생략) */
function balloonBurst(host, node) {
  if (prefersReduce() || !host || !node) return;
  const hr = host.getBoundingClientRect(), r = node.getBoundingClientRect(), cx = r.left - hr.left + r.width / 2, cy = r.top - hr.top + r.height * 0.4;
  const cols = ['#F27BA6', '#F5C04A', '#7CC6A4', '#8E7CE0', '#F2994A', '#6BB7E8'];
  for (let i = 0; i < 10; i++) {
    const p = el('i', 'burst'); const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4, dist = 60 + Math.random() * 50;
    p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.background = cols[i % cols.length];
    host.append(p);
    requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transform = 'translate(' + Math.cos(a) * dist + 'px,' + Math.sin(a) * dist + 'px) scale(.4)'; p.style.opacity = '0'; }));
    setTimeout(() => p.remove(), 700);
  }
}

/* ---------- 몽글이 ---------- */
let charImg = null;
function mg(expr = 'basic', cls = 'mg') { const i = el('img', cls); i.alt = '몽글이'; i.src = CHAR_DIR + expr + CHAR_EXT; return i; }
function charEl(expr) { charImg = mg(expr); return charImg; }
function setChar(expr) { if (charImg) charImg.src = CHAR_DIR + expr + CHAR_EXT; }
const prefersReduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function bounce(n = charImg) { if (!n || prefersReduce()) return; n.classList.remove('bounce'); void n.offsetWidth; n.classList.add('bounce'); }
let bubbleEl = null;
function guide(expr, text, low) { const g = el('div', 'guide' + (low ? ' low' : '')); bubbleEl = el('div', 'bubble', text); g.append(charEl(expr), bubbleEl); return g; }
const setBubble = t => { if (bubbleEl) bubbleEl.innerHTML = t; };
function pointSay(keys, each) { setChar('point'); return say(keys, each).then(ok => { if (ok) setChar('think'); return ok; }); }

/* ---------- 그림 (없으면 첫 글자 자리표시: 그림 파일만 넣으면 바로 바뀜) ---------- */
const hasPic = w => ARTS.pic.includes(w);
const picHTML = (w, label, cls = '') => hasPic(w) ? '<img class="' + cls + '" alt="' + (label || '') + '" src="' + PIC(w) + '">' : '<div class="ph ' + (PH_EMOJI[w] ? 'emo ' : '') + cls + '" aria-label="' + (label || WORDS[w] || '') + '">' + (PH_EMOJI[w] || (label || WORDS[w] || '?')[0]) + '</div>';
/* 11/06: 목록(art.js)에는 있는데 파일이 아직 없는 그림(예: hobak·subak·scene_*)이 깨진 그림 표시로 보이지 않게 → 글자/이모지 자리표시로 바꿈 */
document.addEventListener('error', e => {
  const t = e.target; if (!t || t.tagName !== 'IMG' || t.dataset.fb) return;
  const m = /assets\/pic\/([^/.]+)\.webp/.exec(t.getAttribute('src') || ''); if (!m) return;
  t.dataset.fb = '1'; const id = m[1], lab = (typeof WORDS !== 'undefined' && WORDS[id]) || t.alt || '';
  if (!lab && !PH_EMOJI[id]) { t.style.visibility = 'hidden'; return; }
  const d = el('div', 'ph ' + (PH_EMOJI[id] ? 'emo ' : '') + (t.className || ''), PH_EMOJI[id] || lab[0]); d.setAttribute('aria-label', lab); t.replaceWith(d);
}, true);
const exPic = j => { const e = JAMO_EX[j]; return e ? picHTML(e.pic, e.word) : ''; };

/* ---------- 화면 공통 ---------- */
let screenId = 0, run = null, roundTok = 0;
/* 11/07: 화면마다 만든 ResizeObserver를 화면이 바뀔 때 끊음(지난 화면 그림·지도에 계속 붙어 있던 누수) */
let ROS = [];
function watchSize(node, fn) { try { const ro = new ResizeObserver(fn); ro.observe(node); ROS.push(ro); } catch (e) { /* 옛 기기 */ } }
function screen(name, opts = {}) {
  ROS.forEach(r => r.disconnect()); ROS = [];
  // 11/06: 화면이 바뀌면 지난 정답 판(.rvwrap)이 남아 새 화면을 가리지 않게 지움
  screenId++; stopAudio(); document.querySelectorAll('.rvwrap').forEach(x => x.remove()); main.innerHTML = ''; missedSince = false; main.dataset.screen = name; charImg = null; bubbleEl = null; ticking = false;
  $('#homeBtn').hidden = !opts.home; document.body.classList.toggle('night', !!opts.night);
  drawTime(); if (window.HP) HP.screen = name;
  const s = el('div', 'scr s-' + name + (opts.scroll ? ' scroll' : '')); main.appendChild(s); return [screenId, s];
}
const alive = id => id === screenId;
const spark = el('img'); spark.id = 'spark'; spark.alt = ''; spark.src = ICON('flower'); document.body.appendChild(spark);
function sparkPop() { if (prefersReduce()) return; spark.classList.remove('go'); void spark.offsetWidth; spark.classList.add('go'); }
let praiseFlip = 0;
/* 11/06 §19 칭찬 고르기(근거: Mueller & Dweck 1998, Kamins & Dweck 1999 — 사람 칭찬보다 과정 칭찬이 실패 뒤 버티는 힘을 키움).
   ① 같은 칭찬을 연달아 두 번 하지 않음 ② 이번 판에서 한 번 틀렸다가 맞히면 '다시 해 봤네'류 과정 칭찬(소리 파일이 있을 때만, 없으면 기본 칭찬 — 기기 TTS 로봇 목소리 방지) */
let lastPraise = '', missedSince = false;
const hasVoice = k => typeof HAVE_AUDIO === 'undefined' || HAVE_AUDIO.has(k);
function praiseKey() {
  const retry = missedSince ? ['ui4_proc16', 'ui4_proc7'].filter(hasVoice) : []; missedSince = false;
  if (retry.length) { lastPraise = retry[rand(retry.length)]; return lastPraise; }
  const c = ['ui_good1', 'ui_good2', 'ui_good3'].filter(k => k !== lastPraise); lastPraise = c[rand(c.length)]; return lastPraise;
}
/* ---------- 정답 순간 공통(11/04 대표님): 맞힌 낱말·글자를 크게 + 몽글이가 한 글자씩 읽을 때 칸이 켜짐 + 칭찬 → 잠깐 머묾(톡 하면 바로 다음) ----------
   FB(모든 놀이 공통 시간, ms): sylGap 글자 사이 쉼 / beat 소리 끝난 뒤 머무는 시간 / min 화면에 최소로 떠 있는 시간 / skip 이만큼 지나면 톡해서 넘길 수 있음 / plain 낱말·글자가 아닌 정답(박자 수 등) 칭찬 뒤 쉼 */
const FB = { sylGap: 380, beat: 900, min: 2400, skip: 700, plain: 700, quickBeat: 450, quickMin: 1600 };   // quick = 한 판에 여러 번 나오는 작은 정답(바구니 나누기 카드)
function revealOf(x) {
  if (typeof x !== 'string' || !x) return null;
  if (WORDS[x]) return { text: WORDS[x], word: x, syl: [...WORDS[x]], voice: VOICE.word(x) };
  if (x.length === 1 && isSyl(x)) return { text: x, syl: [x], voice: VOICE.syl(x) };
  if (x.length === 1 && /[ㄱ-ㅣ]/.test(x)) return { text: x, syl: [x], voice: VOICE.jamo(x), jamo: true };
  return null;
}
async function reveal(id, target, opt = {}) {   // 공통 '크게 보여 주기'. opt.praise=false면 칭찬 생략, opt.say=false면 낱말 소리 생략(이미 읽음)
  const R = revealOf(target); if (!R || !alive(id)) return alive(id);
  const t0 = Date.now(), long = R.syl.length >= 4;
  const ov = el('div', 'rvwrap' + (long ? ' rv-long' : '') + (R.word ? ' rv-word' : ' rv-glyph'));
  const card = el('div', 'rvcard', (R.word && (hasPic(R.word) || PH_EMOJI[R.word]) ? '<div class="rvpic">' + picHTML(R.word, R.text) + '</div>' : '') + '<div class="rvsyl">' + R.syl.map(c => '<span>' + c + '</span>').join('') + '</div><i class="rvgo">➜</i>');
  ov.append(card); document.body.append(ov); if (window.HP) HP.reveal = { text: R.text, t0 };
  const tiles = [...card.querySelectorAll('.rvsyl span')];
  let skip = false, resolveSkip; const skipP = new Promise(r => { resolveSkip = r; });
  ov.addEventListener('pointerdown', () => { if (Date.now() - t0 < FB.skip) return; skip = true; stopAudio(); resolveSkip(); });
  requestAnimationFrame(() => ov.classList.add('in')); setChar('clap'); bounce(); sparkPop(); ding();
  const run1 = (async () => {
    if (opt.say !== false && R.syl.length > 1 && R.syl.every(c => hasA(VOICE.syl(c)))) await sayGap(R.syl.map(VOICE.syl), FB.sylGap, k => tiles.forEach((t, i) => { t.classList.toggle('on', i <= k); t.classList.toggle('now', i === k); }));
    if (skip || !alive(id)) return; tiles.forEach(t => { t.classList.remove('now'); t.classList.add('on', 'all'); });
    if (opt.say !== false) await say(R.voice);
    if (skip || !alive(id)) return; if (opt.praise !== false) { setChar(praiseFlip++ % 2 ? 'laugh' : 'clap'); await say(praiseKey()); }
    if (skip || !alive(id)) return; ov.classList.add('cango'); await wait(opt.quick ? Math.max(FB.quickBeat, FB.quickMin - (Date.now() - t0)) : Math.max(FB.beat, FB.min - (Date.now() - t0)));
  })();
  await Promise.race([run1, skipP]);
  ov.classList.add('out'); setTimeout(() => ov.remove(), 260); if (window.HP) HP.reveal = null;
  return alive(id);
}
/* 11/04 다음 칸 안내: 누를 곳이 반짝·통통 + 잠시 뒤 손가락(👆)이 톡톡. 소리는 부르는 쪽에서 가끔만 */
function tapHint(node, delay = 1400) {
  if (!node) return; node.classList.add('gonext');
  if (prefersReduce()) return;   // 움직임 줄이기: 반짝·손가락 생략, gonext 테두리만
  const id = screenId; setTimeout(() => { if (!alive(id) || !node.isConnected || node.querySelector('.taphand')) return; node.append(el('i', 'taphand', '<img alt="" src="' + ICON('hand') + '">')); }, delay);
}
async function success(id, target) {
  if (revealOf(target)) return reveal(id, target);
  sparkPop(); ding(); setChar(praiseFlip++ % 2 ? 'laugh' : 'clap'); bounce(); await say(praiseKey()); await wait(FB.plain); return alive(id);
}
/* §19 deep-learn: PBS Kids / Callaghan 스캐폴딩 — 1차 격려, 2차 힌트음성, 3차+ 정답 반짝(수치심 없이) */
async function retryFx(id, node, opts) {
  missedSince = true;   // 11/06 §19: 다음 정답 때 과정 칭찬
  opts = opts || {};
  const n = opts.wrongN || 1;
  if (node) { node.classList.remove('retry'); void node.offsetWidth; node.classList.add('retry'); setTimeout(() => node.classList.remove('retry'), 1100); }
  setChar('cheer');
  if (n <= 1) await say('ui_retry');
  else if (n === 2) { await say('ui_retry'); if (alive(id)) await say('ui4_hint'); }
  else {
    await say('ui4_try');
    if (opts.correct) tapHint(opts.correct, 200);
  }
  if (alive(id)) setChar('think');
}

/* ---------- 문제 엔진 ---------- */
const others = (pool, x, n) => { const out = []; for (const p of shuffle(pool.filter(p => p !== x && !PIC_CLASH(p, x)))) if (out.length < n && !out.some(o => PIC_CLASH(o, p))) out.push(p); return out; };   // 개·강아지처럼 닮은 그림은 한 판에 같이 안 냄
const pool3 = () => (run && run.p.items.length >= 3 ? run.p.items : WORD_IDS);
function speakerBtn(fn, cls = 'spk', label = '다시 듣기') { const b = el('button', cls, '<img alt="" src="' + ICON('speaker') + '">'); b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b; }
function choiceRound(id, cards, correct, done, target) {
  let first = true, locked = false, wrongN = 0;
  const row = el('div', 'choices');
  cards.forEach((c, i) => {
    c.insertAdjacentHTML('beforeend', '<span class="badge"><img alt="" src="' + ICON('check') + '"></span>');
    c.addEventListener('click', async () => {
      if (locked || !alive(id)) return;
      if (i === correct) { locked = true; c.classList.add('ok'); if (await success(id, target === undefined ? cards[correct].dataset.k : target)) done(first); }
      else { first = false; locked = true; wrongN++; await retryFx(id, c, { wrongN, correct: cards[correct] }); locked = false; }
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
function drawJar(j) { const n = S.pw.stars % 10; j.querySelector('.fill').style.height = (n * 10) + '%'; j.querySelector('.cnt').textContent = '★'; j.querySelector('.jars').textContent = '🫙'.repeat(Math.min(S.pw.jars || 0, 5)); /* v4: 아이 화면에 숫자 없음 */ }
function addStar(j) { S.pw.stars++; const full = S.pw.stars % 10 === 0; if (full) S.pw.jars++; j.classList.remove('pop'); void j.offsetWidth; j.classList.add('pop'); if (full) { j.querySelector('.fill').style.height = '100%'; j.querySelector('.cnt').textContent = '★'; setTimeout(() => drawJar(j), 2600); } else drawJar(j); return full; }
async function surprise(s, big) {   // 가끔 깜짝: 몽글이 점프 + 별·꽃 비
  const box = el('div', 'confetti' + (big ? ' big' : ''));
  for (let i = 0; i < (big ? 26 : 12); i++) { const c = el('i', '', ['★', '✿', '♥', '●'][i % 4]); c.style.left = (Math.random() * 100) + '%'; c.style.color = CARD_COLORS[i % CARD_COLORS.length]; c.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's'; box.append(c); }
  document.body.append(box); setChar('jump'); bounce(); await wait(big ? 1600 : 1100); box.remove();
}
const RUN = {
  /* 그림 속 글자 찾기(11/03): 그림 속 몸 위 평평한 자리에 낱말을 그 자리 색과 비슷하게 숨김. 찾으면 톡 튀어나오며 "찾았다! ○○!" */
  hidden(w, id, s, done) {
    const L = HIDDEN.lv[run.p.lv || 1], H = HSPOT[w] || { s: [] }, spots = H.s.slice();
    if (!spots.length) return done(null);
    const ti = (run.p.lv || 1) === 1 ? 0 : rand(spots.length);
    const pool = HID_WORDS.filter(x => x !== w && WORDS[x][0] !== WORDS[w][0]);
    const near = HID_WORDS.filter(x => x !== w && (WORDS[x][0] === WORDS[w][0] || (WCAT_OF[x] === WCAT_OF[w])));
    const dpool = (run.p.lv || 1) >= 3 && near.length ? shuffle(near).concat(shuffle(pool)) : shuffle(pool);
    const others = spots.map((_, k) => k).filter(k => k !== ti).slice(0, L.decoys);
    const marks = [{ w, k: ti, target: true }].concat(others.map((k, q) => ({ w: dpool[q], k })));
    let first = true, found = false, missed = 0;
    const prompt = () => pointSay(VOICE.hw(w));
    const pr = el('div', 'hwcard', '<span class="hwword">' + WORDS[w] + '</span>'); pr.append(speakerBtn(prompt));
    const box = el('div', 'hwbox'), img = el('img'); img.alt = ''; img.src = PIC(w); img.draggable = false; box.append(img);
    const ring = el('div', 'hwring'); box.append(ring);
    const mix = (c, d) => { const lum = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114; return 'rgb(' + c.map(v => Math.round(lum < 110 ? v + (255 - v) * d : v * (1 - d))).join(',') + ')'; };
    marks.forEach(m => {
      const [cx, cy, sw, sh, col] = spots[m.k];
      const sp = el('span', 'hw' + (m.target ? ' tgt' : ' decoy'), WORDS[m.w]); sp.dataset.w = m.w;
      sp.style.left = cx + '%'; sp.style.top = cy + '%'; sp.style.color = mix(col, L.delta);
      m.rot = (Math.random() * 2 - 1) * L.rot; m.box = [sw, sh]; m.el = sp; box.append(sp);
    });
    const fit = () => { const W = box.getBoundingClientRect().width; if (!W) return;
      marks.forEach(m => { const n = WORDS[m.w].length, fs = Math.min(m.box[1] * 0.8, m.box[0] * 0.9 / n) * L.size * W / 100; m.el.style.fontSize = Math.max(14, fs).toFixed(1) + 'px'; m.el.style.transform = 'translate(-50%,-50%) rotate(' + m.rot.toFixed(1) + 'deg)'; });
      const R = marks.map(m => m.el.getBoundingClientRect()), hitR = (a, c) => a.left < c.right + 6 && c.left < a.right + 6 && a.top < c.bottom + 6 && c.top < a.bottom + 6;
      for (let q = marks.length - 1; q >= 1; q--) if (R.some((r, k) => k !== q && hitR(R[q], r))) { marks[q].el.remove(); marks.splice(q, 1); R.splice(q, 1); }   // 작은 화면에서 겹치면 가짜 글자를 뺌
      const t = marks[0].el.getBoundingClientRect(), b = box.getBoundingClientRect(), pad = 26;
      ring.style.left = (t.left - b.left - pad) + 'px'; ring.style.top = (t.top - b.top - pad) + 'px'; ring.style.width = (t.width + 2 * pad) + 'px'; ring.style.height = (t.height + 2 * pad) + 'px'; };
    s.append(guide('think', '<b>' + WORDS[w] + '</b> 글씨를 찾아봐!'), pr, box);
    fit(); requestAnimationFrame(fit); watchSize(box, fit);
    const t0 = Date.now();
    const hintT = setTimeout(() => { if (!alive(id) || found) return; ring.classList.add('on'); setBubble('반짝이는 데를 봐!'); say('ui_hwhint'); first = false; }, HIDDEN.hint);
    const revT = setTimeout(() => { if (!alive(id) || found) return; got(true); }, HIDDEN.reveal);
    async function got(revealed) {
      found = true; clearTimeout(hintT); clearTimeout(revT); ring.classList.remove('on');
      const t = marks[0].el; t.classList.add('found'); sparkAt(t); ding(); setChar(revealed ? 'point' : 'clap'); bounce();
      setBubble(revealed ? '여기 있었어! <b>' + WORDS[w] + '</b>' : '찾았다! <b>' + WORDS[w] + '</b>!');
      await say('ui_found'); if (await reveal(id, w)) done(revealed ? null : first);
    }
    box.addEventListener('pointerdown', async e => {
      if (found || !alive(id)) return;
      const hit = marks.map(m => { const r = m.el.getBoundingClientRect(), g = Math.max(28, r.height * 0.6); const inside = e.clientX >= r.left - g && e.clientX <= r.right + g && e.clientY >= r.top - g && e.clientY <= r.bottom + g;
        return { m, inside, d: Math.hypot(e.clientX - (r.left + r.right) / 2, e.clientY - (r.top + r.bottom) / 2) }; }).filter(x => x.inside).sort((a, b) => a.d - b.d)[0];
      if (!hit) return;
      if (hit.m.target) return got(false);
      if (hit.m.el.classList.contains('seen')) return;
      first = false; missed++; hit.m.el.classList.add('seen'); setChar('think');
      setBubble('그건 <b>' + WORDS[hit.m.w] + '</b>' + jo(WORDS[hit.m.w], '이야', '야') + '! <b>' + WORDS[w] + '</b>' + jo(WORDS[w], '을', '를') + ' 찾아볼까?'); await say([VOICE.hy(hit.m.w), VOICE.hw(w)]);
    });
    if (window.HP) HP.hidden = { target: w, lv: run.p.lv || 1, marks: marks.map(m => ({ w: m.w, target: !!m.target })), rect: k => { const r = marks[k || 0].el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, t0, get found() { return found; }, ring: () => ring.classList.contains('on') };
    prompt();
  },
  /* 그림 보고 글자 고르기(11/03): 큰 그림 + 낱말 카드 2~5장. 색 힌트 = 그림 테두리와 정답 카드 색이 같음(주가 갈수록·잘 맞히면 옅어짐). 맞으면 카드가 그림으로 쏙 + 별 병 */
  picword(w, id, s, done) {
    const p = run.p, n = Math.min(p.cards || 2, PW_WORDS.length), st = S.pw.streak[w] || 0;
    const hint = Math.max(0, (p.hint == null ? 2 : p.hint) - (st >= 2 ? 1 : 0));
    const easy = n <= 3;
    const score = x => (WORDS[x][0] === WORDS[w][0] ? 3 : 0) + (WCAT_OF[x] === WCAT_OF[w] ? 2 : 0) + ([...WORDS[x]].some(c => WORDS[w].includes(c)) ? 1 : 0) + Math.random() * 1.5;
    const cand = PW_WORDS.filter(x => x !== w && WORDS[x] !== WORDS[w] && !PIC_CLASH(x, w));
    const dis = easy ? shuffle(cand.filter(x => WCAT_OF[x] !== WCAT_OF[w] && WORDS[x][0] !== WORDS[w][0])).slice(0, n - 1)
      : cand.sort((a, b) => score(b) - score(a)).slice(0, n - 1);
    const sea = WCAT_OF[w] === 'sea' ? shuffle(PW_WORDS.filter(x => x !== w && WCAT_OF[x] === 'sea' && (!SEA_SET.includes(w) || SEA_SET.includes(x)))) : [];   // 바다 친구 판: 가짜도 다 바다 친구(고래·상어·오징어·거북·해마)
    const opts = shuffle([w, ...(sea.length >= Math.max(2, n - 1) ? sea.slice(0, Math.max(n - 1, Math.min(4, sea.length))) : dis)]);
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
          if (full) { await surprise(s, true); if (!alive(id)) return; await say('ui_jarfull'); }
          else if (Math.random() < 0.2) await surprise(s, false);
          if (!alive(id)) return; if (await reveal(id, w)) done(first);
        } else {
          first = false; locked = true; S.pw.streak[w] = 0; c.classList.remove('retry'); void c.offsetWidth; c.classList.add("retry", "pwno"); setChar('cheer');
          setBubble('그건 <b>' + WORDS[x] + '</b>' + jo(WORDS[x], '이야', '야') + '!'); await say(VOICE.hy(x)); locked = false; if (alive(id)) { setChar('think'); setBubble('이건 뭘까?'); }
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
      if (filled === 2) { busy = true; await wait(300); frame.classList.add('done'); setBubble('<b>' + sy + '</b>' + jo(sy, '이', '가') + ' 됐어!'); if (alive(id) && await success(id, sy)) done(first); }
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
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === w) { pr.querySelectorAll('.syl span').forEach(x => x.classList.add('on')); } }));
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
      if (got === 2 && alive(id) && await success(id, w)) done(first);
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
    const choice = choiceRound(id, cards, n - 1, done, w); choice.classList.add('four'); choice.hidden = true;
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
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === w) { spans.forEach((x, k) => { x.textContent = syl[k]; x.classList.remove('q'); x.classList.add('on'); }); setBubble('<b>' + WORDS[w] + '</b>!'); } }));
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
      if (b.dataset.k === target) { busy = true; b.classList.add('ok'); if (await success(id, target)) done(first); }
      else { first = false; busy = true; await retryFx(id, b); busy = false; }
    }));
    const pr = el('div', 'prompt', '<div class="body"><span class="eye"><b style="color:var(--peach-ink);font-size:30px">' + c + '</b> 기차 출발!</span></div>');
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
      if (k === st.at) { busy = true; b.classList.add('ok'); S.words[st.target] = today(); if (await success(id, st.target)) done(first); }
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
/* 11/06 대표님: 태블릿(≥768px)은 쓰기 칸을 작게 → 획 굵기도 살짝 줄임(그리기 전용, 판정 무관). 폰은 그대로 크게 */
if (window.matchMedia && matchMedia('(min-width: 768px)').matches) Object.assign(TRACE_PX, { guide: 24, dash: 7, ink: 16, trail: 16, dot: 11 });
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
      if (nextK() < 0) { finished = true; busy = true; drawGuide(); mover.style.display = 'none'; const ok = helped.some(Boolean) ? null : bad === 0; if (await success(id, j)) done(ok); return { ok: true, took, finished: true }; }
      ding(1.15 + 0.1 * took.length); sparkPop(); setBubble('좋아! 다음 획도 써 볼까?'); park(); return { ok: true, took };
    }
    // 틀린 획: 이 획만 지우고 이 획만 다시 보여 줌
    bad++; badK[k0]++; busy = true; ink = ink.filter(x => x !== st); redraw();
    if (badK[k0] >= TRACE.maxTries) {   // 같이 써 주고 다음 획으로(벌점 없음, 숙달 계산 제외)
      setChar('cheer'); await say('ui_together'); if (!alive(id)) return { ok: false, retry: true }; await demo(k0); if (!alive(id)) return { ok: false, retry: true };
      helped[k0] = true; doneK[k0] = true; redraw(); busy = false;
      if (nextK() < 0) { finished = true; busy = true; drawGuide(); mover.style.display = 'none'; if (await success(id, j)) done(null); return { ok: false, helped: k0, finished: true }; }
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
  fit(); requestAnimationFrame(fit); watchSize(box, fit);
  if (window.HP) HP.trace = { letter: j, guide: guideP, sc: SO.sc, demoDone: false, toPx: p => { const r = box.getBoundingClientRect(), q = toPx(p); return [r.left + q[0], r.top + q[1]]; }, get state() { return { done: doneK.slice(), helped: helped.slice(), bad, badK: badK.slice(), next: nextK(), finished, busy, ink: ink.length }; },
    inject: pts => { ink.push(pts); redraw(); return onStroke(pts); } };
  if (copyMode) { say([isSyl(j) ? VOICE.syl(j) : VOICE.jamo(j), 'ui_trace']); mover.style.display = 'none'; drawGuide(); } else prompt();
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
