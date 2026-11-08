/* Non-lesson screens + practice mode + idle guide + sound off. node nav.mjs [tag] */
import fs from 'fs';
import { launch, open, stateFor, tap, dragStroke, strokePts } from './lib.mjs';
const tag = process.argv[2] || 'nav';
const OUT = (process.env.OUT || '/tmp/hangul-qa');
fs.mkdirSync(OUT + '/audit', { recursive: true }); fs.mkdirSync(OUT + '/shots', { recursive: true });
const R = { checks: [], fails: [], errors: [], bad: [], mismatch: [] };
const ok = (name, cond, extra) => { R.checks.push(name + (cond ? ' OK' : ' FAIL') + (extra ? ' ' + extra : '')); if (!cond) R.fails.push(name + (extra ? ' ' + extra : '')); };
const norm = s => String(s || '').replace(/[\s.,!?~·…"'“”‘’:;()\-]/g, '');
async function since(page, n) {
  return page.evaluate(n => window.__plays.slice(n).filter(r => r.src !== 'SILENT').map(r => Object.assign(r, { line: V5X.lineOf(r.src) })), n);
}
function checkCaps(recs, where) {
  recs.forEach(r => { if (!r.line || !norm(r.bubble + ' ' + r.live).includes(norm(r.line))) R.mismatch.push(where + ' ' + r.src + ' line=' + r.line + ' bubble=' + r.bubble + ' live=' + r.live); });
}
async function solve(page, label) {
  for (let g = 0; g < 40; g++) {
    const next = page.locator('#stage [data-tap="play-next"], #stage [data-tap="trial-next"]');
    if (await next.count()) { const k = await next.first().getAttribute('data-tap'); await tap(page, next.first()); await page.waitForTimeout(500); if (k === 'play-next') return true; continue; }
    const okEl = page.locator('[data-tap="pick"][data-ok="1"], .ctile.is-lit, [data-tap="piece"][data-ok="1"]:not([aria-disabled="true"])');
    if (await okEl.count()) { await tap(page, okEl.first()); await page.waitForTimeout(450); continue; }
    if (await page.locator('.mem-card:not(.is-matched)').count()) {
      const pairs = await page.evaluate(() => [...document.querySelectorAll('.mem-card')].map((c, i) => ({ i, p: c.dataset.pair, m: c.classList.contains('is-matched') })));
      const o = pairs.filter(x => !x.m); const a = o[0], b = o.find(x => x !== a && x.p === a.p);
      await tap(page, page.locator('.mem-card').nth(a.i)); await page.waitForTimeout(300); await tap(page, page.locator('.mem-card').nth(b.i)); await page.waitForTimeout(500); continue;
    }
    if (await page.locator('.trace-board:not(.is-complete)').count()) {
      const gl = await page.locator('.trace-board').getAttribute('data-letter');
      const strokes = await page.evaluate(g => V5C.STROKES[g], gl);
      for (const s of strokes) { await dragStroke(page, strokePts(s), { jitter: 6 }); await page.waitForTimeout(150); }
      await page.waitForTimeout(400); continue;
    }
    return false;
  }
  return false;
}
const b = await launch();
for (const view of ['phone', 'ipad']) {
  // practice: every door at lessons 1, 4, 8
  for (const L of [1, 4, 8]) {
    const st = stateFor({ lesson: L, diff: 'mid' }); st.onboarded = true;
    const { page, log, ctx } = await open(b, view, st);
    await tap(page, '[data-tap="go-map"]'); await page.waitForTimeout(500);
    const doors = await page.evaluate(() => [...document.querySelectorAll('.play-door')].map(d => d.dataset.play));
    for (const d of doors) {
      const n0 = await page.evaluate(() => window.__plays.length);
      await tap(page, page.locator('.play-door[data-play="' + d + '"]'));
      await page.waitForTimeout(700);
      const screen = await page.evaluate(() => document.getElementById('main').dataset.screen);
      const solved = screen === 'play' && await solve(page, view + ' practice ' + L + ' ' + d);
      const back = await page.evaluate(() => document.getElementById('main').dataset.screen);
      const recs = await since(page, n0);
      checkCaps(recs, `${view} practice L${L} ${d}`);
      ok(`${view} practice L${L} ${d} completes and returns to map`, solved && back === 'map', 'screen=' + back + ' plays=' + recs.length);
      ok(`${view} practice L${L} ${d} speaks`, recs.length > 0);
    }
    R.errors.push(...log.errors.map(e => view + ' ' + e)); R.bad.push(...log.bad);
    await ctx.close();
  }
  // screens: map lock, stickers, dress, adult
  {
    const st = stateFor({ lesson: 2, diff: 'mid' }); st.onboarded = true; st.stickers = ['word_agi', 'animal_01_고양이', 'mini_03'];
    const { page, log, ctx } = await open(b, view, st);
    // idle on home → hand + tapnext voice
    let n0 = await page.evaluate(() => window.__plays.length);
    await page.waitForTimeout(14000);
    let recs = await since(page, n0);
    const handHome = await page.evaluate(() => { const h = document.getElementById('hand'); return !!h && h.style.display === 'block'; });
    ok(`${view} home idle guide (voice+hand)`, recs.some(r => r.src === 'ui4_tapnext') && handHome, recs.map(r => r.src).join(','));
    await page.screenshot({ path: `${OUT}/shots/${tag}_${view}_home_idle.png` });
    await tap(page, '[data-tap="go-map"]'); await page.waitForTimeout(600);
    n0 = await page.evaluate(() => window.__plays.length);
    await tap(page, '.stone-btn.is-soon'); await page.waitForTimeout(600);
    recs = await since(page, n0); checkCaps(recs, view + ' map lock');
    ok(`${view} locked stone answers with voice`, recs.length > 0);
    // play idle: start lesson, wait 8 s on chant after intro
    await tap(page, '.map-go'); await page.waitForTimeout(500);
    n0 = await page.evaluate(() => window.__plays.length);
    await page.waitForTimeout(15000);
    recs = await since(page, n0); checkCaps(recs, view + ' chant idle');
    const keys = recs.map(r => r.src);
    ok(`${view} chant idle repeats instruction`, keys.filter(k => k === 'ui4_chant').length >= 2, keys.join(','));
    await page.screenshot({ path: `${OUT}/shots/${tag}_${view}_chant_idle.png` });
    // replay button
    n0 = await page.evaluate(() => window.__plays.length);
    await tap(page, '#replayBtn'); await page.waitForTimeout(600);
    recs = await since(page, n0);
    ok(`${view} replay button speaks instruction now`, recs[0] && recs[0].src === 'ui4_chant', recs.map(r => r.src).join(','));
    // chant every letter of lesson 2: 아 이 이
    const heard = [];
    for (let i = 0; i < 3; i++) {
      const lit = page.locator('.ctile.is-lit');
      const txt = (await lit.innerText()).trim();
      n0 = await page.evaluate(() => window.__plays.length);
      await tap(page, lit); await page.waitForTimeout(700);
      recs = await since(page, n0);
      heard.push(txt + '→' + (recs[0] ? recs[0].src : 'none'));
    }
    ok(`${view} 노래 톡톡 L2 each tile plays its own syllable`, heard.join(' ') === '아→sy_C544 이→sy_C774 이→sy_C774', heard.join(' '));
    await tap(page, '#homeBtn'); await page.waitForTimeout(500);
    await tap(page, '#homeBtn'); await page.waitForTimeout(500);
    // stickers
    await tap(page, '.home-dock [data-tap="stickers"]'); await page.waitForTimeout(500);
    n0 = await page.evaluate(() => window.__plays.length);
    await tap(page, '[data-tap="sticker-say"][data-id="word_agi"]'); await page.waitForTimeout(600);
    recs = await since(page, n0); checkCaps(recs, view + ' sticker');
    ok(`${view} owned word sticker says its word`, recs[0] && recs[0].src === 'w_agi', recs.map(r => r.src).join(','));
    const pages = await page.evaluate(() => document.querySelector('.pager span').textContent);
    for (let i = 0; i < 12; i++) { await tap(page, '[data-tap="book-next"]'); await page.waitForTimeout(150); }
    await page.screenshot({ path: `${OUT}/shots/${tag}_${view}_stickers.png` });
    ok(`${view} sticker pager works`, /\d+ \/ \d+/.test(pages), pages);
    const scroll = await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 2);
    ok(`${view} sticker page no page scroll`, scroll);
    await tap(page, '#homeBtn'); await page.waitForTimeout(400);
    // dress
    await tap(page, '.home-dock [data-tap="dress"]'); await page.waitForTimeout(600);
    const whoN = await page.locator('[data-tap="who"]').count();
    ok(`${view} dress shows 5 friends`, whoN === 5, String(whoN));
    await tap(page, '[data-tap="who"][data-who="bori"]'); await page.waitForTimeout(400);
    const items = await page.locator('[data-tap="equip"]').count();
    ok(`${view} bori has many items`, items >= 14, String(items));
    await tap(page, '[data-tap="equip"][data-unlocked="0"]'); await page.waitForTimeout(400);
    const lockedMsg = await page.evaluate(() => (document.getElementById('bubble') || {}).textContent || '');
    ok(`${view} locked item explains`, lockedMsg.includes('놀이하면'), lockedMsg);
    await page.screenshot({ path: `${OUT}/shots/${tag}_${view}_dress.png` });
    // adult gate wrong then right
    await tap(page, '#adultBtn'); await page.waitForTimeout(400);
    const sum = await page.evaluate(() => { const t = document.querySelector('.sum-line span').textContent; const m = t.match(/(\d+) \+ (\d+)/); return [+m[1], +m[2]]; });
    for (const d of '19') { await tap(page, `[data-tap="gate-key"][data-n="${d}"]`); await page.waitForTimeout(120); }
    await page.waitForTimeout(500);
    const stillGate = await page.evaluate(() => !document.getElementById('gate').hidden && document.getElementById('parent').hidden);
    ok(`${view} adult gate rejects wrong`, stillGate);
    const sum2 = await page.evaluate(() => { const t = document.querySelector('.sum-line span').textContent; const m = t.match(/(\d+) \+ (\d+)/); return String(+m[1] + +m[2]); });
    for (const d of sum2) { await tap(page, `[data-tap="gate-key"][data-n="${d}"]`); await page.waitForTimeout(120); }
    await page.waitForTimeout(500);
    const parentOpen = await page.evaluate(() => !document.getElementById('parent').hidden);
    const zoom = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
    ok(`${view} adult menu opens + zoom allowed only there`, parentOpen && zoom.includes('user-scalable=yes'), zoom);
    await page.screenshot({ path: `${OUT}/shots/${tag}_${view}_adult.png`, fullPage: false });
    if (parentOpen) { await tap(page, '#parent [data-tap="sound"]'); await page.waitForTimeout(300); } else { await page.screenshot({ path: `${OUT}/shots/${tag}_${view}_gatefail.png` }); console.log('gate typed', sum2); }
    if (parentOpen) { await tap(page, '[data-tap="close-parent"]'); await page.waitForTimeout(400); } else { await tap(page, '[data-tap="gate-close"]'); await page.waitForTimeout(300); }
    const zoom2 = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
    ok(`${view} kid zoom blocked after closing`, zoom2.includes('user-scalable=no'), zoom2);
    // sound off → no clip plays
    await tap(page, '#homeBtn'); await page.waitForTimeout(400);
    n0 = await page.evaluate(() => window.__plays.length);
    await tap(page, '[data-tap="go-map"]'); await page.waitForTimeout(400);
    await tap(page, '.map-go'); await page.waitForTimeout(1200);
    recs = await since(page, n0);
    ok(`${view} sound off = silent`, recs.length === 0, recs.map(r => r.src).join(','));
    R.errors.push(...log.errors.map(e => view + ' ' + e)); R.bad.push(...log.bad);
    await ctx.close();
  }
}
await b.close();
fs.writeFileSync(`${OUT}/audit/${tag}.json`, JSON.stringify(R, null, 1));
console.log('checks', R.checks.length, 'fails', R.fails.length, 'mismatch', R.mismatch.length, 'errors', R.errors.length, '404', R.bad.length);
R.fails.forEach(f => console.log('FAIL', f));
R.mismatch.slice(0, 20).forEach(f => console.log('MISMATCH', f));
R.errors.slice(0, 10).forEach(f => console.log('ERR', f));
