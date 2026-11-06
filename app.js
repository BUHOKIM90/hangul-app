'use strict';
/* 한글 놀이 v4 — 몽글이 마을 길(슈퍼 마리오처럼 단계·단원·날 돌 170개), 달력으로 하루 하나 열기, 하루 4~6칸 놀이, 다시 하기·놀이터, 보상, 어른 메뉴.
   대표님 원칙: 즐겁게 놀다 보면 자기도 모르게 읽고 쓰게. 아이 화면에는 점수·레벨·연속 기록·숫자 진도·자물쇠 없음. 네트워크 없음. */

/* ---------- 타이머(오늘 쓴 시간, 기기 날짜 기준) ---------- */
let ticking = false;
const limitMs = () => (params.get('t') ? +params.get('t') : S.settings.timerMin * 60) * 1000;   // ?t=초 는 시험용
const usedMs = () => S.todayMs[today()] || 0;
const timeUp = () => usedMs() >= limitMs();
const timed = () => DR && DR.mode !== 'replay' && !DR.more;   // 11/04 '더 놀까?'로 연 날·다시 하기는 타이머로 줄이지 않음
setInterval(() => { if (ticking && document.visibilityState === 'visible') { const t = today(); S.todayMs[t] = (S.todayMs[t] || 0) + 1000; if (S.todayMs[t] % 5000 === 0) save(); drawTime(); } }, 1000);
function drawTime() { const p = Math.min(1, usedMs() / limitMs()) * 100; $('#top .fill').style.width = p + '%'; $('#top .knob').style.left = Math.min(p, 96) + '%'; }
$('#homeBtn').addEventListener('click', () => { run = null; DR = null; showHome(); });
function pruneMs() { const keep = Object.keys(S.todayMs).sort().slice(-40); S.todayMs = Object.fromEntries(keep.map(k => [k, S.todayMs[k]])); }

/* 11/04 대표님: '더 놀까?' = 오늘 날을 끝낸 뒤 다음 새 날을 바로 엶. 하루(달력)에 새 날은 최대 MORE_MAX개(S.moreDays, 날마다 0으로).
   다 쓰면 '더 놀까?'는 지난 날 다시 하기(스티커는 그대로 받음) + "내일 또 새 놀이가 기다려!". 다음 날 아침엔 가장 멀리 간 날 다음 칸이 보통처럼 열림. */
