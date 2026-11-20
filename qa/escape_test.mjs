// Simulates the CEO's device: old (bdcf923) cache-first SW controls the app, server moves to the new build,
// a plain reload still shows the old app, opening review/update/ must land on the new build with progress kept.
import { loadPW } from '/workspace/team/out/lily/r4_qa/design_md/tools/pw.mjs';
import { execSync } from 'node:child_process';
const { webkit } = await loadPW();
const B = 'http://localhost:8765/hangul-app/', T = '/tmp/updtest', res = {};
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
await p.goto(B, { waitUntil: 'load' });
await p.evaluate(() => localStorage.setItem('escape-test', 'kept'));
res.oldControlled = await p.evaluate(async () => { const t0 = Date.now(); while (!navigator.serviceWorker.controller && Date.now() - t0 < 90000) await new Promise(r => setTimeout(r, 500)); return !!navigator.serviceWorker.controller; });
if (!res.oldControlled) { await p.reload(); res.oldControlled = await p.evaluate(() => !!navigator.serviceWorker.controller); }
execSync(`ln -sfn ${T}/new ${T}/srv/hangul-app`);
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
res.afterPlainReload = await p.evaluate(() => (window.BUILD && window.BUILD.cache) || 'OLD (no build stamp)');
await p.goto(B + 'review/update/', { waitUntil: 'load' });
await p.waitForURL(/fresh=/, { timeout: 20000 }); await p.waitForLoadState('load'); await p.waitForTimeout(2000);
res.afterEscape = await p.evaluate(() => (window.BUILD && window.BUILD.cache) || 'OLD');
res.url = p.url().replace(/\d{6,}/, 'N');
res.progressKept = await p.evaluate(() => localStorage.getItem('escape-test'));
res.newSwControls = await p.evaluate(async () => { const t0 = Date.now(); while (!navigator.serviceWorker.controller && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 500)); return !!navigator.serviceWorker.controller; });
console.log(JSON.stringify(res, null, 1)); await b.close();
