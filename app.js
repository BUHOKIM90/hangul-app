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
const MORE_MAX = 5;
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
/* 11/06 v5 지도 그림: 돌·특별한 날·깃발·몽글이 소품. 그림이 없으면 예전 이모지 */
const SP_PIC = { adventure: 'stone_adventure', treasure: 'stone_treasure', big: 'pi_balloon' };
const spIcon = sp => v5Img(SP_PIC[sp], SP_ICON[sp], 'spi');
const WORLD_ITEM = { 1: 'item_bandi_hat', 2: 'item_beret', 3: 'item_stripe_vest', 4: 'item_apron', 5: 'item_beret', 6: 'item_apron' };
/* 11/07: 앞날 돌에 자물쇠 그림(stone_soon)을 쓰지 않음 — 아이 화면 '자물쇠 없음' 원칙. 앞날은 오늘 돌 그림을 흐리게(CSS .nx) */
const stoneArt = (ns, sp) => sp ? '<span class="fl">' + spIcon(sp) + '</span>' : v5Img(ns === 'past' ? 'stone_done' : 'stone_today', '', ns === 'past' || ns === 'today' ? 'sti' : 'sti nx') || null;
function showHome() {
  run = null; DR = null; pruneMs();
  const [id, s] = screen('home'); const st = todayState();
  const wrap = el('div', 'mapwrap'), M = el('div', 'map'), L = nodeLayout(); M.style.height = L.h + 'px';
  const sea = seasonNow(); if (sea) M.classList.add('season');
  if (v5Has('map_bg_day')) { M.style.backgroundImage = 'url(' + V5PIC('map_bg_day') + ')'; M.classList.add('bgday'); }
  // 세계 띠(배경은 CSS .w1~.w6, 나중에 그림으로 바꾸기 쉬움)
  WORLDS.forEach(w => {
    const ns = L.nodes.filter(n => n.stage === w.n), y0 = ns[0].y - BAN_H + 10, y1 = ns[ns.length - 1].y + ROW_H - 10;
    const band = el('div', 'world w' + w.n + (ns[0].dn > READY_DAYS ? ' later' : ''));
    band.style.top = (y0 - 14) + 'px'; band.style.height = (y1 - y0 + 24) + 'px';
    /* 11/06: 세계 그림(map_w2~6 등)이 목록에만 있고 파일이 아직 없으면 CSS 색 띠(.w1~.w6)를 그대로 둠. 그림을 먼저 받아 본 뒤 성공할 때만 바꿈(깨진 배경 없음) */
    if (ARTX('map_w' + w.n)) { const src = 'assets/pic/map_w' + w.n + '.webp', im = new Image(); im.onload = () => { band.style.backgroundImage = 'url(' + src + ')'; band.style.backgroundSize = 'cover'; }; im.src = src; }
    band.innerHTML = '<div class="wban"><span class="wn">' + w.name + '</span>' + (ns[0].dn > READY_DAYS ? '<span class="soonTag">곧 열려요</span>' : '') +
      (w.n === 1 && (S.town.buildings || S.town.props) ? '<span class="town">' + TOWN_BUILDINGS.slice(0, S.town.buildings).map((e, k) => artImg('town_b' + (k + 1), e, 'tw')).join('') + TOWN_PROPS.slice(0, S.town.props).map((e, k) => artImg('town_p' + (k + 1), e, 'tw')).join('') + '</span>' : '') + '</div>' +
      ((WORLD_LM[w.n] || []).every(v5Has) ? WORLD_LM[w.n].map((d, k) => '<i class="deco lm" style="left:' + [4, 74, 40][k] + '%;top:' + (60 + k * Math.max(90, Math.floor((y1 - y0 - 160) / 3))) + 'px">' + v5Img(d) + '</i>').join('')   // 11/06 v5 랜드마크 그림
        : w.deco.map((d, k) => '<i class="deco" style="left:' + (6 + (k * 29) % 88) + '%;top:' + (40 + (k * 137) % Math.max(60, y1 - y0 - 40)) + 'px">' + d + '</i>').join(''));
    M.append(band);
  });
  // 길(SVG)
  const svg = '<svg class="path" viewBox="0 0 100 ' + L.h + '" preserveAspectRatio="none"><polyline vector-effect="non-scaling-stroke" points="' + L.nodes.map(n => n.x + ',' + (n.y + 30)).join(' ') + '"/></svg>';
  M.insertAdjacentHTML('beforeend', svg);
  // 단원 이름표
  UNITS.forEach((u, r) => { const n0 = L.nodes[r * 5]; const t = el('div', 'utag' + (r % 2 ? ' r' : ''), u.place); t.style.top = (n0.y + 66) + 'px'; M.append(t); });
  let todayEl = null;
  L.nodes.forEach(n => {
    const d = DAYS[n.dn - 1], ns = nodeState(n.dn), b = el('button', 'stone ' + ns + (d.special ? ' sp sp-' + d.special : ''));
    b.style.left = n.x + '%'; b.style.top = n.y + 'px'; b.dataset.day = n.dn;
    const dn = S.done[n.dn];
    const sa = stoneArt(ns, d.special);   // 11/06 v5: 돌 그림(지난·오늘·앞날·특별한 날)
    if (sa) b.classList.add('pic');
    b.innerHTML = ns === 'past' ? (dn && dn.sticker ? stkImg(dn.sticker) : sa || '<span class="fl">' + (d.special ? SP_ICON[d.special] : '✿') + '</span>')
      : ns === 'today' ? (sa || '<span class="fl">' + (d.special ? SP_ICON[d.special] : '★') + '</span>')
      : sa ? sa : '<span class="fl">' + (d.special ? SP_ICON[d.special] : '') + '</span><span class="cloud">☁️</span>';
    b.setAttribute('aria-label', ns === 'today' ? '오늘의 놀이 ' + n.dn + '일' : ns === 'past' ? '지난 날 다시 하기 ' + n.dn + '일' : ns === 'tomorrow' ? '다음에 놀 칸' : ns === 'soon' ? '곧 열려요' : '앞날 놀이');
    b.addEventListener('click', () => {
      if (ns === 'today') return startDay(S.cur, S.pendingExtra ? 'extra' : 'today');
      if (ns === 'past' && n.dn <= READY_DAYS) return startDay(n.dn, 'replay');
      if (ns === 'tomorrow' && canPlayMore()) return playMore();
      if (ns === 'tomorrow' && canReplayMore()) { setChar('laugh'); bounce(); setBubble('내일 또 새 놀이가 기다려!'); return say('ui4_newtmr'); }
      setChar('laugh'); bounce(); setBubble(ns === 'soon' ? '이 길은 곧 열려요!' : '내일 만나요!'); ding(0.8);
    });
    M.append(b); if (n.dn === Math.min(S.cur, 170)) todayEl = b;
  });
  // 11/04 길 방향: 돌 사이 화살표(지난 길은 흐리게, 앞길은 진하게), 출발·도착 깃발, '다음' 표시, 몽글이가 갈 쪽 화살표
  const nextDn = st === 'done' || st === 'soon' || st === 'all' ? S.cur : S.cur + 1, here = Math.min(S.cur, 170);
  const arrows = [];
  for (let k = 0; k < L.nodes.length - 1; k++) { const a = L.nodes[k], b2 = L.nodes[k + 1]; const ar = el('i', 'parrow' + (b2.dn <= here ? ' gone' : b2.dn > READY_DAYS ? ' later' : b2.dn <= here + 3 ? ' near' : '')); ar.textContent = '➜'; ar.style.left = ((a.x + b2.x) / 2) + '%'; ar.style.top = ((a.y + b2.y) / 2 + 30) + 'px'; arrows.push([ar, a, b2]); M.append(ar); }
  const tagAt = (n, cls, txt, side) => { const t = el('div', 'ntag ' + cls + (side ? ' side' : ''), txt); t.style.left = side ? 'calc(' + n.x + '% + 62px)' : n.x + '%'; t.style.top = (side ? n.y - 52 : n.y - 30) + 'px'; M.append(t); };
  tagAt(L.nodes[0], 'start', v5Img('stone_adventure', '🚩', 'tagi') + ' 출발', 1); tagAt(L.nodes[169], 'goal', v5Img('stone_treasure', '🏁', 'tagi') + ' 도착');
  if (nextDn <= 170 && nextDn !== 1) { const nn = L.nodes[nextDn - 1], t = el('div', 'ntag next below', '다음'); t.style.left = nn.x + '%'; t.style.top = (nn.y + (nextDn === S.cur ? 84 : 70)) + 'px'; M.append(t); }
  const fixArrows = () => { const W = M.clientWidth; if (!W) return; arrows.forEach(([ar, a, b2]) => { ar.style.transform = 'translate(-50%,-50%) rotate(' + (Math.atan2((b2.y - a.y), (b2.x - a.x) * W / 100) * 180 / Math.PI).toFixed(1) + 'deg)'; }); };
  // 몽글이(오늘 돌 위)
  const me = L.nodes[Math.min(S.cur, 170) - 1], mgEl = el('div', 'mapme', '<img alt="몽글이" src="' + CHAR_DIR + (st === 'done' ? 'sleep' : 'wave') + CHAR_EXT + '"><span class="acc">' + v5Img(WORLD_ITEM[DAYS[me.dn - 1].stage], WORLDS[DAYS[me.dn - 1].stage - 1].acc, 'acci') + '</span>');
  const wf = showHome.walkFrom && L.nodes[showHome.walkFrom - 1]; showHome.walkFrom = 0;
  mgEl.style.left = (wf || me).x + '%'; mgEl.style.top = ((wf || me).y - 64) + 'px'; M.append(mgEl);
  if (wf && wf !== me) requestAnimationFrame(() => requestAnimationFrame(() => { mgEl.classList.add('walk'); mgEl.style.left = me.x + '%'; mgEl.style.top = (me.y - 64) + 'px';
    if (v5Has('mong_walk_1') && !prefersReduce()) { const im = mgEl.querySelector('img'), fin = im.src; let f = 0; const iv = setInterval(() => { if (!alive(id) || f >= 9) { clearInterval(iv); im.src = fin; return; } im.src = V5PIC('mong_walk_' + (1 + f++ % 3)); }, 110); } }));   // 11/06 v5 걷기 3컷
  const nextStone = (st === 'new' || st === 'going' || canPlayMore()) && todayEl && +todayEl.dataset.day === S.cur ? todayEl : null;
  if (nextStone) { const c = nextStone.querySelector('.cloud'); if (c && canPlayMore()) c.remove(); tapHint(nextStone, wf ? 1800 : 2500); if (wf) setTimeout(() => { if (alive(id)) { ding(1.2); say('ui4_tapnext'); setBubble('여기 눌러 볼까?'); } }, 1500); }
  if (window.HP) HP.mapHint = { next: nextStone ? +nextStone.dataset.day : 0, walked: !!wf };
  const toN = L.nodes[Math.min(me.dn, 169)], hd = el('i', 'mghead', '➜'); hd.style.left = me.x + '%'; hd.style.top = (me.y - 20) + 'px'; M.append(hd);
  const fixHead = () => { const W = M.clientWidth; if (!W || toN === me) { hd.hidden = true; return; } const ang = Math.atan2(toN.y - me.y, (toN.x - me.x) * W / 100); hd.style.transform = 'translate(-50%,-50%) translate(' + (Math.cos(ang) * 58).toFixed(0) + 'px,' + (Math.sin(ang) * 58).toFixed(0) + 'px) rotate(' + (ang * 180 / Math.PI).toFixed(1) + 'deg)'; };
  if (sea) M.insertAdjacentHTML('beforeend', '<div class="seaTag">' + sea[1] + '</div>');
  wrap.append(M);
  // 위 인사 + 아래 단추
  const head = guide(st === 'done' ? 'sleep' : 'wave', st === 'done' ? '오늘은 여기까지. 내일 또 하자.' : st === 'soon' || st === 'all' ? '다음 길은 곧 열려요!' : (isBday() ? '안녕! 생일 축하해!' : '안녕! 반가워.') + '<small>' + DAYS[Math.min(S.cur, 170) - 1].fun + '</small>');
  head.classList.add('maphead');
  { const fr = ['donggeul_hello', 'jjiuk_hello'][S.cur % 2]; if (v5Has(fr)) head.insertAdjacentHTML('beforeend', v5Img(fr, '', 'friend')); }   // 11/06 v5 친구 작은 등장(이야기·꾸미기 시스템 없음)
  const dock = el('div', 'dock mapdock');
  if (st === 'new' || st === 'going') { const b = el('button', 'kid-btn next todaygo', '<img alt="" src="' + ICON('play') + '" style="filter:brightness(10)">오늘의 놀이'); b.id = 'todayBtn'; b.setAttribute('aria-label', '오늘의 놀이 시작'); b.addEventListener('click', () => startDay(S.pendingExtra && st === 'new' ? S.cur : (S.session.mode === 'extra' && st === 'going' ? S.cur : S.cur), S.pendingExtra || (st === 'going' && S.session.mode === 'extra') ? 'extra' : 'today')); dock.append(b); }
  else if (canPlayMore() || canReplayMore()) { const b = el('button', 'kid-btn next todaygo', '<span class="dexic" aria-hidden="true"><img alt="" src="' + ICON('play-ink') + '"></span>더 놀까?'); b.id = 'moreBtn'; b.setAttribute('aria-label', '더 놀까'); b.addEventListener('click', playMore); dock.append(b); }
  else { const b = el('button', 'kid-btn lav', '<img alt="" src="' + ICON('moon') + '">내일 또 만나!'); b.id = 'tomorrowBtn'; b.addEventListener('click', () => { setChar('sleep'); say('ui4_bye'); }); dock.append(b); }
  const pb = el('button', 'kid-btn', '<span class="dexic" aria-hidden="true"><img alt="" src="' + ICON('slide') + '"></span>놀이터'); pb.id = 'playBtn'; pb.setAttribute('aria-label', '놀이터'); pb.addEventListener('click', showPlayground);
  const db = el('button', 'kid-btn', '<span class="dexic" aria-hidden="true"><img alt="" src="' + ICON('letters') + '"></span>글자 친구'); db.id = 'dexBtn'; db.setAttribute('aria-label', '글자 친구'); db.addEventListener('click', showDex);
  const sb = el('button', 'kid-btn', '<span class="dexic" aria-hidden="true"><img alt="" src="' + ICON('sticker') + '"></span>스티커'); sb.id = 'bookBtn'; sb.setAttribute('aria-label', '스티커 책'); sb.addEventListener('click', showBook);
  const kb = el('button', 'kid-btn', '<span class="dexic" aria-hidden="true"><img alt="" src="' + ICON('books') + '"></span>책장'); kb.id = 'shelfBtn'; kb.setAttribute('aria-label', '책장'); kb.addEventListener('click', showShelf);
  const row2 = el('div', 'dock2'); row2.append(pb, db, sb, kb);
  s.append(head, wrap, dock, row2);
  if (S.migratedFrom && !S.start) s.insertBefore(el('div', 'pnote', '보호자께: v3 기록을 옮겼어요. 어른 메뉴 → 시작 날에서 6일(ㅣㅏ)이나 11일(ㅗㅜ)부터 시작하는 걸 추천해요.'), wrap);
  requestAnimationFrame(() => { fixArrows(); fixHead(); }); watchSize(M, () => { fixArrows(); fixHead(); });
  requestAnimationFrame(() => { if (todayEl && alive(id)) wrap.scrollTop = Math.max(0, todayEl.offsetTop - wrap.clientHeight / 2); });
  if (!showHome.greeted) { showHome.greeted = true; if (!wf) say(st === 'done' ? 'ui4_bye' : 'ui_hiname'); }
  if (typeof swApply === 'function') setTimeout(() => { if (alive(id)) swApply(); }, 1500);   // 11/07 대기 중인 새 버전은 지도에서만
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
  const steps = el('div', 'steps', P.segs.map((g, k) => '<span class="' + (k < DR.segIdx ? 'on' : k === DR.segIdx ? 'now' : '') + '">' + playIcon(g.type) + '</span>').join(''));
  s.append(guide('wave', DR.segIdx ? '이어서 놀자!' : (d.special === 'big' ? '오늘은 잔치 날이야!' : d.special ? '오늘은 특별한 날!' : '오늘 뭐 할까?')), sc, steps);
  const dock = el('div', 'dock'), go = el('button', 'kid-btn next', '출발!<img alt="" src="' + ICON('arrow') + '">'); go.id = 'goBtn';
  let went = false; go.addEventListener('click', () => { if (went || !alive(id)) return; went = true; ding(1.2); runSeg(DR.segIdx); }); dock.append(go);   // 11/07: 두 번 톡 막기 + 누름 소리 s.append(dock); tapHint(go, 2200);
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
  const c = el('div', 'segcard', '<span class="emo">' + playIcon(seg.type) + '</span><b>' + seg.kid + '</b>');
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
  DR.lastType = r.p.type; DR.lastMiss = r.first > r.ok;   // 11/06 과정 칭찬용(방금 한 놀이·한 번이라도 다시 했는지)
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
const STK_ALL = STICKER_IDS.concat((V5.stickers || []).map(x => 'v:' + x), PIC_STK.map(w => 'p:' + w));   // 11/06 v5 피자 스티커 24장(stn_*) 추가
const stkSrc = id => typeof id === 'string' && id.startsWith('p:') ? PIC(id.slice(2)) : typeof id === 'string' && id.startsWith('v:') ? V5PIC(id.slice(2)) : STICKER(id);
const stkImg = (id, cls = '') => '<img class="stki' + (typeof id === 'string' && id.startsWith('p:') ? ' pstk' : '') + (cls ? ' ' + cls : '') + '" alt="스티커" src="' + stkSrc(id) + '">';
function giveSticker(dr) {   // 아직 없는 스티커 중에서 무작위(다 모았으면 아무거나)
  const have = new Set(S.stickers.map(String)), fresh = STK_ALL.filter(x => !have.has(String(x)));
  const pool = fresh.length ? fresh : STK_ALL, st = pool[Math.floor(Math.random() * pool.length)];
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
  (async () => { ding(); sparkAt(card); surprise(s, true); await wait(300); if (!alive(id)) return; await say(['ui_sticker', praiseKey()]); if (alive(id)) setTimeout(go, 1800); })();
}
/* 11/06 과정 칭찬(결과·점수 말고 한 일): 놀이 종류별 + 다시 해 본 경우 */
const PROC_BY = { chant: [10], sort: [9], body: [8, 14], block: [6, 4], merge: [6], balloon: [15, 5], hidden: [12], story: [13], stickerstory: [13, 17], trace: [2, 11], copy: [2, 11], listen: [18, 17], readword: [18, 3], name: [3, 18], clap: [5], same: [5, 17], pick: [5], map: [11], cloud: [12], yesterday: [17] };
function procKey(t, miss) {   // 11/06 §19: 같은 놀이 칭찬 후보 중 소리 파일이 있는 줄을 먼저(없으면 글자만 보이고 소리는 기본 칭찬)
  const pool = (miss ? [16, 7, 11] : (PROC_BY[t] || [1, 5, 11])).map(n => 'ui4_proc' + n).filter(k => LINES[k]);
  const voiced = pool.filter(hasVoice), use = voiced.length ? voiced : pool;
  return use.length ? use[rand(use.length)] : 'ui_good1';
}
function showStep() {   // 칸 사이: 길 위 몽글이가 한 칸 앞으로(짧게)
  const P = DR.plan, [id, s] = screen('step', { home: true });
  const steps = el('div', 'steps lg', P.segs.map((g, k) => '<span class="' + (k < DR.segIdx ? 'on' : k === DR.segIdx ? 'now' : '') + '">' + playIcon(g.type) + '</span>').join(''));
  const pk0 = procKey(DR.lastType, DR.lastMiss), pk = hasVoice(pk0) ? pk0 : praiseKey();   // 11/06 과정 칭찬. 11/07: 소리 파일이 없으면 말풍선도 실제로 들리는 칭찬과 같게(글·소리 어긋남 버그)
  s.append(guide(rand(2) ? 'laugh' : 'clap', (LINES[pk] || '잘했어!') + '<small>다음 놀이로 가 볼까?</small>'), steps);
  { const fr = ['donggeul_happy', 'jjiuk_happy'][DR.segIdx % 2]; if (v5Has(fr)) s.querySelector('.guide').insertAdjacentHTML('beforeend', v5Img(fr, '', 'friend')); }
  const dock = el('div', 'dock'), go = el('button', 'kid-btn next', '다음<img alt="" src="' + ICON('arrow') + '">'); go.id = 'stepNext'; dock.append(go); s.append(dock);
  // 11/04: 몽글이가 지난 칸에서 다음 칸으로 걸어가고, 다음 칸·'다음' 단추가 반짝 + 손가락
  const sp = [...steps.children], from = sp[Math.max(0, DR.segIdx - 1)], to = sp[DR.segIdx], walker = mg('wave', 'stepme');
  if (from && to) { steps.append(walker); const at = n => { walker.style.left = (n.offsetLeft + n.offsetWidth / 2) + 'px'; }; requestAnimationFrame(() => { at(from); requestAnimationFrame(() => requestAnimationFrame(() => { walker.classList.add('go'); at(to); })); }); to.classList.add('gonext'); }
  tapHint(go, 1200);
  let went = false; const adv = () => { if (went || !alive(id)) return; went = true; clearTimeout(t); runSeg(DR.segIdx); };   // 11/07: 두 번 톡(아이 손 머묾) 막기
  const t = setTimeout(adv, 4500);
  go.addEventListener('click', adv);
  ding(1.2); say(pk);
  if (window.HP) HP.solve = async () => adv();
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
  if (!timeUp()) { const p = el('button', 'kid-btn', '<span class="dexic" aria-hidden="true"><img alt="" src="' + ICON('slide') + '"></span>놀이터'); p.id = 'endPlay'; p.addEventListener('click', showPlayground); dock.append(p); }
  s.append(hero, paper, dock);
  let moreB = null;
  if (canPlayMore() || canReplayMore()) { moreB = el('button', 'kid-btn next moreBtn', '<span class="dexic" aria-hidden="true"><img alt="" src="' + ICON('play-ink') + '"></span>더 놀까?'); moreB.id = 'endMore'; moreB.addEventListener('click', playMore); s.insertBefore(el('div', 'dock moredock'), dock).append(moreB); }
  tapHint(moreB || b, 2600);
  if (mode !== 'replay' && S.cur > P.day) showHome.walkFrom = P.day;
  (async () => { if (sticker) { sparkPop(); ding(); await say('ui_book'); } if (grew && alive(id)) await say('ui4_town'); if (alive(id)) await say(mode === 'replay' ? 'ui_good1' : 'ui4_bye'); if (alive(id) && !timeUp() && mode !== 'replay') say('ui4_free'); })();
  if (window.HP) HP.solve = null;
  DR = null;
}

/* ---------- 놀이터(자유 놀이): 해 본 놀이만, 배운 것만, 하루 타이머 안에서만 ---------- */
function showPlayground() {
  if (timeUp()) { const [, s] = screen('timeup', { night: true, home: true }); const rs = el('div', 'rest', '<img class="moonbig" alt="" src="' + ICON('moon') + '">'); s.append(rs, guide('sleep', '오늘 놀 시간이 다 됐어. 우리 내일 또 만나!')); const dk = el('div', 'dock'), hb = el('button', 'kid-btn lav', '<img alt="" src="' + ICON('moon') + '">지도로'); hb.id = 'timeupMap'; hb.addEventListener('click', showHome); dk.append(hb); s.append(dk); say('ui4_timeup'); return; }   // 11/07: 끝 화면에도 큰 단추 하나
  const [, s] = screen('playground', { home: true, scroll: true });
  const types = S.played.filter(t => IMPL.includes(t) && !SPECIAL_ONLY.includes(t) && t !== 'yesterday' && t !== 'pick3');
  s.append(guide('wave', types.length ? '하고 싶은 놀이를 골라 봐!' : '오늘의 놀이를 하면 놀이터에 친구가 생겨!'));
  const g = el('div', 'pgrid');
  types.forEach(t => { const b = el('button', 'pcard3', '<span class="emo">' + playIcon(t) + '</span><b>' + CURR.plays[t].kid + '</b>'); b.dataset.t = t; b.addEventListener('click', () => playFree(t)); g.append(b); });
  s.append(g); ticking = false;
  if (!types.length) { const dock = el('div', 'dock'), b = el('button', 'kid-btn next', '<img alt="" src="' + ICON('play') + '" style="filter:brightness(10)">지도로 가기'); b.id = 'pgGo'; b.addEventListener('click', () => { ding(1.2); showHome(); }); dock.append(b); s.append(el('div', 'emptyart', ['chant', 'balloon', 'trace'].map(t => '<span>' + playIcon(t) + '</span>').join('')), dock); tapHint(b, 1600); }   // 11/07 빈 화면 안내: 할 일 하나를 크게
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
    const c = el('button', 'dx' + (on ? ' on' : ''), on ? (e ? (hasPic(e.lp) ? picHTML(e.lp, e.word) : exPic(j)) : '') + '<span class="g">' + j + '</span><span class="n">' + (JNAME[j] || '') + (star ? ' ★' : '') + '</span>' : '<span class="g">' + j + '</span><span class="n"></span>');   // 11/07: 아직 안 만난 글자는 흐린 글자만('?' 벽 없음)
    c.dataset.j = j; if (!on) c.setAttribute('aria-label', '아직 안 만난 글자'); c.addEventListener('click', () => { c.classList.remove('wig'); void c.offsetWidth; c.classList.add('wig'); if (on && hasA(VOICE.jamo(j))) say(VOICE.jamo(j)); else ding(0.9); }); g.append(c);   // 11/07: 누르면 꼭 반응(소리·흔들)
  });
  s.append(g);
}
function showBook() {   // 11/06: 가진 스티커만 크게 + 다음에 받을 칸 하나만 점선으로 예고('?'·그림자 벽 없음, 숫자 없음)
  const [, s] = screen('bookscr', { scroll: true, home: true });
  const have = new Set(S.stickers.map(String)), n = have.size;
  s.append(guide(n ? 'laugh' : 'basic', n ? '내가 모은 스티커야! 톡 눌러 봐.' : '놀이를 하나 끝내면 스티커가 와!'));
  const book = el('div', 'book stkbook mine');
  const order = [...new Set(S.stickers.map(String))].map(x => isNaN(+x) ? x : +x);   // 받은 순서 그대로(옛 스티커 포함)
  const last = S.stickers.length ? String(S.stickers[S.stickers.length - 1]) : '';
  order.forEach(id => { const c = el('div', 'slot on' + (String(id) === last ? ' last' : ''), stkImg(id)); c.dataset.id = String(id); c.addEventListener('click', () => { c.classList.remove('wig'); void c.offsetWidth; c.classList.add('wig'); ding(1.2); if (typeof id === 'string' && id.startsWith('p:') && WORDS[id.slice(2)] && hasA(VOICE.word(id.slice(2)))) say(VOICE.word(id.slice(2))); }); book.append(c); });
  if (STK_ALL.some(x => !have.has(String(x)))) book.append(el('div', 'slot nextslot', '<img alt="" src="' + ICON('sticker') + '"><b>다음 스티커</b>'));
  s.append(book); say('ui_book');
  if (window.HP) HP.book = { total: STK_ALL.length, have: n, shown: book.querySelectorAll('.slot.on').length, next: !!book.querySelector('.nextslot') };
}
function showShelf() {   // 11/06: 다 본 책만 + 다음 책 한 권만 점선 예고('?' 칸 벽 없음)
  const [, s] = screen('shelf', { scroll: true, home: true });
  s.append(guide('point', S.books.length ? '다 본 이야기책이야. 골라 볼까?' : '이야기를 끝까지 보면 책이 꽂혀!'));
  const g = el('div', 'shelf mine');
  UNITS.filter(u => S.books.includes(u.n)).forEach(u => { const b = el('button', 'bk u' + (u.n % 6) + ' on', v5Img('pi_story', '', 'bki') + '<b>' + u.title + '</b>'); b.addEventListener('click', () => readBook(u.n)); g.append(b); });
  const nx = UNITS.find(u => !S.books.includes(u.n) && (u.n - 1) * 5 + 1 <= READY_DAYS);
  if (nx) g.append(el('div', 'bk nextbk', '<img alt="" src="' + ICON('sprout') + '"><b>다음 책</b>'));
  s.append(g);
}
function readBook(n) {
  const dn = (n - 1) * 5 + 5, ctx = ctxOf(Math.min(dn, 170)), seg = segOf('story', 'Z');
  DR = { dn, mode: 'replay', play: true, plan: Object.assign({}, DAYS[dn - 1], { segs: [seg] }), segIdx: 0 };
  const items = [1, 2, 3, 4].map(k => ({ u: n, k }));
  run = { p: { kind: 'story', type: 'story', items }, queue: items, i: 0, ok: 0, first: 0, ctx, segIdx: 0, seg, z: true };
  nextItem();
}

