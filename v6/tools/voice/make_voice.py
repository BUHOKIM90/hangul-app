#!/usr/bin/env python3
"""Recreate every voice clip from v6/tools/voice/lines.json with one natural Korean neural voice (Microsoft
ko-KR-SunHiNeural via edge-tts), then check each file: one clean utterance, sensible length. Runs in GitHub
Actions (.github/workflows/voice.yml) because the voice service is not reachable from every machine.

  pip install edge-tts   (ffmpeg on PATH)
  python v6/tools/voice/make_voice.py [--only key1,key2]
"""
import asyncio, json, os, re, subprocess, sys, argparse
import edge_tts

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
LINES = json.load(open(os.path.join(ROOT, 'v6/tools/voice/lines.json'), encoding='utf8'))
OUT = os.path.join(ROOT, 'audio')
VOICE = 'ko-KR-SunHiNeural'

def rate_for(key):
    kind = key.split('_')[0]
    if kind in ('sy', 'w'): return '-12%'     # single syllables / words: clear, a little slow
    if kind in ('j', 'c'): return '-10%'
    return '-6%'                              # sentences: calm, natural pace

def pitch_for(key):
    kind = key.split('_')[0]
    if kind in ('sy', 'w', 'j'): return '+2Hz'  # letters stay neutral so the sound is clear
    return '+6Hz'                               # talking to a child: a little brighter

def speech_span(path):
    """(seconds of speech from first to last sound, number of separate sound runs, file length)"""
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=noise=-38dB:d=0.35', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    dur = 0.0
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err)
    if m: dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    sil = list(zip(st, en + [dur] * (len(st) - len(en))))
    runs, t = [], 0.0
    for a, b in sil:
        if a - t > 0.04: runs.append((t, a))
        t = b
    if dur - t > 0.04: runs.append((t, dur))
    span = (runs[-1][1] - runs[0][0]) if runs else 0.0
    return span, len(runs), dur

def limits(key, text):
    n = len(re.findall(r'[가-힣]', text))
    pauses = text.count(',') + text.count('.') + text.count('!') + text.count('?')
    return 0.15, 0.55 + n * 0.28 + pauses * 0.45, max(1, pauses + 1)

async def make(key, text, sem, report):
    path = os.path.join(OUT, key + '.mp3')
    lo, hi, max_runs = limits(key, text)
    async with sem:
        for attempt in range(4):
            tmp = path + '.tmp.mp3'
            try:
                await edge_tts.Communicate(text, VOICE, rate=rate_for(key), pitch=pitch_for(key)).save(tmp)
            except Exception as e:
                report['errors'][key] = str(e)[:120]
                await asyncio.sleep(2 + attempt * 3)
                continue
            span, runs, dur = speech_span(tmp)
            ok = lo <= span <= hi and runs <= max_runs + 1
            if ok or attempt == 3:
                os.replace(tmp, path)
                report['clips'][key] = {'text': text, 'span': round(span, 2), 'runs': runs, 'ok': ok}
                if not ok: report['suspect'].append(key)
                report['errors'].pop(key, None)
                return
            os.remove(tmp)

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--only', default='')
    a = ap.parse_args()
    keys = [k for k in LINES if not a.only or k in a.only.split(',')]
    report = {'voice': VOICE, 'clips': {}, 'suspect': [], 'errors': {}}
    sem = asyncio.Semaphore(6)
    await asyncio.gather(*(make(k, LINES[k], sem, report) for k in keys))
    json.dump(report, open(os.path.join(ROOT, 'v6/tools/voice/report.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(f"made {len(report['clips'])}/{len(keys)}, suspect {len(report['suspect'])}, errors {len(report['errors'])}")
    if report['suspect']: print('suspect:', report['suspect'][:50])
    if report['errors']: print('errors:', list(report['errors'].items())[:10])
    # fail the job (nothing is committed) if the voice service did not answer for many lines
    if len(report['errors']) > len(keys) * 0.02 or len(report['clips']) < len(keys) * 0.98:
        sys.exit(1)

asyncio.run(main())
