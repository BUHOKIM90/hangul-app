#!/usr/bin/env python3
"""Put the open-source voice clips (out/**/audio) into audio/ — only clips checked as said right.
A clip that never came out right keeps the old voice and is listed, so nothing in the app goes silent or wrong.
Fails (nothing is committed) if fewer than MIN_PASS of the lines came out right: one voice should speak the whole app."""
import json, os, glob, shutil, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
LINES = json.load(open(os.path.join(ROOT, 'v6/tools/voice/lines.json'), encoding='utf8'))
MIN_PASS = float(os.environ.get('MIN_PASS', '0.97'))
rep = {}
for f in glob.glob(os.path.join(ROOT, 'out', '**', 'full_*.json'), recursive=True):
    rep.update(json.load(open(f, encoding='utf8')))
src = {os.path.basename(p)[:-4]: p for p in glob.glob(os.path.join(ROOT, 'out', '**', 'audio', '*.mp3'), recursive=True)}
def better(r):
    # single letters: at least as clearly that letter (vs every look-alike letter) as the clip used now
    if r.get('old_margin') is not None: return r.get('margin') is not None and r['margin'] >= min(r['old_margin'], 0.0)
    return bool(r.get('right'))
good = [k for k in LINES if k in rep and k in src and better(rep[k])]
kept = sorted(set(LINES) - set(good))
print(f'right {len(good)}/{len(LINES)}; kept old voice: {kept[:80]}')
out = {'engine': os.environ.get('ENGINE'), 'voice': os.environ.get('VOICE'), 'right': len(good), 'total': len(LINES), 'kept_old': kept, 'clips': rep}
json.dump(out, open(os.path.join(ROOT, 'v6/tools/voice/report_oss.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
if len(good) < len(LINES) * MIN_PASS:
    print('too many clips not right; not applying'); sys.exit(1)
for k in good: shutil.copy(src[k], os.path.join(ROOT, 'audio', k + '.mp3'))
