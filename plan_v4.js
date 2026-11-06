'use strict';
/* 한글 놀이 v4 — 하루 계획(curriculum_v4.json) 읽기 · 다양성 규칙 검사/고치기 · 한 번 더 놀이 날 만들기 · 타이머 맞추기 · 칸마다 문항 만들기(2.3) */
const hasA = k => typeof HAVE_AUDIO === 'undefined' || HAVE_AUDIO.has(k);
const isJ = x => typeof x === 'string' && x.length === 1 && !isSyl(x);
const CONS = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'], VOW6 = [...'ㅏㅓㅗㅜㅡㅣ'];
const idOfKr = {}; Object.entries(WORDS).forEach(([id, kr]) => { if (!idOfKr[kr]) idOfKr[kr] = id; }); idOfKr['사자'] = 'lion'; idOfKr['이'] = 'i_tooth';
const uWords = u => u.words.map(x => x[1]).filter(w => WORDS[w]);
const uJamo = u => u.jamo.split(/\s+/).filter(Boolean);
const fam = t => (CURR.plays[t] || {}).fam || t;
/* 이 앱(1부)이 실제로 돌릴 수 있는 놀이 */
const IMPL = ['chant', 'yesterday', 'letter', 'balloon', 'sort', 'block', 'stickerstory', 'map', 'cloud', 'treasure', 'name', 'listen', 'clap', 'blend', 'same', 'pick', 'trace', 'copy', 'merge', 'train', 'story', 'seek', 'choose', 'body'];
const SPECIAL_ONLY = ['map', 'cloud', 'treasure'];
const SLOT_OF = { warm: 'S', meet: 'M', write: 'W', story: 'Z' };