/* MORE_MAX=5 (11/04 대표님). FUN_CUSTOM 초안의 1과 다름. 바꾸지 않음. */
const MORE_MAX = 5;
const PLAY_PI = { balloon: 'pi_balloon', body: 'pi_body', chant: 'pi_chant', yesterday: 'pi_chant', listen: 'pi_read', choose: 'pi_read', name: 'pi_read', blend: 'pi_read', same: 'pi_read', pick: 'pi_read', seek: 'pi_read', readword: 'pi_read', sort: 'pi_sort', story: 'pi_story', stickerstory: 'pi_story', map: 'pi_story', cloud: 'pi_story', treasure: 'pi_story', trace: 'pi_trace', copy: 'pi_trace', letter: 'pi_trace', clap: 'pi_chant', block: 'pi_sort', merge: 'pi_sort', train: 'pi_sort' };
const stepIcon = t => '<img class="stepic" alt="" src="assets/pic/playicon/' + (PLAY_PI[t] || 'pi_story') + '.webp">';
const MAP_LM = ['lm_garden', 'lm_pond', 'lm_park', 'lm_train', 'lm_hat', 'lm_bus', 'lm_zoo', 'lm_radio', 'lm_pizza'];
const moreUsed = () => (S.moreDays && S.moreDays.date === today() ? S.moreDays.n : 0);
const canPlayMore = () => S.cur <= READY_DAYS && S.cur <= 170 && todayState() === 'done' && moreUsed() < MORE_MAX;
const canReplayMore = () => todayState() === 'done' && Object.keys(S.done).some(d => +d <= READY_DAYS);
const playMore = () => {
  ding(1.2);
  if (canPlayMore()) return startDay(S.cur, S.pendingExtra ? 'extra' : 'today', true);
  const past = Object.keys(S.done).map(Number).filter(d => d <= READY_DAYS && d < S.cur); if (!past.length) return showHome();
  const recent = past.sort((a, b) => b - a).slice(0, 10), dn = recent[Math.floor(Math.random() * recent.length)];
  startDay(dn, 'replay'); setBubble('내일 또 새 놀이가 기다려!<small>오늘은 좋아하는 놀이를 한 번 더!</small>'); say(['ui4_newtmr', 'ui4_again']);
};
/* ---------- 지도(홈): 6세계 · 34단원 · 170돌 ---------- */
const ROW_H = 118, BAN_H = 96;
function nodeLayout() {
  const out = []; let y = 24;
  UNITS.forEach((u, r) => {
    if (r === 0 || UNITS[r - 1].stage !== u.stage) y += BAN_H;
    const xs = [12, 31, 50, 69, 88], ord = r % 2 ? xs.slice().reverse() : xs;
    for (let k = 0; k < 5; k++) out.push({ dn: r * 5 + k + 1, x: ord[k], y: y + (k % 2 ? 14 : 0), unit: u.n, stage: u.stage });
    y += ROW_H;
  });
  return { nodes: out, h: y + 60 };
}
const seasonNow = () => { const md = today().slice(5); return (CURR.season || []).find(x => (x[3] <= x[4] ? md >= x[3] && md <= x[4] : md >= x[3] || md <= x[4])); };
function nodeState(dn) {
  if (S.done[dn]) return 'past';
  const st = todayState();
  if (dn === S.cur && (st === 'new' || st === 'going')) return 'today';
  if (dn === S.cur && st === 'done') return 'tomorrow';
  if (dn > READY_DAYS) return 'soon';
  return dn < S.cur ? 'past' : 'future';
}
const SP_ICON = { adventure: '🚩', treasure: '🎁', big: '🎈' };
function showHome() {
  run = null; DR = null; pruneMs();
  const [id, s] = screen('home'); const st = todayState();
  const focusDn = (st === 'soon' || st === 'all') ? 0 : Math.min(S.cur, READY_DAYS);
  const wrap = el('div', 'mapwrap'), M = el('div', 'map'), L = nodeLayout(); M.style.height = L.h + 'px';
  const sea = seasonNow(); if (sea) M.classList.add('season');
  // 세계 띠(배경은 CSS .w1~.w6, 나중에 그림으로 바꾸기 쉬움)
  WORLDS.forEach(w => {
    const ns = L.nodes.filter(n => n.stage === w.n), y0 = ns[0].y - BAN_H + 10, y1 = ns[ns.length - 1].y + ROW_H - 10;
    const band = el('div', 'world w' + w.n + (ns[0].dn > READY_DAYS ? ' later' : ''));
    band.style.top = (y0 - 14) + 'px'; band.style.height = (y1 - y0 + 24) + 'px';
    band.innerHTML = '<div class="wban"><span class="wn">' + w.name + '</span>' + (ns[0].dn > READY_DAYS ? '<span class="soonTag">곧 열려요</span>' : '') +
      (w.n === 1 && (S.town.buildings || S.town.props) ? '<span class="town">' + TOWN_BUILDINGS.slice(0, S.town.buildings).map((e, k) => artImg('town_b' + (k + 1), e, 'tw')).join('') + TOWN_PROPS.slice(0, S.town.props).map((e, k) => artImg('town_p' + (k + 1), e, 'tw')).join('') + '</span>' : '') + '</div>';
    M.append(band);
  });
  // 길(SVG)
  const pts = L.nodes.map(n => n.x + ',' + (n.y + 30)).join(' ');
  const svg = '<svg class="path" viewBox="0 0 100 ' + L.h + '" preserveAspectRatio="none"><polyline class="pathbed" vector-effect="non-scaling-stroke" points="' + pts + '"/><polyline class="pathdash" vector-effect="non-scaling-stroke" points="' + pts + '"/></svg>';
  M.insertAdjacentHTML('beforeend', svg);
  // 단원 이정표(장면 그림이 있으면 그걸, 없으면 assets/map/lm_slot.svg)
  UNITS.forEach((u, r) => {
    const n0 = L.nodes[r * 5], lm = MAP_LM[(u.n - 1) % MAP_LM.length];
    const t = el('div', 'utag landmark hasart' + (r % 2 === 0 ? ' r' : ''));
    t.dataset.slot = lm; t.style.top = (n0.y - 30) + 'px';
    t.innerHTML = '<span class="lm"><img alt="" src="assets/pic/map/' + lm + '.webp"></span><b>' + u.place + '</b>';
    M.append(t);
  });
  let todayEl = null;
  L.nodes.forEach(n => {
    const d = DAYS[n.dn - 1], ns = nodeState(n.dn), b = el('button', 'stone ' + ns + (d.special ? ' sp sp-' + d.special : ''));
    b.style.left = n.x + '%'; b.style.top = n.y + 'px'; b.dataset.day = n.dn;
    const dn = S.done[n.dn];
    const stoneName = d.special === 'treasure' ? 'stone_treasure' : (d.special === 'adventure' || d.special === 'big') ? 'stone_adventure' : (ns === 'today' || ns === 'tomorrow') ? 'stone_today' : ns === 'past' ? 'stone_done' : 'stone_soon';
    b.innerHTML = '<img class="stonepic" alt="" src="assets/pic/map/' + stoneName + '.webp">' + (ns === 'past' && dn && dn.sticker ? stkImg(dn.sticker) : '');
    b.setAttribute('aria-label', ns === 'today' ? '오늘의 놀이' : ns === 'past' ? '지난 날 다시 하기' : '앞날');
    b.addEventListener('click', () => {
      if (ns === 'today') return startDay(S.cur, S.pendingExtra ? 'extra' : 'today');
      if (ns === 'past' && n.dn <= READY_DAYS) return startDay(n.dn, 'replay');
      if (ns === 'tomorrow' && canPlayMore()) return playMore();
      if (ns === 'tomorrow' && canReplayMore()) { setChar('laugh'); bounce(); setBubble('내일 또 새 놀이가 기다려!'); return say('ui4_newtmr'); }
      setChar('laugh'); bounce(); setBubble(ns === 'soon' ? '이 길은 곧 열려요!' : '내일 만나요!'); ding(0.8);
    });
    if (n.dn === focusDn && (ns === 'today' || ns === 'tomorrow')) b.classList.add('nextup');
    M.append(b); if (n.dn === Math.min(S.cur, 170)) todayEl = b;
  });
  // 11/04 길 방향: 돌 사이 화살표(지난 길은 흐리게, 앞길은 진하게), 출발·도착 깃발, '다음' 표시, 몽글이가 갈 쪽 화살표
  const nextDn = st === 'done' || st === 'soon' || st === 'all' ? S.cur : S.cur + 1, here = Math.min(S.cur, 170);
  const arrows = [];
  for (let k = 0; k < L.nodes.length - 1; k++) { const a = L.nodes[k], b2 = L.nodes[k + 1]; const ar = el('i', 'parrow' + (b2.dn === focusDn ? ' to-next' : b2.dn <= here ? ' gone' : b2.dn > READY_DAYS ? ' later' : b2.dn <= here + 3 ? ' near' : '')); ar.innerHTML = '<img alt="" src="assets/map/arrow_next.svg">'; ar.style.left = ((a.x + b2.x) / 2) + '%'; ar.style.top = ((a.y + b2.y) / 2 + 30) + 'px'; arrows.push([ar, a, b2]); M.append(ar); }
  const tagAt = (n, cls, txt, side) => { const t = el('div', 'ntag ' + cls + (side ? ' side' : ''), txt); t.style.left = side ? 'calc(' + n.x + '% + 62px)' : n.x + '%'; t.style.top = (side ? n.y - 52 : n.y - 30) + 'px'; M.append(t); };
  tagAt(L.nodes[0], 'start', '<img class="flag" alt="" src="assets/pic/map/lm_garden.webp"><span>출발</span>', 1); tagAt(L.nodes[169], 'goal', '<img class="flag" alt="" src="assets/pic/map/lm_pizza.webp"><span>도착</span>');
  if (nextDn <= 170 && nextDn !== 1) { const nn = L.nodes[nextDn - 1], t = el('div', 'ntag next below', '다음'); t.style.left = nn.x + '%'; t.style.top = (nn.y + (nextDn === S.cur ? 84 : 70)) + 'px'; M.append(t); }
  const fixArrows = () => { const W = M.clientWidth; if (!W) return; arrows.forEach(([ar, a, b2]) => { ar.style.transform = 'translate(-50%,-50%) rotate(' + (Math.atan2((b2.y - a.y), (b2.x - a.x) * W / 100) * 180 / Math.PI).toFixed(1) + 'deg)'; }); };
  // 몽글이(오늘 돌 위)
  const me = L.nodes[Math.min(S.cur, 170) - 1], mgEl = el('div', 'mapme');
  const walker = el('img', 'walker'); walker.alt = '몽글이'; walker.src = 'assets/pic/map/mong_walk_' + (st === 'done' ? '1' : '2') + '.webp';
  const hat = el('img', 'hatslot'); hat.alt = ''; hat.src = 'assets/pic/items/item_beret.webp'; hat.hidden = true;
  hat.addEventListener('load', () => { hat.hidden = false; }); hat.addEventListener('error', () => hat.remove());
  mgEl.append(walker, hat);
  const wf = showHome.walkFrom && L.nodes[showHome.walkFrom - 1]; showHome.walkFrom = 0;
  mgEl.style.left = (wf || me).x + '%'; mgEl.style.top = ((wf || me).y - 64) + 'px'; M.append(mgEl);
  if (wf && wf !== me) {
    playSfx('mapstep'); let frame = 0; const timer = setInterval(() => { frame = (frame + 1) % 3; walker.src = 'assets/pic/map/mong_walk_' + (frame + 1) + '.webp'; }, 180);
    requestAnimationFrame(() => requestAnimationFrame(() => { mgEl.classList.add('walk'); mgEl.style.left = me.x + '%'; mgEl.style.top = (me.y - 64) + 'px'; }));
    setTimeout(() => clearInterval(timer), 1400);
  }
  const nextStone = (st === 'new' || st === 'going' || canPlayMore()) && todayEl && +todayEl.dataset.day === S.cur ? todayEl : null;
  if (nextStone) { const c = nextStone.querySelector('.cloud'); if (c && canPlayMore()) c.remove(); tapHint(nextStone, wf ? 1800 : 2500); if (wf) setTimeout(() => { if (alive(id)) { ding(1.2); say('ui4_tapnext'); setBubble('여기 눌러 볼까?'); } }, 1500); }
  if (window.HP) HP.mapHint = { next: nextStone ? +nextStone.dataset.day : 0, walked: !!wf };
  const toN = L.nodes[Math.min(me.dn, 169)], hd = el('i', 'mghead', '<img alt="" src="assets/map/arrow_next.svg">'); hd.style.left = me.x + '%'; hd.style.top = (me.y - 20) + 'px'; M.append(hd);
  const fixHead = () => { const W = M.clientWidth; if (!W || toN === me) { hd.hidden = true; return; } const ang = Math.atan2(toN.y - me.y, (toN.x - me.x) * W / 100); hd.style.transform = 'translate(-50%,-50%) translate(' + (Math.cos(ang) * 58).toFixed(0) + 'px,' + (Math.sin(ang) * 58).toFixed(0) + 'px) rotate(' + (ang * 180 / Math.PI).toFixed(1) + 'deg)'; };
  if (sea) M.insertAdjacentHTML('beforeend', '<div class="seaTag">' + sea[1] + '</div>');
  wrap.append(M);
  // 위 인사 + 아래 단추
  const head = guide(st === 'done' ? 'sleep' : 'wave', st === 'done' ? '오늘은 여기까지! 내일 또 놀자.' : st === 'soon' || st === 'all' ? '다음 길은 곧 열려요!' : '려원아, 안녕!<small>' + DAYS[Math.min(S.cur, 170) - 1].fun + '</small>');
  head.classList.add('maphead');
  const dock = el('div', 'dock mapdock');
  if (st === 'new' || st === 'going') { const b = el('button', 'kid-btn next todaygo', '<img alt="" src="' + ICON('play') + '" style="filter:brightness(10)">오늘의 놀이'); b.id = 'todayBtn'; b.addEventListener('click', () => startDay(S.pendingExtra && st === 'new' ? S.cur : (S.session.mode === 'extra' && st === 'going' ? S.cur : S.cur), S.pendingExtra || (st === 'going' && S.session.mode === 'extra') ? 'extra' : 'today')); dock.append(b); }
  else if (canPlayMore() || canReplayMore()) { const b = el('button', 'kid-btn next todaygo', '<span class="dexic">▶</span>더 놀까?'); b.id = 'moreBtn'; b.addEventListener('click', playMore); dock.append(b); }
  else { const b = el('button', 'kid-btn lav', '<img alt="" src="' + ICON('moon') + '">내일 또 만나!'); b.id = 'tomorrowBtn'; b.addEventListener('click', () => { setChar('sleep'); say('ui4_bye'); }); dock.append(b); }
  const pb = el('button', 'kid-btn', stepIcon('balloon') + '놀이터'); pb.id = 'playBtn'; pb.addEventListener('click', showPlayground);
  const db = el('button', 'kid-btn', '<span class="dexic">가</span>글자 친구'); db.id = 'dexBtn'; db.addEventListener('click', showDex);
  const sb = el('button', 'kid-btn', '<img alt="" src="' + ICON('sticker') + '">스티커'); sb.id = 'bookBtn'; sb.addEventListener('click', showBook);
  const kb = el('button', 'kid-btn', stepIcon('story') + '책장'); kb.id = 'shelfBtn'; kb.addEventListener('click', showShelf);
  const row2 = el('div', 'dock2'); row2.append(pb, db, sb, kb);
  s.append(head, wrap, dock, row2);
  if (S.migratedFrom && !S.start) s.insertBefore(el('div', 'pnote', '보호자께: v3 기록을 옮겼어요. 어른 메뉴 → 시작 날에서 6일(ㅣㅏ)이나 11일(ㅗㅜ)부터 시작하는 걸 추천해요.'), wrap);
  requestAnimationFrame(() => { fixArrows(); fixHead(); }); new ResizeObserver(() => { fixArrows(); fixHead(); }).observe(M);
  requestAnimationFrame(() => { if (todayEl && alive(id)) wrap.scrollTop = Math.max(0, todayEl.offsetTop - wrap.clientHeight / 2); });
  if (!showHome.greeted) { showHome.greeted = true; if (!wf) say(st === 'done' ? 'ui4_bye' : 'ui_hiname'); }
}

