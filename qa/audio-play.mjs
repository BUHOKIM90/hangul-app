/* Tap 놀자 and require an <audio> element to start an audio/*.mp3 clip. */
import pw from '/tmp/pw/node_modules/playwright-core/index.js';
const { chromium } = pw;

const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
const MP3 = /(?:^|\/)audio\/[^/?#]+\.mp3(?:$|\?)/;

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
await page.addInitScript(() => {
  const plays = [];
  window.__audioPlays = plays;
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const el = this;
    const snap = (started, via, error) => {
      plays.push({
        tag: el.tagName,
        src: el.currentSrc || '',
        assigned: el.src || '',
        started: !!started,
        paused: el.paused,
        time: el.currentTime,
        via: via,
        error: error || ''
      });
    };
    el.addEventListener('playing', () => snap(true, 'playing'), { once: true });
    const p = orig.call(el);
    if (p && typeof p.then === 'function') {
      p.then(() => snap(true, 'resolved')).catch(err => snap(false, 'rejected', String(err && err.name || err)));
    } else snap(!el.paused, 'sync');
    return p;
  };
});
page.on('pageerror', err => { throw err; });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('html[data-ready="1"]');
const binding = await page.evaluate(() => ({
  have: typeof HAVE_AUDIO,
  windowHave: typeof window.HAVE_AUDIO,
  lines: typeof LINES,
  windowLines: typeof window.LINES
}));
if (binding.have !== 'object') throw new Error('HAVE_AUDIO binding ' + binding.have);
if (binding.lines !== 'object') throw new Error('LINES binding ' + binding.lines);
if (binding.windowHave !== 'undefined' || binding.windowLines !== 'undefined') {
  throw new Error('catalogs leaked onto window ' + JSON.stringify(binding));
}
const btn = page.locator('[data-tap="go-map"]');
await btn.waitFor({ state: 'visible', timeout: 8000 });
const label = (await btn.innerText()).replace(/\s+/g, ' ').trim();
if (label !== '놀자') throw new Error('home button was ' + label);
const box = await btn.boundingBox();
if (!box) throw new Error('no box for 놀자');
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
const deadline = Date.now() + 8000;
let hit = null;
while (Date.now() < deadline) {
  hit = await page.evaluate(() => {
    const re = /(?:^|\/)audio\/[^/?#]+\.mp3(?:$|\?)/;
    const plays = window.__audioPlays || [];
    return plays.find(p => p.started && p.tag === 'AUDIO' && (re.test(p.src) || re.test(p.assigned))) || null;
  });
  if (hit) break;
  await new Promise(r => setTimeout(r, 40));
}
if (!hit) {
  const all = await page.evaluate(() => window.__audioPlays || []);
  throw new Error('play did not start ' + JSON.stringify(all));
}
const src = hit.src && MP3.test(hit.src) ? hit.src : hit.assigned;
console.log('audio play ok ' + JSON.stringify({ tapped: '놀자', started: true, via: hit.via, src: src }));
await browser.close();
