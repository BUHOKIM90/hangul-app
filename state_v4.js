'use strict';
/* 한글 놀이 v4 — 진도 상태·저장·v3 옮기기·복습 상자(Leitner)·하루 열기 규칙. 네트워크 없음, 이 기기 localStorage만. */
const KEY = 'hangul-play-v4', KEY_V3 = 'hangul-play-v3';
const BOX_DAYS = [0, 1, 2, 4, 7, 14, 30];
const DAYS = CURR.days, UNITS = CURR.units;
const fresh4 = () => ({ v: 4, start: null, cur: 1, lastNewDate: '', done: {}, extra: { unit: 0, count: 0 }, pendingExtra: null, items: {}, checks: [], stickers: [], town: { buildings: 0, props: 0 }, books: [],
  hard: false, boost: 0, suggestSkip: false, oneMoreDate: '', played: [], dayLog: [], todayMs: {},
  settings: { timerMin: 12, sound: true, volume: 0.9, colorHint: 'auto', birthday: '', pace: 'auto' },
  pw: { stars: 0, jars: 0, streak: {} }, met: {}, words: {}, session: { date: '', day: 0, mode: '', segsDone: 0, plan: null, finished: false, newStat: [0, 0] }, migratedFrom: '', hid: { lv: 1, good: 0, down: 0, log: [] } });
let S;
function itemKeyOf(x) { if (x && typeof x === 'object') return x.key || null; if (WORDS[x]) return 'w:' + x; if (isSyl(x)) return 's:' + x; return x ? 'j:' + x : null; }
function itemOfKey(k) { return k.slice(2); }
function migrateV3(o) {   // v3 → v4: 스티커·설정·만난 글자·읽은 낱말·별 병. 아는 자모·낱말은 복습 상자 2. 옛 기록은 지우지 않음
  S.migratedFrom = 'v3'; S.stickers = (o.stickers || []).slice();
  const st = o.settings || {}; ['timerMin', 'sound', 'volume'].forEach(k => { if (st[k] != null) S.settings[k] = st[k]; });
  if (o.pw) S.pw = Object.assign(S.pw, o.pw);
  const due = today(BOX_DAYS[2]);
  Object.keys(o.met || {}).forEach(j => { S.met[j] = o.met[j]; S.items['j:' + j] = { box: 2, due, hist: [1], seen: o.met[j] }; });
  Object.keys(o.words || {}).forEach(w => { if (WORDS[w]) { S.words[w] = o.words[w]; S.items['w:' + w] = { box: 2, due, hist: [1], seen: o.words[w] }; } });
  S.v3Topic = o.topic || '';
  if (o.hidLv || (o.pw && o.pw.hidLv)) S.hid.lv = Math.min(3, o.hidLv || o.pw.hidLv);   // v3 숨은 글자 단계가 있으면 이어서
}
function load() {
  let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
  S = fresh4();
  const pristine = r => r && r.v === 4 && !r.migratedFrom && !Object.keys(r.done || {}).length && !Object.keys(r.items || {}).length;   // v4를 열기만 하고 아직 놀지 않았으면 v3 기록을 옮김
  if (raw && raw.v === 4 && !(pristine(raw) && localStorage.getItem(KEY_V3))) { const f = fresh4(); S = Object.assign(f, raw); S.settings = Object.assign(f.settings, raw.settings); S.hid = Object.assign(f.hid, raw.hid); S.session = Object.assign(f.session, raw.session); S.pw = Object.assign(f.pw, raw.pw); return; }
  try { const o = JSON.parse(localStorage.getItem(KEY_V3) || 'null'); if (o) migrateV3(o); } catch (e) { /* 옛 기록이 깨졌으면 새로 시작 */ }
}
load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가: 계속 */ } };

/* ---------- 복습 상자 ---------- */
function rec(key, ok, hinted) {   // ok: true/false = 첫 시도, null = 기록 안 함. hinted = 힌트 받고 맞힘
  if (!key || ok == null) return;
  const t = today(), it = S.items[key] || (S.items[key] = { box: 0, due: t, hist: [], seen: t });
  it.hist = it.hist.concat(ok ? 1 : 0).slice(-6); it.seen = t;
  if (hinted) it.due = today(1);
  else if (ok) { it.box = Math.min(it.box + 1, 6); it.due = today(BOX_DAYS[it.box]); }
  else { it.box = 1; it.due = today(1); }
  if (key[0] === 'j') S.met[key.slice(2)] = S.met[key.slice(2)] || t;
  if (key[0] === 'w' && ok) S.words[key.slice(2)] = t;
  const ses = S.session; if (ses.newKeys && ses.newKeys.includes(key)) { ses.newStat[1]++; if (ok) ses.newStat[0]++; }
  if (ses.check) { ses.check.total++; if (ok) ses.check.right++; }
}
function touch(key) { if (!key) return; const t = today(); if (!S.items[key]) S.items[key] = { box: 0, due: today(1), hist: [], seen: t }; else S.items[key].seen = t; if (key[0] === 'j') S.met[key.slice(2)] = S.met[key.slice(2)] || t; }
const known = key => S.items[key] && S.items[key].box >= 4;
function dueKeys(filter) {
  const t = today();
  return Object.entries(S.items).filter(([k, v]) => v.due <= t && (!filter || filter(k))).sort((a, b) => (a[1].box - b[1].box) || (a[1].seen < b[1].seen ? -1 : 1)).map(x => x[0]);
}

/* ---------- 하루 열기(달력 기준, 기기 로컬 날짜만) ---------- */
function todayState() {
  const t = today(), ses = S.session;
  if (ses.date === t && (ses.mode === 'today' || ses.mode === 'extra') && !ses.finished) return 'going';
  if (S.lastNewDate >= t) return 'done';   // 시계를 뒤로 돌려도 새 날은 열리지 않음
  if (S.pendingExtra) return 'new';
  if (S.cur > 170) return 'all';
  if (S.cur > READY_DAYS) return 'soon';
  return 'new';
}
const canStartNew = () => S.lastNewDate < today() && S.cur <= 170;   // (빈 문자열 < 날짜) · 시계 뒤로 = 열리지 않음