/* ---------- 하루 놀이 ---------- */
let DR = null;   // 지금 하는 날 {dn, mode, plan, segIdx, segsDone}
function startDay(dn, mode, more) {   // more = '더 놀까?'(오늘 날을 끝낸 뒤 다음 날을 바로 엶. 달력 하루 하나 규칙 예외, 끝나면 보통 날처럼 기록)
  if (mode !== 'replay' && dn > READY_DAYS) return showHome();
  const t = today(), ses = S.session;
  if (mode === 'replay') DR = { dn, mode, plan: planFor(dn, 'today'), segIdx: 0, segsDone: 0, newStat: [0, 0] };
  else {
    if (!(ses.date === t && ses.day === dn && ses.mode === mode && !ses.finished && ses.plan)) {
      if ((!canStartNew() && !(more && canPlayMore())) || (mode === 'extra' && !S.pendingExtra)) return showHome();
      if (more && !canStartNew()) S.moreDays = { date: t, n: moreUsed() + 1 };
      if (!S.start) S.start = { day: dn, date: t };
      const plan = planFor(mode === 'extra' ? S.pendingExtra.base : dn, mode);
      const c = ctxOf(plan.day);
      S.lastNewDate = t;
      S.session = Object.assign(fresh4().session, { date: t, day: dn, mode, plan, segIdx: 0, segsDone: 0, newStat: [0, 0], newKeys: c.newJ.map(j => 'j:' + j).concat(c.newW.map(w => 'w:' + w)), more: !!more });
      save();
    }
    DR = S.session;
  }
  showDayIntro();
}
function showDayIntro() {
  const P = DR.plan, d = DAYS[P.day - 1], U = UNITS[d.unit - 1];
  const [id, s] = screen('dayintro', { home: true });
  const sc = sceneBg(el('div', 'scene tall u' + (U.n % 6), '<div class="place">' + U.place + '</div><div class="ptitle">' + (P.extra ? '한 번 더 놀이 날' : P.fun) + '</div>'), U.n);
  const steps = el('div', 'steps', P.segs.map((g, k) => '<span class="' + (k < DR.segIdx ? 'on' : k === DR.segIdx ? 'now' : '') + '">' + stepIcon(g.type) + '</span>').join(''));
  s.append(guide('wave', DR.segIdx ? '이어서 놀자!' : (d.special === 'big' ? '오늘은 잔치 날이야!' : d.special ? '오늘은 특별한 날!' : '려원아, 오늘 놀이 하자!')), sc, steps);
  const dock = el('div', 'dock'), go = el('button', 'kid-btn next', '출발!<img alt="" src="' + ICON('arrow') + '">'); go.id = 'goBtn';
  go.addEventListener('click', () => runSeg(DR.segIdx)); dock.append(go); s.append(dock); tapHint(go, 2200);
  const v = DR.segIdx ? [] : [d.k === 1 || P.extra ? VOICE.unit(d.unit) : 'ui4_today'].concat(d.special === 'big' ? ['ui4_bigday'] : P.extra ? ['ui4_again'] : []);
  (async () => { if (v.length) await say(v.filter(hasA)); })();
  if (window.HP) HP.solve = async () => go.click();
}
function runSeg(i) {
  const P = DR.plan;
  if (i >= P.segs.length) return endDay();
  const seg = P.segs[i], ctx = ctxOf(P.day);
  if (timeUp() && i < P.segs.length - 1 && timed()) return runSeg(P.segs.length - 1);   // 시간이 다 되면 이야기로 바로
  let items = [];
  try { items = addShowcase(seg.type, (QB[seg.type] || (() => []))(ctx, seg.n || 4), ctx, false); } catch (e) { items = []; if (window.HP) HP.errs.push(seg.type + ': ' + e.message); }
  if (!items.length || !RUN[segRunP(seg, ctx, items).kind]) { DR.segIdx = i + 1; return runSeg(i + 1); }
  run = { p: segRunP(seg, ctx, items), queue: items, i: 0, ok: 0, first: 0, ctx, segIdx: i, seg, t0: Date.now(), z: i === P.segs.length - 1 };
  showSegCard(seg, () => nextItem());
}
function showSegCard(seg, go) {
  const [id, s] = screen('segcard', { home: true });
  const c = el('div', 'segcard', '<span class="emo">' + stepIcon(seg.type) + '</span><b>' + seg.kid + '</b>');
  s.append(c); ding(1.1); ticking = true;
  const t = setTimeout(() => alive(id) && go(), 1100);
  c.addEventListener('click', () => { clearTimeout(t); go(); });
  if (window.HP) HP.solve = async () => { clearTimeout(t); go(); };
}
const NO_REC = ['letter', 'chant', 'body', 'sort', 'map', 'cloud', 'treasure', 'pick3'];
function nextItem() {
  if (!run) return showHome();
  if (run.i >= run.queue.length) return segDone();
  if (timeUp() && !run.z && timed() && !DR.play) return segDone(true);
  const item = run.queue[run.i], kind = run.p.kind;
  const [id, s] = screen('round-' + run.p.type, { home: true });
  ticking = true; run.curKey = null;
  s.prepend(el('div', 'segdots', run.queue.map((_, q) => '<i class="' + (q < run.i ? 'on' : q === run.i ? 'now' : '') + '"></i>').join('')));
  if (window.HP) { HP.round = { type: run.p.type, kind, item, no: run.i }; HP.solve = null; }
  const tok = ++roundTok;
  RUN[kind](item, id, s, ok => {
    if (tok !== roundTok || !run) return; roundTok++;
    if (ok && typeof ok === 'object' && ok.chosen) { const P = DR.plan; P.segs[run.segIdx] = segOf(ok.chosen, 'P'); return runSeg(run.segIdx); }
    const key = run.curKey || itemKeyOf(kind === 'train' ? item : item);
    if (kind === 'letter') touch(key); else if (!NO_REC.includes(kind)) rec(key, ok);
    run.first += ok != null ? 1 : 0; if (ok) run.ok++;
    run.i++; save(); nextItem();
  });
  if (window.HP && !HP.solve) HP.solve = v3Solver(kind, item, s);
}
function segDone(cut) {
  const r = run; run = null; ticking = false;
  if (!S.played.includes(r.p.type)) S.played.push(r.p.type);
  if (r.p.kind === 'hidden') hidAdapt(r.hid, r.p.lv || 1);
  const stk = r.i > 0 ? giveSticker(DR) : null;   // 11/04 대표님: 놀이 하나 끝낼 때마다 스티커(오늘·지난 날 다시 하기·놀이터 모두, 정답률 상관없이)
  if (DR.play) { save(); return stk ? showStickerPop(stk, showPlayground) : showPlayground(); }
  DR.segIdx = r.segIdx + 1; DR.segsDone = (DR.segsDone || 0) + 1;
  if (DR.mode !== 'replay' && DR.segsDone >= 3) markDayDone();
  if (stk && S.done[DR.plan.day]) S.done[DR.plan.day].sticker = stk;
  save();
  const P = DR.plan, last = r.segIdx >= P.segs.length - 1;
  if ((cut || timeUp() || limitMs() - usedMs() < 60000) && timed() && !last) { DR.segIdx = P.segs.length - 1; }
  const go = last ? endDay : showStep;
  return stk ? showStickerPop(stk, go) : go();
}
/* ---------- 스티커(11/04): 놀이 하나 끝 = 스티커 하나. S.stickers 에 쌓이고(옛 스티커 그대로), 지도 돌에는 그날 마지막 스티커 ---------- */
/* 11/04 대표님: 스티커 종류를 많이 → 피자 스티커 24장 + 앱 속 피자 그림(동물·탈것·과일·간식…)으로 만든 그림 스티커. id: 숫자 = st_XX, 'p:고래id' = 그림 스티커 */
const PIC_STK = ['gorae', 'sangeo', 'ojingeo', 'geobuk', 'haema', 'saeu', 'girin', 'gorilla', 'goyangi', 'gangaji', 'gom', 'kokkiri', 'lion', 'tokki', 'yeou', 'wonsungi', 'nabi', 'ori', 'kkachi', 'dwaeji', 'hama', 'mal', 'so', 'tajo', 'geomi',
  'nunsaram', 'kkot', 'byeol', 'dal', 'pungseon', 'robot', 'yoyo', 'sobangcha', 'gicha', 'beoseu', 'bae', 'cha', 'gita', 'radio', 'keikeu', 'pija', 'ppang', 'satang', 'subak', 'ttalgi', 'sagwa', 'podo', 'banana', 'tomato', 'juseu',
  'gimbap', 'tteok', 'seonmul', 'siso', 'gong', 'moja', 'hwabun', 'namu', 'skin_balloon', 'skin_star', 'skin_fish', 'chest_open', 'cloud_smile', 'town_b1', 'town_b2', 'town_b3', 'town_b4', 'town_b5', 'town_b6'].filter(w => ARTS.pic.includes(w));
