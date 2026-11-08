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
    X().say(ctx.voice.key, ctx.voice.text);
  }
  /* Trace: drag a finger along the pink dotted guide, stroke by stroke. */
  const TRACE_LINE = '분홍 점을 따라 손가락으로 써 볼까?';
  function densify(st) {
    const raw = [];
    if (st.c) {
      const cx = st.c[0], cy = st.c[1], r = st.c[2], n = 48;
      for (let i = 0; i <= n; i++) {
        const t = -i / n * Math.PI * 2;
        raw.push([cx + r * Math.sin(t), cy - r * Math.cos(t)]);
      }
    } else st.forEach(pt => raw.push(pt.slice()));
    const out = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const a = raw[i - 1], b = raw[i];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(d / 1.5));
      for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    let len = 0;
    out[0][2] = 0;
    for (let i = 1; i < out.length; i++) { len += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); out[i][2] = len; }
    return out;
  }
  function strokesOf(g) {
    const S = C().STROKES[g];
    if (S) return S.map(densify);
    if (C().isSyl(g)) { const p = C().split(g); return strokesOf(p.cho).concat(strokesOf(p.jung)); }
    return [];
  }
  function pathD(pts, upto) {
    const end = upto === undefined ? pts.length - 1 : upto;
    if (end < 1) return '';
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 1; i <= end; i++) d += 'L' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
    return d;
  }
  function renderTrace(lesson) {
    const g = lesson.trace;
    ctx.skill = 'm:' + g;
    ctx.choice = false;
    ctx.focus = g;
    ctx.rewardKeys = [];
    const diff = X().S.difficulty;
    ctx.trace = {
      glyph: g, strokes: strokesOf(g), si: 0, k: 0, pid: null, ink: [], lifts: 0, moved: false,
      tol: diff === 'easy' ? 17 : diff === 'hard' ? 11 : 14
    };
    const pic = C().jamoPic(g) || C().sylPic(g);
    ctx.voice = { key: C().UI.trace, text: TRACE_LINE };
    host().innerHTML = '<h1 class="prompt">' + TRACE_LINE + '</h1>' +
      (pic ? '<div class="goal-pic slim"><img alt="" width="512" height="512" src="' + pic + '"></div>' : '') +
      '<div class="trace-board" data-letter="' + g + '"><svg viewBox="0 0 100 100" aria-label="' + g + ' 따라 쓰기" role="img"></svg><p class="trace-count" aria-hidden="true"></p></div>';
    drawTrace();
    bindTrace();
    X().say(ctx.voice.key, TRACE_LINE);
  }
  function drawTrace() {
    const t = ctx.trace;
    const svg = host() && host().querySelector('.trace-board svg');
    if (!svg || !t) return;
    let html = '';
    t.strokes.forEach((pts, i) => {
      const cls = i < t.si ? 'st-done' : 'st-rest';
      html += '<path class="' + cls + '" d="' + pathD(pts) + '"/>';
    });
    const cur = t.strokes[t.si];
    if (cur) {
      html += '<path class="st-guide" d="' + pathD(cur) + '"/>';
      const total = cur[cur.length - 1][2];
      const step = 7;
      for (let L = 0; L <= total + 0.01; L += step) {
        const pt = cur.find(p => p[2] >= L - 0.01) || cur[cur.length - 1];
        const passed = pt[2] <= cur[t.k][2] + 0.5;
        html += '<circle class="st-dot' + (passed ? ' is-passed' : '') + '" cx="' + pt[0].toFixed(1) + '" cy="' + pt[1].toFixed(1) + '" r="2.3"/>';
      }
      if (t.k > 0) html += '<path class="st-ink" d="' + pathD(cur, t.k) + '"/>';
      const head = cur[t.k];
      const end = cur[cur.length - 1];
      /* direction arrow a little ahead of the head */
      const ahead = cur.find(p => p[2] >= head[2] + 9) || end;
      const ang = Math.atan2(ahead[1] - head[1], ahead[0] - head[0]) * 180 / Math.PI;
      if (ahead !== head) html += '<g class="st-arrow" transform="translate(' + ahead[0].toFixed(1) + ' ' + ahead[1].toFixed(1) + ') rotate(' + ang.toFixed(0) + ')"><path d="M-3 -3.4L2.6 0L-3 3.4"/></g>';
      html += '<circle class="st-head' + (ctx.hinted ? ' is-sparkle' : '') + '" cx="' + head[0].toFixed(1) + '" cy="' + head[1].toFixed(1) + '" r="5.6"/>';
      html += '<text class="st-num" x="' + head[0].toFixed(1) + '" y="' + (head[1] + 2.2).toFixed(1) + '">' + (t.si + 1) + '</text>';
    }
    svg.innerHTML = html;
    const cnt = host().querySelector('.trace-count');
    if (cnt) cnt.textContent = t.strokes.length > 1 ? (Math.min(t.si + 1, t.strokes.length) + ' / ' + t.strokes.length + ' 획') : '';
  }
  function tracePoint(e, svg) {
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100];
  }
  function traceAdvance(p) {
    const t = ctx.trace;
    const cur = t.strokes[t.si];
    if (!cur) return false;
    const here = cur[t.k][2];
    let best = -1;
    for (let i = t.k; i < cur.length; i++) {
      if (cur[i][2] > here + 16) break;
      if (Math.hypot(cur[i][0] - p[0], cur[i][1] - p[1]) <= t.tol) best = i;
    }
    if (best > t.k) { t.k = best; return true; }
    return false;
  }
  function bindTrace() {
    const board = host().querySelector('.trace-board');
    const svg = board && board.querySelector('svg');
    if (!board || !svg) return;
    const t = ctx.trace;
    const mine = ctx;
    let raf = 0;
    const paint = () => { raf = 0; drawTrace(); };
    const down = e => {
      if (ctx !== mine || ctx.trialOver || t.pid !== null) return;
      e.preventDefault();
      const p = tracePoint(e, svg);
      const head = t.strokes[t.si][t.k];
      t.moved = false;
      if (Math.hypot(head[0] - p[0], head[1] - p[1]) > t.tol * 1.25) { missTrace(); return; }
      t.pid = e.pointerId;
      try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      board.classList.add('is-drawing');
      traceAdvance(p);
      drawTrace();
    };
    const move = e => {
      if (ctx !== mine || e.pointerId !== t.pid || ctx.trialOver) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      let moved = false;
      (evs.length ? evs : [e]).forEach(ev => { if (traceAdvance(tracePoint(ev, svg))) moved = true; });
      if (moved) {
        t.moved = true;
        const cur = t.strokes[t.si];
        if (cur[cur.length - 1][2] - cur[t.k][2] < 3) { strokeDone(); return; }
        if (!raf) raf = requestAnimationFrame(paint);
      }
    };
    const up = e => {
      if (ctx !== mine || e.pointerId !== t.pid) return;
      t.pid = null;
      board.classList.remove('is-drawing');
      if (ctx.trialOver) return;
      if (!t.moved) missTrace();
      drawTrace();
    };
    board.addEventListener('pointerdown', down);
    board.addEventListener('pointermove', move);
    board.addEventListener('pointerup', up);
    board.addEventListener('pointercancel', up);
    board.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    board.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  }
  function missTrace() {
    const t = ctx.trace;
    ctx.misses += 1;
    const board = host().querySelector('.trace-board');
    if (board) { board.classList.remove('wiggle'); void board.offsetWidth; board.classList.add('wiggle'); }
    if (ctx.misses >= 7) {
      /* Write it together: draw the rest for them, then finish. */
      ctx.revealed = true;
      bubble('같이 해 보자!');
      X().say(C().UI.together, '같이 해 보자!', { now: true });
      t.si = t.strokes.length;
      drawTrace();
      endTrace();
      return;
    }
    if (ctx.misses >= 3 && X().S.colorHints && !ctx.hinted) {
      ctx.hinted = true;
      drawTrace();
      bubble(X().lineOf(C().UI.hint) || '반짝이는 데를 봐!');
      X().say(C().UI.hint, '', { keepBubble: true, now: true });
      return;
    }
    bubble('번호 ' + (t.si + 1) + ' 동그라미에서 시작해');
    X().say(C().UI.trace, TRACE_LINE, { keepBubble: true, now: true });
  }
  function strokeDone() {
    const t = ctx.trace;
    t.si += 1;
    t.k = 0;
    t.pid = null;
    host().querySelector('.trace-board').classList.remove('is-drawing');
    if (X().chime) X().chime(t.si);
    if (t.si >= t.strokes.length) {
      drawTrace();
      host().querySelector('.trace-board').classList.add('is-complete');
      endTrace();
      return;
    }
    bubble('잘했어! 이제 ' + (t.si + 1) + '번');
    drawTrace();
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
    if (ctx.type === 'chant') X().praise({ type: 'chant', focus: ctx.focus || '' });
    nextBtn(ctx.mode === 'practice' ? '마을로' : '다음', 'play-next');
  }
  function onTile(el) {
    if (ctx.trialOver) return;
    const lit = host().querySelector('.ctile.is-lit');
    if (!el.classList.contains('is-lit')) {
      el.classList.remove('wiggle');
      void el.offsetWidth;
      el.classList.add('wiggle');
      ctx.misses += 1;
      if (lit && ctx.misses >= 2 && X().S.colorHints) {
        lit.classList.add('is-sparkle');
        ctx.hinted = true;
      }
      if (lit) {
        const ls = ctx.lesson.chant[+lit.dataset.i];
        bubble('빛나는 ' + ls + ' 칸을 눌러 봐');
        X().say(lit.dataset.audio || C().sylKey(ls), ls, { keepBubble: true, now: true });
      }
      return;
    }
    el.classList.remove('is-lit', 'is-sparkle');
    el.classList.add('is-hit');
    const s = ctx.lesson.chant[+el.dataset.i];
    showSyl(s);
    markMeter(ctx.chant);
    bubble(s);
    X().say(el.dataset.audio || C().sylKey(s), s, { keepBubble: true, now: true });
    const next = host().querySelector('.ctile[data-i="' + (ctx.chant + 1) + '"]');
    ctx.chant += 1;
    ctx.misses = 0;
    if (next) {
      next.classList.add('is-lit');
      const ns = ctx.lesson.chant[ctx.chant];
      ctx.voice = { key: C().sylKey(ns), text: ns };
    } else {
      ctx.voice = { key: C().sylKey(s), text: s };
      finishGuided();
    }
  }
  function endTrace() {
    if (ctx.trialOver) return;
    const grade = ctx.revealed ? 'shown' : (ctx.hinted ? 'hint' : 'guide');
    if (ctx.skill) X().bump(ctx.skill, grade);
    ctx.trialOver = true;
    ctx.playDone = true;
    ctx.soloStep = false;
    ctx.grades = [grade];
    const g = ctx.trace && ctx.trace.glyph;
    if (grade !== 'shown') {
      if (g) X().say(C().isSyl(g) ? C().sylKey(g) : C().jamoKey(g), g, { keepBubble: true, now: true });
      X().praise({ type: 'trace', helped: grade === 'hint', focus: g || '' });
      payCloth();
    }
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
