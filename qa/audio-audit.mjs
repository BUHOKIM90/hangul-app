/* Audio and control audit. Headless Chrome, user-gesture autoplay, touch viewports. */
import pw from '/tmp/pw/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;

const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
const PLAYS = ['chant', 'listen', 'sparkle', 'blocks', 'match', 'memory', 'trace', 'treasure'];
const DIFFS = ['easy', 'mid', 'hard'];
const rows = [];
const notes = [];

function keyOf(src) {
  const m = String(src || '').match(/audio\/([^/?#]+)\.mp3/);
  return m ? m[1] : '';
}
function alias(key) { return key === 'w_i_tooth' ? 'sy_C774' : key; }
function sameSet(expect, got) {
  const e = expect.map(alias);
  const g = got.map(alias);
  return e.length === g.length && e.every(k => g.indexOf(k) >= 0) && g.every(k => e.indexOf(k) >= 0);
}
function add(row) {
  rows.push(row);
  if (!row.ok) notes.push(row.vp + ' L' + row.lesson + ' ' + row.diff + ' ' + row.play + ' ' + row.action + ' expect ' + JSON.stringify(row.expect) + ' got ' + JSON.stringify(row.got) + (row.note ? ' ' + row.note : ''));
}

async function tap(page, sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 6000 });
  await loc.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'center' }));
  const box = await loc.boundingBox();
  if (!box || box.width < 2 || box.height < 2) throw new Error('no box ' + sel);
  const before = await page.evaluate(() => document.body.innerText);
  await page.touchscreen.tap(box.x + Math.min(box.width / 2, 24), box.y + Math.min(box.height / 2, 24));
  await page.waitForTimeout(180);
  const after = await page.evaluate(() => document.body.innerText);
  return before !== after;
}
async function markOf(page) {
  return page.evaluate(() => (window.__audioPlays || []).length);
}
async function since(page, mark) {
  const list = await page.evaluate(m => (window.__audioPlays || []).slice(m), mark);
  return [...new Set(list.filter(p => p.started).map(p => keyOf(p.src || p.assigned)).filter(Boolean))];
}
async function sinceSoon(page, mark, ms) {
  const end = Date.now() + ms;
  let got = [];
  while (Date.now() <= end) {
    got = await since(page, mark);
    if (got.length) return got;
    await page.waitForTimeout(150);
  }
  return got;
}
async function screenExpect(page) {
  return page.evaluate(() => {
    const play = document.querySelector('#main').dataset.play || '';
    const prompt = (document.querySelector('h1.prompt') || {}).textContent || '';
    const bubble = (document.querySelector('#bubble') || {}).textContent || '';
    const lit = document.querySelector('.ctile.is-lit');
    const ok = document.querySelector('#stage [data-ok="1"]');
    const keys = [];
    const hero = document.querySelector('.hero-pic img, .goal-pic img');
    const heroId = hero && ((hero.getAttribute('src') || '').match(/pic\/([^./]+)\.webp/) || [])[1];
    if (play === 'trace') return { play, prompt, bubble, keys };
    if (play === 'chant' && lit) keys.push(lit.dataset.audio);
    else if (play === 'memory') keys.push(V5C.UI.match);
    else if (play === 'blocks' && heroId) {
      const cho = document.querySelector('[data-kind="cho"][data-ok="1"]');
      const g = cho ? cho.getAttribute('aria-label') : '';
      const lesson = V5C.LESSONS.find(l => l.blocks.word === heroId && l.blocks.c === g);
      if (lesson) keys.push(V5C.sylKey(lesson.blocks.say));
    } else if (prompt === '처음 소리를 골라' && heroId) keys.push(V5C.wordKey(heroId));
    else if (ok) {
      const label = ok.getAttribute('aria-label') || '';
      if (V5C.JAMO[label]) keys.push(V5C.jamoKey(label));
      else if (label === '그림') {
        const src = (ok.querySelector('img') && ok.querySelector('img').getAttribute('src')) || '';
        const m = src.match(/pic\/([^./]+)\.webp/);
        if (m) keys.push(V5C.wordKey(m[1]));
      } else {
        const id = Object.keys(V5C.WORDS).find(k => V5C.WORDS[k][0] === label);
        if (id) keys.push(V5C.wordKey(id));
      }
    }
    return { play, prompt, bubble, keys, lit: lit ? lit.getAttribute('aria-label') : '' };
  });
}
async function dragTrace(page) {
  for (let guard = 0; guard < 8; guard++) {
    if (await page.locator('[data-tap="play-next"]').count()) return true;
    const pts = await page.evaluate(() => {
      const svg = document.querySelector('.trace-board svg');
      if (!svg) return null;
      const guide = JSON.parse(svg.getAttribute('data-guide') || '[]');
      if (guide.length < 2) return [];
      const box = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const out = [];
      guide.forEach(p => {
        const x = box.x + ((p[0] - vb.x) / vb.width) * box.width;
        const y = box.y + ((p[1] - vb.y) / vb.height) * box.height;
        const prev = out[out.length - 1];
        if (!prev) { out.push({ x, y }); return; }
        const n = Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 3));
        for (let k = 1; k <= n; k++) out.push({ x: prev.x + (x - prev.x) * k / n, y: prev.y + (y - prev.y) * k / n });
      });
      return out;
    });
    if (!pts || pts.length < 2) return false;
    const cdp = await page.context().newCDPSession(page);
    const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }]
    });
    await send('touchStart', pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 2) await send('touchMove', pts[i].x, pts[i].y);
    await send('touchMove', pts[pts.length - 1].x, pts[pts.length - 1].y);
    await send('touchEnd', 0, 0);
    await page.waitForTimeout(40);
  }
  return (await page.locator('[data-tap="play-next"]').count()) > 0;
}
async function openPlay(page, lesson, diff, play) {
  await page.evaluate(({ lesson, diff }) => {
    const S = V5X.S;
    S.difficulty = diff;
    S.sound = true;
    S.colorHints = true;
    S.done = {};
    for (let i = 1; i < lesson; i++) S.done[i] = '2020-01-01';
    V5X.save();
  }, { lesson, diff });
  if (await page.getAttribute('#main', 'data-screen') !== 'map') {
    if (await page.locator('[data-tap="go-map"]').count()) await tap(page, '[data-tap="go-map"]');
    else if (await page.locator('#homeBtn:not([hidden])').count()) {
      await tap(page, '#homeBtn');
      await tap(page, '[data-tap="go-map"]');
    }
  }
  const m = await markOf(page);
  await tap(page, '[data-tap="practice"][data-play="' + play + '"]');
  await page.waitForSelector('#main[data-play="' + play + '"]', { timeout: 5000 });
  await page.waitForTimeout(220);
  return { got: await since(page, m), expect: await screenExpect(page) };
}

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required']
});
const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'ipad', width: 820, height: 1180 }
];

