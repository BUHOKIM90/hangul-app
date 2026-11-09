#!/usr/bin/env python3
"""Play-through QA: plays real stages start to finish like a child would (using the app's own answer hook),
on several screen sizes, and reports JS errors, stuck stages and buttons that fall off the screen.

  python3 -m http.server 8770 --directory <repo>      # serve the repo (or a checkout of the deployed commit)
  python3 v6/tools/qa.py http://localhost:8770/ [--sizes 1180x820,820x1180,844x390] [--stages all|1,8,61] [--shots DIR]

Needs: pip install playwright && playwright install chromium. Exit code 1 if anything failed.
"""
import argparse, asyncio, json, os, sys
from playwright.async_api import async_playwright

STEP = r"""
async () => {
  const q = s => document.querySelector(s), vis = e => e && e.isConnected && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
  const c = e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  if (q('.modal .mbtn')) return { click: c(q('.modal .mbtn')), what: 'modal' };
  if (q('.gift-box')) return { click: c(q('.gift-box')), what: 'gift' };
  if (q('.chest:not(.open)')) return { click: c(q('.chest')), what: 'chest' };
  const b = window.__board;
  if (q('.write-board:not(.done)') && b && b.wrap.isConnected && window.__drawnFor !== b) {
    window.__drawnFor = b;
    const sm = b._test.samples(), sz = b._test.size(), r = b.wrap.getBoundingClientRect(), by = {};
    sm.forEach(p => { (by[p.s] = by[p.s] || []).push([r.left + p.x * sz / 100, r.top + p.y * sz / 100]); });
    return { draw: Object.keys(by).sort((a, b) => a - b).map(k => by[k]), what: 'trace' };
  }
  const nb = [...document.querySelectorAll('.intro .next-btn, .meet .next-btn')].find(vis); if (nb) return { click: c(nb), what: 'next' };
  if (q('.drum.next')) return { click: c(q('.drum')), what: 'drum' };
  if (q('.mcard')) {
    const all = [...document.querySelectorAll('.mcard:not(.matched)')], open = all.find(x => x.classList.contains('open'));
    if (open) { const m = all.find(x => x !== open && x.dataset.k === open.dataset.k); if (m) return { click: c(m), what: 'mem2' }; }
    else if (all.length) return { click: c(all[0]), what: 'mem1' };
  }
  const a = window.__answer;
  if (a != null) {
    const n = a.startsWith('i') && q('.cell') ? q('.cell[data-i="' + a.slice(1) + '"]') : [...document.querySelectorAll('.play [data-v]')].find(x => x.dataset.v === a && vis(x) && !x.classList.contains('lifted'));
    if (n && vis(n)) return { click: c(n), what: 'ans ' + a };
  }
  if (q('.twin-card.next')) return { click: c(q('.twin-card.next')), what: 'twin' };
  return { what: 'wait', screen: App.screen, play: (q('.play') || { dataset: {} }).dataset.play || '' };
}
"""
# buttons the child must reach: fully on screen?
LAYOUT = r"""
() => {
  const W = innerWidth, H = innerHeight, bad = [];
  document.querySelectorAll('#main button, .modal button, .gift-drop button').forEach(e => {
    if (e.classList.contains('ghost') || e.closest('.pond') || e.closest('.deco-tray') || e.closest('.closet-grid') || e.closest('.pg')) return;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (!r.width || cs.visibility === 'hidden' || e.hidden) return;
    if (r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2)
      bad.push((e.className || e.tagName).toString().slice(0, 40) + ' ' + (e.textContent || '').trim().slice(0, 12) + ` [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
    if (r.width < 44 || r.height < 44) bad.push('small ' + (e.className || '').toString().slice(0, 30) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
  return bad;
}
"""
SEED = r"""
([sid, done]) => {
  const d = new Date(), day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const s = { v: 1, learn: { stage: sid, done, score: {}, items: {}, today: { date: '', count: 0 }, checks: [], reviews: 0, cv: 2, log: {}, novel: {} },
    reward: { stars: 30, xp: 0, level: 5, friend: 'tori', stickers: { 1: 2, 3: 1, 5: 1, 7: 1 }, newStickers: [], outfits: [], wear: {}, daily: { last: day, idx: 1 },
      streak: { last: day, count: 2, best: 2, marks: [] }, scenes: {}, met: [], told: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    settings: { perDay: 9, voice: 1, sfx: 0.6, bgm: false, strokes: 'soft', mic: true } };
  localStorage.setItem('hangul-v6', JSON.stringify(s));
}
"""