/* 11/07 생일(어른 메뉴에서 넣던 값이 어디에도 안 쓰이던 것): 형식 맞추기 + 생일 날 지도 인사에 한 줄(소리 파일 없음 → 글만) */
function normBday(t) { const d = String(t || '').replace(/[^0-9]/g, ''); if (d.length < 3 || d.length > 4) return ''; const m = +d.slice(0, d.length - 2), dd = +d.slice(-2); return m >= 1 && m <= 12 && dd >= 1 && dd <= 31 ? pad2(m) + '-' + pad2(dd) : ''; }
const isBday = () => !!S.settings.birthday && S.settings.birthday === today().slice(5);
/* ---------- 어른 메뉴(7장) ---------- */
/* §19 UX2 11/06 대표님 결정: 아이 화면은 확대·축소 막음(index.html 기본값 그대로). 어른 확인을 통과해 어른 메뉴가 열린 동안만 확대 허용, 닫으면 복구 */
const VP_KID = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
const VP_ADULT = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover';
function setAdultZoom(on) { const m = document.querySelector('meta[name="viewport"]'); if (m) m.setAttribute('content', on ? VP_ADULT : VP_KID); document.documentElement.classList.toggle('adult-zoom', !!on); if (window.HP) HP.zoom = !!on; }
function openParent() {
  stopAudio(); ticking = false; setAdultZoom(true);
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
  PM.innerHTML = '<div class="pm" role="dialog" aria-label="어른 메뉴"><div class="head"><h1>어른 메뉴</h1><button class="x" id="pmClose"><img alt="닫기" src="' + ICON('close') + '"></button></div>' + '<div class="zoomnote">메뉴를 연 동안만 화면을 확대할 수 있어요</div>' +
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
    '<div class="r"><div class="l">려원이 생일<small>생일 날 지도 인사가 바뀌어요 · 예: 08-01</small></div><input type="text" id="bday" placeholder="08-01" value="' + (S.settings.birthday || '') + '" maxlength="5"></div>' +
    '<div class="r"><div class="l">진도 내보내기 · 가져오기<small>파일로만 · 인터넷 안 써요</small></div><button class="mini" id="pmExport">내보내기</button><label class="mini">가져오기<input type="file" id="pmImport" accept="application/json" hidden></label></div>' +
    '</div><div class="cap">이 놀이는 무엇을 기르나요</div><div class="sec"><button class="r" id="rGoals"><div class="l">놀이 ' + Object.keys(CURR.plays).length + '개의 숨은 목표</div></button><div class="more" id="mGoals" hidden><ul>' +
    Object.entries(CURR.plays).map(([k, v]) => '<li><b>' + v.kid + '</b> — ' + v.goal + (IMPL.includes(k) ? '' : ' <span class="muted">(곧)</span>') + '</li>').join('') + '</ul></div></div>' +
    '<div class="cap">아이폰에 홈 화면으로 넣기</div><div class="sec"><div class="help-card" role="note"><b>홈 화면에 추가</b>사파리에서 이 페이지를 연 뒤<br><ol><li>아래 공유 단추(□↑)를 눌러요</li><li>「홈 화면에 추가」를 골라요</li><li>이름 확인 후 추가하면 앱처럼 열려요</li></ol>안드로이드는 크롬 메뉴 → 「홈 화면에 추가」예요.</div></div>' +
    '<div class="cap">개인정보</div><div class="sec"><div class="privacy" role="note"><b>개인정보 없음</b>광고·로그인·회원 가입이 없어요. 기록은 이 기기에만 저장되고, 인터넷으로 보내지 않아요. 알림·추적·분석도 쓰지 않아요.</div></div>' +
    '<div class="acts"><button class="warn" id="pmReset">처음부터 다시</button></div>' +
    '<div class="foot">기록은 이 기기에만 저장돼요 · 광고·로그인·수집 없음 · 알림·연속 기록 없음<br>v4 1부: 1~55일(1·2단계)까지 열려 있어요. 56일부터는 그림·음성이 준비되면 열려요.</div></div>';
  PM.querySelectorAll('.seg[data-n]').forEach(sg => sg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const v = b.dataset.v; S.settings[sg.dataset.n] = isNaN(+v) ? v : +v; save();
    sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); drawTime();
  }));
  $('#pmStart').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b || b.disabled) return; setStartDay(+b.dataset.v); openParent(); });
  $('#pmOneMore').addEventListener('click', () => { if (S.oneMoreDate === today()) return; S.oneMoreDate = today(); S.lastNewDate = ''; if (S.session.date === today()) S.session.finished = true; save(); closeParent(); });
  $('#tgSound').addEventListener('click', e => { S.settings.sound = !S.settings.sound; e.currentTarget.classList.toggle('on', S.settings.sound); save(); if (typeof syncSoftMuteChip === 'function') syncSoftMuteChip(); if (S.settings.sound && typeof unlockAudio === 'function') unlockAudio(); });
  $('#vol').addEventListener('input', e => { S.settings.volume = +e.target.value; save(); });
  $('#bday').addEventListener('change', e => { const v = normBday(e.target.value); S.settings.birthday = v || ''; e.target.value = v || ''; if (e.target.value.trim() && !v) e.target.placeholder = '예: 08-01'; save(); });   // 11/07: 0801·8/1·8.1도 08-01로
  $('#pmExport').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = 'hangul-play-v4-' + today() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  $('#pmImport').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const o = JSON.parse(rd.result); if (o && o.v === 4) { localStorage.setItem(KEY, JSON.stringify(o)); load(); closeParent(); return; } } catch (er) { /* 잘못된 파일 */ } impMsg('이 파일은 한글 놀이 v4 진도 파일이 아니에요. 내보내기로 만든 .json 파일을 골라 주세요.'); }; rd.onerror = () => impMsg('파일을 읽지 못했어요. 다시 골라 주세요.'); rd.readAsText(f); e.target.value = ''; });
  const impMsg = t => { let m = $('#pmImpMsg'); if (!m) { m = el('div', 'impmsg'); m.id = 'pmImpMsg'; m.setAttribute('role', 'alert'); $('#pmExport').closest('.r').after(m); } m.textContent = t; };   // 11/07: 잘못된 파일이면 조용히 무시하지 않고 안내
  $('#rGoals').addEventListener('click', () => { const m = $('#mGoals'); m.hidden = !m.hidden; });
  if ($('#pmSkip')) $('#pmSkip').addEventListener('click', () => { const u = DAYS[Math.min(S.cur, 170) - 1].unit; setStartDay(u * 5 + 1, true); S.suggestSkip = false; save(); openParent(); });
  let armed = false;
  $('#pmReset').addEventListener('click', e => { if (!armed) { armed = true; e.currentTarget.textContent = '정말 처음부터? 한 번 더 누르세요'; return; } const keep = S.settings; S = fresh4(); S.settings = keep; save(); closeParent(); });
  $('#pmClose').addEventListener('click', closeParent);
}
function closeParent() { setAdultZoom(false); const PM = $('#parent'); PM.hidden = true; PM.innerHTML = ''; run = null; DR = null; showHome(); }
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
window.HP = { get S() { return S; }, get run() { return run; }, get DR() { return DR; }, setOffset: n => { DAY_OFFSET = n; }, get offset() { return DAY_OFFSET; }, today, planFor, checkDay, ctxOf, QB, DAYS, UNITS, startDay, showHome, setStartDay, openParent, openGate, showPlayground, showDex, showBook, showShelf, showStickerPop: (st, next) => showStickerPop(st != null ? st : (S.stickers[S.stickers.length - 1] || 1), next || showHome), showDayIntro, todayState, limitMs, usedMs, timeUp, save, load: () => { load(); }, errs: [], audioLog: [], audioErr: [], screen: '', round: null, trace: null, solve: null, hidden: null, pw: null, sticker: null, book: null,
  testRound: (type, item, ctxDay) => { const ctx = ctxOf(ctxDay || 21), seg = segOf(type, 'A'), items = item != null ? [item] : QB[type](ctx, seg.n); DR = { dn: ctx.dn, mode: 'replay', play: true, plan: Object.assign({}, DAYS[ctx.dn - 1], { segs: [seg] }), segIdx: 0 }; run = { p: segRunP(seg, ctx, items), queue: items, i: 0, ok: 0, first: 0, ctx, segIdx: 0, seg, z: true }; nextItem(); } };