for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const errors = [];
  const missing = [];
  page.on('pageerror', err => errors.push(String(err)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('response', res => { if (res.status() === 404) missing.push(res.url()); });
  await page.addInitScript(() => {
    window.__audioPlays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const el = this;
      const push = (started, via) => window.__audioPlays.push({ src: el.currentSrc || el.src || '', started: !!started, via });
      el.addEventListener('playing', () => push(true, 'playing'), { once: true });
      const p = orig.call(el);
      if (p && p.then) {
        p.then(() => push(true, 'resolved')).catch(() => push(false, 'rejected'));
      } else push(!el.paused, 'sync');
      return p;
    };
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('html[data-ready="1"]');
  const helloMark = await markOf(page);
  const helloMoved = await tap(page, '[data-tap="go-map"]');
  await page.waitForTimeout(250);
  const hello = await since(page, helloMark);
  add({ vp: vp.name, lesson: 0, diff: '', play: 'home', action: '놀자', expect: ['ui_hello'], got: hello, ok: hello.indexOf('ui_hello') >= 0 && helloMoved, note: '' });

  if (await page.locator('.stone-btn.is-soon').count()) {
    const moved = await tap(page, '.stone-btn.is-soon');
    const lock = await page.locator('.map-lock').innerText().catch(() => '');
    add({ vp: vp.name, lesson: 0, diff: '', play: 'map', action: 'locked-stone', expect: ['잠겨'], got: [lock], ok: moved && lock.indexOf('잠겨') >= 0, note: '' });
  }
  await tap(page, '#homeBtn');
  const stickMoved = await tap(page, '[data-tap="stickers"]');
  const stickerScreen = await page.getAttribute('#main', 'data-screen');
  add({ vp: vp.name, lesson: 0, diff: '', play: 'stickers', action: 'open', expect: ['stickers'], got: [stickerScreen], ok: stickMoved && stickerScreen === 'stickers', note: '' });
  await tap(page, '#homeBtn');
  const dressMoved = await tap(page, '[data-tap="dress"]');
  const dressScreen = await page.getAttribute('#main', 'data-screen');
  add({ vp: vp.name, lesson: 0, diff: '', play: 'dress', action: 'open', expect: ['dress'], got: [dressScreen], ok: dressMoved && dressScreen === 'dress', note: '' });
  if (await page.locator('[data-tap="who"]').count()) {
    const who = await page.locator('[data-tap="who"]').first().getAttribute('data-who');
    await tap(page, '[data-tap="who"]');
    const now = await page.locator('.who.is-on').getAttribute('data-who').catch(() => '');
    add({ vp: vp.name, lesson: 0, diff: '', play: 'dress', action: 'who', expect: [who], got: [now], ok: now === who, note: '' });
  }
  await tap(page, '#homeBtn');
  await tap(page, '[data-tap="adult"]');
  const sum = await page.locator('.sum-line').innerText();
  const m = sum.match(/(\d+)\s*\+\s*(\d+)/);
  const ans = String((+m[1]) + (+m[2]));
  for (const ch of ans) await tap(page, '[data-tap="gate-key"][data-n="' + ch + '"]');
  await page.waitForSelector('#parent:not([hidden])', { timeout: 4000 });
  const adult = await page.locator('#parent h1').innerText();
  add({ vp: vp.name, lesson: 0, diff: '', play: 'adult', action: 'gate', expect: ['어른 메뉴'], got: [adult], ok: adult.indexOf('어른') >= 0, note: '' });
  const hear = page.locator('[data-tap="hear"]').first();
  const j = await hear.getAttribute('data-j');
  const hm = await markOf(page);
  await tap(page, '[data-tap="hear"]');
  const heard = await since(page, hm);
  const want = await page.evaluate(g => V5C.jamoKey(g), j);
  add({ vp: vp.name, lesson: 0, diff: '', play: 'adult', action: 'hear ' + j, expect: [want], got: heard, ok: heard.indexOf(want) >= 0, note: '' });
  await tap(page, '[data-tap="close-parent"]');
  await tap(page, '[data-tap="go-map"]');

  for (const diff of DIFFS) {
    for (let lesson = 1; lesson <= 8; lesson++) {
      for (const play of PLAYS) {
        let opened;
        try {
          opened = await openPlay(page, lesson, diff, play);
        } catch (err) {
          add({ vp: vp.name, lesson, diff, play, action: 'open', expect: [], got: [], ok: false, note: String(err.message || err) });
          continue;
        }
        const expectKeys = opened.expect.keys || [];
        const entryOk = expectKeys.length ? sameSet(expectKeys, opened.got) : opened.got.length === 0;
        add({ vp: vp.name, lesson, diff, play, action: 'enter ' + (opened.expect.prompt || opened.expect.lit || ''), expect: expectKeys, got: opened.got, ok: entryOk, note: opened.expect.bubble || '' });
        try {
          if (play === 'chant') {
            let wrong = false;
            for (let n = 0; n < 6; n++) {
              const lit = await page.evaluate(() => {
                const el = document.querySelector('.ctile.is-lit');
                return el ? { audio: el.dataset.audio, label: el.getAttribute('aria-label') } : null;
              });
              if (!lit) break;
              const m0 = await markOf(page);
              if (!wrong && await page.locator('.ctile:not(.is-lit)').count()) {
                wrong = true;
                await tap(page, '.ctile:not(.is-lit)');
              } else await tap(page, '.ctile.is-lit');
              const got = await sinceSoon(page, m0, 500);
              add({ vp: vp.name, lesson, diff, play, action: (wrong && n === 0 ? 'wrong ' : 'tile ') + lit.label, expect: [lit.audio], got, ok: got.length === 1 && got[0] === lit.audio, note: '' });
              if (wrong && n === 0) wrong = 'done';
            }
          } else if (play === 'trace') {
            const prompt = await page.locator('h1.prompt').innerText();
            const touch = await page.evaluate(() => getComputedStyle(document.querySelector('.trace-board')).touchAction);
            const width = await page.evaluate(() => Math.round(document.querySelector('.trace-board').getBoundingClientRect().width));
            const spot = await page.evaluate(() => {
              const svg = document.querySelector('.trace-board svg');
              const guide = JSON.parse(svg.getAttribute('data-guide') || '[]');
              const box = svg.getBoundingClientRect();
              const vb = svg.viewBox.baseVal;
              const p = guide[0] || [50, 50];
              return { x: box.x + ((p[0] - vb.x) / vb.width) * box.width, y: box.y + ((p[1] - vb.y) / vb.height) * box.height };
            });
            await page.touchscreen.tap(spot.x, spot.y);
            await page.waitForTimeout(80);
            const tapFinished = await page.locator('[data-tap="play-next"]').count();
            add({ vp: vp.name, lesson, diff, play, action: 'tap-only', expect: ['no-next'], got: [tapFinished ? 'next' : 'stay', 'w' + width, touch], ok: tapFinished === 0 && touch === 'none' && prompt === '분홍 선을 따라 손가락으로 써 볼까', note: '' });
            const m0 = await markOf(page);
            const done = await dragTrace(page);
            const got = await since(page, m0);
            const bubble = await page.locator('#bubble').innerText();
            const praise = await page.locator('.praise-line').count();
            const next = await page.locator('[data-tap="play-next"]').count();
            const praiseOk = got.every(k => k.indexOf('ui_') === 0 || k.indexOf('ui4_') === 0);
            add({ vp: vp.name, lesson, diff, play, action: 'drag', expect: ['praise+next'], got, ok: done && praise > 0 && next > 0 && praiseOk && bubble.indexOf('분홍 선을') < 0, note: bubble.replace(/\n/g, ' ') });
          } else if (play === 'memory') {
            const pairs = await page.$$eval('.mem-card', els => els.map(e => e.getAttribute('data-pair')));
            const seen = {};
            for (let i = 0; i < pairs.length; i++) {
              const id = pairs[i];
              if (seen[id] === undefined) { seen[id] = i; continue; }
              const a = page.locator('.mem-card').nth(seen[id]);
              const b = page.locator('.mem-card').nth(i);
              const boxA = await a.boundingBox();
              const boxB = await b.boundingBox();
              await page.touchscreen.tap(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
              await page.waitForTimeout(120);
              await page.touchscreen.tap(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2);
              await page.waitForTimeout(120);
            }
          } else if (play === 'blocks') {
            await tap(page, '[data-kind="cho"][data-ok="1"]');
            const m0 = await markOf(page);
            await tap(page, '[data-kind="jung"][data-ok="1"]');
            const got = await sinceSoon(page, m0, 2500);
            const say = await page.locator('.sum').innerText();
            const want = await page.evaluate(s => V5C.sylKey(s), say);
            const entryHad = (opened.got || []).indexOf(want) >= 0;
            add({ vp: vp.name, lesson, diff, play, action: 'built ' + say, expect: [want], got, ok: got.indexOf(want) >= 0 || (entryHad && got.length === 0), note: '' });
          } else {
            if ((play === 'listen' || play === 'sparkle') && await page.locator('#stage [data-ok="0"]').count()) {
              const stem = opened.expect.keys.slice();
              const m0 = await markOf(page);
              await tap(page, '#stage [data-ok="0"]');
              const got = (await sinceSoon(page, m0, 2500)).map(alias);
              const allowed = stem.concat(['ui_retry', 'ui_hwhint', 'ui_together']).map(alias);
              add({ vp: vp.name, lesson, diff, play, action: 'wrong', expect: allowed, got, ok: got.length > 0 && got.every(k => allowed.indexOf(k) >= 0), note: '' });
            }
            if (await page.locator('#stage [data-ok="1"]').count()) await tap(page, '#stage [data-ok="1"]');
            if (await page.locator('[data-tap="trial-next"]').count()) {
              await tap(page, '[data-tap="trial-next"]');
              if (await page.locator('#stage [data-ok="1"]').count()) await tap(page, '#stage [data-ok="1"]');
            }
          }
          const next = await page.locator('[data-tap="play-next"]').count();
          if (!next) add({ vp: vp.name, lesson, diff, play, action: 'finish', expect: ['next'], got: [], ok: false, note: 'stuck' });
          else await tap(page, '[data-tap="play-next"]');
        } catch (err) {
          add({ vp: vp.name, lesson, diff, play, action: 'drive', expect: [], got: [], ok: false, note: String(err.message || err) });
        }
      }
    }
  }
  add({ vp: vp.name, lesson: 0, diff: '', play: 'console', action: 'errors', expect: [], got: errors.slice(0, 8), ok: errors.length === 0, note: String(errors.length) });
  add({ vp: vp.name, lesson: 0, diff: '', play: 'network', action: '404', expect: [], got: [...new Set(missing)].slice(0, 8), ok: missing.length === 0, note: String(missing.length) });
  await page.close();
}
await browser.close();
const bad = rows.filter(r => !r.ok);
const summary = { rows: rows.length, bad: bad.length, notes };
fs.writeFileSync('/tmp/audit.json', JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (bad.length) process.exit(1);
