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

  /* Fast tap: fires on pointerdown (no click delay), one fire per 280 ms per element.
     last starts at -Infinity: performance.now() is 0 at page load, so `last = 0` dropped every first tap in the first 280 ms. */
  UI.tap = function (el, fn) {
    let last = -Infinity;
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
      back_butterfly: `<g ${sw}><path d="M70 214 C24 168 6 214 30 236 C42 246 60 236 70 226Z" fill="#FF9DC4"/><path d="M130 214 C176 168 194 214 170 236 C158 246 140 236 130 226Z" fill="#FF9DC4"/><path d="M68 230 C34 240 34 268 54 268 C64 268 70 254 72 240Z" fill="#B9A6FF"/><path d="M132 230 C166 240 166 268 146 268 C136 268 130 254 128 240Z" fill="#B9A6FF"/></g><circle cx="40" cy="214" r="6" fill="#fff" opacity=".8"/><circle cx="160" cy="214" r="6" fill="#fff" opacity=".8"/>`,
      back_rainbow: `<path d="M64 200 L36 272 L164 272 L136 200Z" fill="#FF8FA8"/><path d="M59 212 L141 212 L147 228 L53 228Z" fill="#FFD36E"/><path d="M51 232 L149 232 L155 248 L45 248Z" fill="#8FE0B4"/><path d="M43 252 L157 252 L163 268 L37 268Z" fill="#8CC8FF"/><path d="M64 200 L36 272 L164 272 L136 200Z" fill="none" ${sw}/>`,
      back_pink: `<path d="M64 200 L38 272 L162 272 L136 200Z" fill="#FFB3D1" ${sw}/><path d="M100 206 L100 266" stroke="#F58BB4" stroke-width="3"/><path d="M70 259 l-7 -6.6 a3.9 3.9 0 0 1 7 -4.9 a3.9 3.9 0 0 1 7 4.9z" fill="#fff" opacity=".8"/><path d="M132 252 l-6 -5.7 a3.4 3.4 0 0 1 6 -4.2 a3.4 3.4 0 0 1 6 4.2z" fill="#fff" opacity=".8"/>`,
      back_cape: `<path d="M64 200 L38 272 L162 272 L136 200Z" fill="#FF6B7A" ${sw}/><path d="M100 206 L100 266" stroke="#E04E5F" stroke-width="3"/>`,
      back_star: `<path d="M64 200 L38 272 L162 272 L136 200Z" fill="#7C8CFF" ${sw}/><path d="M60 252 l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z M140 236 l3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1z" fill="#FFE066"/>`,
      back_wing: `<g fill="#F4FBFF" ${sw}><path d="M66 214 C20 172 0 236 34 250 C48 256 62 240 68 230Z"/><path d="M134 214 C180 172 200 236 166 250 C152 256 138 240 132 230Z"/></g><path d="M40 222 q10 4 16 12 M160 222 q-10 4 -16 12" stroke="#B9DDF7" stroke-width="3" fill="none"/>`
    },
    neck: {
      neck_lei: '<g stroke="#4B3642" stroke-width="2.2">' + [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<circle cx="${66 + i * 9.7}" cy="${200 + Math.sin(i / 7 * Math.PI) * 12}" r="6.4" fill="${['#FF8FB0', '#FFE066', '#B5F0DA', '#C9B8FF'][i % 4]}"/>`).join('') + '</g>',
      neck_star: `<path d="M78 198 Q100 216 122 198" fill="none" stroke="#E0A800" stroke-width="3"/><path d="M100 210 l3.5 7.2 7.9 1.2 -5.8 5.5 1.4 7.9 -7.1 -3.7 -7.1 3.7 1.4 -7.9 -5.8 -5.5 7.9 -1.2z" fill="#FFE066" stroke="#4B3642" stroke-width="3.4" stroke-linejoin="round"/>`,
      neck_bow: `<g fill="#FF5A7A" ${sw}><path d="M100 204 l-20 -11 v22z"/><path d="M100 204 l20 -11 v22z"/><circle cx="100" cy="204" r="6"/></g>`,
      neck_scarf: `<path d="M60 196 Q100 214 140 196 L142 210 Q100 228 58 210Z" fill="#FF9548" ${sw}/><path d="M122 212 l6 26 h-16z" fill="#FF9548" ${sw}/>`,
      neck_pearl: '<g fill="#fff" stroke="#C8C0D8" stroke-width="2">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<circle cx="${68 + i * 8}" cy="${200 + Math.sin(i / 8 * Math.PI) * 9}" r="4.6"/>`).join('') + '</g>',
      neck_medal: `<path d="M86 196 L100 218 L114 196" fill="none" stroke="#3A7BD5" stroke-width="6"/><circle cx="118" cy="222" r="0"/><circle cx="100" cy="224" r="11" fill="#FFD23F" ${sw}/><text x="100" y="229" font-size="13" font-weight="900" text-anchor="middle" fill="#B07D00">1</text>`
    },
    eyes: {
      eyes_rainbow: '<g fill="none" stroke-width="3.2">' + [74, 126].map(x => `<circle cx="${x}" cy="160" r="17" stroke="#FF6F91"/><circle cx="${x}" cy="160" r="13.6" stroke="#FFC93C"/><circle cx="${x}" cy="160" r="10.2" stroke="#5FBDF5" opacity=".8"/>`).join('') + '<path d="M91 158 h18" stroke="#4B3642"/></g>',
      eyes_goggle: `<path d="M40 156 Q100 140 160 156" fill="none" stroke="#7A5C4A" stroke-width="7"/><g fill="#BFE8FF" fill-opacity=".75" ${sw}><rect x="54" y="144" width="40" height="30" rx="14"/><rect x="106" y="144" width="40" height="30" rx="14"/></g><path d="M94 158 h12" stroke="#4B3642" stroke-width="4"/><path d="M62 152 l8 -3 M114 152 l8 -3" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
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
      hat_tiara: `<path d="M72 102 L78 78 L90 92 L100 70 L110 92 L122 78 L128 102Z" fill="#EEF4FF" ${sw}/><circle cx="100" cy="88" r="6" fill="#FF7EB3" ${sw}/><circle cx="80" cy="94" r="3.4" fill="#7FD9F2"/><circle cx="120" cy="94" r="3.4" fill="#7FD9F2"/>`,
      hat_band: `<path d="M50 118 Q100 70 150 118" fill="none" stroke="#4B3642" stroke-width="12" stroke-linecap="round"/><path d="M50 118 Q100 70 150 118" fill="none" stroke="#FF8FB0" stroke-width="7" stroke-linecap="round"/><g fill="#FF5A7A" ${sw}><path d="M132 92 l-18 -10 v20z"/><path d="M132 92 l18 -10 v20z"/><circle cx="132" cy="92" r="6"/></g>`,
      hat_sun: '<g transform="translate(54 112)">' + [0, 45, 90, 135, 180, 225, 270, 315].map(r => `<ellipse rx="6" ry="11" transform="rotate(${r}) translate(0 -12)" fill="#FFD23F" stroke="#4B3642" stroke-width="2.4"/>`).join('') + '<circle r="9" fill="#8B5A2B" stroke="#4B3642" stroke-width="2.6"/></g>',
      hat_pirate: `<path d="M48 106 Q62 56 100 54 Q138 56 152 106 Q100 88 48 106Z" fill="#3A3346" ${sw}/><circle cx="100" cy="80" r="8" fill="#fff"/><path d="M90 92 l20 -6 M90 86 l20 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M52 104 Q100 86 148 104" fill="none" stroke="#FFD23F" stroke-width="3"/>`,
      hat_whale: `<path d="M136 80 L160 62 L158 82 L162 98Z" fill="#3877CB" ${sw}/><path d="M56 100 C56 66 90 56 112 60 C136 64 146 82 140 100Z" fill="#5A9BE6" ${sw}/><path d="M62 97 C80 92 120 92 138 97" fill="none" stroke="#EDF6FF" stroke-width="4"/><circle cx="76" cy="80" r="4" fill="#4B3642"/><path d="M90 58 q-6 -14 -14 -12 M90 58 q2 -16 10 -16 M90 58 q8 -10 16 -6" fill="none" stroke="#7FC7EE" stroke-width="4" stroke-linecap="round"/>`,
      hat_crown: `<path d="M68 106 L70 70 L86 88 L100 60 L114 88 L130 70 L132 106Z" fill="#FFD95A" ${sw}/><circle cx="100" cy="92" r="5.4" fill="#FF5A7A" ${sw}/>`
    }
  };
  /* R3 §6: things held in the right hand (prop) and sparkle effects around the friend (fx; FXB = drawn behind the friend). */
  function twS(x, y, r, c) { return `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z" fill="${c || '#FFE066'}"/>`; }
  function heartS(x, y, r) { return `<path d="M${x} ${y + r} l-${r} -${r * 0.95} a${r * 0.56} ${r * 0.56} 0 0 1 ${r} -${r * 0.7} a${r * 0.56} ${r * 0.56} 0 0 1 ${r} ${r * 0.7}z" fill="#FF8FB0" stroke="#E0446F" stroke-width="1.6"/>`; }
  const PROP = {
    prop_wand: `<path d="M144 238 L170 178" stroke="#4B3642" stroke-width="9" stroke-linecap="round"/><path d="M144 238 L170 178" stroke="#C99B6D" stroke-width="5" stroke-linecap="round"/><g class="fx-tw"><path d="M172 155 l4.3 9.0 9.9 1.5 -7.2 6.9 1.8 9.9 -8.8 -4.7 -8.8 4.7 1.8 -9.9 -7.2 -6.9 9.9 -1.5z" fill="#FFE066" stroke="#4B3642" stroke-width="3.4" stroke-linejoin="round"/></g><g class="fx-tw d2"><path d="M190 143 Q190 150 197 150 Q190 150 190 157 Q190 150 183 150 Q190 150 190 143Z" fill="#FFE066"/><path d="M152 149 Q152 154 157 154 Q152 154 152 159 Q152 154 147 154 Q152 154 152 149Z" fill="#FFF5B8"/></g>`,
    prop_star: `<path d="M144 238 L166 172" stroke="#4B3642" stroke-width="9" stroke-linecap="round"/><path d="M144 238 L166 172" stroke="#FF8FB0" stroke-width="5" stroke-linecap="round"/><g class="fx-tw"><path d="M168 138 l6.4 13.2 14.5 2.2 -10.6 10.1 2.6 14.5 -13.0 -6.8 -13.0 6.8 2.6 -14.5 -10.6 -10.1 14.5 -2.2z" fill="#FFD23F" stroke="#4B3642" stroke-width="3.4" stroke-linejoin="round"/></g><circle cx="162" cy="154" r="3.6" fill="#fff"/>`,
    prop_heart: `<path d="M144 238 L166 176" stroke="#4B3642" stroke-width="9" stroke-linecap="round"/><path d="M144 238 L166 176" stroke="#FFE7A6" stroke-width="5" stroke-linecap="round"/><g class="fx-tw"><path d="M168 176 l-16 -15.2 a9.0 9.0 0 0 1 16 -11.2 a9.0 9.0 0 0 1 16 11.2z" fill="#FF6F91" stroke="#4B3642" stroke-width="3.4" stroke-linejoin="round"/></g><g class="fx-tw d2"><path d="M192 142 Q192 148 198 148 Q192 148 192 154 Q192 148 186 148 Q192 148 192 142Z" fill="#FFE066"/></g>`,
    prop_balloon: `<path d="M144 236 C158 214 150 184 166 156" fill="none" stroke="#4B3642" stroke-width="2.6"/><g class="fx-bob"><ellipse cx="168" cy="126" rx="22" ry="27" fill="#FF6F91" stroke="#4B3642" stroke-width="3.6"/><path d="M164 154 l4 -4 4 4z" fill="#FF6F91" stroke="#4B3642" stroke-width="2.4"/><ellipse cx="160" cy="116" rx="5" ry="9" fill="#fff" opacity=".6"/></g>`,
    prop_bouquet: `<path d="M136 244 L150 206 L170 214Z" fill="#B5F0DA" stroke="#4B3642" stroke-width="3.4" stroke-linejoin="round"/>` + [[150, 200, '#FF8FB0'], [166, 204, '#FFE066'], [158, 188, '#C9B8FF'], [174, 190, '#FF9548']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}" stroke="#4B3642" stroke-width="2.6"/><circle cx="${x}" cy="${y}" r="3" fill="#fff" opacity=".8"/>`).join(''),
    prop_umbrella: `<path d="M146 238 L158 104" stroke="#4B3642" stroke-width="5" stroke-linecap="round"/><path d="M146 238 q-2 8 -10 6" fill="none" stroke="#4B3642" stroke-width="5" stroke-linecap="round"/><path d="M106 104 A52 44 0 0 1 210 104Z" fill="#FF8FA8"/><path d="M123 104 A35 32 0 0 1 193 104Z" fill="#FFD36E"/><path d="M140 104 A18 20 0 0 1 176 104Z" fill="#8CC8FF"/><path d="M106 104 A52 44 0 0 1 210 104Z" fill="none" stroke="#4B3642" stroke-width="3.6"/>`,
    prop_lolly: `<path d="M144 238 L162 192" stroke="#4B3642" stroke-width="8" stroke-linecap="round"/><path d="M144 238 L162 192" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/><circle cx="166" cy="176" r="19" fill="#FFB3D1" stroke="#4B3642" stroke-width="3.6"/><path d="M154 176 a12 12 0 1 1 12 12 a8 8 0 1 1 -8 -8 a4 4 0 1 1 4 4" fill="none" stroke="#FF5A8A" stroke-width="3.4" stroke-linecap="round"/>`,
    prop_teddy: `<g stroke="#4B3642" stroke-width="3" stroke-linejoin="round"><circle cx="152" cy="208" r="7" fill="#C9935F"/><circle cx="178" cy="208" r="7" fill="#C9935F"/><ellipse cx="165" cy="246" rx="17" ry="18" fill="#C9935F"/><circle cx="165" cy="220" r="15" fill="#C9935F"/></g><ellipse cx="165" cy="225" rx="6" ry="4.4" fill="#F3D2A8"/><circle cx="160" cy="217" r="2" fill="#4B3642"/><circle cx="170" cy="217" r="2" fill="#4B3642"/><path d="M163 225 h4" stroke="#4B3642" stroke-width="2.4" stroke-linecap="round"/>`
  };
  const FX = {
    fx_sparkle: [[26, 110, 9], [176, 96, 7], [184, 214, 8], [18, 216, 6], [100, 40, 7], [150, 270, 6]].map(([x, y, r], i) => `<g class="fx-tw d${i % 3}">${twS(x, y, r)}</g>`).join(''),
    fx_hearts: [[30, 250, 8], [168, 236, 7], [46, 180, 6], [178, 170, 6]].map(([x, y, r], i) => `<g class="fx-up d${i % 3}">${heartS(x, y, r)}</g>`).join(''),
    fx_stardust: Array.from({ length: 14 }, (_, i) => `<circle class="fx-fall d${i % 3}" cx="${16 + (i * 53) % 172}" cy="${40 + (i * 37) % 120}" r="${2 + (i % 3)}" fill="${i % 2 ? '#FFE066' : '#FFF5B8'}" stroke="#E0A800" stroke-width=".8"/>`).join(''),
    fx_bubbles: [[28, 230, 9], [172, 220, 11], [40, 160, 7], [162, 150, 6], [100, 30, 6]].map(([x, y, r], i) => `<g class="fx-up d${i % 3}"><circle cx="${x}" cy="${y}" r="${r}" fill="#DDF4FF" fill-opacity=".45" stroke="#7FC7EE" stroke-width="2.4"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.25}" fill="#fff"/></g>`).join('')
  };
  const FXB = {
    fx_rainbow: `<g class="fx-glow" fill="none" stroke-width="9" stroke-linecap="round" opacity=".75"><path d="M10 214 A90 116 0 0 1 190 214" stroke="#FF8FA8"/><path d="M20 214 A80 104 0 0 1 180 214" stroke="#FFD36E"/><path d="M30 214 A70 92 0 0 1 170 214" stroke="#8FE0B4"/><path d="M40 214 A60 80 0 0 1 160 214" stroke="#8CC8FF"/></g>`
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
    let svg = window.CHF.draw(who, mood || 'happy', wear, out);
    const front = (PROP[wear.prop] || '') + (FX[wear.fx] || '');
    if (front) svg = svg.replace(/<\/g><\/svg>$/, front + '</g></svg>');
    if (FXB[wear.fx]) svg = svg.replace('<g transform="translate(0 6)">', '<g transform="translate(0 6)">' + FXB[wear.fx]);
    return svg;
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
    /* always fits the screen width (phones): size by length, wrap if still needed */
    box.style.fontSize = `min(11.5vmin, ${Math.max(6, Math.floor(84 / Math.max(4, p.text.length + 1)))}vw)`;
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
  /* Confetti falling over the whole screen (a stage is finished). */
  UI.rain = function (n) {
    const fx = UI.$('#fx');
    if (!fx) return;
    for (let i = 0; i < (n || 46); i++) {
      const s = UI.el('i', 'rainc' + (i % 4 === 0 ? ' star' : ''));
      s.style.left = Math.random() * 100 + 'vw';
      s.style.background = i % 4 === 0 ? 'none' : COLORS[i % COLORS.length];
      s.style.animationDelay = Math.random() * 0.9 + 's';
      s.style.animationDuration = 1.6 + Math.random() * 1.2 + 's';
      s.style.setProperty('--sx', (Math.random() * 30 - 15) + 'vw');
      if (i % 4 === 0) s.textContent = '★';
      fx.appendChild(s);
      setTimeout(() => s.remove(), 3800);
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
  UI.picFace = pic => (pic && pic.startsWith('svg:') ? `<img class="em own" src="v6/img/w/${pic.slice(4)}.svg" alt="" draggable="false">`
    : pic && pic.startsWith('img:') ? `<img class="em own" src="v6/img/p/${pic.slice(4)}.webp" alt="" draggable="false">` : UI.em(pic || '❓'));
  /* family drawings are fetched ahead so a card never shows up empty the first time */
  ['eomma', 'appa', 'halmeoni', 'harabeoji', 'agi', 'nuna', 'ryeowon', 'ai', 'eobu'].forEach(n => { const i = new Image(); i.src = 'v6/img/w/' + n + '.svg'; });
  UI.pic = function (w, cls) {
    const W = D.WORDS[w];
    return `<span class="pic ${cls || ''}" aria-label="${W ? W.w : ''}">${UI.picFace(W && W.pic)}</span>`;
  };
  /* Picture with its word written underneath (so the child always sees the letters with the picture). */
  UI.picW = function (w, cls) {
    const W = D.WORDS[w];
    return `<span class="picw ${cls || ''}">${UI.pic(w)}<b class="cap">${W ? UI.esc(W.w) : ''}</b></span>`;
  };
  UI.live = function (t) { const l = UI.$('#live'); if (l) l.textContent = t; };

  G.UI = UI;
})(window);
