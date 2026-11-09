#!/usr/bin/env python3
"""Same few lines in every voice that can speak Korean, so a parent can listen and choose (adult menu → 목소리 고르기).
Writes v6/voice-samples/<id>_<n>.mp3 and v6/voice-samples/list.json."""
import asyncio, json, os
import edge_tts
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'v6/voice-samples')
LINES = ['려원아, 안녕! 오늘도 같이 놀자!', '그건 가 글자야.', '나비.', '잘했어! 혼자 읽었네!']
# (id, voice, rate, pitch, label)
CANDIDATES = [
    ('sunhi', 'ko-KR-SunHiNeural', '-6%', '+6Hz', '선희 (지금 목소리, 여성)'),
    ('sunhi_slow', 'ko-KR-SunHiNeural', '-14%', '+0Hz', '선희, 더 차분하게'),
    ('hyunsu', 'ko-KR-HyunsuMultilingualNeural', '-6%', '+0Hz', '현수 (최신 음성, 남성)'),
    ('injoon', 'ko-KR-InJoonNeural', '-6%', '+0Hz', '인준 (남성)'),
]
async def main():
    os.makedirs(OUT, exist_ok=True)
    voices = await edge_tts.list_voices()
    names = {v['ShortName'] for v in voices}
    # newer multilingual voices that also speak Korean (female first)
    for vid, short in [('ava', 'en-US-AvaMultilingualNeural'), ('emma', 'en-US-EmmaMultilingualNeural'), ('seraphina', 'de-DE-SeraphinaMultilingualNeural'), ('vivienne', 'fr-FR-VivienneMultilingualNeural')]:
        if short in names: CANDIDATES.append((vid, short, '-8%', '+0Hz', f'{short.split("-")[2].replace("MultilingualNeural", "")} (다국어 최신 음성, 여성)'))
    for v in voices:
        if v['Locale'] == 'ko-KR' and v['ShortName'] not in [c[1] for c in CANDIDATES]:
            CANDIDATES.append((v['ShortName'].split('-')[2].lower(), v['ShortName'], '-6%', '+0Hz', v['ShortName']))
    out = []
    for vid, short, rate, pitch, label in CANDIDATES:
        files = []
        for i, t in enumerate(LINES):
            f = f'{vid}_{i}.mp3'
            try:
                await edge_tts.Communicate(t, short, rate=rate, pitch=pitch).save(os.path.join(OUT, f)); files.append(f)
            except Exception as e:
                print('fail', short, e)
        if files: out.append({'id': vid, 'voice': short, 'rate': rate, 'pitch': pitch, 'label': label, 'files': files})
    json.dump({'lines': LINES, 'voices': out}, open(os.path.join(OUT, 'list.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('voices', [o['voice'] for o in out], 'korean voices available:', sorted(v['ShortName'] for v in voices if v['Locale'] == 'ko-KR'))
asyncio.run(main())
