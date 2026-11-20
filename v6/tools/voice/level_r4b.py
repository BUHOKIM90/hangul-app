#!/usr/bin/env python3
"""R4b: lift the peak-limited quiet clips to -16 LUFS (as heard: trim window x playback gain).

audit_r4.py --fix can only raise the playback gain up to 0.97/peak; for a few clips one click/plosive peak stops it at
-17.7..-18.6 LUFS. Here each such clip is re-encoded ONCE: volume up + a transparent lookahead limiter (1 ms attack,
-3 dBFS ceiling) that only touches those few peak samples, same format as the app (mp3 24 kHz mono 128 kbps, LAME).
The original mp3 is copied to <backup>/<key>.mp3 first (never overwritten there). Then the trim window is re-measured
exactly like trim.py and trim.json gets new [start, end, length, gain] for these keys only (backup of trim.json kept).

usage: python3 level_r4b.py <app-root> --backup DIR --keys k1,k2,...   (ffmpeg calls run via /workspace/team/bin/ffmpeg_safe)
"""
import sys, os, json, shutil, subprocess, tempfile
import numpy as np
from scipy.signal import lfilter

root = sys.argv[1]; args = sys.argv[2:]
backup = args[args.index('--backup') + 1]
keys = args[args.index('--keys') + 1].split(',')
# per-key target, e.g. --target w_appa=-17.2 (a two-syllable word with a long pause reads low in 400 ms blocks; see report)
CEIL = dict((kv.split('=')[0], float(kv.split('=')[1])) for kv in (args[args.index('--ceil') + 1].split(',') if '--ceil' in args else []))
TGT = dict((kv.split('=')[0], float(kv.split('=')[1])) for kv in (args[args.index('--target') + 1].split(',') if '--target' in args else []))
SR = 48000; TARGET = -16.0; CEIL_DB = -3.0   # mp3 encoding overshoots the ceiling by ~1-2 dB; -3 keeps the playback gain free
B1, A1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
B2, A2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]


def ff(*a, out=False):
    cmd = ['/workspace/team/bin/ffmpeg_safe', '-v', 'error', '-y'] + list(a)
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode: raise SystemExit('ffmpeg failed: ' + r.stderr.decode()[:400])
    return r.stdout


def decode(path, sr=SR):
    raw = ff('-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-')
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


def trim_window(path):
    """same speech-window rule as v6/tools/trim.py (22.05 kHz, 10 ms frames, 35/20 dB thresholds, -0.02/+0.07 s pads)"""
    sr = 22050
    x = decode(path, sr); dur = len(x) / sr
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
    st = max(0, loud[0][0] * 0.01 - 0.02); en = min(dur, loud[-1][1] * 0.01 + 0.07)
    return round(st, 3), round(en, 3), round(dur, 3)


trim_path = os.path.join(root, 'v6/tools/trim.json')
TRIM = json.load(open(trim_path))
os.makedirs(backup, exist_ok=True)
tb = os.path.join(backup, 'trim.json.before_r4b')
if not os.path.exists(tb): shutil.copy2(trim_path, tb)
TRIM0 = json.load(open(tb))                                         # windows/gains as they were before any R4b run
report = {}
for k in keys:
    src = os.path.join(root, 'audio', k + '.mp3')
    keep = os.path.join(backup, k + '.mp3')
    if not os.path.exists(keep): shutil.copy2(src, keep)          # the untouched original, kept once
    orig = keep
    st, en, dur, g0 = TRIM0[k]
    x0 = decode(orig); w0 = x0[int(st * SR):int(en * SR)]
    L_before = lufs(w0 * g0)
    T = TGT.get(k, TARGET); C = CEIL.get(k, CEIL_DB)
    lift = T - lufs(w0)                                            # dB the raw window needs
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, k + '.mp3')
    for it in range(5):
        ff('-i', orig, '-af', f'volume={lift:.2f}dB,alimiter=limit={10 ** (C / 20):.4f}:attack=1:release=40:level=disabled:asc=1',
           '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '128k', out)
        s2, e2, d2 = trim_window(out)
        x = decode(out); w = x[int(s2 * SR):int(e2 * SR)]
        L = lufs(w)
        if abs(L - T) <= 0.3: break
        lift += T - L
    # how hard the limiter worked: volume-only vs limited, sample by sample, inside the speech window
    ref = os.path.join(tmp, 'ref.wav')
    ff('-i', orig, '-af', f'volume={lift:.2f}dB', '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_f32le', ref)
    r = decode(ref)[int(s2 * SR):int(e2 * SR)]; m = min(len(r), len(w))
    lim = np.abs(r[:m]) > 10 ** (C / 20)
    gr_ms = round(float(lim.sum()) / SR * 1000, 1)
    gr_max = round(float(20 * np.log10(np.abs(r[:m]).max() / 10 ** (C / 20))), 1) if lim.any() else 0.0
    pk = float(np.abs(w).max())
    g = round(max(0.4, min(4.0, 10 ** ((T - L) / 20), 0.97 / max(pk, 1e-4))), 2)
    L_after = lufs(w * g)
    shutil.copy2(out, src)
    TRIM[k] = [s2, e2, d2, g]
    report[k] = {'target': T, 'ceiling_db': C, 'before': {'window': [st, en], 'gain': g0, 'lufs': round(L_before, 1)},
                 'after': {'window': [s2, e2], 'gain': g, 'lufs': round(L_after, 1), 'peak_db': round(20 * np.log10(pk * g + 1e-12), 1)},
                 'lift_db': round(lift, 2), 'limited_ms': gr_ms, 'limited_pct': round(100 * gr_ms / max(1, (e2 - s2) * 1000), 2), 'max_gain_reduction_db': gr_max, 'iterations': it + 1, 'speech_ms_before': round((en - st) * 1000), 'speech_ms_after': round((e2 - s2) * 1000)}
    print(k, json.dumps(report[k]))
json.dump(TRIM, open(trim_path, 'w'), separators=(',', ':'))
rp = os.path.join(backup, 'level_r4b_report.json')
allrep = json.load(open(rp)) if os.path.exists(rp) else {}
allrep.update(report)                                              # one entry per key, latest run wins
json.dump(allrep, open(rp, 'w'), indent=1)
