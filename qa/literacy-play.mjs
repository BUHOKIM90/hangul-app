/* What a child sees: no pre-lit answer, pictures without print, a short path does not pass. */
import pw from '/tmp/pw/node_modules/playwright-core/index.js';
const { chromium } = pw;

const BASE = process.env.BASE || 'http://127.0.0.1:4173/';

async function dragTrace(page) {
  for (let guard = 0; guard < 8; guard++) {
    if (await page.locator('[data-tap="play-next"]').count()) return;
    const pts = await page.evaluate(() => {
      const svg = document.querySelector('.trace-board svg');
      if (!svg) return null;
      const guide = JSON.parse(svg.getAttribute('data-guide') || '[]');
      if (!guide.length) return [];
      const box = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const out = [];
      guide.forEach(p => {
        const x = box.x + ((p[0] - vb.x) / vb.width) * box.width;
        const y = box.y + ((p[1] - vb.y) / vb.height) * box.height;
        const prev = out[out.length - 1];
        if (!prev) { out.push({ x, y }); return; }
        const n = Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 4));
        for (let k = 1; k <= n; k++) out.push({ x: prev.x + (x - prev.x) * k / n, y: prev.y + (y - prev.y) * k / n });
      });
      return out;
    });
    if (!pts || !pts.length) throw new Error('trace has no pink guide');
    const cdp = await page.context().newCDPSession(page);
    const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }]
    });
    await send('touchStart', pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) await send('touchMove', pts[i].x, pts[i].y);
    await send('touchEnd', 0, 0);
    await page.waitForTimeout(60);
  }
  if (!(await page.locator('[data-tap="play-next"]').count())) throw new Error('trace drag did not finish');
}

function kidMin(page) {
  return page.evaluate(() => {
    const g = document.getElementById('gate');
    const p = document.getElementById('parent');
    const adult = (g && !g.hidden) || (p && !p.hidden);
    return adult ? 44 : 64;
  });
}
async function tap(page, locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 8000 });
  await locator.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'center' }));
  const box = await locator.boundingBox();
  if (!box) throw new Error('no box ' + label);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const min = await kidMin(page);
  const info = await locator.evaluate((node, p) => {
    const hit = document.elementFromPoint(p.x, p.y);
    const r = node.getBoundingClientRect();
    return { ok: hit === node, hit: hit ? hit.tagName + '.' + (hit.className || '') : 'null', w: r.width, h: r.height };
  }, { x, y });
  if (!info.ok) throw new Error('elementFromPoint ' + label + ' got ' + info.hit);
  if (info.w < min - 0.5 || info.h < min - 0.5) throw new Error('small ' + label + ' ' + info.w.toFixed(0) + 'x' + info.h.toFixed(0));
  const before = await page.evaluate(() => document.documentElement.outerHTML);
  await page.touchscreen.tap(x, y);
  const deadline = Date.now() + 400;
  let changed = false;
  while (Date.now() <= deadline) {
    const now = await page.evaluate(() => document.documentElement.outerHTML);
    if (now !== before) { changed = true; break; }
    await new Promise(r => setTimeout(r, 16));
  }
  if (!changed) throw new Error('no DOM change ' + label);
}
async function peel(page) {
  await tap(page, page.locator('[data-tap="play-next"]'), 'play-next');
  await page.waitForSelector('[data-tap="peel-next"]', { timeout: 4000 });
  await tap(page, page.locator('[data-tap="peel-next"]'), 'peel-next');
}
async function miss(page, n) {
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(320);
    const wrong = page.locator('#stage [data-ok="0"]');
    await tap(page, wrong.nth(i % Math.max(1, await wrong.count())), 'miss-' + i);
  }
}

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
page.on('pageerror', err => { throw err; });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('html[data-ready="1"]');
await tap(page, page.locator('[data-tap="go-map"]'), 'go-map');
await tap(page, page.locator('.stone-btn').nth(7), 'future-stone');
const note = await page.locator('.map-lock').innerText();
if (!note.includes('잠겨')) throw new Error('locked stone said ' + note);
if (await page.getAttribute('#main', 'data-screen') !== 'map') throw new Error('future stone left the map');
const homeHidden = await page.locator('#homeBtn').getAttribute('hidden');
if (homeHidden !== null) throw new Error('map has no way home');

await tap(page, page.locator('.map-go'), 'start-today');
if (await page.getAttribute('#main', 'data-play') !== 'chant') throw new Error('lesson did not start at chant');
if (await page.locator('#homeBtn').getAttribute('hidden') !== null) throw new Error('play has no way home');
for (let i = 0; i < 4; i++) {
  const lit = page.locator('.ctile.is-lit');
  if (await lit.count() === 0) break;
  await tap(page, lit, 'chant-' + i);
}
await peel(page);

await page.waitForSelector('h1.prompt');
const listenTitle = await page.locator('h1.prompt').innerText();
if (listenTitle !== '어떤 그림일까?') throw new Error('listen title ' + listenTitle);
const printed = await page.locator('#stage .choice').allInnerTexts();
if (printed.join('').match(/엄마|아빠|아기|려원/)) throw new Error('listen printed the word ' + printed.join('|'));
if (printed.length < 3) throw new Error('listen had ' + printed.length + ' pictures');
const bubble = await page.locator('#bubble').innerText();
if (/엄마|아빠|아기|려원/.test(bubble)) throw new Error('bubble gave the word ' + bubble);
await miss(page, 1);
await tap(page, page.locator('#stage [data-ok="1"]'), 'listen-fix');
await tap(page, page.locator('[data-tap="trial-next"]'), 'listen-next');
await tap(page, page.locator('#stage [data-ok="1"]'), 'listen-2');
await peel(page);

