'use strict';
/* v6 app: screens, stage flow, rewards, sticker book, closet, parent menu, zoom guard, service worker. */
(function (G) {
  const D = G.D, A = G.A, UI = G.UI, St = G.St, P = G.P, Plan = G.Plan;
  const { el, btn, sleep, esc, $ } = UI;
  const App = { sess: 0, screen: '' };
  G.App = App;
  const main = () => $('#main');

  /* ---------- zoom guard: kids cannot zoom, adults can ---------- */
  const KID_VP = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  const ADULT_VP = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover';
  App.adult = false;
  function setAdult(on) {
    App.adult = on;
    $('meta[name=viewport]').setAttribute('content', on ? ADULT_VP : KID_VP);
    document.documentElement.classList.toggle('adult', on);
  }
  const block = e => { if (!App.adult) e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, block, { passive: false }));
  document.addEventListener('touchmove', e => {
    if (App.adult) return;
    if (e.touches.length > 1 || !e.target.closest('.scroll')) e.preventDefault();
  }, { passive: false });
  let lastEnd = 0;
  document.addEventListener('touchend', e => {
    if (App.adult) return;
    const n = Date.now();
    if (n - lastEnd < 320 && !e.target.closest('input,select,textarea')) e.preventDefault();
    lastEnd = n;
  }, { passive: false });
  document.addEventListener('dblclick', block, { passive: false });
  document.addEventListener('wheel', e => { if (!App.adult && e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', e => { if (!App.adult) e.preventDefault(); });

  /* ---------- HUD ---------- */
  function hud(opts) {
    const R = St.s.reward;
    const h = el('div', 'hud');
    if (opts && opts.home) h.appendChild(btn('hud-home', '🏠', () => App.home(), '처음으로'));
    const pct = Math.round(R.xp / St.levelNeed() * 100);
    h.appendChild(el('div', 'hud-lv', `<span class="crown">👑</span><b>${R.level}</b><i class="bar"><i style="width:${pct}%"></i></i>`));
    h.appendChild(el('div', 'hud-star', `⭐ <b id="starCount">${R.stars}</b>`));
    h.appendChild(el('div', 'hud-fire', `🔥 <b>${R.streak.count}</b>`));
    if (opts && opts.dots) h.appendChild(opts.dots);
    const lock = btn('hud-lock', '<span class="ring"></span>🔒', null, '어른 메뉴 (길게 누르기)');
    h.appendChild(lock);
    holdToOpen(lock);
    return h;
  }
  App.star = function (n) {
    const up = St.addStar(n || 1);
    if (up) App._levelUp = true;
    const s = $('#starCount');
    if (s) { s.textContent = St.s.reward.stars; s.parentElement.classList.remove('bump'); void s.offsetWidth; s.parentElement.classList.add('bump'); }
    const bar = $('.hud-lv .bar i');
    if (bar) bar.style.width = Math.round(St.s.reward.xp / St.levelNeed() * 100) + '%';
    const lv = $('.hud-lv b');
    if (lv) lv.textContent = St.s.reward.level;
    St.save();
  };

  /* ---------- splash ---------- */
  function splash() {
    const s = $('#splash');
    s.innerHTML = '';
    const inner = el('div', 'splash-in');
    inner.appendChild(el('div', 'splash-mascot', UI.mascot('joy')));
    inner.appendChild(el('h1', 'splash-title', '려원이 <span>한글 놀이</span>'));
    const go = btn('splash-go', '▶<span>시작</span>', async () => {
      A.init();
      A.setVolume(St.s.settings.voice, St.s.settings.sfx);
      if (G.Rec) G.Rec.loadAll();
      A.sfx('yay1');
      s.classList.add('out');
      setTimeout(() => s.remove(), 450);
      A.preload(Object.values(D.PRAISE_VOICE).map(p => p[1]).concat(['ui_hiname', 'ui_same']));
      await App.home(true);
    }, '시작');
    inner.appendChild(go);
    s.appendChild(inner);
  }

  /* ---------- home ---------- */
  function leave() { if (App._abort) { App._abort(); App._abort = null; } if (G.Rec) G.Rec.close(); }
  App.home = async function (first) {
    leave();
    App.sess++;
    A.stop();
    App.screen = 'home';
    if (App._reload) { location.reload(); return; }
    A.bgm(St.s.settings.bgm);
    const m = main();
    m.innerHTML = '';
    m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
    App._screenAt = performance.now();
    m.dataset.screen = 'home';
    m.appendChild(hud());
    const stage = St.stage();
    const world = D.WORLDS[stage.w];
    App.setWorld(stage.w);
    const wrap = el('div', 'home');
    wrap.appendChild(el('div', 'world-tag', `<span class="wt-ico">${world.icon}</span><b>${esc(world.name)}</b><small>${stage.id} / ${D.STAGES.length}</small>`));
    const road = el('div', 'road');
    UI.tap(road, e => {
      const me = e.target.closest('.road-me');
      if (!me) return;
      me.classList.remove('hop'); void me.getBoundingClientRect(); me.classList.add('hop');
      A.play('ui_hiname');
    });
    wrap.appendChild(road);
    const dock = el('div', 'dock');
    const cast = el('div', 'cast');
    const nextLock = D.FRIENDS.find(f => !St.hasFriend(f));
    const pals = D.FRIENDS.filter(f => f.id !== UI.friendId(St.s.reward.friend) && St.hasFriend(f)).slice(-3);
    if (nextLock) pals.push(nextLock);
    pals.forEach((f, i) => {
      const own = St.hasFriend(f);
      const c = btn('cast-pal' + (own ? '' : ' locked'), UI.mascot(own ? 'happy' : 'think', {}, f.id) + (own ? '' : `<i>Lv${f.lv}</i>`), () => {
        if (!own) { UI.oops(c); return; }
        c.classList.remove('jump'); void c.offsetWidth; c.classList.add('jump'); A.sfx('pop');
        UI.sayGem(f.id);
      }, f.name);
      c.style.animationDelay = (i * 0.35) + 's';
      cast.appendChild(c);
    });
    dock.appendChild(cast);
    const done = St.todayCount() >= St.s.settings.perDay;
    const play = btn('play-go' + (done ? ' rest' : ''), done
      ? '<span class="pg-ico">🎠</span><span class="pg-txt">놀이터</span><small>오늘 모험 끝! 더 놀자</small>'
      : `<span class="pg-ico"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 7 L34 20 L12 33Z" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></svg></span><span class="pg-txt">놀자!</span><small>${esc(stage.title)}</small>`,
    () => (done ? App.playground() : App.runStage(stage)), '놀자');
    dock.appendChild(play);
    const row = el('div', 'home-row');
    const newN = St.s.reward.newStickers.length;
    row.appendChild(btn('home-tile t-book', `<span>📒</span><b>스티커</b>${newN ? `<i class="badge">${newN}</i>` : ''}`, () => App.stickers(), '스티커북'));
    row.appendChild(btn('home-tile t-closet', '<span>👗</span><b>옷장</b>', () => App.closet(), '옷장'));
    row.appendChild(btn('home-tile t-park', '<span>🎠</span><b>놀이터</b>', () => App.playground(), '놀이터'));
    dock.appendChild(row);
    wrap.appendChild(dock);
    m.appendChild(wrap);
    const drawRoad = () => { const r = road.getBoundingClientRect(); road.innerHTML = roadSvg(stage, r.width, r.height); };
    drawRoad();
    App._drawRoad = drawRoad;
    if (first) {
      const d = St.checkDaily();
      if (d) { await dailyGift(d); if (App.screen === 'home') { await App.home(); } }
      if (!(St.s.reward.told || []).includes(stage.w) && App.screen === 'home') { await worldArrive(stage.w, true); }
      A.sequence(['ui_hiname', St.todayCount() >= St.s.settings.perDay ? 'ui4_free' : 'ui4_today'], null, 0.3);
    }
  };
  /* The adventure road: 7 stepping stones on a winding path; the buddy stands on today's stone. */
  /* The road is drawn to fit its box: wide boxes get a left-to-right road with as many stones as fit,
     tall boxes get a road climbing upwards. */
  function roadSvg(stage, bw, bh) {
    const a = bw && bh ? bw / bh : 2.6;
    const tall = a < 0.9;
    const n = tall ? 6 : Math.max(3, Math.min(7, Math.round((360 * a - 100) / 150)));
    const W = tall ? 600 : Math.max(560, 360 * a), H = tall ? 900 : 360;
    const step = tall ? 140 : (W - 160) / (n - 1);
    const from = Math.max(1, Math.min(stage.id - Math.floor((n - 1) / 3), D.STAGES.length - n + 1));
    const pts = [];
    for (let k = 0; k < n; k++) pts.push(tall ? [300 + Math.sin(k * 1.25 + 0.4) * 170, 830 - k * 140] : [80 + k * step, 240 + Math.sin(k * 1.15 + 0.6) * 55]);
    const start = tall ? [pts[0][0] - 40, H + 60] : [pts[0][0] - 90, pts[0][1] + 30];
    let d = `M${start[0]} ${start[1]}`;
    pts.forEach((p, k) => {
      const q = k ? pts[k - 1] : start;
      if (tall) { const my = (q[1] + p[1]) / 2; d += ` C${q[0]} ${my} ${p[0]} ${my} ${p[0]} ${p[1]}`; }
      else { const mx = (q[0] + p[0]) / 2; d += ` C${mx} ${q[1]} ${mx} ${p[1]} ${p[0]} ${p[1]}`; }
    });
    const last = pts[n - 1];
    d += tall ? ` C${last[0]} ${last[1] - 60} ${last[0] + 40} ${last[1] - 90} ${last[0] + 60} -40` : ` C${last[0] + 50} ${last[1]} ${last[0] + 60} ${last[1] - 20} ${W + 20} ${last[1] - 30}`;
    let stones = '', me = '', deco = '';
    const rx = tall ? 62 : 50, ry = tall ? 28 : 24;
    /* landmarks of each stone's world between the stones, alternating sides of the road */
    const emImg = (e, x, y, w) => `<image href="v6/img/e/${UI.emKey(e)}.svg" x="${x - w / 2}" y="${y - w / 2}" width="${w}" height="${w}" class="lm"/>`;
    const DECO = { 1: ['🌳', '🍄', '🌸'], 2: ['🌊', '🐚', '🐠'], 3: ['🏡', '🌳', '🐶'], 4: ['🎪', '🎈', '🎠'], 5: ['🌈', '⭐', '🦄'], 9: ['🌱', '🐼', '🌳'],
      6: ['💎', '🐻', '⭐'], 10: ['🎢', '🎡', '🎈'], 7: ['🎡', '🌳', '🎈'], 8: ['☁️', '🌙', '⭐'] };
    pts.forEach(([x, y], k) => {
      if (k === n - 1) return;
      const id = Math.min(D.STAGES.length, from + k), wd = D.STAGES[id - 1].w;
      const set = DECO[wd] || DECO[1], [x2, y2] = pts[k + 1];
      const side = k % 2 ? -1 : 1, mx = (x + x2) / 2, my = (y + y2) / 2;
      deco += tall ? emImg(set[k % set.length], mx + side * 150, my, 70) : emImg(set[k % set.length], mx + side * 18, my - (k % 2 ? 96 : 78), 58);
    });
    pts.forEach(([x, y], k) => {
      const id = from + k;
      if (id > D.STAGES.length) return;
      const st = St.s.learn.done[id] ? 'done' : (id === stage.id ? 'now' : 'soon');
      const ws = D.STAGES[id - 1].w, edge = id > 1 && D.STAGES[id - 2].w !== ws;
      if (edge) stones += `<g class="gate-sign" transform="translate(${x} ${y - (tall ? 60 : 52)})"><rect x="-46" y="-26" width="92" height="40" rx="14" fill="${D.WORLDS[ws].color}"/><image href="v6/img/e/${UI.emKey(D.WORLDS[ws].icon)}.svg" x="-14" y="-22" width="28" height="28"/></g>`;
      stones += `<g class="stone ${st}"><ellipse cx="${x}" cy="${y + 10}" rx="${rx + 2}" ry="${ry}" class="st-shadow"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" class="st-top"/>` +
        (st === 'done' ? `<text x="${x}" y="${y + 10}" class="st-star">★</text>` : st === 'soon' ? `<text x="${x}" y="${y + 10}" class="st-num">${id}</text>` : '') + '</g>';
      if (st === 'now') {
        const mw = tall ? 190 : 144, mh = mw * 312 / 200;
        me = `<g class="road-me"><ellipse cx="${x}" cy="${y + 2}" rx="${rx + 8}" ry="${ry - 6}" class="me-glow"/><svg x="${x - mw / 2}" y="${y - mh * 0.86}" width="${mw}" height="${mh}" viewBox="0 0 200 312" overflow="visible">${UI.mascot('happy').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg></g>`;
      }
    });
    const fx = tall ? last[0] + 70 : W - 35, fy = tall ? last[1] - 150 : last[1] - 125;
    const flag = `<g class="road-flag" transform="translate(${fx} ${fy})"><path d="M0 0 V100" stroke="#2B2D5C" stroke-width="6" stroke-linecap="round"/><path d="M3 4 L58 20 L3 38Z" fill="#FF6B6B" stroke="#2B2D5C" stroke-width="5" stroke-linejoin="round"/></g>`;
    /* the friend waiting at the end of this world */
    const gf = D.FRIENDS.find(f => f.id === D.WORLDS[stage.w].guide);
    let guide = '';
    if (gf) {
      const met = St.hasFriend(gf) && (St.s.reward.met || []).includes('w' + stage.w);
      const gw = tall ? 120 : 92, gh = gw * 312 / 200, gx = tall ? fx - gw - 10 : fx - gw - 6, gy = fy + 100 - gh;
      guide = `<g class="road-guide${met ? ' met' : ''}"><svg x="${gx}" y="${gy}" width="${gw}" height="${gh}" viewBox="0 0 200 312" overflow="visible">${UI.mascot(met ? 'wave' : 'think', {}, gf.id).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>${met ? '' : `<g transform="translate(${gx + gw * 0.05} ${gy + 14})"><circle r="20" fill="#fff" stroke="#4B3642" stroke-width="4"/><text y="9" class="st-q">?</text></g>`}</g>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="모험 지도"><path d="${d}" class="road-edge"/><path d="${d}" class="road-path"/><path d="${d}" class="road-dash"/>${deco}${stones}${flag}${guide}${me}</svg>`;
  }
  /* Re-draw the road when the iPad turns. */
  let rt = null;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (App.screen === 'home' && App._drawRoad && $('.road')) App._drawRoad(); }, 120); });

  /* World colours drive the background scene (sky + hills) behind every screen. */
  /* muted pastel scene per world (same family as the 6-colour UI palette) */
  const SCENES = {
    1: ['#BFE3F6', '#F3F8F6', '#C5E6B4', '#A6D69C'], 2: ['#B9DDF5', '#F1F7FB', '#B3DCF0', '#93C8E6'],
    3: ['#FBDDBF', '#FFF6EC', '#F6CFA2', '#EDB988'], 4: ['#F9D3DC', '#FFF4F6', '#F5BFCC', '#EBA5B6'],
    5: ['#DDD3F7', '#F8F5FD', '#CFC2F3', '#B9A9EA'], 6: ['#CFCBF3', '#F3F2FC', '#BDB6EC', '#A59DE0'],
    7: ['#C3EBDD', '#F2FBF7', '#AEE0CC', '#91D2B9'], 8: ['#C9DAF5', '#F3F6FC', '#FFFFFF', '#E3EAF7']
  };
  App.setWorld = function (w) {
    const c = SCENES[w] || SCENES[1], r = document.documentElement.style;
    r.setProperty('--sky1', c[0]); r.setProperty('--sky2', c[1]); r.setProperty('--hill1', c[2]); r.setProperty('--hill2', c[3]);
    document.documentElement.dataset.world = w;
  };

  /* ---------- daily gift + streak ---------- */
  async function dailyGift(d) {
    A.sfx('fanfare');
    const days = [1, 2, 3, 4, 5, 6, 7].map(i => `<span class="dday ${i < d.day ? 'got' : ''} ${i === d.day ? 'today' : ''}">${i === 7 ? '👑' : '🎁'}<small>${i}일</small></span>`).join('');
    await UI.modal(`<div class="daily"><h3>오늘의 선물!</h3><div class="ddays">${days}</div><p class="streak">🔥 ${d.streak}일째 만나요!</p></div>`, [['열어 보기 🎁', 1, 'go']], 'gift');
    const got = [St.pickSticker(d.day === 7 ? 1 : undefined)];
    if (d.day === 7) got.push(St.pickSticker());
    if (d.milestone) got.push(St.pickSticker(2));
    let extra = '';
    if (d.day === 7) { const o = St.giveOutfit(); if (o) extra = `<p class="outfit-got">새 옷: ${esc(o.name)}!</p>`; }
    await revealStickers(got, extra);
  }
  function stickerHtml(s, cls) { return `<span class="stk r${s.r} ${cls || ''}"><span>${UI.em(s.e)}</span></span>`; }
  async function revealStickers(list, extra) {
    A.sfx('sparkle');
    UI.burst(null, 30);
    const rare = Math.max.apply(null, list.map(s => s.r));
    const title = rare === 2 ? '황금 스티커!' : rare === 1 ? '반짝 스티커!' : '스티커 받았어!';
    const p = UI.modal(`<div class="reveal"><h3>${title}</h3><div class="reveal-row">${list.map(s => stickerHtml(s, 'big')).join('')}</div>${extra || ''}</div>`, [['좋아!', 1, 'go']], 'reveal-m');
    A.play('ui_sticker');
    await p;
  }

  /* ---------- stage ---------- */
  App.runStage = async function (stage, replay) {
    const my = ++App.sess;
    A.stop();
    App.screen = 'stage';
    A.bgm(false);
    App.setWorld(stage.w || 1);
    App._levelUp = false;
    const m = main();
    m.innerHTML = '';
    m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
    App._screenAt = performance.now();
    m.dataset.screen = 'stage';
    const plays = Plan.make(stage);
    const dots = el('div', 'dots-prog', plays.map(() => '<i></i>').join(''));
    m.appendChild(hud({ home: true, dots }));
    const area = el('div', 'play');
    m.appendChild(area);
    const buddy = el('div', 'buddy', UI.mascot('happy'));
    buddy.id = 'buddy';
    m.appendChild(buddy);
    let abort;
    const ctx = {
      right: 0, wrong: 0, giftUsed: false,
      alive: () => App.sess === my,
      star: () => { if (App.sess === my) App.star(1); },
      aborted: new Promise(r => { abort = r; })
    };
    App._abort = () => abort(false);
    ctx.gift = () => maybeGift(ctx);
    const pre = A.preload(Plan.clips(plays));
    /* intro */
    const world = D.WORLDS[stage.w];
    area.innerHTML = '';
    const intro = el('div', 'intro');
    intro.style.setProperty('--wc', world.color);
    intro.appendChild(el('div', 'intro-world', `${world.icon} ${esc(world.name)}`));
    intro.appendChild(el('h2', 'intro-title', esc(stage.title)));
    intro.appendChild(el('div', 'intro-plays', plays.map(p => `<span>${PLAY_ICON[p.t] || '🎲'}</span>`).join('')));
    const go = btn('next-btn big', '출발! ▶', null, '출발');
    intro.appendChild(go);
    area.appendChild(intro);
    await Promise.race([pre, sleep(2500)]);
    await new Promise(r => UI.tap(go, r));
    A.sfx('whoosh');
    const t0 = performance.now();
    for (let i = 0; i < plays.length; i++) {
      if (!ctx.alive()) return;
      dots.children[i].classList.add('now');
      area.innerHTML = '';
      area.dataset.play = plays[i].t;
      UI.buddy('happy');
      try { await P[plays[i].t](area, plays[i].cfg, ctx); } catch (err) { console.error(err); }
      if (!ctx.alive()) return;
      dots.children[i].classList.remove('now');
      dots.children[i].classList.add('done');
      A.sfx('whoosh');
      await sleep(200);
    }
    if (!ctx.alive()) return;
    const secs = (performance.now() - t0) / 1000;
    let firstTime = false;
    if (stage.k === 'review') { St.s.learn.reviews = (St.s.learn.reviews || 0) + 1; St.logDay(ctx.right, ctx.wrong, 0, secs); }
    else { firstTime = St.finishStage(stage.id, ctx.right, ctx.wrong); St.logDay(0, 0, 0, secs); }
    await chest(ctx);
    if (!ctx.alive()) return;
    if (App._levelUp) await levelUp();
    if (!ctx.alive()) return;
    /* last stage of a world: the friend waiting at the end of the road joins */
    const lastOfWorld = stage.k !== 'review' && D.STAGES.filter(x => x.w === stage.w).every(x => St.s.learn.done[x.id]);
    if (lastOfWorld && firstTime && !(St.s.reward.met || []).includes('w' + stage.w)) await worldDone(stage.w);
    if (!ctx.alive()) return;
    await App.home();
    const nx = St.stage();
    if (stage.k !== 'review' && nx.w !== stage.w && !(St.s.reward.told || []).includes(nx.w)) await worldArrive(nx.w);
    if (stage.k !== 'review' && St.todayCount() === St.s.settings.perDay) A.play('ui4_bye');
  };
  const MIC_ICO = '<svg viewBox="0 0 40 40" class="ico-svg" aria-hidden="true"><rect x="13" y="4" width="14" height="21" rx="7" fill="#FF9DB6" stroke="#4B3642" stroke-width="3"/><path d="M8 19 a12 12 0 0 0 24 0 M20 31 v5 M13 36 h14" fill="none" stroke="#4B3642" stroke-width="3" stroke-linecap="round"/></svg>';
  const PLAY_ICON = { meet: '🔤', chant: '🎵', pop: '🎈', pick: '🖼️', clap: '🥁', first: '👂', block: '🧱', trace: '✏️', train: '🚂', memory: '🃏', batchim: '💎', story: '📖',
    fish: '🐟', shop: '🎁', hide: '🔭', speak: MIC_ICO, twin: '🌱', vmerge: '🎢' };

  /* A new world on the map: a short celebration with the world's picture. */
  async function worldArrive(w, quiet) {
    const W = D.WORLDS[w];
    const told = St.s.reward.told = St.s.reward.told || [];
    if (!told.includes(w)) { told.push(w); St.save(); }
    if (!quiet) { A.sfx('fanfare'); UI.burst(null, 36); }
    const g = D.FRIENDS.find(f => f.id === W.guide);
    const own = g && St.hasFriend(g);
    const p = UI.modal(`<div class="arrive"><div class="arrive-row"><div class="arrive-ico">${UI.em(W.icon)}</div>${g ? `<div class="arrive-pal${own ? '' : ' shadow'}">${UI.mascot(own ? 'wave' : 'think', {}, g.id)}</div>` : ''}</div>
      <h3>${quiet ? '모험 시작!' : '새 마을 도착!'}</h3><p class="arrive-name">${esc(W.name)}</p><p class="arrive-story">${esc(D.STORY[w][0])}</p></div>`, [['출발!', 1, 'go']], 'arrive-m');
    A.play('p_w' + w);
    await p;
    A.stop();
  }
  async function worldDone(w) {
    const W = D.WORLDS[w];
    const g = D.FRIENDS.find(f => f.id === W.guide);
    St.s.reward.met = St.s.reward.met || [];
    St.s.reward.met.push('w' + w);
    if (g) St.meet(g.id);
    St.save();
    A.sfx('fanfare'); UI.burst(null, 50);
    const stk = St.pickSticker(2);
    const p = UI.modal(`<div class="arrive done"><div class="arrive-pal big">${UI.mascot('cheer', {}, g ? g.id : undefined)}</div>
      <h3>${esc(W.name)} 끝!</h3><p class="arrive-story">${esc(D.STORY[w][1])}</p>${g ? `<p class="outfit-got">${esc(g.name)}가 친구가 됐어!</p>` : ''}<div class="reveal-row">${stickerHtml(stk, 'big')}</div></div>`, [['우와!', 1, 'go']], 'arrive-m');
    A.play('p_wd' + w);
    await p;
    A.stop();
  }
  async function maybeGift(ctx) {
    if (ctx.giftUsed || ctx.right < 3 || Math.random() > (App.giftRate !== undefined ? App.giftRate : 0.15)) return;
    ctx.giftUsed = true;
    A.sfx('whoosh');
    const g = el('div', 'gift-drop');
    const box = btn('gift-box', '🎁', null, '깜짝 선물');
    g.appendChild(box);
    g.appendChild(el('p', 'gift-say', '깜짝 선물!'));
    document.body.appendChild(g);
    await new Promise(r => UI.tap(box, r));
    g.remove();
    await revealStickers([St.pickSticker()]);
  }
  async function chest(ctx) {
    const area = $('.play');
    if (!area) return;
    area.innerHTML = '';
    area.dataset.play = 'chest';
    const wrap = el('div', 'chest-wrap');
    wrap.appendChild(el('h2', 'play-title', '보물 상자를 열어 봐!'));
    const ch = btn('chest', '<span class="lid"></span><span class="box"></span><span class="lock">⭐</span>', null, '보물 상자');
    wrap.appendChild(ch);
    wrap.appendChild(el('p', 'chest-score', `⭐ ${ctx.right}개 맞혔어!`));
    area.appendChild(wrap);
    A.play('ui4_treasure');
    let taps = 0;
    await new Promise(r => UI.tap(ch, () => {
      taps++;
      A.sfx('chest');
      ch.classList.remove('shake'); void ch.offsetWidth; ch.classList.add('shake');
      if (taps >= 3) r();
    }));
    ch.classList.add('open');
    A.sfx('fanfare');
    UI.burst(UI.pointOf(null, ch), 30);
    UI.rain();
    UI.buddy('cheer', 'dance');
    await sleep(500);
    if (!ctx.alive()) return;
    const n = ctx.wrong === 0 && ctx.right >= 8 ? 2 : 1;
    const got = [];
    for (let i = 0; i < n; i++) got.push(St.pickSticker());
    await revealStickers(got, n === 2 ? '<p class="outfit-got">하나도 안 틀려서 2장!</p>' : '');
  }
  async function levelUp() {
    App._levelUp = false;
    A.sfx('fanfare');
    UI.burst(null, 40);
    const o = St.giveOutfit();
    const nf = D.FRIENDS.find(f => f.lv === St.s.reward.level);
    const p = UI.modal(`<div class="lvup"><div class="lv-mascot">${UI.mascot('cheer', nf ? {} : undefined, nf ? nf.id : undefined)}</div><h3>레벨 ${St.s.reward.level}!</h3>${nf ? `<p>새 친구 <b>${esc(nf.name)}</b>가 왔어! 옷장에서 짝꿍으로 골라 봐.</p>` : ''}${o ? `<p>새 옷 <b>${esc(o.name)}</b> 받았어!</p>` : ''}</div>`, [['우와!', 1, 'go']], 'lv');
    A.play('ui_levelup');
    await p;
  }

  /* ---------- sticker book ---------- */
  App.stickers = function (tab) {
    leave(); App.sess++; A.stop();
    App.screen = 'stickers';
    const m = main();
    m.innerHTML = '';
    m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
    App._screenAt = performance.now();
    m.dataset.screen = 'book';
    m.appendChild(hud({ home: true }));
    const owned = St.s.reward.stickers;
    const fresh = new Set(St.s.reward.newStickers);
    tab = tab || 0;
    const book = el('div', 'book');
    const tabs = el('div', 'book-tabs');
    D.STICKER_SETS.forEach(([name, s], i) => {
      const have = D.STICKERS.filter(x => x.set === i && owned[x.id]).length;
      tabs.appendChild(btn('book-tab' + (i === tab ? ' on' : ''), `<span>${Array.from(s)[0]}</span><small>${have}/20</small>`, () => { A.sfx('tap'); App.stickers(i); }, name));
    });
    book.appendChild(tabs);
    const page = el('div', 'book-page');
    D.STICKERS.filter(x => x.set === tab).forEach(x => {
      const has = owned[x.id];
      const c = el('button', 'tap slot' + (has ? ' has' : '') + (fresh.has(x.id) ? ' new' : ''), has ? stickerHtml(x) + (has > 1 ? `<i class="cnt">×${has}</i>` : '') : '<span class="q">?</span>');
      c.type = 'button';
      if (has) UI.tap(c, () => { A.sfx('pop'); c.classList.remove('wig'); void c.offsetWidth; c.classList.add('wig'); });
      page.appendChild(c);
    });
    book.appendChild(page);
    const foot = el('div', 'book-foot');
    foot.appendChild(el('p', 'book-count', `${esc(D.STICKER_SETS[tab][0])} · 모두 ${St.stickerCount()} / 120`));
    const haveHere = D.STICKERS.filter(x => x.set === tab && owned[x.id]).length;
    foot.appendChild(btn('deco-go' + (haveHere ? '' : ' off'), '🎨<span>꾸미기</span>', () => { if (!haveHere) { UI.oops(); return; } App.decorate(tab); }, '스티커로 꾸미기'));
    book.appendChild(foot);
    m.appendChild(book);
    St.s.reward.newStickers = St.s.reward.newStickers.filter(id => D.STICKERS[id].set !== tab);
    St.save();
  };

  /* ---------- sticker scenes: drag owned stickers onto a picture, move them, drag back to the tray to remove ---------- */
  const SCENE_BG = [
    /* 동물: meadow */ '<rect width="400" height="250" fill="#CDEBFA"/><circle cx="340" cy="52" r="26" fill="#FFE38A" stroke="#4B3642" stroke-width="3"/><path d="M0 150 C80 110 160 130 220 150 C290 172 340 130 400 140 V250 H0Z" fill="#B8E3A6" stroke="#4B3642" stroke-width="3"/><path d="M0 200 C120 180 260 210 400 190 V250 H0Z" fill="#9ED48E" stroke="#4B3642" stroke-width="3"/><g stroke="#4B3642" stroke-width="3" fill="#F3D2A8">' + [20, 60, 100, 140].map(x => `<rect x="${x}" y="150" width="12" height="44" rx="4"/>`).join('') + '<rect x="14" y="160" width="146" height="8" rx="4"/><rect x="14" y="178" width="146" height="8" rx="4"/></g>',
    /* 간식: picnic */ '<rect width="400" height="250" fill="#FFF1D9"/><path d="M0 120 H400 V250 H0Z" fill="#C9EBC0" stroke="#4B3642" stroke-width="3"/><g stroke="#4B3642" stroke-width="3"><path d="M60 150 L340 150 L380 236 L20 236Z" fill="#FFB3C7"/></g><g fill="#fff" opacity=".85">' + [0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${70 + i * 40} 150 L${90 + i * 40} 150 L${88 + i * 48 - 20} 236 L${62 + i * 48 - 20} 236Z"/>`).join('') + '</g>',
    /* 탈것: road */ '<rect width="400" height="250" fill="#D7EEFB"/><g stroke="#4B3642" stroke-width="3"><rect x="20" y="60" width="60" height="100" fill="#FFD3B5"/><rect x="90" y="30" width="70" height="130" fill="#C9B9F5"/><rect x="250" y="50" width="60" height="110" fill="#A5D4F3"/><rect x="320" y="80" width="60" height="80" fill="#FFE7A6"/><path d="M0 160 H400 V250 H0Z" fill="#8E8A99"/></g><g fill="#fff">' + [0, 1, 2, 3, 4, 5].map(i => `<rect x="${10 + i * 70}" y="202" width="40" height="8" rx="4"/>`).join('') + '</g>',
    /* 바다: sea */ '<rect width="400" height="250" fill="#CFEFFF"/><path d="M0 90 Q25 80 50 90 T100 90 T150 90 T200 90 T250 90 T300 90 T350 90 T400 90 V250 H0Z" fill="#7FC7EE" stroke="#4B3642" stroke-width="3"/><path d="M0 140 Q25 130 50 140 T100 140 T150 140 T200 140 T250 140 T300 140 T350 140 T400 140 V250 H0Z" fill="#5AB2E3"/><path d="M0 214 C100 196 300 230 400 206 V250 H0Z" fill="#FBE3B5" stroke="#4B3642" stroke-width="3"/>',
    /* 하늘: night */ '<rect width="400" height="250" fill="#4A4E8C"/><circle cx="320" cy="60" r="34" fill="#FFF2B3" stroke="#4B3642" stroke-width="3"/><circle cx="334" cy="52" r="30" fill="#4A4E8C"/><g fill="#FFF7D6">' + [[40, 40], [90, 90], [150, 30], [210, 70], [260, 120], [60, 150], [180, 160], [360, 170]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('') + '</g><path d="M0 220 C120 196 280 236 400 210 V250 H0Z" fill="#6E6AA8" stroke="#4B3642" stroke-width="3"/>',
    /* 장난감: room */ '<rect width="400" height="250" fill="#FFF0F4"/><path d="M0 170 H400 V250 H0Z" fill="#E8C49A" stroke="#4B3642" stroke-width="3"/><g stroke="#4B3642" stroke-width="3"><rect x="40" y="40" width="110" height="70" rx="8" fill="#BFE3F6"/><path d="M95 40 V110 M40 75 H150" /><rect x="250" y="90" width="120" height="12" rx="6" fill="#F3BD82"/><rect x="250" y="140" width="120" height="12" rx="6" fill="#F3BD82"/></g>'
  ];
  App.decorate = function (tab) {
    leave(); App.sess++; A.stop();
    App.screen = 'decorate';
    const m = main();
    m.innerHTML = '';
    m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
    App._screenAt = performance.now();
    m.dataset.screen = 'decorate';
    m.appendChild(hud({ home: true }));
    const R = St.s.reward;
    R.scenes = R.scenes || {};
    const placed = R.scenes[tab] = R.scenes[tab] || [];
    const wrap = el('div', 'deco');
    const scene = el('div', 'deco-scene', `<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SCENE_BG[tab] || SCENE_BG[0]}</svg>`);
    const side = el('div', 'deco-side');
    side.appendChild(btn('deco-back', '📒<span>스티커북</span>', () => App.stickers(tab), '스티커북으로'));
    const tray = el('div', 'deco-tray scroll');
    side.appendChild(tray);
    wrap.append(scene, side);
    m.appendChild(wrap);
    const save = () => St.save();
    const MAX = 40;
    function put(item) {
      const s0 = D.STICKERS[item.id];
      const n = el('div', 'placed', UI.em(s0.e));
      n.style.left = item.x + '%'; n.style.top = item.y + '%';
      n.style.setProperty('--s', item.s || 1);
      scene.appendChild(n);
      drag(n, item.id, item);
    }
    function trayFill() {
      tray.innerHTML = '';
      D.STICKERS.filter(x => x.set === tab && R.stickers[x.id]).forEach(x => {
        const used = placed.filter(p => p.id === x.id).length;
        const left = R.stickers[x.id] * 3 - used;
        const t = el('div', 'deco-stk' + (left > 0 ? '' : ' empty'), UI.em(x.e) + `<i>${Math.max(0, left)}</i>`);
        tray.appendChild(t);
        if (left > 0) drag(t, x.id, null);
      });
    }
    /* each owned sticker can be used up to 3 times per scene (×3 per copy) */
    function drag(node, id, item) {
      node.style.touchAction = 'none';
      node.addEventListener('pointerdown', e => {
        e.preventDefault();
        const pid = e.pointerId, sx = e.clientX, sy = e.clientY;
        let g = null;
        try { node.setPointerCapture(pid); } catch (err) { /* ignore */ }
        const mv = ev => {
          if (ev.pointerId !== pid) return;
          if (!g && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
            g = el('div', 'placed ghosting', UI.em(D.STICKERS[id].e));
            g.style.setProperty('--s', item ? item.s || 1 : 1);
            document.body.appendChild(g);
            if (item) node.style.opacity = '.25';
            A.sfx('tap');
          }
          if (g) { g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px'; }
        };
        const upv = ev => {
          if (ev.pointerId !== pid) return;
          node.removeEventListener('pointermove', mv); node.removeEventListener('pointerup', upv); node.removeEventListener('pointercancel', upv);
          if (!g) {
            if (item) { item.s = item.s >= 1.6 ? 0.8 : (item.s || 1) + 0.4; node.style.setProperty('--s', item.s); A.sfx('pop'); save(); }
            return;
          }
          g.remove();
          const r = scene.getBoundingClientRect();
          const inScene = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
          const x = Math.round((ev.clientX - r.left) / r.width * 1000) / 10, y = Math.round((ev.clientY - r.top) / r.height * 1000) / 10;
          if (item) {
            if (inScene) { item.x = x; item.y = y; node.style.left = x + '%'; node.style.top = y + '%'; node.style.opacity = ''; A.sfx('snap'); }
            else { placed.splice(placed.indexOf(item), 1); node.remove(); A.sfx('whoosh'); trayFill(); }
          } else if (inScene && placed.length < MAX) {
            const it = { id, x, y, s: 1 };
            placed.push(it); put(it); A.sfx('snap'); UI.burst({ x: ev.clientX, y: ev.clientY }, 8); trayFill();
          }
          save();
        };
        node.addEventListener('pointermove', mv); node.addEventListener('pointerup', upv); node.addEventListener('pointercancel', upv);
      });
    }
    placed.forEach(put);
    trayFill();
    A.play('p_deco');
  };

  /* ---------- closet ---------- */
  const SLOTS = [['friend', '친구', '🐰'], ['hat', '모자', '🎩'], ['eyes', '안경', '👓'], ['neck', '목', '🎀'], ['back', '망토', '✨'], ['body', '색', '🎨']];
  App.closet = function (slot) {
    leave(); App.sess++; A.stop();
    App.screen = 'closet';
    slot = slot || 'friend';
    const m = main();
    m.innerHTML = '';
    m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
    App._screenAt = performance.now();
    m.dataset.screen = 'closet';
    m.appendChild(hud({ home: true }));
    const R = St.s.reward;
    const wrap = el('div', 'closet');
    wrap.appendChild(el('div', 'closet-model', UI.mascot('joy')));
    const side = el('div', 'closet-side');
    const tabs = el('div', 'closet-tabs');
    SLOTS.forEach(([k, name, ico]) => tabs.appendChild(btn('ctab' + (k === slot ? ' on' : ''), `<span>${ico}</span><small>${name}</small>`, () => { A.sfx('tap'); App.closet(k); }, name)));
    side.appendChild(tabs);
    const grid = el('div', 'closet-grid scroll');
    if (slot === 'friend') D.FRIENDS.forEach(f => {
      const own = St.hasFriend(f), on = UI.friendId(R.friend) === f.id;
      const it = btn('citem' + (own ? ' own' : ' locked') + (on ? ' on' : ''), `<span class="cprev">${UI.mascot('happy', {}, f.id)}</span><b>${esc(f.short)}</b><small>${on ? '내 짝꿍' : own ? '고르기' : '🔒 레벨 ' + f.lv}</small>`, () => {
        if (!own) { UI.oops(it); return; }
        R.friend = f.id; St.save(); A.sfx('fanfare'); UI.burst(null, 20); UI.sayGem(f.id); App.closet('friend');
      }, f.name);
      grid.appendChild(it);
    });
    D.OUTFITS.filter(o => o.slot === slot).forEach(o => {
      const own = R.outfits.includes(o.id), on = R.wear[o.slot] === o.id;
      const locked = !own && o.lv && R.level < o.lv;
      const tag = own ? (on ? '입는 중' : '입기') : locked ? `🔒 레벨 ${o.lv}` : `⭐ ${o.cost}`;
      const it = btn('citem' + (own ? ' own' : '') + (on ? ' on' : '') + (locked ? ' locked' : ''),
        `<span class="cprev">${UI.mascot('happy', { [o.slot]: o.id })}</span><b>${esc(o.name)}</b><small>${tag}</small>`, async () => {
          if (own) { St.wear(o); A.sfx('snap'); App.closet(slot); return; }
          if (locked) { UI.oops(it); return; }
          if (R.stars < o.cost) { UI.oops(it); await UI.modal(`<p class="need">별이 ${o.cost - R.stars}개 더 필요해!<br>놀이하고 별을 모아 오자 ⭐</p>`, [['알았어!', 1, 'go']]); return; }
          const ok = await UI.modal(`<div class="buy"><span class="cprev big">${UI.mascot('joy', { [o.slot]: o.id })}</span><p><b>${esc(o.name)}</b><br>⭐ ${o.cost}개로 살까?</p></div>`, [['좋아!', true, 'go'], ['아니', false, 'no']]);
          if (ok && St.buy(o)) { A.sfx('fanfare'); UI.burst(null, 24); App.closet(slot); }
        }, o.name);
      grid.appendChild(it);
    });
    side.appendChild(grid);
    wrap.appendChild(side);
    m.appendChild(wrap);
  };

  /* ---------- playground: replay finished stages ---------- */
  App.playground = function () {
    leave(); App.sess++; A.stop();
    App.screen = 'playground';
    const m = main();
    m.innerHTML = '';
    m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
    App._screenAt = performance.now();
    m.dataset.screen = 'playground';
    m.appendChild(hud({ home: true }));
    const wrap = el('div', 'pg scroll');
    const doneIds = Object.keys(St.s.learn.done).map(Number).sort((a, b) => a - b);
    const cur = St.stage();
    const rv = btn('pg-item review', '<span>🔁</span><b>복습 모험<br><small>할 때마다 새 문제!</small></b>', () => App.runStage({ id: 0, w: cur.w, k: 'review', title: '복습 모험' }, true), '복습 모험');
    rv.style.setProperty('--wc', '#FF8FB8');
    wrap.appendChild(rv);
    SONGS.forEach((sg, i) => {
      const sb = btn('pg-item songc', `<span>🎵</span><b>${esc(sg[0])}<br><small>같이 불러요!</small></b>`, () => App.songPlay(i), sg[0]);
      sb.style.setProperty('--wc', '#8FD3FF');
      wrap.appendChild(sb);
    });
    if (!doneIds.length) wrap.appendChild(el('p', 'pg-empty', '모험을 하나 끝내면 여기서 다시 놀 수 있어!'));
    doneIds.slice(-24).reverse().forEach(id => {
      const s = D.STAGES[id - 1], w = D.WORLDS[s.w];
      const b = btn('pg-item', `<span>${w.icon}</span><b>${esc(s.title)}</b>`, () => App.runStage(s, true), s.title);
      b.style.setProperty('--wc', w.color);
      wrap.appendChild(b);
    });
    m.appendChild(wrap);
  };

  /* ---------- letter songs: big letter on every beat, friends dance ---------- */
  const SONGS = [['가나다 노래', '가나다라마바사아자차카타파하'.split('')], ['아야어여 노래', '아야어여오요우유으이'.split('')]];
  App.songPlay = async function (n) {
    leave(); const my = ++App.sess; A.stop(); A.bgm(false);
    App.screen = 'song';
    const [title, syl] = SONGS[n];
    const m = main();
    m.innerHTML = '';
    m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
    App._screenAt = performance.now();
    m.dataset.screen = 'song';
    m.appendChild(hud({ home: true }));
    const pals = UI.shuffle(UI.friendsOwned()).slice(0, 3);
    const box = el('div', 'songbox', `<h2 class="song-title">${esc(title)}</h2>
      <div class="song-stage"><div class="song-pals">${pals.map(f => `<div class="song-pal">${UI.mascot('joy', {}, f.id)}</div>`).join('')}</div><div class="song-big"><span></span></div></div>
      <div class="song-row">${syl.map(s => `<button type="button" class="tap song-cell"><span>${esc(s)}</span></button>`).join('')}</div>`);
    m.appendChild(box);
    const big = box.querySelector('.song-big span'), cells = Array.from(box.querySelectorAll('.song-cell'));
    const keys = syl.map(D.syKey);
    const light = i => {
      cells.forEach((c, k) => c.classList.toggle('lit', k === i));
      if (i < 0) return;
      big.textContent = syl[i];
      big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
    };
    cells.forEach((c, i) => UI.tap(c, () => { A.play(keys[i], { onStart: () => light(i) }); }));
    const again = btn('song-again', '🎵 한 번 더!', null, '노래 한 번 더');
    again.hidden = true;
    box.appendChild(again);
    const sing = async () => {
      again.hidden = true;
      await A.preload(keys);
      if (my !== App.sess) return;
      const ok = await A.song(keys, light, 0.6);
      if (my !== App.sess) return;
      light(-1);
      if (ok) { UI.rain(24); A.sfx('yay2'); }
      again.hidden = false;
    };
    UI.tap(again, sing);
    await UI.sleep(500);
    if (my === App.sess) sing();
  };

  /* ---------- parent gate + menu ---------- */
  function holdToOpen(b) {
    let t = null;
    const start = e => { e.preventDefault(); b.classList.add('holding'); t = setTimeout(() => { b.classList.remove('holding'); gate(); }, 2000); };
    const end = () => { clearTimeout(t); b.classList.remove('holding'); };
    b.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, end));
  }
  async function gate() {
    const a = 11 + Math.floor(Math.random() * 8), c = 6 + Math.floor(Math.random() * 7), ans = a + c;
    const opts = UI.shuffle([ans, ans + 10, ans - 3]);
    const v = await UI.modal(`<p class="gate">어른 확인<br><b>${a} + ${c} = ?</b></p>`, opts.map(o => [String(o), o, 'num']).concat([['닫기', null, 'no']]), 'gate-m');
    if (v === ans) App.parent();
  }
  App.parent = function () {
    A.bgm(false);
    setAdult(true);
    leave(); App.sess++; A.stop();
    const box = $('#parent');
    box.hidden = false;
    box.innerHTML = '';
    const L = St.s.learn, R = St.s.reward, S = St.s.settings;
    const stage = St.stage();
    const scores = Object.entries(L.score).map(([id, v]) => [+id, v]).sort((a, b) => b[0] - a[0]);
    const redo = scores.filter(([, v]) => v.wrong / Math.max(1, v.right + v.wrong) > 0.4).slice(0, 6);
    const rows = scores.slice(0, 10).map(([id, v]) => {
      const s = D.STAGES[id - 1], pct = Math.round(v.right / Math.max(1, v.right + v.wrong) * 100);
      return `<tr><td>${id}</td><td>${esc(s.title)}</td><td>${v.right}/${v.right + v.wrong} (${pct}%)</td><td>${v.date}</td></tr>`;
    }).join('');
    const opts = D.STAGES.map(s => `<option value="${s.id}" ${s.id === stage.id ? 'selected' : ''}>${s.id}. ${esc(D.WORLDS[s.w].name)} · ${esc(s.title)}</option>`).join('');
    box.innerHTML = `
      <div class="pm scroll">
        <header class="pm-head"><h2>어른 메뉴</h2><button type="button" class="pm-close" id="pmClose">닫기 ✕</button></header>
        <p class="pm-note">이 화면에서는 두 손가락으로 확대할 수 있습니다. 닫으면 아이 화면은 다시 확대가 막힙니다.</p>
        <section><h3>진도</h3>
          <p>현재 단계: <b>${stage.id} / ${D.STAGES.length}</b> · ${esc(D.WORLDS[stage.w].name)} · ${esc(stage.title)}</p>
          <p>끝낸 단계 ${Object.keys(L.done).length}개 · 오늘 ${St.todayCount()}개 · 별 ${R.stars}개 · 레벨 ${R.level} · 연속 ${R.streak.count}일(최고 ${R.streak.best}일) · 스티커 ${St.stickerCount()}/120</p>
          ${redo.length ? `<p class="pm-warn">다시 하면 좋은 단계: ${redo.map(([id]) => id + '. ' + esc(D.STAGES[id - 1].title)).join(', ')}</p>` : ''}
          <table class="pm-table"><thead><tr><th>#</th><th>단계</th><th>맞힘</th><th>날짜</th></tr></thead><tbody>${rows || '<tr><td colspan="4">아직 기록이 없습니다.</td></tr>'}</tbody></table>
          <label class="pm-row">단계 바꾸기 <select id="pmStage">${opts}</select></label>
          <button type="button" class="pm-btn" id="pmGo">이 단계로 이동</button>
        </section>
        <section><h3>이번 주</h3>${weekHtml()}</section>
        <section><h3>글자 지도 (어떤 글자가 약한지)</h3>
          <p class="pm-small">앱 안에서 고르기·만들기·쓰기·읽기 기록을 글자별로 모았습니다. <span class="hm-key g">잘함 85%↑</span> <span class="hm-key m">보통</span> <span class="hm-key l">연습 필요 65%↓</span> <span class="hm-key n">아직 안 배움</span></p>
          ${heatHtml()}
          ${novelHtml()}
        </section>
        <section><h3>오늘 같이 해 볼 것</h3><p class="pm-tip">${esc(tipText())}</p>
        </section>
        <section><h3>설정</h3>
          <label class="pm-row">하루 모험 수
            <select id="pmPer">${[1, 2, 3, 4].map(n => `<option ${n === S.perDay ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="pm-row">목소리 크기 <input id="pmVoice" type="range" min="0" max="1" step="0.1" value="${S.voice}"></label>
          <label class="pm-row">효과음 크기 <input id="pmSfx" type="range" min="0" max="1" step="0.1" value="${S.sfx}"></label>
          <label class="pm-row"><input id="pmBgm" type="checkbox" ${S.bgm ? 'checked' : ''}> 홈 화면 배경 음악 (놀이 중에는 꺼짐)</label>
          <label class="pm-row">쓰기 획순·방향 확인
            <select id="pmStrokes"><option value="soft" ${S.strokes !== 'off' ? 'selected' : ''}>켜기 (분명히 틀린 획만 다시)</option><option value="off" ${S.strokes === 'off' ? 'selected' : ''}>끄기</option></select></label>
          <label class="pm-row"><input id="pmMic" type="checkbox" ${S.mic !== false ? 'checked' : ''}> '내가 읽어 볼게'에서 마이크로 녹음하기 (녹음은 기기 밖으로 나가지 않고 바로 버려집니다)</label>
          <button type="button" class="pm-btn" id="pmMicTest">마이크 미리 허용하기</button> <span id="pmMicMsg" class="pm-small"></span>
        </section>
        <section><h3>목소리 고르기 (들어 보고 비교)</h3>
          <p>같은 문장을 여러 목소리로 들어 볼 수 있습니다. 마음에 드는 목소리를 고르고 알려 주시면 앱의 모든 음성을 그 목소리로 다시 만듭니다.</p>
          <div id="pmVoicePick"><p class="pm-small">불러오는 중…</p></div>
        </section>
        <section class="pm-studio"><h3>우리 집 녹음실 — 진짜 엄마·아빠 목소리로</h3>
          <p>기계 목소리 대신, 앱이 하는 모든 말(글자 소리·낱말·칭찬 628줄)을 엄마·아빠 목소리로 바꿀 수 있습니다. 한 줄에 한 번 누르면 되고, 나눠서 해도 됩니다. 글자 소리 211개만 먼저 해도(약 15분) 가장 큰 차이가 납니다.</p>
          <button type="button" class="pm-btn go" id="pmStudio">녹음실 열기</button> <span class="pm-small" id="pmStudioN"></span>
        </section>
        <section><h3>가족 목소리</h3>
          <p>엄마·아빠 목소리로 녹음하면 앱이 그 목소리로 말합니다(녹음이 없으면 원래 녹음된 목소리, 이야기는 글자만). 녹음은 이 기기에만 저장됩니다.</p>
          <div id="pmVoices"></div>
          <h4>우리 가족 문장</h4>
          <p class="pm-small">'이야기 하늘'과 '소리 내어 읽기'에서 아이가 이 문장을 읽게 됩니다. 짧게(두세 낱말) 쓰고 그대로 녹음해 주세요.</p>
          <div class="pm-row"><input id="pmSentence" type="text" maxlength="24" placeholder="예: 려원이 사랑해"><button type="button" class="pm-btn" id="pmSentenceRec">● 쓰고 녹음</button></div>
          <div id="pmSentences"></div>
        </section>
        <section><h3>글자 점검 (2~4주마다 한 번)</h3>
          <p>앱 밖에서 실제로 읽을 수 있는지 확인합니다. 글자를 크게 보여 주면 아이가 소리 내어 읽고, 어른이 ✓/✗를 누릅니다. 소리는 나오지 않습니다(약 3분).</p>
          <button type="button" class="pm-btn" id="pmCheck">점검 시작</button>
          ${checkTable(L.checks || [])}
        </section>
        <section><h3>초기화</h3>
          <p>스티커와 옷만 지웁니다. <b>학습 진도, 별, 레벨, 출석은 그대로</b> 남습니다.</p>
          <button type="button" class="pm-btn warn" id="pmResetR">스티커·옷 초기화</button>
          <p class="pm-small">아래 버튼은 진도까지 모두 지웁니다.</p>
          <button type="button" class="pm-btn danger" id="pmResetAll">모든 기록 지우기</button>
          <p id="pmMsg" class="pm-msg" role="status"></p>
        </section>
        <section><h3>같이 하면 좋은 것</h3>
          <ul class="pm-tips">
            <li>따라 쓰기가 끝나면 종이에 같은 글자를 한 번 같이 써 보세요. 손으로 직접 쓰는 경험이 글자 알아보기에 도움이 된다는 연구가 있습니다.</li>
            <li>아이가 틀려도 앱이 "그건 나야"처럼 들은 글자를 알려 줍니다. 정답을 대신 눌러 주기보다 스피커 버튼을 다시 눌러 주세요.</li>
            <li>하루 1~2단계(8~15분)가 적당합니다.</li>
          </ul>
        </section>
        <section><h3>정보</h3><p id="pmInfo">버전 v6.3 · 인터넷 없이 쓸 준비를 확인하는 중…</p></section>
      </div>`;
    $('#pmClose').addEventListener('click', closeParent);
    $('#pmGo').addEventListener('click', () => { St.setStage(+$('#pmStage').value); msg('단계를 바꿨습니다.'); });
    $('#pmPer').addEventListener('change', e => { S.perDay = +e.target.value; St.save(); });
    $('#pmVoice').addEventListener('input', e => { S.voice = +e.target.value; A.setVolume(S.voice, S.sfx); St.save(); });
    $('#pmSfx').addEventListener('input', e => { S.sfx = +e.target.value; A.setVolume(S.voice, S.sfx); St.save(); A.sfx('correct'); });
    $('#pmBgm').addEventListener('change', e => { S.bgm = e.target.checked; St.save(); });
    $('#pmStrokes').addEventListener('change', e => { S.strokes = e.target.value; St.save(); });
    $('#pmMic').addEventListener('change', e => { S.mic = e.target.checked; St.save(); });
    $('#pmMicTest').addEventListener('click', async () => {
      const t = $('#pmMicMsg');
      if (!G.Rec || !G.Rec.micOk()) { t.textContent = '이 브라우저는 녹음을 지원하지 않습니다. 아이는 소리 내 읽은 뒤 스피커로 정답을 듣습니다.'; return; }
      try { await G.Rec.open(); G.Rec.close(); t.textContent = '허용됐습니다.'; } catch (e) { t.textContent = '허용되지 않았습니다. 설정 > Safari > 마이크에서 바꿀 수 있습니다.'; }
    });
    voiceUi();
    voicePick();
    const sb = $('#pmStudio');
    if (sb && G.Studio) {
      const n = G.Rec ? Array.from(G.Rec.items.values()).filter(i => i.kind === 'studio').length : 0;
      $('#pmStudioN').textContent = n ? `지금까지 ${n}줄 녹음` : '';
      sb.onclick = () => { G.Studio.onClose = () => App.parent(); G.Studio.open(); };
    }
    $('#pmCheck').addEventListener('click', runCheck);
    $('#pmResetR').addEventListener('click', () => {
      if (!confirm('스티커와 옷을 모두 지울까요? 학습 진도는 남습니다.')) return;
      St.resetRewards(); msg('스티커와 옷을 지웠습니다. 학습 진도는 그대로입니다.');
    });
    $('#pmResetAll').addEventListener('click', () => {
      if (!confirm('진도까지 모든 기록을 지울까요?')) return;
      if (!confirm('정말 처음부터 다시 시작할까요?')) return;
      St.resetAll(); msg('모든 기록을 지웠습니다.');
    });
    offlineInfo();
  };
  /* ---------- parent: weekly view, letter map, tips, family voices ---------- */
  function weekHtml() {
    const log = St.s.learn.log || {};
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(St.day(d)); }
    const prev = [];
    for (let i = 13; i >= 7; i--) { const d = new Date(); d.setDate(d.getDate() - i); prev.push(St.day(d)); }
    const sum = ds => ds.reduce((a, d) => { const v = log[d] || [0, 0, 0, 0]; return [a[0] + v[0], a[1] + v[1], a[2] + v[2], a[3] + v[3]]; }, [0, 0, 0, 0]);
    const w = sum(days), p = sum(prev);
    const max = Math.max(1, ...days.map(d => (log[d] || [0, 0, 0, 0])[3]));
    const WD = ['일', '월', '화', '수', '목', '금', '토'];
    const bars = days.map(d => {
      const v = log[d] || [0, 0, 0, 0], h = Math.round(v[3] / max * 100), pct = v[0] + v[1] ? Math.round(v[0] / (v[0] + v[1]) * 100) : null;
      return `<div class="wk-day"><div class="wk-bar"><i style="height:${h}%"></i></div><b>${Math.round(v[3] / 60)}분</b><small>${WD[new Date(d + 'T12:00').getDay()]}${pct !== null ? ' · ' + pct + '%' : ''}</small></div>`;
    }).join('');
    const pct = x => (x[0] + x[1] ? Math.round(x[0] / (x[0] + x[1]) * 100) + '%' : '-');
    return `<div class="wk">${bars}</div><p>이번 주: 단계 <b>${w[2]}</b>개 · <b>${Math.round(w[3] / 60)}</b>분 · 정답률 <b>${pct(w)}</b> &nbsp;|&nbsp; 지난주: 단계 ${p[2]}개 · ${Math.round(p[3] / 60)}분 · 정답률 ${pct(p)}</p>`;
  }
  /* rights/wrongs per letter, from every item the plays record */
  function letterStats() {
    const it = St.s.learn.items, out = {};
    const add = (j, v) => { if (!j) return; const o = out[j] = out[j] || [0, 0]; o[0] += v[0]; o[1] += v[1]; };
    Object.entries(it).forEach(([k, v]) => {
      const i = k.indexOf(':'), kind = k.slice(0, i), x = k.slice(i + 1);
      if (kind === 'j') { add(x, v); return; }
      if (['sy', 'say', 'write', 'stroke'].includes(kind) && x.length === 1) {
        const sp = D.split(x);
        if (!sp) { add(x, v); return; }
        add(sp.cho === 'ㅇ' ? null : sp.cho, v); add(sp.jung, v); if (sp.jong) add('_' + sp.jong, v);
      }
    });
    return out;
  }
  function heatHtml() {
    const st = letterStats(), L = Plan.learnedAt(St.s.learn.stage);
    const cell = (j, label, known) => {
      const v = st[j];
      let c = 'n', t = '';
      if (v && v[0] + v[1] >= 2) { const p = v[0] / (v[0] + v[1]); c = p >= 0.85 ? 'g' : p >= 0.65 ? 'm' : 'l'; t = Math.round(p * 100) + '%'; }
      else if (known) { c = 'k'; t = '기록 적음'; }
      return `<span class="hm ${c}" title="${t}"><b>${esc(label || j)}</b><small>${t}</small></span>`;
    };
    const row = (name, list, f) => `<div class="hm-row"><span class="hm-name">${name}</span>${list.map(j => cell(f ? f(j) : j, j, f ? L.b.has(j) : (L.c.has(j) || L.v.has(j)))).join('')}</div>`;
    return row('자음', 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('')) + row('쌍자음', 'ㄲㄸㅃㅆㅉ'.split('')) +
      row('모음', 'ㅏㅓㅗㅜㅡㅣㅑㅕㅛㅠㅐㅔ'.split('')) + row('미끄럼 모음', 'ㅘㅝㅢㅟㅚ'.split('')) + row('받침', 'ㅇㄴㅁㄹㄱㅂㅅ'.split(''), j => '_' + j);
  }
  function novelHtml() {
    const N = St.s.learn.novel || {}, vals = Object.values(N);
    const said = St.s.learn.says || 0;
    if (!vals.length && !said) return '<p class="pm-small">\'내가 읽어 볼게\' 기록이 아직 없습니다.</p>';
    const ok = vals.reduce((a, v) => a + v[0], 0), n = vals.reduce((a, v) => a + v[1], 0);
    const last = Object.entries(N).slice(-10).map(([k, v]) => `${esc(k.split(':')[1])}${v[0] ? '✓' : '·'}`).join(' ');
    return `<p>소리 내어 읽기 <b>${said}</b>번 · 처음 보는 글자 스스로 읽기 <b>${n}</b>번 중 아이가 "똑같아"라고 한 것 <b>${ok}</b>번${n ? ` (${Math.round(ok / n * 100)}%)` : ''}</p>
      ${last ? `<p class="pm-small">최근: ${last} — 아이 스스로 판단한 결과이므로, 녹음을 같이 들어 보시거나 '글자 점검'으로 확인해 주세요.</p>` : ''}`;
  }
  function tipText() {
    const stage = St.stage(), st = letterStats(), L = Plan.learnedAt(stage.id);
    const cand = Array.from(L.c).filter(c => c !== 'ㅇ');
    const weak = cand.map(c => [c, st[c] ? st[c][0] / Math.max(1, st[c][0] + st[c][1]) : 1]).sort((a, b) => a[1] - b[1])[0];
    const j = weak ? weak[0] : 'ㄱ';
    const list = D.TIPS[stage.w] || D.TIPS[1];
    return list[new Date().getDate() % list.length].replace('{j}', j);
  }
  const VOICE_GROUPS = [
    ['가족 낱말', ['ryeowon', 'eomma', 'appa', 'halmeoni', 'harabeoji', 'nuna', 'agi'].map(k => ['w_' + k, D.WORDS[k].w])],
    ['모험 이야기 (녹음하면 가족 목소리로 들려줍니다)', D.WORLD_ORDER.flatMap(w => [['p_w' + w, D.STORY[w][0]], ['p_wd' + w, D.STORY[w][1]]])]
  ];
  /* compare candidate voices (v6/voice-samples, made by .github/workflows/voice-samples.yml) */
  async function voicePick() {
    const box = $('#pmVoicePick');
    if (!box) return;
    let L;
    try { L = await (await fetch('v6/voice-samples/list.json', { cache: 'no-cache' })).json(); } catch (e) { box.innerHTML = '<p class="pm-small">샘플이 아직 없습니다.</p>'; return; }
    const S = St.s.settings;
    let cur = null;
    const play = f => { if (cur) cur.pause(); cur = new Audio('v6/voice-samples/' + f); cur.play().catch(() => {}); };
    box.innerHTML = L.voices.map(v => `<div class="vrow vpick${S.voicePick === v.id ? ' on' : ''}" data-id="${esc(v.id)}"><span class="vlabel"><b>${esc(v.label)}</b></span>
      ${v.files.map((f, i) => `<button type="button" class="pm-btn sm" data-f="${esc(f)}">▶ ${esc(L.lines[i].slice(0, 9))}${L.lines[i].length > 9 ? '…' : ''}</button>`).join('')}
      <button type="button" class="pm-btn sm pickv">${S.voicePick === v.id ? '✓ 고름' : '이 목소리'}</button></div>`).join('')
      + `<p class="pm-small" id="pmVoiceChosen">${S.voicePick ? '고른 목소리: ' + esc((L.voices.find(v => v.id === S.voicePick) || {}).label || S.voicePick) : ''}</p>`;
    box.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => play(b.dataset.f); });
    box.querySelectorAll('.pickv').forEach(b => { b.onclick = () => { S.voicePick = b.closest('.vpick').dataset.id; St.save(); voicePick(); }; });
  }
  let recNow = null;
  function voiceUi() {
    const box = $('#pmVoices'), sbox = $('#pmSentences');
    if (!box) return;
    const ok = G.Rec && G.Rec.micOk();
    const rowHtml = ([key, label], del) => {
      const has = G.Rec && G.Rec.items.has(key);
      return `<div class="vrow" data-k="${esc(key)}"><span class="vlabel">${esc(label)}</span>${has ? '<span class="vhas">가족 녹음</span>' : ''}
        <button type="button" class="pm-btn sm vplay">▶ 듣기</button>${ok ? '<button type="button" class="pm-btn sm vrec">● 녹음</button>' : ''}${has ? `<button type="button" class="pm-btn sm warn vdel">${del ? '지우기' : '녹음 지우기'}</button>` : ''}</div>`;
    };
    box.innerHTML = (ok ? '' : '<p class="pm-warn">이 브라우저에서는 녹음할 수 없습니다.</p>') +
      VOICE_GROUPS.map(([g, list]) => `<details><summary>${esc(g)} (${list.filter(([k]) => G.Rec && G.Rec.items.has(k)).length}/${list.length})</summary>${list.map(x => rowHtml(x)).join('')}</details>`).join('');
    sbox.innerHTML = (G.Rec ? G.Rec.sentences() : []).map(r => rowHtml([r.key, r.label], true)).join('') || '<p class="pm-small">아직 없습니다.</p>';
    const wire = root => root.querySelectorAll('.vrow').forEach(rw => {
      const key = rw.dataset.k, label = rw.querySelector('.vlabel').textContent;
      rw.querySelector('.vplay').onclick = () => { A.init(); A.play(key); };
      const del = rw.querySelector('.vdel');
      if (del) del.onclick = async () => { await G.Rec.del(key); voiceUi(); };
      const rb = rw.querySelector('.vrec');
      if (rb) rb.onclick = () => recordInto(rb, key, label, G.Rec.items.get(key) ? G.Rec.items.get(key).kind : 'clip');
    });
    wire(box); wire(sbox);
    $('#pmSentenceRec').onclick = () => {
      const tx = $('#pmSentence').value.trim();
      if (!tx) { $('#pmSentence').focus(); return; }
      recordInto($('#pmSentenceRec'), 'u_' + Date.now(), tx, 'sentence');
    };
  }
  async function recordInto(b, key, label, kind) {
    if (recNow) { const r = recNow; recNow = null; const blob = await r.stop(); G.Rec.close(); if (blob.size > 800) { await G.Rec.put(key, blob, { label, kind }); A.init(); A.play(key); } if (kind === 'sentence') $('#pmSentence').value = ''; voiceUi(); return; }
    try {
      A.init(); A.stop();
      recNow = await G.Rec.record({ maxMs: 12000 });
      b.textContent = '■ 멈추기'; b.classList.add('rec');
      recNow.done.then(async blob => {
        if (!recNow) return;
        recNow = null; G.Rec.close();
        if (blob.size > 800) { await G.Rec.put(key, blob, { label, kind }); }
        voiceUi();
      });
      b.onclick = () => recordInto(b, key, label, kind);
    } catch (e) { recNow = null; b.textContent = '마이크 허용 필요'; }
  }

  /* ---------- parent-run reading check ---------- */
  const CHECK = [
    ['모음', 'ㅏㅓㅗㅜㅡㅣ'.split('')],
    ['자음', 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('')],
    ['글자', '가나다라마바사아자차카타파하'.split('')],
    ['받침 글자', '강눈곰달책밥옷'.split('')],
    ['쌍자음·미끄럼 모음', '까빠씨찌딸과워의귀'.split('')],
    ['낱말', ['나비', '오리', '바나나', '모자', '사과', '강아지']]
  ];
  function checkTable(list) {
    if (!list.length) return '<p class="pm-small">아직 점검 기록이 없습니다.</p>';
    const head = '<tr><th>날짜</th>' + CHECK.map(c => `<th>${c[0]}</th>`).join('') + '</tr>';
    const rows = list.slice(-8).reverse().map(r => `<tr><td>${r.date}</td>` + CHECK.map(c => `<td>${r[c[0]] || '-'}</td>`).join('') + '</tr>').join('');
    return `<table class="pm-table">${head}${rows}</table>`;
  }
  function runCheck() {
    const items = CHECK.flatMap(([g, xs]) => UI.shuffle(xs).map(x => [g, x]));
    const res = {};
    CHECK.forEach(([g, xs]) => { res[g] = [0, xs.length]; });
    let i = 0;
    const box = el('div', 'check');
    document.body.appendChild(box);
    const show = () => {
      if (i >= items.length) {
        const rec = { date: St.day() };
        CHECK.forEach(([g]) => { rec[g] = res[g][0] + '/' + res[g][1]; });
        St.s.learn.checks = (St.s.learn.checks || []).concat([rec]); St.save();
        box.remove(); App.parent(); return;
      }
      const [g, x] = items[i];
      box.innerHTML = `<p class="check-g">${g} · ${i + 1}/${items.length}</p><div class="check-x">${esc(x)}</div>
        <div class="check-btns"><button type="button" class="ck yes">✓ 읽었어요</button><button type="button" class="ck no">✗ 못 읽었어요</button><button type="button" class="ck stop">그만</button></div>`;
      box.querySelector('.yes').onclick = () => { res[g][0]++; i++; show(); };
      box.querySelector('.no').onclick = () => { i++; show(); };
      box.querySelector('.stop').onclick = () => { box.remove(); };
    };
    show();
  }
  function msg(t) { const m = $('#pmMsg'); if (m) m.textContent = t; }
  function closeParent() {
    if (recNow) { recNow.stop(); recNow = null; }
    if (G.Rec) G.Rec.close();
    const box = $('#parent');
    box.hidden = true;
    box.innerHTML = '';
    setAdult(false);
    App.home();
  }
  async function offlineInfo() {
    const info = $('#pmInfo');
    try {
      if (!('caches' in G)) { info.textContent = '버전 v6.3 · 이 브라우저는 오프라인 저장을 지원하지 않습니다.'; return; }
      const keys = await caches.keys();
      const k = keys.find(x => x.startsWith('hangul-v6'));
      if (!k) { info.textContent = '버전 v6.3 · 오프라인 저장 준비 중(처음 한 번은 인터넷이 필요합니다).'; return; }
      const c = await caches.open(k);
      const n = (await c.keys()).length;
      const want = G.SW_FILES_COUNT || n;
      info.textContent = `버전 v6.3 · 오프라인 저장 ${n}/${want}개 파일${n >= want ? ' · 인터넷 없이 쓸 수 있습니다' : ''}`;
    } catch (e) { info.textContent = '버전 v6.3'; }
  }

  /* ---------- helper hand: if nothing is touched for a while, show what to press ---------- */
  App.idleHelp = true;
  let hintShown = 0;
  function targetNow() {
    const q = s => document.querySelector(s);
    if (q('.modal .mbtn')) return q('.modal .mbtn');
    if (q('.gift-box')) return q('.gift-box');
    if (App.screen === 'home') return q('.play-go');
    if (App.screen !== 'stage') return null;
    const a = G.__answer;
    if (a != null) {
      const n = a.startsWith('i') && q('.cell') ? q('.cell[data-i="' + a.slice(1) + '"]') : Array.from(document.querySelectorAll('.play [data-v]')).find(x => x.dataset.v === a && x.style.visibility !== 'hidden');
      if (n && n.isConnected) return n;
    }
    return q('.intro .next-btn') || q('.meet .next-btn:not([hidden])') || q('.chest:not(.open)') || q('.drum.next') || q('.vblock.next') || q('.cell.next') || q('.mcard:not(.matched):not(.open)') || q('.write-board:not(.done)');
  }
  function showHand(t) {
    const r = t.getBoundingClientRect();
    if (!r.width) return;
    const h = el('img', 'help-hand');
    h.src = 'v6/img/e/1f446.svg'; h.alt = '';
    let x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (t.classList.contains('write-board') && G.__board) {
      const smp = G.__board._test.samples()[0], sc = G.__board._test.size() / 100;
      x = r.left + smp.x * sc; y = r.top + smp.y * sc;
    }
    h.style.left = x + 'px'; h.style.top = y + 'px';
    UI.$('#fx').appendChild(h);
    t.classList.add('hint');
    setTimeout(() => { h.remove(); if (t.isConnected && !t.classList.contains('next')) t.classList.remove('hint'); }, 3200);
  }
  setInterval(() => {
    if (!App.idleHelp || App.adult || document.hidden || !A.ready) return;
    const idle = performance.now() - Math.max(UI.lastInput || 0, App._screenAt || 0, A.lastVoiceEnd ? A.lastVoiceEnd() : 0);
    const wait = App.screen === 'home' ? 12000 : 7000;
    if (idle < wait || performance.now() - hintShown < 9000 || A.busy()) return;
    const t = targetNow();
    if (!t) return;
    hintShown = performance.now();
    showHand(t);
    A.play(t.classList.contains('write-board') ? 'ui4_hint' : 'ui4_tapnext');
  }, 1000);

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    let had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had) { had = true; return; }
      if (App.screen === 'home' || App.screen === '') location.reload(); else App._reload = true;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setAdult(false);
    A.setVolume(St.s.settings.voice, St.s.settings.sfx);
    splash();
  });
})(window);
