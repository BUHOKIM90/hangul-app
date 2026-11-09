'use strict';
/* v6 write: free finger tracing over a pink guide. No snapping: the child's own line is kept.
   Done when most of the guide is covered and most ink is near the guide. */
(function (G) {
  const D = G.D, UI = G.UI, A = G.A;
  const RAINBOW = ['#FF5A7A', '#FF9F43', '#F7C600', '#2DBE7E', '#3A9BFF', '#8B6CFF'];

  function samplesOf(strokes, step) {
    const out = [];
    strokes.forEach((st, si) => {
      if (st.c) {
        const [cx, cy, r] = st.c, n = Math.max(24, Math.round(2 * Math.PI * r / step));
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 - i / n * Math.PI * 2; out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, s: si }); }
      } else {
        for (let i = 0; i < st.length - 1; i++) {
          const [x1, y1] = st[i], [x2, y2] = st[i + 1], len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(len / step));
          for (let k = 0; k <= n; k++) { if (i > 0 && k === 0) continue; out.push({ x: x1 + (x2 - x1) * k / n, y: y1 + (y2 - y1) * k / n, s: si }); }
        }
      }
    });
    return out;
  }
  function pathOf(ctx, st, sc) {
    ctx.beginPath();
    if (st.c) { const [cx, cy, r] = st.c; ctx.arc(cx * sc, cy * sc, r * sc, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2, true); }
    else { ctx.moveTo(st[0][0] * sc, st[0][1] * sc); st.slice(1).forEach(p => ctx.lineTo(p[0] * sc, p[1] * sc)); }
  }
  function startOf(st) { return st.c ? [st.c[0], st.c[1] - st.c[2]] : st[0]; }
  function dirOf(st) {
    if (st.c) return [-1, 0];
    const [a, b] = st, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  }

  /* Build a tracing board in `host` for character `ch`. Returns {done: Promise, destroy()}. */
  function board(host, ch, opt) {
    opt = opt || {};
    const strokes = D.strokesFor(ch);
    const wrap = UI.el('div', 'write-board');
    const guide = UI.el('canvas', 'write-guide'), ink = UI.el('canvas', 'write-ink');
    wrap.append(guide, ink);
    host.appendChild(wrap);
    const syll = ch.length === 1 && !!D.split(ch);
    const dpr = Math.min(3, G.devicePixelRatio || 1);
    let size = 0, sc = 1, samples = [], cov = [], inkPts = [], nearCount = 0, active = null, strokeNo = 0, finished = false;
    let resolveDone;
    const done = new Promise(r => { resolveDone = r; });
    const gx = guide.getContext('2d'), ix = ink.getContext('2d');
    const widthU = syll ? 9.5 : 13; /* guide stroke width in 100-units */

    function layout() {
      const r = host.getBoundingClientRect();
      size = Math.floor(Math.max(160, Math.min(r.width, r.height) * 0.96));
      wrap.style.width = wrap.style.height = size + 'px';
      [guide, ink].forEach(c => { c.width = size * dpr; c.height = size * dpr; c.style.width = c.style.height = size + 'px'; });
      sc = size / 100;
      samples = samplesOf(strokes, 2.2);
      cov = samples.map(() => false);
      inkPts = []; nearCount = 0;
      ix.setTransform(dpr, 0, 0, dpr, 0, 0); ix.clearRect(0, 0, size, size);
      drawGuide();
    }
    function drawGuide(progress) {
      gx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gx.clearRect(0, 0, size, size);
      /* paper grid */
      gx.strokeStyle = 'rgba(44,62,107,.08)'; gx.lineWidth = 2; gx.setLineDash([6, 8]);
      gx.beginPath(); gx.moveTo(size / 2, 6); gx.lineTo(size / 2, size - 6); gx.moveTo(6, size / 2); gx.lineTo(size - 6, size / 2); gx.stroke();
      gx.setLineDash([]);
      gx.lineCap = 'round'; gx.lineJoin = 'round';
      const alpha = opt.faint ? 0.38 : 1;
      strokes.forEach(st => {
        pathOf(gx, st, sc);
        gx.strokeStyle = `rgba(255,143,184,${alpha})`; gx.lineWidth = widthU * sc; gx.stroke();
      });
      /* covered parts get a deeper pink */
      gx.fillStyle = 'rgba(255,90,140,.55)';
      samples.forEach((p, i) => { if (cov[i]) { gx.beginPath(); gx.arc(p.x * sc, p.y * sc, widthU * sc * 0.42, 0, Math.PI * 2); gx.fill(); } });
      /* white centre dashes show direction */
      gx.strokeStyle = 'rgba(255,255,255,.9)'; gx.lineWidth = Math.max(2, sc * 1.1); gx.setLineDash([sc * 3, sc * 4]);
      strokes.forEach(st => { pathOf(gx, st, sc); gx.stroke(); });
      gx.setLineDash([]);
      /* numbered start dots + arrow (dots that would sit on top of an earlier dot slide along their stroke) */
      const placed = [];
      strokes.forEach((st, i) => {
        let [x, y] = startOf(st);
        const [dx, dy] = dirOf(st);
        for (let k = 0; k < 3 && placed.some(([px, py]) => Math.hypot(px - x, py - y) < widthU * 1.1); k++) { x += dx * widthU * 1.15; y += dy * widthU * 1.15; }
        placed.push([x, y]);
        const dr = strokes.length > 6 ? 0.46 : 0.62;
        gx.fillStyle = '#3CC48A'; gx.beginPath(); gx.arc(x * sc, y * sc, widthU * sc * dr, 0, Math.PI * 2); gx.fill();
        gx.fillStyle = '#fff'; gx.font = `bold ${Math.round(widthU * sc * dr * 1.3)}px Jua, sans-serif`; gx.textAlign = 'center'; gx.textBaseline = 'middle';
        gx.fillText(String(i + 1), x * sc, y * sc + 1);
        const ax = (x + dx * widthU * 1.1) * sc, ay = (y + dy * widthU * 1.1) * sc;
        gx.fillStyle = 'rgba(60,196,138,.9)'; gx.beginPath();
        gx.moveTo(ax + dx * sc * 4, ay + dy * sc * 4); gx.lineTo(ax - dy * sc * 3, ay + dx * sc * 3); gx.lineTo(ax + dy * sc * 3, ay - dx * sc * 3); gx.fill();
      });
      if (progress !== undefined) {
        /* demo sparkle */
        const p = samples[Math.min(samples.length - 1, Math.floor(progress * samples.length))];
        if (p) { gx.font = `${Math.round(sc * 12)}px sans-serif`; gx.fillText('✨', p.x * sc, p.y * sc); }
      }
    }
    function demo() {
      const t0 = performance.now(), T = 600 + samples.length * 9;
      const step = () => {
        if (finished || inkPts.length) { drawGuide(); return; }
        const k = (performance.now() - t0) / T;
        if (k >= 1) { drawGuide(); return; }
        drawGuide(k); requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    function local(e) { const r = ink.getBoundingClientRect(); return [(e.clientX - r.left) / sc, (e.clientY - r.top) / sc]; }
    const tolCov = syll ? 6.5 : 8.5, tolNear = syll ? 11 : 14;
    function addPoint(p) {
      inkPts.push(p);
      let near = false, changed = false;
      for (let i = 0; i < samples.length; i++) {
        const d = Math.hypot(samples[i].x - p[0], samples[i].y - p[1]);
        if (d < tolNear) near = true;
        if (!cov[i] && d < tolCov) { cov[i] = true; changed = true; }
      }
      if (near) nearCount++;
      return changed;
    }
    function stats() {
      const c = cov.filter(Boolean).length / cov.length;
      const per = strokes.map((_, si) => { const idx = samples.map((s, i) => [s, i]).filter(([s]) => s.s === si); return idx.filter(([, i]) => cov[i]).length / idx.length; });
      const prec = inkPts.length ? nearCount / inkPts.length : 0;
      return { c, minStroke: Math.min.apply(null, per), prec };
    }
    function check(final) {
      const s = stats();
      if (s.c >= 0.8 && s.minStroke >= 0.6 && s.prec >= 0.5) { win(); return; }
      if (final && s.c >= 0.8 && s.prec < 0.5) {
        UI.oops(wrap);
        setTimeout(clear, 450);
      }
    }
    function win() {
      if (finished) return;
      finished = true;
      wrap.classList.add('done');
      cov = cov.map(() => true); drawGuide();
      resolveDone({ ok: true, stats: stats() });
    }
    function clear() {
      if (finished) return;
      inkPts = []; nearCount = 0; cov = cov.map(() => false);
      ix.clearRect(0, 0, size, size); drawGuide();
    }
    ink.addEventListener('pointerdown', e => {
      if (finished || active !== null) return;
      e.preventDefault();
      active = e.pointerId;
      try { ink.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      const p = local(e);
      ix.strokeStyle = RAINBOW[strokeNo++ % RAINBOW.length];
      ix.lineWidth = Math.max(10, widthU * sc * 0.55); ix.lineCap = 'round'; ix.lineJoin = 'round';
      ix.beginPath(); ix.moveTo(p[0] * sc, p[1] * sc); ix.lineTo(p[0] * sc + 0.1, p[1] * sc); ix.stroke();
      ink._last = p;
      if (addPoint(p)) drawGuide();
    });
    ink.addEventListener('pointermove', e => {
      if (e.pointerId !== active || finished) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      let changed = false;
      evs.forEach(ev => {
        const p = local(ev), q = ink._last;
        const n = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 1.5));
        for (let k = 1; k <= n; k++) if (addPoint([q[0] + (p[0] - q[0]) * k / n, q[1] + (p[1] - q[1]) * k / n])) changed = true;
        ix.beginPath(); ix.moveTo(q[0] * sc, q[1] * sc); ix.lineTo(p[0] * sc, p[1] * sc); ix.stroke();
        ink._last = p;
      });
      if (changed) { drawGuide(); if (Math.random() < 0.25) A.sfx('ink'); }
      check(false);
    });
    const up = e => { if (e.pointerId !== active) return; active = null; check(true); };
    ink.addEventListener('pointerup', up);
    ink.addEventListener('pointercancel', up);
    let lastW = 0, lastH = 0;
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      if (finished || (Math.abs(r.width - lastW) < 8 && Math.abs(r.height - lastH) < 8)) return;
      lastW = r.width; lastH = r.height; layout();
    });
    { const r = host.getBoundingClientRect(); lastW = r.width; lastH = r.height; }
    layout();
    ro.observe(host);
    demo();
    return { done, clear, wrap, destroy() { ro.disconnect(); wrap.remove(); }, _test: { samples: () => samples, size: () => size, stats } };
  }
  G.W = { board, samplesOf };
})(window);
