#!/usr/bin/env python3
"""Deploy check: every spoken clip is one utterance of sensible length (a rambling or half-silent clip must never ship).
Run after build.mjs:  python3 v6/tools/voice/check_len.py   (exit 1 and a list if anything is off)"""
import json, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
L = json.load(open(os.path.join(ROOT, 'v6/tools/voice/lines.json'), encoding='utf8'))
T = json.load(open(os.path.join(ROOT, 'v6/tools/trim.json')))
bad = []
for k, text in L.items():
    if k not in T: bad.append((k, text, 'no clip')); continue
    n = len(re.sub(r'[^가-힣]', '', text)); p = sum(text.count(c) for c in ',.!?')
    span = T[k][1] - T[k][0]
    if span > 0.9 + n * 0.3 + p * 0.5: bad.append((k, text, f'too long {span:.2f}s'))
    elif span < 0.12: bad.append((k, text, f'too short {span:.2f}s'))
    elif T[k][0] > 0.6: bad.append((k, text, f'starts late {T[k][0]:.2f}s'))
print(f'{len(L)} clips checked, {len(bad)} off', bad)
sys.exit(1 if bad else 0)