if ('speechSynthesis' in window) speechSynthesis.getVoices();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { save(); stopAudio(); } });
/* 11/07 오프라인 업데이트(web.dev service-worker-lifecycle · learn/pwa/update): 새 버전은 대기 → 아이가 지도(홈)에 있고 어른 창이 닫혀 있을 때만 바꾸고 한 번 새로 고침.
   놀이 도중에 화면이 갑자기 바뀌지 않음. 앱으로 돌아올 때(visibilitychange) 업데이트 확인 */
let swReg = null, swReloadDue = false, swReloaded = false;
const swIdle = () => HP.screen === 'home' && $('#parent').hidden && $('#gate').hidden;
function swApply() {
  if (swReloadDue && swIdle() && !swReloaded) { swReloaded = true; location.reload(); return; }
  const w = swReg && swReg.waiting; if (w && navigator.serviceWorker.controller && swIdle()) w.postMessage({ type: 'SKIP_WAITING' });
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(r => { swReg = r; r.addEventListener('updatefound', () => { const nw = r.installing; if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed') swApply(); }); }); swApply(); }).catch(() => {});
  let hadCtl = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadCtl) { hadCtl = true; return; } swReloadDue = true; swApply(); });   // 첫 설치는 새로 고침 없음
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && swReg) { swReg.update().catch(() => {}); swApply(); } });
  /* §19: 홈에 오래 머물면 네비게이션이 없어 업데이트를 못 볼 수 있음 → 지도(홈)일 때만 가끔 확인(web.dev registration.update) */
  setInterval(() => { if (swReg && swIdle()) { swReg.update().catch(() => {}); swApply(); } }, 15 * 60 * 1000);
}
showHome();
