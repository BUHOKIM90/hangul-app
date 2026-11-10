#!/usr/bin/env python3
"""Put a family's recordings (녹음실 → 려원-목소리.zip) into the app for every device.

  python3 v6/tools/voice/human_apply.py 려원-목소리.zip      # then: rm v6/tools/trim.json && node v6/tools/build.mjs .

Each clip: cut the silence before/after the voice (40 ms kept in front, 120 ms behind), even loudness, 24 kHz mono mp3
(the same format as the other clips) -> audio/<key>.mp3. Clips that look wrong (too quiet, clipped, far too long,
two separate takes) are listed for a retake and still applied only if --all is given."""
import json, os, re, subprocess, sys, tempfile, zipfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
LINES = json.load(open(os.path.join(ROOT, 'v6/tools/voice/lines.json'), encoding='utf8'))

def probe(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=noise=-34dB:d=0.25,volumedetect', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err)
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    runs, t = [], 0.0
    for a, b in zip(st, en + [dur] * (len(st) - len(en))):
        if a - t > 0.05: runs.append((t, a))
        t = b
    if dur - t > 0.05: runs.append((t, dur))
    mx = re.search(r'max_volume: ([-\d.]+) dB', err); mean = re.search(r'mean_volume: ([-\d.]+) dB', err)
    return dur, runs, float(mx.group(1)) if mx else -99, float(mean.group(1)) if mean else -99

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--all' in sys.argv
    z = zipfile.ZipFile(args[0])
    man = json.loads(z.read('manifest.json'))['clips']
    tmp = tempfile.mkdtemp()
    ok, retake = [], {}
    for key, m in sorted(man.items()):
        if key not in LINES or os.path.basename(m['file']) != m['file']: continue
        src = os.path.join(tmp, m['file'])
        open(src, 'wb').write(z.read(m['file']))
        dur, runs, peak, mean = probe(src)
        n = len(re.sub(r'[^가-힣]', '', LINES[key])); pauses = sum(LINES[key].count(c) for c in ',.!?')
        why = []
        if not runs: why.append('소리가 없음')
        else:
            span = runs[-1][1] - runs[0][0]
            if peak > -0.3: why.append('너무 커서 찌그러짐')
            if mean < -38: why.append('너무 작음')
            if span > 0.9 + n * 0.45 + pauses * 0.7: why.append('너무 김(%.1f초)' % span)
            if len(runs) > pauses + 2: why.append('여러 번 말한 듯')
        if why: retake[key] = {'text': LINES[key], 'why': why}
        if why and not force and '소리가 없음' in why: continue
        if why and not force: continue
        a, b = max(0, runs[0][0] - 0.04), min(dur, runs[-1][1] + 0.12)
        out = os.path.join(ROOT, 'audio', key + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', src,
                        '-af', 'highpass=f=70,loudnorm=I=-17:TP=-1.5:LRA=11,afade=t=in:d=0.01', '-ar', '24000', '-ac', '1', '-b:a', '128k', out], check=True)
        ok.append(key)
    rep = {'applied': ok, 'retake': retake, 'total': len(LINES)}
    json.dump(rep, open(os.path.join(ROOT, 'v6/tools/voice/report_human.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(f'applied {len(ok)} / {len(man)} recordings; retake {len(retake)}: {list(retake.items())[:20]}')

if __name__ == '__main__': main()
