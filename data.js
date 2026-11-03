'use strict';
/* 한글 놀이 v2 데이터(v1 data.js 기반: 낱말·구·획·짜임은 그대로, 단계 잠금 대신 PLAYS). 아이 이름·가족 정보는 여기에 넣지 않습니다(표시 이름은 부모 메뉴 → localStorage). */

const CHAR_DIR = 'assets/char/monggeul_';   // 피자 그림 교체 시 경로만 바꾸면 됨
const CHAR_EXT = '.webp';                   // 표정: basic laugh clap surprise think cheer + (FIX4) clap2 wave sleep jump point card

const WORDS = {
  namu: '나무', nabi: '나비', ori: '오리', oi: '오이', agi: '아기',   // 우유(ㅠ) → 아기(FIX2: ㅇㅏㄱㅣ 모두 배우는 자모)
  moja: '모자', gicha: '기차', banana: '바나나', podo: '포도', gudu: '구두'
};
const WORD_IDS = Object.keys(WORDS);
/* 그림 경로: 피자 그림이 tools/import_art.py로 들어오면(assets/art.js의 ART 목록) WebP, 없으면 자리표시 SVG */
const ARTS = typeof ART !== 'undefined' ? ART : { pic: [], sticker: [], phrase: [] };
const PIC = w => 'assets/pic/' + w + (ARTS.pic.includes(w) ? '.webp' : '.svg');
const STICKER = n => { const id = 'st_' + String(n).padStart(2, '0'); return 'assets/sticker/' + id + (ARTS.sticker.includes(id) ? '.webp' : '.svg'); };
const PHRASE = i => (ARTS.phrase.includes('phrase_' + (i + 1)) ? 'assets/pic/phrase_' + (i + 1) + '.webp' : null);

/* ⑤ 쉽게 읽기: 받침 없음 + 배운 모음(ㅏㅓㅗㅜㅡㅣ)만 쓰는 짧은 구. ('~가 있어요' 문장은 받침·ㅘ 때문에 v2로 옮김)
   pics: 그림 칸 목록. 문자열 = 그림 하나, {base, top, at:[왼%, 위%, 폭%]} = 한 그림 위에 다른 그림을 얹은 합친 그림(예: 나비 달린 모자).
   '~도 ~도' = 그림 둘, 'X 모자'·'바나나 나무' = 합친 그림 하나, '오리 두 마리' = 오리 둘. 음성 파일 s_<순서>.mp3 (FIX2: s_3·s_6만 바뀜) */
const SENTENCES = [
  { text: '나비도 나무도', pics: ['nabi', 'namu'] },
  { text: '바나나 나무', pics: [{ base: 'namu', top: 'banana', at: [29, 20, 40] }] },
  { text: '오리 두 마리', pics: ['ori', 'ori'] },
  { text: '나비 모자', pics: [{ base: 'moja', top: 'nabi', at: [27, 13, 45] }] },
  { text: '포도도 오이도', pics: ['podo', 'oi'] },
  { text: '아기 모자', pics: [{ base: 'agi', top: 'moja', at: [20, -7, 60] }] }
];

const MASTERY = { window: 5, need: 4, days: 2 }; // 최근 5번 중 4번(첫 시도 정답) + 그 5번이 서로 다른 날짜 2개 이상(기기 로컬 날짜, FIX2)
const REVIEW_DAYS = [1, 3, 7, 14];               // 복습 상자 간격
const TRACE = { tol: 18, cover: 0.65, stray: 25, strayMax: 0.5, maxTries: 3 };
/* 스티커 번호 목록: 피자 WebP가 들어오면 그 번호들(24장), 없으면 자리표시 st_01..12.svg */
const STICKER_IDS = (ARTS.sticker.length ? ARTS.sticker.map(x => +x.slice(3)) : Array.from({ length: 12 }, (_, i) => i + 1));

