import pw from '/tmp/pw/node_modules/playwright-core/index.js';
export const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
export const VIEWS = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  ipad: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
};
export async function launch() {
  return pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--autoplay-policy=user-gesture-required', '--no-sandbox', '--disable-dev-shm-usage'] });
}
export async function open(browser, view, state) {
  const ctx = await browser.newContext({ ...VIEWS[view], serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const log = { errors: [], bad: [] };
  page.on('pageerror', e => log.errors.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') log.errors.push('console ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) log.bad.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => { const f = r.failure(); if (f && !/ERR_ABORTED/.test(f.errorText)) log.bad.push('fail ' + r.url() + ' ' + f.errorText); });
  await page.addInitScript(st => {
    if (st) localStorage.setItem('hangul-v5', JSON.stringify(st));
    window.__plays = [];
    const o = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const a = this; const src = a.src || '';
      const txt = sel => { const e = document.querySelector(sel); return e ? (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
      const rec = { src: src.replace(/^.*\/audio\//, '').replace(/\.mp3.*$/, ''), t: performance.now(), state: 'called',
        bubble: txt('#bubble'), live: txt('#live'), prompt: txt('#stage .prompt'), screen: (document.getElementById('main') || {}).dataset ? document.getElementById('main').dataset.screen : '',
        stage: txt('#stage').slice(0, 300) };
      if (src.startsWith('data:')) rec.src = 'SILENT';
      window.__plays.push(rec);
      a.addEventListener('playing', () => { if ((a.src || '') === src) rec.state = 'playing'; }, { once: true });
      const r = o.call(a);
      if (r && r.then) r.then(() => { if (rec.state === 'called') rec.state = 'resolved'; }).catch(e => { rec.state = 'err:' + e.name; });
      return r;
    };
  }, state || null);
  await page.goto(BASE + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(300);
  const sp = page.locator('#splash [data-tap="start"]');
  if (await sp.count() && await sp.isVisible()) { const b = await sp.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(500); }
  return { ctx, page, log };
}
export function stateFor(opts) {
  const done = {};
  for (let i = 1; i < (opts.lesson || 1); i++) done[i] = '2026-11-01';
  return { v: 5, scoreV: 2, sound: true, colorHints: opts.hints !== false, difficulty: opts.diff || 'mid', ms: 0, today: '', todayMs: 0,
    done, skill: {}, last: null, stickers: [], unlocks: [], wear: {}, who: 'monggeul', freshItem: '', soloN: 0 };
}
export async function tap(page, locOrSel) {
  const loc = typeof locOrSel === 'string' ? page.locator(locOrSel).first() : locOrSel;
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const box = await loc.boundingBox();
  if (!box) throw new Error('no box ' + locOrSel);
  // ensure element actually receives the touch (not covered)
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('[data-tap]') || e).outerHTML.slice(0, 80) : 'none'; }, [cx, cy]);
  const own = await loc.evaluate((el, h) => { const e = document.elementFromPoint(...h); return !!e && (el === e || el.contains(e)); }, [cx, cy]);
  await page.touchscreen.tap(cx, cy);
  return { own, hit };
}
export async function plays(page) { return page.evaluate(() => window.__plays.slice()); }
export async function playsSince(page, n) { return page.evaluate(n => window.__plays.slice(n), n); }
export async function nPlays(page) { return page.evaluate(() => window.__plays.length); }
// drag along points given in svg viewBox coords (0..100) of .trace-board svg
export async function dragStroke(page, pts, opts = {}) {
  const r = await page.evaluate(() => { const b = document.querySelector('.trace-board svg').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const cdp = await page.context().newCDPSession(page);
  const P = p => ({ x: r.x + p[0] / 100 * r.w + (opts.jitter ? (Math.random() - .5) * opts.jitter : 0), y: r.y + p[1] / 100 * r.h + (opts.jitter ? (Math.random() - .5) * opts.jitter : 0), id: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(pts[0])] });
  for (let i = 1; i < pts.length; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(pts[i])] });
    if (i % 3 === 0) await page.waitForTimeout(8);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
export function strokePts(st) {
  const raw = [];
  if (st.c) { const [cx, cy, r] = st.c; for (let i = 0; i <= 60; i++) { const t = -i / 60 * Math.PI * 2; raw.push([cx + r * Math.sin(t), cy - r * Math.cos(t)]); } return raw; }
  for (let i = 1; i < st.length; i++) { const a = st[i - 1], b = st[i]; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2); for (let k = 0; k <= n; k++) raw.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return raw;
}
