/* Full tap/audio audit.
   node audit.mjs [views=phone,ipad] [diffs=easy,mid,hard] [lessons=1-8] [tag]
   Every lesson is played start→end by a bot that makes one wrong tap per question, then the right one.
   Every <audio>.play() is logged with the caption/screen at that moment and checked. */
import fs from 'fs';
import { launch, open, stateFor, tap, dragStroke, strokePts } from './lib.mjs';

const OUT = (process.env.OUT || '/tmp/hangul-qa');
fs.mkdirSync(OUT + '/audit', { recursive: true }); fs.mkdirSync(OUT + '/shots', { recursive: true });
const views = (process.argv[2] || 'phone,ipad').split(',');
const diffs = (process.argv[3] || 'easy,mid,hard').split(',');
const lessons = (process.argv[4] || '1-8').split('-').map(Number);
const tag = process.argv[5] || 'audit';
const ASR = (() => { try { return JSON.parse(fs.readFileSync(process.env.ASR || '/dev/null', 'utf8')); } catch (e) { return {}; } })();
const norm = s => String(s || '').replace(/[\s.,!?~·…"'“”‘’:;()\-]/g, '');

const report = { runs: [], mismatches: [], silentTaps: [], errors: [], bad: [], stuck: [], layout: [], perPlay: {} };

async function shot(page, name) {
  const p = `${OUT}/shots/${tag}_${name}.png`;
  await page.screenshot({ path: p });
  return p;
}
async function layoutCheck(page, where) {
  const issues = await page.evaluate(() => {
    const out = [];
    const se = document.scrollingElement;
    if (se.scrollHeight > innerHeight + 2) out.push('page scrolls ' + se.scrollHeight + '>' + innerHeight);
    if (se.scrollWidth > innerWidth + 2) out.push('page h-scroll ' + se.scrollWidth + '>' + innerWidth);
    document.querySelectorAll('[data-tap]').forEach(el => {
      if (el.closest('[hidden]') || el.closest('#gate[hidden]') || el.closest('#parent[hidden]')) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const name = (el.dataset.tap + ':' + (el.innerText || el.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').slice(0, 30);
      if (r.width < 44 || r.height < 44) out.push('small target ' + name + ' ' + (r.width | 0) + 'x' + (r.height | 0));
      // inside a scrollable container is ok; otherwise must be on screen
      let sc = el.parentElement, scrollable = false;
      while (sc && sc !== document.body) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (sc.scrollHeight > sc.clientHeight + 2 || sc.scrollWidth > sc.clientWidth + 2)) { scrollable = true; break; } sc = sc.parentElement; }
      if (!scrollable && (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1)) out.push('offscreen ' + name);
      if (!scrollable && r.bottom <= innerHeight && r.top >= 0) {
        const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
        const hit = document.elementFromPoint(cx, cy);
        if (hit && hit !== el && !el.contains(hit) && !hit.closest('#fx')) out.push('covered ' + name + ' by ' + (hit.className || hit.tagName).toString().slice(0, 30));
      }
    });
    // text clipped horizontally
    document.querySelectorAll('#main *').forEach(el => {
      if (!el.children.length && el.textContent.trim() && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'hidden') out.push('clipped text ' + el.textContent.trim().slice(0, 20));
    });
    return out;
  });
  issues.forEach(i => { const k = where + ' | ' + i; if (!report.layout.includes(k)) report.layout.push(k); });
}

function expectedOf(key, lines, praise) {
  if (key === 'SILENT') return null;
  if (lines[key]) return lines[key];
  if (praise[key]) return praise[key];
  if (ASR[key]) return ASR[key];
  return '';
}
function tokenOf(key, info) {
  const m = /^(sy|dy|fy)_([0-9A-F]{4})$/.exec(key);
  if (m) return String.fromCharCode(parseInt(m[2], 16));
  const j = /^j_([0-9A-F]{4})$/.exec(key);
  if (j) return String.fromCharCode(parseInt(j[1], 16));
  const w = /^(w|hw|hy)_(.+)$/.exec(key);
  if (w && info.words[w[2]]) return info.words[w[2]][0];
  return null;
}

async function checkPlays(page, from, ctxLabel, info) {
  const recs = await page.evaluate(n => window.__plays.slice(n).map(r => Object.assign({}, r, { line: r.src === 'SILENT' ? '' : V5X.lineOf(r.src) })), from);
  for (const r of recs) {
    if (r.src === 'SILENT') continue;
    const exp = r.line;
    const shown = norm(r.bubble + ' ' + r.live);
    const visible = norm(r.bubble + ' ' + r.live + ' ' + r.stage + ' ' + r.prompt);
    const tok = tokenOf(r.src, info);
    const row = { at: ctxLabel, key: r.src, line: exp, bubble: r.bubble, live: r.live, screen: r.screen, state: r.state };
    const playType = ctxLabel.split('|')[1] || 'nav';
    const pp = report.perPlay[playType] = report.perPlay[playType] || { plays: 0, mismatch: 0, keys: {} };
    pp.plays += 1;
    pp.keys[r.src] = (pp.keys[r.src] || 0) + 1;
    let bad = '';
    if (!exp) bad = 'no known line for key';
    else if (tok && !visible.includes(norm(tok))) bad = 'voiced token ' + tok + ' not on screen';
    else if (!shown.includes(norm(exp))) bad = 'caption differs from voice';
    if (/^err:(?!AbortError)/.test(r.state)) bad = (bad ? bad + '; ' : '') + 'play failed ' + r.state;
    if (bad) { row.why = bad; report.mismatches.push(row); pp.mismatch += 1; }
  }
  return recs.length;
}

async function tapAndLog(page, loc, label, info, expectSound) {
  const n0 = await page.evaluate(() => window.__plays.length);
  const res = await tap(page, loc);
  if (!res.own) report.layout.push(label + ' | tap landed on ' + res.hit);
  await page.waitForTimeout(650);
  const n1 = await page.evaluate(() => window.__plays.length);
  if (expectSound && n1 === n0) report.silentTaps.push(label);
  await checkPlays(page, n0, label, info);
}

async function playStep(page, label, info) {
  // returns true when the step finished (next button tapped)
  for (let guard = 0; guard < 40; guard++) {
    const st = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      return {
        screen: q('#main').dataset.screen, play: q('#main').dataset.play,
        next: !!q('#stage [data-tap="play-next"], #stage [data-tap="trial-next"]'),
        tile: !!q('.ctile.is-lit'), wrongTile: !!q('.ctile:not(.is-lit):not(.is-hit)'),
        pick: !!q('[data-tap="pick"][data-ok="1"]'), wrongPick: !!q('[data-tap="pick"][data-ok="0"]:not(.wiggle)'),
        piece: !!q('[data-tap="piece"][data-ok="1"]:not([aria-disabled="true"])'), wrongPiece: !!q('[data-tap="piece"][data-ok="0"]:not(.wiggle)'),
        card: !!q('.mem-card:not(.is-matched)'), trace: !!q('.trace-board:not(.is-complete)'),
        missed: (window.V5Play && V5Play._ctx && V5Play._ctx().misses) || 0
      };
    });
    if (st.screen !== 'play') return true;
    if (st.next) {
      await layoutCheck(page, label + ' end');
      const nx = page.locator('#stage [data-tap="play-next"], #stage [data-tap="trial-next"]').first();
      const kind = await nx.getAttribute('data-tap');
      await tapAndLog(page, nx, label + '|next', info, false);
      if (kind === 'play-next') return true;
      continue;
    }
    if (guard === 0) { await layoutCheck(page, label + ' start'); await page.waitForTimeout(300); }
    if (st.tile) {
      if (st.wrongTile && !page.__wrongDone) { page.__wrongDone = true; await tapAndLog(page, page.locator('.ctile:not(.is-lit):not(.is-hit)').first(), label + '|wrong-tile', info, true); continue; }
      await tapAndLog(page, page.locator('.ctile.is-lit').first(), label + '|tile', info, true);
      continue;
    }
    if (st.pick) {
      if (st.wrongPick && !page.__wrongDone) { page.__wrongDone = true; await tapAndLog(page, page.locator('[data-tap="pick"][data-ok="0"]').first(), label + '|wrong-pick', info, true); continue; }
      page.__wrongDone = false;
      await tapAndLog(page, page.locator('[data-tap="pick"][data-ok="1"]').first(), label + '|pick', info, true);
      continue;
    }
    if (st.piece) {
      if (st.wrongPiece && !page.__wrongDone) { page.__wrongDone = true; await tapAndLog(page, page.locator('[data-tap="piece"][data-ok="0"]').first(), label + '|wrong-piece', info, true); continue; }
      await tapAndLog(page, page.locator('[data-tap="piece"][data-ok="1"]:not([aria-disabled="true"])').first(), label + '|piece', info, true);
      continue;
    }
    if (st.card) {
      const pairs = await page.evaluate(() => [...document.querySelectorAll('.mem-card')].map((c, i) => ({ i, pair: c.dataset.pair, m: c.classList.contains('is-matched') })));
      const open = pairs.filter(p => !p.m);
      if (!page.__wrongDone && open.length >= 4) {
        page.__wrongDone = true;
        const a = open[0], b = open.find(p => p.pair !== a.pair);
        await tapAndLog(page, page.locator('.mem-card').nth(a.i), label + '|card', info, false);
        await tapAndLog(page, page.locator('.mem-card').nth(b.i), label + '|card-miss', info, true);
        await page.waitForTimeout(800);
        continue;
      }
      const a = open[0], b = open.find(p => p !== a && p.pair === a.pair);
      await tapAndLog(page, page.locator('.mem-card').nth(a.i), label + '|card', info, false);
      await tapAndLog(page, page.locator('.mem-card').nth(b.i), label + '|card-match', info, false);
      continue;
    }
    if (st.trace) {
      const g = await page.locator('.trace-board').getAttribute('data-letter');
      const strokes = await page.evaluate(g => {
        if (V5C.STROKES[g]) return V5C.STROKES[g];
        const p = V5C.split(g); return V5C.STROKES[p.cho].concat(V5C.STROKES[p.jung]);
      }, g);
      const n0 = await page.evaluate(() => window.__plays.length);
      for (const s of strokes) { await dragStroke(page, strokePts(s), { jitter: 8 }); await page.waitForTimeout(200); }
      await page.waitForTimeout(500);
      await checkPlays(page, n0, label + '|trace-drag', info);
      if (!(await page.locator('.trace-board.is-complete').count())) report.stuck.push(label + ' trace did not complete after drawing all strokes');
      continue;
    }
    report.stuck.push(label + ' no actionable element ' + JSON.stringify(st));
    await shot(page, 'stuck_' + label.replace(/[^a-z0-9]+/gi, '_'));
    return false;
  }
  report.stuck.push(label + ' step guard exceeded');
  return false;
}