const STN_IDS = Array.from({ length: 24 }, (_, i) => 'n:' + String(i + 1).padStart(2, '0'));
const STK_ALL = STICKER_IDS.concat(STN_IDS, PIC_STK.map(w => 'p:' + w));
const stkSrc = id => typeof id === 'string' && id.startsWith('p:') ? PIC(id.slice(2)) : typeof id === 'string' && id.startsWith('n:') ? 'assets/pic/stickers/stn_' + id.slice(2) + '.webp' : STICKER(id);
const stkImg = (id, cls = '') => '<img class="stki' + (typeof id === 'string' ? ' pstk' : '') + (cls ? ' ' + cls : '') + '" alt="스티커" src="' + stkSrc(id) + '">';
function giveSticker(dr) {   // 아직 없는 스티커 중에서 무작위(다 모았으면 아무거나)
  const have = new Set(S.stickers.map(String)), fresh = STK_ALL.filter(x => !have.has(String(x)));
  const uniq = STICKER_IDS.concat(STN_IDS).filter(x => !have.has(String(x)));
  const pool = uniq.length ? uniq : (fresh.length ? fresh : STK_ALL), st = pool[Math.floor(Math.random() * pool.length)];
  S.stickers.push(st); dr.got = (dr.got || []).concat(st); dr.gotNew = (dr.gotNew || 0) + (fresh.length ? 1 : 0);
  return st;
}
function showStickerPop(st, next) {
  const [id, s] = screen('sticker', { home: true });
  const got = (DR && DR.got) || [st];
  const box = el('div', 'reward');
  const isNew = S.stickers.filter(x => String(x) === String(st)).length === 1;
  const card = el('div', 'stk' + (typeof st === 'string' ? ' pic' : ''), stkImg(st));
  box.append(mg('jump'), el('h1', '', isNew ? '새 스티커 받았다!' : '스티커 받았다!'), card);
  if (got.length > 1) box.append(el('div', 'stkrow', got.slice(-8).map((x, k) => stkImg(x, k === Math.min(got.length, 8) - 1 ? 'new' : '')).join('')));
  const dock = el('div', 'dock'), b = el('button', 'kid-btn next', '좋아!<img alt="" src="' + ICON('arrow') + '">'); b.id = 'stickerNext';
  let gone = false; const go = () => { if (gone || !alive(id)) return; gone = true; next(); };
  b.addEventListener('click', () => { ding(1.3); go(); }); dock.append(b);
  s.append(box, dock);
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
  if (window.HP) { HP.sticker = { id: st, n: S.stickers.length }; HP.solve = async () => go(); }
  (async () => { playSfx('sticker'); sparkAt(card); surprise(s, true); await wait(300); if (!alive(id)) return; await say(['ui_sticker', praiseKey()]); if (alive(id)) setTimeout(go, 1800); })();
}
function showStep() {   // 칸 사이: 길 위 몽글이가 한 칸 앞으로(짧게)
  const P = DR.plan, [id, s] = screen('step', { home: true });
  const steps = el('div', 'steps lg', P.segs.map((g, k) => '<span class="' + (k < DR.segIdx ? 'on' : k === DR.segIdx ? 'now' : '') + '">' + stepIcon(g.type) + '</span>').join(''));
  s.append(guide(rand(2) ? 'laugh' : 'clap', ['잘했어! 다음 놀이로 가 볼까?', '좋아! 한 칸 더!', '다음은 뭘까?'][rand(3)]), steps);
  const dock = el('div', 'dock'), go = el('button', 'kid-btn next', '다음<img alt="" src="' + ICON('arrow') + '">'); go.id = 'stepNext'; dock.append(go); s.append(dock);
  // 11/04: 몽글이가 지난 칸에서 다음 칸으로 걸어가고, 다음 칸·'다음' 단추가 반짝 + 손가락
  const sp = [...steps.children], from = sp[Math.max(0, DR.segIdx - 1)], to = sp[DR.segIdx], walker = mg('wave', 'stepme');
  if (from && to) { steps.append(walker); const at = n => { walker.style.left = (n.offsetLeft + n.offsetWidth / 2) + 'px'; }; requestAnimationFrame(() => { at(from); requestAnimationFrame(() => requestAnimationFrame(() => { walker.classList.add('go'); at(to); })); }); to.classList.add('gonext'); }
  tapHint(go, 1200);
  const t = setTimeout(() => alive(id) && runSeg(DR.segIdx), 4500);
  go.addEventListener('click', () => { clearTimeout(t); runSeg(DR.segIdx); });
  ding(1.2); if (DR.segsDone % 2 === 0) say('ui4_proc' + (1 + rand(4)));
  if (window.HP) HP.solve = async () => { clearTimeout(t); runSeg(DR.segIdx); };
}
function markDayDone() {
  const ses = DR; if (ses.marked) return; ses.marked = true;
  const dn = ses.plan.day, d = DAYS[dn - 1];
  if (ses.mode === 'today') {
    S.done[dn] = { date: today(), segs: ses.segsDone, ms: usedMs() };
    if (S.cur === dn) S.cur = dn + 1;
    if (d.k === 4) adaptAfterK4(d, ses);
  } else if (ses.mode === 'extra') { const pe = S.pendingExtra; S.pendingExtra = null; if (pe) adaptAfterK4(DAYS[pe.base - 1], ses); }
  S.dayLog.push({ d: today(), day: dn, mode: ses.mode, plan: ses.plan.segs.map(x => x.type) }); S.dayLog = S.dayLog.slice(-60);
}
/* 한 번 더 놀이 날(6장): 단원 k=4 끝에 새 항목 첫 시도 정답률 < 70% 이고 그 단원에서 2번 안 했으면 */
function adaptAfterK4(d, ses) {
  const [r, t] = ses.newStat || [0, 0]; if (S.extra.unit !== d.unit) S.extra = { unit: d.unit, count: 0 };
  if (t >= 3 && r / t < 0.7 && S.extra.count < 2) { S.extra.count++; S.pendingExtra = { base: d.day, unit: d.unit }; }
}
function afterCheck(dn) {   // 보물 찾기 날 결과(조용히)
  const c = S.checks.filter(x => x.day === dn).slice(-1)[0]; if (!c || !c.total) return;
  const p = c.right / c.total, u = DAYS[dn - 1].unit;
  S.boost = p < 0.6 ? u + 1 : 0; const wasHard = S.hard; S.hard = p >= 0.9; S.suggestSkip = wasHard && S.hard;
}
function endDay() {
  run = null; ticking = false;
  const P = DR.plan, d = DAYS[P.day - 1], mode = DR.mode;
  if (mode !== 'replay') { markDayDone(); S.session.finished = true; }
  if (P.segs.some(g => g.type === 'treasure') && mode !== 'replay') afterCheck(P.day);
  let grew = '';
  const got = DR.got || [], sticker = got.length ? got[got.length - 1] : null;
  if (sticker && S.done[P.day]) S.done[P.day].sticker = sticker;
  if (mode !== 'replay') {
    if (d.special === 'big' && mode === 'today') { S.town.buildings = Math.min(6, S.town.buildings + 1); grew = 'b'; }
    if (d.special === 'adventure' && mode === 'today') { S.town.props = Math.min(17, S.town.props + 1); grew = 'p'; }
    if (d.k >= 4 && !S.books.includes(d.unit)) S.books.push(d.unit);
  }
  save();
  const [id, s] = screen('dayend', { night: true });
  const hero = el('div', 'endhero', '<img class="moon" alt="" src="' + ICON('moon') + '">');
  hero.append(mg(sticker ? 'surprise' : 'sleep'), el('h1', '', sticker ? '스티커를 모았어!' : '오늘은 여기까지!'), el('p', '', '내일 또 만나'));
  if (got.length) hero.append(el('div', 'stkrow end', got.map(x => stkImg(x)).join('')));
  if (grew) hero.append(el('div', 'grow', grew === 'b' ? '몽글이 마을에 새 집이 생겼어! ' + TOWN_BUILDINGS[S.town.buildings - 1] : '몽글이 마을이 더 예뻐졌어! ' + TOWN_PROPS[S.town.props - 1]));
  const paper = el('div', 'paper', '<div class="h"><img alt="" src="' + ICON('pencil') + '">보호자께 · 집에서 한 가지</div><p>' + (UNITS[d.unit - 1].paper || '') + '</p><small>오늘 숨은 목표: ' + d.goal + '</small>');
  const dock = el('div', 'dock'), b = el('button', 'kid-btn lav', '지도로'); b.id = 'endMap'; b.addEventListener('click', showHome); dock.append(b);
  if (!timeUp()) { const p = el('button', 'kid-btn', '<span class="dexic">🛝</span>놀이터'); p.id = 'endPlay'; p.addEventListener('click', showPlayground); dock.append(p); }
  s.append(hero, paper, dock);
  let moreB = null;
  if (canPlayMore() || canReplayMore()) { moreB = el('button', 'kid-btn next moreBtn', '<span class="dexic">▶</span>더 놀까?'); moreB.id = 'endMore'; moreB.addEventListener('click', playMore); s.insertBefore(el('div', 'dock moredock'), dock).append(moreB); }
  tapHint(moreB || b, 2600);
  if (mode !== 'replay' && S.cur > P.day) showHome.walkFrom = P.day;
  (async () => { if (sticker) { sparkPop(); ding(); await say('ui_book'); } if (grew && alive(id)) await say('ui4_town'); if (alive(id)) await say(mode === 'replay' ? 'ui_good1' : 'ui4_bye'); if (alive(id) && !timeUp() && mode !== 'replay') say('ui4_free'); })();
  if (window.HP) HP.solve = null;
  DR = null;
}

