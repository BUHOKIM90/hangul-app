'use strict';
/* v6 ui: helpers, 몽글이 SVG, praise, effects, popups. */
(function (G) {
  const D = G.D, A = G.A, St = G.St;
  const UI = {};
  UI.$ = (s, r) => (r || document).querySelector(s);
  UI.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  UI.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
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
    if (fn) UI.tap(b, fn);
    return b;
  };

  /* ---------- 몽글이 ---------- */
  let gid = 0;
  /* Ears go behind the body, extras (muzzle, beak, patches, whiskers) on the face. */
  function animalParts(who, fill, stroke) {
    const sw = `stroke="${stroke}" stroke-width="5"`;
    switch (who) {
      case 'rabbit': return { ears: `<ellipse cx="74" cy="-14" rx="16" ry="40" fill="${fill}" ${sw}/><ellipse cx="126" cy="-14" rx="16" ry="40" fill="${fill}" ${sw}/><ellipse cx="74" cy="-10" rx="7" ry="28" fill="#FFC6DA"/><ellipse cx="126" cy="-10" rx="7" ry="28" fill="#FFC6DA"/>`,
        extra: '<ellipse cx="100" cy="90" rx="6" ry="4.5" fill="#FF8FB8"/><path d="M100 94 v5" stroke="#2C3E6B" stroke-width="3"/>' };
      case 'bear': return { ears: `<circle cx="50" cy="26" r="19" fill="${fill}" ${sw}/><circle cx="150" cy="26" r="19" fill="${fill}" ${sw}/><circle cx="50" cy="26" r="9" fill="#C48E5C"/><circle cx="150" cy="26" r="9" fill="#C48E5C"/>`,
        extra: '<ellipse cx="100" cy="98" rx="20" ry="14" fill="#F5DEC0"/><ellipse cx="100" cy="90" rx="8" ry="5.5" fill="#5A3E2B"/>', belly: '#F5DEC0' };
      case 'cat': return { ears: `<path d="M38 52 L42 0 L82 26Z" fill="${fill}" ${sw} stroke-linejoin="round"/><path d="M162 52 L158 0 L118 26Z" fill="${fill}" ${sw} stroke-linejoin="round"/><path d="M48 36 L50 14 L66 26Z" fill="#FFB3C7"/><path d="M152 36 L150 14 L134 26Z" fill="#FFB3C7"/>`,
        top: '<path d="M78 26 q7 -7 14 0 M108 26 q7 -7 14 0" stroke="#E79A3C" stroke-width="5" fill="none" stroke-linecap="round"/>',
        extra: '<path d="M95 88 h10 l-5 6z" fill="#FF8FB8"/><g stroke="#2C3E6B" stroke-width="2.5" stroke-linecap="round"><path d="M46 88 h-24 M48 96 l-22 6"/><path d="M154 88 h24 M152 96 l22 6"/></g>' };
      case 'chick': return { ears: `<path d="M94 14 C86 -14 104 -14 100 12 C108 -12 124 -6 106 16" fill="${fill}" ${sw} stroke-linejoin="round"/>`,
        extra: '<path d="M88 90 L112 90 L100 104Z" fill="#FF9F43" stroke="#D9762A" stroke-width="3" stroke-linejoin="round"/>', feet: '#FF9F43' };
      case 'panda': return { ears: `<circle cx="48" cy="28" r="19" fill="#3A3A48" ${sw}/><circle cx="152" cy="28" r="19" fill="#3A3A48" ${sw}/>`,
        patch: '<ellipse cx="73" cy="72" rx="17" ry="21" transform="rotate(20 73 72)" fill="#3A3A48"/><ellipse cx="127" cy="72" rx="17" ry="21" transform="rotate(-20 127 72)" fill="#3A3A48"/>',
        extra: '<ellipse cx="100" cy="92" rx="7" ry="5" fill="#3A3A48"/>', limbs: '#3A3A48' };
      case 'puppy': return { ears: '',
        extra: `<path d="M50 20 C18 24 12 92 36 102 C52 94 54 52 64 32Z" fill="#B98B5E" ${sw}/><path d="M150 20 C182 24 188 92 164 102 C148 94 146 52 136 32Z" fill="#B98B5E" ${sw}/><ellipse cx="100" cy="90" rx="9" ry="6.5" fill="#3A2A20"/>`,
        patch: '<ellipse cx="128" cy="58" rx="16" ry="14" fill="#E2C49C" opacity=".8"/>' };
      default: return { ears: '', extra: '' };
    }
  }
  UI.mascot = function (mood, wear, who) {
    wear = wear || St.s.reward.wear || {};
    who = who || St.s.reward.friend || 'mong';
    const F = D.FRIENDS.find(f => f.id === who) || D.FRIENDS[0];
    const id = 'm' + (++gid);
    const body = D.OUTFITS.find(o => o.id === wear.body);
    let fill = body ? body.color : F.color;
    const stroke = F.line;
    let defs = '';
    if (fill === 'rainbow') {
      defs = `<linearGradient id="${id}r" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#FFB3C7"/><stop offset=".3" stop-color="#FFE29A"/><stop offset=".6" stop-color="#B5F0DA"/><stop offset="1" stop-color="#C9B8FF"/></linearGradient>`;
      fill = `url(#${id}r)`;
    }
    const ap = animalParts(who, fill, stroke);
    const back = { back_cape: '<path d="M64 128 L38 244 L162 244 L136 128Z" fill="#FF6B6B" stroke="#C94848" stroke-width="3"/>',
      back_star: '<path d="M64 128 L38 244 L162 244 L136 128Z" fill="#6C7CFF" stroke="#4553C9" stroke-width="3"/><text x="100" y="236" font-size="24" text-anchor="middle">⭐</text>',
      back_wing: '<g fill="#E9F6FF" stroke="#9CC9F0" stroke-width="4"><path d="M64 146 C14 96 -16 176 22 200 C38 210 58 194 64 182Z"/><path d="M136 146 C186 96 216 176 178 200 C162 210 142 194 136 182Z"/></g>' }[wear.back] || '';
    const limb = ap.limbs || fill;
    const arms = mood === 'cheer'
      ? `<ellipse cx="32" cy="124" rx="12" ry="26" transform="rotate(-50 32 124)" fill="${limb}" stroke="${stroke}" stroke-width="4"/><ellipse cx="168" cy="124" rx="12" ry="26" transform="rotate(50 168 124)" fill="${limb}" stroke="${stroke}" stroke-width="4"/>`
      : `<ellipse cx="54" cy="166" rx="12" ry="21" transform="rotate(24 54 166)" fill="${limb}" stroke="${stroke}" stroke-width="4"/><ellipse cx="146" cy="166" rx="12" ry="21" transform="rotate(-24 146 166)" fill="${limb}" stroke="${stroke}" stroke-width="4"/>`;
    /* Big glossy eyes, tiny mouth: drawn in the old face box (eye line y≈110), shifted onto the head below. */
    const eye = (x, r) => `<g class="eye"><ellipse cx="${x}" cy="112" rx="${r}" ry="${r * 1.18}" fill="#2C3E6B"/><circle cx="${x + r * 0.38}" cy="${112 - r * 0.45}" r="${r * 0.42}" fill="#fff"/><circle cx="${x - r * 0.35}" cy="${112 + r * 0.4}" r="${r * 0.18}" fill="#fff"/></g>`;
    let eyes, mouth;
    if (mood === 'joy' || mood === 'cheer') {
      eyes = '<path d="M60 114 Q72 99 84 114 M116 114 Q128 99 140 114" stroke="#2C3E6B" stroke-width="6" fill="none" stroke-linecap="round"/>';
      mouth = '<path d="M86 132 Q100 152 114 132 Z" fill="#FF6F91" stroke="#2C3E6B" stroke-width="3.5" stroke-linejoin="round"/><path d="M93 141 Q100 147 107 141" fill="#FFB3C7"/>';
    } else if (mood === 'wow') {
      eyes = eye(72, 13) + eye(128, 13);
      mouth = '<ellipse cx="100" cy="140" rx="8" ry="10" fill="#FF6F91" stroke="#2C3E6B" stroke-width="3.5"/>';
    } else if (mood === 'think') {
      eyes = eye(72, 10) + eye(128, 10);
      mouth = '<path d="M90 138 Q100 133 110 139" stroke="#2C3E6B" stroke-width="4" fill="none" stroke-linecap="round"/>';
    } else {
      eyes = eye(72, 11.5) + eye(128, 11.5);
      mouth = '<path d="M89 132 q5.5 7 11 0 q5.5 7 11 0" stroke="#2C3E6B" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    const glasses = {
      eyes_round: '<g fill="none" stroke="#5A3E2B" stroke-width="5"><circle cx="75" cy="110" r="19"/><circle cx="125" cy="110" r="19"/><path d="M94 110 h12"/></g>',
      eyes_star: '<g fill="#FFD84D" fill-opacity=".55" stroke="#E0A800" stroke-width="4"><path d="M75 88 l6 14 15 1-11 10 4 15-14-8-14 8 4-15-11-10 15-1z"/><path d="M125 88 l6 14 15 1-11 10 4 15-14-8-14 8 4-15-11-10 15-1z"/></g>',
      eyes_heart: '<g fill="#FF6F91" fill-opacity=".6" stroke="#E0446F" stroke-width="4"><path d="M75 128 l-18-17 a10 10 0 0 1 18-12 a10 10 0 0 1 18 12z"/><path d="M125 128 l-18-17 a10 10 0 0 1 18-12 a10 10 0 0 1 18 12z"/><path d="M93 108 h14" fill="none"/></g>',
      eyes_sun: '<g fill="#2C2C3A" stroke="#111" stroke-width="3"><rect x="54" y="98" width="40" height="24" rx="10"/><rect x="106" y="98" width="40" height="24" rx="10"/><path d="M94 106 h12" fill="none"/></g>'
    }[wear.eyes] || '';
    const neck = {
      neck_bow: '<g fill="#FF5A7A" stroke="#C93A58" stroke-width="3"><path d="M100 172 l-26-14 v28z"/><path d="M100 172 l26-14 v28z"/><circle cx="100" cy="172" r="7"/></g>',
      neck_scarf: '<path d="M50 162 Q100 186 150 162 L150 176 Q100 200 50 176Z" fill="#FF8C42" stroke="#D96A20" stroke-width="3"/><path d="M128 176 l8 30 h-16z" fill="#FF8C42" stroke="#D96A20" stroke-width="3"/>',
      neck_pearl: '<g fill="#fff" stroke="#C8C8D8" stroke-width="2">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<circle cx="${60 + i * 10}" cy="${166 + Math.sin(i / 8 * Math.PI) * 12}" r="5.5"/>`).join('') + '</g>',
      neck_medal: '<path d="M86 150 L100 178 L114 150" fill="none" stroke="#3A7BD5" stroke-width="7"/><circle cx="100" cy="184" r="13" fill="#FFD23F" stroke="#D9A400" stroke-width="3"/><text x="100" y="190" font-size="14" text-anchor="middle" fill="#B07D00">1</text>'
    }[wear.neck] || '';
    const hat = {
      hat_party: '<path d="M100 -6 L72 50 L128 50Z" fill="#FF7EB3" stroke="#D9558A" stroke-width="3"/><circle cx="100" cy="-6" r="8" fill="#FFD84D"/><circle cx="92" cy="30" r="4" fill="#fff"/><circle cx="108" cy="16" r="4" fill="#fff"/>',
      hat_ribbon: '<g fill="#FF5A7A" stroke="#C93A58" stroke-width="3"><path d="M100 36 l-30-18 v36z"/><path d="M100 36 l30-18 v36z"/><circle cx="100" cy="36" r="9"/></g>',
      hat_flower: '<g transform="translate(140 46)">' + [0, 72, 144, 216, 288].map(r => `<ellipse rx="9" ry="14" transform="rotate(${r}) translate(0 -12)" fill="#FFB3D1" stroke="#E97BA8" stroke-width="2"/>`).join('') + '<circle r="8" fill="#FFD84D"/></g>',
      hat_cap: '<path d="M52 52 Q100 -6 148 52Z" fill="#3A7BD5" stroke="#285CA8" stroke-width="3"/><path d="M140 50 Q176 46 184 58 L140 58Z" fill="#285CA8"/>',
      hat_bunny: '<g fill="#fff" stroke="#E2B6C8" stroke-width="4"><ellipse cx="74" cy="12" rx="13" ry="34"/><ellipse cx="126" cy="12" rx="13" ry="34"/></g><g fill="#FFC6DA"><ellipse cx="74" cy="14" rx="6" ry="24"/><ellipse cx="126" cy="14" rx="6" ry="24"/></g>',
      hat_beret: '<ellipse cx="96" cy="40" rx="52" ry="20" fill="#E04E5F" stroke="#B23443" stroke-width="3"/><circle cx="96" cy="20" r="6" fill="#B23443"/>',
      hat_chef: '<path d="M64 50 V30 Q58 6 82 10 Q92 -6 110 6 Q136 0 138 24 V50Z" fill="#fff" stroke="#BBC4D6" stroke-width="4"/>',
      hat_wizard: '<path d="M100 -18 L64 50 L136 50Z" fill="#6A4FD8" stroke="#4A35A8" stroke-width="3"/><ellipse cx="100" cy="50" rx="48" ry="9" fill="#4A35A8"/><text x="100" y="36" font-size="18" text-anchor="middle">⭐</text>',
      hat_crown: '<path d="M62 52 L66 14 L84 34 L100 6 L116 34 L134 14 L138 52Z" fill="#FFD23F" stroke="#D9A400" stroke-width="4" stroke-linejoin="round"/><circle cx="100" cy="38" r="6" fill="#FF5A7A"/>'
    }[wear.hat] || '';
    const head = who === 'mong'
      ? `<path transform="translate(100 74) scale(.78 .69) translate(-100 -108)" vector-effect="non-scaling-stroke" d="M100 34 C120 18 150 26 156 46 C182 56 186 92 176 112 C190 140 172 184 136 190 C116 198 84 198 64 190 C28 184 10 140 24 112 C14 92 18 56 44 46 C50 26 80 18 100 34Z" fill="${fill}" stroke="${stroke}" stroke-width="4.5"/>`
      : `<ellipse cx="100" cy="74" rx="70" ry="62" fill="${fill}" stroke="${stroke}" stroke-width="4.5"/>`;
    const feet = ap.feet || ap.limbs || fill;
    return `<svg class="mascot-svg" viewBox="0 -56 200 312" aria-hidden="true"><defs>${defs}</defs>${back}
      <g transform="translate(0 4)">${ap.ears}</g>
      <ellipse cx="78" cy="242" rx="19" ry="11" fill="${feet}" stroke="${stroke}" stroke-width="4"/><ellipse cx="122" cy="242" rx="19" ry="11" fill="${feet}" stroke="${stroke}" stroke-width="4"/>
      <path d="M68 124 C44 160 44 230 80 238 L120 238 C156 230 156 160 132 124 Z" fill="${fill}" stroke="${stroke}" stroke-width="4.5" stroke-linejoin="round"/>
      <ellipse cx="100" cy="190" rx="27" ry="31" fill="${ap.belly || '#fff'}" opacity="${ap.belly ? 1 : 0.55}"/>
      ${arms}${head}
      <ellipse cx="72" cy="38" rx="20" ry="11" transform="rotate(-25 72 38)" fill="#fff" opacity=".45"/>
      <g transform="translate(0 4)">${ap.top || ''}</g>
      <g transform="translate(0 -34)"><ellipse cx="56" cy="134" rx="14" ry="9" fill="#FF8FB0" opacity=".5"/><ellipse cx="144" cy="134" rx="14" ry="9" fill="#FF8FB0" opacity=".5"/></g>
      <g transform="translate(0 4)">${ap.patch || ''}</g><g class="eyes" transform="translate(0 -38)">${eyes}</g><g transform="translate(0 4)">${ap.extra}</g><g transform="translate(0 -34)">${mouth}</g>
      <g transform="translate(0 -36)">${glasses}</g><g transform="translate(0 -32)">${neck}</g><g transform="translate(0 -20)">${hat}</g></svg>`;
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
  UI.friendsOwned = () => D.FRIENDS.filter(f => f.lv <= St.s.reward.level);
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
    const s = UI.el('i', 'flystar', '⭐');
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
      const card = UI.el('div', 'modal-card', html);
      const row = UI.el('div', 'modal-btns');
      (buttons || [['좋아!', true]]).forEach(([label, val, c]) => {
        row.appendChild(UI.btn('mbtn ' + (c || ''), label, () => { m.remove(); res(val); }));
      });
      card.appendChild(row);
      m.appendChild(card);
      document.body.appendChild(m);
    });
  };

  /* Picture card face for a word. */
  UI.pic = function (w, cls) {
    const W = D.WORDS[w];
    return `<span class="pic ${cls || ''}" aria-label="${W ? W.w : ''}">${W && W.pic ? W.pic : '❓'}</span>`;
  };
  UI.live = function (t) { const l = UI.$('#live'); if (l) l.textContent = t; };

  G.UI = UI;
})(window);