function ctxOf(dn) {
  const d = DAYS[dn - 1], u = UNITS[d.unit - 1];
  const newJ = d.new.filter(x => isJ(x)), newW = d.new.filter(x => !isJ(x)).map(x => idOfKr[x]).filter(Boolean);
  const kj = new Set(), kw = new Set();
  UNITS.slice(0, d.unit - 1).forEach(x => { uJamo(x).forEach(j => kj.add(j)); uWords(x).forEach(w => kw.add(w)); });
  DAYS.slice(0, dn).forEach(x => { if (x.unit === d.unit) x.new.forEach(j => { if (isJ(j)) kj.add(j); else if (idOfKr[j]) kw.add(idOfKr[j]); }); });
  Object.keys(S.items).forEach(k => { if (k[0] === 'j') kj.add(k.slice(2)); if (k[0] === 'w' && WORDS[k.slice(2)]) kw.add(k.slice(2)); });
  const unitJ = uJamo(u), unitW = uWords(u);
  const vowels = VOW6.filter(v => kj.has(v)), cons = CONS.filter(c => kj.has(c) && c !== 'ㅇ');
  const unitC = unitJ.filter(j => CONS.includes(j) && j !== 'ㅇ');
  return { d, u, dn, stage: d.stage, k: d.k, unitJ, unitW, unitC, newJ, newW, knownJ: [...kj], knownW: [...kw], vowels: vowels.length ? vowels : ['ㅏ', 'ㅣ'], cons, nopt: Math.min(5, (d.stage === 1 ? 2 : 3) + (S.hard ? 1 : 0)) };
}
/* ---------- 다양성 규칙(spec 5장) ---------- */
function checkDay(plan, prev) {
  const e = [], ts = plan.segs.map(s => s.type), fs = ts.map(fam);
  if (ts.length < 4 || ts.length > 7) e.push('칸 수 ' + ts.length);
  if (new Set(ts).size !== ts.length) e.push('같은 놀이 두 번');
  for (let i = 1; i < fs.length; i++) if (fs[i] === fs[i - 1]) e.push('붙은 칸 같은 가족 ' + ts[i - 1] + '/' + ts[i]);
  const cnt = {}; fs.forEach(f => { cnt[f] = (cnt[f] || 0) + 1; }); Object.entries(cnt).forEach(([f, n]) => { if (n > 2) e.push('가족 ' + f + ' ' + n + '번'); });
  if (prev) {
    if (plan.A && prev.A && plan.A === prev.A && !plan.special) e.push('A가 어제와 같음 ' + plan.A);
    const core = t => t !== 'chant' && t !== 'yesterday', same = ts.filter(t => core(t) && prev.segs.some(s => s.type === t));
    if (!plan.special && !prev.special && same.length > 2) e.push('어제와 같은 놀이 ' + same.length + '개');
    if (plan.theme && plan.theme === prev.theme) e.push('theme 이틀 연속');
  }
  if (plan.stage >= 2 && !plan.special && !ts.some(t => fam(t) === 'write')) e.push('쓰기 칸 없음');
  return e;
}
const hashN = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000 / 1000; };
/* 칸 하나 고르기(gen_v4.py wpick과 같은 점수): weight*3 − 최근 벌점 + 해시 */
function pickType(slot, stage, used, fams, hist, prevFam, nextFam, dn, avoid) {
  const pool = IMPL.filter(t => !SPECIAL_ONLY.includes(t) && (CURR.plays[t] || { frm: 9 }).frm <= stage && !used.includes(t) && fam(t) !== prevFam && fam(t) !== nextFam && fams.filter(f => f === fam(t)).length < 2
    && (slot === 'W' ? fam(t) === 'write' : slot === 'Z' ? fam(t) === 'story' : slot === 'S' ? fam(t) === 'warm' : !['warm', 'story'].includes(fam(t))));
  const score = t => 3 - (hist[0] && hist[0].includes(t) ? 10 : 0) - (hist[1] && hist[1].includes(t) ? 4 : 0) - (hist[2] && hist[2].includes(t) ? 1.5 : 0) - ((avoid || []).includes(t) ? 10 : 0) + hashN(dn + slot + t);
  return pool.sort((a, b) => score(b) - score(a))[0] || null;
}
const segOf = (t, slot) => ({ type: t, n: (CURR.plays[t] || {}).n || 4, kid: (CURR.plays[t] || {}).kid || t, slot });
/* 지난 3일 계획(실제로 한 것 우선) */
function histTypes(dn) { const out = []; for (let k = 1; k <= 3; k++) { const p = DAYS[dn - 1 - k]; out.push(p ? p.segs.map(s => s.type) : []); } return out; }
/* 한 번 더 놀이 날: 같은 단원 goal·new, 1~4일째 A·C 놀이는 벌점 10, theme도 다르게 */
function extraPlan(base) {
  const d = DAYS[base - 1], unitDays = DAYS.filter(x => x.unit === d.unit && x.k <= 4), avoid = unitDays.flatMap(x => x.segs.filter(s => s.slot === 'A' || s.slot === 'C').map(s => s.type));
  const hist = histTypes(base + 1), slots = d.stage >= 2 ? ['S', 'M', 'A', 'W', 'C', 'Z'] : ['S', 'A', 'W', 'C', 'Z'];
  const segs = [], used = [], fams = [];
  slots.forEach((sl, i) => {
    let t = sl === 'S' ? 'yesterday' : sl === 'M' ? 'letter' : pickType(sl, d.stage, used, fams, hist, fams[i - 1], null, base + 0.5, avoid);
    if (!t || used.includes(t)) t = pickType(sl, d.stage, used, fams, hist, fams[i - 1], null, base + 0.7, []);
    if (t) { segs.push(segOf(t, sl)); used.push(t); fams.push(fam(t)); }
  });
  const themes = [...new Set(DAYS.map(x => x.theme))].filter(x => x !== d.theme);
  return Object.assign({}, d, { segs, types: used, A: (segs.find(s => s.slot === 'A') || {}).type, special: null, extra: true, theme: themes[Math.floor(hashN(base) * themes.length)], fun: '좋아하는 친구들을 한 번 더 만나요' });
}
/* 계획 고치기(만일 규칙에 어긋나면 그 칸만 다시 고름) */
function repairPlan(plan, prev) {
  let errs = checkDay(plan, prev); if (!errs.length) return plan;
  const hist = histTypes(plan.day), segs = plan.segs.slice();
  for (let i = 0; i < segs.length; i++) {
    const used = segs.filter((_, q) => q !== i).map(s => s.type), fams = segs.filter((_, q) => q !== i).map(s => fam(s.type));
    const bad = used.includes(segs[i].type) || (i && fam(segs[i - 1].type) === fam(segs[i].type));
    if (!bad) continue;
    const t = pickType(segs[i].slot || 'A', plan.stage, used, fams, hist, i ? fam(segs[i - 1].type) : null, segs[i + 1] ? fam(segs[i + 1].type) : null, plan.day);
    if (t) segs[i] = segOf(t, segs[i].slot);
  }
  return Object.assign({}, plan, { segs, repaired: errs });
}
/* 타이머 맞추기(3.3): 12분 기준. 10분 → C 칸 빼기, 15분 → Z 앞에 '내가 고르기' */
function fitTimer(plan) {
  const segs = plan.segs.map(s => Object.assign({}, s)), m = S.settings.timerMin;
  if (m <= 10 && !plan.special && segs.length > 4) { const c = segs.findIndex(s => s.slot === 'C'); if (c >= 0) segs.splice(c, 1); }
  if (m >= 15 && S.played.length >= 3) segs.splice(segs.length - 1, 0, { type: 'pick3', n: 1, kid: '내가 고르기', slot: 'P' });
  if (S.boost && S.boost === plan.unit && plan.k <= 2 && !segs.some(s => s.type === 'yesterday')) segs[0] = segOf('yesterday', 'S');   // 보물 찾기 60% 미만 → 다음 단원 1·2일째 복습 칸
  return Object.assign({}, plan, { segs });
}
function planFor(dn, mode) {
  let p = mode === 'extra' ? extraPlan(dn) : Object.assign({}, DAYS[dn - 1]);
  const prev = dn > 1 ? DAYS[dn - 2] : null;
  p = repairPlan(p, mode === 'extra' ? DAYS[dn - 1] : prev);
  return fitTimer(p);
}

