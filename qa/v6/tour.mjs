import { launch, open, stateFor, tap } from './lib.mjs';
import pw from '/tmp/pw/node_modules/playwright-core/index.js';
const tag = process.argv[2] || 'p2';
const L = +(process.argv[3] || 7);
const views = (process.argv[4] || 'phone,ipad').split(',');
const S = ((process.env.OUT || '/tmp/hangul-qa') + '/shots/');
const b = await launch();
for (const view of views) {
  // splash
  const ctx0 = await b.newContext({ viewport: view === 'phone' ? { width: 390, height: 844 } : { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const p0 = await ctx0.newPage(); await p0.goto('http://127.0.0.1:4173/?t=' + Date.now()); await p0.waitForTimeout(900);
  await p0.screenshot({ path: `${S}${tag}_${view}_00_splash.png` }); await ctx0.close();
  const st = stateFor({ lesson: L, diff: 'hard' }); st.stickers = ['animal_01_고양이', 'mini_01', 'word_agi']; st.onboarded = true;
  const { page, log, ctx } = await open(b, view, st);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${S}${tag}_${view}_01_home.png` });
  await tap(page, '[data-tap="go-map"]'); await page.waitForTimeout(700);
  await page.screenshot({ path: `${S}${tag}_${view}_02_map.png` });
  await tap(page, '.map-go'); await page.waitForTimeout(1200);
  let i = 0;
  for (let g = 0; g < 60; g++) {
    const scr = await page.evaluate(() => document.getElementById('main').dataset.screen);
    if (scr === 'play') {
      const play = await page.evaluate(() => document.getElementById('main').dataset.play);
      await page.screenshot({ path: `${S}${tag}_${view}_1${i}_${play}.png` });
      // solve fast via ctx
      const next = page.locator('#stage [data-tap="play-next"], #stage [data-tap="trial-next"]');
      if (await next.count()) { if (play === 'trace' || play === 'memory' || play === 'blocks') await page.screenshot({ path: `${S}${tag}_${view}_1${i}_${play}_end.png` }); await tap(page, next.first()); await page.waitForTimeout(700); i++; continue; }
      const ok = page.locator('[data-tap="pick"][data-ok="1"], .ctile.is-lit, [data-tap="piece"][data-ok="1"]:not([aria-disabled="true"])');
      if (await ok.count()) { await tap(page, ok.first()); await page.waitForTimeout(500); continue; }
      if (await page.locator('.mem-card:not(.is-matched)').count()) {
        const pairs = await page.evaluate(() => [...document.querySelectorAll('.mem-card')].map((c, i) => ({ i, p: c.dataset.pair, m: c.classList.contains('is-matched') })));
        const o = pairs.filter(x => !x.m); const a = o[0], c2 = o.find(x => x !== a && x.p === a.p);
        await tap(page, page.locator('.mem-card').nth(a.i)); await page.waitForTimeout(250); await tap(page, page.locator('.mem-card').nth(c2.i)); await page.waitForTimeout(500); continue;
      }
      if (await page.locator('.trace-board:not(.is-complete)').count()) {
        const { dragStroke, strokePts } = await import('./lib.mjs');
        const gl = await page.locator('.trace-board').getAttribute('data-letter');
        const strokes = await page.evaluate(g => V5C.STROKES[g], gl);
        for (const s of strokes) { await dragStroke(page, strokePts(s)); await page.waitForTimeout(150); }
        await page.waitForTimeout(400); continue;
      }
      break;
    }
    if (scr === 'reward') { await page.screenshot({ path: `${S}${tag}_${view}_2${i}_reward.png` }); await tap(page, '[data-tap="peel-next"]'); await page.waitForTimeout(900); continue; }
    if (scr === 'done') { await page.waitForTimeout(800); await page.screenshot({ path: `${S}${tag}_${view}_30_done.png` }); break; }
    break;
  }
  await tap(page, '[data-tap="stickers"]'); await page.waitForTimeout(600);
  await page.screenshot({ path: `${S}${tag}_${view}_31_stickers.png` });
  await tap(page, '[data-tap="go-home"]'); await page.waitForTimeout(500);
  await tap(page, '.home-dock [data-tap="dress"]'); await page.waitForTimeout(700);
  await page.screenshot({ path: `${S}${tag}_${view}_32_dress.png` });
  await tap(page, '#adultBtn'); await page.waitForTimeout(400);
  await page.screenshot({ path: `${S}${tag}_${view}_33_gate.png` });
  console.log(view, log.errors, log.bad);
  await ctx.close();
}
await b.close();
