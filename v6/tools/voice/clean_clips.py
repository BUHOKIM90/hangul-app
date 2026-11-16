#!/usr/bin/env python3
"""Clean voice clips in place (P1, 2026-11): dead pauses, breaths / stray speech at the edges, loudness outliers.

  python3 v6/tools/voice/clean_clips.py [--apply] [--keys k1,k2] [--report out.json]

Per clip (only clips the app uses, from sw.js):
  1. speech segments from a 10 ms RMS envelope (active = within 35 dB of the clip peak, gaps < 60 ms bridged).
  2. edge burst = first/last segment separated from the rest by a silence > 0.4 s. It is DROPPED only if a local
     Whisper model (faster-whisper 'medium', CPU, offline) hears no character of the script line in the burst alone
     AND the clip without the burst transcribes at least as well as the whole clip. Otherwise only the silence is shortened.
     (Real words such as the leading "아," in "아, 아기 할 때 아." are kept that way.)
  3. every remaining silence between segments longer than 0.4 s is shortened to 0.3 s (5 ms fades at the cuts).
  4. edges: 40 ms kept before the first segment, 120 ms after the last (same as human_apply.py).
  Clap answers (c_*) keep their pauses: the spaced syllables are the clap rhythm.
  Loudness is NOT changed here: trim.py gives every clip a playback gain (4th TRIM value); see trim.py.
  A clip is re-encoded only if 2–4 change it; all others stay byte-identical. Old-voice clips (48 kb/s, see
  report_oss.json kept_old) are re-encoded at 48 kb/s so they stay recognisable; the 소희 clips at 128 kb/s.
Without --apply it only writes the report. After --apply: re-measure trim for the changed clips and run build.mjs."""
import json, os, re, subprocess, sys, tempfile
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SR = 24000
args = sys.argv[1:]
APPLY = '--apply' in args
only = args[args.index('--keys') + 1].split(',') if '--keys' in args else None
report_path = args[args.index('--report') + 1] if '--report' in args else os.path.join(ROOT, 'v6/tools/voice/clean_report.json')
# --plan earlier_report.json: reuse its Whisper drop decisions instead of running Whisper again
PLAN = json.load(open(args[args.index('--plan') + 1], encoding='utf8'))['clips'] if '--plan' in args else None
LINES = json.load(open(os.path.join(ROOT, 'v6/tools/voice/lines.json'), encoding='utf8'))
OLD = set(json.load(open(os.path.join(ROOT, 'v6/tools/voice/report_oss.json'), encoding='utf8')).get('kept_old', []))
sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf8').read()
KEYS = [f[6:-4] for f in json.loads(re.search(r'const FILES = (\[.*?\]);', sw, re.S).group(1)) if f.startswith('audio/')]

def load(path, af=None):
    cmd = ['ffmpeg', '-v', 'quiet', '-i', path] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 's16le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, dtype=np.int16).astype(np.float32) / 32768

def segments(x):
    fl = int(SR * 0.01); n = len(x) // fl
    db = 20 * np.log10(np.sqrt((x[:n * fl].reshape(n, fl) ** 2).mean(1)) + 1e-9)
    pk = db.max(); act = db > max(pk - 35, -55)
    segs, i = [], 0
    while i < n:
        if act[i]:
            j = i
            while j < n and act[j]: j += 1
            if segs and i - segs[-1][1] <= 6: segs[-1][1] = j
            else: segs.append([i, j])
            i = j
        else: i += 1
    return [[a * fl, b * fl] for a, b in segs if b - a >= 3]

def loudness(x, segs):
    if not segs: return -99.0
    sp = np.concatenate([x[a:b] for a, b in segs])
    return float(20 * np.log10(np.sqrt((sp ** 2).mean()) + 1e-9))

_model = None
def asr(x):
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel('medium', device='cpu', compute_type='int8')
    y = np.interp(np.arange(0, len(x), SR / 16000), np.arange(len(x)), x).astype(np.float32)
    pad = np.zeros(8000, np.float32)
    seg, _ = _model.transcribe(np.concatenate([pad, y, pad]), language='ko', beam_size=5, vad_filter=False, condition_on_previous_text=False)
    return ''.join(s.text for s in seg).strip()

norm = lambda t: re.sub(r'[^가-힣ㄱ-ㅣ]', '', t)
def cer(hyp, ref):
    h, r = norm(hyp), norm(ref)
    if not r: return 0.0
    d = list(range(len(h) + 1))
    for i, rc in enumerate(r, 1):
        p, d[0] = d[0], i
        for j, hc in enumerate(h, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (rc != hc))
    return d[len(h)] / len(r)

def decide(info):
    """Edge rules on the transcripts (same in fresh and --plan runs). Conservative: when in doubt, keep the sound.
    lead: dropped if the burst alone shares no character with the line, the rest starts with the line's first syllable and
          reads at least as well as the whole clip.
    tail: dropped if the burst alone does not end with the line's last syllable, the rest ENDS with it and reads at least as well."""
    exp = norm(info['text']); c0 = cer(info.get('asr_full', ''), info['text']) if 'asr_full' in info else None
    lead = tail = False
    if exp and 'asr_lead' in info:
        h, r = norm(info['asr_lead']), norm(info['asr_wo_lead'])
        lead = not (set(h) & set(exp)) and r[:1] == exp[:1] and cer(info['asr_wo_lead'], info['text']) <= c0 + 1e-9
    if exp and 'asr_tail' in info:
        t, r = norm(info['asr_tail']), norm(info['asr_wo_tail'])
        tail = not t.endswith(exp[-1]) and r.endswith(exp[-1]) and cer(info['asr_wo_tail'], info['text']) <= c0 + 1e-9
    return lead, tail

