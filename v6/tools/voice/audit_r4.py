#!/usr/bin/env python3
"""R4 voice audit — what the child actually hears (trim window + playback gain from v6/tools/trim.json).

For every clip the app uses (window.TRIM in v6/js/trim.js):
  - clipping: samples at |x| >= 0.999 in the file (runs of >= 3) and peak after the playback gain
  - silence inside the played window at the start / end (> 120 ms; threshold = 35 dB under the clip's loudest 10 ms)
  - loudness after gain: ITU-R BS.1770-4 K-weighted, gated (-70 LUFS abs, -10 LU rel), 400 ms blocks / 75 % overlap
    (clips shorter than 400 ms: one block = the whole window). Target -16 LUFS +-1.5.
Optional --fix: writes a corrected trim.json (gain to -16 LUFS within the peak limit 0.97, and the window tightened to
  <= 100 ms of silence at the start and <= 120 ms at the end). The mp3 files are never changed. A backup of trim.json is
  written next to --backup.

usage: python3 audit_r4.py <app-root> --out report.json [--fix --backup DIR]
"""
import sys, os, json, re, subprocess
import numpy as np
from scipy.signal import lfilter

root = sys.argv[1]
args = sys.argv[2:]
out_path = args[args.index('--out') + 1] if '--out' in args else 'voice_audit_r4.json'
FIX = '--fix' in args
backup = args[args.index('--backup') + 1] if '--backup' in args else None
SR = 48000
TARGET, TOL = -16.0, 1.5

trim_js = open(os.path.join(root, 'v6/js/trim.js'), encoding='utf8').read()
USED = json.loads(re.search(r'window\.TRIM = (\{.*\});', trim_js).group(1))
trim_json_path = os.path.join(root, 'v6/tools/trim.json')
TRIM = json.load(open(trim_json_path))

# BS.1770 K-weighting at 48 kHz
B1, A1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
B2, A2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def lufs(x):
    if len(x) < SR * 0.05: return None
    y = lfilter(B2, A2, lfilter(B1, A1, x))
    n, hop = int(0.4 * SR), int(0.1 * SR)
    if len(y) <= n: blocks = [np.mean(y ** 2)]
    else: blocks = [np.mean(y[i:i + n] ** 2) for i in range(0, len(y) - n + 1, hop)]
    blocks = np.array(blocks)
    L = -0.691 + 10 * np.log10(blocks + 1e-15)
    g = blocks[L > -70]
    if not len(g): return None
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = blocks[(L > -70) & (L > rel)]
    return float(-0.691 + 10 * np.log10(g2.mean())) if len(g2) else None


def edges(x):
    """speech start / end (s) inside x: first/last 10 ms frame within 35 dB of the loudest frame"""
    fl = int(0.01 * SR); n = len(x) // fl
    if n < 2: return 0.0, len(x) / SR
    db = 10 * np.log10((x[:n * fl].reshape(n, fl) ** 2).mean(1) + 1e-15)
    on = np.where(db > db.max() - 35)[0]
    return on[0] * 0.01, (on[-1] + 1) * 0.01


rows = []
fixed = dict(TRIM)
for k in sorted(USED):
    p = os.path.join(root, 'audio', k + '.mp3')
    if not os.path.exists(p): rows.append({'key': k, 'missing': 1}); continue
    x = decode(p)
    st, en, dur = TRIM[k][0], TRIM[k][1], TRIM[k][2]
    g = TRIM[k][3] if len(TRIM[k]) > 3 else 1.0
    a = np.abs(x)
    hot = a >= 0.999
    runs = 0
    if hot.any():
        d = np.diff(np.concatenate([[0], hot.astype(int), [0]]))
        s0, s1 = np.where(d == 1)[0], np.where(d == -1)[0]
        runs = int(((s1 - s0) >= 3).sum())
    w = x[int(st * SR):int(en * SR)]
    if not len(w): rows.append({'key': k, 'empty': 1}); continue
    s_on, s_off = edges(w)
    lead, tail = s_on, len(w) / SR - s_off
    L = lufs(w * g)
    pk = float(np.abs(w).max()) * g
    r = {'key': k, 'dur': round(en - st, 3), 'lead_ms': round(lead * 1000), 'tail_ms': round(tail * 1000), 'lufs': None if L is None else round(L, 1),
         'gain': g, 'peak_db': round(20 * np.log10(pk + 1e-12), 1), 'clip_runs': runs}
    flags = []
    if runs: flags.append('clipped-in-file')
    if pk > 1.0: flags.append('peak>0dBFS-after-gain')
    if lead > 0.12: flags.append('lead-silence')
    if tail > 0.12: flags.append('tail-silence')
    if L is not None and abs(L - TARGET) > TOL: flags.append('loudness')
    r['flags'] = flags
    if FIX:
        nst, nen = st, en
        if lead > 0.10: nst = round(st + lead - 0.06, 3)
        if tail > 0.12: nen = round(en - (tail - 0.10), 3)
        w2 = x[int(nst * SR):int(nen * SR)]
        L1 = lufs(w2)
        ng = g
        if L1 is not None:
            want = 10 ** ((TARGET - L1) / 20)
            lim = 0.97 / max(float(np.abs(w2).max()), 1e-4)
            ng = round(max(0.4, min(4.0, want, lim)), 2)
        fixed[k] = [nst, nen, dur, ng]
        L2 = lufs(w2 * ng)
        r['after'] = {'st': nst, 'en': nen, 'gain': ng, 'lufs': None if L2 is None else round(L2, 1), 'peak_db': round(20 * np.log10(float(np.abs(w2).max()) * ng + 1e-12), 1)}
    rows.append(r)
    if len(rows) % 100 == 0: print(len(rows), file=sys.stderr)

summary = {}
for r in rows:
    for f in r.get('flags', []): summary[f] = summary.get(f, 0) + 1
Ls = [r['lufs'] for r in rows if r.get('lufs') is not None]
summary['lufs_median'] = round(float(np.median(Ls)), 1)
summary['lufs_p5_p95'] = [round(float(np.percentile(Ls, 5)), 1), round(float(np.percentile(Ls, 95)), 1)]
if FIX:
    La = [r['after']['lufs'] for r in rows if r.get('after') and r['after']['lufs'] is not None]
    summary['after_out_of_tol'] = sum(1 for v in La if abs(v - TARGET) > TOL)
    summary['after_p5_p95'] = [round(float(np.percentile(La, 5)), 1), round(float(np.percentile(La, 95)), 1)]
    if backup:
        os.makedirs(backup, exist_ok=True)
        bp = os.path.join(backup, 'trim.json.before_r4')
        if not os.path.exists(bp): open(bp, 'w').write(open(trim_json_path).read())
    json.dump(fixed, open(trim_json_path, 'w'), separators=(',', ':'))
json.dump({'summary': summary, 'rows': rows}, open(out_path, 'w'), ensure_ascii=False, indent=0)
print(json.dumps(summary))
