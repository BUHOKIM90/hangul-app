'use strict';
(function () {
  const $ = s => document.querySelector(s);
  const X = () => window.V5X;
  const C = () => window.V5C;
  const main = () => $('#main');
  const VP_KID = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  const VP_ADULT = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover';
  let run = null;
  let greeted = false;
  let gate = null;
  let resetArm = false;
  let bookPage = 0;

  function applyForm() {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    document.documentElement.dataset.orient = w > h ? 'land' : 'port';
  }
  function setZoom(on) {
    const m = document.querySelector('meta[name="viewport"]');
    if (m) m.setAttribute('content', on ? VP_ADULT : VP_KID);
    document.documentElement.dataset.adult = on ? '1' : '0';
  }
  function chrome(screen) {
    const home = screen === 'home';
    const back = $('#homeBtn');
    const lesson = screen === 'play' || (screen === 'reward' && run && run.mode === 'lesson');
    back.hidden = home;
    back.dataset.tap = lesson ? 'go-map' : 'go-home';
    back.textContent = lesson ? '마을' : '홈';
    back.setAttribute('aria-label', lesson ? '마을로 가기' : '처음으로');
    X().syncSound();
    const pop = document.getElementById('praise');
    if (pop) pop.hidden = true;
    document.dispatchEvent(new CustomEvent('v5-screen'));
    const waiting = window.__swWaiting;
    if (screen === 'home' && waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  function currentLesson() {
    return C().LESSONS.find(l => !X().S.done[l.id]) || C().LESSONS[C().LESSONS.length - 1];
  }
  function playMeta(id) { return C().PLAYS.find(p => p.id === id); }
  function awardSticker() {
    const next = V5Stick.list.find(s => X().S.stickers.indexOf(s.id) < 0);
    if (!next) return null;
    X().S.stickers.push(next.id);
    X().save();
    return next;
  }
  let peelGo = 'map';
  function assetSrc(file) {
    return String(file || '').split('/').map(encodeURIComponent).join('/');
  }
  function peelStage(st) {
    if (!st) return '<p class="meta">스티커를 다 모았어!</p>';
    return '<div class="gift"><p class="gift-kicker">새 스티커!</p><div class="peel" data-sticker="' + st.id + '"><div class="peel-slot"></div><div class="peel-bit"><img alt="" width="256" height="256" src="' + assetSrc(st.file) + '"></div></div><p class="st-name">' + st.name + '</p><p class="st-theme">' + st.themeKo + '</p></div>';
  }
  function rewardChip(item) {
    if (!item) return '';
    return '<div class="reward-chip"><i style="' + thumbStyle(item) + '"></i><span>새 옷 · ' + item.label + '</span></div>';
  }

  function homeHTML() {
    const S = X().S;
    const lesson = currentLesson();
    return '<section class="home"><div class="scene"><img class="scene-bg" alt="" width="1024" height="768" fetchpriority="high" sizes="100vw" src="assets/pic/scene_01-800.webp" srcset="assets/pic/scene_01-800.webp 800w, assets/pic/scene_01.webp 1024w"><div class="scene-top"><p class="meta" id="home-meta">' + lesson.kid + ' · 스티커 ' + S.stickers.length + '/' + V5Stick.list.length + '</p><p id="bubble" class="home-say">오늘도 같이 놀자</p></div><div class="cast" id="friend-row"></div><img class="buddy" alt="" width="512" height="512" sizes="(min-width: 800px) 28vw, 42vw" src="assets/char/monggeul_wave-256.webp" srcset="assets/char/monggeul_wave-256.webp 256w, assets/char/monggeul_wave.webp 512w"><div class="home-dock"><button type="button" class="tap play-go" data-tap="go-map"><img alt="" src="assets/icons/play.svg"><span>놀자</span></button><button type="button" class="tap pic-tile" data-tap="stickers"><img alt="" src="assets/stickers/animal_04_곰.webp"><span>스티커</span></button><button type="button" class="tap pic-tile" data-tap="dress"><img alt="" src="assets/friends/tori.webp"><span>옷</span></button></div></div></section>';
  }
  function showHome() {
    X().dropQueue();
    run = null;
    main().dataset.screen = 'home';
    main().innerHTML = homeHTML();
    fillHomeExtras();
    chrome('home');
  }
  function faceBtn(ch, i) {
    return '<button type="button" class="tap pal pal-' + i + '" data-tap="dress" data-who="' + ch.id + '" aria-label="' + ch.name + '"><img alt="" width="512" height="512" src="' + ch.body + '"><span>' + ch.name + '</span></button>';
  }
  function faceCrop(ch) {
    const side = 250;
    const scale = 56 / side;
    const x = ch.head[0], y = ch.head[1];
    const left = -((x - side / 2) * scale);
    const top = -((y - side / 2 - 10) * scale);
    return 'background-image:url(' + ch.body + ');background-repeat:no-repeat;background-size:' + (512 * scale) + 'px ' + (512 * scale) + 'px;background-position:' + left.toFixed(1) + 'px ' + top.toFixed(1) + 'px';
  }
  function stoneSpots(w, h) {
    const size = 64, minGap = 8, m = size / 2 + 6;
    const iw = Math.max(size, w - m * 2);
    const ih = Math.max(size, h - m * 2);
    let cols = w >= h * 1.05 ? 4 : 3;
    while (cols > 2 && cols * size + (cols - 1) * minGap > iw) cols -= 1;
    let rows = Math.ceil(8 / cols);
    while (rows * size + (rows - 1) * minGap > ih && cols < 8) {
      cols += 1;
      rows = Math.ceil(8 / cols);
    }
    const colGap = cols === 1 ? 0 : (iw - cols * size) / (cols - 1);
    const rowGap = rows === 1 ? 0 : (ih - rows * size) / (rows - 1);
    const spots = [];
    for (let i = 0; i < 8; i++) {
      const r = Math.floor(i / cols);
      const rowCount = Math.min(cols, 8 - r * cols);
      const c0 = i - r * cols;
      const c = (r % 2) ? (rowCount - 1 - c0) : c0;
      const rowWidth = rowCount * size + (rowCount - 1) * colGap;
      const x0 = m + (iw - rowWidth) / 2;
      spots.push([
        x0 + c * (size + colGap) + size / 2,
        m + ih - r * (size + rowGap) - size / 2
      ]);
    }
    return spots;
  }
  function layoutMap() {
    const world = document.querySelector('.world');
    if (!world || main().dataset.screen !== 'map') return;
    const w = world.clientWidth;
    const h = world.clientHeight;
    if (w < 80 || h < 80) return;
    const btn = document.querySelector('.map-go');
    let boxH = h;
    if (btn) {
      const wr = world.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      if (br.top < wr.bottom - 4 && br.bottom > wr.top && br.left < wr.right - 8 && br.right > wr.left + 8) {
        boxH = Math.max(120, h - (wr.bottom - br.top) - 8);
      }
    }
    const spots = stoneSpots(w, boxH);
    const btns = world.querySelectorAll('.stone-btn');
    btns.forEach((el, i) => {
      const p = spots[i];
      if (!p) return;
      el.style.left = (p[0] / w * 100) + '%';
      el.style.top = (p[1] / h * 100) + '%';
    });
    const poly = world.querySelector('.trail polyline');
    if (poly) poly.setAttribute('points', spots.map(p => (p[0] / w * 100).toFixed(1) + ',' + (p[1] / h * 100).toFixed(1)).join(' '));
    const walker = world.querySelector('.walker');
    const today = world.querySelector('.stone-btn.is-today');
    if (walker && today) {
      walker.style.left = today.style.left;
      walker.style.top = today.style.top;
    }
  }
  function showMap() {
    X().dropQueue();
    const lesson = currentLesson();
    const nodes = [[22, 58], [40, 48], [62, 56], [78, 42], [56, 34], [34, 30], [22, 20], [48, 16]];
    const pts = nodes.map(p => p[0] + ',' + p[1]).join(' ');
    const stones = C().LESSONS.map((l, i) => {
      const did = !!X().S.done[l.id];
      const today = l.id === lesson.id;
      const art = did ? 'stone_done' : today ? 'stone_today' : 'stone_soon';
      const xy = nodes[i] || nodes[nodes.length - 1];
      const pos = 'left:' + xy[0] + '%;top:' + xy[1] + '%';
      const inner = '<img alt="" src="assets/pic/map/' + art + '.webp"><b>' + l.id + '</b>';
      if (!did && !today) return '<button type="button" class="tap stone-btn is-soon" data-tap="later" style="' + pos + '" aria-label="' + l.title + ' 아직">' + inner + '</button>';
      return '<button type="button" class="tap stone-btn' + (today ? ' is-today' : '') + (did ? ' is-done' : '') + '" data-tap="start-lesson" data-id="' + l.id + '" style="' + pos + '" aria-label="' + l.title + '">' + inner + '</button>';
    }).join('');
    const here = nodes[lesson.id - 1] || nodes[0];
    main().dataset.screen = 'map';
    main().innerHTML = '<section class="map"><div class="world"><img class="world-bg" alt="" src="assets/pic/map_w1.webp"><img class="landmark lm-a" alt="" src="assets/pic/map/lm_pizza.webp"><img class="landmark lm-b" alt="" src="assets/pic/map/lm_train.webp"><img class="landmark lm-c" alt="" src="assets/pic/map/lm_garden.webp"><img class="landmark lm-d" alt="" src="assets/pic/map/lm_pond.webp"><svg class="trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '"/></svg>' + stones + '<img class="walker" alt="" src="assets/pic/map/mong_walk_1.webp" style="left:' + here[0] + '%;top:' + here[1] + '%"></div><button type="button" class="tap play-go map-go" data-tap="start-lesson" data-id="' + lesson.id + '"><img alt="" src="assets/icons/play.svg"><span>' + lesson.kid + ' 놀자</span></button><div class="play-grid">' + C().PLAYS.map(p => '<button type="button" class="tap play-door" data-tap="practice" data-play="' + p.id + '"><img alt="" src="' + p.icon + '"><b>' + p.kid + '</b></button>').join('') + '</div></section>';
    chrome('map');
    requestAnimationFrame(() => { layoutMap(); requestAnimationFrame(layoutMap); });
  }
  function showPlay(spec) {
    X().dropQueue();
    const meta = playMeta(spec.type);
    const step = spec.mode === 'lesson' && run
      ? '<div class="meter step-meter">' + run.steps.map((_, i) => '<i class="' + (i < run.i ? 'is-on' : i === run.i ? 'is-now' : '') + '"></i>').join('') + '</div>'
      : '';
    main().dataset.screen = 'play';
    main().dataset.play = spec.type;
    main().innerHTML = '<section class="play"><div class="play-head"><img id="mascot" class="mascot" alt="" width="512" height="512" src="assets/char/monggeul_think.webp"><div><p class="kicker">' + meta.kid + '</p>' + step + '</div><button type="button" class="tap icon" id="replayBtn" data-tap="replay" data-n="0" aria-label="다시 듣기"><img alt="" src="assets/icons/speaker.svg"></button></div><p id="bubble" class="bubble">잘 들어 봐</p><div id="stage"></div></section>';
    chrome('play');
    V5Play.mount($('#stage'), spec, afterStep);
  }
  function afterStep(helped) {
    if (!run) return showMap();
    run.stars = run.stars || [];
    run.stars.push(!helped);
    const st = awardSticker();
    const item = X().unlockNext();
    if (run.mode === 'practice') return showPeel(st, item, 'map');
    run.i += 1;
    if (run.i < run.steps.length) return showPeel(st, item, 'step');
    X().S.done[run.lesson.id] = X().stamp();
    X().save();
    showPeel(st, item, 'done');
  }
  function showPeel(st, item, go) {
    X().dropQueue();
    peelGo = go;
    const label = go === 'map' ? '마을로' : '다음';
    main().dataset.screen = 'reward';
    main().dataset.sticker = st ? st.id : '';
    main().innerHTML = '<section class="end"><h1>스티커!</h1>' + peelStage(st) + rewardChip(item) + '<button type="button" class="tap xl" data-tap="peel-next">' + label + '</button></section>';
    chrome('reward');
    settlePeel();
    X().say('ui_sticker', '스티커를 받았어!');
    X().confetti();
  }
  function settlePeel() {
    const root = main();
    const go = () => {
      const bit = root.querySelector('.peel-bit');
      const slot = root.querySelector('.peel-slot');
      if (!bit || !slot || slot.querySelector('img')) return;
      const img = bit.querySelector('img');
      if (!img) return;
      slot.appendChild(img);
      slot.classList.add('is-filled');
      bit.classList.add('is-gone');
      const sheet = root.querySelector('.peel-sheet');
      if (sheet) sheet.classList.add('is-used');
    };
    const bit = root.querySelector('.peel-bit');
    if (bit) bit.addEventListener('animationend', go);
    setTimeout(go, 980);
  }
  function starsHTML(stars) {
    const row = stars && stars.length ? stars : [true, true, true, true, true, true, true, true];
    return '<div class="stars">' + row.map(on => '<img class="' + (on ? 'is-on' : 'is-dim') + '" alt="" src="assets/icons/sun.svg">').join('') + '</div>';
  }
  function afterPeel() {
    if (peelGo === 'step' && run) {
      showPlay({ mode: 'lesson', type: run.steps[run.i], lesson: run.lesson });
      return;
    }
    if (peelGo === 'done') {
      showDone(awardSticker(), X().unlockNext());
      return;
    }
    showMap();
  }
  function showDone(st, item) {
    const stars = run && run.stars ? run.stars.slice() : [];
    X().dropQueue();
    run = null;
    main().dataset.screen = 'done';
    main().dataset.sticker = st ? st.id : '';
    main().innerHTML = '<section class="end festival"><div class="done-hero"><img id="mascot" class="mascot big dance" alt="" width="512" height="512" src="assets/char/monggeul_jump.webp"><h1>오늘 놀이 끝!</h1>' + starsHTML(stars) + '<p id="bubble" class="bubble">오늘은 여기까지! 내일 또 만나요.</p></div><div class="done-reward">' + peelStage(st) + rewardChip(item) + '<div class="end-dock"><button type="button" class="tap pic-tile" data-tap="dress"><img alt="" src="assets/friends/bori.webp"><span>옷</span></button><button type="button" class="tap pic-tile" data-tap="stickers"><img alt="" src="assets/stickers/animal_04_곰.webp"><span>스티커</span></button><button type="button" class="tap play-go" data-tap="back-map"><img alt="" src="assets/icons/play.svg"><span>마을로</span></button></div></div></section>';
    chrome('done');
    settlePeel();
    X().say(C().UI.end, '오늘은 여기까지! 내일 또 만나요.');
    X().confetti();
  }
  function showStickers() {
    X().dropQueue();
    const themes = V5Stick.ORDER;
    if (bookPage >= themes.length) bookPage = 0;
    if (bookPage < 0) bookPage = 0;
    const theme = themes[bookPage];
    const slice = V5Stick.list.filter(s => s.theme === theme);
    const owned = X().S.stickers;
    main().dataset.screen = 'stickers';
    main().dataset.theme = theme;
    main().innerHTML = '<section class="book"><h1>스티커 책</h1><p class="meta">' + owned.length + ' / ' + V5Stick.list.length + ' · ' + V5Stick.THEME_KO[theme] + '</p><div class="book-grid">' + slice.map(st => {
      const has = owned.indexOf(st.id) >= 0;
      return '<figure class="sticker' + (has ? ' is-in' : ' is-ghost') + '"><img alt="" width="256" height="256" src="' + assetSrc(st.file) + '"><figcaption>' + st.name + '</figcaption></figure>';
    }).join('') + '</div><div class="pager"><button type="button" class="tap" data-tap="book-prev" aria-label="이전 쪽">이전</button><span>' + (bookPage + 1) + ' / ' + themes.length + '</span><button type="button" class="tap" data-tap="book-next" aria-label="다음 쪽">다음</button></div></section>';
    chrome('stickers');
  }
  function thumbStyle(it) {
    if (it.paint && it.paint.background) return 'background:' + it.paint.background;
    if (!it.file) return '';
    const src = X().itemFile(it);
    const b = it.box;
    const tile = 88;
    const target = tile * 0.8;
    if (!b) return 'background-image:url(' + src + ');background-repeat:no-repeat;background-position:center;background-size:80%';
    const scale = target / Math.max(b[2], b[3], 1);
    const left = (tile / 2 - (b[0] + b[2] / 2) * scale).toFixed(1);
    const top = (tile / 2 - (b[1] + b[3] / 2) * scale).toFixed(1);
    const size = (512 * scale).toFixed(1);
    return 'background-image:url(' + src + ');background-repeat:no-repeat;background-size:' + size + 'px ' + size + 'px;background-position:' + left + 'px ' + top + 'px';
  }
  function showDress() {
    X().dropQueue();
    const data = X().dressData();
    const who = X().S.who || 'monggeul';
    const ch = X().charBy(who) || data.characters[0];
    X().S.who = ch.id;
    const wear = X().S.wear[ch.id] || {};
    const mine = data.items.filter(it => it.character === ch.id);
    const slots = data.slots || [];
    const labels = data.slot_label || {};
    main().dataset.screen = 'dress';
    main().dataset.who = ch.id;
    main().innerHTML = '<section class="dress"><div class="dress-stage"><h1>옷 입히기</h1><div class="who-row">' + data.characters.map(c => '<button type="button" class="tap who' + (c.id === ch.id ? ' is-on' : '') + '" data-tap="who" data-who="' + c.id + '" aria-label="' + c.name + '"><span class="mini" style="' + faceCrop(c) + '"></span><b>' + c.name + '</b></button>').join('') + '</div><p class="meta">' + ch.blurb + ' · 옷 ' + X().S.unlocks.length + '/' + data.items.length + '</p><div class="doll" data-doll>' + X().layerHTML(ch.id) + '</div></div><div class="tray">' + slots.map(slot => {
      const items = mine.filter(it => it.slot === slot);
      if (!items.length) return '';
      return '<h2>' + (labels[slot] || slot) + '</h2><div class="tray-row">' + items.map(it => {
        const on = wear[slot] === it.id;
        const open = X().isUnlocked(it);
        const fresh = X().S.freshItem === it.id ? ' is-fresh' : '';
        return '<button type="button" class="tap gear' + (on ? ' is-on' : '') + (open ? '' : ' is-locked') + fresh + '" data-tap="equip" data-item="' + it.id + '" data-unlocked="' + (open ? '1' : '0') + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + it.label + '"><i style="' + thumbStyle(it) + '"></i><span>' + (open ? it.label : '잠김') + '</span></button>';
      }).join('') + '</div>';
    }).join('') + '</div></section>';
    chrome('dress');
  }
  function equip(id) {
    const it = X().itemBy(id);
    if (!it) return;
    if (!X().isUnlocked(it)) {
      const b = $('#bubble');
      if (b) b.textContent = '놀이하면 열려요';
      else {
        const p = document.createElement('p');
        p.id = 'bubble';
        p.className = 'bubble';
        p.textContent = '놀이하면 열려요';
        main().querySelector('.dress').prepend(p);
      }
      const btn = main().querySelector('[data-item="' + id + '"]');
      if (btn) { btn.classList.remove('wiggle'); void btn.offsetWidth; btn.classList.add('wiggle'); }
      return;
    }
    const w = X().S.wear[it.character];
    w[it.slot] = w[it.slot] === it.id ? '' : it.id;
    if (X().S.freshItem === it.id) X().S.freshItem = '';
    X().save();
    showDress();
  }

  function openGate() {
    X().dropQueue();
    setZoom(false);
    gate = { a: 6 + Math.floor(Math.random() * 4), b: 6 + Math.floor(Math.random() * 4), typed: '' };
    const g = $('#gate');
    g.hidden = false;
    drawGate();
  }
  function drawGate() {
    const g = $('#gate');
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '지움', 0];
    g.innerHTML = '<div class="sheet" role="dialog" aria-label="어른 확인"><h1>어른 확인</h1><p>답을 눌러 주세요</p><p class="sum-line"><span>' + gate.a + ' + ' + gate.b + ' =</span> <b id="gateAns">' + (gate.typed || '?') + '</b></p><div class="keys">' + keys.map(n => '<button type="button" class="tap" data-tap="gate-key" data-n="' + (n === '지움' ? 'del' : n) + '">' + n + '</button>').join('') + '</div><button type="button" class="tap" data-tap="gate-close">닫기</button></div>';
  }
  function closeGate() { $('#gate').hidden = true; $('#gate').innerHTML = ''; gate = null; }
  function openParent() {
    closeGate();
    setZoom(true);
    resetArm = false;
    const S = X().S;
    const letters = Object.keys(C().JAMO);
    const cell = j => {
      const sk = S.skill['j:' + j] || S.skill['s:' + j];
      let cls = 'new', lab = '새것';
      if (sk && sk.box >= 4) { cls = 'known'; lab = '익힘'; }
      else if (sk && sk.seen) { cls = 'learning'; lab = '배우는 중'; }
      return '<button type="button" class="tap jcell ' + cls + '" data-tap="hear" data-j="' + j + '" aria-label="' + j + ' ' + lab + '"><b>' + j + '</b><small>' + lab + '</small></button>';
    };
    $('#parent').hidden = false;
    $('#parent').innerHTML = '<div class="sheet adult" role="dialog" aria-label="어른 메뉴"><div class="adult-head"><h1>어른 메뉴</h1><button type="button" class="tap" data-tap="close-parent" aria-label="닫기">닫기</button></div><p class="note">이 창이 열린 동안만 화면을 확대할 수 있어요.</p><h2>오늘</h2><p id="timeUsed" class="meta"></p><p class="meta">오늘 길 · ' + currentLesson().title + '</p><p class="goal">' + currentLesson().goal + '</p><h2>글자</h2><div class="jgrid">' + letters.map(cell).join('') + '</div><h2>설정</h2><div class="row"><span>소리</span><button type="button" class="tap" data-tap="sound">' + (S.sound ? '켜짐' : '꺼짐') + '</button></div><div class="row"><span>색 힌트</span><button type="button" class="tap" data-tap="hint-toggle">' + (S.colorHints ? '켜짐' : '꺼짐') + '</button></div><div class="row diffs"><span>난이도</span><button type="button" class="tap' + (S.difficulty === 'easy' ? ' is-on' : '') + '" data-tap="diff" data-v="easy">쉬움</button><button type="button" class="tap' + (S.difficulty === 'mid' ? ' is-on' : '') + '" data-tap="diff" data-v="mid">보통</button><button type="button" class="tap' + (S.difficulty === 'hard' ? ' is-on' : '') + '" data-tap="diff" data-v="hard">도전</button></div><h2>이 놀이</h2><ul class="why">' + C().PLAYS.map(p => '<li><b>' + p.kid + '</b> ' + p.why + '</li>').join('') + '</ul><button type="button" class="tap warn" id="resetBtn" data-tap="reset">처음부터</button><p class="note">기록은 이 기기에만 있어요. 광고·로그인 없음.</p></div>';
    paintTime();
  }
  function paintTime() {
    const el = $('#timeUsed');
    if (!el) return;
    const S = X().S;
    el.textContent = '오늘 ' + Math.floor(S.todayMs / 60000) + '분 · 모두 ' + Math.floor(S.ms / 60000) + '분';
  }
  function closeParent() {
    setZoom(false);
    $('#parent').hidden = true;
    $('#parent').innerHTML = '';
    const screen = main().dataset.screen;
    if (screen === 'home') showHome();
  }

  function onTap(el) {
    if (!greeted) { greeted = true; X().say(C().UI.hello, '안녕! 오늘도 같이 놀자'); }
    const t = el.dataset.tap;
    if (t === 'sound') { X().S.sound = !X().S.sound; X().save(); X().syncSound(); if ($('#parent') && !$('#parent').hidden) openParent(); return; }
    if (t === 'adult') return openGate();
    if (t === 'gate-close') return closeGate();
    if (t === 'gate-key') return gateKey(el.dataset.n);
    if (t === 'close-parent') return closeParent();
    if (t === 'hint-toggle') { X().S.colorHints = !X().S.colorHints; X().save(); openParent(); return; }
    if (t === 'diff') { X().S.difficulty = el.dataset.v; X().save(); openParent(); return; }
    if (t === 'hear') { X().say(C().jamoKey(el.dataset.j)); return; }
    if (t === 'reset') return doReset(el);
    if (t === 'later') {
      el.classList.remove('wiggle');
      void el.offsetWidth;
      el.classList.add('wiggle');
      return;
    }
    if (t === 'go-map' || t === 'back-map') return showMap();
    if (t === 'go-home') return showHome();
    if (t === 'stickers') return showStickers();
    if (t === 'book-prev') { bookPage = (bookPage + V5Stick.ORDER.length - 1) % V5Stick.ORDER.length; return showStickers(); }
    if (t === 'book-next') { bookPage = (bookPage + 1) % V5Stick.ORDER.length; return showStickers(); }
    if (t === 'peel-next') return afterPeel();
    if (t === 'dress') { if (el.dataset.who) X().S.who = el.dataset.who; return showDress(); }
    if (t === 'who') { X().S.who = el.dataset.who; return showDress(); }
    if (t === 'equip') return equip(el.dataset.item);
    if (t === 'practice') {
      run = { mode: 'practice', lesson: currentLesson(), steps: [el.dataset.play], i: 0 };
      return showPlay({ mode: 'practice', type: el.dataset.play, lesson: run.lesson });
    }
    if (t === 'start-lesson') {
      const lesson = C().lesson(+el.dataset.id || currentLesson().id);
      run = { mode: 'lesson', lesson, steps: C().PLAYS.map(p => p.id), i: 0 };
      return showPlay({ mode: 'lesson', type: run.steps[0], lesson });
    }
    if (t === 'replay') return V5Play.replay();
    if (V5Play.tap(el)) return;
  }
  function gateKey(n) {
    if (!gate) return;
    if (n === 'del') gate.typed = gate.typed.slice(0, -1);
    else gate.typed += n;
    const ans = $('#gateAns');
    if (ans) ans.textContent = gate.typed || '?';
    const want = String(gate.a + gate.b);
    if (gate.typed.length >= want.length) {
      if (gate.typed === want) openParent();
      else {
        const sh = $('#gate .sheet');
        if (sh) { sh.classList.remove('wiggle'); void sh.offsetWidth; sh.classList.add('wiggle'); }
        gate.a = 6 + Math.floor(Math.random() * 4);
        gate.b = 6 + Math.floor(Math.random() * 4);
        gate.typed = '';
        setTimeout(drawGate, 280);
      }
    }
  }
  function doReset(el) {
    if (!resetArm) {
      resetArm = true;
      el.textContent = '정말 지울까? 한 번 더';
      return;
    }
    X().reset();
    closeParent();
    showHome();
  }
  function tick() {
    if (document.hidden) return;
    const S = X().S;
    const day = X().stamp();
    if (S.today !== day) { S.today = day; S.todayMs = 0; }
    S.ms += 1000;
    S.todayMs += 1000;
    if (S.ms % 5000 < 1100) X().save();
    paintTime();
  }
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol.indexOf('http') !== 0) return;
    let had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had) { had = true; return; }
      if (main().dataset.screen === 'home' && $('#parent').hidden && $('#gate').hidden) location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(reg => {
      const poke = () => {
        if (main().dataset.screen !== 'home' || !$('#parent').hidden || !$('#gate').hidden) return;
        if (reg.waiting && navigator.serviceWorker.controller) {
          window.__swWaiting = reg.waiting;
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed') poke(); });
      });
      document.addEventListener('v5-screen', poke);
      poke();
    }).catch(() => {});
  }

  function fillHomeExtras() {
    const meta = document.getElementById('home-meta');
    if (meta) meta.textContent = currentLesson().kid + ' · 스티커 ' + X().S.stickers.length + '/' + V5Stick.list.length;
    const row = document.getElementById('friend-row');
    if (!row || !X().dressData()) return;
    const friends = (X().dressData().characters || []).filter(c => c.id !== 'monggeul');
    row.innerHTML = friends.map((ch, i) => faceBtn(ch, i)).join('');
  }
  function boot() {
    applyForm();
    setZoom(false);
    window.addEventListener('resize', () => { applyForm(); layoutMap(); });
    X().setDress({ characters: [], items: [], stack: ['bg', 'body', 'shoes', 'top', 'acc', 'hat'], slots: [], unlock: [], slot_label: {} });
    X().load();
    X().installPointer();
    window.V5 = { onTap, get S() { return X().S; } };
    if (main().dataset.screen === 'home' && document.getElementById('friend-row')) fillHomeExtras();
    else showHome();
    document.documentElement.dataset.ready = '1';
    fetch('assets/dress/manifest.json').then(r => r.json()).then(data => {
      X().setDress(data);
      X().ensureStarters();
      if (main().dataset.screen === 'home') fillHomeExtras();
    }).catch(() => {});
    registerSW();
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) X().save(); });
  }
  boot();
})();
