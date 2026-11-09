'use strict';
/* v6 store: one localStorage record. Learning progress and rewards are separate so rewards can be reset alone. */
(function (G) {
  const KEY = 'hangul-v6';
  const D = G.D;
  function fresh() {
    return {
      v: 1,
      learn: { stage: 1, done: {}, score: {}, items: {}, today: { date: '', count: 0 }, checks: [], reviews: 0 },
      reward: freshReward(),
      settings: { perDay: 2, voice: 1, sfx: 0.6, bgm: true }
    };
  }
  function freshReward() {
    return {
      stars: 0, xp: 0, level: 1, friend: 'mong', stickers: {}, newStickers: [], outfits: [], wear: {},
      daily: { last: '', idx: 0 }, streak: { last: '', count: 0, best: 0, marks: [] }
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = fresh();
  const base = fresh();
  ['learn', 'reward', 'settings'].forEach(k => { S[k] = Object.assign({}, base[k], S[k] || {}); });

  const St = { s: S };
  St.save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or private mode */ } };
  St.day = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  St.yesterday = function () { const d = new Date(); d.setDate(d.getDate() - 1); return St.day(d); };

  /* ---- learning ---- */
  St.stage = () => D.STAGES[Math.min(S.learn.stage, D.STAGES.length) - 1];
  St.finishStage = function (id, right, wrong) {
    const L = S.learn;
    const first = !L.done[id];
    L.done[id] = (L.done[id] || 0) + 1;
    L.score[id] = { right, wrong, date: St.day() };
    if (id === L.stage && L.stage < D.STAGES.length) L.stage++;
    const t = St.day();
    if (L.today.date !== t) L.today = { date: t, count: 0 };
    L.today.count++;
    St.save();
    return first;
  };
  St.todayCount = () => (S.learn.today.date === St.day() ? S.learn.today.count : 0);
  /* Item memory for review: key -> [right, wrong, lastSeenStage]. */
  St.mark = function (item, ok) {
    if (!item) return;
    const it = S.learn.items[item] || [0, 0, 0];
    if (ok) it[0]++; else it[1]++;
    it[2] = S.learn.stage;
    S.learn.items[item] = it;
  };
  St.weak = function (filter, n) {
    return Object.entries(S.learn.items).filter(([k]) => !filter || filter(k))
      .map(([k, v]) => [k, v[1] * 2 - v[0] + (S.learn.stage - v[2]) * 0.2])
      .sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
  };

  /* ---- rewards ---- */
  const LV = n => 12 + (n - 1) * 8; /* xp needed for level n -> n+1 */
  St.levelNeed = () => LV(S.reward.level);
  St.addStar = function (n) {
    const R = S.reward;
    R.stars += n; R.xp += n;
    let up = false;
    while (R.xp >= LV(R.level)) { R.xp -= LV(R.level); R.level++; up = true; }
    return up;
  };
  St.pickSticker = function (minRare) {
    const owned = S.reward.stickers;
    const roll = Math.random();
    let r = roll < 0.05 ? 2 : roll < 0.30 ? 1 : 0;
    if (minRare !== undefined) r = Math.max(r, minRare);
    let pool = D.STICKERS.filter(s => s.r === r && !owned[s.id]);
    if (!pool.length) pool = D.STICKERS.filter(s => !owned[s.id]);
    if (!pool.length) pool = D.STICKERS.filter(s => s.r === r);
    const s = pool[Math.floor(Math.random() * pool.length)];
    owned[s.id] = (owned[s.id] || 0) + 1;
    S.reward.newStickers.push(s.id);
    St.save();
    return s;
  };
  St.stickerCount = () => Object.keys(S.reward.stickers).length;
  St.buy = function (o) {
    const R = S.reward;
    if (R.outfits.includes(o.id) || R.stars < o.cost || (o.lv && R.level < o.lv)) return false;
    R.stars -= o.cost; R.outfits.push(o.id); R.wear[o.slot] = o.id; St.save();
    return true;
  };
  St.giveOutfit = function () {
    const R = S.reward;
    const pool = D.OUTFITS.filter(o => !R.outfits.includes(o.id) && !o.lv);
    if (!pool.length) return null;
    const o = pool[Math.floor(Math.random() * pool.length)];
    R.outfits.push(o.id); St.save();
    return o;
  };
  St.wear = function (o) {
    const R = S.reward;
    if (!R.outfits.includes(o.id)) return;
    if (R.wear[o.slot] === o.id) delete R.wear[o.slot]; else R.wear[o.slot] = o.id;
    St.save();
  };
  /* Daily gift + streak. Returns null if already claimed today. */
  St.checkDaily = function () {
    const R = S.reward, t = St.day();
    if (R.daily.last === t) return null;
    const st = R.streak;
    if (st.last !== t) {
      st.count = st.last === St.yesterday() ? st.count + 1 : 1;
      st.last = t; st.best = Math.max(st.best, st.count);
    }
    R.daily.idx = (R.daily.idx % 7) + 1;
    R.daily.last = t;
    St.save();
    const milestone = [3, 7, 14, 30, 50, 100].includes(st.count) && !st.marks.includes(st.count);
    if (milestone) { st.marks.push(st.count); St.save(); }
    return { day: R.daily.idx, streak: st.count, milestone };
  };
  /* Parent: clear stickers and outfits only. Learning progress, stars and streak stay. */
  St.resetRewards = function () {
    const R = S.reward;
    R.stickers = {}; R.newStickers = []; R.outfits = []; R.wear = {}; R.friend = 'mong';
    St.save();
  };
  St.resetAll = function () { S = fresh(); St.s = S; St.save(); };
  St.setStage = function (id) { S.learn.stage = Math.max(1, Math.min(D.STAGES.length, id)); St.save(); };

  G.St = St;
})(window);
