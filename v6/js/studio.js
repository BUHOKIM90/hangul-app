'use strict';
/* v6 studio: 우리 집 녹음실 — a parent records every line the app speaks, one tap per line.
   Recordings live on this device (IndexedDB) and replace the app voice at once; "묶음으로 저장" makes one
   file to send to the maker, who puts the voice into the app for every device. */
(function (G) {
  const A = G.A, UI = G.UI;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CHAPTERS = [
    ['글자 소리', ['sy'], '글자 하나만, 또박또박. 예: "가"'],
    ['자음·모음 이름', ['j'], '쓰인 그대로 천천히'],
    ['낱말', ['w'], '낱말 하나만 또렷하게'],
    ['글자·낱말 알려 주는 말', ['hy', 'dy', 'fy'], '아이에게 말하듯 다정하게'],
    ['칭찬·안내·이야기', ['ui', 'ui4', 'c', 's', 'v'], '신나고 따뜻하게']
  ];
  const Studio = {};
  let LINES = null, root = null, cur = null, rec = null, chap = 0, idx = 0, busy = false;

  async function lines() {
    if (LINES) return LINES;
    LINES = await (await fetch('v6/tools/voice/lines.json', { cache: 'no-cache' })).json();
    return LINES;
  }
  const kind = k => k.split('_')[0];
  const keysOf = c => Object.keys(LINES).filter(k => CHAPTERS[c][1].includes(kind(k)));
  const has = k => G.Rec.items.has(k) && G.Rec.items.get(k).kind === 'studio';
  const countAll = () => Object.keys(LINES).filter(has).length;
  const show = t => t.replace(/[.]$/, '');

  function home() {
    stopRec();
    const total = Object.keys(LINES).length, done = countAll();
    root.innerHTML = `<div class="st-top"><button type="button" class="pm-btn st-x">← 어른 메뉴</button><b>우리 집 녹음실</b><span>${done} / ${total}</span></div>
      <div class="st-body">
        <p class="st-lead">앱이 하는 모든 말을 엄마·아빠 목소리로 바꿉니다. 한 줄에 한 번만 누르면 되고, 녹음한 줄부터 바로 그 목소리로 나옵니다. 한 번에 다 하지 않아도 됩니다(이어서 하기).</p>
        <ul class="st-tips"><li>조용한 방에서, 기기를 입에서 한 뼘(15cm)쯤 떨어뜨려 주세요.</li><li>려원이에게 말하듯 밝게, 또박또박. 글자 소리는 그 글자만 짧게.</li><li>말이 끝나면 저절로 멈추고 들려줍니다. 마음에 안 들면 '다시'.</li></ul>
        <div class="st-chaps">${CHAPTERS.map((c, i) => { const ks = keysOf(i), n = ks.filter(has).length; return `<button type="button" class="st-chap${n === ks.length ? ' full' : ''}" data-c="${i}"><b>${esc(c[0])}</b><span>${n} / ${ks.length}</span><i style="width:${Math.round(100 * n / ks.length)}%"></i></button>`; }).join('')}</div>
        <div class="st-foot">
          <button type="button" class="pm-btn" id="stExport"${done ? '' : ' disabled'}>녹음 묶음으로 저장 (${done}개) — 모든 기기에 넣기</button>
          <p class="pm-small">저장된 파일(려원-목소리.zip)을 앱 만든 곳(Claude 대화)에 보내 주시면, 소리를 다듬어 앱에 넣어 아이패드·아이폰 어디서나 그 목소리로 나오게 합니다.</p>
          <button type="button" class="pm-btn warn" id="stClear"${done ? '' : ' disabled'}>녹음실 녹음 모두 지우기 (앱 목소리로 되돌리기)</button>
          <p class="pm-small" id="stMsg"></p>
        </div>
      </div>`;
    root.querySelector('.st-x').onclick = Studio.close;
    root.querySelectorAll('.st-chap').forEach(b => { b.onclick = () => { chap = +b.dataset.c; const ks = keysOf(chap); idx = Math.max(0, ks.findIndex(k => !has(k))); line(); }; });
    root.querySelector('#stExport').onclick = exportZip;
    root.querySelector('#stClear').onclick = async () => {
      if (!G.confirm('녹음실에서 녹음한 목소리를 이 기기에서 모두 지울까요?')) return;
      for (const k of Object.keys(LINES).filter(has)) await G.Rec.del(k);
      home();
    };
  }

  function line() {
    stopRec();
    const ks = keysOf(chap);
    if (idx >= ks.length) idx = ks.length - 1;
    cur = ks[idx];
    const text = LINES[cur], done = ks.filter(has).length, k = kind(cur);
    root.innerHTML = `<div class="st-top"><button type="button" class="pm-btn st-x">← 목록</button><b>${esc(CHAPTERS[chap][0])}</b><span>${done} / ${ks.length}</span></div>
      <div class="st-line">
        <p class="st-hint">${esc(CHAPTERS[chap][2])}</p>
        <div class="st-text ${k === 'sy' ? 'one' : text.length > 16 ? 'long' : ''}">${esc(show(text))}</div>
        <div class="st-meter"><i></i></div>
        <p class="st-state" id="stState">${has(cur) ? '녹음했어요. 다시 해도 됩니다.' : '● 를 누르고 읽어 주세요'}</p>
        <button type="button" class="st-rec" id="stRec" aria-label="녹음">●</button>
        <div class="st-row">
          <button type="button" class="pm-btn" id="stPrev"${idx ? '' : ' disabled'}>◀ 앞</button>
          <button type="button" class="pm-btn" id="stHear">▶ ${has(cur) ? '내 녹음 듣기' : '지금 앱 소리'}</button>
          ${has(cur) ? '<button type="button" class="pm-btn warn" id="stDel">지우기</button>' : ''}
          <button type="button" class="pm-btn go" id="stNext">${idx < ks.length - 1 ? '다음 ▶' : '끝! 목록으로'}</button>
        </div>
        <p class="pm-small">${idx + 1}번째 / ${ks.length}</p>
      </div>`;
    root.querySelector('.st-x').onclick = home;
    root.querySelector('#stRec').onclick = toggle;
    root.querySelector('#stPrev').onclick = () => { idx--; line(); };
    root.querySelector('#stNext').onclick = next;
    root.querySelector('#stHear').onclick = () => { A.init(); A.play(cur); };
    const d = root.querySelector('#stDel');
    if (d) d.onclick = async () => { await G.Rec.del(cur); line(); };
  }
  function next() { const ks = keysOf(chap); if (idx < ks.length - 1) { idx++; line(); } else home(); }

  function stopRec() { if (rec) { const r = rec; rec = null; r.stop().catch(() => {}); G.Rec.close(); } }
  async function toggle() {
    if (busy) return;
    const btn = root.querySelector('#stRec'), state = root.querySelector('#stState'), bar = root.querySelector('.st-meter i');
    if (rec) { finish(); return; }
    busy = true;
    try {
      A.init(); A.stop();
      const key = cur, long = LINES[key].length > 8;
      let heard = 0, quiet = 0, last = performance.now(), peak = 0;
      rec = await G.Rec.record({
        raw: true, maxMs: long ? 14000 : 6000,
        onLevel: v => {
          const now = performance.now(), dt = now - last; last = now;
          if (bar) bar.style.width = Math.round(v * 100) + '%';
          peak = Math.max(peak, v);
          if (v > 0.14) { heard += dt; quiet = 0; } else if (heard > 120) { quiet += dt; if (quiet > (long ? 1100 : 800) && rec && cur === key) finish(); }
        }
      });
      rec.key = key; rec.peak = () => peak; rec.heard = () => heard;
      btn.classList.add('on'); btn.textContent = '■'; state.textContent = '듣고 있어요… 말이 끝나면 저절로 멈춥니다';
      rec.done.then(() => { if (rec && rec.key === key) finish(); });
    } catch (e) { rec = null; state.textContent = '마이크를 쓸 수 없어요. 설정 > Safari > 마이크를 허용해 주세요.'; }
    busy = false;
  }
  async function finish() {
    if (!rec) return;
    const r = rec; rec = null; busy = true;
    const blob = await r.stop(); G.Rec.close();
    const state = root.querySelector('#stState');
    if (cur !== r.key) { busy = false; return; }
    if (blob.size < 800 || r.heard() < 80) { busy = false; line(); const s2 = root.querySelector('#stState'); if (s2) s2.textContent = '소리가 안 들렸어요. 조금 더 크게 다시 해 주세요.'; return; }
    await G.Rec.put(r.key, blob, { label: LINES[r.key], kind: 'studio' });
    busy = false;
    line();
    const s3 = root.querySelector('#stState');
    if (s3) s3.textContent = r.peak() > 0.97 ? '녹음됐어요. 소리가 너무 커서 찌그러졌을 수 있어요 — 조금 멀리서 다시 해 보세요.' : '녹음됐어요! 들어 보고 좋으면 다음으로.';
    A.init(); A.play(r.key);
  }

  /* ---------- export: a plain (stored) zip, no library ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + f.data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  }
  Studio.zip = zip;
  async function exportZip() {
    const msg = root.querySelector('#stMsg');
    msg.textContent = '묶는 중…';
    const all = (await G.Rec.all()).filter(r => r.kind === 'studio' && LINES[r.key]);
    const ext = t => /mp4|m4a|aac/.test(t) ? 'm4a' : /webm/.test(t) ? 'webm' : /ogg/.test(t) ? 'ogg' : 'bin';
    const files = [], man = {};
    for (const r of all) {
      const name = r.key + '.' + ext(r.blob.type || '');
      files.push({ name, data: new Uint8Array(await r.blob.arrayBuffer()) });
      man[r.key] = { file: name, text: LINES[r.key], date: r.date };
    }
    files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ app: 'hangul-v6', made: new Date().toISOString(), clips: man })) });
    const blob = zip(files), fname = '려원-목소리.zip';
    try {
      const file = new File([blob], fname, { type: 'application/zip' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '려원 한글 놀이 목소리' }); msg.textContent = '저장했어요. 이 파일을 Claude 대화에 올려 주세요.'; return; }
    } catch (e) { if (e && e.name === 'AbortError') { msg.textContent = ''; return; } }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    msg.textContent = '파일(려원-목소리.zip)을 내려받았어요. 이 파일을 Claude 대화에 올려 주세요.';
  }

  Studio.open = async function () {
    if (root) return;
    root = document.createElement('div');
    root.className = 'studio';
    root.innerHTML = '<p class="st-lead">불러오는 중…</p>';
    document.body.appendChild(root);
    try { await lines(); } catch (e) { root.innerHTML = '<div class="st-top"><button type="button" class="pm-btn st-x">← 닫기</button></div><p class="st-lead">문장 목록을 불러오지 못했어요. 인터넷에 연결한 뒤 다시 열어 주세요.</p>'; root.querySelector('.st-x').onclick = Studio.close; return; }
    if (!G.Rec || !G.Rec.micOk()) { root.innerHTML = '<div class="st-top"><button type="button" class="pm-btn st-x">← 닫기</button></div><p class="st-lead">이 브라우저에서는 녹음할 수 없어요. 아이폰·아이패드의 Safari에서 열어 주세요.</p>'; root.querySelector('.st-x').onclick = Studio.close; return; }
    home();
  };
  Studio.close = function () { stopRec(); if (root) root.remove(); root = null; if (Studio.onClose) Studio.onClose(); };
  G.Studio = Studio;
})(window);