/* ---------- 문항 만들기(2.3) ---------- */
const syl = (c, v) => compose(c, v);
const okSyl = s => hasA(VOICE.syl(s)) && STROKES_OK(s);
function STROKES_OK(s) { const { cho, jung } = splitSyllable(s); return !!(STROKES[cho] && STROKES[jung]); }
function sylsOf(ctx, consList) {
  const cs = consList && consList.length ? consList : ['ㅇ'];
  const out = []; cs.forEach(c => ctx.vowels.forEach(v => { const s = syl(c, v); if (hasA(VOICE.syl(s))) out.push(s); })); return out;
}
const fill = (pool, n) => { const out = []; let guard = 0; while (out.length < n && pool.length && guard++ < 50) out.push(...shuffle(pool)); const q = out.slice(0, n); for (let k = 1; k < q.length; k++) if (q[k] === q[k - 1]) { const j = q.findIndex((x, i) => i > k && x !== q[k - 1]); if (j > 0) [q[k], q[j]] = [q[j], q[k]]; } return q; };
/* 복습 섞기: round(n*0.35)개는 복습 대기(첫날 없음) */
function withReview(ctx, fresh, n, okKey) {
  const r = ctx.dn > 1 ? Math.round(n * 0.35) : 0;
  const rv = dueKeys(k => okKey(k)).map(itemOfKey).filter(x => !fresh.slice(0, n - r).includes(x)).slice(0, r);
  const q = fill(fresh, n - rv.length).concat(rv);
  return q.length ? shuffle(q) : fill(fresh, n);
}
const wordHasPicOrEmo = w => hasPic(w) || PH_EMOJI[w];
function wordPool(ctx, pred) { const a = [...new Set(ctx.unitW.concat(ctx.newW))].filter(pred); return a.length >= 2 ? a : [...new Set(a.concat(ctx.knownW.filter(pred)))]; }
function confGlyph(x, pool, n) {   // 헷갈리는 것 먼저, 그다음 같은 종류
  const out = [];
  if (isJ(x)) { if (CONF[x]) out.push(CONF[x]); }
  else if (isSyl(x)) { const { cho, jung } = splitSyllable(x); [CONF[jung] && syl(cho, CONF[jung]), CONF[cho] && CHO.includes(CONF[cho]) && syl(CONF[cho], jung)].forEach(s => s && hasA(VOICE.syl(s)) && out.push(s)); }
  shuffle(pool).forEach(p => { if (p !== x && !out.includes(p) && isSyl(p) === isSyl(x)) out.push(p); });
  if (out.length < n) shuffle(isSyl(x) ? ['가', '나', '다', '마', '바', '사', '아', '자', '하', '고', '노', '모'] : [...VOW6, ...CONS]).forEach(p => { if (p !== x && !out.includes(p)) out.push(p); });
  return out.slice(0, n);
}
function glyphPool(ctx) {   // 오늘·이번 단원 글자(자모 + 음절)
  if (ctx.stage === 1) { const vs = ctx.unitJ.filter(j => VOW6.includes(j)); const v = vs.length ? vs : ctx.vowels; return [...new Set((ctx.unitJ.includes('ㅇ') ? ['ㅇ'] : []).concat(v, v.map(x => syl('ㅇ', x))))]; }
  const cs = ctx.unitC.length ? ctx.unitC : ctx.cons.slice(-2); return [...new Set(cs.concat(sylsOf(ctx, cs)))];
}
const QB = {
  name: (c, n) => ['ryeowon'].concat(shuffle(FAMILY.filter(x => x !== 'ryeowon'))).slice(0, n),
  listen: (c, n) => withReview(c, wordPool(c, w => hasA(VOICE.word(w))), n, k => k[0] === 'w' && hasA('w_' + k.slice(2))),
  blend: (c, n) => { const ok = w => [...WORDS[w]].every(s => hasA(VOICE.syl(s))) && WORDS[w].length >= 2; const p = wordPool(c, ok); return fill(p.length >= 3 ? p : p.concat(BLEND_WORDS.filter(ok)), n); },
  choose: (c, n) => withReview(c, wordPool(c, w => hasA(VOICE.word(w)) && hasA(VOICE.hy(w))), n, k => k[0] === 'w' && hasA('hy_' + k.slice(2))),
  seek: (c, n) => { const ok = w => HSPOT4[w] && HSPOT4[w].length >= [...WORDS[w]].length && hasA(VOICE.hw(w)) && [...WORDS[w]].every(g => hasA(VOICE.syl(g))); const p = wordPool(c, ok); return fill(p.length >= 2 ? p : p.concat(HID_WORDS.filter(ok)), n); },
  clap: (c, n) => { const p = CLAP_WORDS.filter(w => c.unitW.includes(w) || c.knownW.includes(w)); return fill(p.length >= 3 ? p : CLAP_WORDS, n); },
  same: (c, n) => {
    const all = Object.keys(WORDS).filter(w => WORDS[w].length >= 2 && hasA(VOICE.first(w)) && (hasPic(w) || PH_EMOJI[w]));
    const mate = f => { const a = all.filter(x => x !== f && WORDS[x][0] === WORDS[f][0]); if (a.length) return a[0]; const ch = splitSyllable(WORDS[f][0]).cho; const b = all.filter(x => x !== f && splitSyllable(WORDS[x][0]).cho === ch && ch !== 'ㅇ'); return b[0] || null; };
    const p = wordPool(c, w => all.includes(w) && mate(w)); const src = p.length >= 2 ? p : all.filter(mate);
    return fill(src, n).map(f => ({ f, ans: mate(f), key: 'w:' + f }));
  },
  letter: (c, n) => { const a = [...new Set(c.newJ.concat(c.unitJ))].filter(j => JAMO_EX[j]); const rv = c.knownJ.filter(j => JAMO_EX[j] && !a.includes(j)); return a.concat(shuffle(rv)).slice(0, Math.max(n, a.length ? 1 : 0)).slice(0, n); },
  pick: (c, n) => withReview(c, glyphPool(c).filter(x => isSyl(x) ? hasA(VOICE.syl(x)) : JAMO_EX[x]), n, k => (k[0] === 'j' && JAMO_EX[k.slice(2)]) || (k[0] === 's' && hasA(VOICE.syl(k.slice(2))))),
  trace: (c, n) => { const p = glyphPool(c).filter(x => isSyl(x) ? STROKES_OK(x) : STROKES[x]); return withReview(c, p.length ? p : ['ㅇ', '이', '아'], n, k => (k[0] === 'j' && STROKES[k.slice(2)]) || (k[0] === 's' && STROKES_OK(k.slice(2)))); },
  copy: (c, n) => QB.trace(c, n),
  merge: (c, n) => withReview(c, sylsOf(c, c.unitC.length ? c.unitC : c.cons.slice(-2)), n, k => k[0] === 's' && hasA('sy_' + hex(k.slice(2)))),
  train: (c, n) => { const a = (c.unitC.length ? c.unitC : ['ㅇ']).concat(shuffle(c.cons.filter(x => !c.unitC.includes(x)))); return a.slice(0, Math.max(1, Math.min(2, Math.round(n / 3)))).filter(x => TRAIN_V.every(v => hasA(VOICE.syl(syl(x, v))))); },
  balloon: (c, n) => withReview(c, glyphPool(c).filter(x => isSyl(x) ? hasA(VOICE.syl(x)) : hasA(VOICE.jamo(x))), n, k => k[0] === 's' && hasA('sy_' + hex(k.slice(2)))),
  chant: (c, n) => {
    if (c.stage === 1) { const vs = ['ㅏ', 'ㅣ', 'ㅗ', 'ㅜ', 'ㅓ', 'ㅡ']; return Array.from({ length: n }, (_, i) => [0, 1, 2, 3].map(k => syl('ㅇ', vs[(i + k) % 6]))); }
    const cs = [...new Set(c.unitC.concat(c.cons.slice().reverse()))].slice(0, n); while (cs.length < n) cs.push(cs[cs.length % Math.max(1, cs.length)] || 'ㄱ');
    return cs.map((x, i) => ['ㅏ', 'ㅗ', 'ㅜ', 'ㅣ'].map(v => syl(x, v)).filter(s => hasA(VOICE.syl(s))));
  },
  body: (c, n) => { const a = [...new Set(c.newJ.concat(c.unitJ))].filter(j => POSE_HOW[j]); return a.concat(shuffle(c.knownJ.filter(j => POSE_HOW[j] && !a.includes(j)))).concat(['ㅣ', 'ㅏ', 'ㅇ']).filter((x, i, A) => A.indexOf(x) === i).slice(0, n); },
  yesterday: (c, n) => {
    const ok = k => (k[0] === 'w' && hasA('w_' + k.slice(2)) && wordHasPicOrEmo(k.slice(2))) || (k[0] === 'j' && JAMO_EX[k.slice(2)] && hasA('j_' + hex(k.slice(2)))) || (k[0] === 's' && hasA('sy_' + hex(k.slice(2))));
    let ks = dueKeys(ok);
    if (ks.length < n) { const prev = DAYS[c.dn - 2]; const pc = prev ? ctxOf(prev.day) : c; const more = pc.newJ.map(j => 'j:' + j).concat(pc.newW.map(w => 'w:' + w), c.knownW.map(w => 'w:' + w), c.knownJ.map(j => 'j:' + j), FAMILY.map(w => 'w:' + w)).filter(ok); ks = [...new Set(ks.concat(shuffle(more)))]; }
    return ks.slice(0, n).map(itemOfKey);
  },
  sort: (c) => {
    let groups;
    if (c.stage >= 2) { const cs = c.unitC.length >= 2 ? c.unitC.slice(0, 2) : [c.unitC[0] || 'ㄱ', CONF[c.unitC[0]] && CONS.includes(CONF[c.unitC[0]]) && c.cons.includes(CONF[c.unitC[0]]) ? CONF[c.unitC[0]] : c.cons.filter(x => x !== c.unitC[0]).slice(-1)[0] || 'ㄴ'];
      groups = cs.map(x => ({ label: x, voice: VOICE.jamo(x), test: w => splitSyllable(WORDS[w][0]).cho === x })); }
    else { const firsts = {}; Object.keys(WORDS).forEach(w => { if (hasA(VOICE.word(w)) && wordHasPicOrEmo(w)) { const f = WORDS[w][0]; (firsts[f] = firsts[f] || []).push(w); } });
      const pref = [...new Set(c.unitW.concat(c.knownW).map(w => WORDS[w][0]))].filter(f => (firsts[f] || []).length >= 2 && hasA(VOICE.syl(f)));
      const fl = pref.length >= 2 ? pref.slice(0, 2) : pref.concat(Object.keys(firsts).filter(f => firsts[f].length >= 3 && hasA(VOICE.syl(f)) && !pref.includes(f))).slice(0, 2);
      groups = fl.map(f => ({ label: f, voice: VOICE.syl(f), test: w => WORDS[w][0] === f })); }
    const cand = Object.keys(WORDS).filter(w => hasA(VOICE.word(w)) && wordHasPicOrEmo(w));
    const pri = w => (c.unitW.includes(w) ? 2 : 0) + (c.knownW.includes(w) ? 1 : 0) + Math.random();
    const cards = []; groups.forEach((g, gi) => cand.filter(g.test).sort((a, b) => pri(b) - pri(a)).slice(0, 3).forEach(w => cards.push({ w, g: gi })));
    return [{ groups, cards: shuffle(cards), key: null }];
  },
  stickerstory: (c, n) => { const ks = c.k <= 4 ? Array.from({ length: c.k }, (_, i) => c.k - i) : [1, 2, 3, 4]; return ks.slice(0, Math.min(n, c.k <= 4 ? 2 : 4)).reverse().map(k => ({ u: c.u.n, k })); },
  story: (c, n) => { const kk = Math.min(c.k, 4), ks = Array.from({ length: kk }, (_, i) => i + 1); return ks.slice(-Math.min(n, c.k >= 5 ? 4 : 2)).map(k => ({ u: c.u.n, k })); },
  block: (c, n) => { const s = sylsOf(c, c.unitC.length ? c.unitC : c.cons.slice(-2)); const w = wordPool(c, x => [...WORDS[x]].every(y => hasA(VOICE.syl(y))) && WORDS[x].length >= 2 && WORDS[x].length <= 3 && wordHasPicOrEmo(x));
    const out = []; for (let i = 0; i < n; i++) out.push(i % 2 === 0 || !w.length ? { t: 'syl', v: s[rand(s.length)], key: null } : { t: 'word', v: w[rand(w.length)], key: null }); out.forEach(o => { o.key = o.t === 'syl' ? 's:' + o.v : 'w:' + o.v; }); return out; },
  map: (c, n) => [{ qs: mixedQs(c, n, ['hear', 'hear', 'read']), key: null }],
  cloud: (c, n) => [{ qs: mixedQs(c, n, ['hear', 'read', 'build']), key: null }],
  treasure: (c, n) => [{ qs: mixedQs(c, n, ['hear', 'hear', 'hear', 'hear', 'read', 'read', 'read', 'build', 'build', 'build'], -1), key: null, check: true }],
  pick3: () => [{ key: null }]
};
/* 섞어 묻기(보물 지도·심술 구름·보물 상자): 지난 5일 + 옛 단원 */
function mixedQs(c, n, kinds, optDelta = 0) {
  const recent = DAYS.slice(Math.max(0, c.dn - 6), c.dn).map(x => ctxOf(x.day));
  const gl = [...new Set(recent.flatMap(x => glyphPool(x)).concat(glyphPool(c)))].filter(x => isSyl(x) ? hasA(VOICE.syl(x)) : hasA(VOICE.jamo(x)));
  const ws = [...new Set(recent.flatMap(x => x.unitW).concat(c.knownW))].filter(w => hasA(VOICE.word(w)) && wordHasPicOrEmo(w));
  const bs = c.stage >= 2 ? [...new Set(recent.flatMap(x => sylsOf(x, x.unitC)))] : [];
  const rv = dueKeys().map(itemOfKey);
  const out = [];
  for (let i = 0; i < n; i++) {
    let kind = kinds[i % kinds.length]; if (kind === 'build' && !bs.length) kind = 'hear'; if (kind === 'read' && ws.length < 2) kind = 'hear';
    const fromRv = rv.find(x => (kind === 'read' ? WORDS[x] && ws.includes(x) : kind === 'build' ? bs.includes(x) : gl.includes(x)) && !out.some(o => o.target === x));
    const pool = kind === 'read' ? ws : kind === 'build' ? bs : gl;
    const t = fromRv && i % 3 === 1 ? fromRv : shuffle(pool).find(x => !out.some(o => o.target === x)) || pool[rand(pool.length)];
    const no = Math.max(2, c.nopt + optDelta);
    const opts = kind === 'read' ? shuffle([t, ...others(ws, t, no - 1)]) : shuffle([t, ...confGlyph(t, kind === 'build' ? bs : gl, no - 1)]);
    out.push({ kind, target: t, opts, key: itemKeyOf(t) });
  }
  return out;
}
/* 칸 → 놀이 엔진 이름·옵션 */
/* 숨은 글자 단계: 아이 기록(S.hid.lv, 맞으면 올라가고 틀리면 내려감) + 커리큘럼 상한(1단계 주제는 2까지) + 힘든 단원(boost)·한 번 더 날은 한 단계 쉽게 */
function hidLevel(ctx) {
  const cap = ctx.stage <= 1 ? 2 : 3; let lv = Math.min(S.hid.lv || 1, cap);
  if ((S.boost && S.boost === ctx.unit) || (DR && DR.mode === 'extra')) lv--;
  if (S.hard && lv < cap && S.hid.good >= 1) lv++;
  return Math.max(1, lv);
}
function hidAdapt(h, lv) {   // 숨은 글자 한 판이 끝날 때: 다 깨끗이(가짜 안 누르고 스스로) 찾은 판이 80% 이상이면 good+1 → 2번이면 한 단계 위 / 가짜를 낱말당 2번 넘게 눌렀거나 반 넘게 못 찾으면 한 단계 아래
  if (!h || !h.rounds) return; const H = S.hid;
  const acc = h.clean / h.rounds, bad = h.decoy / h.rounds >= 2 || h.rev * 2 > h.rounds;
  H.log = (H.log || []).concat({ d: today(), lv, n: h.rounds, clean: h.clean, decoy: h.decoy, rev: h.rev }).slice(-20);
  if (bad) { H.lv = Math.max(1, lv - 1); H.good = 0; H.down = (H.down || 0) + 1; }
  else if (acc >= 0.8) { H.good = (H.good || 0) + 1; if (H.good >= 2) { H.lv = Math.min(3, lv + 1); H.good = 0; } }
  else H.good = 0;
}
/* 대표님 예시 판: 숨은 글자 = 소방차(빨간 옆면에 소·방·차), 그림 보고 고르기 = 바다 친구(고래·상어·오징어·거북·해마). 놀이터에서는 첫 판, 하루 놀이에서는 가끔 덤 판 */
const SHOW_SEEK = 'sobangcha', SEA_SET = ['gorae', 'sangeo', 'ojingeo', 'geobuk', 'haema'];
const seekOk = w => !!(HSPOT4[w] && WORDS[w] && HSPOT4[w].length >= [...WORDS[w]].length && hasA(VOICE.hw(w)) && [...WORDS[w]].every(g => hasA(VOICE.syl(g))) && ARTS.pic.includes(w));
const seaOk = () => SEA_SET.filter(w => ARTS.pic.includes(w) && hasA(VOICE.word(w)));
function addShowcase(t, items, ctx, free) {
  /* 11/06: 1~20일에도 예시 판을 덤으로(대표님 '예시 다양화' 체감). 숨은 글자 날(9·10·18일 등)은 소방차, 그림 고르기 날(4일부터)은 바다 친구 1장. 첫날은 쉬게 둠 */
  /* §19 UX2 11/06: 21일 이후에도 같은 규칙(숨은 글자 날마다 소방차, 그림 고르기 날마다 바다 친구 1장). 예전엔 21~30일 그림 고르기 덤 0번 */
  if (!free) {
    if (t === 'seek' && seekOk(SHOW_SEEK) && !items.includes(SHOW_SEEK)) return items.concat(SHOW_SEEK);
    if (t === 'choose' && ctx.dn >= 4 && seaOk().length >= 3) { const w = seaOk()[ctx.dn % seaOk().length]; return items.includes(w) ? items : items.concat(w); }
  }
  if (t === 'seek' && seekOk(SHOW_SEEK) && !items.includes(SHOW_SEEK) && (free || (ctx.dn >= 21 && ctx.dn % 3 === 0))) return free ? [SHOW_SEEK].concat(items) : items.concat(SHOW_SEEK);
  if (t === 'choose' && seaOk().length >= 3 && (free || (ctx.dn >= 31 && ctx.dn % 4 === 0))) { const w = seaOk()[(ctx.dn + (free ? Date.now() : 0)) % seaOk().length]; return items.includes(w) ? items : free ? [w].concat(items) : items.concat(w); }
  return items;
}
function segRunP(seg, ctx, items) {
  const t = seg.type, kind = { choose: 'picword', seek: 'hidden' }[t] || t;
  const p = { kind, type: t, items, seg };
  if (t === 'choose') { const st = ctx.stage, ch = S.settings.colorHint; p.cards = Math.min(5, (st === 1 ? 2 : 3) + (S.hard ? 1 : 0)); p.hint = ch === 'on' ? 2 : st <= 2 ? (S.hard ? 1 : 2) : st === 3 ? 1 : st === 4 ? 1 : 0; }
  if (t === 'seek') p.lv = hidLevel(ctx);
  if (t === 'pick') p.items = [...new Set(items.concat(glyphPool(ctx)))];
  if (t === 'blend') p.items = [...new Set(items.concat(BLEND_WORDS.filter(w => [...WORDS[w]].every(s => hasA(VOICE.syl(s))))))];
  if (t === 'listen') p.items = [...new Set(items.concat(ctx.knownW.filter(w => hasA(VOICE.word(w)))))];
  return p;
}
