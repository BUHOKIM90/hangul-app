'use strict';
/* Plays. Scaffold is retry, then a hint, then the answer.
   A star-worthy step is a real choice answered with no miss and no hint. */
(function () {
  const X = () => window.V5X;
  const C = () => window.V5C;
  let ctx = null;
  let onDone = null;
  const TONES = ['tone-0', 'tone-1', 'tone-2', 'tone-3', 'tone-4', 'tone-5'];
  const DECO = [
    'assets/icons/flower.svg', 'assets/icons/fruit.svg', 'assets/icons/sun.svg',
    'assets/icons/sprout.svg', 'assets/stickers/space_07_별.webp'
  ];
  const STAR = 'assets/stickers/space_07_별.webp';

  function assetSrc(file) {
    return String(file || '').split('/').map(encodeURIComponent).join('/');
  }
  function showGain(list) {
    const h = host();
    if (!h || !list.length) return;
    const box = document.createElement('div');
    box.className = 'gain';
    list.forEach(st => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.alt = '';
      img.width = 256;
      img.height = 256;
      img.src = assetSrc(st.file);
      const cap = document.createElement('figcaption');
      cap.textContent = st.name;
      fig.appendChild(img);
      fig.appendChild(cap);
      box.appendChild(fig);
    });
    h.appendChild(box);
  }
  function grantStickers() {
    if (!ctx || ctx.mode !== 'lesson' || !window.V5Stick || !V5Stick.matchAnswer) return [];
    const keys = ctx.rewardKeys || (ctx.skill ? [ctx.skill] : []);
    const got = [];
    keys.forEach(k => {
      if (got.length) return;
      const st = V5Stick.matchAnswer(k);
      if (!st || X().S.stickers.indexOf(st.id) >= 0) return;
      X().S.stickers.push(st.id);
      got.push(st);
    });
    if (!got.length) return [];
    X().save();
    if (window.V5 && V5.noteSticker) got.forEach(st => V5.noteSticker(st));
    return got;
  }
  function showCloth(item) {
    const h = host();
    if (!h || !item) return;
    const p = document.createElement('p');
    p.className = 'meta cloth-note';
    p.textContent = '새 옷 · ' + item.label;
    h.appendChild(p);
  }
  function payAnswer(g) {
    if (g !== 'solo' && g !== 'retry') return;
    const got = grantStickers();
    if (!got.length) return;
    ctx.earned = (ctx.earned || []).concat(got);
    showGain(got);
  }
  function payCloth() {
    if (!ctx || ctx.mode !== 'lesson' || ctx.cloth) return;
    const item = X().markSoloCloth();
    if (!item) return;
    ctx.cloth = item;
    showCloth(item);
    if (window.V5 && V5.noteCloth) V5.noteCloth(item);
  }
  function keysForToken(id) {
    if (C().WORDS && C().WORDS[id]) return ['w:' + id];
    if (typeof id === 'string' && C().isSyl(id)) {
      const p = C().split(id);
      return ['j:' + p.cho, 'j:' + p.jung];
    }
    if (typeof id === 'string' && id.length === 1) return ['j:' + id];
    return [];
  }

  function host() { return document.getElementById('stage'); }
  function bubble(t) {
    const b = document.getElementById('bubble');
    if (!b) return;
    b.classList.remove('praise-line');
    b.textContent = t;
  }
  function tone(s) { return TONES[(s && s.charCodeAt ? s.charCodeAt(0) : 0) % TONES.length]; }
  function nextBtn(label, tapName) {
    const h = host();
    const name = tapName || 'play-next';
    if (!h || h.querySelector('[data-tap="play-next"]') || h.querySelector('[data-tap="trial-next"]')) return;
    const b = document.createElement('button');
    b.className = 'tap xl play-go';
    b.dataset.tap = name;
    b.type = 'button';
    b.textContent = label || '다음';
    h.appendChild(b);
  }
  function gradeNow() {
    if (!ctx.choice) return 'guide';
    if (ctx.revealed) return 'shown';
    if (ctx.hinted) return 'hint';
    if (ctx.misses > 0) return 'retry';
    return 'solo';
  }
  function replayStem() {
    if (!ctx || !ctx.voice) return;
    X().say(ctx.voice.key, ctx.voice.text);
  }
  function endTrial() {
    if (!ctx || ctx.trialOver) return;
    ctx.trialOver = true;
    let g = gradeNow();
    if (g === 'solo' && (ctx.wide || 0) < 3) {
      g = (ctx.skill && X().admitThin(ctx.skill, ctx.occasion)) ? 'solo' : 'thin';
    }
    ctx.grades.push(g);
    if (ctx.skill) X().bump(ctx.skill, g, { occasion: ctx.occasion });
    if (g === 'hint') X().encourage('hint', ctx.focus || '');
    else if (g === 'shown') X().encourage('shown', ctx.focus || '');
    else if (g === 'solo') X().praise({ type: ctx.type, helped: false, focus: ctx.focus || '' });
    else if (g === 'thin') bubble('한 번 맞았어. 다음에 또 보자');
    else if (g === 'retry') X().praise({ type: ctx.type, helped: true, focus: ctx.focus || '' });
    payAnswer(g);
    if (ctx.ti + 1 < ctx.trials.length) {
      nextBtn('또 하나', 'trial-next');
      return;
    }
    const counting = ctx.grades.filter(x => x !== 'thin');
    ctx.playDone = true;
    ctx.counted = counting.length > 0;
    ctx.soloStep = !!ctx.scored && ctx.counted && counting.every(x => x === 'solo');
    if (ctx.soloStep) payCloth();
    nextBtn(ctx.mode === 'practice' ? '마을로' : '다음', 'play-next');
  }
  function assist(el, correct) {
    if (!ctx || ctx.trialOver) return;
    if (el) {
      el.classList.remove('wiggle');
      void el.offsetWidth;
      el.classList.add('wiggle');
    }
    ctx.misses += 1;
    const nodes = (Array.isArray(correct) ? correct : [correct]).filter(Boolean);
    const soon = ctx.skill && X().hintSoon(ctx.skill);
    const canHint = !!X().S.colorHints;
    const wantHint = canHint && !ctx.hinted && nodes.length && (ctx.misses >= 2 || (soon && ctx.misses >= 1));
    if (wantHint && ctx.misses < 3) {
      ctx.hinted = true;
      nodes.forEach(n => n.classList.add('is-sparkle'));
      bubble('반짝이는 데를 봐!');
      X().say(C().UI.hint, '반짝이는 데를 봐!');
      return;
    }
    if (ctx.misses < 2 && !ctx.hinted) {
      bubble('다시 해 볼까?');
      X().say(C().UI.retry, '다시 해 볼까?');
      replayStem();
      return;
    }
    ctx.revealed = true;
    nodes.forEach(n => n.classList.add('show-ans'));
    bubble('같이 해 보자!');
    X().say(C().UI.together, '같이 해 보자!');
    endTrial();
  }
  const GLYPHS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'];
  function take(n, pool, correct) {
    const rest = X().shuffle(pool.filter(x => x !== correct));
    const out = [correct];
    rest.forEach(x => { if (out.length < n && out.indexOf(x) < 0) out.push(x); });
    return X().shuffle(out);
  }
  function fillTo(list, correct, n, fillers) {
    const out = list.slice();
    (fillers || []).forEach(x => {
      if (out.length >= n) return;
      if (x !== correct && out.indexOf(x) < 0) out.push(x);
    });
    return X().shuffle(out);
  }
  function askN() { return C().choiceN(X().S.difficulty); }
  function markWide(n) { ctx.wide = n; ctx.choice = n >= 2; }
  function pickDistinct(pool, n) {
    const out = [];
    X().shuffle(pool.slice()).forEach(x => { if (out.length < n && out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  function hearPool(lesson) {
    const out = [];
    C().LESSONS.forEach(l => {
      if (l.id <= lesson.id) C().hearOf(l).forEach(w => { if (out.indexOf(w) < 0) out.push(w); });
    });
    return out.length >= 2 ? out : C().hearOf(lesson);
  }
  function artFor(g) {
    return C().jamoPic(g) || C().sylPic(g) || STAR;
  }
  function cardsHTML(items, render) {
    return '<div class="choices">' + items.map(render).join('') + '</div>';
  }
  function picCard(id, ok) {
    return '<button type="button" class="tap choice pic-choice ' + tone(id) + '" data-tap="pick" data-ok="' + (ok ? '1' : '0') + '" aria-label="그림"><img alt="" width="512" height="512" src="' + C().pic(id) + '"></button>';
  }
  function glyphCard(g, ok) {
    return '<button type="button" class="tap choice glyph ' + tone(g) + '" data-tap="pick" data-ok="' + (ok ? '1' : '0') + '" aria-label="' + g + '"><img alt="" src="' + artFor(g) + '"><b>' + g + '</b></button>';
  }
  function wordCard(id, ok) {
    const deco = DECO[id.length % DECO.length];
    return '<button type="button" class="tap choice word ' + tone(C().ko(id)) + '" data-tap="pick" data-ok="' + (ok ? '1' : '0') + '" aria-label="' + C().ko(id) + '"><img class="deco" alt="" src="' + deco + '"><b>' + C().ko(id) + '</b></button>';
  }
  function meter(n) {
    let html = '<div class="meter" id="meter">';
    for (let i = 0; i < n; i++) html += '<i></i>';
    return html + '</div>';
  }
  function markMeter(i) {
    const dots = host().querySelectorAll('#meter i');
    if (dots[i]) dots[i].classList.add('is-on');
  }
  function blockAlts(g, lesson, n) {
    const out = [];
    const alt = C().confuse(lesson, g);
    if (alt && alt !== g) out.push(alt);
    const vowels = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'];
    const cons = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ'];
    const pool = vowels.indexOf(g) >= 0 ? vowels : cons;
    (lesson.jamo || []).concat(pool).forEach(j => {
      if (out.length < n && j !== g && out.indexOf(j) < 0) out.push(j);
    });
    return out;
  }
  function knownSyls(lesson) {
    const out = [];
    C().LESSONS.forEach(l => {
      if (l.id <= lesson.id) (l.chant || []).forEach(s => { if (out.indexOf(s) < 0) out.push(s); });
    });
    return out;
  }
  function sylChoices(lesson, answer, n) {
    const out = [answer];
    knownSyls(lesson).concat(['아', '이', '오', '우', '어', '으']).forEach(s => {
      if (out.length < n && s !== answer && out.indexOf(s) < 0) out.push(s);
    });
    return X().shuffle(out);
  }
  function wordChoices(lesson, id, n) {
    const pool = [];
    C().LESSONS.forEach(l => {
      if (l.id > lesson.id) return;
      (l.read || []).forEach(w => {
        if (C().wordDecodable(w, lesson.id) && pool.indexOf(w) < 0) pool.push(w);
      });
      (l.sight || []).forEach(w => { if (pool.indexOf(w) < 0) pool.push(w); });
    });
    if (pool.indexOf(id) < 0) pool.push(id);
    return take(n, pool, id);
  }
  function matchTasks(lesson) {
    const tasks = [];
    (lesson.read || []).forEach(id => {
      if (C().wordDecodable(id, lesson.id)) tasks.push({ kind: 'read', id: id, skill: 'r:' + id });
    });
    (lesson.sight || []).forEach(id => tasks.push({ kind: 'sight', id: id, skill: 'sight:' + id }));
    (lesson.onset || []).forEach(o => tasks.push({ kind: 'onset', word: o.word, syl: o.syl, skill: 's:' + o.syl }));
    if (tasks.length) return tasks;
    const known = C().jamoThrough(lesson.id);
    C().hearOf(lesson).forEach(id => {
      const ch = C().ko(id).charAt(0);
      if (!C().isSyl(ch) || C().hasBatchim(ch)) return;
      const p = C().split(ch);
      if (known.indexOf(p.cho) < 0 || known.indexOf(p.jung) < 0) return;
      tasks.push({ kind: 'onset', word: id, syl: ch, skill: 's:' + ch });
    });
    if (tasks.length) return tasks;
    (lesson.chant || []).forEach(s => tasks.push({ kind: 'syl', syl: s, skill: 's:' + s }));
    return tasks;
  }
  function weakerRead(ids) {
    let best = ids[0];
    let bestSolo = 99;
    ids.forEach(id => {
      const sk = X().S.skill['r:' + id];
      const solo = sk && sk.solo ? sk.solo : 0;
      if (solo < bestSolo) { bestSolo = solo; best = id; }
    });
    return 'r:' + best;
  }
  function memoryPairs(lesson) {
    const reads = (lesson.read || []).filter(id => C().wordDecodable(id, lesson.id));
    if (reads.length >= 2) {
      const pick = X().shuffle(reads).slice(0, 2);
      return {
        skill: weakerRead(pick),
        pairs: pick.map(id => ({ id: id, face: C().ko(id), pic: C().pic(id) }))
      };    }
    let syls = [];
    (lesson.chant || []).forEach(s => { if (syls.indexOf(s) < 0) syls.push(s); });
    ['아', '이', '오', '우'].forEach(s => { if (syls.indexOf(s) < 0) syls.push(s); });
    syls = X().shuffle(syls).slice(0, 2);
    return {
      skill: 's:' + syls[0],
      pairs: syls.map(s => ({ id: s, face: s, pic: C().sylPic(s) || STAR }))
    };
  }
  function weakestKey() {
    const skills = X().S.skill || {};
    let best = '';
    let bestNeed = 0;
    Object.keys(skills).forEach(k => {
      if (!/^(j|r|sight|p|s):/.test(k)) return;
      const it = skills[k];
      if (!it || !it.seen) return;
      const due = it.due && it.due <= Date.now();
      const need = (it.help || 0) * 2 + (due ? 2 : 0) + ((it.solo || 0) === 0 ? 1 : 0) - (it.solo || 0);
      if (need > bestNeed) { bestNeed = need; best = k; }
    });
    return best;
  }

  function renderListen(item, lesson) {
    const target = item.id;
    const n = askN();
    const opts = take(Math.min(n, Math.max(1, hearPool(lesson).length)), hearPool(lesson), target);
    const title = ctx.type === 'treasure' ? '보물 상자 소리' : '어떤 그림일까?';
    markWide(opts.length);
    ctx.skill = item.skill;
    ctx.focus = C().ko(target);
    ctx.rewardKeys = ['w:' + target];
    ctx.voice = { key: C().wordKey(target), text: '잘 들어 봐' };
    const chest = ctx.type === 'treasure' ? '<img class="chest" id="chest" alt="" width="384" height="384" src="assets/pic/chest_closed.webp">' : '';
    host().innerHTML = '<h1 class="prompt">' + title + '</h1>' + chest + cardsHTML(opts, id => picCard(id, id === target));
    bubble('잘 들어 봐');
    X().say(ctx.voice.key, '잘 들어 봐', { keepBubble: true });
  }
  function renderSparkle(item, lesson) {
    const target = item.g;
    const pool = [target];
    const alt = C().confuse(lesson, target);
    if (alt && alt !== target) pool.push(alt);
    (lesson.focus || []).concat(lesson.jamo || []).forEach(g => { if (pool.indexOf(g) < 0) pool.push(g); });
    const opts = fillTo(pool, target, askN(), GLYPHS);
    const title = ctx.type === 'treasure' ? '보물 글자' : '같은 글자를 눌러';
    markWide(opts.length);
    ctx.skill = item.skill;
    ctx.focus = target;
    ctx.rewardKeys = ['j:' + target];
    ctx.voice = { key: C().jamoKey(target), text: title };
    host().innerHTML = '<h1 class="prompt">' + title + '</h1>' + cardsHTML(opts, g => glyphCard(g, g === target));
    X().say(ctx.voice.key, ctx.voice.text);
  }
  function renderBlocks(lesson) {
    const b = lesson.blocks;
    const nDist = X().S.difficulty === 'hard' ? 3 : 2;
    const cons = [b.c].concat(blockAlts(b.c, lesson, nDist));
    const vows = [b.v].concat(blockAlts(b.v, lesson, nDist));
    markWide(Math.min(cons.length, vows.length));
    ctx.skill = 's:' + b.say;
    ctx.focus = b.say;
    ctx.rewardKeys = ['j:' + b.c, 'j:' + b.v];
    ctx.voice = { key: C().sylKey(b.say), text: '소리를 붙여 보자' };
    const pieces = X().shuffle(cons.map(g => ({ g: g, kind: 'cho', ok: g === b.c }))).concat(
      X().shuffle(vows.map(g => ({ g: g, kind: 'jung', ok: g === b.v })))
    );
    host().innerHTML = '<h1 class="prompt">소리를 붙여 보자</h1><div class="goal-pic"><img alt="" width="512" height="512" src="' + C().pic(b.word) + '"></div><div class="slots"><i data-slot="cho">+</i><i data-slot="jung">+</i><b class="sum" hidden></b></div><div class="choices pieces">' + pieces.map(p => '<button type="button" class="tap choice glyph ' + tone(p.g) + '" data-tap="piece" data-kind="' + p.kind + '" data-ok="' + (p.ok ? '1' : '0') + '" aria-label="' + p.g + '"><img alt="" src="' + artFor(p.g) + '"><b>' + p.g + '</b></button>').join('') + '</div>';
    X().say(ctx.voice.key, ctx.voice.text);
  }
  function renderWordMatch(item, lesson) {
    const target = item.id;
    const opts = wordChoices(lesson, target, askN());
    markWide(opts.length);
    ctx.skill = item.skill;
    ctx.focus = C().ko(target);
    ctx.rewardKeys = ['w:' + target];
    ctx.voice = { key: C().wordKey(target), text: '같은 낱말을 골라' };
    host().innerHTML = '<h1 class="prompt">같은 낱말을 골라</h1><div class="hero-pic"><img alt="" width="512" height="512" src="' + C().pic(target) + '"></div><div class="choices">' + opts.map(id => wordCard(id, id === target)).join('') + '</div>';
    X().say(ctx.voice.key, ctx.voice.text);
  }
  function renderOnset(item, lesson) {
    const answer = item.syl;
    const opts = sylChoices(lesson, answer, askN());
    markWide(opts.length);
    ctx.skill = item.skill;
    ctx.focus = answer;
    ctx.rewardKeys = keysForToken(answer);
    const prompt = '처음 소리를 골라';
    ctx.voice = { key: item.word ? C().wordKey(item.word) : C().sylKey(answer), text: prompt };
    const pic = item.word ? C().pic(item.word) : (C().sylPic(answer) || STAR);
    host().innerHTML = '<h1 class="prompt">' + prompt + '</h1><div class="hero-pic"><img alt="" width="512" height="512" src="' + pic + '"></div>' + cardsHTML(opts, g => glyphCard(g, g === answer));
    X().say(ctx.voice.key, ctx.voice.text);
  }
  function renderMemory(item) {
    markWide(4);
    ctx.skill = item.skill;
    ctx.focus = (item.pairs || []).map(p => p.face).join(' · ');
    ctx.rewardKeys = [];
    (item.pairs || []).forEach(p => {
      keysForToken(p.id).forEach(k => { if (ctx.rewardKeys.indexOf(k) < 0) ctx.rewardKeys.push(k); });
    });
    ctx.mem = { open: [] };
    ctx.voice = { key: C().UI.match, text: '같은 짝을 찾아' };
    const cards = [];
    item.pairs.forEach(p => {
      cards.push({ pair: p.id, face: 'pic', pic: p.pic, word: p.face });
      cards.push({ pair: p.id, face: 'word', pic: p.pic, word: p.face });
    });
    const deck = X().shuffle(cards);
    host().innerHTML = '<h1 class="prompt">같은 짝을 찾아</h1><div class="mem">' + deck.map((card, i) => {
      const inner = card.face === 'pic'
        ? '<img alt="" width="512" height="512" src="' + card.pic + '">'
        : '<img class="deco" alt="" src="' + DECO[i % DECO.length] + '"><b>' + card.word + '</b>';
      return '<button type="button" class="tap mem-card ' + tone(card.pair) + '" data-tap="card" data-pair="' + card.pair + '" data-i="' + i + '" aria-label="카드"><span class="back"><img alt="" src="' + STAR + '"></span><span class="front">' + inner + '</span></button>';
    }).join('') + '</div>';
    X().say(ctx.voice.key, ctx.voice.text);
  }
  function renderChant(lesson) {
    ctx.skill = null;
    ctx.choice = false;
    ctx.focus = lesson.chant.join('·');
    ctx.rewardKeys = [];
    ctx.chant = 0;
    const first = lesson.chant[0];
    ctx.voice = { key: C().sylKey(first), text: '소리를 따라 눌러' };
    const firstPic = C().sylPic(first) || STAR;
    host().innerHTML = '<div class="chant-board"><div class="chant-pic"><img id="chantPic" alt="" width="512" height="512" src="' + firstPic + '"><span id="chantWord">' + C().sylWord(first) + '</span></div>' + meter(lesson.chant.length) + '<div class="chant">' + lesson.chant.map((s, i) => {
      const key = C().sylKey(s);
      return '<button type="button" class="tap ctile ' + tone(s) + (i === 0 ? ' is-lit' : '') + '" data-tap="tile" data-i="' + i + '" data-audio="' + key + '" aria-label="' + s + '"><img class="tile-pic" alt="" src="' + (C().sylPic(s) || STAR) + '"><b>' + s + '</b></button>';
    }).join('') + '</div></div>';
    X().say(ctx.voice.key, ctx.voice.text, { now: true });
  }
  function guideStrokes(g) {
    const raw = C().STROKES && C().STROKES[g];
    const one = st => {
      if (st.c) {
        const cx = st.c[0], cy = st.c[1], r = st.c[2], n = 48, pts = [];
        for (let i = 0; i <= n; i++) {
          const t = -i / n * Math.PI * 2;
          pts.push([+(cx + r * Math.sin(t)).toFixed(1), +(cy - r * Math.cos(t)).toFixed(1)]);
        }
        return pts;
      }
      const pts = [];
      for (let i = 0; i < st.length; i++) {
        if (!i) { pts.push([st[0][0], st[0][1]]); continue; }
        const a = st[i - 1], b = st[i];
        const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
        for (let k = 1; k <= steps; k++) pts.push([+(a[0] + (b[0] - a[0]) * k / steps).toFixed(1), +(a[1] + (b[1] - a[1]) * k / steps).toFixed(1)]);
      }
      return pts;
    };
    if (raw && raw.length) return raw.map(one);
    return C().glyphPlan(g, true);
  }
  function dAttr(pts) {
    if (!pts || !pts.length) return '';
    return pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  }
  function renderTrace(lesson) {
    const g = lesson.trace;
    const line = '분홍 선을 따라 손가락으로 써 볼까';
    ctx.skill = 'm:' + g;
    ctx.choice = false;
    ctx.focus = g;
    ctx.rewardKeys = [];
    ctx.trace = { strokes: guideStrokes(g), si: 0, ink: [], pointer: null, glyph: g };
    ctx.voice = { key: '', text: line };
    const pic = C().jamoPic(g) || C().sylPic(g);
    host().innerHTML = '<h1 class="prompt">' + line + '</h1>' + (pic ? '<div class="goal-pic slim"><img alt="" width="512" height="512" src="' + pic + '"></div>' : '') +
      '<div class="trace-board" data-letter="' + g + '"><svg viewBox="-8 -8 116 116" preserveAspectRatio="xMidYMid meet" data-guide="[]">' +
      '<path class="stroke-rest"/><path class="stroke-done"/><path class="stroke-now"/><path class="stroke-ink"/></svg></div>';
    bubble(line);
    drawTrace();
    bindTrace(host().querySelector('.trace-board'));
  }
  function drawTrace() {
    const svg = host().querySelector('.trace-board svg');
    if (!svg || !ctx || !ctx.trace) return;
    const tr = ctx.trace;
    const cur = tr.strokes[tr.si] || [];
    svg.querySelector('.stroke-done').setAttribute('d', tr.strokes.slice(0, tr.si).map(dAttr).join(' '));
    svg.querySelector('.stroke-rest').setAttribute('d', tr.strokes.slice(tr.si + 1).map(dAttr).join(' '));
    svg.querySelector('.stroke-now').setAttribute('d', dAttr(cur));
    svg.querySelector('.stroke-ink').setAttribute('d', dAttr(tr.ink));
    svg.setAttribute('data-guide', JSON.stringify(cur));
    svg.setAttribute('data-left', String(Math.max(0, tr.strokes.length - tr.si)));
  }
  function nearPts(p, ink, tol) {
    const t2 = tol * tol;
    for (let i = 0; i < ink.length; i++) {
      const dx = ink[i][0] - p[0], dy = ink[i][1] - p[1];
      if (dx * dx + dy * dy <= t2) return true;
    }
    return false;
  }
  function strokeDone(guide, ink) {
    if (!guide.length || ink.length < 2) return false;
    const tol = 18;
    let hit = 0;
    for (let i = 0; i < guide.length; i++) if (nearPts(guide[i], ink, tol)) hit++;
    return hit / guide.length >= 0.7 && nearPts(guide[0], ink, tol) && nearPts(guide[guide.length - 1], ink, tol);
  }
  function bindTrace(board) {
    const svg = board.querySelector('svg');
    const local = e => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = pt.matrixTransform(m.inverse());
      return [p.x, p.y];
    };
    board.addEventListener('pointerdown', e => {
      if (!ctx || !ctx.trace || ctx.trialOver || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (e.cancelable) e.preventDefault();
      try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const p = local(e);
      if (!p) return;
      ctx.trace.pointer = e.pointerId;
      ctx.trace.ink = [p];
      drawTrace();
    });
    board.addEventListener('pointermove', e => {
      if (!ctx || !ctx.trace || ctx.trace.pointer !== e.pointerId) return;
      const p = local(e);
      if (!p) return;
      ctx.trace.ink.push(p);
      drawTrace();
    });
    const end = e => {
      if (!ctx || !ctx.trace || ctx.trace.pointer !== e.pointerId) return;
      ctx.trace.pointer = null;
      const guide = ctx.trace.strokes[ctx.trace.si] || [];
      if (strokeDone(guide, ctx.trace.ink)) {
        ctx.trace.si += 1;
        ctx.trace.ink = [];
        drawTrace();
        if (ctx.trace.si >= ctx.trace.strokes.length) finishTrace();
        return;
      }
      ctx.trace.ink = [];
      drawTrace();
    };
    board.addEventListener('pointerup', end);
    board.addEventListener('pointercancel', end);
  }
  function showSyl(s) {
    const img = host().querySelector('#chantPic');
    const word = host().querySelector('#chantWord');
    const src = C().sylPic(s) || STAR;
    const tile = host().querySelector('.ctile[aria-label="' + s + '"] .tile-pic');
    const same = !!(tile && tile.getAttribute('src') === src);
    if (img) {
      img.hidden = same;
      if (!same) img.src = src;
    }
    const card = host().querySelector('.chant-pic');
    if (card) card.classList.toggle('is-word-only', same);
    if (word) word.textContent = C().sylWord(s);
  }
  function fillBlocks() {
    const b = ctx.lesson.blocks;
    ['cho', 'jung'].forEach(kind => {
      const el = host().querySelector('[data-kind="' + kind + '"][data-ok="1"]');
      const slot = host().querySelector('[data-slot="' + kind + '"]');
      if (el && slot && el.querySelector('b')) slot.textContent = el.querySelector('b').textContent.trim();
    });
    const sum = host().querySelector('.sum');
    if (sum) { sum.hidden = false; sum.textContent = b.say; }
  }
  function onPiece(el) {
    if (ctx.trialOver || el.getAttribute('aria-disabled') === 'true') return;
    const ok = el.dataset.ok === '1';
    const kind = el.dataset.kind;
    if (!ok) {
      assist(el, host().querySelector('[data-kind="' + kind + '"][data-ok="1"]'));
      if (ctx.revealed) fillBlocks();
      return;
    }
    const slot = host().querySelector('[data-slot="' + kind + '"]');
    if (slot && el.querySelector('b')) slot.textContent = el.querySelector('b').textContent.trim();
    el.setAttribute('aria-disabled', 'true');
    el.classList.add('is-off');
    const cho = host().querySelector('[data-slot="cho"]').textContent.trim();
    const jung = host().querySelector('[data-slot="jung"]').textContent.trim();
    const b = ctx.lesson.blocks;
    if (cho === b.c && jung === b.v) {
      const sum = host().querySelector('.sum');
      sum.hidden = false;
      sum.textContent = b.say;
      X().say(C().sylKey(b.say), b.say);
      endTrial();
    } else bubble(kind === 'cho' ? '이제 모음!' : '이제 자음!');
  }
  function sparklePair() {
    const cards = Array.prototype.slice.call(host().querySelectorAll('.mem-card:not(.is-matched)'));
    if (!cards.length) return;
    const pair = cards[0].dataset.pair;
    cards.forEach(c => { if (c.dataset.pair === pair) c.classList.add('is-sparkle'); });
  }
  function closeCards(open) {
    ctx.hold = true;
    setTimeout(() => {
      open.forEach(el => el.classList.remove('is-up'));
      ctx.mem.open = [];
      ctx.hold = false;
    }, 700);
  }
  function onCard(el) {
    if (ctx.trialOver || ctx.hold || el.classList.contains('is-matched') || el.classList.contains('is-up')) return;
    el.classList.add('is-up');
    ctx.mem.open.push(el);
    if (ctx.mem.open.length < 2) return;
    const a = ctx.mem.open[0];
    const b = ctx.mem.open[1];
    if (a.dataset.pair === b.dataset.pair) {
      a.classList.add('is-matched');
      b.classList.add('is-matched');
      ctx.mem.open = [];
      const done = host().querySelectorAll('.mem-card.is-matched').length === host().querySelectorAll('.mem-card').length;
      if (done) endTrial();
      return;
    }
    const open = ctx.mem.open.slice();
    ctx.mem.open = [];
    ctx.misses += 1;
    const soon = ctx.skill && X().hintSoon(ctx.skill);
    const canHint = !!X().S.colorHints;
    if (!ctx.hinted && canHint && (ctx.misses >= 2 || (soon && ctx.misses >= 1)) && ctx.misses < 3) {
      ctx.hinted = true;
      sparklePair();
      bubble('반짝이는 데를 봐!');
      X().say(C().UI.hint, '반짝이는 데를 봐!');
      closeCards(open);
      return;
    }
    if (ctx.misses >= 3 || (!canHint && ctx.misses >= 2)) {
      ctx.revealed = true;
      host().querySelectorAll('.mem-card').forEach(c => c.classList.add('is-up', 'is-matched', 'show-ans'));
      bubble('같이 해 보자!');
      X().say(C().UI.together, '같이 해 보자!');
      ctx.hold = false;
      endTrial();
      return;
    }
    bubble('다시 해 볼까?');
    X().say(C().UI.retry, '다시 해 볼까?');
    closeCards(open);
  }
  function finishGuided() {
    if (ctx.trialOver) return;
    ctx.trialOver = true;
    ctx.playDone = true;
    ctx.soloStep = false;
    ctx.grades = ['guide'];
    nextBtn(ctx.mode === 'practice' ? '마을로' : '다음', 'play-next');
  }
  function onTile(el) {
    if (ctx.trialOver) return;
    if (!el.classList.contains('is-lit')) {
      el.classList.remove('wiggle');
      void el.offsetWidth;
      el.classList.add('wiggle');
      ctx.misses += 1;
      if (ctx.misses >= 2 && X().S.colorHints) {
        const lit = host().querySelector('.ctile.is-lit');
        if (lit) lit.classList.add('is-sparkle');
        ctx.hinted = true;
      }
      const lit = host().querySelector('.ctile.is-lit');
      bubble(ctx.hinted ? '반짝이는 데를 봐!' : '빛나는 칸이야');
      if (lit) {
        const syl = ctx.lesson.chant[+lit.dataset.i];
        X().say(lit.dataset.audio || C().sylKey(syl), lit.getAttribute('aria-label') || syl, { keepBubble: true, now: true });
      }
      return;
    }
    el.classList.remove('is-lit');
    el.classList.add('is-hit');
    const s = ctx.lesson.chant[+el.dataset.i];
    showSyl(s);
    markMeter(ctx.chant);
    X().say(el.dataset.audio || C().sylKey(s), s, { keepBubble: true, now: true });
    const next = host().querySelector('[data-i="' + (ctx.chant + 1) + '"]');
    ctx.chant += 1;
    if (next) {
      next.classList.add('is-lit');
      const ns = ctx.lesson.chant[ctx.chant];
      ctx.voice = { key: C().sylKey(ns), text: '소리를 따라 눌러' };
    } else finishGuided();
  }
  function finishTrace() {
    if (!ctx || ctx.trialOver) return;
    ctx.trialOver = true;
    ctx.playDone = true;
    ctx.soloStep = false;
    ctx.grades = ['guide'];
    if (ctx.skill) X().bump(ctx.skill, 'guide');
    payCloth();
    X().praise({ type: 'trace', helped: false, focus: ctx.focus || '' });
    nextBtn(ctx.mode === 'practice' ? '마을로' : '다음', 'play-next');
  }

  function listenItems(lesson, n) {
    return pickDistinct(C().hearOf(lesson), n).map(id => ({ kind: 'listen', id: id, skill: 'p:' + id }));
  }
  function sparkleItems(lesson, n) {
    const focus = (lesson.focus && lesson.focus.length) ? lesson.focus : (lesson.jamo || []);
    return pickDistinct(focus, n).map(g => ({ kind: 'sparkle', g: g, skill: 'j:' + g }));
  }
  function matchItems(lesson, n) {
    const tasks = matchTasks(lesson);
    const out = [];
    const seen = {};
    X().shuffle(tasks).forEach(t => {
      if (out.length >= n || seen[t.skill]) return;
      seen[t.skill] = 1;
      out.push(t);
    });
    if (!out.length && tasks[0]) out.push(tasks[0]);
    return out;
  }
  function treasureItem(lesson) {
    const key = weakestKey();
    if (key.indexOf('j:') === 0) return { kind: 'sparkle', g: key.slice(2), skill: key };
    if (key.indexOf('sight:') === 0) return { kind: 'sight', id: key.slice(6), skill: key };
    if (key.indexOf('r:') === 0) return { kind: 'read', id: key.slice(2), skill: key };
    if (key.indexOf('p:') === 0) return { kind: 'listen', id: key.slice(2), skill: key };
    if (key.indexOf('s:') === 0 && C().isSyl(key.slice(2))) {
      const p = C().split(key.slice(2));
      return { kind: 'sparkle', g: p.jung, skill: 'j:' + p.jung };
    }
    const pool = hearPool(lesson);
    const id = pool[Math.floor(Math.random() * pool.length)] || C().hearOf(lesson)[0];
    return { kind: 'listen', id: id, skill: 'p:' + id };
  }
  function buildTrials(spec) {
    const lesson = spec.lesson;
    const multi = spec.mode === 'lesson' && (spec.type === 'listen' || spec.type === 'sparkle' || spec.type === 'match');
    const n = multi ? 2 : 1;
    if (spec.type === 'listen') return listenItems(lesson, n);
    if (spec.type === 'sparkle') return sparkleItems(lesson, n);
    if (spec.type === 'match') return matchItems(lesson, n);
    if (spec.type === 'treasure') return [treasureItem(lesson)];
    if (spec.type === 'blocks') return [{ kind: 'blocks' }];
    if (spec.type === 'memory') return [Object.assign({ kind: 'memory' }, memoryPairs(lesson))];
    if (spec.type === 'chant') return [{ kind: 'chant' }];
    if (spec.type === 'trace') return [{ kind: 'trace' }];
    return listenItems(lesson, 1);
  }
  function startTrial() {
    ctx.misses = 0;
    ctx.hinted = false;
    ctx.revealed = false;
    ctx.trialOver = false;
    ctx.hold = false;
    ctx.choice = true;
    const item = ctx.trials[ctx.ti] || { kind: 'listen', id: C().hearOf(ctx.lesson)[0], skill: '' };
    const kind = item.kind || ctx.type;
    if (kind === 'listen') renderListen(item, ctx.lesson);
    else if (kind === 'sparkle') renderSparkle(item, ctx.lesson);
    else if (kind === 'blocks') renderBlocks(ctx.lesson);
    else if (kind === 'read' || kind === 'sight') renderWordMatch(item, ctx.lesson);
    else if (kind === 'onset' || kind === 'syl') renderOnset(item, ctx.lesson);
    else if (kind === 'memory') renderMemory(item);
    else if (kind === 'chant') renderChant(ctx.lesson);
    else if (kind === 'trace') renderTrace(ctx.lesson);
    else renderListen(item, ctx.lesson);
  }
  function mount(stage, spec, done) {
    ctx = {
      mode: spec.mode,
      type: spec.type,
      lesson: spec.lesson,
      trials: buildTrials(spec),
      ti: 0,
      grades: [],
      scored: spec.type !== 'chant' && spec.type !== 'trace',
      occasion: spec.type + ':' + spec.lesson.id + ':' + Date.now(),
      wide: 3,
      counted: false,
      soloStep: false,
      playDone: false,
      earned: [],
      cloth: null,
      rewardKeys: [],
      focus: '',
      voice: null,
      skill: null,
      misses: 0,
      hinted: false,
      revealed: false,
      trialOver: false,
      hold: false,
      choice: true
    };
    onDone = done;
    if (!ctx.trials.length) ctx.trials = [{ kind: 'listen', id: C().hearOf(spec.lesson)[0], skill: '' }];
    startTrial();
  }
  function tap(el) {
    const t = el.dataset.tap;
    if (t === 'trial-next') {
      ctx.ti += 1;
      startTrial();
      return true;
    }
    if (t === 'play-next') {
      if (onDone) onDone({
        solo: !!ctx.soloStep,
        scored: !!(ctx.scored && ctx.counted),
        earned: (ctx && ctx.earned) || [],
        cloth: (ctx && ctx.cloth) || null
      });
      return true;
    }
    if (!ctx || ctx.trialOver) return false;
    if (t === 'pick') {
      if (el.dataset.ok === '1') {
        el.classList.add('is-ok');
        const chest = document.getElementById('chest');
        if (chest) chest.src = 'assets/pic/chest_open.webp';
        endTrial();
      } else assist(el, host().querySelector('[data-ok="1"]'));
      return true;
    }
    if (t === 'piece') { onPiece(el); return true; }
    if (t === 'card') { onCard(el); return true; }
    if (t === 'tile') { onTile(el); return true; }
    return false;
  }
  function replay() {
    if (ctx && (ctx.type === 'listen' || ctx.type === 'treasure') && ctx.voice) {
      bubble('잘 들어 봐');
      X().say(ctx.voice.key, '잘 들어 봐', { keepBubble: true });
    } else replayStem();    const b = document.getElementById('replayBtn');
    if (b) b.dataset.n = String((+b.dataset.n || 0) + 1);
  }
  window.V5Play = { mount, tap, replay };
})();
