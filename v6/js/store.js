'use strict';
/* v6 store: one localStorage record. Learning progress and rewards are separate so rewards can be reset alone. */
(function (G) {
  const KEY = 'hangul-v6';
  const D = G.D, C = G.Coach, F = D.FLAGS;
  function fresh() {
    return {
      v: 1,
      learn: { stage: 1, done: {}, score: {}, items: {}, today: { date: '', count: 0 }, checks: [], reviews: 0, cv: D.CURRICULUM_VERSION, log: {}, novel: {}, says: 0, srs: {} },
      reward: freshReward(),
      settings: { perDay: F.dailyStop ? 1 : 2, capMin: 15, voice: 1, sfx: 0.6, bgm: true, strokes: 'soft', mic: true }
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
  const wasSaved = !!(S.learn && S.learn.stage);
  const oldCv = S.learn && S.learn.stage ? (S.learn.cv || 1) : D.CURRICULUM_VERSION;
  const base = fresh();
  ['learn', 'reward', 'settings'].forEach(k => { S[k] = Object.assign({}, base[k], S[k] || {}); });

  /* friends were redrawn in v6.2: carry an old pick over to its new look-alike */
  { const old = { rabbit: 'tori', bear: 'bori', cat: 'pomi', chick: 'piyak', puppy: 'dori', fox: 'sori', panda: 'pang', pig: 'lumi', koala: 'lumi', tiger: 'lumi', monkey: 'lumi' };
    if (old[S.reward.friend]) S.reward.friend = old[S.reward.friend]; }
  /* Curriculum v2 inserted two worlds: move old stage numbers onto the same lessons in the new list.
     If new lessons now sit before the child's place, she does them first; finishing them jumps back. */
  /* Curriculum v1 → v2 inserted two worlds: move old stage numbers onto the same lessons in the new list. If new lessons now sit
     before the child's place, she does them first; finishing them jumps back. Nihon #4: v2 ⇄ v3 (reordered) moves every record
     (done, score, tries, helped, stage) by lesson uid, so she lands on the same lesson she was on; nothing is dropped. */
  if (oldCv !== D.CURRICULUM_VERSION) {
    const L = S.learn;
    const maps = [];
    if (oldCv === 1) maps.push(D.MIGRATE_V1);
    if ((oldCv === 1 ? 2 : oldCv) !== D.CURRICULUM_VERSION) maps.push(D.stageMap(oldCv === 1 ? 2 : oldCv, D.CURRICULUM_VERSION));
    const map = id => maps.reduce((x, m) => m[x] || x, id);
    const moveKeys = o => { const n = {}; Object.keys(o || {}).forEach(k => { n[map(+k)] = o[k]; }); return n; };
    L.done = moveKeys(L.done); L.score = moveKeys(L.score);
    if (L.tries) L.tries = moveKeys(L.tries);
    if (L.helped) L.helped = moveKeys(L.helped);
    let st = map(L.stage);
    if (oldCv === 1) {
      const firstGap = D.STAGES.find(s => s.id < st && !L.done[s.id] && Object.keys(L.done).length && Math.max.apply(null, Object.keys(L.done).map(Number)) > s.id);
      if (firstGap) st = firstGap.id;
    }
    L.stage = st;
    /* she was already in (or past) 받침 동굴: the new checkpoint-B gate never closes a door she has walked through */
    if (D.CURRICULUM_VERSION >= 3 && D.STAGES.some(s => s.w === 6 && (L.done[s.id] || s.id === st))) L.batOpen = 1;
    L.cv = D.CURRICULUM_VERSION;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  const St = { s: S };
  /* fake clock seam for QA: St.now = () => new Date(...) */
  St.now = () => new Date();
  /* Nihon #3: R3 saves have item records but no dates → give every item a review box (Coach.migrate); `items` is kept as is. */
  if (!S.learn.srsV) {
    const d0 = new Date(), t0 = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
    S.learn.srs = Object.assign(C.migrate(S.learn.items, S.learn.stage, t0), S.learn.srs || {});
    S.learn.srsV = 1;
  }
  /* Nihon #2: one adventure a day is the new default; an R3 save still on the old default (2) moves to 1 once. Parents can set 1–3. */
  if (!S.settings.n1115) {
    if (F.dailyStop && wasSaved && S.settings.perDay === 2) S.settings.perDay = 1;
    S.settings.n1115 = 1;
  }
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  St.save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or private mode */ } };
  St.day = function (d) {
    d = d || St.now();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  St.yesterday = function () { const d = St.now(); d.setDate(d.getDate() - 1); return St.day(d); };

  /* ---- learning ---- */
  St.stage = () => D.STAGES[Math.min(S.learn.stage, D.STAGES.length) - 1];
  St.finishStage = function (id, right, wrong) {
    const L = S.learn;
    const first = !L.done[id];
    L.done[id] = (L.done[id] || 0) + 1;
    L.score[id] = { right, wrong, date: St.day() };
    if (id === L.stage) {
      const nx = D.STAGES.find(s => s.id > id && !L.done[s.id]) || (F.placement ? D.STAGES.find(s => !L.done[s.id]) : null);
      L.stage = nx ? nx.id : Math.min(D.STAGES.length, id + 1);
    }
    St.countToday();
    St.logDay(right, wrong, 1);
    St.save();
    return first;
  };
  /* one adventure done today (new stage, or — with the daily stop — the review / 통글자 / placement session started from 놀자) */
  St.countToday = function () {
    const L = S.learn, t = St.day();
    if (L.today.date !== t) L.today = { date: t, count: 0 };
    L.today.count++;
    St.save();
  };
  St.addSecs = function (n) { const t = St.day(), L = S.learn; L.log = L.log || {}; const d = L.log[t] || [0, 0, 0, 0]; d[3] += n; L.log[t] = d; St.save(); };
  St.secsToday = () => ((S.learn.log || {})[St.day()] || [0, 0, 0, 0])[3];
  /* Per-day activity for the parent's weekly view: [right, wrong, stages, seconds]. Keeps 60 days. */
  St.logDay = function (right, wrong, stages, secs) {
    const L = S.learn, t = St.day();
    L.log = L.log || {};
    const d = L.log[t] || [0, 0, 0, 0];
    /* Nihon #2: with the daily stop the seconds column is whole-app time, added only by App's clock (St.addSecs) */
    d[0] += right || 0; d[1] += wrong || 0; d[2] += stages || 0; d[3] += F.dailyStop ? 0 : Math.round(secs || 0);
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
    /* Nihon #3: date box (1·3·7·14 days) */
    C.mark(S.learn.srs = S.learn.srs || {}, item, ok, St.day());
  };
  St.weak = function (filter, n) {
    return Object.entries(S.learn.items).filter(([k]) => !filter || filter(k))
      .map(([k, v]) => [k, C.weight(v, (S.learn.srs || {})[k], St.day())])
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
    S.reward.stickerDay = St.day();
    St.save();
    return s;
  };
  /* Nihon #1: three sticker choices, no dice — the lowest-numbered missing sticker of three different themes, starting at the
     theme after the last one she picked. Same save → same three. The chosen one is added like any other. */
  St.stickerChoices = function () {
    const owned = S.reward.stickers, n = D.STICKER_SETS.length, start = ((S.reward.lastSet == null ? -1 : S.reward.lastSet) + 1) % n;
    const out = [];
    for (let i = 0; i < n && out.length < 3; i++) {
      const set = (start + i) % n, s = D.STICKERS.find(x => x.set === set && !owned[x.id]);
      if (s) out.push(s);
    }
    for (let i = 0; out.length < 3 && i < D.STICKERS.length; i++) { const s = D.STICKERS[(start * 20 + i) % D.STICKERS.length]; if (!out.includes(s)) out.push(s); }
    return out;
  };
  St.takeSticker = function (s) {
    S.reward.stickers[s.id] = (S.reward.stickers[s.id] || 0) + 1;
    S.reward.newStickers.push(s.id);
    S.reward.lastSet = s.set;
    S.reward.stickerDay = St.day();
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
    const pool = D.OUTFITS.filter(o => !R.outfits.includes(o.id) && !o.lv && o.theme === undefined && !o.aqua);
    if (!pool.length) return null;
    const o = F.calmRewards ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
    R.outfits.push(o.id); St.save();
    return o;
  };
  /* R3: special outfits (whole sticker theme, aquarium whale) — given once, returns the outfit or null */
  St.giveSpecial = function (id) {
    const R = S.reward, o = D.OUTFITS.find(x => x.id === id);
    if (!o || R.outfits.includes(id)) return null;
    R.outfits.push(id); St.save();
    return o;
  };
  /* sticker themes whose 20 stickers are all owned */
  St.themeDone = i => D.STICKERS.filter(x => x.set === i).every(x => S.reward.stickers[x.id]);
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
  /* worlds already finished (e.g. before v6.3): their friend has joined, without a popup */
  D.WORLD_ORDER.forEach(w => {
    const all = D.STAGES.filter(x => x.w === w);
    if (all.length && all.every(x => S.learn.done[x.id])) {
      const m = S.reward.met = S.reward.met || [];
      if (!m.includes('w' + w)) { m.push('w' + w); if (D.WORLDS[w].guide && !m.includes(D.WORLDS[w].guide)) m.push(D.WORLDS[w].guide); }
      const t = S.reward.told = S.reward.told || [];
      if (!t.includes(w)) t.push(w);
    }
  });
  St.setStage = function (id) { S.learn.stage = Math.max(1, Math.min(D.STAGES.length, id)); St.save(); };

  G.St = St;
})(window);