if (await page.locator('#stage .choice').count() < 3) throw new Error('letter find had fewer than 3 letters');
if (await page.locator('#stage .is-sparkle').count()) throw new Error('letter was already sparkling');
const beforeHint = await page.locator('#stage .is-sparkle').count();
await miss(page, 1);
if (await page.locator('#stage .is-sparkle').count() !== beforeHint) throw new Error('first miss lit the answer');
await miss(page, 1);
if (await page.locator('#stage .is-sparkle').count() < 1) throw new Error('second miss did not hint');
await miss(page, 1);
await tap(page, page.locator('[data-tap="trial-next"]'), 'spark-next');
if (await page.locator('#stage .is-sparkle').count()) throw new Error('second letter was already sparkling');
await miss(page, 3);
await peel(page);

if (await page.locator('.goal-pic span').count()) throw new Error('blocks printed the whole word');
if (await page.locator('[data-kind="cho"]').count() < 3) throw new Error('blocks had fewer than 3 consonants');
await tap(page, page.locator('[data-kind="cho"][data-ok="1"]'), 'cho');
await tap(page, page.locator('[data-kind="jung"][data-ok="1"]'), 'jung');
await peel(page);

await dragTrace(page);
await peel(page);

if (await page.getAttribute('#main', 'data-screen') !== 'done') throw new Error('lesson did not finish');
const on = await page.locator('.stars img.is-on').count();
const dim = await page.locator('.stars img.is-dim').count();
if (on !== 1 || dim !== 2) throw new Error('stars ' + on + ' on / ' + dim + ' dim');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hangul-v5')));
if (saved.done && saved.done[1]) throw new Error('path marked done after one unaided play');
['ㅇ', 'ㅏ'].forEach(g => {
  const sk = saved.skill['j:' + g];
  if (!sk || sk.solo || sk.box) throw new Error(g + ' scored a reveal ' + JSON.stringify(sk));
});
const blocks = saved.skill['s:아'];
if (!blocks || blocks.solo !== 1) throw new Error('blend solo missing ' + JSON.stringify(blocks));
await tap(page, page.locator('[data-tap="back-map"]'), 'back-map');
if (await page.getAttribute('#main', 'data-screen') !== 'map') throw new Error('no way back to the map');
if (await page.locator('.stone-btn.is-done').count()) throw new Error('map showed a passed stone');

const pass = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
await pass.goto(BASE, { waitUntil: 'domcontentloaded' });
await pass.waitForSelector('html[data-ready="1"]');
await tap(pass, pass.locator('[data-tap="go-map"]'), 'go-map-2');
await tap(pass, pass.locator('.map-go'), 'start-clean');
for (let guard = 0; guard < 8; guard++) {
  if (await pass.getAttribute('#main', 'data-screen') === 'done') break;
  for (let step = 0; step < 24; step++) {
    if (await pass.locator('[data-tap="play-next"]').count()) break;
    const type = await pass.getAttribute('#main', 'data-play');
    if (type === 'chant') {
      const lit = pass.locator('.ctile.is-lit');
      if (await lit.count() === 0) break;
      await tap(pass, lit, 'clean-chant');
      continue;
    }
    if (type === 'blocks') {
      await tap(pass, pass.locator('[data-kind="cho"][data-ok="1"]'), 'clean-cho');
      await tap(pass, pass.locator('[data-kind="jung"][data-ok="1"]'), 'clean-jung');
      continue;
    }
    if (type === 'trace') {
      await dragTrace(pass);
      continue;
    }
    await tap(pass, pass.locator('#stage [data-ok="1"]'), 'clean-pick');
    if (await pass.locator('[data-tap="trial-next"]').count()) {
      await tap(pass, pass.locator('[data-tap="trial-next"]'), 'clean-trial');
    }
  }
  if (await pass.getAttribute('#main', 'data-screen') === 'done') break;
  await peel(pass);
}
if (await pass.getAttribute('#main', 'data-screen') !== 'done') throw new Error('clean lesson did not finish');
const lit = await pass.locator('.stars img.is-on').count();
const dull = await pass.locator('.stars img.is-dim').count();
if (lit !== 3 || dull !== 0) throw new Error('clean stars ' + lit + '/' + dull);
const passed = await pass.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('hangul-v5'));
  const letters = Object.keys(s.skill || {}).filter(k => k.indexOf('j:') === 0);
  const known = letters.filter(k => s.skill[k].solo >= 3 && s.skill[k].box >= 3 && s.skill[k].help < s.skill[k].solo);
  return { done: !!(s.done && s.done[1]), known: known.length, last: s.last };
});
if (!passed.done) throw new Error('clean path did not pass');
if (passed.known) throw new Error('one clean day marked a letter mastered');
if (!passed.last || passed.last.solos !== 3 || passed.last.total !== 3) throw new Error('last record ' + JSON.stringify(passed.last));

await browser.close();
console.log('literacy play ok');
