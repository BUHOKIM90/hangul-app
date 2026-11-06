'use strict';
/* Eight play types. One question each. Scaffold: retry, hint, then show the answer. */
(function () {
  const X = () => window.V5X;
  const C = () => window.V5C;
  let ctx = null;
  let onDone = null;
  let misses = 0;
  let over = false;
  let hold = false;
  let sparkToken = 0;

  function host() { return document.getElementById('stage'); }
  function bubble(t) { const b = document.getElementById('bubble'); if (b) b.textContent = t; }
  function nextBtn(label) {
    const h = host();
    if (!h || h.querySelector('[data-tap="play-next"]')) return;
    const b = document.createElement('button');
    b.className = 'tap xl';
    b.dataset.tap = 'play-next';
    b.type = 'button';
    b.textContent = label || '다음';
    h.appendChild(b);
  }
  function finish(helped) {
    if (over) return;
    over = true;
    const first = !helped && misses === 0;
    X().praise();
    if (ctx.skill) X().bump(ctx.skill, helped ? 0 : first ? 2 : 1);
    nextBtn(ctx.mode === 'practice' ? '마을로' : '다음');
  }
  function miss(el, correct) {
    if (over) return;
    misses += 1;
    if (el) { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); }
    if (misses === 1) {
      bubble('다시 한 번!');
      X().say(C().UI.retry, '다시 한 번!');
      return;
    }
    if (misses === 2) {
      if (correct) correct.classList.add('hint-glow');
      bubble('반짝이는 데를 봐!');
      X().say(C().UI.hint, '반짝이는 데를 봐!');
      return;
    }
    if (correct) correct.classList.add('is-sparkle', 'show-ans');
    bubble('같이 찾았어!');
    X().say(C().UI.together, '같이 찾았어!');
    X().confetti();
    finish(true);
  }
  function take(n, pool, correct) {
    const rest = X().shuffle(pool.filter(x => x !== correct));
    const out = [correct];
    rest.forEach(x => { if (out.length < n && !out.includes(x)) out.push(x); });
    let guard = 0;
    while (out.length < n && guard++ < 8) {
      const extra = pool[guard % pool.length];
      if (extra && !out.includes(extra)) out.push(extra);
    }
    return X().shuffle(out);
  }
  function wordPool(lesson) {
    const all = C().wordsThrough(lesson.id);
    return all.length >= 2 ? all : lesson.words.slice();
  }
  function lessonWord(lesson) {
    return lesson.words[Math.floor(Math.random() * lesson.words.length)];
  }
  function reviewWord(lesson) {
    const words = wordPool(lesson);
    const due = words.filter(w => {
      const s = X().S.skill['w:' + w];
      return s && s.due && s.due <= Date.now();
    });
    const pool = due.length ? due : words;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function cardsHTML(items, render) {
    return '<div class="choices">' + items.map(render).join('') + '</div>';
  }
  function picCard(id, ok, hint) {
    const cls = 'tap choice' + (hint ? ' hint' : '');
    return '<button type="button" class="' + cls + '" data-tap="pick" data-ok="' + (ok ? '1' : '0') + '" aria-label="' + C().ko(id) + '"><img alt="" width="512" height="512" src="' + C().pic(id) + '"></button>';
  }
  function glyphCard(g, ok, spark) {
    return '<button type="button" class="tap choice glyph' + (spark ? ' is-sparkle' : '') + '" data-tap="pick" data-ok="' + (ok ? '1' : '0') + '" aria-label="' + g + '"><b>' + g + '</b></button>';
  }

  const mounts = {
    listen(lesson) {
      const target = lessonWord(lesson);
      const n = C().choiceN(X().S.difficulty);
      const opts = take(n, wordPool(lesson), target);
      ctx.skill = 'w:' + target;
      host().innerHTML = '<h1 class="prompt">어떤 그림일까?</h1>' + cardsHTML(opts, id => picCard(id, id === target, false));
      X().say(C().wordKey(target), C().ko(target));
    },
    sparkle(lesson) {
      const target = lesson.jamo[Math.floor(Math.random() * lesson.jamo.length)];
      const pool = lesson.jamo.concat(C().CONF[target] ? [C().CONF[target]] : []);
      const n = Math.min(C().choiceN(X().S.difficulty), Math.max(2, pool.length));
      const opts = take(n, pool, target);
      ctx.skill = 'j:' + target;
      host().innerHTML = '<h1 class="prompt">반짝이는 글자를 눌러</h1>' + cardsHTML(opts, g => glyphCard(g, g === target, false));
      const delay = X().S.difficulty === 'easy' ? 180 : X().S.difficulty === 'hard' ? 700 : 360;
      const token = sparkToken;
      setTimeout(() => {
        if (token !== sparkToken || over) return;
        const el = host() && host().querySelector('[data-ok="1"]');
        if (el) el.classList.add('is-sparkle');
      }, delay);
      X().say(C().jamoKey(target));
    },
    blocks(lesson) {
      const b = lesson.blocks;
      const syl = b.say;
      ctx.skill = 's:' + syl;
      const n = X().S.difficulty === 'easy' ? 1 : 2;
      const cons = [b.c];
      const vows = [b.v];
      if (n > 1) {
        cons.push(C().CONF[b.c] || 'ㅇ');
        vows.push(C().CONF[b.v] || 'ㅏ');
      }
      const pieces = X().shuffle(cons.map(g => ({ g, kind: 'cho', ok: g === b.c }))).concat(X().shuffle(vows.map(g => ({ g, kind: 'jung', ok: g === b.v }))));
      host().innerHTML = '<h1 class="prompt">소리를 붙여 보자</h1><div class="slots"><i data-slot="cho">+</i><i data-slot="jung">+</i><b class="sum" hidden></b></div><div class="pic-mini" hidden><img alt="" width="512" height="512" src="' + C().pic(b.word) + '"><span>' + C().ko(b.word) + '</span></div><div class="choices pieces">' + pieces.map(p => '<button type="button" class="tap choice glyph" data-tap="piece" data-kind="' + p.kind + '" data-ok="' + (p.ok ? '1' : '0') + '" aria-label="' + p.g + '"><b>' + p.g + '</b></button>').join('') + '</div>';
      X().say(C().UI.merge, '소리를 붙여 보자');
    },
    match(lesson) {
      const target = lessonWord(lesson);
      const n = C().choiceN(X().S.difficulty);
      const opts = take(n, wordPool(lesson), target);
      const hint = X().hintOn(target);
      ctx.skill = 'w:' + target;
      host().innerHTML = '<h1 class="prompt">같은 낱말을 골라</h1><div class="hero-pic' + (hint ? ' hint' : '') + '"><img alt="" width="512" height="512" src="' + C().pic(target) + '"></div><div class="choices">' + opts.map(id => '<button type="button" class="tap choice word' + (hint && id === target ? ' hint' : '') + '" data-tap="pick" data-ok="' + (id === target ? '1' : '0') + '"><b>' + C().ko(id) + '</b></button>').join('') + '</div>';
      X().say(C().wordKey(target), C().ko(target));
    },
    memory(lesson) {
      const pool = wordPool(lesson).slice();
      const a = pool[0], b = pool[1] || pool[0];
      ctx.skill = 'w:' + a;
      const cards = X().shuffle([
        { pair: a, face: 'pic' }, { pair: a, face: 'word' },
        { pair: b, face: 'pic' }, { pair: b, face: 'word' }
      ]);
      host().innerHTML = '<h1 class="prompt">같은 짝을 찾아 봐</h1><div class="mem">' + cards.map((card, i) => {
        const hint = X().hintOn(card.pair) ? ' hint' : '';
        const inner = card.face === 'pic'
          ? '<img alt="" width="512" height="512" src="' + C().pic(card.pair) + '">'
          : '<b>' + C().ko(card.pair) + '</b>';
        return '<button type="button" class="tap mem-card' + hint + '" data-tap="card" data-pair="' + card.pair + '" data-i="' + i + '" aria-label="카드"><span class="back">?</span><span class="front">' + inner + '</span></button>';
      }).join('') + '</div>';
      ctx.mem = { open: [] };
      X().say(C().UI.match, '같은 짝을 찾아 봐');
    },
    chant(lesson) {
      ctx.skill = 's:' + lesson.chant.join('');
      ctx.chant = 0;
      host().innerHTML = '<h1 class="prompt">빛나는 칸을 눌러</h1><div class="chant">' + lesson.chant.map((s, i) => '<button type="button" class="tap ctile' + (i === 0 ? ' is-lit' : '') + '" data-tap="tile" data-i="' + i + '" aria-label="' + s + '"><b>' + s + '</b></button>').join('') + '</div>';
      X().say(C().UI.together, '빛나는 칸을 눌러');
    },
    trace(lesson) {
      const g = lesson.trace;
      ctx.skill = (g >= '가' && g <= '힣') ? 's:' + g : 'j:' + g;
      ctx.trace = { plan: C().glyphPlan(g), si: 0, di: 0, glyph: g };
      host().innerHTML = '<h1 class="prompt">점을 따라 눌러</h1><div class="trace-board" data-letter="' + g + '"><p class="ghost">' + g + '</p><div class="dots"></div></div>';
      drawDots();
      X().say(C().UI.trace, '점을 따라 눌러');
    },
    treasure(lesson) {
      const target = reviewWord(lesson);
      const n = C().choiceN(X().S.difficulty);
      const opts = take(Math.max(2, n), wordPool(lesson), target);
      ctx.skill = 'w:' + target;
      host().innerHTML = '<h1 class="prompt">보물 상자 소리</h1><img class="chest" id="chest" alt="" width="384" height="384" src="assets/pic/chest_closed.webp">' + cardsHTML(opts, id => picCard(id, id === target, X().hintOn(id) && id === target));
      X().say(C().wordKey(target), C().ko(target));
    }
  };

  function drawDots() {
    const box = host().querySelector('.dots');
    if (!box || !ctx.trace) return;
    const pts = ctx.trace.plan[ctx.trace.si] || [];
    box.innerHTML = pts.map((p, i) => {
      const on = i === ctx.trace.di ? ' is-next' : '';
      const done = i < ctx.trace.di ? ' is-done' : '';
      return '<button type="button" class="tap dot' + on + done + '" data-tap="dot" data-i="' + i + '" style="left:' + p[0] + '%;top:' + p[1] + '%" aria-label="점"></button>';
    }).join('');
  }

  function onPiece(el) {
    if (over || el.getAttribute('aria-disabled') === 'true') return;
    const ok = el.dataset.ok === '1';
    const kind = el.dataset.kind;
    if (!ok) return miss(el, host().querySelector('[data-kind="' + kind + '"][data-ok="1"]'));
    const slot = host().querySelector('[data-slot="' + kind + '"]');
    if (slot) slot.textContent = el.textContent.trim();
    el.setAttribute('aria-disabled', 'true');
    el.classList.add('is-off');
    const cho = host().querySelector('[data-slot="cho"]').textContent.trim();
    const jung = host().querySelector('[data-slot="jung"]').textContent.trim();
    const b = ctx.lesson.blocks;
    if (cho === b.c && jung === b.v) {
      const sum = host().querySelector('.sum');
      sum.hidden = false;
      sum.textContent = b.say;
      host().querySelector('.pic-mini').hidden = false;
      X().say(C().sylKey(b.say), b.say);
      finish(misses > 0);
    } else {
      bubble(kind === 'cho' ? '이제 모음!' : '이제 자음!');
    }
  }
  function onCard(el) {
    if (over || hold || el.classList.contains('is-matched') || el.classList.contains('is-up')) return;
    el.classList.add('is-up');
    const mem = ctx.mem;
    mem.open.push(el);
    if (mem.open.length < 2) return;
    const [a, b] = mem.open;
    if (a.dataset.pair === b.dataset.pair) {
      a.classList.add('is-matched');
      b.classList.add('is-matched');
      mem.open = [];
      X().confetti();
      if (host().querySelectorAll('.mem-card.is-matched').length === host().querySelectorAll('.mem-card').length) finish(misses > 0);
      return;
    }
    misses += 1;
    hold = true;
    bubble(misses >= 3 ? '같이 찾았어!' : '다시 한 번!');
    if (misses >= 3) {
      host().querySelectorAll('.mem-card').forEach(c => c.classList.add('is-up', 'is-matched', 'show-ans'));
      hold = false;
      finish(true);
      return;
    }
    setTimeout(() => {
      a.classList.remove('is-up');
      b.classList.remove('is-up');
      mem.open = [];
      hold = false;
    }, 480);
  }
  function onTile(el) {
    if (over) return;
    if (!el.classList.contains('is-lit')) {
      el.classList.add('wiggle');
      bubble('빛나는 칸이야!');
      return;
    }
    el.classList.remove('is-lit');
    el.classList.add('is-hit');
    const s = ctx.lesson.chant[+el.dataset.i];
    X().say(C().sylKey(s), s);
    const next = host().querySelector('[data-i="' + (ctx.chant + 1) + '"]');
    ctx.chant += 1;
    if (next) next.classList.add('is-lit');
    else finish(false);
  }
  function onDot(el) {
    if (over || !ctx.trace) return;
    const i = +el.dataset.i;
    if (i !== ctx.trace.di) return miss(el, host().querySelector('.is-next'));
    el.classList.remove('is-next');
    el.classList.add('is-done');
    ctx.trace.di += 1;
    const pts = ctx.trace.plan[ctx.trace.si] || [];
    if (ctx.trace.di < pts.length) {
      const n = host().querySelector('[data-i="' + ctx.trace.di + '"]');
      if (n) n.classList.add('is-next');
      return;
    }
    ctx.trace.si += 1;
    ctx.trace.di = 0;
    if (ctx.trace.si < ctx.trace.plan.length) {
      bubble('다음 획!');
      drawDots();
      return;
    }
    finish(misses > 0);
  }

  function mount(stage, spec, done) {
    sparkToken += 1;
    ctx = spec;
    onDone = done;
    misses = 0;
    over = false;
    hold = false;
    const fn = mounts[spec.type] || mounts.listen;
    fn(spec.lesson);
  }
  function tap(el) {
    const t = el.dataset.tap;
    if (t === 'play-next') { if (onDone) onDone(); return true; }
    if (over && t !== 'play-next') return false;
    if (t === 'pick') {
      if (el.dataset.ok === '1') {
        el.classList.add('is-ok');
        const chest = document.getElementById('chest');
        if (chest) chest.src = 'assets/pic/chest_open.webp';
        finish(misses > 0);
      } else miss(el, host().querySelector('[data-ok="1"]'));
      return true;
    }
    if (t === 'piece') { onPiece(el); return true; }
    if (t === 'card') { onCard(el); return true; }
    if (t === 'tile') { onTile(el); return true; }
    if (t === 'dot') { onDot(el); return true; }
    return false;
  }
  function replay() {
    if (!ctx) return;
    const lesson = ctx.lesson;
    if (ctx.type === 'listen' || ctx.type === 'match' || ctx.type === 'treasure') {
      const w = lesson.words[0];
      X().say(C().wordKey(w), C().ko(w));
    } else if (ctx.type === 'sparkle') X().say(C().jamoKey(lesson.jamo[0]));
    else if (ctx.type === 'blocks') X().say(C().sylKey(lesson.blocks.say), lesson.blocks.say);
    else X().say(C().UI.together, '같이 해 보자');
    const b = document.getElementById('replayBtn');
    if (b) b.dataset.n = String((+b.dataset.n || 0) + 1);
  }
  window.V5Play = { mount, tap, replay };
})();