/* 획 경로: 100×100 칸, 교과서 관행 순서. 직접 작성(외부 데이터 아님). 원은 {c:[cx,cy,r]} = 위에서 시작해 반시계. */
const STROKES = {
  'ㄱ': [[[18, 22], [78, 22], [78, 86]]],
  'ㄴ': [[[24, 14], [24, 80], [84, 80]]],
  'ㄷ': [[[20, 16], [80, 16]], [[20, 16], [20, 84], [82, 84]]],
  'ㄹ': [[[20, 14], [78, 14], [78, 48]], [[20, 48], [78, 48]], [[20, 48], [20, 86], [82, 86]]],
  'ㅁ': [[[22, 18], [22, 82]], [[22, 18], [78, 18], [78, 82]], [[22, 82], [78, 82]]],
  'ㅂ': [[[24, 12], [24, 86]], [[76, 12], [76, 86]], [[24, 46], [76, 46]], [[24, 86], [76, 86]]],
  'ㅅ': [[[50, 14], [18, 86]], [[47, 46], [84, 86]]],
  'ㅇ': [{ c: [50, 50, 34] }],
  'ㅈ': [[[20, 18], [78, 18], [18, 86]], [[50, 48], [84, 86]]],
  'ㅎ': [[[38, 10], [62, 10]], [[18, 28], [82, 28]], { c: [50, 64, 22] }],
  'ㅏ': [[[38, 8], [38, 92]], [[38, 50], [72, 50]]],
  'ㅓ': [[[28, 50], [62, 50]], [[62, 8], [62, 92]]],
  'ㅗ': [[[50, 32], [50, 66]], [[10, 66], [90, 66]]],
  'ㅜ': [[[10, 36], [90, 36]], [[50, 36], [50, 82]]],
  'ㅡ': [[[10, 50], [90, 50]]],
  'ㅣ': [[[50, 8], [50, 92]]]
};

/* 한글 짜임 */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
function splitSyllable(s) {
  const n = s.charCodeAt(0) - 0xAC00;
  return { cho: CHO[Math.floor(n / 588)], jung: JUNG[Math.floor((n % 588) / 28)] };
}
const VERTICAL_VOWELS = 'ㅏㅓㅣ';   // 옆 짜임(나머지 ㅗㅜㅡ는 위아래 짜임)
const hex = c => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
const VOICE = {
  jamo: j => 'j_' + hex(j),
  syl: s => 'sy_' + hex(s),
  word: w => 'w_' + w,
  sentence: i => 's_' + (i + 1),
  jamoX: j => 'jx_' + hex(j)   // 자모 설명(FIX4-A3): 지금은 ㅇ만
};
/* 자모 설명 한 줄(FIX4-A3, 니혼 답): ② 글자 놀이에서 이 자모가 문제로 나오면 그림과 함께 화면에 보이고 jx_ 음성으로 읽어 줌 */
const JAMO_NOTE = { 'ㅇ': { text: '동그라미 모양이에요. 맨 앞에 오면 소리가 나지 않아요.', pic: 'oi' } };

