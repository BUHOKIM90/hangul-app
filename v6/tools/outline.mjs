// Gives every Fluent Emoji picture the characters' brown outline (#4B3642) so pictures and friends share one style.
// node v6/tools/outline.mjs <repo-root>   — idempotent (marked files are skipped).
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'v6/img/e');
const MARK = '<!--outline-->';
const LINE = '#4B3642', W = 2.1, PAD = 1.4;
let n = 0;
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.svg'))) {
  const file = path.join(dir, f);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARK)) continue;
  const m = s.match(/^<svg([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if (!m) { console.warn('skip', f); continue; }
  let attrs = m[1];
  const inner = m[2];
  const vb = (attrs.match(/viewBox="([^"]+)"/) || [])[1];
  if (!vb) { console.warn('no viewBox', f); continue; }
  const [x, y, w, h] = vb.split(/[\s,]+/).map(Number);
  attrs = attrs.replace(/viewBox="[^"]+"/, `viewBox="${x - PAD} ${y - PAD} ${w + PAD * 2} ${h + PAD * 2}"`);
  const sil = inner.replace(/<defs[\s\S]*?<\/defs>/g, '')
    .replace(/\s(fill|stroke|stroke-width|fill-opacity|stroke-opacity|opacity|clip-path|mask|filter|id|style)="[^"]*"/g, '');
  const out = `<svg${attrs}>${MARK}<g fill="${LINE}" stroke="${LINE}" stroke-width="${W}" stroke-linejoin="round" stroke-linecap="round">${sil}</g>${inner}</svg>`;
  fs.writeFileSync(file, out);
  n++;
}
console.log('outlined', n);