/* ---------- 놀이터(자유 놀이): 해 본 놀이만, 배운 것만, 하루 타이머 안에서만 ---------- */
function showPlayground() {
  if (timeUp()) { const [, s] = screen('timeup', { night: true, home: true }); s.append(el('div', 'rest', ''), guide('sleep', '오늘 놀 시간이 다 됐어. 우리 내일 또 만나!')); say('ui4_timeup'); return; }
  const [, s] = screen('playground', { home: true, scroll: true });
  const types = S.played.filter(t => IMPL.includes(t) && !SPECIAL_ONLY.includes(t) && t !== 'yesterday' && t !== 'pick3');
  s.append(guide('wave', types.length ? '하고 싶은 놀이를 골라 봐!' : '오늘의 놀이를 하면 놀이터에 친구가 생겨!'));
  const g = el('div', 'pgrid');
  types.forEach(t => { const b = el('button', 'pcard3', '<span class="emo">' + stepIcon(t) + '</span><b>' + CURR.plays[t].kid + '</b>'); b.dataset.t = t; if (t === 'body' && typeof poseArtReady === 'function' && !poseArtReady()) b.disabled = true; b.addEventListener('click', () => { if (t === 'body' && typeof poseArtReady === 'function' && !poseArtReady()) return; playFree(t); }); g.append(b); });
  s.append(g); ticking = false;
}
function playFree(t) {
  const dn = Math.max(1, Math.min(S.cur - 1 || 1, READY_DAYS)), ctx = ctxOf(dn), seg = segOf(t, 'P');
  DR = { dn, mode: 'replay', play: true, plan: Object.assign({}, DAYS[dn - 1], { segs: [seg] }), segIdx: 0, segsDone: 0 };
  const items = addShowcase(t, QB[t](ctx, seg.n), ctx, true); if (!items.length) return showPlayground();
  run = { p: segRunP(seg, ctx, items), queue: items, i: 0, ok: 0, first: 0, ctx, segIdx: 0, seg, t0: Date.now(), z: false };
  nextItem();
}