async function runLesson(browser, view, diff, L) {
  const { ctx, page, log } = await open(browser, view, stateFor({ lesson: L, diff }));
  const info = await page.evaluate(() => ({ lines: LINES, words: V5C.WORDS, praise: Object.fromEntries(V5C.PRAISE.map(p => [p[1], p[0]])), flow: null }));
  info.flow = await page.evaluate(([L, d]) => V5C.flowFor(V5C.lesson(L), d), [L, diff]);
  const base = `${view}/${diff}/L${L}`;
  await tapAndLog(page, page.locator('[data-tap="go-map"]').first(), base + '|home-go', info, false);
  await page.waitForTimeout(300);
  await tapAndLog(page, page.locator('.map-go').first(), base + '|map-go', info, false);
  let step = 0;
  for (let guard = 0; guard < 30; guard++) {
    const screen = await page.evaluate(() => document.getElementById('main').dataset.screen);
    if (screen === 'play') {
      const play = await page.evaluate(() => document.getElementById('main').dataset.play);
      page.__wrongDone = false;
      if (step === 0 || guard % 3 === 0) await shot(page, `${view}_${diff}_L${L}_s${step}_${play}`);
      const ok = await playStep(page, `${base}|${play}`, info);
      step++;
      if (!ok) break;
      continue;
    }
    if (screen === 'reward') {
      await layoutCheck(page, base + ' reward');
      await tapAndLog(page, page.locator('[data-tap="peel-next"]').first(), base + '|reward-next', info, false);
      continue;
    }
    if (screen === 'done') {
      await layoutCheck(page, base + ' done');
      await shot(page, `${view}_${diff}_L${L}_done`);
      await tapAndLog(page, page.locator('[data-tap="back-map"]').first(), base + '|done-map', info, false);
      break;
    }
    report.stuck.push(base + ' unexpected screen ' + screen);
    break;
  }
  if (step !== info.flow.length) report.stuck.push(`${base} played ${step}/${info.flow.length} steps`);
  report.runs.push({ run: base, steps: step, flow: info.flow.join(',') });
  log.errors.forEach(e => report.errors.push(base + ' ' + e));
  log.bad.forEach(e => report.bad.push(base + ' ' + e));
  await ctx.close();
}

const browser = await launch();
const jobs = [];
for (const view of views) for (const diff of diffs) for (let L = lessons[0]; L <= (lessons[1] || lessons[0]); L++) jobs.push([view, diff, L]);
const POOL = 4;
let idx = 0;
await Promise.all(Array.from({ length: POOL }, async () => {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    try { await runLesson(browser, ...j); } catch (e) { report.stuck.push(j.join('/') + ' EXC ' + e.message.split('\n')[0]); }
  }
}));
await browser.close();
fs.writeFileSync(`${OUT}/audit/${tag}.json`, JSON.stringify(report, null, 1));
const total = Object.values(report.perPlay).reduce((a, p) => a + p.plays, 0);
console.log(`runs ${report.runs.length}  plays ${total}  mismatches ${report.mismatches.length}  silentTaps ${report.silentTaps.length}  errors ${report.errors.length}  404 ${report.bad.length}  stuck ${report.stuck.length}  layout ${report.layout.length}`);
for (const [k, v] of Object.entries(report.perPlay)) console.log('  ', k.padEnd(14), 'plays', v.plays, 'mismatch', v.mismatch);
