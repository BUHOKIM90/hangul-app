import pw from '/tmp/pw/node_modules/playwright-core/index.js';
const { chromium } = pw;
import fs from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
const OUT = '/opt/cursor/artifacts/v5';
fs.mkdirSync(OUT, { recursive: true });
const PLAYS = ['chant', 'listen', 'sparkle', 'blocks', 'match', 'memory', 'trace', 'treasure'];

const devices = [
  { name: 'iphone-port', viewport: { width: 390, height: 844 }, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'iphone-land', viewport: { width: 844, height: 390 }, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'ipad-port', viewport: { width: 1024, height: 1366 }, ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'ipad-land', viewport: { width: 1366, height: 1024 }, ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
];

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
  if (info.w < min - 0.5 || info.h < min - 0.5) throw new Error('small ' + label + ' ' + info.w.toFixed(0) + 'x' + info.h.toFixed(0) + ' min ' + min);
  const before = await page.evaluate(() => document.documentElement.outerHTML);
  await page.touchscreen.tap(x, y);
  const deadline = Date.now() + 150;
  let changed = false;
  while (Date.now() <= deadline) {
    const now = await page.evaluate(() => document.documentElement.outerHTML);
    if (now !== before) { changed = true; break; }
    await new Promise(r => setTimeout(r, 16));
  }
  if (!changed) {
    const screen = await page.getAttribute('#main', 'data-screen');
    throw new Error('no DOM change within 150ms ' + label + ' screen ' + screen);
  }
}

async function finishRound(page, correctShot) {
  const type = await page.getAttribute('#main', 'data-play');
  if (type === 'chant') {
    for (let i = 0; i < 6; i++) {
      const lit = page.locator('.ctile.is-lit');
      if (await lit.count() === 0) break;
      const audio = await lit.getAttribute('data-audio');
      const label = await lit.getAttribute('aria-label');
      const expect = 'sy_' + label.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      if (audio !== expect) throw new Error('chant clip ' + audio + ' does not match ' + label);
      await tap(page, lit, 'chant-' + i);
      if (correctShot && i === 0) {
        await page.waitForTimeout(280);
        await shot(page, correctShot);
        correctShot = '';
      }
    }
  } else if (type === 'blocks') {
    await tap(page, page.locator('[data-kind="cho"][data-ok="1"]'), 'cho');
    await tap(page, page.locator('[data-kind="jung"][data-ok="1"]'), 'jung');
  } else if (type === 'memory') {
    const pairs = await page.$$eval('.mem-card', els => els.map(e => e.getAttribute('data-pair')));
    const seen = {};
    for (let i = 0; i < pairs.length; i++) {
      const id = pairs[i];
      if (seen[id] === undefined) { seen[id] = i; continue; }
      await tap(page, page.locator('.mem-card').nth(seen[id]), 'mem-a');
      await tap(page, page.locator('.mem-card').nth(i), 'mem-b');
    }
  } else if (type === 'trace') {
    for (let i = 0; i < 24; i++) {
      if (await page.locator('[data-tap="play-next"]').count()) break;
      const dot = page.locator('.dot.is-next');
      if (await dot.count() === 0) break;
      await tap(page, dot, 'dot-' + i);
    }
  } else {
    if (type === 'sparkle') await page.waitForSelector('#stage .is-sparkle', { timeout: 2500 });
    await tap(page, page.locator('#stage [data-ok="1"]'), type || 'pick');
  }
  await tap(page, page.locator('[data-tap="play-next"]'), 'play-next');
  await page.waitForSelector('[data-tap="peel-next"]', { timeout: 4000 });
  await tap(page, page.locator('[data-tap="peel-next"]'), 'peel-next');
}

async function shot(page, name) {
  await page.screenshot({ path: OUT + '/' + name + '.png', fullPage: false });
}

