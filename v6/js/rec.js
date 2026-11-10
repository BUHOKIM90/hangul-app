'use strict';
/* v6 rec: family recordings kept on this device (IndexedDB) + the microphone for "내가 읽어 볼게".
   Nothing leaves the device. A family recording replaces the studio clip / device voice for the same key. */
(function (G) {
  const A = G.A;
  const Rec = { items: new Map() };
  const DB = 'hangul-rec', STORE = 'clips';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!G.indexedDB) { rej(new Error('no idb')); return; }
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'key' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => {});
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
      const out = fn(s);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    }));
  }
  /* Load every recording into the audio layer (called once after the start tap). */
  Rec.loadAll = async function () {
    try {
      const all = await tx('readonly', s => s.getAll());
      for (const it of all || []) {
        Rec.items.set(it.key, { key: it.key, label: it.label || '', date: it.date, kind: it.kind || 'clip' });
        A.setCustom(it.key, await it.blob.arrayBuffer());
      }
    } catch (e) { /* private mode / no IndexedDB: recordings are simply unavailable */ }
    return Rec.items;
  };
  Rec.put = async function (key, blob, meta) {
    meta = meta || {};
    const it = { key, blob, label: meta.label || '', kind: meta.kind || 'clip', date: new Date().toISOString().slice(0, 10) };
    await tx('readwrite', s => s.put(it));
    Rec.items.set(key, { key, label: it.label, date: it.date, kind: it.kind });
    A.setCustom(key, await blob.arrayBuffer());
  };
  Rec.del = async function (key) {
    await tx('readwrite', s => s.delete(key));
    Rec.items.delete(key);
    A.setCustom(key, null);
  };
  Rec.sentences = () => Array.from(Rec.items.values()).filter(i => i.kind === 'sentence');

  /* ---------- microphone ---------- */
  let stream = null;
  Rec.micOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && G.MediaRecorder && G.isSecureContext !== false);
  function session(t) { try { if (navigator.audioSession) navigator.audioSession.type = t; } catch (e) { /* not supported */ } }
  /* raw = the recording studio: the phone's call processing (noise/echo removal) dulls consonants, so it is turned off there */
  Rec.open = async function (raw) {
    if (stream && stream.getAudioTracks().some(t => t.readyState === 'live')) return stream;
    session('play-and-record');
    const on = !raw;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: on, noiseSuppression: on, autoGainControl: true, channelCount: 1 } });
    return stream;
  };
  /* every stored recording with its sound (for the studio's export) */
  Rec.all = () => tx('readonly', s => s.getAll()).then(a => a || []).catch(() => []);
  /* Stop the microphone so the red indicator goes away and playback returns to the speaker. */
  Rec.close = function () {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    session('playback');
    const c = A.ctx && A.ctx();
    if (c && c.state !== 'running') c.resume().catch(() => {});
  };
  function mime() {
    const c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    return c.find(t => G.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  }
  /* Record until stop() or maxMs. Resolves with a Blob. onLevel(0..1) drives the little meter. */
  Rec.record = async function (opt) {
    opt = opt || {};
    const s = await Rec.open(opt.raw);
    const type = mime();
    const mr = new MediaRecorder(s, type ? { mimeType: type } : undefined);
    const chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    let meterStop = () => {};
    const c = A.ctx && A.ctx();
    if (c && opt.onLevel) {
      try {
        const srcN = c.createMediaStreamSource(s), an = c.createAnalyser();
        an.fftSize = 512; srcN.connect(an);
        const buf = new Uint8Array(an.fftSize);
        let on = true;
        const tick = () => {
          if (!on) return;
          an.getByteTimeDomainData(buf);
          let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128));
          opt.onLevel(Math.min(1, m / 64));
          requestAnimationFrame(tick);
        };
        tick();
        meterStop = () => { on = false; try { srcN.disconnect(); } catch (e) { /* ignore */ } };
      } catch (e) { /* meter is optional */ }
    }
    const done = new Promise(res => { mr.onstop = () => { meterStop(); res(new Blob(chunks, { type: mr.mimeType || type || 'audio/mp4' })); }; });
    mr.start();
    const t = setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, opt.maxMs || 4000);
    return {
      stop() { clearTimeout(t); if (mr.state === 'recording') mr.stop(); return done; },
      done
    };
  };
  G.Rec = Rec;
})(window);
