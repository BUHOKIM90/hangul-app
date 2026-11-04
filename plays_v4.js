'use strict';
/* 한글 놀이 v4 — 새 놀이(spec 8장): 몽글이 노래·어제 친구 누구?·풍선 소리 잡기·바구니 나누기·몸으로 글자·스티커 이야기·몽글이 이야기(단원)·누구랑 같은 소리(v4)·
   글자 블록 쌓기·보물 지도·심술 구름 달래기·보물 상자 열기·내가 고르기. 판정은 너그럽게, 첫 시도만 기록, 실패·목숨·카운트다운 없음.
   HP.solve = 자동 시험용(정답 동작을 대신 함). 아이 화면에는 없음. */
const glyphVoice = x => isSyl(x) ? VOICE.syl(x) : VOICE.jamo(x);
const setSolve = fn => { if (window.HP) HP.solve = fn; };
const tapEl = n => { const r = n.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }; n.dispatchEvent(new PointerEvent('pointerdown', o)); n.dispatchEvent(new PointerEvent('pointerup', o)); };
const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await wait(80); } return null; };
/* 답 고르기 한 문제(섞어 묻기용). oneShot = 보물 상자(맞든 틀리든 다음으로, 아이에게 결과 표시 없음) */
function quiz(q, id, host, onAns, oneShot) {
  const box = el('div', 'quiz');
  const read = q.kind === 'read', build = q.kind === 'build';
  const say0 = () => pointSay(read ? [] : build ? [VOICE.syl(q.target)] : [glyphVoice(q.target)]);
  let head;
  if (read) head = el('div', 'qhead', '<div class="qword">' + WORDS[q.target] + '</div><span class="eye">어떤 그림일까?</span>');
  else if (build) { const { cho, jung } = splitSyllable(q.target); head = el('div', 'qhead', '<div class="qbuild"><span>' + cho + '</span>+<span>' + jung + '</span>=<span class="q">?</span></div>'); }
  else head = el('div', 'qhead', '<span class="eye">잘 듣고 골라 봐</span>');
  head.append(speakerBtn(() => (read ? say(VOICE.word(q.target)) : say0())));
  const cards = q.opts.map(x => read ? picCard(x) : glyphCard(x));
  let first = true, locked = false;
  const row = el('div', 'choices' + (cards.length > 3 ? ' four' : ''));
  cards.forEach((c, i) => {
    row.append(c);
    c.addEventListener('click', async () => {
      if (locked || !alive(id)) return;
      const ok = q.opts[i] === q.target;
      if (oneShot) { locked = true; c.classList.add('picked'); ding(1.1); await wait(350); return onAns(ok); }
      if (ok) { locked = true; c.classList.add('ok'); if (await reveal(id, q.target)) onAns(first); }
      else { first = false; locked = true; await retryFx(id, c); locked = false; }
    });
  });
  box.append(head, row); host.append(box);
  setSolve(async () => { const c = cards[q.opts.indexOf(q.target)]; if (c) c.click(); });
  if (!read) say0(); else if (q.i === 0) say(VOICE.word(q.target));
  return box;
}
Object.assign(RUN, {
  /* 🎵 몽글이 노래: 4박 × 줄. 음절 칸이 박자에 맞춰 빛나고 아이는 빛나는 칸을 톡(판정 없음). 오늘 글자 칸은 크게 */
  chant(line, id, s, done) {
    const big = new Set((run.ctx.newJ || []).concat(run.ctx.unitC || []));
    const row = el('div', 'chant'); const tiles = line.map(x => { const t = el('button', 'ctile' + ([...big].some(j => x.includes(j) || splitSyllable(x).cho === j || splitSyllable(x).jung === j) ? ' today' : ''), x); t.dataset.k = x; row.append(t); return t; });
    let lit = -1, taps = 0;
    tiles.forEach((t, k) => t.addEventListener('click', () => { if (k === lit || t.classList.contains('lit')) { t.classList.add('hit'); clapFx(); sparkAt(t); taps++; setTimeout(() => t.classList.remove('hit'), 300); } }));
    const dots = el('div', 'cdots', run.queue.map((_, q) => '<i class="' + (q <= run.i ? 'on' : '') + '"></i>').join(''));
    s.append(guide('cheer', run.i === 0 ? '몽글이 노래! 빛나는 칸을 톡톡!' : '한 줄 더!'), dots, row);
    const go = async () => {
      if (run.i === 0 && !(await say('ui4_chant'))) return;
      setChar('clap'); const ok = await sayGap(line.map(VOICE.syl), 450, k => { lit = k; tiles.forEach((t, i) => t.classList.toggle('lit', i === k)); setChar(k % 2 ? 'clap2' : 'clap'); });
      if (!ok || !alive(id)) return; lit = -1; tiles.forEach(t => t.classList.remove('lit')); await wait(400); if (alive(id)) done(null);
    };
    setSolve(async () => { for (const t of tiles) { await waitFor(() => t.classList.contains('lit'), 4000); t.click(); } });
    go();
  },
  /* 🃏 어제 친구 누구?: 복습 카드가 한 장씩 뒤집힘. 글자 → 소리 듣고 글자 고르기, 낱말 → 낱말 보고 그림 고르기 */
  yesterday(x, id, s, done) {
    const isW = !!WORDS[x];
    const card = el('div', 'flip', '<div class="fc">' + (isW ? '<span class="qword">' + WORDS[x] + '</span>' : '<span class="g">?</span>') + '</div>');
    s.append(guide('think', run.i === 0 ? '어제 만난 친구, 누구였지?' : '이 친구는?'), card);
    const n = Math.max(2, run.ctx.nopt);
    const q = isW ? { kind: 'read', target: x, opts: shuffle([x, ...others(run.ctx.knownW.concat(run.ctx.unitW, FAMILY).filter(w => w !== x && wordHasPicOrEmo(w)), x, n - 1)]), i: 1 }
      : { kind: 'hear', target: x, opts: shuffle([x, ...confGlyph(x, glyphPool(run.ctx), n - 1)]) };
    setTimeout(() => alive(id) && card.classList.add('on'), 200);
    (async () => { if (run.i === 0) await say('ui4_yest'); if (!alive(id)) return; quiz(q, id, s, ok => done(ok)); if (isW) say(VOICE.word(x)); })();
  },
  /* 🎈 풍선 소리 잡기: 풍선 3~4개가 6초에 걸쳐 올라감. 몽글이가 말한 글자 풍선을 톡. 놓치면 다음 묶음(실패 없음) */
  balloon(x, id, s, done) {
    const sk = SKINS.balloon[(run.ctx.dn + run.segIdx) % 3];
    const n = Math.min(4, run.ctx.nopt + 1), opts = shuffle([x, ...confGlyph(x, glyphPool(run.ctx), n - 1)]);
    const sky = el('div', 'sky');
    let first = true, got = false, wave = 0;
    const launch = () => {
      sky.querySelectorAll('.bal').forEach(b => b.remove()); wave++;
      opts.forEach((g, k) => { const b = el('button', 'bal', '<span class="sk">' + artImg('skin_' + ['balloon', 'fish', 'star'][(run.ctx.dn + run.segIdx) % 3], sk[0]) + '</span><span class="g">' + g + '</span>'); b.dataset.k = g; b.style.left = (8 + k * (84 / opts.length)) + '%'; b.style.animationDelay = (k * 0.35) + 's';
        b.addEventListener('pointerdown', async () => { if (got || !alive(id)) return;
          if (g === x) { got = true; b.classList.add('pop'); sparkAt(b); if (await reveal(id, x)) done(first); }
          else { first = false; b.classList.add('wob'); setTimeout(() => b.classList.remove('wob'), 500); setChar('think'); say(glyphVoice(x)); } });
        b.addEventListener('animationend', () => { if (!got && alive(id) && k === opts.length - 1) launch(); });
        sky.append(b); });
    };
    const pr = el('div', 'prompt', '<div class="body"><span class="eye">' + sk[1] + ' 속 글자를 잡아 봐!</span></div>'); pr.append(speakerBtn(() => say(glyphVoice(x))));
    s.append(pr, sky, guide('point', '들은 글자를 톡!', true));
    (async () => { if (run.i === 0 && !(await say('ui4_balloon'))) return; if (!alive(id)) return; launch(); say(glyphVoice(x)); })();
    setSolve(async () => { const b = await waitFor(() => sky.querySelector('.bal[data-k="' + x + '"]')); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  },
  /* 🧺 바구니 나누기: 바구니 2개(라벨 글자) + 카드 6장. 끌거나, 카드 → 바구니 순서로 눌러 넣기 */
  sort(r, id, s, done) {
    const sk = SKINS.sort[(run.ctx.dn + run.segIdx) % 3];
    const top = el('div', 'baskets'), cardsEl = el('div', 'scards');
    let sel = null, left = r.cards.length, busy = false;
    const firstTry = new Map();
    const bs = r.groups.map((g, gi) => { const b = el('button', 'basket', '<span class="sk">' + artImg('basket_' + (gi + 1), sk[0]) + '</span><span class="g">' + g.label + '</span><div class="in"></div>'); b.dataset.g = gi; b.addEventListener('click', () => { if (sel) put(sel, gi); else say(g.voice); }); top.append(b); return b; });
    const put = async (c, gi) => {
      if (busy || !alive(id)) return; busy = true; const node = c.n; node.classList.remove('sel'); sel = null; node.style.transform = '';
      if (c.g === gi) { if (!firstTry.has(c.w)) firstTry.set(c.w, true); rec('w:' + c.w, firstTry.get(c.w)); node.classList.add('used'); bs[gi].querySelector('.in').insertAdjacentHTML('beforeend', '<span>' + picHTML(c.w, WORDS[c.w]) + '</span>'); await reveal(id, c.w, { praise: false, quick: true }); if (!alive(id)) return; left--;
        if (!left && alive(id)) { busy = true; setChar('clap'); bounce(); await say('ui4_proc1'); if (alive(id)) done(null); return; } }
      else { firstTry.set(c.w, false); await retryFx(id, node); }
      busy = false;
    };
    r.cards.forEach(c => { const n = el('div', 'scard', picHTML(c.w, WORDS[c.w]) + (run.ctx.stage >= 2 ? '<b>' + WORDS[c.w] + '</b>' : '')); n.dataset.w = c.w; c.n = n; cardsEl.append(n);
      draggable(n, { onTap: () => { if (busy) return; cardsEl.querySelectorAll('.scard').forEach(x => x.classList.remove('sel')); n.classList.add('sel'); sel = c; say(VOICE.word(c.w)); },
        onDrop: (x, y) => { const gi = bs.findIndex(b => inside(b, x, y)); if (gi < 0) return false; put(c, gi); return true; } }); });
    s.append(guide('think', '같은 소리로 시작하는 친구끼리!'), top, cardsEl);
    (async () => { if (!(await say('ui4_sort'))) return; for (const g of r.groups) { if (!alive(id)) return; await say(g.voice); } })();
    setSolve(async () => { for (const c of r.cards) { if (c.n.classList.contains('used')) continue; await waitFor(() => !busy); put(c, c.g); await waitFor(() => !busy, 6000); } });
  },
  /* 🤸 몸으로 글자: 일어나서 몸으로 글자 모양(판정 없음) */
  body(j, id, s, done) {
    s.append(guide('jump', '일어나서 몸으로 <b>' + j + '</b> 만들어 볼까?'));
    const pic = POSE_PIC[j];
    s.append(el('div', 'movebox', (pic && hasPic(pic) ? picHTML(pic) : '<img class="mgbig" alt="몽글이" src="' + CHAR_DIR + 'jump' + CHAR_EXT + '">') + '<div class="g">' + j + '</div><p>' + POSE_HOW[j] + '</p>'));
    const dock = el('div', 'dock'), b = el('button', 'kid-btn next', '다 했어!<img alt="" src="' + ICON('arrow') + '">'); b.id = 'moveDone';
    b.addEventListener('click', () => { ding(1.3); touch('j:' + j); done(null); }); dock.append(b); s.append(dock);
    (async () => { await say(run.i === 0 ? ['ui4_move', VOICE.jamo(j)] : [VOICE.jamo(j)]); if (alive(id)) setChar('cheer'); })();
    setSolve(async () => b.click());
  },
  /* 📖 스티커 이야기: 장면 + 문장 한 줄(빈칸). 맞는 낱말 카드를 끌어 놓으면 그 그림 스티커가 장면에 붙고 문장을 읽어 줌 */
  stickerstory(pg, id, s, done) {
    const U = UNITS[pg.u - 1], raw = U.story[pg.k - 1], m = raw.match(/\{(.+?)\}/), kr = m ? m[1] : '', w = idOfKr[kr] || U.words[0][1];
    const parts = raw.split(/\{.+?\}/), sc = sceneBg(el('div', 'scene u' + (pg.u % 6)), pg.u);
    sc.innerHTML = '<div class="place">' + U.place + '</div><div class="stk-slot"></div>';
    const line = el('div', 'sline sent', '<span>' + parts[0] + '</span><span class="blank">?</span><span>' + (parts[1] || '') + '</span>');
    const n = Math.min(3, Math.max(2, run.ctx.nopt));
    const opts = shuffle([w, ...others(uWords(U).filter(x => x !== w && wordHasPicOrEmo(x)).concat(run.ctx.knownW.filter(x => x !== w)), w, n - 1)]);
    const row = el('div', 'wcards'); let first = true, busy = false;
    const place = async (x, node) => {
      if (busy || !alive(id)) return; busy = true; node.style.transform = '';
      if (x !== w) { first = false; await retryFx(id, node); busy = false; return; }
      node.classList.add('used'); line.querySelector('.blank').textContent = kr; line.querySelector('.blank').classList.add('ok');
      sc.querySelector('.stk-slot').innerHTML = picHTML(w, kr, 'stk-pic'); sc.classList.add('got'); ding(); sparkAt(sc); setChar('clap');
      await say(hasA(VOICE.st4(pg.u, pg.k)) ? VOICE.st4(pg.u, pg.k) : VOICE.word(w)); if (alive(id) && await reveal(id, w)) done(first);
    };
    opts.forEach(x => { const c = el('div', 'wcard big', WORDS[x]); c.dataset.k = x; row.append(c); draggable(c, { onTap: () => place(x, c), onDrop: (px, py) => { if (!inside(line, px, py) && !inside(sc, px, py)) return false; place(x, c); return true; } }); });
    s.append(sc, line, row, guide('think', '빈칸에 맞는 낱말은?', true));
    (async () => { if (run.i === 0 && !(await say('ui4_sticker'))) return; })();
    setSolve(async () => { const c = row.querySelector('.wcard[data-k="' + w + '"]'); if (c) tapEl(c); });
    run.curKey = 'w:' + w;
  },
  /* 📚 몽글이 이야기(단원 이야기 한 쪽): 읽는 낱말이 빛나고 "○○ 어디 있지?" 짚기 */
  story(pg, id, s, done) {
    const U = UNITS[pg.u - 1], raw = U.story[pg.k - 1], m = raw.match(/\{(.+?)\}/), kr = m ? m[1] : U.words[0][0], w = idOfKr[kr] || U.words[0][1];
    const text = raw.replace(/[{}]/g, ''), words = text.split(' '), at = Math.max(0, words.findIndex(x => x.includes(kr)));
    const pg2 = el('div', 'storypg', '<div class="dotsP">' + run.queue.map((_, q) => '<i class="' + (q === run.i ? 'on' : '') + '"></i>').join('') + '</div><div class="spic scene u' + (pg.u % 6) + '">' + picHTML(w, kr) + '</div>');
    const line = el('div', 'sline'); const spans = words.map((x, k) => { const b = el('button', 'sw', x); b.dataset.k = k; line.append(b); return b; }); pg2.append(line);
    const key = VOICE.st4(pg.u, pg.k), total = text.length, ends = []; let acc = 0; words.forEach(x => { acc += x.length + 1; ends.push(acc / (total + 1)); });
    let asking = false, first = true, busy = false;
    const prompt = async () => {
      stopAudio(); setChar('point'); asking = false; const t = sayToken; spans.forEach(x => x.classList.remove('lit'));
      await playOne(hasA(key) ? key : VOICE.word(w), p => { if (t === sayToken) spans.forEach((x, k) => x.classList.toggle('lit', k === 0 || p >= ends[k - 1] - 0.04)); });
      if (t !== sayToken || !alive(id)) return; spans.forEach(x => x.classList.add('lit'));
      asking = true; setBubble('‘' + kr + '’ 어디 있지?'); await say(['ui_storyq', VOICE.word(w)]); if (alive(id)) setChar('think');
    };
    spans.forEach((b, k) => b.addEventListener('click', async () => { if (!asking || busy || !alive(id)) return;
      if (k === at) { busy = true; b.classList.add('ok'); if (await success(id, w)) done(first); } else { first = false; busy = true; await retryFx(id, b); busy = false; } }));
    const tools = el('div', 'tools'), hb = el('button', 'kid-btn', '<img alt="" src="' + ICON('speaker') + '">다시 읽기'); hb.addEventListener('click', prompt); tools.append(hb);
    s.append(pg2, tools, guide('think', '같이 읽어 보자', true)); prompt();
    setSolve(async () => { await waitFor(() => asking, 15000); spans[at].click(); });
    run.curKey = 'w:' + w;
  },
  /* 🔔 누구랑 같은 소리?(v4): "나, 나비 할 때 나!" → 같은 소리로 시작하는 그림 */
  same(it, id, s, done) {
    const f = it.f, ans = it.ans, a0 = WORDS[f][0], ch = splitSyllable(a0).cho;
    const pool = Object.keys(WORDS).filter(x => wordHasPicOrEmo(x) && WORDS[x][0] !== a0 && splitSyllable(WORDS[x][0]).cho !== ch && x !== ans);
    const opts = shuffle([ans, ...others(pool, ans, Math.max(2, run.ctx.nopt) - 1)]);
    const prompt = () => pointSay([VOICE.first(f), 'ui_same']);
    const pr = el('div', 'prompt', '<div class="body">' + picHTML(f, WORDS[f], 'hero-pic') + '<div class="syl"><span class="q">' + (run.ctx.stage >= 2 ? a0 : '?') + '</span></div></div>'); pr.append(speakerBtn(prompt));
    s.append(pr, el('div', 'ask', '같은 소리를 골라 봐'), choiceRound(id, opts.map(picCard), opts.indexOf(ans), done), guide('think', '잘 듣고 골라 봐', true));
    s.querySelectorAll('.ch').forEach(c => c.addEventListener('click', () => { if (c.dataset.k === ans) { const q = pr.querySelector('.syl span'); q.textContent = a0; q.classList.replace('q', 'on'); setBubble('<b>' + WORDS[f] + '</b>, <b>' + WORDS[ans] + '</b>!'); say(VOICE.word(ans)); } }));
    prompt(); setSolve(async () => s.querySelector('.ch[data-k="' + ans + '"]').click());
  },
  /* 🧱 글자 블록 쌓기: ① 자모 블록을 글자 칸(옆/위아래 짜임)에 ② 음절 블록을 낱말 상자에 순서대로 */
  block(it, id, s, done) {
    let first = true, busy = false;
    if (it.t === 'syl') {
      const sy = it.v, { cho, jung } = splitSyllable(sy), tb = !VERTICAL_VOWELS.includes(jung);
      const pieces = shuffle([{ t: 'c', g: cho }, { t: 'v', g: jung }, { t: 'c', g: confGlyph(cho, run.ctx.cons, 1)[0] || 'ㄴ' }, { t: 'v', g: CONF[jung] || 'ㅓ' }].filter((p, i, A) => A.findIndex(q => q.g === p.g) === i));
      const frame = el('div', 'frame' + (tb ? ' tb' : '')), sc = el('div', 'slot c'), sv = el('div', 'slot v'); frame.append(sc, sv, el('div', 'whole', sy));
      const col = el('div', 'pieces blocks'); let filled = 0;
      const tryP = async (p, node) => { if (busy || !alive(id)) return; const ok = (p.t === 'c' && p.g === cho && !sc.textContent) || (p.t === 'v' && p.g === jung && !sv.textContent);
        node.style.transform = ''; if (!ok) { first = false; busy = true; await retryFx(id, node); busy = false; return; }
        (p.t === 'c' ? sc : sv).textContent = p.g; (p.t === 'c' ? sc : sv).classList.add('filled'); node.classList.add('used'); ding(1.2); say(glyphVoice(p.g)); filled++;
        if (filled === 2) { busy = true; await wait(400); frame.classList.add('done'); if (await reveal(id, sy)) done(first); } };
      pieces.forEach(p => { const n = el('div', 'piece ' + p.t, p.g); n.dataset.k = p.t + p.g; draggable(n, { onTap: () => tryP(p, n), onDrop: (x, y) => { if (!inside(frame, x, y)) return false; tryP(p, n); return true; } }); col.append(n); });
      const pr = el('div', 'prompt', '<div class="body"><span class="eye">블록으로 <b style="font-size:30px;color:var(--lav-ink)">' + sy + '</b> 만들기</span></div>'); pr.append(speakerBtn(() => say(VOICE.syl(sy))));
      const wrap = el('div', 'merge'); wrap.append(frame, col); s.append(pr, wrap, guide('think', '블록을 눌러 봐', true));
      (async () => { if (run.i === 0) await say('ui4_block'); if (alive(id)) say(VOICE.syl(sy)); })();
      setSolve(async () => { for (const k of ['c' + cho, 'v' + jung]) { await waitFor(() => !busy); const n = col.querySelector('.piece[data-k="' + k + '"]:not(.used)'); if (n) tapEl(n); await wait(300); } });
    } else {
      const w = it.v, sl = [...WORDS[w]], extra = confGlyph(sl[0], sylsOf(run.ctx, run.ctx.cons), 2).filter(x => !sl.includes(x));
      const boxes = el('div', 'sboxes', sl.map(() => '<span class="sbx"></span>').join('')), bx = [...boxes.children];
      const col = el('div', 'pieces blocks'); let at = 0;
      const tryP = async (g, node) => { if (busy || !alive(id)) return; node.style.transform = '';
        if (g !== sl[at]) { first = false; busy = true; await retryFx(id, node); busy = false; return; }
        bx[at].textContent = g; bx[at].classList.add('filled'); node.classList.add('used'); ding(1.2); say(VOICE.syl(g)); at++;
        if (at === sl.length) { busy = true; await wait(400); boxes.classList.add('done'); if (alive(id) && await success(id, w)) done(first); } };
      shuffle(sl.concat(extra)).forEach(g => { const n = el('div', 'piece v', g); n.dataset.k = g; draggable(n, { onTap: () => tryP(g, n), onDrop: (x, y) => { if (!inside(boxes, x, y)) return false; tryP(g, n); return true; } }); col.append(n); });
      const pr = el('div', 'prompt blockw', '<div class="body">' + picHTML(w, WORDS[w], 'hero-pic') + '</div>'); pr.append(speakerBtn(() => say(VOICE.word(w))));
      s.append(pr, boxes, col, guide('think', '소리 한 번에 상자 하나!', true));
      (async () => { await say(['ui4_box', VOICE.word(w)]); })();
      setSolve(async () => { for (const g of sl) { await waitFor(() => !busy); const n = [...col.querySelectorAll('.piece:not(.used)')].find(x => x.dataset.k === g); if (n) tapEl(n); await wait(300); } });
    }
  },
  /* 🗺️ 보물 지도: 정거장 5개, 정거장마다 갈림길 2개. "○○로 가자!" 맞는 길 → 다음 정거장, 끝에 보물 상자 */
  map(r, id, s, done) {
    const sk = SKINS.map[(run.ctx.dn + run.segIdx) % 3], qs = r.qs.map(q => Object.assign({}, q, { opts: q.opts.slice(0, 2).includes(q.target) ? q.opts.slice(0, 2) : shuffle([q.target, q.opts.find(o => o !== q.target)]) }));
    const mp = el('div', 'tmap', '<div class="trail">' + qs.map((_, k) => '<i data-k="' + k + '"></i>').join('') + '<b class="chest">🎁</b></div><img class="mgwalk" alt="" src="' + CHAR_DIR + 'basic' + CHAR_EXT + '">');
    mp.classList.add('sk' + (run.ctx.dn % 3)); const host = el('div', 'qhost');
    s.append(guide('cheer', sk[1] + ' 보물 지도를 따라가 볼까?'), mp, host);
    const walk = k => { const st = mp.querySelectorAll('.trail i'), mw = mp.querySelector('.mgwalk'); const t = k < st.length ? st[k] : mp.querySelector('.chest'); mw.style.left = (t.offsetLeft + t.offsetWidth / 2 - 30) + 'px'; st.forEach((x, q) => x.classList.toggle('on', q < k)); };
    let k = 0;
    const next = () => {
      if (!alive(id)) return; walk(k); host.innerHTML = '';
      if (k >= qs.length) { mp.querySelector('.chest').classList.add('open'); ding(); sparkAt(mp.querySelector('.chest')); (async () => { await say('ui4_treasure2'); if (alive(id)) done(null); })(); return; }
      const q = qs[k]; quiz(q, id, host, ok => { rec(q.key, ok); k++; next(); });
    };
    (async () => { if (!(await say('ui4_map'))) return; requestAnimationFrame(next); })();
  },
  /* ☁️ 심술 구름 달래기: 글자 6개를 찾을 때마다 구름이 작아지고 무지개가 생김(시간·목숨·실패 없음) */
  cloud(r, id, s, done) {
    const sky = el('div', 'cloudsky', '<div class="rainbow"></div><div class="grump"><span class="cf">' + artImg('cloud_grump', '😤') + '</span></div><div class="town">🏠🌳🏡</div>');
    const host = el('div', 'qhost'), g = sky.querySelector('.grump'), rb = sky.querySelector('.rainbow');
    s.append(guide('think', '심술 구름이 글자를 숨겼어!'), sky, host);
    let k = 0;
    const draw = () => { const p = k / r.qs.length; g.style.transform = 'scale(' + (1 - 0.6 * p).toFixed(2) + ')'; rb.style.opacity = p.toFixed(2); g.querySelector('.cf').innerHTML = p >= 1 ? artImg('cloud_smile', '😊') : p > 0.5 ? artImg('cloud_surprise', '😐') : artImg('cloud_grump', '😤'); };
    const next = () => {
      if (!alive(id)) return; draw(); host.innerHTML = '';
      if (k >= r.qs.length) { sky.classList.add('happy'); setChar('laugh'); bounce(); (async () => { await say('ui4_cloudok'); if (alive(id)) done(null); })(); return; }
      const q = r.qs[k]; q.i = k; quiz(q, id, host, ok => { rec(q.key, ok); k++; next(); });
    };
    (async () => { if (!(await say('ui4_cloud'))) return; next(); })();
  },
  /* 🎁 보물 상자 열기(점검 날): 상자 10개(잔치 날 12개). 문제 하나씩, 맞든 틀리든 상자는 열리고 반짝(결과는 어른 메뉴에만) */
  treasure(r, id, s, done) {
    const grid = el('div', 'chests'), host = el('div', 'qhost');
    const qs = r.qs; S.session.check = { day: run.ctx.dn, date: today(), right: 0, total: 0, by: { ear: [0, 0], read: [0, 0], write: [0, 0] } };
    const ch = qs.map((q, k) => { const b = el('button', 'chest', artImg('chest_closed', '🎁')); b.dataset.k = k; grid.append(b); return b; });
    let k = 0;
    s.append(guide('cheer', '보물 상자를 열어 볼까?'), grid, host);
    const next = () => {
      if (!alive(id)) return; host.innerHTML = ''; ch.forEach((b, q) => b.classList.toggle('now', q === k));
      if (k >= qs.length) { const c = S.session.check; S.checks.push(c); S.session.check = null; save(); (async () => { setChar('jump'); bounce(); await say('ui4_treasure2'); if (alive(id)) done(null); })(); return; }
      const q = qs[k]; q.i = k;
      quiz(q, id, host, ok => { const c = S.session.check, by = q.kind === 'hear' ? 'ear' : q.kind === 'read' ? 'read' : 'write'; c.by[by][1]++; if (ok) c.by[by][0]++;
        rec(q.key, ok); ch[k].classList.add('open'); ch[k].innerHTML = artImg('chest_open', '✨'); sparkAt(ch[k]); k++; setTimeout(next, 450); }, true);
    };
    (async () => { if (!(await say('ui4_treasure'))) return; next(); })();
  },
  /* 🎲 내가 고르기(15분): 지금까지 해 본 놀이 카드 3장 중 하나 */
  pick3(_, id, s, done) {
    const pool = S.played.filter(t => IMPL.includes(t) && !SPECIAL_ONLY.includes(t) && !['yesterday', 'pick3', 'stickerstory', 'story', 'body'].includes(t));
    const three = shuffle(pool).slice(0, 3);
    s.append(guide('wave', '하고 싶은 놀이를 골라 봐!'));
    const row = el('div', 'pick3');
    three.forEach(t => { const b = el('button', 'pcard3', '<span class="emo">' + PLAY_ICON[t] + '</span><b>' + CURR.plays[t].kid + '</b>'); b.dataset.t = t; b.addEventListener('click', () => { ding(); done({ chosen: t }); }); row.append(b); });
    s.append(row); say('ui4_again');
    setSolve(async () => row.querySelector('.pcard3') && row.querySelector('.pcard3').click());
    if (!three.length) done(null);
  }
});

/* ---------- 숨은 글자 찾기 v4(11/03 대표님 변경): 낱말을 한 글자씩 서로 다른 자리에 숨김 → 찾을 때마다 낱말 카드 칸이 채워짐 ----------
   단계 1 = 낱말 글자만 / 단계 2 = 글자마다 닮은 가짜 1개(모→마) / 단계 3 = 더 닮은 가짜 2개(모→무·보), 더 작고 바탕색에 더 섞임.
   세션(숨은 글자 한 판)이 정확하면 올라가고, 가짜를 많이 누르거나 못 찾으면 내려감(hidAdapt). 단원·특별한 날과도 묶임(hidLevel). */
const HID4 = { hint: 15000, reveal: 30000, lv: { 1: { size: 1, delta: 0.42, rot: 6, per: 0, max: 0 }, 2: { size: 0.86, delta: 0.28, rot: 10, per: 1, max: 3 }, 3: { size: 0.74, delta: 0.17, rot: 16, per: 2, max: 5 } } };
const CONS_SIM = { 'ㄱ': 'ㅋㄲ', 'ㄲ': 'ㄱㅋ', 'ㄴ': 'ㄷㄹ', 'ㄷ': 'ㅌㄴ', 'ㄸ': 'ㄷㅌ', 'ㄹ': 'ㄷㄴ', 'ㅁ': 'ㅂㅇ', 'ㅂ': 'ㅁㅍ', 'ㅃ': 'ㅂㅍ', 'ㅅ': 'ㅈㅆ', 'ㅆ': 'ㅅㅈ', 'ㅇ': 'ㅎㅁ', 'ㅈ': 'ㅊㅅ', 'ㅉ': 'ㅈㅊ', 'ㅊ': 'ㅈㅅ', 'ㅋ': 'ㄱㅌ', 'ㅌ': 'ㄷㅋ', 'ㅍ': 'ㅂㅌ', 'ㅎ': 'ㅇㅊ' };
const VOW_SIM = { 'ㅏ': 'ㅓㅑ', 'ㅓ': 'ㅏㅕ', 'ㅗ': 'ㅜㅛ', 'ㅜ': 'ㅗㅠ', 'ㅡ': 'ㅜㅣ', 'ㅣ': 'ㅡㅏ', 'ㅐ': 'ㅔㅏ', 'ㅔ': 'ㅐㅓ', 'ㅑ': 'ㅏㅕ', 'ㅕ': 'ㅓㅑ', 'ㅛ': 'ㅗㅠ', 'ㅠ': 'ㅜㅛ' };
const VOW_FAR = { 'ㅏ': 'ㅗㅜㅣ', 'ㅓ': 'ㅗㅣㅜ', 'ㅗ': 'ㅏㅣㅓ', 'ㅜ': 'ㅏㅣㅓ', 'ㅡ': 'ㅏㅗ', 'ㅣ': 'ㅗㅜ', 'ㅐ': 'ㅗㅜ', 'ㅔ': 'ㅗㅜ' };
function lookAlike(s, close, avoid) {   // 닮은 가짜 글자. close=false: 같은 자음+먼 모음(모→마), close=true: 가까운 모음·닮은 자음(모→무·보)
  const { cho, jung } = splitSyllable(s), jg = (s.charCodeAt(0) - 0xAC00) % 28, mk = (c, v) => { const ci = CHO.indexOf(c), vi = JUNG.indexOf(v); return ci < 0 || vi < 0 ? null : String.fromCharCode(0xAC00 + (ci * 21 + vi) * 28 + jg); };   // 받침은 그대로(방 → 봉·벙)
  const far = [...(VOW_FAR[jung] || 'ㅏㅗ')].map(v => mk(cho, v)), near = [...(VOW_SIM[jung] || '')].map(v => mk(cho, v)).concat([...(CONS_SIM[cho] || '')].map(c => mk(c, jung)));
  const known = x => { const p = splitSyllable(x); return (S.met[p.cho] || 0) && (S.met[p.jung] || 0); };
  const list = [...new Set((close ? near.concat(far) : far.concat(near)).filter(x => x && x !== s && !avoid.includes(x)))];
  return list.sort((a, b) => (known(b) ? 1 : 0) - (known(a) ? 1 : 0) || (hasA(VOICE.syl(b)) ? 1 : 0) - (hasA(VOICE.syl(a)) ? 1 : 0));   // 아는 글자·소리 있는 글자 먼저(안정 정렬 → 닮은 순서 유지)
}
RUN.hidden = function (w, id, s, done) {
  const lv = run.p.lv || 1, L = HID4.lv[lv], spots = shuffle((HSPOT4[w] || []).slice()), syl = [...WORDS[w]];
  if (spots.length < syl.length) return done(null);
  const marks = syl.map((g, k) => ({ g, slot: k, target: true, sp: spots[k] }));
  const nd = Math.min(L.max, L.per * syl.length, spots.length - syl.length), dec = [];
  for (let r = 0; dec.length < nd && r < 3; r++) syl.forEach(g => { if (dec.length < nd) { const c = lookAlike(g, lv >= 3, syl.concat(dec))[r]; if (c) dec.push(c); } });
  dec.forEach((g, q) => marks.push({ g, target: false, sp: spots[syl.length + q] }));
  let decoyTaps = 0, reveals = 0, lastT = Date.now(); const got = new Set();
  const prompt = () => pointSay(VOICE.hw(w));
  const pr = el('div', 'hwcard'), slots = el('div', 'hwslots', syl.map((g, k) => '<span class="slot" data-k="' + k + '">' + g + '</span>').join('')); pr.append(slots, speakerBtn(prompt));
  const box = el('div', 'hwbox'), img = el('img'); img.alt = ''; img.src = ARTX(w + '_big') ? 'assets/pic/' + w + '_big.webp' : PIC(w); img.draggable = false; box.append(img);   // 누나 크게
  const ring = el('div', 'hwring'); box.append(ring);
  const mix = (c, d) => { const lum = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114; return 'rgb(' + c.map(v => Math.round(lum < 110 ? v + (255 - v) * d : v * (1 - d))).join(',') + ')'; };
  marks.forEach(m => { const [cx, cy, sz, col] = m.sp; const e = el('span', 'hw hw1' + (m.target ? ' tgt' : ' decoy'), m.g); e.style.left = cx + '%'; e.style.top = cy + '%'; e.style.color = mix(col, L.delta); m.rot = (Math.random() * 2 - 1) * L.rot; m.sz = sz; m.el = e; box.append(e); });
  const nextT = () => marks.find(m => m.target && !got.has(m.slot));
  const fit = () => { const W = box.getBoundingClientRect().width; if (!W) return;
    const zs = marks.map(m => m.sz).sort((a, b) => a - b), same = lv >= 3 ? zs[0] : lv === 2 ? zs[Math.floor(zs.length / 2)] : 0;   // 단계 2·3: 진짜·가짜 글자 크기를 맞춰 크기로 티 나지 않게
    marks.forEach(m => { m.el.style.fontSize = Math.max(lv >= 3 ? 18 : 22, Math.min(m.sz, same || m.sz, 16) * 0.85 * L.size * W / 100).toFixed(1) + 'px'; m.el.style.transform = 'translate(-50%,-50%) rotate(' + m.rot.toFixed(1) + 'deg)'; });
    const t = nextT(); if (!t) return; const r = t.el.getBoundingClientRect(), b = box.getBoundingClientRect(), pad = 24;
    ring.style.left = (r.left - b.left - pad) + 'px'; ring.style.top = (r.top - b.top - pad) + 'px'; ring.style.width = (r.width + 2 * pad) + 'px'; ring.style.height = (r.height + 2 * pad) + 'px'; };
  s.append(guide('think', '<b>' + WORDS[w] + '</b> 글자를 하나씩 찾아봐!'), pr, box);
  fit(); requestAnimationFrame(fit); new ResizeObserver(fit).observe(box);
  const tick = setInterval(() => { if (!alive(id)) return clearInterval(tick); if (got.size === syl.length) return;
    const dt = Date.now() - lastT;
    if (dt > HID4.hint && !ring.classList.contains('on')) { fit(); ring.classList.add('on'); setBubble('반짝이는 데를 봐!'); say('ui_hwhint'); }
    if (dt > HID4.reveal) { reveals++; find(nextT(), true); } }, 500);
  async function find(m, revealed) {
    got.add(m.slot); lastT = Date.now(); ring.classList.remove('on'); m.el.classList.add('found'); sparkAt(m.el); ding(); bounce();
    const sl = slots.querySelector('[data-k="' + m.slot + '"]'); sl.classList.add('on'); sparkAt(sl);
    touch('s:' + m.g);
    if (got.size < syl.length) { setChar(revealed ? 'point' : 'clap'); setBubble((revealed ? '여기 있었어! ' : '찾았다! ') + '<b>' + m.g + '</b>!'); fit(); await say(VOICE.syl(m.g)); return; }
    clearInterval(tick); setChar('jump'); setBubble('다 찾았다! <b>' + WORDS[w] + '</b>!');
    await say('ui_found'); if (!(await reveal(id, w))) return;
    run.hid = run.hid || { rounds: 0, clean: 0, decoy: 0, rev: 0 }; run.hid.rounds++; run.hid.decoy += decoyTaps; run.hid.rev += reveals; if (!decoyTaps && !reveals) run.hid.clean++;
    if (alive(id)) done(reveals ? false : decoyTaps === 0);
  }
  box.addEventListener('pointerdown', async e => {
    if (!alive(id) || got.size === syl.length) return;
    const hit = marks.filter(m => !(m.target && got.has(m.slot))).map(m => { const r = m.el.getBoundingClientRect(), g = Math.max(22, r.height * 0.5);
      return { m, inside: e.clientX >= r.left - g && e.clientX <= r.right + g && e.clientY >= r.top - g && e.clientY <= r.bottom + g, d: Math.hypot(e.clientX - (r.left + r.right) / 2, e.clientY - (r.top + r.bottom) / 2) }; }).filter(x => x.inside).sort((a, b) => a.d - b.d)[0];
    if (!hit) return;
    if (hit.m.target) return find(hit.m, false);
    decoyTaps++; hit.m.el.classList.remove('seen'); void hit.m.el.offsetWidth; hit.m.el.classList.add('seen'); setChar('think');
    const want = nextT().g; setBubble('그건 <b>' + hit.m.g + '</b>! <b>' + syl.filter((g, k) => !got.has(k)).join('</b>, <b>') + '</b>를 찾아볼까?');
    const hx = g => g.charCodeAt(0).toString(16).toUpperCase(); await say([hasA('dy_' + hx(hit.m.g)) ? 'dy_' + hx(hit.m.g) : VOICE.syl(hit.m.g), hasA('fy_' + hx(want)) ? 'fy_' + hx(want) : VOICE.syl(want)]);   // "그건 마야." + "모를 찾아볼까?"(v3 한 글자 숨기기 소리)
  });
  if (window.HP) HP.hidden = { target: w, lv, syl, decoys: dec, marks: marks.map(m => ({ g: m.g, target: m.target })), rect: k => { const m = k == null ? nextT() : marks[k]; const r = m.el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, get found() { return got.size === syl.length; }, get got() { return got.size; }, ring: () => ring.classList.contains('on') };
  prompt();
};

/* ---------- 👀 글자 보고 그림 찾기(11/04 대표님: "할아버지" 소리만 듣고 고르면 너무 쉬움 → 글자를 읽고 고르게) ----------
   예전 '어디 있니?'(소리 듣고 그림) 자리. 낱말 글자를 크게 보여 주고 소리는 먼저 들려주지 않음. 아이가 글자를 읽고 그림을 톡.
   도움(단계별로 약해짐): 가만히 있으면 첫 글자가 반짝 + 첫 글자 소리만(1~2단계 7초, 3~4단계 12초, 5단계부터 없음, 어른 메뉴 색 힌트 '켜기'면 늘 7초).
   '도와줘' 단추 = 한 글자씩 짚으며 읽어 줌(낱말 통째로는 안 읽음). 두 번 틀리면 자동으로 한 글자씩 읽어 줌.
   가짜 그림: 1단계 = 글자 모양이 다른 낱말, 2단계부터 = 첫 글자·글자가 겹치는 닮은 낱말(할아버지 ↔ 할머니), 3단계부터·잘하는 아이는 4장.
   맞히면 글자 칸이 한 글자씩 불이 켜지며 읽어 주고 낱말 전체 + 칭찬. 도움 받고 맞힌 건 복습 기록에 넣지 않음(null). */
if (CURR.plays && CURR.plays.listen) { CURR.plays.listen.kid = '글자 보고 그림 찾기'; CURR.plays.listen.goal = '낱말 글자를 읽고 뜻(그림)과 잇기'; }
if (typeof PLAY_ICON !== 'undefined') PLAY_ICON.listen = '👀';
RUN.listen = function (w, id, s, done) {
  const st = (run.ctx && run.ctx.stage) || 1, syl = [...WORDS[w]];
  const picOk = x => WORDS[x] && (hasPic(x) || PH_EMOJI[x]) && hasA(VOICE.word(x));
  const n = st >= 3 || S.hard ? 4 : 3;
  const base = (run.p.items.length >= 6 ? run.p.items : run.p.items.concat(WORD_IDS)).filter(x => x !== w && picOk(x) && WORDS[x] !== WORDS[w] && !PIC_CLASH(x, w));
  const look = x => { const a = [...WORDS[x]]; return (a[0] === syl[0] ? 3 : 0) + a.filter(c => syl.includes(c)).length * 2 + (a.length === syl.length ? 1 : 0) + (splitSyllable(a[0]).cho === splitSyllable(syl[0]).cho ? 1 : 0) + Math.random(); };
  let dis;
  if (st <= 1 && !S.hard) dis = others(base.filter(x => WORDS[x][0] !== syl[0] && ![...WORDS[x]].some(c => syl.includes(c))), w, n - 1);
  else { const near = shuffle(base.concat(WORD_IDS.filter(x => x !== w && picOk(x) && !PIC_CLASH(x, w) && WORDS[x] !== WORDS[w]))).sort((a, b) => look(b) - look(a)); dis = others(near.slice(0, 6), w, n - 1); }
  if (dis.length < n - 1) dis = dis.concat(others(base.filter(x => !dis.includes(x)), w, n - 1 - dis.length));
  { const seen = new Set([PIC(w)]); dis = dis.filter(x => { const k = PIC(x); if (seen.has(k)) return false; seen.add(k); return true; }); }   // 같은 그림 두 장 금지
  const opts = shuffle([w, ...dis]);
  const autoMs = S.settings.colorHint === 'on' ? 7000 : st <= 2 ? 7000 : st <= 4 ? 12000 : 0;
  const pr = el('div', 'prompt lw' + (syl.length >= 4 ? ' long' : ''), '<div class="body syl">' + syl.map(c => '<span>' + c + '</span>').join('') + '</div>');
  const tiles = [...pr.querySelectorAll('.syl span')];
  let helped = false, first = true, locked = false, wrong = 0, lastT = Date.now(), hinted = false;
  const allSyl = syl.every(c => hasA(VOICE.syl(c)));
  const readSlow = async () => {   // 한 글자씩 짚으며 읽기
    helped = true; lastT = Date.now(); setChar('point');
    const ok = allSyl ? await sayGap(syl.map(VOICE.syl), 550, k => tiles.forEach((t, i) => t.classList.toggle('on', i === k))) : await say(VOICE.word(w));
    tiles.forEach(t => t.classList.remove('on')); if (ok && alive(id)) setChar('think'); lastT = Date.now();
  };
  const help = speakerBtn(() => { if (!locked) readSlow(); }, 'spk helpbtn', '도와줘');
  pr.append(help);
  const row = el('div', 'choices' + (n > 3 ? ' n4' : ''));
  const cards = opts.map(x => { const c = picCard(x); c.insertAdjacentHTML('beforeend', '<span class="badge"><img alt="" src="' + ICON('check') + '"></span>'); row.append(c); return c; });
  cards.forEach((c, i) => c.addEventListener('click', async () => {
    const x = opts[i]; if (locked || !alive(id) || c.classList.contains('no')) return;
    lastT = Date.now(); locked = true; stopAudio();
    if (x === w) {
      c.classList.add('ok'); sparkAt(c); tiles.forEach(t => t.classList.add('on')); setBubble('맞아! <b>' + WORDS[w] + '</b>!');
      if (await reveal(id, w)) done(helped ? (first ? null : false) : first);
      return;
    }
    first = false; wrong++; c.classList.add('retry', 'no'); setChar('think'); setBubble('그건 <b>' + WORDS[x] + '</b>!');
    c.insertAdjacentHTML('beforeend', '<span class="wname">' + WORDS[x] + '</span>');
    await say(VOICE.word(x)); if (!alive(id)) return;
    locked = false;
    if (wrong >= 2) readSlow(); else say('ui_retry');
  }));
  s.append(pr, el('div', 'ask', '글자를 읽고 그림을 찾아 봐'), row, guide('think', '<b>' + WORDS[w] + '</b>, 어떤 그림일까?', true));
  const tick = setInterval(() => {
    if (!alive(id)) return clearInterval(tick);
    if (!autoMs || hinted || locked || Date.now() - lastT < autoMs) return;
    hinted = true; helped = true; tiles[0].classList.add('hint'); setBubble('첫 글자는 <b>' + syl[0] + '</b>!');
    say(hasA(VOICE.syl(syl[0])) ? VOICE.syl(syl[0]) : VOICE.word(w));
  }, 500);
  if (window.HP) HP.listen = { word: w, text: WORDS[w], opts: opts.slice(), stage: st, get helped() { return helped; } };
  setSolve(async () => { const c = cards[opts.indexOf(w)]; if (c) c.click(); });
  if (run.i === 0) say('ui_which');
};
