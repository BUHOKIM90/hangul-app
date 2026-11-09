#!/usr/bin/env python3
"""Merge the open-source voice samples (out/) into the parent's 목소리 고르기 list and keep the scores."""
import json, os, shutil, glob
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'out'); SAM = os.path.join(ROOT, 'v6/voice-samples')
scores = {}
for f in sorted(glob.glob(os.path.join(OUT, '**', 'scores_*.json'), recursive=True)):
    scores.update(json.load(open(f, encoding='utf8')))
for f in glob.glob(os.path.join(OUT, '**', 'samples', '*.mp3'), recursive=True):
    if not os.path.basename(f).startswith('_t_'): shutil.copy(f, SAM)
L = json.load(open(os.path.join(SAM, 'list.json'), encoding='utf8'))
L['voices'] = [v for v in L['voices'] if not v['id'].startswith(('mg_', 'ov_'))]
NAME = {'magpie': '엔비디아 Magpie', 'omnivoice': 'OmniVoice'}
KO = {'f_young': '젊은 여성', 'f_mid': '중년 여성', 'f_high': '밝은 여성', 'm_young': '젊은 남성'}
base = scores.get('sunhi_now', {}).get('score', {})
for vid, s in scores.items():
    if s.get('engine') not in NAME or not s.get('files'): continue
    sc = s.get('score', {})
    L['voices'].append({'id': vid, 'voice': f"{s['engine']}:{s['voice']}", 'label': f"{NAME[s['engine']]} · {KO.get(s['voice'], s['voice'])}"
                        + (f" (자연스러움 {sc['mos']:.1f}점)" if sc else ''), 'files': s['files'], 'score': sc})
for v in L['voices']:
    if v['id'] == 'sunhi' and base: v['label'] = f"선희 (지금 목소리, 여성) (자연스러움 {base['mos']:.1f}점)"; v['score'] = base
json.dump(L, open(os.path.join(SAM, 'list.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(scores, open(os.path.join(ROOT, 'v6/tools/voice/oss_scores.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for vid, s in scores.items(): print(vid, s.get('score'), 'letters', s.get('score_letters'))