async def run_stage(pg, sid, shots, tag, report, rehook=None):
    done = {str(i): 1 for i in range(1, max(1, sid))}
    await pg.evaluate(SEED, [max(1, sid), done])
    await pg.reload(); await pg.wait_for_timeout(500)
    if rehook: await rehook()
    go = await pg.query_selector('.splash-go')
    bb = await go.bounding_box()
    await pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    await pg.wait_for_timeout(1200)
    if sid == 0:
        title = '복습 모험'
        await pg.evaluate("() => { App.runStage({ id: 0, w: St.stage().w, k: 'review', title: '복습 모험' }); return 1; }")
    else:
        title = await pg.evaluate("D.STAGES[St.s.learn.stage - 1].title")
        await pg.evaluate("() => { App.runStage(St.stage()); return 1; }")
    seen, layout, t, waits = [], set(), 0, 0
    while t < 400:
        t += 1
        st = await pg.evaluate(STEP)
        if st['what'] == 'wait':
            waits += 1
            if st.get('screen') == 'home' and t > 5: break
            if waits > 120: break
            await pg.wait_for_timeout(300)
        else:
            waits = 0
            if 'click' in st:
                x, y = st['click']; await pg.mouse.click(x, y)
            if 'draw' in st:
                for stroke in st['draw']:
                    await pg.mouse.move(*stroke[0]); await pg.mouse.down()
                    for p in stroke[1::2]: await pg.mouse.move(*p)
                    await pg.mouse.move(*stroke[-1]); await pg.mouse.up(); await pg.wait_for_timeout(60)
            await pg.wait_for_timeout(200)
        pl = await pg.evaluate("(document.querySelector('.play') || { dataset: {} }).dataset.play || ''")
        if pl and pl not in seen:
            seen.append(pl)
            await pg.wait_for_timeout(500)
            for b in await pg.evaluate(LAYOUT): layout.add(f'{pl}: {b}')
            if shots: await pg.screenshot(path=f'{shots}/{tag}_s{sid}_{len(seen)}_{pl}.png')
    ok = await pg.evaluate("App.screen") == 'home'
    report.append({'size': tag, 'stage': sid, 'title': title, 'ok': ok, 'plays': seen, 'layout': sorted(layout)})
    print(f"[{tag}] {'OK ' if ok else 'STUCK'} {sid} {title}: {' '.join(seen)}" + (f"\n    layout: {sorted(layout)}" if layout else ''), flush=True)
    if not ok and shots: await pg.screenshot(path=f'{shots}/{tag}_s{sid}_STUCK.png')

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('base'); ap.add_argument('--sizes', default='1180x820'); ap.add_argument('--stages', default='kinds'); ap.add_argument('--shots', default='')
    a = ap.parse_args()
    if a.shots: os.makedirs(a.shots, exist_ok=True)
    report, errors = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        for size in a.sizes.split(','):
            w, h = map(int, size.split('x'))
            ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=False)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, s=size: errors.append(f'[{s}] PAGEERR {e}'))
            pg.on('console', lambda m, s=size: errors.append(f'[{s}] {m.type} {m.text[:200]}') if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            await pg.goto(a.base + 'index.html'); await pg.wait_for_timeout(400)
            await pg.evaluate("() => localStorage.removeItem('qa-silent')")
            # voice audit: every key the app asks to speak must be a real recording
            await pg.evaluate("""() => { window.__silent = new Set(); const orig = A.play; A.play = function (k, o) { const r = A.realKey(k); if (r && !window.TRIM[r] && !A.hasCustom(r)) window.__silent.add(r); return orig.call(this, k, o); }; }""")
            if a.stages in ('kinds', 'all'):
                stages = await pg.evaluate("""(all) => { const seen = {}, out = []; D.STAGES.forEach(s => { const k = s.k + (s.k === 'name' ? s.n : ''); if (all || !seen[k]) { seen[k] = 1; out.push(s.id); } }); return out.concat([0]); }""", a.stages == 'all')
            else:
                stages = [int(x) for x in a.stages.split(',')]
            async def rehook():
                await pg.evaluate("""() => { if (A.__hooked) return; A.__hooked = 1; window.__silent = window.__silent || new Set(); const orig = A.play; A.play = function (k, o) { const r = A.realKey(k); if (r && !window.TRIM[r] && !A.hasCustom(r)) { window.__silent.add(r); try { localStorage.setItem('qa-silent', JSON.stringify([...new Set(JSON.parse(localStorage.getItem('qa-silent') || '[]').concat([r]))])); } catch (e) {} } return orig.call(this, k, o); }; }""")
            pg.on('load', lambda _: None)
            for sid in stages:
                try: await run_stage(pg, sid, a.shots, size, report, rehook)
                except Exception as e:
                    report.append({'size': size, 'stage': sid, 'ok': False, 'error': str(e)}); print(f'[{size}] EXC {sid} {e}', flush=True)
            silent = await pg.evaluate("JSON.parse(localStorage.getItem('qa-silent') || '[]')")
            if silent: errors.append(f'[{size}] lines with no recording (silent): {silent}')
            await ctx.close()
        await b.close()
    bad = [r for r in report if not r.get('ok') or r.get('layout')]
    print(f"\n{len(report)} stage runs, {len([r for r in report if r.get('ok')])} finished, {len(bad)} with problems, {len(errors)} JS errors")
    for e in errors[:40]: print(e)
    sys.exit(1 if bad or errors else 0)

if __name__ == '__main__':
    asyncio.run(main())