def join(x, keep, gaps):
    """keep: list of [a,b] sample ranges in order; gaps: silence (s) to put between them."""
    f = int(SR * 0.005); out = []
    for i, (a, b) in enumerate(keep):
        piece = x[a:b].copy()
        piece[:f] *= np.linspace(0, 1, f); piece[-f:] *= np.linspace(1, 0, f)
        out.append(piece)
        if i < len(keep) - 1: out.append(np.zeros(int(SR * gaps[i]), np.float32))
    return np.concatenate(out)

def plan(k):
    path = os.path.join(ROOT, 'audio', k + '.mp3')
    x = load(path); segs = segments(x)
    info = {'text': LINES.get(k, ''), 'dur_before': round(len(x) / SR, 3), 'actions': []}
    if not segs: return x, segs, info
    pad_a, pad_b = int(SR * 0.04), int(SR * 0.12)
    gap = lambda i: (segs[i + 1][0] - segs[i][1]) / SR
    drop_lead = drop_tail = False
    exp = info['text']
    if PLAN is not None and k in PLAN:
        for f in ('asr_full', 'asr_lead', 'asr_wo_lead', 'asr_tail', 'asr_wo_tail'):
            if f in PLAN[k]: info[f] = PLAN[k][f]
        drop_lead, drop_tail = decide(info)
    elif len(segs) > 1 and (gap(0) > 0.4 or gap(len(segs) - 2) > 0.4):
        full = asr(x[max(0, segs[0][0] - pad_a):segs[-1][1] + pad_b]); info['asr_full'] = full; c0 = cer(full, exp)
        if gap(0) > 0.4:
            head = asr(x[max(0, segs[0][0] - pad_a):segs[0][1] + pad_a]); rest = asr(x[segs[1][0] - pad_a:segs[-1][1] + pad_b])
            info['asr_lead'] = head; info['asr_wo_lead'] = rest
        if gap(len(segs) - 2) > 0.4 and len(segs) - (1 if drop_lead else 0) > 1:
            lo = 1 if drop_lead else 0
            tail = asr(x[segs[-1][0] - pad_a:segs[-1][1] + pad_b]); rest = asr(x[max(0, segs[lo][0] - pad_a):segs[-2][1] + pad_b])
            info['asr_tail'] = tail; info['asr_wo_tail'] = rest
        drop_lead, drop_tail = decide(info)
    # one-syllable lines (꽃., 머. …): Whisper misreads the short rest, so a trailing burst that is >= 8 dB quieter than the word and
    # does not contain the syllable counts as stray sound (speech RMS)
    ex = norm(info['text'])
    if not drop_tail and len(ex) == 1 and len(segs) >= 2 and 'asr_tail' in info and ex not in norm(info['asr_tail']):
        pkdb = lambda a, b: 20 * np.log10(np.sqrt((x[a:b] ** 2).mean()) + 1e-9)   # RMS
        if pkdb(*segs[-1]) <= max(pkdb(*sg) for sg in segs[:-1]) - 8: drop_tail = True
    keep = segs[(1 if drop_lead else 0):(len(segs) - 1 if drop_tail else len(segs))]
    if drop_lead: info['actions'].append('drop lead burst %.2f-%.2fs' % (segs[0][0] / SR, segs[0][1] / SR))
    if drop_tail: info['actions'].append('drop tail burst %.2f-%.2fs' % (segs[-1][0] / SR, segs[-1][1] / SR))
    gaps = []
    for i in range(len(keep) - 1):
        g = (keep[i + 1][0] - keep[i][1]) / SR
        if g > 0.4 and not k.startswith('c_'): info['actions'].append('pause %.2fs -> 0.30s at %.2fs' % (g, keep[i][1] / SR)); g = 0.3
        gaps.append(g)
    if info['actions']:
        keep = [list(r) for r in keep]
        keep[0][0] = max(0, keep[0][0] - pad_a); keep[-1][1] = min(len(x), keep[-1][1] + pad_b)
        y = join(x, keep, gaps)
    else:
        y = x
    return y, segments(y), info

def main():
    keys = only or KEYS
    rep = {}; ys = {}
    for i, k in enumerate(keys):
        y, segs, info = plan(k)
        ys[k] = (y, segs); rep[k] = info
        if info['actions']: print(i, k, info['text'], info['actions'], flush=True)
    for k, (y, segs) in ys.items():
        if APPLY and rep[k]['actions']:
            br = '48k' if k in OLD else '128k'
            subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', br,
                            os.path.join(ROOT, 'audio', k + '.mp3')], input=y.astype(np.float32).tobytes(), check=True)
            rep[k]['dur_after'] = round(len(y) / SR, 3)
    med = None
    json.dump({'median': med, 'applied': APPLY, 'clips': rep}, open(report_path, 'w'), ensure_ascii=False, indent=1)
    ch = [k for k in rep if rep[k]['actions']]
    print('clips', len(rep), 'changed', len(ch), 'applied', APPLY)

if __name__ == '__main__':
    main()