async function runDevice(browser, spec) {
  const errors = [];
  const context = await browser.newContext({
    viewport: spec.viewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: spec.ua,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  page.on('pageerror', err => errors.push('pageerror ' + err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console ' + msg.text()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('html[data-ready="1"]');
  const shoot = spec.name === 'iphone-port' || spec.name === 'ipad-port';
  const shootChant = shoot || spec.name === 'ipad-land';
  const shootDone = shoot || spec.name === 'iphone-land';
  if (shoot) await shot(page, spec.name + '-home');
  await tap(page, page.locator('[data-tap="go-map"]'), 'go-map');
  if (shoot) await shot(page, spec.name + '-map');
  for (const play of PLAYS) {
    await tap(page, page.locator('[data-play="' + play + '"]'), 'practice-' + play);
    if (shoot || (shootChant && play === 'chant')) await shot(page, spec.name + '-play-' + play);
    await finishRound(page, shoot && play === 'chant' ? spec.name + '-correct' : '');
  }
  await tap(page, page.locator('[data-tap="start-lesson"]').first(), 'start-lesson');
  for (let i = 0; i < 8; i++) {
    await finishRound(page, '');
    const screen = await page.getAttribute('#main', 'data-screen');
    if (screen === 'done') break;
  }
  const done = await page.getAttribute('#main', 'data-screen');
  if (done !== 'done') throw new Error(spec.name + ' lesson ended on ' + done);
  const sticker = await page.getAttribute('#main', 'data-sticker');
  if (!sticker) throw new Error(spec.name + ' no lesson sticker');
  await page.waitForTimeout(1400);
  const placed = await page.locator('.peel-slot img').count();
  if (!placed) throw new Error(spec.name + ' sticker did not land in the slot');
  if (shootDone) {
    await shot(page, spec.name + '-done');
    await shot(page, spec.name + '-play-done');
  }
  await tap(page, page.locator('[data-tap="dress"]'), 'dress');
  await tap(page, page.locator('[data-tap="who"][data-who="monggeul"]'), 'who-monggeul');
  const body = await page.locator('.doll img[data-slot="body"]').getAttribute('src');
  if (!body || body.indexOf('monggeul_basic.webp') < 0) throw new Error(spec.name + ' body is ' + body);
  if (shoot) await shot(page, spec.name + '-dress');
  await tap(page, page.locator('[data-tap="equip"][data-unlocked="1"][aria-pressed="false"]').first(), 'equip');
  const worn = await page.locator('.doll img[data-slot="hat"], .doll img[data-slot="top"], .doll img[data-slot="acc"], .doll img[data-slot="shoes"]').count();
  if (!worn) throw new Error(spec.name + ' dress change did not add a layer');
  if (shoot) await shot(page, spec.name + '-dress-on');
  await tap(page, page.locator('#homeBtn'), 'home-from-dress');
  await tap(page, page.locator('[data-tap="stickers"]'), 'stickers');
  if (shoot) await shot(page, spec.name + '-stickers');
  await tap(page, page.locator('#adultBtn'), 'adult');
  if (shoot) await shot(page, spec.name + '-gate');
  const q = await page.locator('.sum-line').innerText();
  const m = q.match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) throw new Error('gate question ' + q);
  for (const ch of String(Number(m[1]) + Number(m[2]))) {
    await tap(page, page.locator('[data-tap="gate-key"][data-n="' + ch + '"]'), 'key-' + ch);
  }
  await page.waitForSelector('#parent:not([hidden])', { timeout: 2000 });
  if (shoot) await shot(page, spec.name + '-parent');
  await tap(page, page.locator('[data-tap="close-parent"]'), 'close-parent');
  const parentHidden = await page.getAttribute('#parent', 'hidden');
  if (parentHidden === null) throw new Error(spec.name + ' parent stayed open');
  await context.close();
  return errors;
}

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const report = [];
let failed = false;
for (const spec of devices) {
  try {
    const errors = await runDevice(browser, spec);
    const bad = errors.filter(e => !/favicon/.test(e));
    report.push({ device: spec.name, errors: bad });
    if (bad.length) failed = true;
    console.log(spec.name, 'taps ok', 'console', bad.length);
    bad.slice(0, 8).forEach(e => console.log('  ', e.slice(0, 240)));
  } catch (err) {
    failed = true;
    report.push({ device: spec.name, fail: String(err.stack || err).slice(0, 800) });
    console.log('FAIL', spec.name, err.message);
  }
}
await browser.close();
fs.writeFileSync(OUT + '/touch-report.json', JSON.stringify(report, null, 2));
if (failed) process.exit(1);
console.log('ALL DEVICES PASSED');
