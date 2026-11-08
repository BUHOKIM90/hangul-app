'use strict';
/* Plays. Every screen speaks its instruction, then the target sound; the caption is always the line being heard.
   Scaffold is retry, then a sparkle hint, then "같이 해 보자" with the answer.
   A star-worthy step is a real choice answered with no miss and no hint.
   Idle ~6 s: the instruction is said again and a hand shows the action. */
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

  /* ---------- voice helpers ---------- */
  function known(key) { return !!(key && X().canPlay(key) && X().lineOf(key)); }
  function row(key, text) { return known(key) ? [key, text || ''] : null; }
  function wordRow(id) { return row(C().wordKey(id)); }
  function stemRows() { return (ctx && ctx.stem || []).filter(Boolean); }
  function targetRows() { return (ctx && ctx.target || []).filter(Boolean); }
  function speak(rows, now) {
    const seen = {};
    const list = rows.filter(r => r && !seen[r[0]] && (seen[r[0]] = 1));
    X().sayAll(list, { now: now !== false });
  }
  function replayStem() {
    if (!ctx) return;
    speak(stemRows().concat(targetRows()));
  }

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
    if (g !== 'solo' && g !== 'retry' && g !== 'thin') return;
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
  function mascot(face) {
    const m = document.getElementById('mascot');
    if (m) m.src = 'assets/char/monggeul_' + face + '.webp';
  }
  function tone(s) { return TONES[(s && s.charCodeAt ? s.charCodeAt(0) : 0) % TONES.length]; }
  function nextBtn(label, tapName) {
    const h = host();
    const name = tapName || 'play-next';
    if (!h || h.querySelector('[data-tap="play-next"]') || h.querySelector('[data-tap="trial-next"]')) return;
    const b = document.createElement('button');
    b.className = 'tap xl play-go next-go';
    b.dataset.tap = name;
    b.type = 'button';
    b.innerHTML = '<span>' + (label || '다음') + '</span><img alt="" src="assets/icons/arrow.svg">';
    h.appendChild(b);
    X().setIdle({
      delay: 5000,
      run: () => { X().say(C().UI.tapnext, '', { now: true }); X().showHand(b); }
    });
  }
  /* Idle guide for the current task. */
  function idleFor(targetFn, mode) {
    X().setIdle({
      run: () => {
        replayStem();
        const el = targetFn && targetFn();
        if (el) X().showHand(el, mode || 'tap');
      }
    });
  }
  function choiceTarget() {
    return host().querySelector('.is-sparkle') || host().querySelector('.choices');
  }
  function gradeNow() {
    if (!ctx.choice) return 'guide';
    if (ctx.revealed) return 'shown';
    if (ctx.hinted) return 'hint';
    if (ctx.misses > 0) return 'retry';
    return 'solo';
  }
  function endTrial(confirm) {
    if (!ctx || ctx.trialOver) return;
    ctx.trialOver = true;
    X().hideHand();
    let g = gradeNow();
    if (g === 'solo' && (ctx.wide || 0) < 3) {
      g = (ctx.skill && X().admitThin(ctx.skill, ctx.occasion)) ? 'solo' : 'thin';
    }
    ctx.grades.push(g);
    if (ctx.skill) X().bump(ctx.skill, g, { occasion: ctx.occasion });
    /* Name the answer first (the word, the syllable), then cheer. */
    if (confirm && g !== 'shown') speak([confirm], true);
    if (g === 'hint') X().encourage('hint', ctx.focus || '');
    else if (g === 'shown') { /* "같이 해 보자" + answer already spoken */ }
    else X().praise({ type: ctx.type, helped: g === 'retry', focus: ctx.focus || '', now: !confirm });
    mascot(g === 'shown' ? 'think' : 'jump');
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
  /* Wrong answer: say what was tapped (when we can), then help in steps. */
  function assist(el, correct, saidRows) {
    if (!ctx || ctx.trialOver) return;
    if (el) {
      el.classList.remove('wiggle');
      void el.offsetWidth;
      el.classList.add('wiggle');
    }
    mascot('think');
    ctx.misses += 1;
    const nodes = (Array.isArray(correct) ? correct : [correct]).filter(Boolean);
    const soon = ctx.skill && X().hintSoon(ctx.skill);
    const canHint = !!X().S.colorHints;
    const wantHint = canHint && !ctx.hinted && nodes.length && (ctx.misses >= 2 || (soon && ctx.misses >= 1));
    const said = (saidRows || []).filter(Boolean);
    if (wantHint && ctx.misses < 3) {
      ctx.hinted = true;
      nodes.forEach(n => n.classList.add('is-sparkle'));
      const hintKey = ctx.misses % 2 ? C().UI.hint2 : C().UI.hint;
      speak(said.concat([row(hintKey) || row(C().UI.hint)], targetRows()));
      if (nodes[0]) X().showHand(nodes[0]);
      return;
    }
    if (ctx.misses < 2 && !ctx.hinted) {
      speak(said.length ? said.concat(targetRows()) : [row(C().UI.retry)].concat(targetRows()));
      return;
    }
    ctx.revealed = true;
    nodes.forEach(n => n.classList.add('show-ans'));
    speak([row(C().UI.tryit) || row(C().UI.together)].concat(targetRows().length ? targetRows() : (ctx.afterMiss || [])));
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
    const out = list.slice(0, n);
    if (out.indexOf(correct) < 0) out[out.length - 1] = correct;
    (fillers || []).forEach(x => {
      if (out.length >= n) return;
      if (x !== correct && out.indexOf(x) < 0) out.push(x);
    });
    return X().shuffle(out);
  }
  /* Adaptive: options grow after clean streaks and shrink after struggle (within 2..4). */
  function askN() {
    const base = C().choiceN(X().S.difficulty);
    const a = X().S.adapt || 0;
    return Math.max(2, Math.min(4, base + (a >= 3 ? 1 : a <= -3 ? -1 : 0)));
  }
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
    return C().letterPic(g) || C().jamoPic(g) || C().sylPic(g) || STAR;
  }
  function cardsHTML(items, render, cls) {
    return '<div class="choices' + (cls ? ' ' + cls : '') + '" data-n="' + items.length + '">' + items.map(render).join('') + '</div>';
  }
  function picCard(id, ok) {
    return '<button type="button" class="tap choice pic-choice ' + tone(id) + '" data-tap="pick" data-id="' + id + '" data-ok="' + (ok ? '1' : '0') + '" aria-label="그림"><img alt="" width="512" height="512" src="' + C().pic(id) + '"></button>';
  }
  function glyphCard(g, ok) {
    return '<button type="button" class="tap choice glyph ' + tone(g) + '" data-tap="pick" data-id="' + g + '" data-ok="' + (ok ? '1' : '0') + '" aria-label="' + g + '"><b>' + g + '</b></button>';
  }
  function wordCard(id, ok) {
    const deco = DECO[id.length % DECO.length];
    return '<button type="button" class="tap choice word ' + tone(C().ko(id)) + '" data-tap="pick" data-id="' + id + '" data-ok="' + (ok ? '1' : '0') + '" aria-label="' + C().ko(id) + '"><img class="deco" alt="" src="' + deco + '"><b>' + C().ko(id) + '</b></button>';
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
    if (alt && alt !== g && C().jamoThrough(lesson.id).concat(['ㅌ']).indexOf(alt) >= 0) out.push(alt);
    const vowels = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'];
    const cons = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ'];
    const pool = vowels.indexOf(g) >= 0 ? vowels : cons;
    (lesson.jamo || []).filter(j => pool.indexOf(j) >= 0).concat(pool).forEach(j => {
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
    const sight = lesson.sight || [];
    const ids = reads.concat(sight.filter(id => reads.indexOf(id) < 0));
    if (ids.length >= 2) {
      const pick = X().shuffle(ids).slice(0, 2);
      return {
        skill: weakerRead(pick),
        pairs: pick.map(id => ({ id: id, face: C().ko(id), pic: C().pic(id), key: C().wordKey(id) }))
      };
    }
    let syls = [];
    (lesson.chant || []).forEach(s => { if (syls.indexOf(s) < 0) syls.push(s); });
    ['아', '이', '오', '우'].forEach(s => { if (syls.indexOf(s) < 0) syls.push(s); });
    syls = X().shuffle(syls.filter(s => C().sylPic(s))).slice(0, 2);
    return {
      skill: 's:' + syls[0],
      pairs: syls.map(s => ({ id: s, face: s, pic: C().sylPic(s) || STAR, key: C().sylKey(s) }))
    };
  }
  /* Spaced review: the most-needed skill with this prefix, optionally limited to some ids. */
  function weakestKey(prefixRe, allow) {
    const skills = X().S.skill || {};
    let best = '';
    let bestNeed = 0;
    Object.keys(skills).forEach(k => {
      if (!(prefixRe || /^(j|r|sight|p|s):/).test(k)) return;
      if (allow && allow.indexOf(k.slice(k.indexOf(':') + 1)) < 0) return;
      const it = skills[k];
      if (!it || !it.seen) return;
      const due = it.due && it.due <= Date.now();
      const need = (it.help || 0) * 2 + (due ? 2 : 0) + ((it.solo || 0) === 0 ? 1 : 0) - (it.solo || 0) - (it.box || 0);
      if (need > bestNeed) { bestNeed = need; best = k; }
    });
    return best;
  }

  /* ---------- renders ---------- */
  function playKicker(text) {
    const k = document.querySelector('.play-head .kicker');
    if (k && text) k.textContent = text;
  }
  function renderListen(item, lesson) {
    const target = item.id;
    const n = askN();
    const pool = hearPool(lesson);
    const opts = take(Math.min(n, Math.max(1, pool.length)), pool, target);
    const treasure = ctx.type === 'treasure';
    markWide(opts.length);
    ctx.skill = item.skill;
    ctx.focus = C().ko(target);
    ctx.rewardKeys = ['w:' + target];
    ctx.answerKey = C().wordKey(target);
    ctx.stem = [treasure ? row(C().UI.treasure) : row(C().UI.which)];
    ctx.target = [wordRow(target)];
    const chest = treasure ? '<img class="chest" id="chest" alt="" width="384" height="384" src="assets/pic/chest_closed.webp">' : '';
    host().innerHTML = (item.review ? '<p class="review-tag">다시 만나요</p>' : '') + chest + cardsHTML(opts, id => picCard(id, id === target), 'pics');
    replayStem();
    idleFor(choiceTarget, 'sweep');
  }
  function renderSparkle(item, lesson) {
    const target = item.g;
    const pool = [target];
    const alt = C().confuse(lesson, target);
    if (alt && alt !== target && GLYPHS.indexOf(alt) >= 0) pool.push(alt);
    (lesson.focus || []).concat(lesson.jamo || []).forEach(g => { if (pool.indexOf(g) < 0) pool.push(g); });
    const opts = fillTo(pool, target, askN(), GLYPHS);
    const treasure = ctx.type === 'treasure';
    markWide(opts.length);
    ctx.skill = item.skill;
    ctx.focus = target;
    ctx.rewardKeys = ['j:' + target];
    ctx.stem = [treasure ? row(C().UI.treasure) : row(C().UI.letter)];
    ctx.target = [row(C().jamoKey(target))];
    const chest = treasure ? '<img class="chest" id="chest" alt="" width="384" height="384" src="assets/pic/chest_closed.webp">' : '';
    host().innerHTML = (item.review ? '<p class="review-tag">다시 만나요</p>' : '') + chest + cardsHTML(opts, g => glyphCard(g, g === target), 'glyphs');
    replayStem();
    idleFor(choiceTarget, 'sweep');
  }
  function renderBlocks(lesson) {
    const b = lesson.blocks;
    const nDist = X().S.difficulty === 'easy' ? 1 : X().S.difficulty === 'hard' ? 3 : 2;
    const cons = [b.c].concat(blockAlts(b.c, lesson, nDist));
    const vows = [b.v].concat(blockAlts(b.v, lesson, nDist));
    markWide(Math.min(cons.length, vows.length));
    ctx.skill = 's:' + b.say;
    ctx.focus = b.say;
    ctx.rewardKeys = ['j:' + b.c, 'j:' + b.v];
    ctx.stem = [row(C().UI.block)];
    ctx.target = [row(C().sylKey(b.say))];
    const btn = p => '<button type="button" class="tap choice glyph piece ' + tone(p.g) + '" data-tap="piece" data-kind="' + p.kind + '" data-id="' + p.g + '" data-ok="' + (p.ok ? '1' : '0') + '" aria-label="' + p.g + '"><b>' + p.g + '</b></button>';
    const cs = X().shuffle(cons.map(g => ({ g: g, kind: 'cho', ok: g === b.c })));
    const vs = X().shuffle(vows.map(g => ({ g: g, kind: 'jung', ok: g === b.v })));
    host().innerHTML = '<div class="block-top"><div class="goal-pic"><img alt="" width="512" height="512" src="' + C().pic(b.word) + '"></div><div class="slots"><i data-slot="cho" class="is-next">?</i><span class="plus">+</span><i data-slot="jung">?</i><span class="eq">=</span><b class="sum" hidden></b></div></div>' +
      '<div class="piece-rows"><div class="choices pieces" data-kind="cho">' + cs.map(btn).join('') + '</div><div class="choices pieces" data-kind="jung">' + vs.map(btn).join('') + '</div></div>';
    replayStem();
    idleFor(() => host().querySelector('.is-sparkle') || host().querySelector('.pieces[data-kind="' + (host().querySelector('[data-slot="cho"]').textContent === '?' ? 'cho' : 'jung') + '"]'), 'sweep');
  }
  function renderWordMatch(item, lesson) {
    const target = item.id;
    const opts = wordChoices(lesson, target, askN());
    markWide(opts.length);
    ctx.skill = item.skill;
    ctx.focus = C().ko(target);
    ctx.rewardKeys = ['w:' + target];
    ctx.answerKey = C().wordKey(target);
    const find = row('hw_' + target) || null;
    const alone = item.kind === 'read' && X().S.difficulty === 'hard' && !item.review;
    /* Hard: read alone first; the word is voiced only after a miss. */
    ctx.stem = alone ? [row(C().UI.alone)] : (find ? [find] : [row(C().UI.find)]);
    ctx.target = alone ? [] : (find ? [] : [wordRow(target)]);
    ctx.afterMiss = find ? [find] : [wordRow(target)];
    host().innerHTML = '<div class="hero-pic"><img alt="" width="512" height="512" src="' + C().pic(target) + '"></div>' + cardsHTML(opts, id => wordCard(id, id === target), 'words');
    replayStem();
    idleFor(choiceTarget, 'sweep');
  }
  function renderOnset(item, lesson) {
    const answer = item.syl;
    const opts = sylChoices(lesson, answer, askN());
    markWide(opts.length);
    ctx.skill = item.skill;
    ctx.focus = answer;
    ctx.rewardKeys = keysForToken(answer);
    ctx.answerKey = C().sylKey(answer);
    ctx.stem = item.word ? [wordRow(item.word)] : [];
    ctx.target = [row('fy_' + C().hex(answer)) || row(C().sylKey(answer))];
    const pic = item.word ? C().pic(item.word) : (C().sylPic(answer) || STAR);
    host().innerHTML = '<div class="hero-pic"><img alt="" width="512" height="512" src="' + pic + '"></div>' + cardsHTML(opts, g => glyphCard(g, g === answer), 'glyphs');
    replayStem();
    idleFor(choiceTarget, 'sweep');
  }
  function renderPhrase(item) {
    const ph = C().PHRASES[item.key];
    const others = Object.keys(C().PHRASES).filter(k => k !== item.key).map(k => C().PHRASES[k].pic).concat(C().PHRASE_DECOY);
    const n = Math.min(askN(), 3);
    const pics = X().shuffle([ph.pic].concat(X().shuffle(others).slice(0, n - 1)));
    markWide(pics.length);
    ctx.skill = 'ph:' + item.key;
    ctx.focus = ph.text;
    ctx.rewardKeys = ph.words.map(w => 'w:' + w);
    ctx.answerKey = item.key;
    const alone = X().S.difficulty === 'hard';
    ctx.stem = alone ? [row(C().UI.alone)] : [row(C().UI.which)];
    ctx.target = alone ? [] : [row(item.key)];
    ctx.afterMiss = [row(item.key)];
    host().innerHTML = '<button type="button" class="tap phrase-card" data-tap="phrase-say" aria-label="' + ph.text + ' 듣기">' + ph.text.split(' ').map(w => '<b>' + w + '</b>').join('') + '</button>' +
      cardsHTML(pics, src => '<button type="button" class="tap choice pic-choice phrase-pic" data-tap="pick" data-ok="' + (src === ph.pic ? '1' : '0') + '" aria-label="그림"><img alt="" width="512" height="512" src="' + src + '"></button>', 'pics');
    replayStem();
    idleFor(choiceTarget, 'sweep');
  }
  function renderMemory(item) {
    markWide(4);
    ctx.skill = item.skill;
    ctx.focus = (item.pairs || []).map(p => p.face).join(' · ');
    ctx.rewardKeys = [];
    (item.pairs || []).forEach(p => {
      keysForToken(p.id).forEach(k => { if (ctx.rewardKeys.indexOf(k) < 0) ctx.rewardKeys.push(k); });
    });
    ctx.mem = { open: [], keys: {} };
    item.pairs.forEach(p => { ctx.mem.keys[p.id] = p.key; });
    ctx.stem = [row(C().UI.memory)];
    ctx.target = [];
    const cards = [];
    item.pairs.forEach(p => {
      cards.push({ pair: p.id, face: 'pic', pic: p.pic, word: p.face });
      cards.push({ pair: p.id, face: 'word', pic: p.pic, word: p.face });
    });
    const deck = X().shuffle(cards);
    host().innerHTML = '<div class="mem">' + deck.map((card, i) => {
      const inner = card.face === 'pic'
        ? '<img alt="" width="512" height="512" src="' + card.pic + '">'
        : '<b>' + card.word + '</b>';
      return '<button type="button" class="tap mem-card ' + tone(card.pair) + '" data-tap="card" data-pair="' + card.pair + '" data-i="' + i + '" aria-label="카드"><span class="back"><img alt="" src="' + STAR + '"></span><span class="front">' + inner + '</span></button>';
    }).join('') + '</div>';
    replayStem();
    idleFor(() => host().querySelector('.mem-card.is-sparkle:not(.is-up)') || host().querySelector('.mem-card:not(.is-matched):not(.is-up)'));
  }
  function renderChant(lesson) {
    ctx.skill = null;
    ctx.choice = false;
    ctx.focus = lesson.chant.join('·');
    ctx.rewardKeys = [];
    ctx.chant = 0;
    const first = lesson.chant[0];
    ctx.stem = [row(C().UI.chant)];
    ctx.target = [row(C().sylKey(first))];
    const firstPic = C().sylPic(first) || STAR;
    host().innerHTML = '<div class="chant-board"><div class="chant-pic"><img id="chantPic" alt="" width="512" height="512" src="' + firstPic + '"><span id="chantWord">' + C().sylWord(first) + '</span></div>' + meter(lesson.chant.length) + '<div class="chant">' + lesson.chant.map((s, i) => {
      const key = C().sylKey(s);
      return '<button type="button" class="tap ctile ' + tone(s) + (i === 0 ? ' is-lit' : '') + '" data-tap="tile" data-i="' + i + '" data-audio="' + key + '" aria-label="' + s + '"><img class="tile-pic" alt="" src="' + (C().sylPic(s) || STAR) + '"><b>' + s + '</b></button>';
    }).join('') + '</div></div>';
    replayStem();
    idleFor(() => host().querySelector('.ctile.is-lit'));
  }

  /* ---------- trace: drag a finger along the pink dotted guide, stroke by stroke ---------- */
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
  function renderTrace(item) {
    const g = item.g || ctx.lesson.trace;
    ctx.skill = 'm:' + g;
    ctx.choice = false;
    ctx.focus = g;
    ctx.rewardKeys = [];
    const diff = X().S.difficulty;
    ctx.trace = {
      glyph: g, strokes: strokesOf(g), si: 0, k: 0, pid: null, lifts: 0, moved: false,
      tol: diff === 'easy' ? 17 : diff === 'hard' ? 11 : 14
    };
    const pic = C().letterPic(g) || C().jamoPic(g);
    ctx.stem = [row(C().UI.trace)];
    ctx.target = [row(C().jamoKey(g))];
    host().innerHTML = '<div class="trace-wrap">' + '<div class="trace-card">' + (pic ? '<img alt="" width="512" height="512" src="' + pic + '">' : '') + '<b>' + g + '</b></div>' +
      '<div class="trace-board" data-letter="' + g + '"><svg viewBox="0 0 100 100" aria-label="' + g + ' 따라 쓰기" role="img"></svg><p class="trace-count" aria-hidden="true"></p></div></div>';
    drawTrace();
    bindTrace();
    replayStem();
    X().setIdle({ run: () => { replayStem(); demoStroke(); } });
  }
  function svgToClient(p) {
    const svg = host() && host().querySelector('.trace-board svg');
    if (!svg) return [0, 0];
    const r = svg.getBoundingClientRect();
    return [r.left + p[0] / 100 * r.width, r.top + p[1] / 100 * r.height];
  }
  function demoStroke() {
    const t = ctx && ctx.trace;
    if (!t || ctx.trialOver) return;
    const cur = t.strokes[t.si];
    if (!cur) return;
    const pts = cur.filter((p, i) => i >= t.k && (i % 4 === 0 || i === cur.length - 1)).map(svgToClient);
    X().dragHand(pts, Math.max(900, pts.length * 60));
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
      html += '<circle class="st-end" cx="' + end[0].toFixed(1) + '" cy="' + end[1].toFixed(1) + '" r="3.4"/>';
      const ahead = cur.find(p => p[2] >= head[2] + 12) || end;
      const ang = Math.atan2(ahead[1] - head[1], ahead[0] - head[0]) * 180 / Math.PI;
      if (ahead !== head) html += '<g class="st-arrow" transform="translate(' + ahead[0].toFixed(1) + ' ' + ahead[1].toFixed(1) + ') rotate(' + ang.toFixed(0) + ')"><path d="M-3 -3.4L2.6 0L-3 3.4"/></g>';
      html += '<circle class="st-head' + (ctx.hinted ? ' is-sparkle' : '') + '" cx="' + head[0].toFixed(1) + '" cy="' + head[1].toFixed(1) + '" r="5.6"/>';
      html += '<text class="st-num" x="' + head[0].toFixed(1) + '" y="' + (head[1] + 2.2).toFixed(1) + '">' + (t.si + 1) + '</text>';
    }
    svg.innerHTML = html;
    const cnt = host().querySelector('.trace-count');
    if (cnt) cnt.textContent = t.strokes.length > 1 ? (Math.min(t.si + 1, t.strokes.length) + ' / ' + t.strokes.length) : '';
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
      X().touched();
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
      X().touched();
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
      t.si = t.strokes.length;
      drawTrace();
      speak([row(C().UI.tryit) || row(C().UI.together)].concat(targetRows()));
      endTrace();
      return;
    }
    if (ctx.misses >= 3 && X().S.colorHints && !ctx.hinted) {
      ctx.hinted = true;
      drawTrace();
      speak([row(C().UI.hint2) || row(C().UI.hint)]);
      demoStroke();
      return;
    }
    speak(stemRows());
    demoStroke();
  }
  function strokeDone() {
    const t = ctx.trace;
    t.si += 1;
    t.k = 0;
    t.pid = null;
    const board = host().querySelector('.trace-board');
    board.classList.remove('is-drawing');
    X().chime(t.si);
    X().confetti(6, 'stars');
    if (t.si >= t.strokes.length) {
      drawTrace();
      board.classList.add('is-complete');
      endTrace();
      return;
    }
    drawTrace();
  }
  function endTrace() {
    if (ctx.trialOver) return;
    const grade = ctx.revealed ? 'shown' : (ctx.hinted ? 'hint' : 'guide');
    if (ctx.skill) X().bump(ctx.skill, grade);
    ctx.trialOver = true;
    ctx.grades.push(grade);
    const g = ctx.trace && ctx.trace.glyph;
    if (grade !== 'shown') {
      if (g) speak([row(C().jamoKey(g))], true);
      X().praise({ type: 'trace', helped: grade === 'hint', focus: g || '' });
      mascot('jump');
    }
    if (ctx.ti + 1 < ctx.trials.length) { nextBtn('또 쓰기', 'trial-next'); return; }
    ctx.playDone = true;
    ctx.soloStep = false;
    if (grade !== 'shown') payCloth();
    nextBtn(ctx.mode === 'practice' ? '마을로' : '다음', 'play-next');
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
      const slot = host().querySelector('[data-slot="' + kind + '"]');
      if (slot) { slot.textContent = kind === 'cho' ? b.c : b.v; slot.classList.add('is-filled'); slot.classList.remove('is-next'); }
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
    if (slot) { slot.textContent = el.dataset.id; slot.classList.add('is-filled'); slot.classList.remove('is-next'); }
    host().querySelectorAll('[data-kind="' + kind + '"].piece').forEach(p => { p.setAttribute('aria-disabled', 'true'); p.classList.add('is-off'); p.classList.remove('is-sparkle'); });
    el.classList.add('is-ok');
    X().chime(kind === 'cho' ? 1 : 2);
    const cho = host().querySelector('[data-slot="cho"]').textContent.trim();
    const jung = host().querySelector('[data-slot="jung"]').textContent.trim();
    const b = ctx.lesson.blocks;
    if (cho === b.c && jung === b.v) {
      const sum = host().querySelector('.sum');
      sum.hidden = false;
      sum.textContent = b.say;
      sum.classList.add('is-burst');
      endTrial(row(C().sylKey(b.say)));
    } else {
      const other = host().querySelector('[data-slot="' + (kind === 'cho' ? 'jung' : 'cho') + '"]');
      if (other) other.classList.add('is-next');
      /* say the letter just placed so every tap is heard */
      speak([row(C().jamoKey(el.dataset.id))]);
    }
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
    }, 900);
  }
  function onCard(el) {
    if (ctx.trialOver || ctx.hold || el.classList.contains('is-matched') || el.classList.contains('is-up')) return;
    el.classList.add('is-up');
    ctx.mem.open.push(el);
    const key = ctx.mem.keys[el.dataset.pair];
    if (ctx.mem.open.length < 2) { speak([row(key)]); return; }
    const a = ctx.mem.open[0];
    const b = ctx.mem.open[1];
    if (a.dataset.pair === b.dataset.pair) {
      a.classList.add('is-matched');
      b.classList.add('is-matched');
      a.classList.remove('is-sparkle');
      b.classList.remove('is-sparkle');
      ctx.mem.open = [];
      X().chime(2);
      const done = host().querySelectorAll('.mem-card.is-matched').length === host().querySelectorAll('.mem-card').length;
      if (done) endTrial(row(key));
      else speak([row(key), row(C().UI.found)]);
      return;
    }
    const open = ctx.mem.open.slice();
    ctx.mem.open = [];
    ctx.misses += 1;
    mascot('think');
    const soon = ctx.skill && X().hintSoon(ctx.skill);
    const canHint = !!X().S.colorHints;
    if (!ctx.hinted && canHint && (ctx.misses >= 2 || (soon && ctx.misses >= 1)) && ctx.misses < 3) {
      ctx.hinted = true;
      sparklePair();
      speak([row(key), row(C().UI.hint)]);
      closeCards(open);
      return;
    }
    if (ctx.misses >= 3 || (!canHint && ctx.misses >= 2)) {
      ctx.revealed = true;
      host().querySelectorAll('.mem-card').forEach(c => c.classList.add('is-up', 'is-matched', 'show-ans'));
      speak([row(C().UI.tryit) || row(C().UI.together)]);
      ctx.hold = false;
      endTrial();
      return;
    }
    speak([row(key), row(C().UI.retry)]);
    closeCards(open);
  }
  function finishGuided() {
    if (ctx.trialOver) return;
    ctx.trialOver = true;
    ctx.playDone = true;
    ctx.soloStep = false;
    ctx.grades = ['guide'];
    X().praise({ type: 'chant', focus: ctx.focus || '' });
    mascot('jump');
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
        /* Say the lit tile's syllable, never the tapped one: the kid hears what to press. */
        const ls = ctx.lesson.chant[+lit.dataset.i];
        speak([row(lit.dataset.audio || C().sylKey(ls))]);
        X().showHand(lit);
      }
      return;
    }
    el.classList.remove('is-lit', 'is-sparkle');
    el.classList.add('is-hit');
    const s = ctx.lesson.chant[+el.dataset.i];
    showSyl(s);
    markMeter(ctx.chant);
    speak([row(el.dataset.audio || C().sylKey(s))]);
    const next = host().querySelector('.ctile[data-i="' + (ctx.chant + 1) + '"]');
    ctx.chant += 1;
    ctx.misses = 0;
    if (next) {
      next.classList.add('is-lit');
      const ns = ctx.lesson.chant[ctx.chant];
      ctx.target = [row(C().sylKey(ns))];
    } else {
      ctx.target = [row(C().sylKey(s))];
      finishGuided();
    }
  }

  /* ---------- trials ---------- */
  function earlierIds(lesson, field) {
    const out = [];
    C().LESSONS.forEach(l => { if (l.id < lesson.id) (l[field] || []).forEach(x => { if (out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }
  function listenItems(lesson, n) {
    const out = pickDistinct(C().hearOf(lesson), n).map(id => ({ kind: 'listen', id: id, skill: 'p:' + id }));
    /* cumulative review: swap the last item for a due word from an earlier lesson */
    const due = weakestKey(/^p:/, earlierIds(lesson, 'hear'));
    if (n > 1 && due) out[out.length - 1] = { kind: 'listen', id: due.slice(2), skill: due, review: true };
    return out;
  }
  function sparkleItems(lesson, n) {
    const focus = (lesson.focus && lesson.focus.length) ? lesson.focus : (lesson.jamo || []);
    const out = pickDistinct(focus, n).map(g => ({ kind: 'sparkle', g: g, skill: 'j:' + g }));
    const due = weakestKey(/^j:/, earlierIds(lesson, 'focus'));
    if (n > 1 && due) out[out.length - 1] = { kind: 'sparkle', g: due.slice(2), skill: due, review: true };
    return out;
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
    const allowJ = C().jamoThrough(lesson.id);
    const key = weakestKey();
    if (key.indexOf('j:') === 0 && allowJ.indexOf(key.slice(2)) >= 0 && GLYPHS.indexOf(key.slice(2)) >= 0) return { kind: 'sparkle', g: key.slice(2), skill: key };
    if (key.indexOf('sight:') === 0) return { kind: 'sight', id: key.slice(6), skill: key };
    if (key.indexOf('r:') === 0) return { kind: 'read', id: key.slice(2), skill: key, review: true };
    if (key.indexOf('p:') === 0 && C().WORDS[key.slice(2)]) return { kind: 'listen', id: key.slice(2), skill: key };
    if (key.indexOf('s:') === 0 && C().isSyl(key.slice(2))) {
      const p = C().split(key.slice(2));
      if (GLYPHS.indexOf(p.jung) >= 0) return { kind: 'sparkle', g: p.jung, skill: 'j:' + p.jung };
    }
    const pool = hearPool(lesson);
    const id = pool[Math.floor(Math.random() * pool.length)] || C().hearOf(lesson)[0];
    return { kind: 'listen', id: id, skill: 'p:' + id };
  }
  function phraseItems(lesson, n) {
    const keys = (lesson.phrases || []).filter(k => C().PHRASES[k]);
    return keys.slice(0, n).map(k => ({ kind: 'phrase', key: k }));
  }
  function traceItems(lesson, spec) {
    const all = (lesson.write && lesson.write.length) ? lesson.write : [lesson.trace];
    const d = X().S.difficulty;
    const n = spec.mode !== 'lesson' ? 1 : d === 'easy' ? 1 : d === 'hard' ? all.length : 2;
    return all.slice(0, n).map(g => ({ kind: 'trace', g: g }));
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
    if (spec.type === 'trace') return traceItems(lesson, spec);
    if (spec.type === 'phrase') {
      const items = phraseItems(lesson, spec.mode === 'lesson' ? 2 : 1);
      if (items.length) return items;
      /* practice before phrases exist: read a word instead */
      return matchItems(lesson, 1);
    }
    return listenItems(lesson, 1);
  }
  function startTrial() {
    ctx.misses = 0;
    ctx.hinted = false;
    ctx.revealed = false;
    ctx.trialOver = false;
    ctx.hold = false;
    ctx.choice = true;
    ctx.afterMiss = null;
    ctx.answerKey = '';
    X().hideHand();
    mascot('think');
    const item = ctx.trials[ctx.ti] || { kind: 'listen', id: C().hearOf(ctx.lesson)[0], skill: '' };
    const kind = item.kind || ctx.type;
    const step = host().closest('.play') && host().closest('.play').querySelector('.trial-dots');
    if (step) step.innerHTML = ctx.trials.length > 1 ? ctx.trials.map((_, i) => '<i class="' + (i < ctx.ti ? 'is-on' : i === ctx.ti ? 'is-now' : '') + '"></i>').join('') : '';
    if (kind === 'listen') renderListen(item, ctx.lesson);
    else if (kind === 'sparkle') renderSparkle(item, ctx.lesson);
    else if (kind === 'blocks') renderBlocks(ctx.lesson);
    else if (kind === 'read' || kind === 'sight') renderWordMatch(item, ctx.lesson);
    else if (kind === 'onset' || kind === 'syl') renderOnset(item, ctx.lesson);
    else if (kind === 'memory') renderMemory(item);
    else if (kind === 'chant') renderChant(ctx.lesson);
    else if (kind === 'trace') renderTrace(item);
    else if (kind === 'phrase') renderPhrase(item);
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
      stem: [],
      target: [],
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
  function wrongRows(el) {
    const id = el.dataset.id || '';
    const kind = (ctx.trials[ctx.ti] || {}).kind;
    if (kind === 'listen' && C().WORDS[id]) return [row('hy_' + id) || wordRow(id)];
    const extra = targetRows().length ? [] : (ctx.afterMiss || []);
    if ((kind === 'read' || kind === 'sight') && C().WORDS[id]) return [wordRow(id)].concat(extra);
    if ((kind === 'onset' || kind === 'syl') && C().isSyl(id)) return [row('dy_' + C().hex(id)) || row(C().sylKey(id))];
    if (kind === 'phrase') return [row(C().UI.retry)].concat(extra);
    return null;
  }
  function tap(el) {
    const t = el.dataset.tap;
    if (t === 'trial-next') {
      X().dropQueue();
      ctx.ti += 1;
      startTrial();
      return true;
    }
    if (t === 'play-next') {
      X().setIdle(null);
      X().hideHand();
      if (onDone) onDone({
        solo: !!ctx.soloStep,
        scored: !!(ctx.scored && ctx.counted),
        grades: (ctx && ctx.grades) || [],
        earned: (ctx && ctx.earned) || [],
        cloth: (ctx && ctx.cloth) || null
      });
      return true;
    }
    if (t === 'phrase-say') { speak([row(ctx.answerKey)]); return true; }
    if (!ctx || ctx.trialOver) return false;
    if (t === 'pick') {
      if (el.dataset.ok === '1') {
        el.classList.add('is-ok');
        X().chime(3);
        const chest = document.getElementById('chest');
        if (chest) { chest.src = 'assets/pic/chest_open.webp'; chest.classList.add('is-burst'); }
        endTrial(ctx.answerKey ? row(ctx.answerKey) : null);
      } else {
        const said = wrongRows(el);
        assist(el, host().querySelector('[data-ok="1"]'), said && said.filter(Boolean).length ? said : null);
      }
      return true;
    }
    if (t === 'piece') { onPiece(el); return true; }
    if (t === 'card') { onCard(el); return true; }
    if (t === 'tile') { onTile(el); return true; }
    return false;
  }
  function replay() {
    replayStem();
    const b = document.getElementById('replayBtn');
    if (b) {
      b.dataset.n = String((+b.dataset.n || 0) + 1);
      b.classList.remove('is-burst'); void b.offsetWidth; b.classList.add('is-burst');
    }
  }
  window.V5Play = { mount, tap, replay, _ctx: () => ctx };
})();
