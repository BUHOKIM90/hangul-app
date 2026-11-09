'use strict';
/* v6 ui: helpers, 몽글이 SVG, praise, effects, popups. */
(function (G) {
  const D = G.D, A = G.A, St = G.St;
  const UI = {};
  UI.$ = (s, r) => (r || document).querySelector(s);
  UI.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  /* Emoji -> Fluent Emoji Flat picture (v6/img/e/<codepoints>.svg, MIT © Microsoft). Strings that carry an SVG are left alone. */
  const EMO = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;
  const SKIP = /[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]/gu;
  UI.emKey = e => Array.from(e.replace(SKIP, '')).map(c => c.codePointAt(0).toString(16)).join('-');
  UI.em = (e, cls) => `<img class="em ${cls || ''}" src="v6/img/e/${UI.emKey(e)}.svg" alt="" draggable="false">`;
  const HAVE = new Set(G.EMOJI_KEYS || []);
  UI.E = html => (typeof html === 'string' && html.indexOf('<svg') < 0 ? html.replace(EMO, m => (HAVE.has(UI.emKey(m)) ? UI.em(m) : m)) : html);
  UI.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = UI.E(html);
    return e;
  };
  UI.sleep = ms => new Promise(r => setTimeout(r, ms));
  UI.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  UI.pick = a => a[Math.floor(Math.random() * a.length)];
  UI.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Fast tap: fires on pointerdown (no click delay), one fire per 280 ms per element. */
  UI.tap = function (el, fn) {
    let last = 0;
    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const now = performance.now();
      if (now - last < 280) return;
      last = now;
      e.preventDefault();
      UI.lastTapTime = e.timeStamp || now;
      fn(e);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } });
    return el;
  };
  UI.btn = function (cls, html, fn, label) {
    const b = UI.el('button', 'tap ' + cls, html);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    if (fn) UI.tap(b, e => { A.sfx('tap'); fn(e); });
    return b;
  };

  /* ---------- 한글 별 요정 친구들 (original flat characters, js/chars.js) ---------- */
  let gid = 0;
  const L = '#4B3642', sw = 'stroke="#4B3642" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"';
  /* outfits drawn in the character's own 200×312 space: head top ≈ y92, eyes y160 (x74/126), neck y200 */
  const WEAR = {
    back: {
      back_cape: `<path d="M64 200 L38 272 L162 272 L136 200Z" fill="#FF6B7A" ${sw}/><path d="M100 206 L100 266" stroke="#E04E5F" stroke-width="3"/>`,
      back_star: `<path d="M64 200 L38 272 L162 272 L136 200Z" fill="#7C8CFF" ${sw}/><path d="M60 252 l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z M140 236 l3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1z" fill="#FFE066"/>`,
      back_wing: `<g fill="#F4FBFF" ${sw}><path d="M66 214 C20 172 0 236 34 250 C48 256 62 240 68 230Z"/><path d="M134 214 C180 172 200 236 166 250 C152 256 138 240 132 230Z"/></g><path d="M40 222 q10 4 16 12 M160 222 q-10 4 -16 12" stroke="#B9DDF7" stroke-width="3" fill="none"/>`
    },
    neck: {
      neck_bow: `<g fill="#FF5A7A" ${sw}><path d="M100 204 l-20 -11 v22z"/><path d="M100 204 l20 -11 v22z"/><circle cx="100" cy="204" r="6"/></g>`,
      neck_scarf: `<path d="M60 196 Q100 214 140 196 L142 210 Q100 228 58 210Z" fill="#FF9548" ${sw}/><path d="M122 212 l6 26 h-16z" fill="#FF9548" ${sw}/>`,
      neck_pearl: '<g fill="#fff" stroke="#C8C0D8" stroke-width="2">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<circle cx="${68 + i * 8}" cy="${200 + Math.sin(i / 8 * Math.PI) * 9}" r="4.6"/>`).join('') + '</g>',
      neck_medal: `<path d="M86 196 L100 218 L114 196" fill="none" stroke="#3A7BD5" stroke-width="6"/><circle cx="118" cy="222" r="0"/><circle cx="100" cy="224" r="11" fill="#FFD23F" ${sw}/><text x="100" y="229" font-size="13" font-weight="900" text-anchor="middle" fill="#B07D00">1</text>`
    },
    eyes: {
      eyes_round: `<g fill="none" stroke="#4B3642" stroke-width="4"><circle cx="74" cy="160" r="16"/><circle cx="126" cy="160" r="16"/><path d="M90 158 h20"/></g>`,
      eyes_star: '<g fill="#FFE066" fill-opacity=".6" stroke="#E0A800" stroke-width="3.4" stroke-linejoin="round">' + [74, 126].map(x => `<path d="M${x} 142 l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/>`).join('') + '<path d="M90 158 h20" fill="none"/></g>',
      eyes_heart: '<g fill="#FF6F91" fill-opacity=".55" stroke="#E0446F" stroke-width="3.4" stroke-linejoin="round">' + [74, 126].map(x => `<path d="M${x} 176 l-16 -15 a9 9 0 0 1 16 -11 a9 9 0 0 1 16 11z"/>`).join('') + '<path d="M90 158 h20" fill="none"/></g>',
      eyes_sun: `<g fill="#3A3346" ${sw}><rect x="54" y="148" width="40" height="24" rx="10"/><rect x="106" y="148" width="40" height="24" rx="10"/><path d="M94 156 h12" fill="none"/></g><path d="M60 154 l8 -3 M112 154 l8 -3" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`
    },
    hat: {
      hat_party: `<path d="M100 44 L78 100 L122 100Z" fill="#FF7EB3" ${sw}/><circle cx="100" cy="44" r="7" fill="#FFE066" ${sw}/><circle cx="94" cy="80" r="3.4" fill="#fff"/><circle cx="106" cy="66" r="3.4" fill="#fff"/>`,
      hat_ribbon: `<g fill="#FF5A7A" ${sw}><path d="M100 98 l-26 -15 v30z"/><path d="M100 98 l26 -15 v30z"/><circle cx="100" cy="98" r="8"/></g>`,
      hat_flower: '<g transform="translate(146 110)">' + [0, 72, 144, 216, 288].map(r => `<ellipse rx="8" ry="12" transform="rotate(${r}) translate(0 -11)" fill="#FFB3D1" stroke="#4B3642" stroke-width="2.6"/>`).join('') + '<circle r="7" fill="#FFE066" stroke="#4B3642" stroke-width="2.6"/></g>',
      hat_cap: `<path d="M56 108 Q100 52 144 108Z" fill="#4C8DF0" ${sw}/><path d="M136 106 Q168 100 178 112 L138 112Z" fill="#2F6BC8" ${sw}/><circle cx="100" cy="74" r="4" fill="#fff"/>`,
      hat_bunny: `<g fill="#fff" ${sw}><ellipse cx="76" cy="62" rx="12" ry="32"/><ellipse cx="124" cy="62" rx="12" ry="32"/></g><g fill="#FFC6DA"><ellipse cx="76" cy="64" rx="5.4" ry="22"/><ellipse cx="124" cy="64" rx="5.4" ry="22"/></g><path d="M70 96 h60" stroke="#FF8FB0" stroke-width="7" stroke-linecap="round"/>`,
      hat_beret: `<ellipse cx="96" cy="96" rx="50" ry="18" fill="#E04E5F" ${sw}/><circle cx="96" cy="76" r="5" fill="#B23443"/>`,
      hat_chef: `<path d="M66 104 V84 Q58 60 82 62 Q92 46 110 58 Q136 52 136 78 V104Z" fill="#fff" ${sw}/><path d="M66 96 h70" stroke="#DDE3EE" stroke-width="3"/>`,
      hat_wizard: `<path d="M100 26 L68 104 L132 104Z" fill="#7A5CE8" ${sw}/><ellipse cx="100" cy="104" rx="46" ry="9" fill="#5A3FC0" ${sw}/><path d="M100 70 l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#FFE066"/>`,
      hat_crown: `<path d="M68 106 L70 70 L86 88 L100 60 L114 88 L130 70 L132 106Z" fill="#FFD95A" ${sw}/><circle cx="100" cy="92" r="5.4" fill="#FF5A7A" ${sw}/>`
    }
  };
  UI.friendId = id => (window.CHF.SPEC[id] ? id : (window.CHF.ALIAS[id] || 'lumi'));
  UI.mascot = function (mood, wear, who) {
    wear = wear || St.s.reward.wear || {};
    who = UI.friendId(who || St.s.reward.friend || 'lumi');
    const out = { back: WEAR.back[wear.back] || '', neck: WEAR.neck[wear.neck] || '', eyes: WEAR.eyes[wear.eyes] || '', hat: WEAR.hat[wear.hat] || '' };
    const body = D.OUTFITS.find(o => o.id === wear.body);
    if (body) {
      if (body.color === 'rainbow') {
        const id = 'rb' + (++gid);
        out.defs = `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#FFB3C7"/><stop offset=".35" stop-color="#FFE29A"/><stop offset=".65" stop-color="#B5F0DA"/><stop offset="1" stop-color="#C9B8FF"/></linearGradient>`;
        out.tint = `url(#${id})`;
      } else out.tint = body.color;
    }
    return window.CHF.draw(who, mood || 'happy', wear, out);
  };
  /* every friend wears a letter on the belly; tapping a friend says that letter's name (기역, 아 …) */
  UI.sayGem = function (id) {
    const g = window.CHF.SPEC[UI.friendId(id)].gem;
    if (D.has.j(g)) A.play(D.jKey(g));
  };
  UI.buddy = function (mood, anim) {
    const b = UI.$('#buddy');
    if (!b) return;
    b.innerHTML = UI.mascot(mood);
    if (anim) { b.classList.remove('jump', 'wiggle', 'bounce'); void b.offsetWidth; b.classList.add(anim); }
  };

  /* ---------- praise: visual + jingle in the same tap handler, voice right after ---------- */
  let lastPraise = '';
  UI.praiseStats = { count: 0, latencies: [], history: [], voice: [] };
  UI.praisePool = function (type) {
    const fit = (D.PRAISE_FIT[type] || D.PRAISE_FIT.pick).map(k => ({ k, text: D.PRAISE_VOICE[k][0], clip: D.PRAISE_VOICE[k][1] }));
    return fit.concat(D.CHEERS.map(t => ({ k: t, text: t })));
  };
  /* Last moment the child touched the screen (any pointer event) — praise latency is measured from here. */
  UI.lastInput = 0;
  ['pointerdown', 'pointermove', 'pointerup'].forEach(ev => document.addEventListener(ev, () => { UI.lastInput = performance.now(); }, true));
  /* opt.lead: () => Promise — a sound that should be heard before the praise voice (e.g. the syllable just made).
     The praise text, sparkles and jingle never wait for it. */
  UI.praise = function (type, at, opt) {
    opt = opt || {};
    const t0 = performance.now();
    const pool = UI.praisePool(type).filter(p => p.k !== lastPraise);
    const voiced = pool.filter(p => p.clip), cheers = pool.filter(p => !p.clip);
    const p = UI.pick(Math.random() < 0.55 && voiced.length ? voiced : cheers);
    lastPraise = p.k;
    A.sfx(UI.pick(['yay1', 'yay2', 'yay3', 'yay4']));
    const box = UI.$('#praise');
    box.textContent = p.text;
    box.hidden = false;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    UI.burst(at);
    requestAnimationFrame(() => { UI.buddy(UI.pick(['joy', 'cheer']), 'jump'); UI.cheerFriend(); });
    const lat = performance.now() - (UI.lastInput || t0);
    UI.praiseStats.count++; UI.praiseStats.latencies.push(Math.round(lat));
    UI.praiseStats.history.push(p.k);
    if (UI.praiseStats.history.length > 400) UI.praiseStats.history.splice(0, 200);
    box.dataset.lat = String(Math.round(lat));
    clearTimeout(UI._pt);
    UI._pt = setTimeout(() => { box.classList.remove('show'); box.hidden = true; }, 1300);
    const say = () => (p.clip && St.s.settings.voice > 0 ? A.play(p.clip, { onStart: () => { UI.praiseStats.voice.push(Math.round(performance.now() - t0)); } }) : UI.sleep(450));
    const voice = opt.lead ? Promise.resolve(opt.lead()).then(ok => (ok === false ? false : say())) : say();
    return Promise.all([voice, UI.sleep(900)]);
  };
  /* A random unlocked friend jumps up from the bottom edge to cheer. */
  UI.friendsOwned = () => D.FRIENDS.filter(f => St.hasFriend(f));
  UI.cheerFriend = function () {
    const fx = UI.$('#fx');
    if (!fx) return;
    const f = UI.pick(UI.friendsOwned());
    const n = UI.el('div', 'cheer-friend ' + (Math.random() < 0.5 ? 'l' : 'r'), UI.mascot('cheer', {}, f.id));
    fx.appendChild(n);
    setTimeout(() => n.remove(), 1300);
  };
  UI.oops = function (el) {
    A.sfx('wrong');
    if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    UI.buddy('think', 'wiggle');
  };

  /* Confetti burst from a point (or screen centre). */
  const COLORS = ['#FF6F91', '#FFC93C', '#3CC48A', '#6EC6FF', '#B28DFF', '#FF9F43'];
  UI.burst = function (at, n) {
    const fx = UI.$('#fx');
    const x = at ? at.x : innerWidth / 2, y = at ? at.y : innerHeight / 2;
    n = n || 16;
    for (let i = 0; i < n; i++) {
      const s = UI.el('i', 'conf' + (i % 3 === 0 ? ' star' : ''));
      const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 140;
      s.style.left = x + 'px'; s.style.top = y + 'px';
      s.style.background = i % 3 === 0 ? 'none' : COLORS[i % COLORS.length];
      s.style.setProperty('--dx', Math.cos(a) * r + 'px');
      s.style.setProperty('--dy', Math.sin(a) * r - 40 + 'px');
      s.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      if (i % 3 === 0) s.textContent = '★';
      fx.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  };
  UI.pointOf = function (e, el) {
    if (e && e.clientX !== undefined && e.clientX !== 0) return { x: e.clientX, y: e.clientY };
    if (el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return null;
  };
  /* A star flies to the counter. */
  UI.flyStar = function (from) {
    const to = UI.$('#starCount');
    if (!to || !from) return Promise.resolve();
    const r = to.getBoundingClientRect();
    const s = UI.el('i', 'flystar', UI.em('⭐'));
    s.style.left = from.x + 'px'; s.style.top = from.y + 'px';
    UI.$('#fx').appendChild(s);
    const anim = s.animate([
      { transform: 'translate(-50%,-50%) scale(1)' },
      { transform: `translate(${r.left + r.width / 2 - from.x - 20}px, ${r.top + r.height / 2 - from.y - 20}px) scale(.6)` }
    ], { duration: 650, easing: 'cubic-bezier(.5,-0.3,.7,1)' });
    return new Promise(res => { anim.onfinish = () => { s.remove(); A.sfx('star'); res(); }; });
  };

  /* Modal popup for kids (big buttons). Resolves with button value. */
  UI.modal = function (html, buttons, cls) {
    return new Promise(res => {
      const m = UI.el('div', 'modal ' + (cls || ''));
      const card = UI.el('div', 'modal-card scroll', html);
      A.sfx('open');
      const row = UI.el('div', 'modal-btns');
      let done = false;
      const finish = val => { if (done) return; done = true; m.remove(); res(val); };
      const list = buttons || [['좋아!', true]];
      list.forEach(([label, val, c]) => {
        row.appendChild(UI.btn('mbtn ' + (c || ''), label, () => finish(val)));
      });
      card.appendChild(row);
      m.appendChild(card);
      document.body.appendChild(m);
      /* Never let the button fall off a short screen (Safari toolbars): shrink pictures, then text. */
      const fit = () => {
        if (!m.isConnected) return;
        m.classList.remove('compact', 'tiny');
        const lim = innerHeight * 0.94;
        if (card.getBoundingClientRect().height > lim) m.classList.add('compact');
        if (card.getBoundingClientRect().height > lim) m.classList.add('tiny');
      };
      fit();
      requestAnimationFrame(fit);
      setTimeout(fit, 400);
      addEventListener('resize', fit);
      /* A one-button popup (rewards, news) also closes when the child taps anywhere after a moment. */
      if (list.length === 1) {
        const t0 = performance.now();
        UI.tap(m, e => { if (performance.now() - t0 > 900 && !e.target.closest('.mbtn')) { A.sfx('tap'); finish(list[0][1]); } });
      }
    });
  };

  /* Picture card face for a word. */
  /* A word picture: our own drawings (svg:name, v6/img/w) for people, otherwise the outlined emoji picture. */
  UI.picFace = pic => (pic && pic.startsWith('svg:') ? `<img class="em own" src="v6/img/w/${pic.slice(4)}.svg" alt="" draggable="false">` : UI.em(pic || '❓'));
  UI.pic = function (w, cls) {
    const W = D.WORDS[w];
    return `<span class="pic ${cls || ''}" aria-label="${W ? W.w : ''}">${UI.picFace(W && W.pic)}</span>`;
  };
  UI.live = function (t) { const l = UI.$('#live'); if (l) l.textContent = t; };

  G.UI = UI;
})(window);
