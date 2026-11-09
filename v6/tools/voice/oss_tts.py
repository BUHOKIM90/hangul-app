#!/usr/bin/env python3
"""Open-source Korean voices (run in GitHub Actions, CPU): NVIDIA Magpie TTS Multilingual and k2-fsa OmniVoice.

Every clip is checked automatically, because nobody can listen to 600 files by hand:
  - Whisper (large-v3-turbo) reads it back; the Hangul it hears must match the line (CER = letter error rate)
  - UTMOS estimates how natural it sounds (1..5; higher = more like a real person)
  - one clean utterance of sensible length (same rule as make_voice.py)

  python oss_tts.py samples --engine magpie        # sample lines + test set for every voice of one engine -> out/
  python oss_tts.py baseline                        # score the clips the app uses now (audio/*.mp3)
  python oss_tts.py full --engine magpie --voice Sofia --shard 0/6   # remake app clips -> out/audio/
"""
import argparse, json, os, re, subprocess, sys, tempfile
import numpy as np, soundfile as sf, torch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
LINES = json.load(open(os.path.join(ROOT, 'v6/tools/voice/lines.json'), encoding='utf8'))
SAMPLE_LINES = ['려원아, 안녕! 오늘도 같이 놀자!', '그건 가 글자야.', '나비.', '잘했어! 혼자 읽었네!']
OUT = os.path.join(ROOT, 'out')
torch.set_num_threads(os.cpu_count() or 4)

def test_keys():
    """A fixed spread of every kind of line the app speaks (single letters are the hardest)."""
    want = {'sy': 8, 'w': 4, 'j': 3, 'dy': 3, 'fy': 2, 'hy': 2, 'ui': 2, 'ui4': 2, 'v': 2, 'c': 1, 's': 1}
    out = []
    for kind, n in want.items():
        ks = sorted(k for k in LINES if k.split('_')[0] == kind)
        step = max(1, len(ks) // n)
        out += ks[::step][:n]
    return out

# ---------------------------------------------------------------- engines
class Magpie:
    SPEAKERS = {'Aria': 0, 'Jason': 1, 'John': 2, 'Leo': 3, 'Sofia': 4}
    def __init__(self):
        from nemo.collections.tts.models import MagpieTTSModel
        self.m = MagpieTTSModel.from_pretrained('nvidia/magpie_tts_multilingual_357m').eval()
        self.sr = int(getattr(self.m, 'sample_rate', 22050) or 22050)
    def voices(self): return list(self.SPEAKERS)
    def say(self, text, voice, seed):
        torch.manual_seed(seed)
        with torch.no_grad():
            audio, alen = self.m.do_tts(text, language='ko', apply_TN=False, speaker_index=self.SPEAKERS[voice])
        a = audio[0].detach().float().cpu().numpy()
        n = int(alen[0]) if alen is not None else len(a)
        return a[:n], self.sr

class Omni:
    DESIGNS = {'f_young': 'female, young adult', 'f_mid': 'female, middle-aged', 'f_high': 'female, young adult, high pitch',
               'm_young': 'male, young adult'}
    def __init__(self):
        from omnivoice import OmniVoice
        self.m = OmniVoice.from_pretrained('k2-fsa/OmniVoice', device_map='cpu', dtype=torch.float32)
        self.sr = 24000
    def voices(self): return list(self.DESIGNS)
    def say(self, text, voice, seed):
        torch.manual_seed(seed)
        kw = dict(text=text, instruct=self.DESIGNS[voice])
        try: audio = self.m.generate(language='ko', **kw)
        except TypeError: audio = self.m.generate(**kw)
        a = audio[0]
        a = a.detach().float().cpu().numpy() if torch.is_tensor(a) else np.asarray(a, dtype=np.float32)
        return a.reshape(-1), self.sr

ENGINES = {'magpie': Magpie, 'omnivoice': Omni}

# ---------------------------------------------------------------- checks
_asr = _mos = None
def asr(path):
    global _asr
    if _asr is None:
        from faster_whisper import WhisperModel
        _asr = WhisperModel('large-v3-turbo', device='cpu', compute_type='int8')
    segs, _ = _asr.transcribe(path, language='ko', beam_size=5, condition_on_previous_text=False, vad_filter=False)
    return ''.join(s.text for s in segs).strip()

def mos(wav, sr):
    global _mos
    if _mos is None:
        _mos = torch.hub.load('tarepan/SpeechMOS:v1.2.0', 'utmos22_strong', trust_repo=True).eval()
    x = torch.from_numpy(np.asarray(wav, dtype=np.float32)).unsqueeze(0)
    with torch.no_grad(): return float(_mos(x, sr).item())

def hangul(s): return re.sub(r'[^가-힣]', '', s)
def cer(ref, hyp):
    r, h = hangul(ref), hangul(hyp)
    if not r: return 0.0
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (r[i - 1] != h[j - 1]))
    return d[len(h)] / len(r)

def speech_span(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=noise=-38dB:d=0.35', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err)
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    runs, t = [], 0.0
    for a, b in zip(st, en + [dur] * (len(st) - len(en))):
        if a - t > 0.04: runs.append((t, a))
        t = b
    if dur - t > 0.04: runs.append((t, dur))
    return ((runs[-1][1] - runs[0][0]) if runs else 0.0), len(runs)

def limits(text):
    n = len(hangul(text)); pauses = sum(text.count(c) for c in ',.!?')
    return 0.15, 0.55 + n * 0.3 + pauses * 0.5, max(1, pauses + 1)

def to_mp3(wav, sr, path):
    """Same format as the app's clips: 24 kHz mono mp3, even loudness."""
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: tmp = f.name
    sf.write(tmp, np.clip(wav, -1, 1), sr)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', 'loudnorm=I=-17:TP=-1.5:LRA=11', '-ar', '24000', '-ac', '1',
                    '-b:a', '128k', path], check=True)
    os.remove(tmp)