/* ---------- 글자 친구 도감 · 스티커 책 · 책장 ---------- */
const DEX = [...'ㅏㅓㅗㅜㅡㅣ', ...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ', ...'ㅑㅕㅛㅠㅐㅔ', ...'ㄲㄸㅃㅆㅉ', ...'ㅘㅝㅚㅟㅢ'];
function showDex() {
  const [, s] = screen('dex', { scroll: true, home: true });
  const met = DEX.filter(j => S.met[j]);
  s.append(guide(met.length ? 'laugh' : 'basic', met.length ? '글자 친구를 많이 만났어!' : '놀이를 하면 글자 친구가 생겨!'));
  const g = el('div', 'dex');
  DEX.forEach(j => {
    const on = !!S.met[j], e = JAMO_EX[j], star = known('j:' + j);
    const c = el('button', 'dx' + (on ? ' on' : ''), on ? (e ? (hasPic(e.lp) ? picHTML(e.lp, e.word) : exPic(j)) : '') + '<span class="g">' + j + '</span><span class="n">' + (JNAME[j] || '') + (star ? ' ★' : '') + '</span>' : '<span class="g">' + j + '</span><span class="n">?</span>');
    c.dataset.j = j; c.addEventListener('click', () => { if (on && hasA(VOICE.jamo(j))) say(VOICE.jamo(j)); }); g.append(c);
  });
  s.append(g);
}
function showBook() {   // 첫 화면: 가진 스티커만 크게, 다음에 모을 하나 반짝. 빈 칸 벽·물음표 없음.
  const [, s] = screen('bookscr', { scroll: true, home: true });
  const have = new Set(S.stickers.map(String)), n = have.size;
  const extra = [...have].filter(x => !STK_ALL.some(y => String(y) === x)).map(x => isNaN(+x) ? x : +x);
  const order = STK_ALL.concat(extra);
  const owned = order.filter(id => have.has(String(id)));
  const next = order.find(id => !have.has(String(id)));
  s.append(guide(n ? 'laugh' : 'basic', n ? '모은 스티커야!' : '놀이를 하나 끝내면 스티커가 와!'));
  const book = el('div', 'stkhero');
  const slot = (id, cls) => {
    const c = el('div', 'slot ' + cls, stkImg(id)); c.dataset.id = String(id);
    if (have.has(String(id))) c.addEventListener('click', () => { c.classList.remove('wig'); void c.offsetWidth; c.classList.add('wig'); ding(1.2); if (typeof id === 'string' && id.startsWith('p:') && WORDS[id.slice(2)] && hasA(VOICE.word(id.slice(2)))) say(VOICE.word(id.slice(2))); });
    return c;
  };
  owned.forEach(id => book.append(slot(id, 'on big')));
  if (next) book.append(slot(next, 'next shimmer'));
  s.append(book); playSfx('shelf'); say('ui_book');
  if (window.HP) HP.book = { total: order.length, have: n, next: next ? String(next) : '' };
}
function showShelf() {
  const [, s] = screen('shelf', { scroll: true, home: true });
  s.append(guide('point', S.books.length ? '다 본 이야기책이야. 골라 볼까?' : '이야기를 끝까지 보면 책이 꽂혀!'));
  const g = el('div', 'shelf');
  const nextBook = UNITS.find(u => !S.books.includes(u.n));
  UNITS.forEach(u => {
    const on = S.books.includes(u.n), nxt = nextBook && nextBook.n === u.n;
    if (!on && !nxt) return;
    const b = el('button', 'bk u' + (u.n % 6) + (on ? ' on' : ' next'), on ? '<b>' + u.title + '</b>' : '<b>' + u.place + '</b>');
    if (on) b.addEventListener('click', () => readBook(u.n));
    g.append(b);
  });
  if (!S.books.length && !nextBook) g.append(el('p', 'muted', '이야기가 아직 없어요.'));
  s.append(g);
}
function readBook(n) {
  const dn = (n - 1) * 5 + 5, ctx = ctxOf(Math.min(dn, 170)), seg = segOf('story', 'Z');
  DR = { dn, mode: 'replay', play: true, plan: Object.assign({}, DAYS[dn - 1], { segs: [seg] }), segIdx: 0 };
  const items = [1, 2, 3, 4].map(k => ({ u: n, k }));
  run = { p: { kind: 'story', type: 'story', items }, queue: items, i: 0, ok: 0, first: 0, ctx, segIdx: 0, seg, z: true };
  nextItem();
}

/* ---------- 어른 메뉴(7장) ---------- */
function openParent() {
  stopAudio(); ticking = false;
  const PM = $('#parent'); PM.hidden = false;
  const dn = Math.min(S.cur, 170), d = DAYS[dn - 1], U = UNITS[d.unit - 1], lastDone = Object.keys(S.done).map(Number).sort((a, b) => b - a)[0];
  const ld = lastDone ? DAYS[lastDone - 1] : null;
  const boxCls = it => !it ? 'n' : it.box >= 4 ? 'k' : 'l';
  const conf = Object.entries(S.items).map(([k, v]) => [k, v.hist.filter(x => !x).length]).filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const showK = k => k[0] === 'w' ? WORDS[k.slice(2)] : k.slice(2);
  const left = Math.max(0, Math.ceil((limitMs() - usedMs()) / 60000));
  const seg = (name, vals, cur) => '<div class="seg" data-n="' + name + '">' + vals.map(([v, t]) => '<button data-v="' + v + '" class="' + (String(v) === String(cur) ? 'on' : '') + '">' + t + '</button>').join('') + '</div>';
  const playedDays = Object.entries(S.done).sort((a, b) => a[1].date < b[1].date ? -1 : 1).slice(-28);
  const ses = S.session;
  PM.innerHTML = '<div class="pm" role="dialog" aria-label="어른 메뉴"><div class="head"><h1>어른 메뉴</h1><button class="x" id="pmClose"><img alt="닫기" src="' + ICON('close') + '"></button></div>' +
    '<div class="cap">오늘</div><div class="sec sum"><div class="big">' + dn + '일째 · ' + d.stage + '단계 · ' + d.unit + '단원 ' + U.title + '</div>' +
    '<div class="tip"><b>재미 틀:</b> ' + d.fun + '<br><b>숨은 목표:</b> ' + d.goal + '<br><b>오늘 칸:</b> ' + d.segs.map(x => x.kid).join(' → ') +
    '<br>' + (ses.date === today() ? '오늘 한 칸 ' + (ses.segsDone || 0) + '개 · ' : '') + '오늘 쓴 시간 약 ' + Math.round(usedMs() / 60000) + '분 · 남은 시간 약 ' + left + '분' + (S.pendingExtra ? '<br>다음 날은 <b>한 번 더 놀이 날</b>이에요(새 글자 정답률이 70% 아래).' : '') +
    (ld ? '<br><b>집에서:</b> ' + (UNITS[ld.unit - 1].paper || '') : '') + '</div></div>' +
    '<div class="cap">익힌 글자 표 <span class="muted">· 회색 새 것 · 노랑 배우는 중 · 초록 익혔어요</span></div><div class="sec"><div class="ktab">' +
    DEX.slice(0, 20).map(j => '<span class="' + boxCls(S.items['j:' + j]) + '">' + j + '</span>').join('') + '</div><div class="ktab w">' +
    Object.keys(S.items).filter(k => k[0] === 'w').slice(-40).map(k => '<span class="' + boxCls(S.items[k]) + '">' + WORDS[k.slice(2)] + '</span>').join('') + '</div>' +
    '<small>헷갈리는 것: ' + (conf.length ? conf.map(c => showK(c[0])).join(', ') : '아직 없어요') + '</small></div>' +
    '<div class="cap">숨은 글자 단계</div><div class="sec"><small>지금 ' + S.hid.lv + '단계 (1 = 낱말 글자만 · 2 = 닮은 가짜 글자 · 3 = 더 닮고 작게). 깨끗이 찾은 판이 두 번 이어지면 올라가고, 가짜를 많이 누르면 내려가요.' + (S.hid.log.length ? '<br>' + S.hid.log.slice(-3).map(h => h.d + ' · ' + h.lv + '단계 ' + h.clean + '/' + h.n + ' 깨끗, 가짜 ' + h.decoy + '번').join('<br>') : '') + '</small></div>' +
    '<div class="cap">보물 찾기 기록(아이 화면에는 안 나와요)</div><div class="sec"><small>' + (S.checks.length ? S.checks.slice(-6).map(c => c.date + ' · ' + c.day + '일째: ' + c.right + '/' + c.total + ' (듣기 ' + c.by.ear.join('/') + ', 읽기 ' + c.by.read.join('/') + ', 쓰기·만들기 ' + c.by.write.join('/') + ')').join('<br>') : '아직 없어요') +
    (S.hard ? '<br>잘하고 있어서 보기를 하나 늘리고 색 힌트를 옅게 했어요.' : '') + '</small>' + (S.suggestSkip ? '<button class="r" id="pmSkip"><div class="l">다음 단원으로 건너뛸까요?<small>두 번 연속 90% 이상이에요(누르면 다음 단원 1일째로)</small></div></button>' : '') + '</div>' +
    '<div class="cap">놀이한 날(점만, 연속 기록 없음)</div><div class="sec"><div class="cal">' + playedDays.map(([k, v]) => '<i title="' + v.date + ' · ' + k + '일째"></i>').join('') + '</div></div>' +
    '<div class="cap">설정</div><div class="sec">' +
    '<div class="r"><div class="l">하루 놀이 시간</div>' + seg('timerMin', [[10, '10분'], [12, '12분'], [15, '15분']], S.settings.timerMin) + '</div>' +
    '<div class="r col"><div class="l">시작 날<small>려원이는 v3 1~3주차를 했으니 6일이나 11일을 추천해요. 앞 글자는 복습 상자로 넣어요.</small></div><div class="seg wrap" id="pmStart">' + START_DAYS.map(([v, t]) => '<button data-v="' + v + '" ' + (v > READY_DAYS ? 'disabled' : '') + ' class="' + (S.start && S.start.day === v ? 'on' : '') + '">' + t + '</button>').join('') + '</div></div>' +
    '<div class="r"><div class="l">색 힌트(그림 보고 글자 고르기)</div>' + seg('colorHint', [['auto', '자동'], ['on', '켜기']], S.settings.colorHint) + '</div>' +
    '<button class="r" id="pmOneMore"' + (S.oneMoreDate === today() ? ' disabled' : '') + '><div class="l">오늘 하나 더 열기<small>여행 전·시험용 · 하루 한 번만</small></div></button>' +
    '<div class="r"><div class="l">소리 켜기</div><button class="tg' + (S.settings.sound ? ' on' : '') + '" id="tgSound" aria-label="소리"></button></div>' +
    '<div class="r"><div class="l">소리 크기</div><input type="range" id="vol" min="0.2" max="1" step="0.1" value="' + S.settings.volume + '" aria-label="소리 크기"></div>' +
    '<div class="r"><div class="l">려원이 생일(계절 겉모습용)</div><input type="text" id="bday" placeholder="08-01" value="' + (S.settings.birthday || '') + '" maxlength="5"></div>' +
    '<div class="r"><div class="l">진도 내보내기 · 가져오기<small>파일로만 · 인터넷 안 써요</small></div><button class="mini" id="pmExport">내보내기</button><label class="mini">가져오기<input type="file" id="pmImport" accept="application/json" hidden></label></div>' +
    '</div><div class="cap">이 놀이는 무엇을 기르나요</div><div class="sec"><button class="r" id="rGoals"><div class="l">놀이 ' + Object.keys(CURR.plays).length + '개의 숨은 목표</div></button><div class="more" id="mGoals" hidden><ul>' +
    Object.entries(CURR.plays).map(([k, v]) => '<li><b>' + v.kid + '</b> — ' + v.goal + (IMPL.includes(k) && (k !== 'body' || (typeof poseArtReady === 'function' && poseArtReady())) ? '' : ' <span class="muted">(곧)</span>') + '</li>').join('') + '</ul></div></div>' +
    '<div class="acts"><button class="warn" id="pmReset">처음부터 다시</button></div>' +
    '<div class="foot" id="pmFoot">기록은 이 기기에만 저장돼요 · 광고·로그인·수집 없음 · 알림·연속 기록 없음<br>진도 파일에는 음성이 없어요. audio 폴더의 mp3가 빠지면 출고하면 안 됩니다.<br>v4 1부: 1~55일(1·2단계)까지 열려 있어요. 56일부터는 그림·음성이 준비되면 열려요.</div></div>';
  PM.querySelectorAll('.seg[data-n]').forEach(sg => sg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const v = b.dataset.v; S.settings[sg.dataset.n] = isNaN(+v) ? v : +v; save();
    sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); drawTime();
  }));
  $('#pmStart').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b || b.disabled) return; setStartDay(+b.dataset.v); openParent(); });
  $('#pmOneMore').addEventListener('click', () => { if (S.oneMoreDate === today()) return; S.oneMoreDate = today(); S.lastNewDate = ''; if (S.session.date === today()) S.session.finished = true; save(); closeParent(); });
  $('#tgSound').addEventListener('click', e => { S.settings.sound = !S.settings.sound; e.currentTarget.classList.toggle('on', S.settings.sound); save(); });
  $('#vol').addEventListener('input', e => { S.settings.volume = +e.target.value; save(); });
  $('#bday').addEventListener('change', e => { S.settings.birthday = e.target.value.trim(); save(); });
  $('#pmExport').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = 'hangul-play-v4-' + today() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  $('#pmImport').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const o = JSON.parse(rd.result); if (o && o.v === 4) { localStorage.setItem(KEY, JSON.stringify(o)); load(); closeParent(); } } catch (er) { /* 잘못된 파일 */ } }; rd.readAsText(f); });
  $('#rGoals').addEventListener('click', () => { const m = $('#mGoals'); m.hidden = !m.hidden; });
  if ($('#pmSkip')) $('#pmSkip').addEventListener('click', () => { const u = DAYS[Math.min(S.cur, 170) - 1].unit; setStartDay(u * 5 + 1, true); S.suggestSkip = false; save(); openParent(); });
  let armed = false;
  $('#pmReset').addEventListener('click', e => { if (!armed) { armed = true; e.currentTarget.textContent = '정말 처음부터? 한 번 더 누르세요'; return; } const keep = S.settings; S = fresh4(); S.settings = keep; save(); closeParent(); });
  $('#pmClose').addEventListener('click', closeParent);
  fetch('audio/ui_hiname.mp3').then(r => { if (r.ok) return; const f = document.querySelector('#pmFoot'); if (f) f.insertAdjacentHTML('afterbegin', '<b>음성 파일이 없어요. audio 복원 전에는 출고하면 안 됩니다.</b><br>'); }).catch(() => { const f = document.querySelector('#pmFoot'); if (f) f.insertAdjacentHTML('afterbegin', '<b>음성 파일을 열 수 없어요. audio 복원 전에는 출고하면 안 됩니다.</b><br>'); });
}
function closeParent() { const PM = $('#parent'); PM.hidden = true; PM.innerHTML = ''; run = null; DR = null; showHome(); }
/* 시작 날 고르기(3.4): 앞 단원 자모·낱말은 복습 상자 2로 */
function setStartDay(dn, keepStart) {
  if (dn > READY_DAYS) return;
  const t = today(), due = today(BOX_DAYS[2]);
  DAYS.slice(0, dn - 1).forEach(d => { const c = ctxOf(d.day); c.newJ.forEach(j => { if (!S.items['j:' + j]) S.items['j:' + j] = { box: 2, due, hist: [1], seen: t }; S.met[j] = S.met[j] || t; }); c.newW.forEach(w => { if (!S.items['w:' + w]) S.items['w:' + w] = { box: 2, due, hist: [1], seen: t }; }); });
  S.cur = dn; if (!keepStart) S.start = { day: dn, date: t }; S.pendingExtra = null;
  if (S.lastNewDate === t && !Object.keys(S.done).length) S.lastNewDate = '';
  if (S.session.date === t && !S.session.finished) S.session = fresh4().session;
  save();
}

