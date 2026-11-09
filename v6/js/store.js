'use strict';
/* v6 store: one localStorage record. Learning progress and rewards are separate so rewards can be reset alone. */
(function (G) {
  const KEY = 'hangul-v6';
  const D = G.D;
  function fresh() {
    return {
      v: 1,
      learn: { stage: 1, done: {}, score: {}, items: {}, today: { date: '', count: 0 }, checks: [], reviews: 0, cv: D.CURRICULUM_VERSION, log: {}, novel: {}, says: 0 },
      reward: freshReward(),
      settings: { perDay: 2, voice: 1, sfx: 0.6, bgm: true, strokes: 'soft', mic: true }
    };
  }
  function freshReward() {
    return {
      stars: 0, xp: 0, level: 1, friend: 'lumi', stickers: {}, newStickers: [], outfits: [], wear: {},
      daily: { last: '', idx: 0 }, streak: { last: '', count: 0, best: 0, marks: [] },
      scenes: {}, met: [], told: []
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = fresh();
  const oldCv = S.learn && S.learn.stage ? (S.learn.cv || 1) : D.CURRICULUM_VERSION;
  const base = fresh();
  ['learn', 'reward', 'settings'].forEach(k => { S[k] = Object.assign({}, base[k], S[k] || {}); });

  /* friends were redrawn in v6.2: carry an old pick over to its new look-alike */
  { const old = { rabbit: 'tori', bear: 'bori', cat: 'pomi', chick: 'piyak', puppy: 'dori', fox: 'sori', panda: 'pang', pig: 'lumi', koala: 'lumi', tiger: 'lumi', monkey: 'lumi' };
    if (old[S.reward.friend]) S.reward.friend = old[S.reward.friend]; }
  /* Curriculum v2 inserted two worlds: move old stage numbers onto the same lessons in the new list.
     If new lessons now sit before the child's place, she does them first; finishing them jumps back. */
  if (oldCv < D.CURRICULUM_VERSION) {
    const L = S.learn, map = id => D.MIGRATE_V1[id] || id, moveKeys = o => { const n = {}; Object.keys(o || {}).forEach(k => { n[map(+k)] = o[k]; }); return n; };
    L.done = moveKeys(L.done); L.score = moveKeys(L.score);
    let st = map(L.stage);
    const firstGap = D.STAGES.find(s => s.id < st && !L.done[s.id] && Object.keys(L.done).length && Math.max.apply(null, Object.keys(L.done).map(Number)) > s.id);
    if (firstGap) st = firstGap.id;
    L.stage = st;
    L.cv = D.CURRICULUM_VERSION;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
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
    if (id === L.stage) {
      const nx = D.STAGES.find(s => s.id > id && !L.done[s.id]);
      L.stage = nx ? nx.id : Math.min(D.STAGES.length, id + 1);
    }
    const t = St.day();
    if (L.today.date !== t) L.today = { date: t, count: 0 };
    L.today.count++;
    St.logDay(right, wrong, 1);
    St.save();
    return first;
  };
  /* Per-day activity for the parent's weekly view: [right, wrong, stages, seconds]. Keeps 60 days. */
  St.logDay = function (right, wrong, stages, secs) {
    const L = S.learn, t = St.day();
    L.log = L.log || {};
    const d = L.log[t] || [0, 0, 0, 0];
    d[0] += right || 0; d[1] += wrong || 0; d[2] += stages || 0; d[3] += Math.round(secs || 0);
    L.log[t] = d;
    const keys = Object.keys(L.log).sort();
    while (keys.length > 60) delete L.log[keys.shift()];
    St.save();
  };
  /* "Read it yourself" results for letters the child had never been shown: item -> [said-same, tries]. */
  St.novel = function (item, ok) {
    const N = S.learn.novel = S.learn.novel || {};
    const v = N[item] || [0, 0];
    v[1]++; if (ok) v[0]++;
    N[item] = v; St.save();
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
    R.stickers = {}; R.newStickers = []; R.outfits = []; R.wear = {}; R.friend = 'lumi'; R.scenes = {};
    St.save();
  };
  St.resetAll = function () { S = fresh(); St.s = S; St.save(); };
  /* Friends: unlocked by level, or met at the end of their world. */
  St.hasFriend = f => f.lv <= S.reward.level || (S.reward.met || []).includes(f.id);
  St.meet = function (id) { const m = S.reward.met = S.reward.met || []; if (!m.includes(id)) { m.push(id); St.save(); return true; } return false; };
  St.setStage = function (id) { S.learn.stage = Math.max(1, Math.min(D.STAGES.length, id)); St.save(); };

  G.St = St;
})(window);