/* ---------- v2 ---------- */
/* 자모 소개 낱말·그림(v2/data/jamo_examples.json과 같음). 그림 바꾸기: assets/pic/<pic>.webp 교체(이름 같게) */
const JAMO_EX = {"ㄱ": {"word": "기차", "pic": "gicha"}, "ㄴ": {"word": "나비", "pic": "nabi"}, "ㄷ": {"word": "다리", "pic": "dari"}, "ㄹ": {"word": "라디오", "pic": "radio"}, "ㅁ": {"word": "모자", "pic": "moja"}, "ㅂ": {"word": "바나나", "pic": "banana"}, "ㅅ": {"word": "사자", "pic": "lion"}, "ㅇ": {"word": "오이", "pic": "oi"}, "ㅈ": {"word": "자두", "pic": "jadu"}, "ㅎ": {"word": "하마", "pic": "hama"}, "ㅏ": {"word": "아기", "pic": "agi"}, "ㅓ": {"word": "어부", "pic": "eobu"}, "ㅗ": {"word": "오리", "pic": "ori"}, "ㅜ": {"word": "우비", "pic": "ubi"}, "ㅡ": {"word": "으르렁", "pic": "lion"}, "ㅣ": {"word": "이마", "pic": "ima"}};
const ROUNDS = 5;   // 놀이 하나 = 문제 5개(글자 친구는 글자 3개)
/* 놀이 목록 = 추천 순서(잠금 아님). row = 정원 줄. kind: listen·clap·letter·pick·merge·readword·match·sentence·trace·copy */
const ROWS = [
  { id: 'sound', name: '소리', color: 'butter' }, { id: 'letter', name: '글자 친구', color: 'peach' }, { id: 'merge', name: '합치기', color: 'lav' },
  { id: 'word', name: '낱말', color: 'mint' }, { id: 'read', name: '읽기', color: 'mint' }, { id: 'write', name: '쓰기', color: 'lav' }
];
const PLAYS = [
  { id: 'listen', row: 'sound', kind: 'listen', name: '그림 찾기', items: WORD_IDS, pic: 'podo' },
  { id: 'clap', row: 'sound', kind: 'clap', name: '박수 세기', items: WORD_IDS, pic: 'nabi' },
  { id: 'letter-a', row: 'letter', kind: 'letter', name: 'ㄱ ㄴ ㄷ ㅁ ㅂ ㅏ', items: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅁ', 'ㅂ', 'ㅏ'] },
  { id: 'pick-a', row: 'letter', kind: 'pick', name: '글자 고르기 1', items: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅁ', 'ㅂ', 'ㅏ', '가', '나', '다'] },
  { id: 'letter-b', row: 'letter', kind: 'letter', name: 'ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ', items: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'] },
  { id: 'pick-b', row: 'letter', kind: 'pick', name: '글자 고르기 2', items: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'] },
  { id: 'letter-c', row: 'letter', kind: 'letter', name: 'ㄹ ㅅ ㅇ ㅈ ㅎ', items: ['ㄹ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ'] },
  { id: 'pick-c', row: 'letter', kind: 'pick', name: '글자 고르기 3', items: ['ㄹ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ'] },
  { id: 'merge-1', row: 'merge', kind: 'merge', name: '가 나 다', items: [...'가나다마바사'] },
  { id: 'merge-2', row: 'merge', kind: 'merge', name: '고 노 도', items: [...'고노도모보소구누두무부'] },
  { id: 'merge-3', row: 'merge', kind: 'merge', name: '거 너 머', items: [...'거너머기니미비시'] },
  { id: 'readword', row: 'word', kind: 'readword', name: '낱말 읽기', items: WORD_IDS, pic: 'nabi' },
  { id: 'match', row: 'word', kind: 'match', name: '낱말 짝', items: WORD_IDS, pic: 'moja' },
  { id: 'sentence', row: 'read', kind: 'sentence', name: '같이 읽기', items: SENTENCES.map((_, i) => i), pic: 'ori' },
  { id: 'trace-v', row: 'write', kind: 'trace', name: '모음 쓰기', items: ['ㅣ', 'ㅡ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'] },
  { id: 'trace-c', row: 'write', kind: 'trace', name: '자음 쓰기', items: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ'] },
  { id: 'copy', row: 'write', kind: 'copy', name: '보고 쓰기', items: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅁ', 'ㅂ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅣ'] }
];
const FRUIT_AT = 10;   // 10번 넘게 하면 열매
/* v1 단원 → v2 놀이(기록 옮기기용) */
const V1_MAP = { '1-1': ['listen'], '1-2': ['clap'], '2-1': ['letter-a', 'pick-a'], '2-2': ['letter-b', 'pick-b'], '2-3': ['letter-c', 'pick-c'],
  '3-1': ['merge-1'], '3-2': ['merge-2'], '3-3': ['merge-3'], '4-1': ['readword', 'match'], '5-1': ['sentence'], '6-1': ['trace-v'], '6-2': ['trace-c', 'copy'] };
/* 종이 놀이 아이디어(보호자용) */
const PAPER_IDEAS = ['큰 종이에 오늘 만난 글자를 크게 같이 써 보기', '집 안에서 같은 글자 찾기 산책(과자 봉지, 책 표지)', '밀가루 반죽이나 클레이로 글자 만들기',
  '손가락으로 엄마 아빠 등에 글자 쓰고 맞히기', '그림책에서 오늘 글자 찾아 손가락으로 짚기', '크레파스로 자유롭게 끼적이기(모양이 달라도 칭찬)'];
