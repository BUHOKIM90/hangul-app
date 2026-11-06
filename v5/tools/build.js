'use strict';
/* Build audio catalogs, subset font, and the v5 service worker. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const rel = p => path.relative(root, p).split(path.sep).join('/');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'v5/js/content.js'), 'utf8'), ctx);
const V5C = ctx.V5C;

const audioDir = path.join(root, 'audio');
const mp3 = fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4));
const have = new Set(mp3);
fs.writeFileSync(path.join(audioDir, 'have.js'), "'use strict';\nconst HAVE_AUDIO = new Set(" + JSON.stringify(mp3) + ");\n");

let linesSrc = fs.readFileSync(path.join(root, 'v3/audio/lines.js'), 'utf8');
const lineCtx = {};
vm.createContext(lineCtx);
vm.runInContext(linesSrc.replace('const LINES', 'globalThis.LINES'), lineCtx);
const LINES = lineCtx.LINES || {};
Object.entries(V5C.WORDS).forEach(([id, row]) => {
  const k = 'w_' + id;
  if (!LINES[k]) LINES[k] = row[0] + '.';
});
V5C.LESSONS.forEach(l => {
  l.chant.forEach(s => { const k = V5C.sylKey(s); if (!LINES[k]) LINES[k] = s + '.'; });
  const b = l.blocks;
  if (!LINES[V5C.sylKey(b.say)]) LINES[V5C.sylKey(b.say)] = b.say + '.';
  l.jamo.forEach(j => {
    const k = V5C.jamoKey(j);
    if (!LINES[k] && V5C.JAMO[j]) LINES[k] = V5C.JAMO[j].name + '.';
  });
});
const body = Object.entries(LINES).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n');
fs.writeFileSync(path.join(audioDir, 'lines.js'), "'use strict';\nconst LINES = {\n" + body + "\n};\n");

const chars = new Set();
function eat(s) { for (const ch of String(s)) chars.add(ch); }
function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (p.includes('node_modules') || p.endsWith('/v1') || p.endsWith('/v3')) return;
    for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    return;
  }
  if (/\.(js|html|css|json|md)$/.test(p) && !p.endsWith('have.js') && !p.endsWith('lines.js')) eat(fs.readFileSync(p, 'utf8'));
}
['v5', 'index.html', 'manifest.json', 'assets/dress/manifest.json', 'assets/stickers/manifest.json', 'assets/friends/STYLE_GUIDE.md'].forEach(p => {
  const abs = path.join(root, p);
  if (fs.existsSync(abs)) walk(abs);
});
eat('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
eat(' .,!?:;+-=()/·…“”‘’~%');
const textFile = '/tmp/jua-chars.txt';
fs.writeFileSync(textFile, [...chars].join(''));
const py = process.env.HOME + '/.local/bin/pyftsubset';
execFileSync(py, [
  '/tmp/fonts/Jua-Regular.ttf',
  '--text-file=' + textFile,
  '--flavor=woff2',
  '--output-file=' + path.join(root, 'fonts/Jua-Regular.woff2')
], { stdio: 'inherit' });
fs.copyFileSync('/tmp/fonts/OFL.txt', path.join(root, 'fonts/Jua-OFL.txt'));

const files = new Set(['./', 'index.html', 'manifest.json', 'audio/have.js', 'audio/lines.js', 'fonts/Jua-Regular.woff2', 'fonts/Jua-OFL.txt']);
function add(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new Error('missing ' + relPath);
  files.add(relPath);
}
function addTree(dir) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const p = path.join(dir, name);
    const abs = path.join(root, p);
    if (fs.statSync(abs).isDirectory()) addTree(p);
    else add(p);
  }
}
addTree('v5/css');
addTree('v5/js');
addTree('icons');
addTree('assets/dress');
addTree('assets/friends');
addTree('assets/stickers');
['monggeul_basic', 'monggeul_wave', 'monggeul_think', 'monggeul_laugh', 'monggeul_clap', 'monggeul_cheer', 'monggeul_jump'].forEach(id => add('assets/char/' + id + '.webp'));
Object.keys(V5C.WORDS).forEach(id => add('assets/pic/' + id + '.webp'));
add('assets/pic/chest_closed.webp');
add('assets/pic/chest_open.webp');
const keys = V5C.audioKeys().concat(['ui_sticker', 'ui_hello', 'ui_end', 'ui_book']);
const missingAudio = [];
keys.forEach(k => {
  if (have.has(k)) add('audio/' + k + '.mp3');
  else missingAudio.push(k);
});
if (missingAudio.length) console.log('audio without files', missingAudio.join(' '));
const list = [...files].sort();
const hash = crypto.createHash('sha256');
hash.update(list.join('\n'));
list.forEach(relPath => {
  if (relPath === './') return;
  const abs = path.join(root, relPath);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.statSync(abs).size < 2000000) hash.update(fs.readFileSync(abs));
  else if (fs.existsSync(abs) && fs.statSync(abs).isFile()) hash.update(String(fs.statSync(abs).size));
});
const digest = hash.digest('hex').slice(0, 8);
const cache = 'hangul-v5-' + digest;
const sw = `'use strict';
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(list)};
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(FILES.map(async url => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res && res.ok) await cache.put(url, res);
      } catch (err) { /* one missing file must not fail install */ }
    }));
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('hangul-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
function rangeFromCache(req, full) {
  const range = req.headers.get('range');
  if (!range) return Promise.resolve(full);
  const m = /bytes=([0-9]*)-([0-9]*)/.exec(range);
  if (!m) return Promise.resolve(full);
  return full.arrayBuffer().then(buf => {
    const size = buf.byteLength;
    let start = m[1] ? +m[1] : 0;
    let end = m[2] ? +m[2] : size - 1;
    if (start >= size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    }
    end = Math.min(end, size - 1);
    const slice = buf.slice(start, end + 1);
    const headers = new Headers(full.headers);
    headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
    headers.set('Content-Length', String(slice.byteLength));
    headers.set('Accept-Ranges', 'bytes');
    return new Response(slice, { status: 206, headers });
  });
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) {
      if (event.request.headers.get('range')) return rangeFromCache(event.request, cached);
      return cached;
    }
    try {
      const res = await fetch(event.request);
      if (res && res.ok && !event.request.headers.get('range')) cache.put(event.request, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
`;
fs.writeFileSync(path.join(root, 'sw.js'), sw);
console.log('CACHE', cache, 'files', list.length, 'font', fs.statSync(path.join(root, 'fonts/Jua-Regular.woff2')).size);