/* ---------- 자동 시험 도우미(아이 화면에는 없음) ---------- */
function v3Solver(kind, item, s) {
  const q = sel => s.querySelector(sel);
  if (['listen', 'readword', 'name', 'blend'].includes(kind)) return async () => { const c = q('.ch[data-k="' + item + '"]'); if (c) c.click(); };
  if (kind === 'pick') return async () => { const c = q('.ch[data-k="' + item + '"]'); if (c) c.click(); };
  if (kind === 'picword') return async () => { const c = q('.pwcard[data-k="' + item + '"]'); if (c) c.click(); };
  if (kind === 'hidden') return async () => { const box = q('.hwbox'); for (let k = 0; k < 8 && HP.hidden && !HP.hidden.found; k++) { const n = HP.hidden.got, r = HP.hidden.rect(); box.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + r.w / 2, clientY: r.y + r.h / 2 })); await waitFor(() => !alive || HP.hidden.got > n || HP.hidden.found, 4000); await wait(200); } };
  if (kind === 'letter') return async () => q('#nextBtn').click();
  if (kind === 'trace' || kind === 'copy') return async () => { for (let k = 0; k < HP.trace.guide.length; k++) { await waitFor(() => !HP.trace.state.busy); const st = HP.trace.state; if (st.finished) break; const nk = st.next; if (nk < 0) break; await HP.trace.inject(HP.trace.guide[nk].map(p => p.slice())); await wait(150); } };
  if (kind === 'clap') return async () => { const pad = await waitFor(() => { const p = q('#clapPad'); return p && !p.classList.contains('off') && p; }, 15000); if (!pad) return; for (let k = 0; k < [...WORDS[item]].length; k++) { pad.click(); await wait(120); } const c = await waitFor(() => { const ch = q('.choices'); return ch && !ch.hidden && q('.ch[data-k="' + [...WORDS[item]].length + '"]'); }, 5000); if (c) c.click(); };
  if (kind === 'merge') return async () => { const { cho, jung } = splitSyllable(item); for (const k of ['c' + cho, 'v' + jung]) { const n = q('.piece[data-k="' + k + '"]:not(.used)'); if (n) tapEl(n); await wait(350); } };
  if (kind === 'train') return async () => { const cars = [...s.querySelectorAll('.car')]; for (const c of cars.slice(0, 3)) { c.click(); await waitFor(() => !c.classList.contains('lit'), 4000); await wait(100); } const fb = q('#trainFind'); if (fb && !fb.hidden) fb.click(); await wait(300); const m = await waitFor(() => (q('.ask').textContent.match(/‘(.)’/) || [])[1], 5000); const c = m && q('.car[data-k="' + m + '"]'); if (c) c.click(); };
  return null;
}
window.HP = { get S() { return S; }, get run() { return run; }, get DR() { return DR; }, setOffset: n => { DAY_OFFSET = n; }, get offset() { return DAY_OFFSET; }, today, planFor, checkDay, ctxOf, QB, DAYS, UNITS, startDay, showHome, setStartDay, openParent, openGate, showPlayground, showDex, showBook, showShelf, showDayIntro, todayState, limitMs, usedMs, timeUp, save, load: () => { load(); }, errs: [], audioLog: [], audioErr: [], screen: '', round: null, trace: null, solve: null, hidden: null, pw: null,
  testRound: (type, item, ctxDay) => { const ctx = ctxOf(ctxDay || 21), seg = segOf(type, 'A'), items = item != null ? [item] : QB[type](ctx, seg.n); DR = { dn: ctx.dn, mode: 'replay', play: true, plan: Object.assign({}, DAYS[ctx.dn - 1], { segs: [seg] }), segIdx: 0 }; run = { p: segRunP(seg, ctx, items), queue: items, i: 0, ok: 0, first: 0, ctx, segIdx: 0, seg, z: true }; nextItem(); } };
if ('speechSynthesis' in window) speechSynthesis.getVoices();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { save(); stopAudio(); } });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
showHome();
