'use strict';
/* v6 games: 13 plays + the stage planner. Each play is async (host, cfg, ctx) and resolves when finished. */
(function (G) {
  const D = G.D, A = G.A, UI = G.UI, St = G.St, W = G.W;
  const { el, btn, sleep, shuffle, pick, esc } = UI;
  const P = {};

  /* ---------- shared bits ---------- */
  function head(host, title, clip, sub) {
    const h = el('div', 'play-head');
    h.appendChild(el('h2', 'play-title', esc(title)));
    if (sub) h.appendChild(el('p', 'play-sub', esc(sub)));
    host.appendChild(h);
    let say = null;
    if (clip) {
      say = btn('speaker', '<span class="spk">🔊</span>', () => {
        const k = typeof clip === 'function' ? clip() : clip;
        if (k) A.play(k);
      }, '다시 듣기');
      h.appendChild(say);
    }
    return { h, say };
  }
  /* Spoken instruction at the start of a play (4-year-olds cannot read the subtitle). */
  async function say(ctx, key) {
    if (!ctx.alive() || !key) return;
    /* While the instruction plays, the friend explains it on the (still empty) board. */
    const b = UI.$('.play .play-body');
    let ex = null;
    if (b && !b.children.length) {
      const sub = UI.$('.play .play-sub');
      ex = el('div', 'explain', `<div class="ex-pal">${UI.mascot('wow')}</div><p class="ex-bubble">${esc(sub ? sub.textContent : '')}</p>`);
      b.appendChild(ex);
    }
    await A.play(key);
    if (ex) ex.remove();
  }
  function body(host, cls) { const b = el('div', 'play-body ' + (cls || '')); host.appendChild(b); return b; }
  /* Correct answer: praise text + jingle now (same tap handler), then lead sound, then praise voice. */
  async function right(ctx, type, e, node, item, lead) {
    St.mark(item, true);
    ctx.right++;
    ctx.streakWrong = 0;
    const at = UI.pointOf(e, node);
    const p = UI.praise(type, at, { lead });
    UI.flyStar(at).then(() => ctx.star());
    await p;
    if (ctx.alive()) await ctx.gift();
  }
  function wrong(ctx, node, item, clip) {
    St.mark(item, false);
    ctx.wrong++;
    ctx.streakWrong = (ctx.streakWrong || 0) + 1;
    UI.oops(node);
    /* after two misses in a row: name what was pressed, then "괜찮아. 같이 해 보자." */
    const seq = [clip].concat(ctx.streakWrong === 2 ? ['ui4_try'] : []).filter(Boolean);
    if (seq.length) setTimeout(() => { if (ctx.alive()) A.sequence(seq, null, 0.2); }, 250);
  }
  const syClip = ch => (D.has.sy(ch) ? D.syKey(ch) : null);
  const findClip = ch => (D.has.fy(ch) ? D.fyKey(ch) : syClip(ch));
  const thatClip = ch => (D.has.dy(ch) ? D.dyKey(ch) : syClip(ch));
  const wordThat = k => (D.HY.has(k) ? 'hy_' + k : 'w_' + k);
  const jamoClip = j => (D.VROW[j] && D.has.sy(D.VROW[j]) ? D.syKey(D.VROW[j]) : (D.has.j(j) ? D.jKey(j) : null));
  /* Wait until one of `nodes` is tapped; handler(node, e) returns true to finish. */
  function choose(nodes, handler) {
    return new Promise(res => {
      let busy = false, over = false;
      nodes.forEach(n => UI.tap(n, async e => {
        if (busy || over) return;
        busy = true;
        const r = await handler(n, e);
        busy = false;
        if (r) { over = true; res(n); }
      }));
    });
  }
  /* QA hook: the value the child should tap now (read only by the test bot). */
  const ans = v => { G.__answer = v === null || v === undefined ? null : String(v); };
  function hintAfter(ctx, node, ms) {
    const t = setTimeout(() => { if (ctx.alive() && node.isConnected) node.classList.add('hint'); }, ms);
    return () => clearTimeout(t);
  }

  /* Pick up to n words from list, skipping any that could be mixed up with one already taken (or with `taken`). */
  function apart(list, n, taken) {
    const out = [], have = (taken || []).slice();
    for (const k of list) { if (out.length >= n) break; if (!have.some(x => D.clash(x, k))) { out.push(k); have.push(k); } }
    return out;
  }
  /* Any syllable can be spoken: the studio clip when there is one, otherwise a family recording or the device voice. */
  const sayKey = ch => syClip(ch) || D.syKey(ch);
  /* ---------- drag-and-drop (tapping still works: the piece flies into its slot) ---------- */
  function inside(z, x, y) {
    const r = z.getBoundingClientRect(), pad = Math.max(28, Math.min(innerWidth, innerHeight) * 0.05);
    return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  }
  function ghostOf(n) {
    const r = n.getBoundingClientRect(), g = n.cloneNode(true);
    g.classList.remove('hint', 'next', 'tap');
    g.classList.add('ghost');
    g.removeAttribute('data-v');
    Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', visibility: 'visible' });
    document.body.appendChild(g);
    return g;
  }
  function fly(n, z) {
    const g = ghostOf(n), a = n.getBoundingClientRect(), b = z.getBoundingClientRect();
    n.classList.add('lifted');
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const an = g.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(.9)` }], { duration: 260, easing: 'cubic-bezier(.3,.7,.4,1)' });
    return new Promise(res => { an.onfinish = () => { g.remove(); n.classList.remove('lifted'); res(); }; });
  }
  /* Like choose(), but the child can drag a piece onto dropOf(node). handler(node, e) returns true to finish. */
  function chooseDrag(nodes, dropOf, handler) {
    return new Promise(res => {
      let busy = false, over = false;
      const run = async (n, e) => {
        busy = true;
        const r = await handler(n, e);
        busy = false;
        if (r) { over = true; res(n); }
      };
      nodes.forEach(n => {
        n.style.touchAction = 'none';
        n.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !busy && !over) { e.preventDefault(); run(n, e); } });
        n.addEventListener('pointerdown', e => {
          if (busy || over || e.button > 0 || n.style.visibility === 'hidden') return;
          e.preventDefault();
          const id = e.pointerId, sx = e.clientX, sy = e.clientY;
          let g = null, zone = null;
          try { n.setPointerCapture(id); } catch (err) { /* old browsers */ }
          const move = ev => {
            if (ev.pointerId !== id) return;
            const dx = ev.clientX - sx, dy = ev.clientY - sy;
            if (!g && Math.hypot(dx, dy) > 12) { g = ghostOf(n); n.classList.add('lifted'); A.sfx('tap'); }
            if (!g) return;
            g.style.transform = `translate(${dx}px, ${dy}px) scale(1.08) rotate(${Math.max(-8, Math.min(8, dx / 30))}deg)`;
            const z = dropOf(n);
            if (zone && zone !== z) zone.classList.remove('drop-over');
            zone = z;
            if (z) z.classList.toggle('drop-over', inside(z, ev.clientX, ev.clientY));
          };
          const up = async ev => {
            if (ev.pointerId !== id) return;
            n.removeEventListener('pointermove', move); n.removeEventListener('pointerup', up); n.removeEventListener('pointercancel', up);
            if (zone) zone.classList.remove('drop-over');
            if (busy || over) { if (g) { g.remove(); n.classList.remove('lifted'); } return; }
            const z = dropOf(n);
            if (!g) {
              busy = true;
              if (z) await fly(n, z);
              run(n, ev);
              return;
            }
            if (z && ev.type === 'pointerup' && inside(z, ev.clientX, ev.clientY)) { g.remove(); n.classList.remove('lifted'); run(n, ev); return; }
            const back = g.animate([{ transform: g.style.transform }, { transform: 'translate(0,0)' }], { duration: 240, easing: 'ease-out' });
            back.onfinish = () => { g.remove(); n.classList.remove('lifted'); };
          };
          n.addEventListener('pointermove', move); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
        });
      });
    });
  }
  const MIC = '<svg class="mic-ico" viewBox="0 0 40 40" aria-hidden="true"><rect x="13" y="4" width="14" height="21" rx="7" fill="#fff" stroke="#4B3642" stroke-width="3"/><path d="M8 19 a12 12 0 0 0 24 0 M20 31 v5 M13 36 h14" fill="none" stroke="#4B3642" stroke-width="3" stroke-linecap="round"/></svg>';

  /* ---------- 0. meet: big letter card ---------- */
  P.meet = async function (host, cfg, ctx) {
    const j = cfg.j, w = D.WORDS[cfg.word || D.JPIC[j]];
    const clip = cfg.clip || (D.has.j(j) ? D.jKey(j) : jamoClip(j));
    head(host, cfg.title || '새 글자 친구', clip);
    const b = body(host, 'meet');
    const card = el('button', 'tap meet-card' + (j.length > 1 ? ' word' : ''), `<span class="meet-letter">${esc(j)}</span>${w && w.pic ? `<span class="meet-pic">${UI.picFace(w.pic)}</span>${j.length > 1 ? '' : `<span class="meet-word">${esc(w.w)}</span>`}` : ''}`);
    card.type = 'button';
    b.appendChild(card);
    const go = btn('next-btn', '다음 ▶', null, '다음');
    go.hidden = true;
    b.appendChild(go);
    const glow = () => { card.classList.remove('glow'); void card.offsetWidth; card.classList.add('glow'); };
    await sleep(250);
    if (clip) await A.play(clip, { onStart: glow });
    if (!ctx.alive()) return;
    go.hidden = false;
    UI.tap(card, () => { if (clip) A.play(clip, { onStart: glow }); });
    St.mark('j:' + j, true);
    await new Promise(res => UI.tap(go, res));
  };

  /* ---------- 1. chant: song with cells lit when each sound is heard ---------- */
  P.chant = async function (host, cfg, ctx) {
    const syl = cfg.syl.filter(s => D.has.sy(s));
    const keys = syl.map(D.syKey);
    head(host, cfg.title || '노래 톡톡', null, '반짝이는 칸을 봐!');
    const b = body(host, 'chant');
    const row = el('div', 'cells n' + syl.length);
    const cells = syl.map((s, i) => {
      const c = el('button', 'tap cell', `<span>${esc(s)}</span>`);
      c.type = 'button'; c.dataset.i = i; row.appendChild(c); return c;
    });
    b.appendChild(row);
    const light = i => { cells.forEach((c, k) => c.classList.toggle('lit', k === i)); if (cells[i]) cells[i].dataset.heard = String(A.heardNow().toFixed(3)); };
    const songBtn = btn('song-btn', '🎵 다시 부르기', null, '노래 다시');
    songBtn.hidden = true;
    b.appendChild(songBtn);
    await A.preload(keys);
    await sleep(300);
    /* phase 1: listen */
    for (let rep = 0; rep < (cfg.reps || 1); rep++) {
      await A.song(keys, light, cfg.beat || 0.66);
      if (!ctx.alive()) return;
      light(-1);
      await sleep(250);
    }
    /* phase 2: tap along */
    UI.$('.play-sub', host).textContent = '반짝이는 칸을 눌러 봐!';
    await say(ctx, 'ui4_chant');
    for (let i = 0; i < cells.length; i++) {
      if (!ctx.alive()) return;
      cells[i].classList.add('next');
      const stop = hintAfter(ctx, cells[i], 4000);
      ans('i' + i);
      let lastE = null;
      await choose(cells, async (c, e) => {
        const k = +c.dataset.i;
        lastE = e;
        if (k === i && i === cells.length - 1) return true;
        A.play(keys[k], { onStart: () => light(k) });
        return k === i;
      });
      stop();
      cells[i].classList.remove('next', 'hint');
      cells[i].classList.add('done');
      if (i === cells.length - 1) {
        await right(ctx, 'chant', lastE, cells[i], 'chant:' + syl.join(''), () => A.play(keys[i], { onStart: () => light(i) }));
      } else A.sfx('tap');
    }
    light(-1);
    /* phase 3: find the sound */
    UI.$('.play-sub', host).textContent = '어떤 칸일까?';
    cells.forEach(c => c.classList.remove('done'));
    songBtn.hidden = false;
    UI.tap(songBtn, () => A.song(keys, light, cfg.beat || 0.66).then(() => light(-1)));
    const qs = shuffle(syl.map((s, i) => i)).slice(0, Math.min(cfg.quiz || 2, syl.length));
    for (const qi of qs) {
      if (!ctx.alive()) return;
      await sleep(300);
      A.play(keys[qi]);
      let tries = 0;
      const stop = hintAfter(ctx, cells[qi], 6000);
      ans('i' + qi);
      await choose(cells, async (c, e) => {
        const k = +c.dataset.i;
        if (k === qi) {
          stop(); c.classList.remove('hint');
          light(k); await right(ctx, 'chant', e, c, 'sy:' + syl[qi]); light(-1);
          return true;
        }
        tries++;
        wrong(ctx, c, 'sy:' + syl[qi], thatClip(syl[k]));
        if (tries >= 2) cells[qi].classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 2. pop: balloons ---------- */
  P.pop = async function (host, cfg, ctx) {
    let target = null;
    const promptOf = t => (cfg.jamo ? jamoClip(t) : findClip(t));
    head(host, cfg.title || '풍선 팡!', () => target && promptOf(target), '들은 글자를 눌러 봐!');
    const b = body(host, 'pop');
    const qs = cfg.targets.slice(0, cfg.n || 4);
    await A.preload(qs.map(promptOf).concat(cfg.pool.map(cfg.jamo ? jamoClip : thatClip)));
    await say(ctx, 'ui4_balloon');
    for (const t of qs) {
      if (!ctx.alive()) return;
      target = t;
      b.innerHTML = '';
      const opts = shuffle([t].concat(shuffle(cfg.pool.filter(x => x !== t)).slice(0, (cfg.k || 3) - 1)));
      const nodes = opts.map((o, i) => {
        const n = el('button', 'tap balloon c' + ((i + qs.indexOf(t)) % 5), `<span>${esc(o)}</span><i class="string"></i>`);
        n.type = 'button'; n.dataset.v = o; n.style.animationDelay = (-i * 0.7) + 's';
        b.appendChild(n); return n;
      });
      await sleep(200);
      A.play(promptOf(t));
      let tries = 0;
      const item = (cfg.jamo ? 'j:' : 'sy:') + t;
      ans(t);
      await choose(nodes, async (n, e) => {
        if (n.dataset.v === t) {
          n.classList.add('popped'); A.sfx('pop');
          await right(ctx, 'pop', e, n, item);
          return true;
        }
        tries++;
        wrong(ctx, n, item, cfg.jamo ? jamoClip(n.dataset.v) : thatClip(n.dataset.v));
        if (tries >= 2) nodes.find(x => x.dataset.v === t).classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 3. pick: hear (or read) a word, choose the picture ---------- */
  P.pick = async function (host, cfg, ctx) {
    let cur = null;
    const read = cfg.mode === 'read';
    head(host, cfg.title || (read ? '글자를 읽어 봐' : '어떤 그림일까?'), () => cur && 'w_' + cur, read ? '이번엔 려원이가 혼자 읽어 볼까?' : '어떤 그림일까?');
    const b = body(host, 'pick' + (read ? ' read' : ''));
    const qs = cfg.words.slice(0, cfg.n || 4);
    await A.preload(qs.map(k => 'w_' + k).concat(qs.map(wordThat)));
    if (read) await say(ctx, 'ui4_echo2');
    for (const k of qs) {
      if (!ctx.alive()) return;
      cur = k;
      b.innerHTML = '';
      if (read) b.appendChild(el('div', 'word-big', esc(D.WORDS[k].w)));
      const grid = el('div', 'cards');
      const opts = shuffle([k].concat(apart(shuffle((cfg.pool || cfg.words).filter(x => x !== k && UI.emKey(D.WORDS[x].pic || '') !== UI.emKey(D.WORDS[k].pic || ''))), 2, [k])));
      const nodes = opts.map(o => { const n = el('button', 'tap card', UI.pic(o)); n.type = 'button'; n.dataset.v = o; grid.appendChild(n); return n; });
      b.appendChild(grid);
      await sleep(200);
      if (!read) { if (qs.indexOf(k) === 0) await say(ctx, 'ui_which'); A.play('w_' + k); }
      let tries = 0;
      ans(k);
      await choose(nodes, async (n, e) => {
        if (n.dataset.v === k) {
          n.classList.add('right');
          await right(ctx, read ? 'read' : 'pick', e, n, 'w:' + k, read ? () => A.play('w_' + k) : null);
          return true;
        }
        tries++;
        wrong(ctx, n, 'w:' + k, wordThat(n.dataset.v));
        if (tries >= 2) nodes.find(x => x.dataset.v === k).classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 4. clap: drum once per syllable, then count ---------- */
  P.clap = async function (host, cfg, ctx) {
    let cur = null;
    head(host, cfg.title || '박수 짝짝', () => cur && 'w_' + cur, '이제 려원이도 짝짝 쳐 볼까?');
    const b = body(host, 'clap');
    const ws = cfg.words.slice(0, cfg.n || 3);
    await A.preload(ws.map(k => 'w_' + k).concat(...ws.map(k => D.WORDS[k].syl.map(syClip))));
    for (const k of ws) {
      if (!ctx.alive()) return;
      cur = k;
      const W0 = D.WORDS[k];
      b.innerHTML = '';
      const top = el('div', 'clap-top', UI.pic(k, 'pic-l'));
      const dots = el('div', 'dots');
      const ds = W0.syl.map(s => { const d = el('span', 'dot', `<b>${esc(s)}</b>`); dots.appendChild(d); return d; });
      top.appendChild(dots);
      b.appendChild(top);
      const drum = el('button', 'tap drum', '🥁'); drum.type = 'button';
      b.appendChild(drum);
      await sleep(200);
      await A.play('w_' + k);
      if (ws.indexOf(k) === 0) await say(ctx, 'ui_clapyou');
      if (!ctx.alive()) return;
      let i = 0;
      drum.classList.add('next');
      let lastE = null, lastClip = null;
      await new Promise(res => UI.tap(drum, e => {
        if (i >= ds.length) return;
        const d = ds[i], s = W0.syl[i];
        A.drum(i === 0);
        drum.classList.remove('hit'); void drum.offsetWidth; drum.classList.add('hit');
        const clip = syClip(s);
        i++;
        if (i === ds.length) { drum.classList.remove('next'); lastE = e; lastClip = [clip, d]; res(); return; }
        if (clip) A.play(clip, { onStart: () => d.classList.add('on') }); else d.classList.add('on');
      }));
      if (!ctx.alive()) return;
      await right(ctx, 'clap', lastE, drum, 'clap:' + k, async () => {
        const [clip, d] = lastClip;
        if (clip) { if (!(await A.play(clip, { onStart: () => d.classList.add('on') }))) return false; } else d.classList.add('on');
        if (D.CLAP.has(k)) return A.play('c_' + k);
        return true;
      });
    }
    /* count quiz */
    const quiz = shuffle(cfg.pool || cfg.words).slice(0, cfg.quiz || 2);
    for (const k of quiz) {
      if (!ctx.alive()) return;
      cur = k;
      const n = D.WORDS[k].syl.length;
      b.innerHTML = '';
      b.appendChild(el('div', 'clap-top', UI.pic(k, 'pic-l') + '<p class="ask">몇 번 쳤을까?</p>'));
      const row = el('div', 'counts');
      const opts = [1, 2, 3, 4].filter(x => Math.abs(x - n) <= 2).slice(0, 3);
      if (!opts.includes(n)) opts[2] = n;
      const nodes = opts.sort().map(x => { const c = el('button', 'tap count', '●'.repeat(x)); c.type = 'button'; c.dataset.v = x; row.appendChild(c); return c; });
      b.appendChild(row);
      await sleep(200);
      await A.play('w_' + k);
      await say(ctx, 'ui_clapq');
      ans(n);
      await choose(nodes, async (c, e) => {
        if (+c.dataset.v === n) {
          c.classList.add('right');
          const seq = D.WORDS[k].syl.map(syClip).filter(Boolean);
          await right(ctx, 'clap', e, c, 'count:' + k, () => A.sequence(seq, () => A.drum(true), 0.15));
          return true;
        }
        wrong(ctx, c, 'count:' + k, 'w_' + k);
        return false;
      });
    }
  };

  /* ---------- 5. first: same first syllable ---------- */
  P.first = async function (host, cfg, ctx) {
    let cur = null;
    head(host, cfg.title || '첫소리 친구', () => cur && 'w_' + cur, '같은 소리로 시작하는 그림은?');
    const b = body(host, 'first');
    for (const [a, m, decoys] of cfg.sets.slice(0, cfg.n || 3)) {
      if (!ctx.alive()) return;
      cur = a;
      b.innerHTML = '';
      const top = el('div', 'first-top', UI.pic(a, 'pic-l') + `<span class="first-syl">${esc(D.WORDS[a].syl[0])}…</span>`);
      b.appendChild(top);
      const grid = el('div', 'cards');
      const nodes = shuffle([m].concat(decoys)).map(o => { const n = el('button', 'tap card', UI.pic(o)); n.type = 'button'; n.dataset.v = o; grid.appendChild(n); return n; });
      b.appendChild(grid);
      await A.play('w_' + a);
      if (!ctx.alive()) return;
      await A.play('ui_same');
      let tries = 0;
      ans(m);
      await choose(nodes, async (n, e) => {
        if (n.dataset.v === m) {
          n.classList.add('right');
          await right(ctx, 'first', e, n, 'first:' + a, () => A.sequence(['w_' + a, 'w_' + m], null, 0.2));
          return true;
        }
        tries++;
        wrong(ctx, n, 'first:' + a, 'w_' + n.dataset.v);
        if (tries >= 2) nodes.find(x => x.dataset.v === m).classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 6. block: consonant + vowel = syllable ---------- */
  function blockFace(t, cls) { return `<span class="blk ${cls || ''}">${esc(t)}</span>`; }
  P.block = async function (host, cfg, ctx) {
    const c = cfg.c;
    let target = null;
    head(host, cfg.title || '글자 블록', () => target && (cfg.mode === 'make' ? findClip(target) : syClip(target)),
      cfg.mode === 'make' ? '들은 글자를 만들어 봐!' : '블록을 눌러서 붙여 봐!');
    const b = body(host, 'block');
    const vs = cfg.vowels.filter(v => D.has.sy(D.join(c, v, '')));
    await A.preload(vs.map(v => D.syKey(D.join(c, v, ''))).concat(vs.map(v => thatClip(D.join(c, v, '')))));
    await say(ctx, 'ui4_block');
    if (cfg.mode !== 'make') {
      const stage = el('div', 'merge');
      const left = el('div', 'slot-c', blockFace(c, 'cons'));
      const plus = el('div', 'merge-plus', '+');
      const right_ = el('div', 'slot-v empty', '<span class="q">?</span>');
      const eq = el('div', 'merge-eq', '=');
      const res = el('div', 'slot-r empty', '<span class="q">?</span>');
      stage.append(left, plus, right_, eq, res);
      b.appendChild(stage);
      const tray = el('div', 'tray');
      b.appendChild(tray);
      const made = el('div', 'made');
      b.appendChild(made);
      for (let vi = 0; vi < vs.length; vi++) {
        const v = vs[vi];
        if (!ctx.alive()) return;
        tray.innerHTML = ''; right_.innerHTML = '<span class="q">?</span>'; right_.classList.add('empty'); res.innerHTML = '<span class="q">?</span>'; res.classList.add('empty');
        const vb = el('button', 'tap vblock', blockFace(v, 'vow')); vb.type = 'button'; vb.dataset.v = v;
        tray.appendChild(vb);
        vb.classList.add('next');
        ans(v);
        let e = null;
        await chooseDrag([vb], () => right_, (n, ev) => { e = ev; return true; });
        A.sfx('snap');
        vb.remove();
        right_.classList.remove('empty');
        right_.innerHTML = blockFace(v, 'vow in');
        const s = D.join(c, v, '');
        target = s;
        const show = () => { res.classList.remove('empty'); res.innerHTML = blockFace(s, 'syl pop-in'); made.appendChild(el('span', 'chip', esc(s))); };
        St.mark('sy:' + s, true);
        if (vi === vs.length - 1) { await right(ctx, 'block', e, res, 'block:' + c, () => A.play(D.syKey(s), { onStart: show })); return; }
        await A.play(D.syKey(s), { onStart: show });
        await sleep(200);
      }
      return;
    }
    /* make mode */
    const qs = shuffle(vs).slice(0, cfg.n || 4);
    for (const v of qs) {
      if (!ctx.alive()) return;
      const s = D.join(c, v, '');
      target = s;
      b.innerHTML = '';
      const stage = el('div', 'merge');
      const left = el('div', 'slot-c', blockFace(c, 'cons'));
      const plus = el('div', 'merge-plus', '+');
      const slot = el('div', 'slot-v empty', '<span class="q">?</span>');
      stage.append(left, plus, slot);
      b.appendChild(stage);
      const tray = el('div', 'tray');
      const opts = shuffle([v].concat(shuffle(vs.filter(x => x !== v)).slice(0, 2)));
      const nodes = opts.map(o => { const n = el('button', 'tap vblock', blockFace(o, 'vow')); n.type = 'button'; n.dataset.v = o; tray.appendChild(n); return n; });
      b.appendChild(tray);
      await sleep(200);
      A.play(findClip(s));
      let tries = 0;
      ans(v);
      await chooseDrag(nodes, () => slot, async (n, e) => {
        if (n.dataset.v === v) {
          A.sfx('snap');
          slot.classList.remove('empty');
          slot.innerHTML = blockFace(v, 'vow in');
          n.style.visibility = 'hidden';
          left.innerHTML = blockFace(s, 'syl pop-in'); plus.textContent = ''; slot.innerHTML = '';
          await right(ctx, 'block', e, left, 'sy:' + s, () => A.play(D.syKey(s)));
          return true;
        }
        tries++;
        wrong(ctx, n, 'sy:' + s, thatClip(D.join(c, n.dataset.v, '')));
        if (tries >= 2) nodes.find(x => x.dataset.v === v).classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 7. trace ---------- */
  P.trace = async function (host, cfg, ctx) {
    let cur = null;
    const clipOf = ch => (D.STROKES[ch] ? (jamoClip(ch) || null) : syClip(ch));
    const h = head(host, cfg.title || '따라 쓰기', () => cur && clipOf(cur), '분홍 점을 따라 손가락으로 써 볼까?');
    const b = body(host, 'trace');
    const area = el('div', 'write-area');
    const side = el('div', 'write-side');
    const eraser = btn('eraser', '🧽<span>지우기</span>', null, '지우기');
    const prog = el('div', 'write-prog');
    side.append(prog, eraser);
    b.append(area, side);
    const list = cfg.chars.filter(ch => D.strokesFor(ch));
    /* look: each letter twice — first over the guide, then from memory with the guide hidden */
    const rounds = list.flatMap(ch => (cfg.look ? [[ch, false], [ch, true]] : [[ch, false]]));
    prog.innerHTML = rounds.map(() => '<i></i>').join('');
    let lastErr = 0;
    const onStrokeError = kind => {
      if (performance.now() - lastErr < 2500) return;
      lastErr = performance.now();
      A.play(kind === 'order' ? 'p_order' : 'p_dir');
    };
    for (let i = 0; i < rounds.length; i++) {
      if (!ctx.alive()) return;
      const [ch, hid] = rounds[i];
      cur = ch;
      h.h.querySelector('.play-title').textContent = hid ? ch + ' 혼자 써 볼까?' : ch + ' 써 볼까?';
      area.innerHTML = '';
      if (hid) {
        /* show the letter once more, then hide it */
        const peek = el('div', 'peek', esc(ch));
        area.appendChild(peek);
        await sleep(1800);
        if (!ctx.alive()) return;
        peek.classList.add('gone');
        await sleep(350);
        area.innerHTML = '';
      }
      const bd = W.board(area, ch, { faint: cfg.faint, hidden: hid, strokes: St.s.settings.strokes || 'soft', onStrokeError });
      G.__board = bd;
      eraser.onpointerdown = e => { e.preventDefault(); A.sfx('whoosh'); bd.clear(); };
      const c = clipOf(ch);
      /* not awaited: a quick child may finish before the instruction ends */
      A.sequence((!hid && i === 0 ? ['ui_trace'] : []).concat(c ? [c] : []), null, 0.25);
      const r = await Promise.race([bd.done, ctx.aborted]);
      if (!r || !ctx.alive()) { bd.destroy(); return; }
      prog.children[i].classList.add('on');
      const er = r.stats && r.stats.errors ? r.stats.errors.order + r.stats.errors.dir : 0;
      if (er) St.mark('stroke:' + ch, false);
      await right(ctx, 'trace', null, bd.wrap, 'write:' + ch, c ? () => A.play(c) : null);
      await sleep(hid ? 700 : 250);
      bd.destroy();
    }
  };

  /* ---------- 8. train: put syllable cars in order ---------- */
  P.train = async function (host, cfg, ctx) {
    let cur = null;
    head(host, cfg.title || '낱말 기차', () => cur && 'w_' + cur, '기차 칸을 눌러 봐. 무슨 소리가 날까?');
    const b = body(host, 'train');
    const ws = cfg.words.slice(0, cfg.n || 3);
    await A.preload(ws.map(k => 'w_' + k).concat(...ws.map(k => D.WORDS[k].syl.map(syClip))));
    await say(ctx, 'ui_train');
    for (const k of ws) {
      if (!ctx.alive()) return;
      cur = k;
      const W0 = D.WORDS[k];
      b.innerHTML = '';
      b.appendChild(el('div', 'train-pic', UI.pic(k, 'pic-l')));
      const track = el('div', 'track');
      track.appendChild(el('span', 'loco', '🚂'));
      const slots = W0.syl.map(() => { const s = el('span', 'car empty', ''); track.appendChild(s); return s; });
      b.appendChild(track);
      const extra = pick(D.SY.split('').filter(x => !W0.syl.includes(x) && ['가', '나', '다', '마', '바', '사', '아', '자', '하', '고', '누', '리', '미', '보', '오', '이'].includes(x)));
      const cars = shuffle(W0.syl.concat(W0.syl.length < 3 ? [extra] : []));
      const tray = el('div', 'tray');
      const nodes = cars.map(s => { const n = el('button', 'tap carbtn', esc(s)); n.type = 'button'; n.dataset.v = s; tray.appendChild(n); return n; });
      b.appendChild(tray);
      await sleep(200);
      await A.play('w_' + k);
      let i = 0;
      ans(W0.syl[0]);
      await chooseDrag(nodes, () => slots[i] || slots[slots.length - 1], async (n, e) => {
        const need = W0.syl[i];
        if (n.dataset.v === need) {
          n.style.visibility = 'hidden';
          const slot = slots[i];
          const clip = syClip(need);
          A.sfx('snap');
          if (i === W0.syl.length - 1) { /* last car: the word clip below lights the whole train */ }
          else if (clip) A.play(clip, { onStart: () => { slot.textContent = need; slot.classList.remove('empty'); slot.classList.add('lit'); } });
          else { slot.textContent = need; slot.classList.remove('empty'); }
          i++;
          ans(W0.syl[i]);
          if (i === W0.syl.length) {
            slot.textContent = need; slot.classList.remove('empty');
            track.classList.add('go');
            await right(ctx, 'train', e, track, 'w:' + k, () => A.play('w_' + k, { onStart: () => slots.forEach(s => s.classList.add('lit')) }));
            return true;
          }
          return false;
        }
        wrong(ctx, n, 'w:' + k, syClip(n.dataset.v));
        return false;
      });
    }
  };

  /* ---------- 9. memory: picture ↔ word ---------- */
  P.memory = async function (host, cfg, ctx) {
    head(host, cfg.title || '짝 카드', null, '카드를 뒤집어서 짝꿍을 찾아볼까?');
    const b = body(host, 'memory');
    const ws = apart(cfg.words, cfg.pairs || 3);
    await A.preload(ws.map(k => 'w_' + k));
    await say(ctx, 'ui4_memory');
    if (!ctx.alive()) return;
    const cards = shuffle(ws.flatMap(k => [{ k, t: 'p' }, { k, t: 'w' }]));
    const grid = el('div', 'mem n' + cards.length);
    const nodes = cards.map(c => {
      const n = el('button', 'tap mcard', `<span class="back">?</span><span class="face">${c.t === 'p' ? UI.pic(c.k) : `<span class="mword">${esc(D.WORDS[c.k].w)}</span>`}</span>`);
      n.type = 'button'; n.dataset.k = c.k; grid.appendChild(n); return n;
    });
    b.appendChild(grid);
    /* square cards that always fit the board (short Safari screens included) */
    const fit = () => {
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length || 3, rows = Math.ceil(cards.length / cols);
      const r = b.getBoundingClientRect(), cs = getComputedStyle(b), gap = parseFloat(getComputedStyle(grid).rowGap) || 10;
      const h = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 4, w = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const side = Math.max(40, Math.min((h - gap * (rows - 1)) / rows, (w * 0.96 - gap * (cols - 1)) / cols));
      grid.style.width = (side * cols + gap * (cols - 1)) + 'px';
    };
    fit();
    addEventListener('resize', fit);
    let open = null, found = 0;
    await choose(nodes, async (n, e) => {
      if (n.classList.contains('open')) return false;
      n.classList.add('open'); A.sfx('tap');
      if (!open) { open = n; return false; }
      const a = open; open = null;
      if (a.dataset.k === n.dataset.k) {
        a.classList.add('matched'); n.classList.add('matched');
        found++;
        const k = n.dataset.k;
        await right(ctx, 'memory', e, n, 'w:' + k, () => A.play('w_' + k));
        return found === ws.length;
      }
      await sleep(700);
      a.classList.remove('open'); n.classList.remove('open');
      return false;
    });
  };

  /* ---------- 10. batchim: body + coda ---------- */
  P.batchim = async function (host, cfg, ctx) {
    let target = null;
    head(host, cfg.title || '받침 블록', () => target && syClip(target), cfg.mode === 'make' ? '어떤 받침을 붙일까?' : '받침을 붙여 봐!');
    const b = body(host, 'block bat');
    const items = cfg.items.filter(([body0, bb]) => { const s = D.split(body0); return D.has.sy(D.join(s.cho, s.jung, bb)); });
    await A.preload(items.map(([bd, bb]) => { const s = D.split(bd); return D.syKey(D.join(s.cho, s.jung, bb)); }).concat(items.map(([bd]) => syClip(bd))));
    await say(ctx, 'ui4_block');
    for (const [bd, bb] of items.slice(0, cfg.n || 4)) {
      if (!ctx.alive()) return;
      const s0 = D.split(bd), s = D.join(s0.cho, s0.jung, bb);
      target = s;
      b.innerHTML = '';
      const stage = el('div', 'merge vert');
      const top = el('div', 'slot-c', blockFace(bd, 'cons'));
      const slot = el('div', 'slot-v empty', '<span class="q">?</span>');
      stage.append(top, el('div', 'merge-plus', '+'), slot);
      b.appendChild(stage);
      const tray = el('div', 'tray');
      let opts;
      if (cfg.mode === 'make') {
        const others = cfg.codas.filter(x => x !== bb && D.has.sy(D.join(s0.cho, s0.jung, x)));
        opts = shuffle([bb].concat(shuffle(others).slice(0, 2)));
      } else opts = [bb];
      const nodes = opts.map(o => { const n = el('button', 'tap vblock', blockFace(o, 'coda')); n.type = 'button'; n.dataset.v = o; tray.appendChild(n); return n; });
      b.appendChild(tray);
      await sleep(200);
      if (cfg.mode === 'make') A.play(D.syKey(s)); else { if (syClip(bd)) await A.play(syClip(bd)); nodes[0].classList.add('next'); }
      let tries = 0;
      ans(bb);
      await chooseDrag(nodes, () => slot, async (n, e) => {
        if (n.dataset.v === bb) {
          A.sfx('snap');
          n.style.visibility = 'hidden';
          slot.innerHTML = ''; slot.classList.remove('empty');
          top.innerHTML = blockFace(s, 'syl pop-in');
          await right(ctx, 'batchim', e, top, 'sy:' + s, () => A.play(D.syKey(s)));
          return true;
        }
        tries++;
        wrong(ctx, n, 'sy:' + s, syClip(D.join(s0.cho, s0.jung, n.dataset.v)));
        if (tries >= 2) nodes.find(x => x.dataset.v === bb).classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 11. story: words light as they are read; choose the picture ---------- */
  P.story = async function (host, cfg, ctx) {
    let replay = null;
    head(host, cfg.title || '이야기 읽기', () => { if (replay) replay(); return null; }, cfg.alone ? '이번엔 려원이가 혼자 읽어 볼까?' : '같이 해 보자!');
    const b = body(host, 'story');
    await say(ctx, cfg.alone ? 'ui4_echo2' : 'ui_together');
    for (const it of cfg.items.slice(0, cfg.n || 3)) {
      if (!ctx.alive()) return;
      b.innerHTML = '';
      const line = el('div', 'story-line');
      let wordsEls, clips, onEach;
      if (it.clip) {
        wordsEls = [el('span', 'sw', esc(it.text))];
        clips = [it.clip];
      } else {
        wordsEls = it.words.map(k => el('span', 'sw', esc(D.WORDS[k].w)));
        clips = it.words.map(k => 'w_' + k);
      }
      wordsEls.forEach(w => line.appendChild(w));
      b.appendChild(line);
      onEach = i => wordsEls.forEach((w, k) => w.classList.toggle('lit', k === i));
      replay = () => A.sequence(clips, onEach, 0.18).then(() => onEach(-1));
      const pics = it.clip ? it.pics : it.words;
      const decoyPool = cfg.decoys.filter(d => d.join() !== pics.join() && !d.some(x => pics.some(y => x !== y && D.clash(x, y))));
      const opts = shuffle([pics].concat(shuffle(decoyPool).slice(0, 2)));
      const grid = el('div', 'cards wide');
      const nodes = opts.map(o => { const n = el('button', 'tap card pair', o.map(k => UI.pic(k)).join('')); n.type = 'button'; n.dataset.v = o.join(); grid.appendChild(n); return n; });
      b.appendChild(grid);
      await A.preload(clips);
      await sleep(250);
      if (!cfg.alone) await replay();
      if (!ctx.alive()) return;
      let tries = 0;
      ans(pics.join());
      await choose(nodes, async (n, e) => {
        if (n.dataset.v === pics.join()) {
          n.classList.add('right');
          await right(ctx, cfg.alone ? 'read' : 'story', e, n, 'story:' + pics.join(), cfg.alone ? replay : null);
          return true;
        }
        tries++;
        wrong(ctx, n, 'story:' + pics.join(), null);
        if (tries === 1 && cfg.alone) replay();
        if (tries >= 2) nodes.find(x => x.dataset.v === pics.join()).classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 12. fish: catch the fish carrying the letter you heard ---------- */
  P.fish = async function (host, cfg, ctx) {
    let target = null;
    const promptOf = t => (cfg.jamo ? jamoClip(t) : (findClip(t) || sayKey(t)));
    const thatOf = t => (cfg.jamo ? jamoClip(t) : (D.has.dy(t) ? D.dyKey(t) : sayKey(t)));
    head(host, cfg.title || '글자 낚시', () => target && promptOf(target), '들은 글자를 눌러 봐!');
    const b = body(host, 'fish');
    const qs = cfg.targets.slice(0, cfg.n || 4);
    await A.preload(qs.map(promptOf));
    await say(ctx, 'p_fish');
    const bucket = el('div', 'bucket');
    for (const t of qs) {
      if (!ctx.alive()) return;
      target = t;
      b.innerHTML = '';
      const pond = el('div', 'pond');
      const opts = shuffle([t].concat(shuffle(cfg.pool.filter(x => x !== t)).slice(0, (cfg.k || 3) - 1)));
      const nodes = opts.map((o, i) => {
        const lane = el('div', 'lane');
        const f = el('button', 'tap fishy c' + ((i + qs.indexOf(t)) % 5),
          `<svg viewBox="0 0 130 80" aria-hidden="true"><path d="M100 40 L128 14 L124 40 L128 66Z" class="tail"/><ellipse cx="58" cy="40" rx="54" ry="34" class="bd"/><circle cx="22" cy="32" r="6" fill="#4B3642"/><circle cx="20" cy="30" r="2" fill="#fff"/><path d="M12 48 q6 5 12 0" fill="none" stroke="#4B3642" stroke-width="3" stroke-linecap="round"/></svg><span>${esc(o)}</span>`);
        f.type = 'button'; f.dataset.v = o;
        f.style.animationDuration = (7 + i * 1.7 + Math.random() * 2) + 's';
        f.style.animationDelay = (-Math.random() * 6) + 's';
        lane.appendChild(f); pond.appendChild(lane);
        return f;
      });
      b.append(pond, bucket);
      const fitSwim = () => nodes.forEach(f => { const lw = f.parentElement.getBoundingClientRect().width, fw = f.getBoundingClientRect().width; f.style.setProperty('--d', Math.max(0, lw - fw - 8) + 'px'); });
      fitSwim();
      await sleep(250);
      A.play(promptOf(t));
      let tries = 0;
      const item = (cfg.jamo ? 'j:' : 'sy:') + t;
      ans(t);
      await choose(nodes, async (n, e) => {
        if (n.dataset.v === t) {
          n.classList.add('caught'); A.sfx('pop');
          bucket.appendChild(el('span', 'chip', esc(t)));
          await right(ctx, 'pop', e, n, item);
          return true;
        }
        tries++;
        wrong(ctx, n, item, thatOf(n.dataset.v));
        if (tries >= 2) nodes.find(x => x.dataset.v === t).classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 13. shop: a friend wants something — hand over its name tag (reading) ---------- */
  P.shop = async function (host, cfg, ctx) {
    let cur = null;
    head(host, cfg.title || '글자 가게', () => cur && 'w_' + cur, '낱말 카드를 그림에 데려다 줄래?');
    const b = body(host, 'shop');
    const qs = cfg.words.slice(0, cfg.n || 3);
    await A.preload(qs.map(k => 'w_' + k));
    await say(ctx, 'p_shop');
    const pals = UI.friendsOwned();
    for (const k of qs) {
      if (!ctx.alive()) return;
      cur = k;
      b.innerHTML = '';
      const pal = pick(pals).id;
      const cust = el('div', 'customer', `<div class="cust-pal">${UI.mascot('happy', {}, pal)}</div><div class="cust-bubble">${UI.pic(k)}<b>주세요!</b></div>`);
      const shelf = el('div', 'shelf');
      const pool = (cfg.pool || cfg.words).filter(x => x !== k && D.WORDS[x].w !== D.WORDS[k].w && !D.clash(x, k));
      const opts = shuffle([k].concat(shuffle(pool).slice(0, 2)));
      const nodes = opts.map(o => { const n = el('button', 'tap tag', `<span>${esc(D.WORDS[o].w)}</span>`); n.type = 'button'; n.dataset.v = o; shelf.appendChild(n); return n; });
      b.append(cust, shelf);
      await sleep(200);
      A.play('w_' + k);
      let tries = 0;
      ans(k);
      await chooseDrag(nodes, () => cust, async (n, e) => {
        if (n.dataset.v === k) {
          n.style.visibility = 'hidden';
          cust.classList.add('happy');
          cust.querySelector('.cust-pal').innerHTML = UI.mascot('joy', {}, pal);
          await right(ctx, 'read', e, cust, 'w:' + k, () => A.play('w_' + k));
          return true;
        }
        tries++;
        wrong(ctx, n, 'w:' + k, wordThat(n.dataset.v));
        if (tries >= 2) nodes.find(x => x.dataset.v === k).classList.add('hint');
        return false;
      });
    }
  };

  /* ---------- 14. hide: find every copy of a letter hidden in a busy picture ---------- */
  const HIDE_DECOR = ['🌸', '🍄', '⭐', '🦋', '🌳', '🎈', '🐤', '🍓'];
  P.hide = async function (host, cfg, ctx) {
    const t = cfg.target, count = cfg.count || 3;
    const clipOf = x => (cfg.jamo ? jamoClip(x) : sayKey(x));
    head(host, cfg.title || '숨은 글자 찾기', clipOf(t), '어디 있을까?');
    const b = body(host, 'hide');
    await say(ctx, 'p_hide');
    if (!ctx.alive()) return;
    const bar = el('div', 'hide-bar', `<span class="hide-t">${esc(t)}</span><span class="hide-n">${'<i></i>'.repeat(count)}</span>`);
    const field = el('div', 'hide-field');
    b.append(bar, field);
    await sleep(30);
    const r = field.getBoundingClientRect();
    const wide = r.width >= r.height;
    const cols = wide ? 6 : 4, rows = wide ? 3 : 5, cells = shuffle(Array.from({ length: cols * rows }, (_, i) => i));
    const decoys = cfg.decoys.filter(x => x !== t);
    const nDecor = 3, nDecoy = cols * rows - count - nDecor;
    const list = Array(count).fill(t).map(x => ({ x, t: true }))
      .concat(Array.from({ length: nDecoy }, (_, i) => ({ x: decoys[i % decoys.length] })))
      .concat(shuffle(HIDE_DECOR).slice(0, nDecor).map(x => ({ x, deco: true })));
    const COL = ['#E8789A', '#5FBE9E', '#74B4E2', '#9F8BE0', '#F29E70', '#E9B648'];
    const nodes = [];
    list.forEach((it, i) => {
      const c = cells[i], cx = (c % cols + 0.5) / cols, cy = (Math.floor(c / cols) + 0.5) / rows;
      const n = el('button', 'tap hid' + (it.deco ? ' deco' : ''), it.deco ? UI.em(it.x) : esc(it.x));
      n.type = 'button';
      if (!it.deco) n.dataset.v = it.x;
      n.style.left = (cx + (Math.random() - 0.5) * 0.35 / cols) * 100 + '%';
      n.style.top = (cy + (Math.random() - 0.5) * 0.3 / rows) * 100 + '%';
      n.style.setProperty('--rot', (Math.random() * 50 - 25).toFixed(0) + 'deg');
      n.style.color = COL[i % COL.length];
      n.style.fontSize = (wide ? 10 : 9) + Math.random() * 3 + 'vmin';
      field.appendChild(n);
      nodes.push(n);
    });
    A.play(clipOf(t));
    let found = 0, miss = 0;
    ans(t);
    await choose(nodes, async (n, e) => {
      if (n.classList.contains('deco')) { n.classList.remove('wiggle'); void n.offsetWidth; n.classList.add('wiggle'); A.sfx('pop'); return false; }
      if (n.classList.contains('found')) return false;
      if (n.dataset.v === t) {
        n.classList.add('found'); delete n.dataset.v; n.dataset.f = t;
        bar.querySelectorAll('.hide-n i')[found].classList.add('on');
        found++; miss = 0;
        if (found >= count) { await right(ctx, 'pop', e, n, (cfg.jamo ? 'j:' : 'sy:') + t, () => A.play(clipOf(t))); return true; }
        A.sfx('correct');
        St.mark((cfg.jamo ? 'j:' : 'sy:') + t, true);
        return false;
      }
      miss++;
      wrong(ctx, n, (cfg.jamo ? 'j:' : 'sy:') + t, clipOf(n.dataset.v));
      if (miss >= 2) { const nx = nodes.find(x => x.dataset.v === t); if (nx) nx.classList.add('hint'); }
      return false;
    });
  };

  /* ---------- 15. speak: "내가 읽어 볼게" — read aloud, hear yourself, hear the answer, say if it matched ---------- */
  P.speak = async function (host, cfg, ctx) {
    const items = cfg.items.slice(0, cfg.n || 2);
    let cur = null;
    const playAnswer = (it, textEl) => {
      if (it.keys) {
        const ws = Array.from(textEl.querySelectorAll('.sw'));
        return A.sequence(it.keys, i => ws.forEach((w, k) => w.classList.toggle('lit', k === i)), 0.18).then(() => ws.forEach(w => w.classList.remove('lit')));
      }
      return A.play(it.clip, { onStart: () => textEl.classList.add('lit') }).then(() => textEl.classList.remove('lit'));
    };
    const h = head(host, cfg.title || (cfg.novel ? '처음 보는 글자' : '내가 읽어 볼게'), () => { if (cur) playAnswer(cur, UI.$('.speak-text', host)); return null; },
      '이번엔 려원이가 혼자 읽어 볼까?');
    if (h.say) h.say.dataset.role = 'answer';
    const b = body(host, 'speak');
    let useMic = St.s.settings.mic !== false && !!G.Rec && G.Rec.micOk();
    await say(ctx, 'p_speak');
    try {
      for (const it of items) {
        if (!ctx.alive()) return;
        cur = it;
        b.innerHTML = '';
        const text = el('div', 'speak-text' + (it.text.length > 3 ? ' long' : ''),
          it.keys ? it.text.split(' ').map(w => `<span class="sw">${esc(w)}</span>`).join(' ') : esc(it.text));
        if (it.pic) text.insertAdjacentHTML('afterbegin', UI.pic(it.pic, 'speak-pic'));
        b.appendChild(text);
        const row = el('div', 'speak-row');
        b.appendChild(row);
        let tries = 0, ok = false;
        while (!ok && ctx.alive()) {
          row.innerHTML = '';
          let mine = null;
          if (useMic) {
            const mic = el('button', 'tap mic-btn', MIC + '<span>말하기</span>');
            mic.type = 'button'; mic.dataset.v = 'rec';
            row.appendChild(mic);
            ans('rec');
            await new Promise(r => UI.tap(mic, r));
            if (!ctx.alive()) return;
            try {
              mic.classList.add('rec');
              mic.querySelector('span').textContent = '다 했으면 눌러!';
              const meter = el('i', 'meter');
              mic.appendChild(meter);
              const rec = await G.Rec.record({ maxMs: it.text.length > 4 ? 6000 : 3500, onLevel: v => { meter.style.transform = `scale(${1 + v * 0.6})`; } });
              UI.tap(mic, () => rec.stop());
              const blob = await rec.done;
              G.Rec.close();
              mine = await A.decode(await blob.arrayBuffer());
            } catch (err) {
              useMic = false;
              continue;
            }
            mic.remove();
            if (!ctx.alive()) return;
            const me = el('div', 'speak-me on', MIC + '<span>려원이 목소리</span>');
            row.appendChild(me);
            await A.playBuffer(mine);
            me.classList.remove('on');
            await sleep(250);
          } else {
            const lis = el('button', 'tap mic-btn listen', '🔊<span>다 읽었어!</span>');
            lis.type = 'button'; lis.dataset.v = 'rec';
            row.appendChild(lis);
            ans('rec');
            await new Promise(r => UI.tap(lis, r));
            lis.remove();
          }
          if (!ctx.alive()) return;
          await playAnswer(it, text);
          if (!ctx.alive()) return;
          row.innerHTML = '';
          const yes = el('button', 'tap same-btn yes', '💖<span>똑같아!</span>'); yes.type = 'button'; yes.dataset.v = 'same';
          const again = el('button', 'tap same-btn again', '🔁<span>다시</span>'); again.type = 'button';
          row.append(yes, again);
          ans('same');
          const v = await new Promise(r => { UI.tap(yes, e => r(e)); UI.tap(again, () => r(null)); });
          tries++;
          St.s.learn.says = (St.s.learn.says || 0) + 1;
          if (cfg.novel) St.novel(it.item, !!v);
          if (v || tries >= 2) {
            ok = true;
            await right(ctx, 'read', v || null, text, it.item, null);
          }
        }
      }
    } finally {
      if (G.Rec && useMic) G.Rec.close();
    }
  };

  /* ---------- 16. twin: plain vs twin consonant (가 → 까) ---------- */
  P.twin = async function (host, cfg, ctx) {
    head(host, cfg.title || '쌍둥이 소리', null, '잘 듣고 골라 봐.');
    const b = body(host, 'twin');
    const pairs = cfg.pairs;
    await A.preload(pairs.flat().map(sayKey));
    await say(ctx, 'p_twin');
    const glow = c => { c.classList.remove('glow'); void c.offsetWidth; c.classList.add('glow'); };
    for (const [a, t] of pairs.slice(0, 2)) {
      if (!ctx.alive()) return;
      b.innerHTML = '';
      const row = el('div', 'twin-row');
      const ca = el('button', 'tap twin-card soft', esc(a)), ct = el('button', 'tap twin-card strong', esc(t));
      ca.type = ct.type = 'button';
      row.append(ca, el('span', 'twin-vs', '→'), ct);
      b.appendChild(row);
      await sleep(200);
      await A.play(sayKey(a), { onStart: () => glow(ca) });
      await sleep(250);
      await A.play(sayKey(t), { onStart: () => glow(ct) });
      if (!ctx.alive()) return;
      UI.tap(ca, () => A.play(sayKey(a), { onStart: () => glow(ca) }));
      ct.dataset.v = t; ct.classList.add('next'); ans(t);
      const e = await new Promise(r => UI.tap(ct, r));
      ct.classList.remove('next');
      await right(ctx, 'pop', e, ct, 'sy:' + t, () => A.play(sayKey(t), { onStart: () => glow(ct) }));
    }
    const qs = shuffle(pairs.flatMap(p => [[p, 0], [p, 1]])).slice(0, cfg.n || 3);
    for (const [p, i] of qs) {
      if (!ctx.alive()) return;
      b.innerHTML = '';
      const row = el('div', 'twin-row');
      const nodes = shuffle(p).map(x => { const n = el('button', 'tap twin-card', esc(x)); n.type = 'button'; n.dataset.v = x; row.appendChild(n); return n; });
      b.appendChild(row);
      const want = p[i];
      ans(want);
      await sleep(250);
      A.play(sayKey(want));
      await choose(nodes, async (n, e) => {
        if (n.dataset.v === want) { n.classList.add('right'); await right(ctx, 'pop', e, n, 'sy:' + want, () => A.play(sayKey(want))); return true; }
        wrong(ctx, n, 'sy:' + want, sayKey(n.dataset.v));
        return false;
      });
    }
  };

  /* ---------- 17. vmerge: ㅗ + ㅏ = ㅘ, then ㄱ + ㅘ = 과 ---------- */
  P.vmerge = async function (host, cfg, ctx) {
    const cv = cfg.v, [h0, v0] = D.COMPLEX[cv];
    let target = cv;
    head(host, cfg.title || '모음 미끄럼', () => (target === cv ? jamoClip(cv) : sayKey(target)), '블록을 합쳐서 만들어 볼까?');
    const b = body(host, 'block');
    await say(ctx, 'p_cvow');
    const steps = [[h0, v0, cv, 'vow', jamoClip(cv)]].concat((cfg.cons || []).map(c => [c, cv, D.join(c, cv, ''), 'cons', null]));
    for (const [left0, piece, made, kind, clip0] of steps) {
      if (!ctx.alive()) return;
      target = made;
      const clip = clip0 || sayKey(made);
      b.innerHTML = '';
      const stage = el('div', 'merge');
      const left = el('div', 'slot-c', blockFace(left0, kind === 'vow' ? 'vow' : 'cons'));
      const slot = el('div', 'slot-v empty', '<span class="q">?</span>');
      const res = el('div', 'slot-r empty', '<span class="q">?</span>');
      stage.append(left, el('div', 'merge-plus', '+'), slot, el('div', 'merge-eq', '='), res);
      b.appendChild(stage);
      const tray = el('div', 'tray');
      const pb = el('button', 'tap vblock next', blockFace(piece, 'vow')); pb.type = 'button'; pb.dataset.v = piece;
      tray.appendChild(pb);
      b.appendChild(tray);
      ans(piece);
      let e = null;
      await chooseDrag([pb], () => slot, (n, ev) => { e = ev; return true; });
      A.sfx('snap');
      pb.remove();
      slot.classList.remove('empty'); slot.innerHTML = blockFace(piece, 'vow in');
      await right(ctx, 'block', e, res, kind === 'vow' ? 'j:' + cv : 'sy:' + made, () => A.play(clip, { onStart: () => { res.classList.remove('empty'); res.innerHTML = blockFace(made, 'syl pop-in'); } }));
      await sleep(200);
    }
  };

  /* ---------- planner ---------- */
  function learnedAt(id) {
    const L = { v: new Set(), c: new Set(['ㅇ']), b: new Set() };
    D.STAGES.forEach(s => {
      if (s.id > id) return;
      if (s.v) L.v.add(s.v);
      if (s.k === 'cons1' || s.k === 'twin') L.c.add(s.c);
      if (s.k === 'bat1') L.b.add(s.b);
      if (s.k === 'cvow') { L.v.add(s.v); if (s.v === 'ㅟ') L.v.add('ㅚ'); }
    });
    if (id > 15) D.BASIC_V.forEach(v => L.v.add(v));
    return L;
  }
  function readable(w, L) {
    return Array.from(w).every(ch => { const s = D.split(ch); return s && L.c.has(s.cho) && L.v.has(s.jung) && (!s.jong || L.b.has(s.jong)); });
  }
  const pics = () => Object.values(D.WORDS).filter(w => w.pic);
  const allSy = w => w.syl.every(s => D.has.sy(s));
  function wordsFor(L, f) { return pics().filter(w => readable(w.w, L) && (!f || f(w))).map(w => w.key); }
  function firstSets(n) {
    const by = {};
    pics().forEach(w => { (by[w.syl[0]] = by[w.syl[0]] || []).push(w.key); });
    const groups = Object.values(by).filter(g => g.length >= 2);
    const all = pics().map(w => w.key);
    return shuffle(groups).slice(0, n).map(g => {
      const [a, m] = shuffle(g);
      const s0 = D.WORDS[a].syl[0];
      const decoys = apart(shuffle(all.filter(k => D.WORDS[k].syl[0] !== s0)), 2, [a, m]);
      return [a, m, decoys];
    });
  }
  const vRow = (c, vs) => vs.map(v => D.join(c, v, '')).filter(s => D.has.sy(s));
  function weakSy(f) { return St.weak(k => k.startsWith('sy:') && (!f || f(k.slice(3))), 3).map(k => k.slice(3)); }

  /* Letters made from what the child knows but has never been asked about: reading by the code, not by memory. */
  function novelSy(L, n, f) {
    const items = St.s.learn.items;
    const vs = Array.from(L.v).filter(v => !D.COMPLEX[v]);
    const all = Array.from(L.c).flatMap(c => vs.map(v => D.join(c, v, ''))).filter(x => x && D.has.sy(x) && (!f || f(x)));
    const fresh = all.filter(x => !items['sy:' + x] && !items['say:' + x]);
    return shuffle(fresh.length >= n ? fresh : all).slice(0, n);
  }
  const sayItem = x => ({ text: x, clip: sayKey(x), item: 'say:' + x });
  const sayWord = k => ({ text: D.WORDS[k].w, clip: 'w_' + k, item: 'sayw:' + k });
  const sayPhrase = ws => ({ text: ws.map(k => D.WORDS[k].w).join(' '), keys: ws.map(k => 'w_' + k), item: 'sayp:' + ws.join('+') });
  const learnedJamo = L => Array.from(L.c).concat(Array.from(L.v));
  const Plan = {};
  Plan.learnedAt = learnedAt;
  Plan.readable = readable;
  Plan.make = function (stage) {
    const L = learnedAt(stage.id);
    const out = [];
    const listenWords = n => shuffle(pics().map(w => w.key)).slice(0, n);
    switch (stage.k) {
      case 'review': {
        /* Endless review from what is already learned; weak items first. */
        const L2 = learnedAt(Math.max(1, St.s.learn.stage - 1));
        const cs = Array.from(L2.c).filter(c => c !== 'ㅇ');
        const vs = Array.from(L2.v).filter(v => D.BASIC_V.includes(v));
        const pool = (cs.length ? cs : ['ㅇ']).flatMap(c => vRow(c, vs.length ? vs : ['ㅏ']));
        const weak = weakSy(x => pool.includes(x));
        if (pool.length >= 3) out.push({ t: 'pop', cfg: { targets: weak.concat(shuffle(pool)).slice(0, 5), pool, n: 5, k: 3, title: '복습 풍선' } });
        else out.push({ t: 'pop', cfg: { jamo: true, targets: shuffle(vs.length ? vs : ['ㅏ', 'ㅣ']).slice(0, 4), pool: D.BASIC_V, k: 3 } });
        const ws = wordsFor(L2);
        if (ws.length >= 3) { out.push({ t: 'memory', cfg: { words: shuffle(ws), pairs: 3 } }); out.push({ t: 'pick', cfg: { mode: 'read', words: shuffle(ws), pool: ws, n: 4 } }); }
        else { out.push({ t: 'pick', cfg: { words: listenWords(4), n: 4 } }); out.push({ t: 'clap', cfg: { words: shuffle(['nabi', 'banana', 'kokkiri', 'appa', 'ori', 'goguma']).slice(0, 2), n: 2, quiz: 1 } }); }
        const wr = St.weak(k => k.startsWith('write:'), 2).map(k => k.slice(6));
        const tr = wr.concat(shuffle(pool.length ? pool : vs)).filter(ch => D.strokesFor(ch)).slice(0, 2);
        out.push({ t: 'trace', cfg: { chars: tr.length ? tr : ['ㅏ'], faint: true } });
        if (pool.length >= 3) out.splice(1, 0, { t: 'fish', cfg: { targets: shuffle(pool).slice(0, 3), pool, n: 3, k: 3 } });
        const nv = novelSy(L2, 2);
        if (nv.length) out.push({ t: 'speak', cfg: { items: nv.map(sayItem), novel: true, n: 2 } });
        break;
      }
      case 'name': {
        /* Own name first (NELP 2008; Bloodgood 1999): read it as a whole word, build it, write it. */
        const fam = ['eomma', 'appa', 'agi', 'nuna', 'halmeoni', 'harabeoji'];
        out.push({ t: 'meet', cfg: { j: '려원', word: 'ryeowon', clip: 'w_ryeowon', title: '내 이름' } });
        out.push({ t: 'pick', cfg: { mode: 'read', words: ['ryeowon', shuffle(fam)[0], 'ryeowon'], pool: fam, n: 3, title: '내 이름 찾기' } });
        out.push({ t: 'train', cfg: { words: ['ryeowon', 'ryeowon'], n: stage.n >= 2 ? 2 : 1, title: '이름 기차' } });
        if (stage.n === 3) out.push({ t: 'pop', cfg: { targets: ['려', '라', '려', '로'], pool: ['려', '라', '로', '루', '리'], k: 3, title: '려원이 글자 찾기' } });
        out.push({ t: 'trace', cfg: { chars: stage.n === 3 ? ['ㄹ', '려', '원'] : ['려', '원'], faint: stage.n === 2, look: stage.n >= 4, title: stage.n >= 4 ? '보고 쓰기, 가리고 쓰기' : '내 이름 쓰기' } });
        if (stage.n >= 2) out.push({ t: 'speak', cfg: { items: [sayWord('ryeowon')], n: 1, title: '내 이름 읽기' } });
        break;
      }
      case 'sound': {
        const fam = ['eomma', 'appa', 'agi', 'halmeoni', 'harabeoji', 'nuna', 'ryeowon'];
        const clapW = shuffle(['appa', 'eomma', 'nabi', 'ori', 'hama', 'banana', 'goguma', 'kokkiri', 'halmeoni', 'harabeoji', 'so', 'ryeowon']).slice(0, 3);
        const songs = [['엄', '마', '아', '빠'], ['나', '비', '나', '무'], ['바', '나', '나'], ['고', '구', '마'], ['오', '리', '오', '이'], ['코', '끼', '리']];
        if (stage.n === 1) out.push({ t: 'pick', cfg: { words: shuffle(fam), pool: fam, n: 4, title: '우리 가족' } });
        out.push({ t: 'clap', cfg: { words: clapW, n: stage.n < 3 ? 2 : 3, quiz: stage.n < 2 ? 1 : 2, pool: shuffle(['so', 'nabi', 'banana', 'kokkiri', 'appa', 'goguma', 'harabeoji']) } });
        out.push({ t: 'chant', cfg: { syl: songs[(stage.n - 1) % songs.length], quiz: 2 } });
        if (stage.n >= 2) out.push({ t: 'first', cfg: { sets: firstSets(3) } });
        out.push({ t: 'pick', cfg: { words: listenWords(4), n: 4 } });
        break;
      }
      case 'vowel': case 'vowel2': {
        const v = stage.v;
        const known = Array.from(L.v);
        const vs = stage.k === 'vowel' ? D.BASIC_V : ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅑ', 'ㅕ', 'ㅛ', 'ㅠ', 'ㅐ', 'ㅔ', 'ㅡ', 'ㅣ'];
        out.push({ t: 'meet', cfg: { j: v, title: v + ' 친구를 만나요' } });
        if (stage.k === 'vowel') {
          out.push({ t: 'chant', cfg: { syl: known.map(x => D.VROW[x]), reps: known.length < 3 ? 2 : 1, quiz: Math.min(2, known.length) } });
          out.push({ t: 'pop', cfg: { jamo: true, targets: shuffle(Array(4).fill(v).concat(known)).slice(0, 4), pool: vs, k: 3 } });
        } else {
          const row = ['ㄱ', 'ㄴ', 'ㅁ', 'ㅇ', 'ㅎ', 'ㄹ', 'ㅂ', 'ㅅ', 'ㅈ'].map(c => D.join(c, v, '')).filter(s => D.has.sy(s)).slice(0, 5);
          out.push({ t: 'chant', cfg: { syl: row } });
          out.push({ t: 'pop', cfg: { targets: shuffle(row).slice(0, 4), pool: row.concat(['가', '나', '마']), k: 3 } });
        }
        const vw = pics().filter(w => w.syl.some(s => D.split(s).jung === v)).map(w => w.key);
        if (vw.length >= 2) out.push({ t: 'pick', cfg: { words: shuffle(vw), pool: listenWords(8).concat(vw), n: 3, title: v + ' 소리 낱말' } });
        if (known.length >= 3 || stage.k === 'vowel2') out.push({ t: 'hide', cfg: { target: v, jamo: true, decoys: (stage.k === 'vowel' ? D.BASIC_V : vs).filter(x => x !== v), count: 3 } });
        out.push({ t: 'trace', cfg: { chars: [v] } });
        break;
      }
      case 'vrev': case 'vrev2': {
        const known = Array.from(L.v);
        out.push({ t: 'chant', cfg: { syl: (stage.k === 'vrev' ? known : known.slice(-6)).map(x => D.VROW[x]).filter(s => D.has.sy(s)), quiz: 3 } });
        out.push({ t: stage.id % 2 ? 'fish' : 'pop', cfg: { jamo: true, targets: shuffle(known).slice(0, 4), pool: known, n: 4, k: 3 } });
        out.push({ t: 'pick', cfg: { words: listenWords(4), n: 4 } });
        out.push({ t: 'trace', cfg: { chars: shuffle(known).slice(0, 2), faint: true } });
        break;
      }
      case 'cons1': {
        const c = stage.c, row = vRow(c, D.BASIC_V);
        out.push({ t: 'meet', cfg: { j: c, title: c + ' (' + D.JNAME[c] + ')' } });
        out.push({ t: 'block', cfg: { c, vowels: D.BASIC_V, mode: 'show' } });
        out.push({ t: 'chant', cfg: { syl: row, quiz: 2 } });
        const pool = row.concat(vRow('ㅇ', D.BASIC_V).slice(0, 2));
        out.push({ t: 'pop', cfg: { targets: shuffle(row).slice(0, 4), pool, k: 3 } });
        out.push({ t: 'hide', cfg: { target: c, jamo: true, decoys: learnedJamo(L).filter(x => x !== c && x !== 'ㅇ').concat(['ㅇ']), count: 3 } });
        out.push({ t: 'trace', cfg: { chars: [c] } });
        break;
      }
      case 'cons2': {
        const c = stage.c;
        out.push({ t: 'block', cfg: { c, vowels: D.BASIC_V, mode: 'make', n: 4 } });
        const ws = wordsFor(L, w => w.w.split('').some(ch => D.split(ch).cho === c));
        const wsAll = wordsFor(L);
        if (ws.length >= 1 && ws.filter(k => allSy(D.WORDS[k])).length) out.push({ t: 'train', cfg: { words: shuffle(ws.filter(k => allSy(D.WORDS[k]))), n: 2 } });
        if (wsAll.length >= 3) out.push({ t: 'pick', cfg: { mode: 'read', words: shuffle(ws.length >= 2 ? ws : wsAll), pool: wsAll.length >= 3 ? wsAll : pics().map(w => w.key), n: 3 } });
        else out.push({ t: 'pick', cfg: { words: listenWords(3), n: 3 } });
        out.push({ t: 'trace', cfg: { chars: [D.join(c, 'ㅏ', ''), D.join(c, 'ㅗ', '')] } });
        const nv = novelSy(L, 2, x => D.split(x).cho === c);
        if (nv.length) out.push({ t: 'speak', cfg: { items: nv.map(sayItem), novel: true, n: 2 } });
        break;
      }
      case 'crev': {
        const cs = Array.from(L.c).filter(c => c !== 'ㅇ').slice(-4);
        const pool = cs.flatMap(c => vRow(c, ['ㅏ', 'ㅗ', 'ㅣ', 'ㅜ']));
        const weak = weakSy(s => pool.includes(s));
        out.push({ t: stage.id % 2 ? 'fish' : 'pop', cfg: { targets: weak.concat(shuffle(pool)).slice(0, 4), pool, n: 4, k: 4, title: stage.id % 2 ? '글자 낚시' : '보물 풍선' } });
        const ws = wordsFor(L);
        if (ws.length >= 3) out.push({ t: 'memory', cfg: { words: shuffle(ws), pairs: 3 } });
        if (ws.length >= 3) out.push({ t: 'pick', cfg: { mode: 'read', words: shuffle(ws), pool: ws, n: 4 } });
        out.push({ t: 'trace', cfg: { chars: shuffle(cs).slice(0, 2).map(c => D.join(c, pick(['ㅏ', 'ㅣ', 'ㅗ']), '')), faint: true } });
        const nv = novelSy(L, 2);
        if (nv.length) out.push({ t: 'speak', cfg: { items: nv.map(sayItem), novel: true, n: 2 } });
        break;
      }
      case 'bat1': {
        const bb = stage.b;
        const bodies = D.SY.split('').filter(s => { const p = D.split(s); return !p.jong && D.has.sy(D.join(p.cho, p.jung, bb)) && D.BASIC_V.includes(p.jung) && p.cho !== 'ㄲ'; });
        out.push({ t: 'meet', cfg: { j: bb, title: '받침 ' + bb, clip: D.has.j(bb) ? D.jKey(bb) : null } });
        out.push({ t: 'batchim', cfg: { items: shuffle(bodies).slice(0, 4).map(x => [x, bb]), mode: 'show', n: 4 } });
        const codas = Array.from(new Set(Array.from(L.b).concat(['ㅇ', 'ㄴ', 'ㅁ', 'ㄹ'])));
        out.push({ t: 'batchim', cfg: { items: shuffle(bodies).slice(0, 3).map(x => [x, bb]), mode: 'make', codas, n: 3 } });
        const ex = bodies.map(x => { const p = D.split(x); return D.join(p.cho, p.jung, bb); })[0];
        out.push({ t: 'trace', cfg: { chars: [ex] } });
        break;
      }
      case 'bat2': {
        const bb = stage.b;
        const ws = pics().filter(w => w.syl.some(s => D.split(s).jong === bb)).map(w => w.key);
        out.push({ t: 'pick', cfg: { words: shuffle(ws), pool: ws.concat(listenWords(6)), n: Math.min(4, ws.length), title: '받침 ' + bb + ' 낱말' } });
        const tw = ws.filter(k => allSy(D.WORDS[k]));
        if (tw.length) out.push({ t: 'train', cfg: { words: shuffle(tw), n: 2 } });
        const rd = wordsFor(L, w => w.syl.some(s => D.split(s).jong === bb));
        if (rd.length >= 2) out.push({ t: 'pick', cfg: { mode: 'read', words: shuffle(rd), pool: wordsFor(L), n: 3 } });
        const tr = shuffle(ws.flatMap(k => D.WORDS[k].syl).filter(s => D.split(s).jong === bb && D.strokesFor(s)));
        out.push({ t: 'trace', cfg: { chars: tr.slice(0, 2) } });
        if (rd.length) out.push({ t: 'speak', cfg: { items: shuffle(rd).slice(0, 2).map(sayWord), n: 2 } });
        break;
      }
      case 'brev': {
        const ws = wordsFor(L);
        out.push({ t: 'memory', cfg: { words: shuffle(ws.filter(k => D.WORDS[k].syl.some(s => D.split(s).jong))), pairs: 4 } });
        const codas = Array.from(L.b);
        const bodies = ['가', '나', '마', '바', '사', '고', '보', '소', '다', '자'];
        const items = shuffle(bodies.flatMap(x => codas.map(cd => [x, cd]))).filter(([x, cd]) => { const p = D.split(x); return D.has.sy(D.join(p.cho, p.jung, cd)); });
        out.push({ t: 'batchim', cfg: { items, mode: 'make', codas, n: 4 } });
        out.push({ t: 'pick', cfg: { mode: 'read', words: shuffle(ws), pool: ws, n: 4 } });
        out.push({ t: 'trace', cfg: { chars: shuffle(['강', '곰', '달', '눈', '밥', '옷', '책'].filter(s => D.strokesFor(s))).slice(0, 2), faint: true } });
        const nb = shuffle(items.map(([x, cd]) => { const p0 = D.split(x); return D.join(p0.cho, p0.jung, cd); }).filter(x => D.has.sy(x) && !St.s.learn.items['sy:' + x])).slice(0, 2);
        if (nb.length) out.push({ t: 'speak', cfg: { items: nb.map(sayItem), novel: true, n: 2 } });
        break;
      }
      case 'word': {
        let ws = wordsFor(L, w => stage.g === 'mix' || w.grp === stage.g || (stage.g === 'ride' && w.grp === 'thing'));
        if (ws.length < 4) ws = wordsFor(L);
        const tw = ws.filter(k => allSy(D.WORDS[k]) && D.WORDS[k].syl.length >= 2);
        if (tw.length) out.push({ t: 'train', cfg: { words: shuffle(tw), n: 3 } });
        if (stage.id % 2) out.push({ t: 'shop', cfg: { words: shuffle(ws), pool: ws, n: 3 } });
        else out.push({ t: 'memory', cfg: { words: shuffle(ws), pairs: 4 } });
        out.push({ t: 'pick', cfg: { mode: 'read', words: shuffle(ws), pool: ws, n: 3 } });
        out.push({ t: 'speak', cfg: { items: shuffle(ws).slice(0, 2).map(sayWord), n: 2 } });
        const w0 = shuffle(tw.length ? tw : ws)[0] || 'nabi';
        out.push({ t: 'trace', cfg: { chars: D.WORDS[w0].syl.filter(s => D.strokesFor(s)).slice(0, 2), faint: stage.id % 2 === 0 } });
        break;
      }
      case 'twin': {
        const t = stage.c, base = D.TWINS[t];
        /* only pairs where both syllables have a studio recording (가/까, 바/빠, 달/딸, 시/씨, 지/찌 …) */
        const pairs = D.SY.split('').filter(x => { const p0 = D.split(x); return p0 && p0.cho === t && D.has.sy(D.join(base, p0.jung, p0.jong)); })
          .map(x => { const p0 = D.split(x); return [D.join(base, p0.jung, p0.jong), x]; }).slice(0, 3);
        out.push({ t: 'meet', cfg: { j: t, title: t + ' (' + D.JNAME[t] + ')' } });
        if (pairs.length) out.push({ t: 'twin', cfg: { pairs, n: Math.min(3, pairs.length * 2) } });
        const tw = pics().filter(w => w.syl.some(x => D.split(x).cho === t)).map(w => w.key);
        if (tw.length) out.push({ t: 'pick', cfg: { words: shuffle(tw), pool: tw.concat(listenWords(6)), n: Math.min(3, tw.length), title: t + ' 소리 낱말' } });
        out.push({ t: 'hide', cfg: { target: t, jamo: true, decoys: [base, base, base].concat(Object.keys(D.TWINS).filter(x => x !== t), Object.values(D.TWINS).filter(x => x !== base)), count: 3 } });
        out.push({ t: 'trace', cfg: { chars: [t].concat(pairs.length ? [pairs[0][1]] : []) } });
        if (pairs.length) out.push({ t: 'speak', cfg: { items: pairs.slice(-2).map(p => sayItem(p[1])), novel: true, n: 2 } });
        break;
      }
      case 'twrev': {
        const ts = Array.from(L.c).filter(c => D.TWINS[c]);
        const pool = ts.flatMap(t => ['ㅏ', 'ㅗ', 'ㅣ'].flatMap(v => [D.join(t, v, ''), D.join(D.TWINS[t], v, '')])).filter(x => D.has.sy(x));
        out.push({ t: 'fish', cfg: { targets: shuffle(pool.filter(x => D.TWINS[D.split(x).cho])).slice(0, 4), pool, n: 4, k: 3, title: '쌍둥이 낚시' } });
        const tw = pics().filter(w => w.syl.some(x => ts.includes(D.split(x).cho))).map(w => w.key);
        if (tw.length >= 2) out.push({ t: 'memory', cfg: { words: shuffle(tw), pairs: Math.min(3, tw.length) } });
        out.push({ t: 'trace', cfg: { chars: shuffle(ts).slice(0, 2).map(t => D.join(t, pick(['ㅏ', 'ㅗ']), '')), faint: true } });
        out.push({ t: 'speak', cfg: { items: shuffle(pool).slice(0, 2).map(sayItem), novel: true, n: 2 } });
        break;
      }
      case 'cvow': {
        const cv = stage.v;
        const CONS = { 'ㅘ': ['ㄱ', 'ㅎ'], 'ㅝ': ['ㅇ'], 'ㅢ': ['ㅇ'], 'ㅟ': ['ㄱ', 'ㅇ'] };
        out.push({ t: 'meet', cfg: { j: cv, title: cv + ' 친구를 만나요' } });
        out.push({ t: 'vmerge', cfg: { v: cv, cons: CONS[cv] || ['ㅇ'] } });
        const has = w => w.syl.some(x => { const j = D.split(x).jung; return j === cv || (cv === 'ㅟ' && j === 'ㅚ'); });
        const cw = pics().filter(has).map(w => w.key);
        const rd = wordsFor(L, has);
        if (rd.length) out.push({ t: 'pick', cfg: { mode: 'read', words: shuffle(rd), pool: wordsFor(L), n: Math.min(3, rd.length) } });
        else if (cw.length) out.push({ t: 'pick', cfg: { words: shuffle(cw), pool: cw.concat(listenWords(6)), n: Math.min(3, cw.length) } });
        out.push({ t: 'trace', cfg: { chars: [cv, D.join((CONS[cv] || ['ㅇ'])[0], cv, '')] } });
        out.push({ t: 'speak', cfg: { items: (CONS[cv] || ['ㅇ']).map(c => sayItem(D.join(c, cv, ''))).concat(rd.slice(0, 1).map(sayWord)), n: 2 } });
        break;
      }
      case 'cvrev': {
        const cvs = Array.from(L.v).filter(v => D.COMPLEX[v]);
        const pool = ['과', '화', '워', '의', '귀', '위', '사', '가', '오', '이'].filter(x => D.has.sy(x));
        out.push({ t: 'fish', cfg: { targets: shuffle(pool.filter(x => D.COMPLEX[D.split(x).jung])).slice(0, 4), pool, n: 4, k: 3, title: '미끄럼 낚시' } });
        const rd = wordsFor(L, w => w.syl.some(x => D.COMPLEX[D.split(x).jung]));
        if (rd.length >= 2) out.push({ t: 'shop', cfg: { words: shuffle(rd), pool: wordsFor(L), n: Math.min(3, rd.length) } });
        out.push({ t: 'hide', cfg: { target: pick(cvs), jamo: true, decoys: cvs.concat(['ㅗ', 'ㅏ', 'ㅜ', 'ㅓ', 'ㅡ', 'ㅣ']), count: 3 } });
        out.push({ t: 'trace', cfg: { chars: shuffle(['과', '워', '의', '귀']).slice(0, 2), faint: true } });
        out.push({ t: 'speak', cfg: { items: shuffle(rd).slice(0, 2).map(sayWord), n: 2 } });
        break;
      }
      case 'story': {
        const n = stage.n;
        const ph = shuffle(D.PHRASES).slice(0, 3).map(p => ({ words: p }));
        const decoys = D.PHRASES.map(p => p).concat(D.SENTENCES.map(s => s.pics));
        const items = n >= 4 ? ph.slice(0, 2).concat([pick(D.SENTENCES)]) : ph;
        out.push({ t: 'story', cfg: { items, decoys, alone: n >= 6, n: 3 } });
        const ws = wordsFor(L);
        if (n % 2) out.push({ t: 'shop', cfg: { words: shuffle(ws), pool: ws, n: 3 } });
        else out.push({ t: 'memory', cfg: { words: shuffle(ws), pairs: 4 } });
        out.push({ t: 'story', cfg: { items: shuffle(D.PHRASES).slice(0, 2).map(p => ({ words: p })), decoys, alone: true, n: 2, title: '혼자 읽기' } });
        const fam = (G.Rec ? G.Rec.sentences() : []).map(r => ({ text: r.label, clip: r.key, item: 'sayu:' + r.key }));
        out.push({ t: 'speak', cfg: { items: shuffle(fam).slice(0, 1).concat([sayPhrase(pick(D.PHRASES))]), n: 2, title: '소리 내어 읽기' } });
        const w0 = pick(ws.filter(k => D.WORDS[k].syl.length === 2)) || 'nabi';
        out.push({ t: 'trace', cfg: { chars: D.WORDS[w0].syl.filter(s => D.strokesFor(s)), faint: true } });
        break;
      }
    }
    return out.filter(p => validPlay(p));
  };
  function validPlay(p) {
    const c = p.cfg;
    if (p.t === 'trace') return c.chars && c.chars.filter(ch => D.strokesFor(ch)).length > 0;
    if (p.t === 'memory') return c.words && c.words.length >= 2;
    if (p.t === 'train' || p.t === 'pick' || p.t === 'clap') return c.words && c.words.length >= 1;
    if (p.t === 'chant') return c.syl && c.syl.filter(s => D.has.sy(s)).length >= 2;
    if (p.t === 'pop') return c.targets && c.targets.length && c.pool && c.pool.length >= 2;
    if (p.t === 'batchim') return c.items && c.items.length > 0;
    if (p.t === 'fish') return c.targets && c.targets.length && c.pool && c.pool.length >= 2;
    if (p.t === 'shop') return c.words && c.words.length >= 1 && (c.pool || c.words).length >= 3;
    if (p.t === 'hide') return !!c.target && c.decoys && c.decoys.length >= 2;
    if (p.t === 'speak') return c.items && c.items.length >= 1;
    return true;
  }
  /* Every clip a stage may play (for preloading). */
  Plan.clips = function (plays) {
    const out = new Set(['ui_same', 'ui4_chant', 'ui4_balloon', 'ui4_echo2', 'ui_which', 'ui_clapyou', 'ui_clapq', 'ui4_block', 'ui_trace', 'ui_train', 'ui4_memory', 'ui_together']);
    plays.forEach(({ t, cfg }) => { if (t === 'clap') (cfg.words || []).concat(cfg.pool || []).forEach(k => { if (D.CLAP.has(k)) out.add('c_' + k); }); });
    Object.values(D.PRAISE_VOICE).forEach(p => out.add(p[1]));
    const addSy = s => { if (D.has.sy(s)) out.add(D.syKey(s)); if (D.has.fy(s)) out.add(D.fyKey(s)); if (D.has.dy(s)) out.add(D.dyKey(s)); };
    const addW = k => { out.add('w_' + k); if (D.HY.has(k)) out.add('hy_' + k); D.WORDS[k].syl.forEach(addSy); };
    plays.forEach(({ t, cfg }) => {
      if (t === 'meet' && D.has.j(cfg.j)) out.add(D.jKey(cfg.j));
      (cfg.words || []).forEach(addW);
      (cfg.pool || []).forEach(x => (D.WORDS[x] ? addW(x) : addSy(x)));
      (cfg.syl || []).forEach(addSy);
      (cfg.targets || []).forEach(x => { addSy(x); if (D.VROW[x]) addSy(D.VROW[x]); });
      (cfg.chars || []).forEach(x => { addSy(x); if (D.VROW[x]) addSy(D.VROW[x]); });
      if (t === 'speak') (cfg.items || []).forEach(it => { if (it.clip) out.add(it.clip); (it.keys || []).forEach(k => out.add(k)); });
      if (cfg.target) addSy(cfg.target);
    });
    return Array.from(out);
  };

  G.P = P;
  G.Plan = Plan;
})(window);
