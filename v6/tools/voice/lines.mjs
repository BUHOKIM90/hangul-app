// Writes v6/tools/voice/lines.json: every clip the app can play -> the exact Korean text it must say.
// node v6/tools/voice/lines.mjs <repo-root>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(process.argv[2] || '.');
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'v6/js/data.js'), 'utf8'), { window: win, console });
const D = win.D;
const hex = c => c.charCodeAt(0).toString(16).toUpperCase();
const ch = h => String.fromCharCode(parseInt(h, 16));
const hasB = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
// the clip set the app uses (same rules as build.mjs)
const keys = new Set(['ui_good1', 'ui_good2', 'ui_good3', 'ui_found', 'ui_same', 'ui_hiname', 'ui_sticker', 'ui_levelup', 'ui4_treasure',
  'ui4_tapnext', 'ui4_hint', 'ui4_try', 'ui4_today', 'ui4_bye', 'ui4_free',
  'ui4_chant', 'ui4_balloon', 'ui4_echo2', 'ui_which', 'ui_clapyou', 'ui_clapq', 'ui4_block', 'ui_trace', 'ui_train', 'ui4_memory', 'ui_together']);
Object.values(D.PRAISE_VOICE).forEach(p => keys.add(p[1]));
Object.values(D.PROMPT_CLIP).forEach(p => keys.add(p[0]));
Array.from(D.SY).forEach(c => keys.add('sy_' + hex(c)));
Array.from('거고구기끼나누니다도두디라려리마머모무미바방부비빠사소스아어엄여오우원유이자주차코포하할허').forEach(c => keys.add('fy_' + hex(c)));
Array.from('가거고구그기나너노누느니다더도두드디라러로루르리마머모무므미바박방버보봉부브비사서소수스시아어오우으이자저조주즈지초하허호후흐히').forEach(c => keys.add('dy_' + hex(c)));
Array.from('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅓㅔㅕㅗㅘㅚㅛㅜㅝㅟㅠㅡㅢㅣ').forEach(c => keys.add('j_' + hex(c)));
Object.keys(D.WORDS).forEach(k => keys.add('w_' + k));
D.HY.forEach(k => keys.add('hy_' + k));
D.CLAP.forEach(k => keys.add('c_' + k));
D.SENTENCES.forEach(s => keys.add(s.clip));

// fixed lines: the subtitle the app shows for that clip is the text
const FIXED = {
  ui_good1: '잘했어!', ui_good2: '멋져!', ui_good3: '최고야!', ui_found: '찾았다!', ui_same: '같은 소리로 시작하는 그림은 뭘까?',
  ui_hiname: '려원아, 안녕!', ui_sticker: '스티커 받았어!', ui_levelup: '우와, 한 단계 올라갔어!', ui_which: '어떤 그림일까?',
  ui_clapyou: '이제 려원이도 짝짝 쳐 볼까?', ui_clapq: '몇 번 박수 쳤을까?', ui_trace: '분홍 점을 따라 손가락으로 써 볼까?',
  ui_train: '기차 칸을 눌러 봐. 무슨 소리가 날까?', ui_together: '같이 해 보자!', ui_match: '낱말 카드를 그림에 데려다 줄래?',
  ui_find: '어디 있을까?', ui_listen: '잘 듣고 골라 봐.', ui_merge: '블록을 합쳐서 만들어 볼까?',
  ui4_chant: '반짝이는 칸을 눌러 봐!', ui4_balloon: '들은 글자를 눌러 봐!', ui4_block: '블록으로 글자 만들자!',
  ui4_memory: '카드를 뒤집어서 짝꿍을 찾아볼까?', ui4_treasure: '보물 상자를 열어 볼까?', ui4_treasure2: '반짝! 보물을 찾았어!',
  ui4_try: '괜찮아. 같이 해 보자.', ui4_tapnext: '여기 눌러 볼까?', ui4_hint: '여기 반짝이는 데를 봐!',
  ui4_echo2: '이번엔 려원이가 혼자 읽어 볼까?', ui4_today: '오늘 뭐 할까?', ui4_bye: '오늘은 여기까지. 내일 또 하자!',
  ui4_free: '더 놀고 싶으면, 놀이터에서 배운 놀이를 해 볼까?',
  s_1: '나비도 나무도.', s_2: '바나나 나무.', s_4: '나비 모자.', s_6: '아기 모자.'
};
Object.values(D.PRAISE_VOICE).forEach(([text, clip]) => { FIXED[clip] = text; });
const JWORD = { 'ㄲ': '까치', 'ㄸ': '딸기', 'ㅃ': '빵', 'ㅆ': '씨앗', 'ㅘ': '과자', 'ㅝ': '원숭이', 'ㅢ': '의자', 'ㅟ': '귀', 'ㅐ': '개', 'ㅔ': '게' };
const COUNT = ['', '한', '두', '세', '네', '다섯'];
function textOf(k) {
  if (FIXED[k]) return FIXED[k];
  let m = k.match(/^(sy|fy|dy|j)_([0-9A-F]{4})$/);
  if (m) {
    const c = ch(m[2]);
    if (m[1] === 'sy') return c + '.';
    if (m[1] === 'fy') return c + (hasB(c) ? '을' : '를') + ' 찾아볼까?';
    if (m[1] === 'dy') return '그건 ' + c + (hasB(c) ? '이야.' : '야.');
    const name = D.JNAME[c] || D.VROW[c] || c;
    const wk = D.JPIC[c], word = JWORD[c] || (wk && D.WORDS[wk] ? D.WORDS[wk].w : '');
    return word ? `${name}, ${word} 할 때 ${name}.` : name + '.';
  }
  m = k.match(/^(w|hy|c)_(.+)$/);
  const EXTRA = { haema: '해마', heori: '허리', ki: '키', meori: '머리', siso: '시소', tajo: '타조', tteokguk: '떡국' };
  if (m && (D.WORDS[m[2]] || EXTRA[m[2]])) {
    const w = D.WORDS[m[2]] ? D.WORDS[m[2]].w : EXTRA[m[2]];
    if (m[1] === 'w') return w + '.';
    if (m[1] === 'hy') return '그건 ' + w + (hasB(w) ? '이야!' : '야!');
    const syl = Array.from(w);
    return syl.join(', ') + '. ' + COUNT[syl.length] + ' 번!';
  }
  return null;
}
const out = {}, missing = [];
[...keys].sort().forEach(k => { const t = textOf(k); if (t) out[k] = t; else missing.push(k); });
if (missing.length) { console.error('NO TEXT FOR', missing); process.exit(1); }
fs.writeFileSync(path.join(root, 'v6/tools/voice/lines.json'), JSON.stringify(out, null, 1) + '\n');
console.log('lines', Object.keys(out).length);
