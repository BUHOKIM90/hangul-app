'use strict';
/* R3 item 9 — 「려원이가 만든 게임」 무럭무럭 아쿠아리움.
   려원 made this game with Claude (r3/ryeowon_game/source.html): a little fry eats to grow 치어 → 열대어 → 도미 → 참치 → 상어 → 고래,
   gentle failure, synthesized sounds. Here the prey fish carry letters (or pictures, before letters are learned):
   - the target sound plays; the choices wait while it is heard (same tap guard as the stages, games.js Guard);
   - the right fish: praise < 0.2 s, the fry eats it and grows; every 2 → it evolves and says its new name;
   - a wrong fish bounces away, "그건 X 글자야", the target is said again after a 2nd or a too-fast miss. Nothing is lost;
   - only letters already learned on the road (Plan.learnedAt); old-voice look-alike syllables (D.SHAKY) are left out;
   - 2½ minutes at most (a real clock, not only after right answers); reaching 고래 gives a 바다 sticker and, once, the 고래 모자. */
(function (G) {
  const D = G.D, A = G.A, UI = G.UI, St = G.St, P = G.P, Plan = G.Plan;
  const { el, btn, sleep, shuffle, esc } = UI;
  /* his species table (colours and names kept from his game) */
  const SP = [
    { name: '치어', key: 'chieo', top: '#ffd24a', belly: '#fff4b8', fin: '#ffab2e', h: 0.8 },
    { name: '열대어', key: 'yeoldaeeo', top: '#ff7f6b', belly: '#ffd0bd', fin: '#18c4b3', h: 0.7, pat: 'band' },
    { name: '도미', key: 'domi', top: '#f0527a', belly: '#ffd6dc', fin: '#c4305f', h: 0.66, pat: 'spots' },
    { name: '참치', key: 'chamchi', top: '#2c6ad4', belly: '#e8f2ff', fin: '#ffcf40', h: 0.46, pat: 'line' },
    { name: '상어', key: 'sangeo', top: '#7d92a8', belly: '#f3f7fb', fin: '#657a90', h: 0.42, shark: 1 },
    { name: '고래', key: 'gorae', top: '#3877cb', belly: '#edf6ff', fin: '#2a5fa8', h: 0.56, whale: 1 }
  ];
  const SAY = ['', '알록달록 열대어가 됐어요', '통통한 도미가 됐어요', '날쌘 참치가 됐어요', '이제 바다의 사냥꾼, 상어예요', '수조에서 가장 큰 고래예요'];
  const PER = 2, LIMIT = 150;
  const Aq = { PER, LIMIT, SP };
  G.Aqua = Aq;

  /* the player's fish, facing right, in a 200×120 box */
  function fishSvg(s) {
    const ry = 50 * s.h, L = '#4B3642';
    let pat = '';
    if (s.pat === 'band') pat = `<path d="M92 ${60 - ry + 4} Q100 60 92 ${60 + ry - 4}" stroke="#fff" stroke-width="10" fill="none" opacity=".9"/>`;
    if (s.pat === 'spots') pat = [[80, 50], [100, 64], [118, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" opacity=".45"/>`).join('');
    if (s.pat === 'line') pat = `<path d="M50 60 H150" stroke="#fff" stroke-width="4" opacity=".4"/>`;
    const dorsal = s.shark ? `<path d="M88 ${60 - ry + 2} L110 ${60 - ry - 26} L122 ${60 - ry + 4}Z" fill="${s.fin}" stroke="${L}" stroke-width="4" stroke-linejoin="round"/>`
      : s.whale ? `<path d="M150 ${60 - ry - 4} q-4 -16 -12 -14 M150 ${60 - ry - 4} q2 -18 10 -18 M150 ${60 - ry - 4} q8 -12 16 -8" stroke="#8FD0F2" stroke-width="4" fill="none" stroke-linecap="round"/>`
        : `<path d="M80 ${60 - ry + 3} Q100 ${60 - ry - 18} 124 ${60 - ry + 4}Z" fill="${s.fin}" stroke="${L}" stroke-width="4" stroke-linejoin="round"/>`;
    const teeth = s.shark ? `<path d="M168 70 l4 6 4 -6 4 6 4 -6" fill="#fff" stroke="${L}" stroke-width="2"/>` : '';
    return `<svg viewBox="0 0 200 120" aria-hidden="true"><path d="M44 60 L6 ${60 - ry * 0.9} L16 60 L6 ${60 + ry * 0.9}Z" fill="${s.fin}" stroke="${L}" stroke-width="4" stroke-linejoin="round"/>${dorsal}
      <ellipse cx="110" cy="60" rx="74" ry="${ry}" fill="${s.top}" stroke="${L}" stroke-width="4"/><path d="M40 ${60 + ry * 0.2} Q110 ${60 + ry * 1.25} 182 ${60 + ry * 0.15} Q110 ${60 + ry * 0.75} 40 ${60 + ry * 0.2}Z" fill="${s.belly}"/>${pat}
      <ellipse cx="110" cy="60" rx="74" ry="${ry}" fill="none" stroke="${L}" stroke-width="4"/><path d="M104 ${64} q-10 14 -24 12" fill="${s.fin}" stroke="${L}" stroke-width="3.4" stroke-linejoin="round"/>
      <circle cx="156" cy="${60 - ry * 0.3}" r="7" fill="${L}"/><circle cx="154" cy="${60 - ry * 0.3 - 2.6}" r="2.6" fill="#fff"/><path d="M170 ${66} q6 4 12 0" fill="none" stroke="${L}" stroke-width="3" stroke-linecap="round"/>${teeth}
      <ellipse cx="140" cy="${60 + ry * 0.1}" rx="6" ry="3.6" fill="#FF8FB0" opacity=".6"/></svg>`;
  }
  const PREY = c => `<svg viewBox="0 0 130 80" aria-hidden="true"><path d="M100 40 L128 14 L124 40 L128 66Z" class="tail"/><path d="M50 8 Q66 -4 80 10" class="tail"/><ellipse cx="58" cy="40" rx="54" ry="34" class="bd"/><path d="M84 22 q8 18 0 36 M94 26 q6 14 0 28" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/><ellipse cx="34" cy="20" rx="12" ry="5" fill="#fff" opacity=".55" transform="rotate(-18 34 20)"/><circle cx="22" cy="34" r="7" fill="#4B3642"/><circle cx="20" cy="31.5" r="2.8" fill="#fff"/><path d="M10 50 q6 5 12 0" fill="none" stroke="#4B3642" stroke-width="3" stroke-linecap="round"/></svg>`;

  /* What the fish carry: only what the road has taught so far. */
  Aq.content = function () {
    const L = Plan.learnedAt(Math.max(0, St.s.learn.stage - 1));
    const vs = Array.from(L.v).filter(v => D.BASIC_V.includes(v));
    const cs = Array.from(L.c).filter(c => c !== 'ㅇ' && !D.TWINS[c]);
    const calm = x => !D.SHAKY.has(x);
    if (cs.length && vs.length >= 3) {
      const sy = cs.flatMap(c => vs.map(v => D.join(c, v, ''))).filter(x => D.has.sy(x) && calm(x));
      if (sy.length >= 4) return { mode: 'sy', items: sy };
    }
    if (vs.length >= 3) return { mode: 'jamo', items: vs };
    return { mode: 'pic', items: ['nabi', 'ori', 'so', 'hama', 'banana', 'tokki', 'gom', 'podo', 'oi', 'uyu', 'sagwa', 'gicha'].filter(k => D.WORDS[k]) };
  };

  G.App.aqua = async function () {
    const App = G.App, K = P._kit;
    const { m, my } = App.openScreen('aqua');
    const alive = () => App.sess === my;
    let abortRes;
    const ctx = { right: 0, wrong: 0, help: false, alive, star: () => { if (alive()) App.star(1); }, gift: async () => {}, aborted: new Promise(r => { abortRes = r; }) };
    App._abort = () => abortRes(false);
    const C = Aq.content();
    const wrap = el('div', 'aqua');
    wrap.innerHTML = `<div class="aq-top"><div class="aq-credit"><span class="aq-badge">✏️ 려원이가 만든 게임</span><b>무럭무럭 아쿠아리움</b></div>
      <div class="aq-grow">${SP.map((s, i) => `<i class="${i === 0 ? 'on' : ''}"><span>${esc(s.name)}</span></i>`).join('')}</div><div class="aq-clock"><i></i></div></div>
      <div class="aq-tank"><i class="bub b1"></i><i class="bub b2"></i><i class="bub b3"></i><i class="weed w1"></i><i class="weed w2"></i><i class="weed w3"></i>
        <div class="aq-me"><div class="aq-fish">${fishSvg(SP[0])}</div><b class="aq-name">${SP[0].name}</b></div><div class="pond aq-pond"></div><div class="aq-toast" hidden></div></div>`;
    m.appendChild(wrap);
    const top = wrap.querySelector('.aq-top');
    let target = null;
    const promptOf = t => (C.mode === 'pic' ? 'w_' + t : C.mode === 'jamo' ? K.jamoClip(t) : (K.findClip(t) || K.sayKey(t)));
    const thatOf = t => (C.mode === 'pic' ? (D.HY.has(t) ? 'hy_' + t : 'w_' + t) : C.mode === 'jamo' ? K.jamoClip(t) : K.thatClip(t));
    const spk = btn('speaker', '<span class="spk">🔊</span>', () => { if (target) A.play(promptOf(target)); }, '다시 듣기');
    top.appendChild(spk);
    const me = wrap.querySelector('.aq-me'), meFish = wrap.querySelector('.aq-fish'), meName = wrap.querySelector('.aq-name');
    const pond = wrap.querySelector('.aq-pond'), toast = wrap.querySelector('.aq-toast'), clock = wrap.querySelector('.aq-clock i');
    const dots = Array.from(wrap.querySelectorAll('.aq-grow i'));
    await A.preload(C.items.map(promptOf).concat(['v_fish', 'w_sangeo', 'w_gorae']));
    if (!alive()) return;
    /* the credit is said once (text until v_aqua is recorded) */
    const intro = UI.modal(`<div class="aq-intro"><div class="aq-intro-fish">${fishSvg(SP[0])}</div><h3>려원이가 만든 게임!</h3><p>작은 치어가 글자 물고기를 먹고<br>고래까지 자라요.</p></div>`, [['시작! 🐟', 1, 'go']], 'aq-m');
    if (D.ready('v_aqua')) A.play('v_aqua');
    await intro;
    if (!alive()) return;
    await A.play('v_fish');
    if (!alive()) return;
    const t0 = performance.now();
    let n = 0, stage = 0, endRes, last = null, mash = false;
    const ended = new Promise(r => { endRes = r; });
    const secs = () => (performance.now() - t0) / 1000;
    /* Lily R3: the clock ends the session even when no right answer comes */
    const tick = setInterval(() => {
      if (!alive()) { clearInterval(tick); return; }
      clock.style.width = Math.max(0, 100 - secs() / Aq.LIMIT * 100) + '%';
      if (secs() >= Aq.LIMIT) { clearInterval(tick); endRes('time'); }
    }, 250);
    const stats = G.__aqua = { mode: C.mode, n: 0, stage: 0, secs: 0, right: 0, wrong: 0, result: '' };
    const grow = () => {
      const sc = 1 + stage * 0.22 + (n % PER) * 0.06;
      me.style.setProperty('--sc', sc.toFixed(2));
    };
    async function evolve() {
      stage++;
      stats.stage = stage;
      const s = SP[stage];
      A.sfx('fanfare');
      UI.burst(UI.pointOf(null, me), 40);
      meFish.innerHTML = fishSvg(s);
      meName.textContent = s.name;
      me.classList.remove('evo'); void me.offsetWidth; me.classList.add('evo');
      dots.forEach((d, i) => d.classList.toggle('on', i <= stage));
      toast.innerHTML = `<b>진화! ${esc(s.name)}</b><small>${esc(SAY[stage])}</small>`;
      toast.hidden = false; toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
      /* each evolution says its word (상어·고래 now; 열대어·도미·참치 once recorded) */
      const k = 'w_' + s.key;
      if (D.WORDS[s.key] || D.ready(k)) await A.play(k); else await sleep(900);
      await sleep(500);
      toast.hidden = true;
    }
    grow();
    while (alive() && stage < SP.length - 1 && secs() < Aq.LIMIT) {
      const pool = C.items.filter(x => x !== last);
      const t = target = shuffle(pool)[0];
      last = t;
      const opts = shuffle([t].concat(shuffle(C.items.filter(x => x !== t && (C.mode !== 'pic' || !D.clash(x, t)))).slice(0, 2)));
      pond.innerHTML = '';
      const nodes = opts.map((o, i) => {
        const lane = el('div', 'lane');
        const f = el('button', 'tap fishy c' + ((i + n) % 5), PREY() + (C.mode === 'pic' ? `<span class="aq-pic">${UI.pic(o)}</span>` : `<span>${esc(o)}</span>`));
        f.type = 'button'; f.dataset.v = o;
        f.setAttribute('aria-label', C.mode === 'pic' ? D.WORDS[o].w : o);
        f.style.animationDuration = (8 + i * 1.6 + Math.random() * 2) + 's';
        f.style.animationDelay = (-Math.random() * 6) + 's';
        lane.appendChild(f); pond.appendChild(lane);
        return f;
      });
      nodes.forEach(f => { const lw = f.parentElement.getBoundingClientRect().width, fw = f.getBoundingClientRect().width; f.style.setProperty('--d', Math.max(0, lw - fw - 8) + 'px'); });
      await sleep(250);
      if (!alive()) break;
      K.prompt(promptOf(t));
      K.ask(ctx, 1 / nodes.length, nodes.find(x => x.dataset.v === t));
      K.ans(t);
      let tries = 0, grew = false;
      const item = (C.mode === 'pic' ? 'w:' : C.mode === 'jamo' ? 'j:' : 'sy:') + t;
      const r = await Promise.race([K.choose(nodes, async (f, e) => {
        if (f.dataset.v === t) {
          /* the fish grows only on a first-try catch; after a guessed miss (< 0.6 s) it also has to be a calm one
             (≥ 0.6 s after the fish could be caught) — so mashing never grows the fry, a sure quick child still does */
          const calm = performance.now() - K.Guard.openAt >= 600;
          const grows = tries === 0 && (!mash || calm);
          if (grows && calm) mash = false;
          f.classList.add('caught'); A.sfx('pop');
          stats.right++;
          grew = grows;
          if (grows) { me.classList.remove('gulp'); void me.offsetWidth; me.classList.add('gulp'); n++; stats.n = n; grow(); }
          await K.right(ctx, 'pop', e, f, item);
          return true;
        }
        tries++; stats.wrong++;
        if (performance.now() - K.Guard.openAt < 600) mash = true;
        f.classList.remove('bounce'); void f.offsetWidth; f.classList.add('bounce');
        K.wrong(ctx, f, item, thatOf(f.dataset.v));
        if (tries >= 2) nodes.find(x => x.dataset.v === t).classList.add('hint');
        return false;
      }), ended, ctx.aborted]);
      if (r === 'time' || r === false || !alive()) break;
      if (grew && n % PER === 0) await evolve();
    }
    clearInterval(tick);
    K.ans(null);
    if (!alive()) return;
    target = null;
    stats.secs = Math.round(secs());
    const whale = stage === SP.length - 1;
    stats.result = whale ? 'whale' : 'time';
    St.logDay(ctx.right, ctx.wrong, 0, secs());
    A.stop();
    pond.innerHTML = '';
    if (whale) {
      A.sfx('fanfare'); UI.rain(30);
      const R = St.s.reward, sea = D.STICKERS.filter(x => x.set === 3);
      const free = sea.filter(x => !R.stickers[x.id]);
      const s = UI.pick(free.length ? free : sea);
      R.stickers[s.id] = (R.stickers[s.id] || 0) + 1; R.newStickers.push(s.id); St.save();
      const o = St.giveSpecial('hat_whale');
      await App.reveal([s], `<p class="outfit-got">고래가 됐어!${o ? ' 선물: 고래 모자!' : ''}</p>`);
    } else {
      await UI.modal(`<div class="aq-intro"><div class="aq-intro-fish">${fishSvg(SP[stage])}</div><h3>오늘은 여기까지!</h3><p>${esc(SP[stage].name)}까지 자랐어. 다음엔 더 크게 자라자!</p></div>`, [['좋아!', 1, 'go']], 'aq-m');
    }
    if (!alive()) return;
    const again = await UI.modal('<p class="aq-again">한 번 더 할까?</p>', [['한 번 더 🐟', 'again', 'go'], ['놀이터로', 'pg', 'no']], 'aq-m');
    if (!alive()) return;
    if (again === 'again') App.aqua(); else App.playground();
  };
})(window);