def check(path, text, wav=None, sr=None):
    heard = asr(path)
    span, runs = speech_span(path)
    lo, hi, max_runs = limits(text)
    if wav is None: wav, sr = sf.read(path, dtype='float32'); wav = wav if wav.ndim == 1 else wav.mean(1)
    r = {'text': text, 'heard': heard, 'cer': round(cer(text, heard), 3), 'span': round(span, 2), 'runs': runs,
         'mos': round(mos(wav, sr), 3)}
    r['ok'] = r['cer'] == 0 and lo <= span <= hi and runs <= max_runs + 1
    return r

def best_of(eng, text, voice, tries, path):
    """Generate up to `tries` takes; keep the first fully clean one, else the one heard best (then most natural)."""
    best = None
    for t in range(tries):
        try: wav, sr = eng.say(text, voice, seed=1234 + t * 7919)
        except Exception as e:
            print('  fail', voice, text, repr(e)[:160]); continue
        if len(wav) < sr * 0.1: continue
        tmp = path + f'.try{t}.mp3'
        to_mp3(wav, sr, tmp)
        r = check(tmp, text, wav, sr); r['take'] = t
        if best is None or (r['ok'], -r['cer'], r['mos']) > (best[0]['ok'], -best[0]['cer'], best[0]['mos']):
            if best: os.remove(best[1])
            best = (r, tmp)
        else: os.remove(tmp)
        if r['ok'] and r['mos'] >= 3.0: break
    if not best: return None
    os.replace(best[1], path)
    return best[0]

def summary(rows):
    rows = [r for r in rows if r]
    if not rows: return {}
    return {'n': len(rows), 'ok': sum(r['ok'] for r in rows), 'cer': round(float(np.mean([r['cer'] for r in rows])), 3),
            'mos': round(float(np.mean([r['mos'] for r in rows])), 3)}

# ---------------------------------------------------------------- modes
def cmd_samples(a):
    eng = ENGINES[a.engine]()
    os.makedirs(os.path.join(OUT, 'samples'), exist_ok=True)
    keys = test_keys(); res = {}
    for v in eng.voices():
        vid = ('mg_' if a.engine == 'magpie' else 'ov_') + v.lower()
        files, rows, test = [], [], {}
        for i, t in enumerate(SAMPLE_LINES):
            f = f'{vid}_{i}.mp3'
            r = best_of(eng, t, v, 3, os.path.join(OUT, 'samples', f))
            if r: files.append(f); rows.append(r)
        for k in keys:
            p = os.path.join(OUT, 'samples', f'_t_{vid}_{k}.mp3')
            r = best_of(eng, LINES[k], v, 2, p)
            if r: test[k] = r; os.remove(p)
        res[vid] = {'engine': a.engine, 'voice': v, 'files': files, 'samples': rows, 'test': test,
                    'score': summary(list(test.values())), 'score_letters': summary([test[k] for k in test if k.startswith('sy_')])}
        print(vid, res[vid]['score'], 'letters', res[vid]['score_letters'], flush=True)
    json.dump(res, open(os.path.join(OUT, f'scores_{a.engine}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

def cmd_baseline(a):
    test = {}
    for k in test_keys():
        test[k] = check(os.path.join(ROOT, 'audio', k + '.mp3'), LINES[k])
    sam = {}
    for f in sorted(os.listdir(os.path.join(ROOT, 'v6/voice-samples'))):
        if f.startswith('sunhi_') and f.endswith('.mp3') and not f.startswith('sunhi_slow'):
            i = int(f.split('_')[1].split('.')[0]); sam[f] = check(os.path.join(ROOT, 'v6/voice-samples', f), SAMPLE_LINES[i])
    res = {'sunhi_now': {'engine': 'edge', 'voice': 'ko-KR-SunHiNeural', 'test': test, 'samples': list(sam.values()),
                         'score': summary(list(test.values())), 'score_letters': summary([test[k] for k in test if k.startswith('sy_')])}}
    print(res['sunhi_now']['score'], res['sunhi_now']['score_letters'])
    os.makedirs(OUT, exist_ok=True)
    json.dump(res, open(os.path.join(OUT, 'scores_baseline.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

def cmd_full(a):
    eng = ENGINES[a.engine]()
    i, n = map(int, a.shard.split('/'))
    keys = sorted(LINES)[i::n]
    os.makedirs(os.path.join(OUT, 'audio'), exist_ok=True)
    rep = {}
    for k in keys:
        r = best_of(eng, LINES[k], a.voice, a.tries, os.path.join(OUT, 'audio', k + '.mp3'))
        rep[k] = r or {'text': LINES[k], 'ok': False, 'failed': True}
        print(k, (r or {}).get('ok'), (r or {}).get('heard'), (r or {}).get('mos'), flush=True)
    json.dump(rep, open(os.path.join(OUT, f'full_{i}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['samples', 'baseline', 'full'])
    ap.add_argument('--engine', default='magpie'); ap.add_argument('--voice', default='Sofia')
    ap.add_argument('--shard', default='0/1'); ap.add_argument('--tries', type=int, default=4)
    a = ap.parse_args()
    {'samples': cmd_samples, 'baseline': cmd_baseline, 'full': cmd_full}[a.mode](a)
