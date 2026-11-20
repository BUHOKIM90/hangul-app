#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HELP = `qa/sw_update_test.mjs — does an installed copy of the app pick up a new deploy without clearing storage?

Serves builds from a local static server (Cache-Control: max-age=600 like GitHub Pages) and, per browser engine:
  1 old    open the build at --old-ref, wait until its service worker has precached every file
  2 reopen swap in this working tree (build A) with every audio/picture request aborted, open a new page
           -> page runs A, and A's cache still reaches every file (copied from the old cache)
  3 resume swap in A+css tweak (build B), only fire visibilitychange    -> exactly one reload, page runs B
  4 defer  swap in build C while on the sticker book, ask for an update -> no reload; going home reloads once into C
  5 guard  wait, count navigations                                     -> no reload loop
  6 resume-midplay  swap in build D during a stage, fire visibilitychange (finds D) and again once D is waiting
                    -> no reload while playing; going home reloads once into D
  7 fail-install  build E changes audio/ui_good1.mp3 and the server answers it 500 -> E still activates (stamp),
                  fill ends with exactly that file missing; once the server heals it plays online and is cached
  8 quota-ish     first install of E in a fresh on-disk profile with 50 random audio requests aborted -> E controls with
                  an incomplete cache (fill reports failures, or WebKit's worker stops); healed + next open -> every file
                  cached, failed 0; offline an aborted file still answers 206
  9 stamp  parent menu #pmInfo shows E's hash and build time (screenshot)
 10 slow   server holds page/css/js requests                           -> page still opens from cache (~3 s)
 11 off    server stopped: reload and a new page open from cache, audio Range -> 206

Usage: node qa/sw_update_test.mjs [--engines webkit,chromium] [--old-ref 8e8e32c] [--port 18977]
                                  [--work ${path.join(os.tmpdir(), 'sw_update_test')}] [--shots <dir>] [--dry-run]
Prints one JSON object; exit code 0 only if every engine passes. Run /workspace/team/bin/browser_gate.sh check first.`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
const opt = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const engines = opt('engines', 'webkit,chromium').split(',');
const oldRef = opt('old-ref', '8e8e32c');
const port = +opt('port', '18977');
const work = path.resolve(opt('work', path.join(os.tmpdir(), 'sw_update_test')));
const shots = path.resolve(opt('shots', path.join(work, 'shots')));
if (work.startsWith('/workspace/team')) { console.error(`--work ${work}: fixtures are deleted and rebuilt on every run, so keep them outside /workspace/team`); process.exit(2); }
if (argv.includes('--dry-run')) { console.log(JSON.stringify({ repo, engines, oldRef, port, work, shots })); process.exit(0); }

function loadPW() {
  const rt = '/var/tmp/sand-playwright-runtime';
  for (const h of fs.readdirSync(rt).sort()) {
    const pkg = path.join(rt, h, 'node_modules/playwright-core/package.json');
    if (fs.existsSync(pkg)) return createRequire(pkg)(path.join(rt, h, 'node_modules/playwright-core'));
  }
  throw new Error(`playwright-core not found under ${rt}`);
}

const cacheOf = dir => /const CACHE = '([^']+)'/.exec(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8'))[1];
const filesOf = dir => JSON.parse(/const FILES = (\[.*\]);/.exec(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8'))[1]).length;

function fixtures() {
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const old = path.join(work, 'old');
  fs.mkdirSync(old);
  execFileSync('sh', ['-c', `git -C "${repo}" archive ${oldRef} | tar -x -C "${old}"`]);
  const build = (name, tweak) => {
    const dir = path.join(work, name);
    fs.cpSync(repo, dir, { recursive: true, filter: s => path.basename(s) !== '.git' });
    if (tweak) {
      fs.appendFileSync(path.join(dir, 'v6/css/app.css'), `\n/* sw_update_test ${name} */\n`);
      execFileSync(process.execPath, [path.join(dir, 'v6/tools/build.mjs'), dir], { stdio: 'ignore' });
    }
    return dir;
  };
  const e = build('e', true);
  fs.copyFileSync(path.join(e, 'audio/ui_good2.mp3'), path.join(e, 'audio/ui_good1.mp3'));
  execFileSync(process.execPath, [path.join(e, 'v6/tools/build.mjs'), e], { stdio: 'ignore' });
  return { old, a: build('a', false), b: build('b', true), c: build('c', true), d: build('d', true), e };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
function server() {
  const st = { dir: null, hang: false, fail: () => null, srv: null, held: [] };
  st.start = () => new Promise(r => {
    st.srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      if (st.hang && /\.(html|css|js)$/.test(p) && !p.endsWith('/sw.js')) { st.held.push(res); return; }
      const fail = st.fail(p);
      if (fail === 'abort') { req.socket.destroy(); return; }
      if (fail === '500') { res.writeHead(500); res.end(); return; }
      const f = path.join(st.dir, p);
      if (!f.startsWith(st.dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      const stat = fs.statSync(f);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=600',
        'Last-Modified': stat.mtime.toUTCString(), 'Content-Length': stat.size });
      fs.createReadStream(f).pipe(res);
    });
    st.srv.listen(port, '127.0.0.1', r);
  });
  st.stop = () => new Promise(r => { st.held.forEach(x => x.destroy()); st.held = []; st.srv.closeAllConnections(); st.srv.close(() => r()); });
  return st;
}

const PRE_LISTENER = () => { window.__pre = []; navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'precache') window.__pre.push(e.data); }); };
const waitFor = async (fn, ms, step = 500) => { const t0 = Date.now(); for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await new Promise(r => setTimeout(r, step)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runEngine(PW, name, fx, srv) {
  const base = `http://127.0.0.1:${port}/`;
  const r = { engine: name, steps: {}, errors: [] };
  const launchOpts = name === 'chromium' ? { executablePath: '/usr/bin/google-chrome' } : {};
  const browser = await PW[name].launch(launchOpts);
  let ctx2 = null;
  try {
    const profile = () => browser.newContext({ viewport: { width: 820, height: 1180 }, serviceWorkers: 'allow' }).then(async c => {
      await c.addInitScript(PRE_LISTENER);
      return c;
    });
    const ctx = await profile();
    const lastFill = page => page.evaluate(() => window.__pre.filter(m => m.final).pop() || null);
    const countIn = (page, k) => page.evaluate(async k => (await caches.has(k)) ? (await (await caches.open(k)).keys()).length : 0, k);
    const track = page => {
      const navs = [];
      page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
      page.on('pageerror', e => r.errors.push(String(e)));
      return navs;
    };
    const cacheNow = page => page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('hangul-v6')));
    const buildNow = page => page.evaluate(() => (window.BUILD || {}).cache || null);

    srv.dir = fx.old; await srv.start();
    const p1 = await ctx.newPage(); track(p1);
    await p1.goto(base);
    const oldCache = cacheOf(fx.old), oldN = filesOf(fx.old);
    const precached = await waitFor(() => p1.evaluate(async ([k, n]) => navigator.serviceWorker.controller && (await caches.keys()).includes(k) && (await (await caches.open(k)).keys()).length >= n, [oldCache, oldN]), 180000, 1000);
    r.steps.old = { cache: oldCache, files: oldN, page_build: await buildNow(p1), ok: !!precached };

    srv.dir = fx.a;
    srv.fail = p => /^\/(audio|v6\/img)\//.test(p) ? 'abort' : null;
    const A = cacheOf(fx.a), aN = filesOf(fx.a);
    const p2 = await ctx.newPage(); const navs = track(p2);
    await p2.goto(base);
    const gotA = await waitFor(async () => (await buildNow(p2)) === A && (await p2.evaluate(() => !!(window.App && document.querySelector('.splash-go, #main[data-screen="home"]')))), 90000);
    const copiedAll = await waitFor(async () => (await countIn(p2, A)) >= aN, 60000);
    await sleep(3000);
    r.steps.reopen = { expect: A, page_build: await buildNow(p2), caches: await cacheNow(p2), navigations: navs.length,
      audio_and_pictures_blocked: true, cached: await countIn(p2, A), files: aN, ok: !!gotA && navs.length <= 2 && !!copiedAll && (await cacheNow(p2)).join() === A };
    srv.fail = () => null;
    await p1.close();

    srv.dir = fx.b;
    const B = cacheOf(fx.b);
    let n0 = navs.length;
    const hidden = await p2.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); return document.hidden; });
    const gotB = await waitFor(async () => (await buildNow(p2)) === B, 90000);
    await sleep(3000);
    r.steps.resume = { expect: B, document_hidden: hidden, page_build: await buildNow(p2), reloads: navs.length - n0, ok: !!gotB && navs.length - n0 === 1 };

    srv.dir = fx.c;
    const C = cacheOf(fx.c);
    n0 = navs.length;
    const screen = await p2.evaluate(async () => { await App.home(); App.stickers(); return App.screen; });
    await p2.evaluate(() => navigator.serviceWorker.getRegistration().then(reg => reg.update()));
    const swapped = await waitFor(async () => (await cacheNow(p2)).join() === C && await p2.evaluate(() => typeof App._reload === 'function'), 90000);
    await sleep(2000);
    const heldBack = { screen, controller_now: (await cacheNow(p2)).join(), page_build: await buildNow(p2), reloads: navs.length - n0 };
    await p2.evaluate(() => App.home());
    const gotC = await waitFor(async () => (await buildNow(p2)) === C, 30000);
    await sleep(2000);
    r.steps.defer = { expect: C, while_on_screen: heldBack, after_home: { page_build: await buildNow(p2), reloads: navs.length - n0 },
      ok: !!swapped && heldBack.reloads === 0 && heldBack.page_build === B && !!gotC && navs.length - n0 === 1 };

    n0 = navs.length;
    for (let i = 0; i < 3; i++) { await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(2500); }
    const reloadedFor = await p2.evaluate(() => sessionStorage.getItem('sw-reloaded-for'));
    r.steps.guard = { extra_navigations_10s: navs.length - n0, reloaded_for: reloadedFor, caches: await cacheNow(p2), ok: navs.length - n0 === 0 && reloadedFor === C };

    srv.dir = fx.d;
    const D = cacheOf(fx.d);
    n0 = navs.length;
    const playing = await p2.evaluate(() => { App.runStage(St.stage()); return App.screen; });
    await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const waiting = await waitFor(async () => (await cacheNow(p2)).join() === D && await p2.evaluate(() => typeof App._reload === 'function'), 90000);
    for (let i = 0; i < 2; i++) { await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(2500); }
    const midplay = { screen: await p2.evaluate(() => App.screen), page_build: await buildNow(p2), reloads: navs.length - n0 };
    await p2.evaluate(() => App.home());
    const gotD = await waitFor(async () => (await buildNow(p2)) === D, 30000);
    await sleep(2000);
    r.steps['resume-midplay'] = { expect: D, started_screen: playing, while_playing: midplay, after_home: { page_build: await buildNow(p2), reloads: navs.length - n0 },
      ok: playing === 'stage' && !!waiting && midplay.screen === 'stage' && midplay.reloads === 0 && midplay.page_build === C && !!gotD && navs.length - n0 === 1 };

    srv.dir = fx.e;
    srv.fail = p => p === '/audio/ui_good1.mp3' ? '500' : null;
    const E = cacheOf(fx.e), eN = filesOf(fx.e);
    n0 = navs.length;
    await p2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const gotE = await waitFor(async () => (await buildNow(p2)) === E, 90000);
    const fillE = await waitFor(() => lastFill(p2), 60000);
    const missingE = await p2.evaluate(async k => !(await (await caches.open(k)).match('audio/ui_good1.mp3')), E);
    srv.fail = () => null;
    const online = await p2.evaluate(async () => { const res = await fetch('audio/ui_good1.mp3'); const buf = await res.arrayBuffer(); const ac = new (window.AudioContext || window.webkitAudioContext)();
      const d = await new Promise((ok, no) => ac.decodeAudioData(buf.slice(0), ok, no)).then(b => b.duration, e => 'decode error ' + e); return { status: res.status, bytes: buf.byteLength, duration: d }; });
    const cachedAfter = await waitFor(() => p2.evaluate(async k => !!(await (await caches.open(k)).match('audio/ui_good1.mp3')), E), 10000);
    const wantBytes = fs.statSync(path.join(fx.e, 'audio/ui_good1.mp3')).size;
    r.steps['fail-install'] = { expect: E, page_build: await buildNow(p2), reloads: navs.length - n0, fill: fillE, ui_good1_missing_after_fill: missingE,
      online_after_heal: online, cached_on_first_use: !!cachedAfter, cached: await countIn(p2, E), files: eN,
      ok: !!gotE && !!fillE && fillE.failed === 1 && fillE.done === eN - 1 && missingE && online.status === 200 && online.bytes === wantBytes && typeof online.duration === 'number' && online.duration > 0 && !!cachedAfter };

    const audioList = fs.readdirSync(path.join(fx.e, 'audio')).filter(f => f.endsWith('.mp3') && fs.readFileSync(path.join(fx.e, 'sw.js'), 'utf8').includes('"audio/' + f + '"'));
    const pick = new Set(audioList.sort(() => Math.random() - 0.5).slice(0, 50).map(f => '/audio/' + f));
    srv.fail = p => pick.has(p) ? 'abort' : null;
    const qdir = path.join(work, 'profile_' + name);
    fs.rmSync(qdir, { recursive: true, force: true });
    ctx2 = await PW[name].launchPersistentContext(qdir, { ...launchOpts, viewport: { width: 820, height: 1180 }, serviceWorkers: 'allow' });
    await ctx2.addInitScript(PRE_LISTENER);
    const q = await ctx2.newPage(); track(q);
    await q.goto(base);
    const qCtl = await waitFor(() => q.evaluate(() => !!navigator.serviceWorker.controller), 60000);
    let last = -1, same = 0, first = null;
    for (let i = 0; i < 90 && !first; i++) {
      const f = await lastFill(q).catch(() => null);
      const n = await countIn(q, E).catch(() => -1);
      same = n === last ? same + 1 : 0; last = n;
      if (f) first = { final: f, cached: n }; else if (same >= 5) first = { stalled_at: n };
      else await sleep(2000);
    }
    const qBuild = await buildNow(q);
    srv.fail = () => null;
    const q1 = await ctx2.newPage(); track(q1);
    await q1.goto(base);
    let healed = null;
    for (let i = 0; i < 3 && !(healed && healed.done === eN); i++) {
      healed = await waitFor(() => lastFill(q1), 120000);
      if (!(healed && healed.done === eN)) await q1.evaluate(() => { window.__pre.length = 0; document.dispatchEvent(new Event('visibilitychange')); });
    }
    const victim = [...pick][0].slice(1);
    await srv.stop();
    const q2 = await ctx2.newPage(); track(q2);
    await q2.goto(base, { timeout: 30000 }).catch(e => r.errors.push('quota offline page ' + e.message));
    const q2Shown = await waitFor(() => q2.evaluate(() => !!document.querySelector('.splash-go')), 15000);
    const qRange = await q2.evaluate(async u => { const s = await fetch(u, { headers: { Range: 'bytes=0-99' } }); return [s.status, (await s.arrayBuffer()).byteLength]; }, victim).catch(e => String(e));
    r.steps['quota-ish'] = { aborted: pick.size, controlled: !!qCtl, page_build: qBuild, first_fill: first, next_open_fill: healed, cached: await countIn(q2, E),
      offline_new_page: !!q2Shown, offline_range_on_aborted_file: [victim, qRange],
      ok: !!qCtl && qBuild === E && !!first && (first.final ? first.final.failed > 0 && first.final.done === eN - first.final.failed : first.stalled_at < eN)
        && !!healed && healed.done === eN && healed.failed === 0 && !!q2Shown && Array.isArray(qRange) && qRange[0] === 206 && qRange[1] === 100 };
    await ctx2.close(); ctx2 = null;
    await srv.start();

    await p2.evaluate(() => App.parent());
    const info = await waitFor(() => p2.evaluate(() => { const t = document.querySelector('#pmInfo').textContent; return /오프라인 저장 \d+/.test(t) && t; }), 15000);
    const stamp = await p2.evaluate(() => window.BUILD);
    fs.mkdirSync(shots, { recursive: true });
    await p2.locator('#pmInfo').scrollIntoViewIfNeeded();
    const shot = path.join(shots, `stamp_${name}.png`);
    await p2.screenshot({ path: shot });
    const hash8 = E.slice('hangul-v6-'.length, 'hangul-v6-'.length + 8);
    r.steps.stamp = { pmInfo: info, build: stamp, screenshot: shot, ok: !!info && info.startsWith(`버전 ${hash8} · ${stamp.at}`) };
    await p2.evaluate(() => { const b = document.querySelector('#pmClose'); if (b) b.click(); });

    srv.hang = true;
    const t0 = Date.now();
    await p2.reload({ waitUntil: 'load', timeout: 30000 }).catch(e => r.errors.push('slow reload ' + e.message));
    const slowShown = await waitFor(() => p2.evaluate(() => !!document.querySelector('.splash-go')), 15000);
    r.steps.slow = { load_ms: Date.now() - t0, page_build: await buildNow(p2), ok: !!slowShown && (await buildNow(p2)) === E };
    srv.hang = false;

    await srv.stop();
    await p2.reload({ waitUntil: 'load', timeout: 30000 }).catch(e => r.errors.push('offline reload ' + e.message));
    const offShown = await waitFor(() => p2.evaluate(() => !!document.querySelector('.splash-go')), 15000);
    const range = await p2.evaluate(async () => { const s = await fetch('audio/ui_good1.mp3', { headers: { Range: 'bytes=0-99' } }); return [s.status, (await s.arrayBuffer()).byteLength]; }).catch(e => String(e));
    const p3 = await ctx.newPage(); track(p3);
    await p3.goto(base, { timeout: 30000 }).catch(e => r.errors.push('offline new page ' + e.message));
    const p3Shown = await waitFor(() => p3.evaluate(() => !!document.querySelector('.splash-go')), 15000);
    r.steps.offline = { reload_shows_app: !!offShown, page_build: await buildNow(p2), new_page_shows_app: !!p3Shown, audio_range: range,
      ok: !!offShown && !!p3Shown && (await buildNow(p2)) === E && Array.isArray(range) && range[0] === 206 && range[1] === 100 };
  } catch (e) {
    r.errors.push('fatal ' + (e.stack || e));
  } finally {
    if (ctx2) await ctx2.close();
    await browser.close();
    if (srv.srv && srv.srv.listening) await srv.stop();
  }
  r.pass = Object.values(r.steps).every(s => s.ok === true) && Object.keys(r.steps).length === 11 && !r.errors.length;
  return r;
}

const fx = fixtures();
const PW = loadPW();
const srv = server();
const out = { old_ref: oldRef, builds: { old: cacheOf(fx.old), a: cacheOf(fx.a), b: cacheOf(fx.b), c: cacheOf(fx.c), d: cacheOf(fx.d), e: cacheOf(fx.e) }, results: [] };
for (const e of engines) out.results.push(await runEngine(PW, e, fx, srv));
out.pass = out.results.every(r => r.pass);
console.log(JSON.stringify(out, null, 1));
process.exit(out.pass ? 0 : 1);
