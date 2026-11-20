#!/usr/bin/env python3
"""R5b: encode the CEO-approved takes from the review/1118 listen page (listen_result_1118.txt, OK part) to app mp3s.

Source = the exact wav the listen page played (review/1118/clips/<key>__<take>.wav); it is checked byte-identical to the
original cut under voice_reset/sulafat_full (asr_1118/final or asr_1118b/final), which is the best source there is.
Encode = the R5a chain (finalize_1118.py): edge trim, batch gain to -16 LUFS, 20 ms fade-out, alimiter 0.89,
24 kHz mono 128k mp3. Playback level is then set per clip by apply_r5a.py (trim.json gain). ffmpeg under flock.
Writes <out>/mp3/<key>.mp3 and <out>/manifest_r5b.json (apply_r5a.py format). Reads sulafat_full, never writes there.

usage: python3 encode_r5b.py <app-root> <listen_result.txt> <sulafat_full> <out-dir>
"""
import sys, os, re, json, hashlib, subprocess, wave
import numpy as np
root, result, base, out = sys.argv[1:5]
FF = ['/workspace/team/bin/ffmpeg_safe']
md5 = lambda p: hashlib.md5(open(p, 'rb').read()).hexdigest()


def load(f):
    w = wave.open(f); assert w.getframerate() == 24000 and w.getnchannels() == 1 and w.getsampwidth() == 2, f
    return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def edges(f):  # same as finalize_1118.edges
    x = load(f); fl = 240; n = len(x) // fl
    db = 20 * np.log10(np.sqrt((x[:n * fl].reshape(n, fl) ** 2).mean(1)) + 1e-9); pk = db.max()
    on = np.where(db > pk - 32)[0]; off = np.where(db > pk - 38)[0]
    return max(on[0] * 0.01 - 0.1, 0), min((off[-1] + 1) * 0.01 + 0.1, len(x) / 24000)


def ebur(f):
    o = subprocess.run(FF + ['-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1]); tp = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', o)
    return I, (float(tp[-1]) if tp and tp[-1] != '-inf' else None)


BG = {}
def bgain(b):
    if b not in BG: BG[b] = -16 - ebur(os.path.join(base, 'raw', b + '.wav'))[0]
    return BG[b]


txt = open(result).read()
okpart = re.search(r'OK:([^/]*)', txt).group(1).strip()
OK = [s.strip() for s in okpart.split(',') if s.strip()]
html = open(os.path.join(root, 'review/1118/index.html')).read()
DATA = {d['k']: d for d in json.loads(re.search(r'const DATA = (\[.*?\]);', html).group(1))}
V = json.load(open(os.path.join(base, 'asr_1118/verdict_1118.json'))); C = {r['clip']: r for r in V['clips']}
import csv
BATCH = {os.path.basename(e['clip'])[:-4]: e['batch'] for e in csv.DictReader(open(os.path.join(base, 'asr_1118/expected_1118.csv')))}
GRP = {'다시 녹음': 'retake112', '새 낱말': 'newword83', '새 말': 'nihon5'}
os.makedirs(os.path.join(out, 'mp3'), exist_ok=True); rows = []
for o in OK:
    k, _, t = o.partition('~'); d = DATA[k]
    if not t:
        assert len(d['takes']) == 1, ('bare key with several takes', k); t = d['takes'][0]['id']
    assert any(x['id'] == t for x in d['takes']), o
    c = f'{k}__{t}'; listen = os.path.join(root, 'review/1118/clips', c + '.wav')
    r = C[c]; src = os.path.join(base, r.get('path') or f'asr_1118/final/{c}.wav')
    assert md5(listen) == md5(src), ('listen clip differs from source', c)
    ss, ee = edges(src); mp3 = os.path.join(out, 'mp3', k + '.mp3')
    subprocess.run(FF + ['-v', 'error', '-y', '-ss', f'{ss:.3f}', '-to', f'{ee:.3f}', '-i', src, '-af',
                         f'afade=t=out:st={max(ee - ss - 0.02, 0):.3f}:d=0.02,volume={bgain(r.get("batch") or BATCH[c]):.2f}dB,alimiter=limit=0.89:level=false',
                         '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
    I, tp = ebur(mp3)
    g = GRP.get(d['g'], r['group']); assert g == r['group'], (c, g, r['group'])
    rows.append(dict(key=k, take=int(t[1:]), clip=c, group=g, text=r['text'], source='ceo_listen_1118', listen_md5=md5(listen),
                     src=os.path.relpath(src, base), pitch_fixed=r['pitch_fixed'], file='mp3/' + k + '.mp3', md5=md5(mp3), lufs=round(I, 1), tp=tp, dur=round(ee - ss, 3)))
    print(c, g, round(I, 1), tp, round(ee - ss, 2))
json.dump(rows, open(os.path.join(out, 'manifest_r5b.json'), 'w'), ensure_ascii=False, indent=1)
print('encoded', len(rows), 'keys', len({r['key'] for r in rows}))
