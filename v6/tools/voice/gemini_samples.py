#!/usr/bin/env python3
"""Gemini TTS samples for 목소리 고르기 (free tier only: 12 requests per run). Needs the GEMINI_API_KEY repository secret.
The same 4 lines as the other candidates, each with a director's note, in three voices."""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SAM = os.path.join(ROOT, 'v6/voice-samples')
KEY = os.environ.get('GEMINI_API_KEY', '')
API = 'https://generativelanguage.googleapis.com/v1beta/'
VOICES = [('Kore', '코레'), ('Aoede', '아오이데'), ('Leda', '레다')]
NOTES = ['유치원 선생님이 다섯 살 아이를 반갑게 맞이하듯 밝고 다정하게, 조금 천천히', '다섯 살 아이에게 다정하게 알려 주듯 또박또박, 조금 천천히',
         '다섯 살 아이에게 낱말 하나를 또렷하고 다정하게', '다섯 살 아이를 칭찬하듯 밝고 신나게, 조금 천천히, 끝을 살짝 올려서']

def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={'x-goog-api-key': KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.load(r), None
    except urllib.error.HTTPError as e: return None, f'{e.code} {e.read()[:300].decode("utf8", "replace")}'
    except Exception as e: return None, repr(e)

def say(model, voice, text, note):
    shapes = [
        {'contents': [{'role': 'user', 'parts': [{'text': text, 'speech_metadata': {'style': note}}]}],
         'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'voice': voice}}}},
        {'contents': [{'parts': [{'text': f'다음 문장을 한국어로 읽어 주세요. 말투: {note}. 문장만 읽기: {text}'}]}],
         'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}]
    global SHAPE
    for i in ([SHAPE] if SHAPE is not None else [0, 1]):
        r, err = call(f'{model}:generateContent', shapes[i])
        if r:
            try:
                part = next(p for p in r['candidates'][0]['content']['parts'] if 'inlineData' in p)
                SHAPE = i
                return base64.b64decode(part['inlineData']['data']), part['inlineData'].get('mimeType', '')
            except Exception as e: err = 'no audio: ' + json.dumps(r)[:300]
        print('  ', model, 'shape', i, err, flush=True)
        if err and err.startswith('429'): return None, 'quota'
    return None, None
SHAPE = None

def main():
    if not KEY: sys.exit('GEMINI_API_KEY secret is not set')
    models, err = call('models?pageSize=300')
    if not models: sys.exit('cannot list models: ' + str(err))
    tts = sorted((m['name'] for m in models.get('models', []) if 'tts' in m['name'] and 'lite' not in m['name']), reverse=True)
    print('TTS models:', tts)
    if not tts: sys.exit('no TTS model for this key')
    L = json.load(open(os.path.join(SAM, 'list.json'), encoding='utf8'))
    L['voices'] = [v for v in L['voices'] if not v['id'].startswith('gm_')]
    model = None
    for voice, ko in VOICES:
        files = []
        for i, text in enumerate(L['lines'][:4]):
            pcm = None
            for m in ([model] if model else tts[:3]):
                pcm, mime = say(m, voice, text, NOTES[i])
                if pcm: model = m; break
                if mime == 'quota': break
            if not pcm: print('skip', voice, i); continue
            rate = 24000
            if 'rate=' in (mime or ''): rate = int(mime.split('rate=')[1].split(';')[0])
            raw = os.path.join(SAM, f'_gm.pcm'); open(raw, 'wb').write(pcm)
            out = f'gm_{voice.lower()}_{i}.mp3'
            # no silence before the first syllable, a short natural tail
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(rate), '-ac', '1', '-i', raw, '-af',
                            'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-17:TP=-1.5:LRA=11',
                            '-ar', '24000', '-b:a', '128k', os.path.join(SAM, out)], check=True)
            os.remove(raw); files.append(out); time.sleep(7)
        if len(files) == 4:
            L['voices'].insert(1, {'id': 'gm_' + voice.lower(), 'voice': f'{model}:{voice}', 'label': f'Gemini · {ko} (감독 메모로 만든 것)', 'files': files})
    json.dump(L, open(os.path.join(SAM, 'list.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('done', [v['id'] for v in L['voices']])

if __name__ == '__main__': main()
