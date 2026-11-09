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
  function leave() { if (App._abort) { App._abort(); App._abort = null; } }
  App.home = async function (first) {
    leave();
    App.sess++;
    A.stop();
    App.screen = 'home';
    if (App._reload) { location.reload(); return; }
    A.bgm(St.s.settings.bgm);
    const m = main();
    m.innerHTML = '';
    m.dataset.screen = 'home';
    m.appendChild(hud());
    const stage = St.stage();
    const world = D.WORLDS[stage.w];
    const wrap = el('div', 'home');
    const left = el('div', 'home-left');
    const buddy = el('button', 'tap home-buddy', UI.mascot('happy'));
    buddy.type = 'button';
    UI.tap(buddy, () => { buddy.innerHTML = UI.mascot(UI.pick(['joy', 'wow', 'cheer'])); buddy.classList.remove('jump'); void buddy.offsetWidth; buddy.classList.add('jump'); A.play('ui_hiname'); });
    left.appendChild(buddy);
    const cast = el('div', 'cast');
    D.FRIENDS.filter(f => f.id !== (St.s.reward.friend || 'mong')).forEach((f, i) => {
      const own = f.lv <= St.s.reward.level;
      const c = btn('cast-pal' + (own ? '' : ' locked'), UI.mascot(own ? 'happy' : 'think', {}, f.id) + (own ? '' : `<i>레벨 ${f.lv}</i>`), () => {
        if (!own) { UI.oops(c); return; }
        c.classList.remove('jump'); void c.offsetWidth; c.classList.add('jump'); A.sfx(UI.pick(['yay1', 'yay2', 'pop']));
      }, f.name);
      c.style.animationDelay = (i * 0.3) + 's';
      cast.appendChild(c);
    });
    left.appendChild(cast);
    wrap.appendChild(left);
    const right = el('div', 'home-right');
    right.appendChild(mapStrip(stage));
    const done = St.todayCount() >= St.s.settings.perDay;
    const play = btn('play-go' + (done ? ' rest' : ''), done
      ? '<span class="pg-ico">🎠</span><span class="pg-txt">놀이터</span><small>오늘 모험 끝! 더 놀자</small>'
      : `<span class="pg-ico">▶</span><span class="pg-txt">놀자!</span><small>${esc(world.icon + ' ' + stage.title)}</small>`,
    () => (done ? App.playground() : App.runStage(stage)), '놀자');
    right.appendChild(play);
    const row = el('div', 'home-row');
    const newN = St.s.reward.newStickers.length;
    row.appendChild(btn('home-tile', `<span>📒</span><b>스티커</b><small>${St.stickerCount()}/120</small>${newN ? `<i class="badge">${newN}</i>` : ''}`, () => App.stickers(), '스티커북'));
    row.appendChild(btn('home-tile', '<span>👗</span><b>옷장</b>', () => App.closet(), '옷장'));
    row.appendChild(btn('home-tile', '<span>🎠</span><b>놀이터</b>', () => App.playground(), '놀이터'));
    right.appendChild(row);
    wrap.appendChild(right);
    m.appendChild(wrap);
    if (first) {
      const d = St.checkDaily();
      if (d) { await dailyGift(d); if (App.screen === 'home') { await App.home(); } }
      A.play('ui_hiname');
    }
  };
  function mapStrip(stage) {
    const box = el('div', 'map');
    const world = D.WORLDS[stage.w];
    box.style.setProperty('--wc', world.color);
    box.appendChild(el('div', 'map-title', `${world.icon} ${esc(world.name)} <small>${stage.id} / ${D.STAGES.length}</small>`));
    const path = el('div', 'map-path');
    const from = Math.max(1, Math.min(stage.id - 3, D.STAGES.length - 6));
    for (let i = from; i < from + 7 && i <= D.STAGES.length; i++) {
      const s = D.STAGES[i - 1];
      const st = St.s.learn.done[i] ? 'done' : (i === stage.id ? 'now' : 'soon');
      const n = el('span', 'stone ' + st, st === 'done' ? '⭐' : (st === 'now' ? UI.mascot('happy') : String(i)));
      n.title = s.title;
      path.appendChild(n);
    }
    box.appendChild(path);
    return box;
  }

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
  function stickerHtml(s, cls) { return `<span class="stk r${s.r} ${cls || ''}"><span>${s.e}</span></span>`; }
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
    App._levelUp = false;
    const m = main();
    m.innerHTML = '';
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
    if (stage.k === 'review') { St.s.learn.reviews = (St.s.learn.reviews || 0) + 1; St.save(); } else St.finishStage(stage.id, ctx.right, ctx.wrong);
    await chest(ctx);
    if (!ctx.alive()) return;
    if (App._levelUp) await levelUp();
    if (!ctx.alive()) return;
    App.home();
  };
  const PLAY_ICON = { meet: '🔤', chant: '🎵', pop: '🎈', pick: '🖼️', clap: '🥁', first: '👂', block: '🧱', trace: '✏️', train: '🚂', memory: '🃏', batchim: '💎', story: '📖' };

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
    book.appendChild(el('p', 'book-count', `${esc(D.STICKER_SETS[tab][0])} · 모두 ${St.stickerCount()} / 120`));
    m.appendChild(book);
    St.s.reward.newStickers = St.s.reward.newStickers.filter(id => D.STICKERS[id].set !== tab);
    St.save();
  };

  /* ---------- closet ---------- */
  const SLOTS = [['friend', '친구', '🐰'], ['hat', '모자', '🎩'], ['eyes', '안경', '👓'], ['neck', '목', '🎀'], ['back', '망토', '🦸'], ['body', '색', '🎨']];
  App.closet = function (slot) {
    leave(); App.sess++; A.stop();
    App.screen = 'closet';
    slot = slot || 'friend';
    const m = main();
    m.innerHTML = '';
    m.dataset.screen = 'closet';
    m.appendChild(hud({ home: true }));
    const R = St.s.reward;
    const wrap = el('div', 'closet');
    wrap.appendChild(el('div', 'closet-model', UI.mascot('joy')));
    const side = el('div', 'closet-side');
    const tabs = el('div', 'closet-tabs');
    SLOTS.forEach(([k, name, ico]) => tabs.appendChild(btn('ctab' + (k === slot ? ' on' : ''), `<span>${ico}</span><small>${name}</small>`, () => { A.sfx('tap'); App.closet(k); }, name)));
    side.appendChild(tabs);
    const grid = el('div', 'closet-grid');
    if (slot === 'friend') D.FRIENDS.forEach(f => {
      const own = f.lv <= R.level, on = (R.friend || 'mong') === f.id;
      const it = btn('citem' + (own ? ' own' : ' locked') + (on ? ' on' : ''), `<span class="cprev">${UI.mascot('happy', {}, f.id)}</span><b>${esc(f.name)}</b><small>${on ? '내 짝꿍' : own ? '고르기' : '🔒 레벨 ' + f.lv}</small>`, () => {
        if (!own) { UI.oops(it); return; }
        R.friend = f.id; St.save(); A.sfx('fanfare'); UI.burst(null, 20); App.closet('friend');
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
    m.dataset.screen = 'playground';
    m.appendChild(hud({ home: true }));
    const wrap = el('div', 'pg scroll');
    const doneIds = Object.keys(St.s.learn.done).map(Number).sort((a, b) => a - b);
    const cur = St.stage();
    const rv = btn('pg-item review', '<span>🔁</span><b>복습 모험<br><small>할 때마다 새 문제!</small></b>', () => App.runStage({ id: 0, w: cur.w, k: 'review', title: '복습 모험' }, true), '복습 모험');
    rv.style.setProperty('--wc', '#FF8FB8');
    wrap.appendChild(rv);
    if (!doneIds.length) wrap.appendChild(el('p', 'pg-empty', '모험을 하나 끝내면 여기서 다시 놀 수 있어!'));
    doneIds.slice(-24).reverse().forEach(id => {
      const s = D.STAGES[id - 1], w = D.WORLDS[s.w];
      const b = btn('pg-item', `<span>${w.icon}</span><b>${esc(s.title)}</b>`, () => App.runStage(s, true), s.title);
      b.style.setProperty('--wc', w.color);
      wrap.appendChild(b);
    });
    m.appendChild(wrap);
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
        <section><h3>설정</h3>
          <label class="pm-row">하루 모험 수
            <select id="pmPer">${[1, 2, 3, 4].map(n => `<option ${n === S.perDay ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="pm-row">목소리 크기 <input id="pmVoice" type="range" min="0" max="1" step="0.1" value="${S.voice}"></label>
          <label class="pm-row">효과음 크기 <input id="pmSfx" type="range" min="0" max="1" step="0.1" value="${S.sfx}"></label>
          <label class="pm-row"><input id="pmBgm" type="checkbox" ${S.bgm ? 'checked' : ''}> 홈 화면 배경 음악 (놀이 중에는 꺼짐)</label>
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
        <section><h3>정보</h3><p id="pmInfo">버전 v6 · 인터넷 없이 쓸 준비를 확인하는 중…</p></section>
      </div>`;
    $('#pmClose').addEventListener('click', closeParent);
    $('#pmGo').addEventListener('click', () => { St.setStage(+$('#pmStage').value); msg('단계를 바꿨습니다.'); });
    $('#pmPer').addEventListener('change', e => { S.perDay = +e.target.value; St.save(); });
    $('#pmVoice').addEventListener('input', e => { S.voice = +e.target.value; A.setVolume(S.voice, S.sfx); St.save(); });
    $('#pmSfx').addEventListener('input', e => { S.sfx = +e.target.value; A.setVolume(S.voice, S.sfx); St.save(); A.sfx('correct'); });
    $('#pmBgm').addEventListener('change', e => { S.bgm = e.target.checked; St.save(); });
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
  /* ---------- parent-run reading check ---------- */
  const CHECK = [
    ['모음', 'ㅏㅓㅗㅜㅡㅣ'.split('')],
    ['자음', 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('')],
    ['글자', '가나다라마바사아자차카타파하'.split('')],
    ['받침 글자', '강눈곰달책밥옷'.split('')],
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
    const box = $('#parent');
    box.hidden = true;
    box.innerHTML = '';
    setAdult(false);
    App.home();
  }
  async function offlineInfo() {
    const info = $('#pmInfo');
    try {
      if (!('caches' in G)) { info.textContent = '버전 v6 · 이 브라우저는 오프라인 저장을 지원하지 않습니다.'; return; }
      const keys = await caches.keys();
      const k = keys.find(x => x.startsWith('hangul-v6'));
      if (!k) { info.textContent = '버전 v6 · 오프라인 저장 준비 중(처음 한 번은 인터넷이 필요합니다).'; return; }
      const c = await caches.open(k);
      const n = (await c.keys()).length;
      const want = G.SW_FILES_COUNT || n;
      info.textContent = `버전 v6 · 오프라인 저장 ${n}/${want}개 파일${n >= want ? ' · 인터넷 없이 쓸 수 있습니다' : ''}`;
    } catch (e) { info.textContent = '버전 v6'; }
  }

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
