#!/usr/bin/env python3
"""R5a: put accepted Sulafat takes into the app (CEO order 11/18 18:46: only lines that passed ASR + the rising-ending gate).

For every row of the manifest (asr_1118/manifest_1118.json):
  - back up an existing audio/<key>.mp3 to <backup>/<key>.mp3 (once, never overwritten), copy the accepted mp3 in;
  - measure the speech window exactly like trim.py and the playback gain to -16 LUFS as heard (K-weighted, gated,
    same as audit_r4.py), capped at 0.97/peak; write [start, end, length, gain] into v6/tools/trim.json (backup kept);
  - retake112: remove the key from v6/tools/voice/old_voice_hold.txt (backup kept);
  - newword83 / nihon5: add the key to v6/tools/voice/ready_new.txt (so data.js shows the word / app.js says the line).
Peak-limited clips that still miss -16 +-1.5 are reported; level them afterwards with level_r4b.py.

usage: python3 apply_r5a.py <app-root> <manifest.json> <dir the manifest 'file' paths are relative to> --backup DIR [--tag r5b]
"""
import sys, os, json, shutil, subprocess
import numpy as np
from scipy.signal import lfilter

root, manifest, base = sys.argv[1:4]
backup = sys.argv[sys.argv.index('--backup') + 1]
TAG = sys.argv[sys.argv.index('--tag') + 1] if '--tag' in sys.argv else 'r5a'  # R5b: same tool, own backup names
os.makedirs(backup, exist_ok=True)
SR = 48000; TARGET = -16.0
B1, A1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
B2, A2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]


def decode(path, sr):
    raw = subprocess.run(['/workspace/team/bin/ffmpeg_safe', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def lufs(x):
    y = lfilter(B2, A2, lfilter(B1, A1, x))
    n, hop = int(0.4 * SR), int(0.1 * SR)
    blocks = np.array([np.mean(y ** 2)] if len(y) <= n else [np.mean(y[i:i + n] ** 2) for i in range(0, len(y) - n + 1, hop)])
    L = -0.691 + 10 * np.log10(blocks + 1e-15)
    g = blocks[L > -70]
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = blocks[(L > -70) & (L > rel)]
    return float(-0.691 + 10 * np.log10(g2.mean()))


def window(path):
    sr = 22050; x = decode(path, sr); dur = len(x) / sr
    fl = int(sr * 0.01); n = len(x) // fl
    db = 20 * np.log10(np.sqrt((x[:n * fl].reshape(n, fl) ** 2).mean(1) + 1e-12))
    peak = db.max(); act = db > max(peak - 35, -55)
    segs = []; i = 0
    while i < n:
        if act[i]:
            j = i
            while j < n and act[j]: j += 1
            if segs and i - segs[-1][1] <= 12: segs[-1][1] = j
            else: segs.append([i, j])
            i = j
        else: i += 1
    loud = [s for s in segs if db[s[0]:s[1]].max() > peak - 20 and s[1] - s[0] >= 4] or segs
    return round(max(0, loud[0][0] * 0.01 - 0.02), 3), round(min(dur, loud[-1][1] * 0.01 + 0.07), 3), round(dur, 3)


def keep(path, name):
    dst = os.path.join(backup, name)
    if os.path.exists(path) and not os.path.exists(dst): shutil.copy2(path, dst)


M = json.load(open(manifest))
tp = os.path.join(root, 'v6/tools/trim.json'); hp = os.path.join(root, 'v6/tools/voice/old_voice_hold.txt'); rp = os.path.join(root, 'v6/tools/voice/ready_new.txt')
keep(tp, 'trim.json.before_' + TAG); keep(hp, 'old_voice_hold.txt.before_' + TAG); keep(rp, 'ready_new.txt.before_' + TAG)
TRIM = json.load(open(tp))
rows = []
for m in M:
    k = m['key']; dst = os.path.join(root, 'audio', k + '.mp3')
    keep(dst, k + '.mp3')
    shutil.copy2(os.path.join(base, m['file']), dst)
    st, en, dur = window(dst)
    x = decode(dst, SR); w = x[int(st * SR):int(en * SR)]
    pk = float(np.abs(w).max()); L0 = lufs(w)
    clip_runs = 0
    hot = np.abs(x) >= 0.999
    if hot.any():
        d = np.diff(np.concatenate([[0], hot.astype(int), [0]])); clip_runs = int(((np.where(d == -1)[0] - np.where(d == 1)[0]) >= 3).sum())
    g = round(max(0.4, min(4.0, 10 ** ((TARGET - L0) / 20), 0.97 / max(pk, 1e-4))), 2)
    L = lufs(w * g)
    TRIM[k] = [st, en, dur, g]
    r = {'key': k, 'group': m['group'], 'text': m['text'], 'window': [st, en], 'gain': g, 'lufs': round(L, 1), 'peak_dbfs': round(20 * np.log10(pk), 2),
         'clip_runs': clip_runs, 'ok': abs(L - TARGET) <= 1.5, 'replaced_old': os.path.exists(os.path.join(backup, k + '.mp3'))}
    rows.append(r); print(json.dumps(r, ensure_ascii=False))
json.dump(TRIM, open(tp, 'w'), separators=(',', ':'))
retake = {m['key'] for m in M if m['group'] == 'retake112'}
lines = open(hp).read().split('\n')
open(hp, 'w').write('\n'.join(l for l in lines if l.split('\t')[0] not in retake))
ready = [l.strip() for l in open(rp).read().split('\n') if l.strip()]
for m in M:
    if m['group'] != 'retake112' and m['key'] not in ready: ready.append(m['key'])
open(rp, 'w').write('\n'.join(ready) + '\n')
json.dump(rows, open(os.path.join(backup, 'apply_' + TAG + '_report.json'), 'w'), ensure_ascii=False, indent=1)
print('applied', len(rows), 'not ok', [r['key'] for r in rows if not r['ok']], 'clipped', [r['key'] for r in rows if r['clip_runs']])
