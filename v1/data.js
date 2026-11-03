'use strict';
/* 한글 놀이 v1 데이터. 아이 이름·가족 정보는 여기에 넣지 않습니다(표시 이름은 부모 메뉴 → localStorage). */

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
const BG = n => (ARTS.bg && ARTS.bg.includes(n) ? 'assets/bg/' + n + '.webp' : null);   // FIX4-B3: 피자 배경(없으면 크림 바탕)
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

/* 단계 순서 고정: 소리 → 글자 → 글자 합치기 → 낱말 → 쉽게 읽기 → 따라 쓰기 */
const STAGES = [
  { id: 1, name: '소리', voice: 'ui_stage1', units: [
    { id: '1-1', type: 'word2pic', items: WORD_IDS },
    { id: '1-2', type: 'clap', items: WORD_IDS } ] },
  { id: 2, name: '글자', voice: 'ui_stage2', units: [
    { id: '2-1', type: 'jamo', items: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅁ', 'ㅂ', 'ㅏ', '가', '나', '다'] },   // FIX2: ㅏ를 자음1과 함께 + 가·나·다 듣고 고르기(글자 카드끼리만 섞음)
    { id: '2-2', type: 'jamo', items: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'] },   // ㅏ는 복습
    { id: '2-3', type: 'jamo', items: ['ㄹ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ'] } ] },
  { id: 3, name: '합치기', voice: 'ui_stage3', units: [
    { id: '3-1', type: 'merge', items: [...'가나다마바사'] },
    { id: '3-2', type: 'merge', items: [...'고노도모보소구누두무부'] },
    { id: '3-3', type: 'merge', items: [...'거너머기니미비시'] } ] },
  { id: 4, name: '낱말', voice: 'ui_stage4', units: [
    { id: '4-1', type: 'match', items: WORD_IDS } ] },
  { id: 5, name: '읽기', voice: 'ui_stage5', units: [
    { id: '5-1', type: 'sentence', items: SENTENCES.map((_, i) => i) } ] },
  { id: 6, name: '쓰기', voice: 'ui_stage6', units: [
    { id: '6-1', type: 'trace', items: ['ㅣ', 'ㅡ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'] },
    { id: '6-2', type: 'trace', items: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ'] } ] }
];

const ROUNDS_PER_LESSON = 5;
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
const JAMO_NOTE = { 'ㅇ': { text: '모양은 동그라미, 소리는 없어요.', pic: 'oi' } };
