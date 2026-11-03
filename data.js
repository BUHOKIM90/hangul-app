'use strict';
/* 한글 놀이 v3 데이터(v2 + 10주 커리큘럼)(v1 data.js 기반: 낱말·구·획·짜임은 그대로, 단계 잠금 대신 PLAYS). 아이 이름·가족 정보는 여기에 넣지 않습니다(표시 이름은 부모 메뉴 → localStorage). */

const CHAR_DIR = 'assets/char/monggeul_';   // 피자 그림 교체 시 경로만 바꾸면 됨
const CHAR_EXT = '.webp';                   // 표정: basic laugh clap surprise think cheer + (FIX4) clap2 wave sleep jump point card

const WORDS = {
  namu: '나무', nabi: '나비', ori: '오리', oi: '오이', agi: '아기',
  moja: '모자', gicha: '기차', banana: '바나나', podo: '포도', gudu: '구두',
  /* v3 새 낱말(커리큘럼 v3). 려원 = 아이 이름(대표님 지시로 TTS 음성도 '려원') */
  ryeowon: '려원', eomma: '엄마', appa: '아빠', halmeoni: '할머니', harabeoji: '할아버지',
  geomi: '거미', yeou: '여우', kokkiri: '코끼리', uyu: '우유', i_tooth: '이', goguma: '고구마', nuna: '누나', dubu: '두부',
  meori: '머리', bada: '바다', so: '소', juseu: '주스', heori: '허리',
  dari: '다리', radio: '라디오', jadu: '자두', hama: '하마', eobu: '어부', ubi: '우비', ima: '이마', eureureong: '으르렁', lion: '사자'
};
/* 그림 없을 때 자리표시(이모지). 피자 그림이 들어오면 tools/import_pics.py → art.js 목록에 id가 생기고 그림으로 바뀜 */
const PH_EMOJI = { ryeowon: '👧', eomma: '👩', appa: '👨', halmeoni: '👵', harabeoji: '👴', geomi: '🕷️', yeou: '🦊', kokkiri: '🐘', uyu: '🥛', i_tooth: '🦷',
  goguma: '🍠', nuna: '👧', dubu: '🧈', meori: '💆', bada: '🌊', so: '🐄', juseu: '🧃', heori: '🙆', eureureong: '🦁', lion: '🦁', hama: '🦛' };
const WORD_IDS = Object.keys(WORDS);
/* 그림 경로: 피자 그림이 tools/import_art.py로 들어오면(assets/art.js의 ART 목록) WebP, 없으면 자리표시 SVG */
const ARTS = typeof ART !== 'undefined' ? ART : { pic: [], sticker: [], phrase: [] };
const PIC = w => 'assets/pic/' + w + (ARTS.pic.includes(w) ? '.webp' : '.svg');
const STICKER = n => { const id = 'st_' + String(n).padStart(2, '0'); return 'assets/sticker/' + id + (ARTS.sticker.includes(id) ? '.webp' : '.svg'); };


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
  jamoX: j => 'jx_' + hex(j),  // 자모 설명(FIX4-A3): 지금은 ㅇ만
  clap: w => 'c_' + w,          // v3 짝짝 시범 "나, 비. 두 번!"
  first: w => 'f_' + w,         // v3 첫 글자 "나, 나비 할 때 나!"
  story: i => 'st_' + (i + 1)   // v3 몽글이 이야기
};
/* 자모 설명 한 줄(FIX4-A3, 니혼 답): ② 글자 놀이에서 이 자모가 문제로 나오면 그림과 함께 화면에 보이고 jx_ 음성으로 읽어 줌 */
const JAMO_NOTE = { 'ㅇ': { text: '동그라미 모양이에요. 맨 앞에 오면 소리가 나지 않아요.', pic: 'oi' } };

/* ---------- v2에서 이어 쓰는 것 ---------- */
/* 자모 소개 낱말·그림. lp = 그림 속 글자(피자 v3, 있으면 글자 친구에서 먼저 보여 줌) */
const JAMO_EX = {"ㄱ": {"word": "기차", "pic": "gicha", "lp": "lp_g"}, "ㄴ": {"word": "나비", "pic": "nabi", "lp": "lp_n"}, "ㄷ": {"word": "다리", "pic": "dari", "lp": "lp_d"}, "ㄹ": {"word": "라디오", "pic": "radio", "lp": "lp_r"}, "ㅁ": {"word": "모자", "pic": "moja", "lp": "lp_m"}, "ㅂ": {"word": "바나나", "pic": "banana", "lp": "lp_b"}, "ㅅ": {"word": "사자", "pic": "lion", "lp": "lp_s"}, "ㅇ": {"word": "오이", "pic": "oi", "lp": "lp_ng"}, "ㅈ": {"word": "자두", "pic": "jadu", "lp": "lp_j"}, "ㅎ": {"word": "하마", "pic": "hama", "lp": "lp_h"}, "ㅏ": {"word": "아기", "pic": "agi", "lp": "lp_a"}, "ㅓ": {"word": "어부", "pic": "eobu", "lp": "lp_eo"}, "ㅗ": {"word": "오리", "pic": "ori", "lp": "lp_o"}, "ㅜ": {"word": "우비", "pic": "ubi", "lp": "lp_u"}, "ㅡ": {"word": "으르렁", "pic": "lion", "lp": "lp_eu"}, "ㅣ": {"word": "이마", "pic": "ima", "lp": "lp_i"}};
const ROUNDS = 5;   // 놀이 하나 = 문제 5개(글자 친구 3, 기차 3, 이야기 4)
const FRUIT_AT = 10;
const REVIEW_AFTER_FIRST = true;   // v3: 처음 해 본 놀이도 1일 뒤 다시 보기(1·3·7·14일)

/* ---------- v3 커리큘럼 (curriculum_v3.md) ---------- */
/* 놀이 종류: 아이에게 보이는 이름(kid) + 보호자용 목적 한 줄(why, 어른 메뉴에만) */
const KINDS = {
  name:     { kid: '내 이름 찾기',     why: '자기 이름·가족 낱말을 통째로 알아봐요', icon: '🏷️' },
  listen:   { kid: '어디 있니?',       why: '낱말 소리를 듣고 뜻(그림)과 이어요', icon: '👂' },
  clap:     { kid: '짝짝 글자 세기',   why: '말소리 한 번은 글자 한 개라는 걸 알아요(몽글이가 먼저 보여 줘요)', icon: '👏' },
  blend:    { kid: '뚝딱 소리 붙이기', why: '나눠 들은 소리를 합쳐 낱말을 만들어요(가장 먼저 발달하는 소리 기술)', icon: '🧩' },
  same:     { kid: '누구랑 같은 소리?', why: '첫 글자 소리를 알아들어요', icon: '🔔' },
  letter:   { kid: '글자 친구 만나기', why: '글자 이름·모양·예시 낱말을 연결해요(그림 속 글자)', icon: '🌟' },
  pick:     { kid: '숨은 글자 찾기',   why: '비슷한 글자 모양을 구별해요', icon: '🔍' },
  trace:    { kid: '손가락 쓰기',      why: '글자 모양과 쓰는 순서에 익숙해져요(벌점 없음)', icon: '✏️' },
  copy:     { kid: '보고 쓰기',        why: '본 글자를 기억해서 써 봐요', icon: '✏️' },
  merge:    { kid: '글자 뚝딱',        why: '자음과 모음이 만나 글자가 돼요', icon: '🧱' },
  train:    { kid: '가나다 기차',      why: '자음 하나에 모음을 바꾸면 소리가 바뀌어요(가나다 표)', icon: '🚂' },
  readword: { kid: '읽고 찾기',        why: '배운 글자로 된 낱말을 읽고 뜻과 이어요', icon: '📖' },
  match:    { kid: '낱말 짝꿍',        why: '낱말 카드를 그림과 짝지으며 읽어요', icon: '🃏' },
  story:    { kid: '몽글이 이야기',    why: '문장을 손가락으로 짚으며 읽어요(묻고 답하며)', icon: '📚' }
};
const ROWS = KINDS;   // (v2 호환 이름)
/* 짝짝 시범 낱말(c_ 음성 있음) */
const CLAP_WORDS = ['so', 'nabi', 'eomma', 'appa', 'ryeowon', 'hama', 'ori', 'kokkiri', 'halmeoni', 'goguma', 'banana', 'harabeoji'];
/* 누구랑 같은 소리? f_<보기 낱말> → 같은 첫 글자 정답 그림 */
const SAME = { nabi: 'namu', namu: 'nabi', oi: 'ori', ori: 'oi', banana: 'bada', bada: 'banana', agi: 'appa', appa: 'agi', uyu: 'ubi', ubi: 'uyu', ima: 'i_tooth' };
/* 뚝딱 소리 붙이기: sy_ 음성이 있는 받침 없는 낱말만 */
const BLEND_WORDS = ['hama', 'nabi', 'ori', 'lion', 'geomi', 'moja', 'bada', 'dubu', 'jadu', 'meori', 'goguma', 'banana', 'radio', 'dari', 'namu', 'oi', 'agi', 'ubi', 'ima', 'eobu', 'nuna', 'heori'];
const FAMILY = ['ryeowon', 'eomma', 'appa', 'halmeoni', 'harabeoji'];
/* 몽글이 이야기 4쪽. pics = 그림 없을 때 합친 자리표시, target = "어디 있는지 짚어 볼까?" 낱말 */
const STORY = [
  { text: '나비가 나무 아래', pic: 'story_1', pics: ['namu', 'nabi'], target: 'nabi', at: 0 },
  { text: '하마 모자', pic: 'story_2', pics: [{ base: 'hama', top: 'moja', at: [22, -6, 56] }], target: 'hama', at: 0 },
  { text: '려원이도 모자', pic: 'story_3', pics: ['ryeowon', 'moja'], target: 'ryeowon', at: 0 },
  { text: '오리 두 마리', pic: 'story_4', pics: ['ori', 'ori'], target: 'ori', at: 0 }
];
const SENTENCES = STORY;   // (v2 이름 호환)
const TRAIN_C = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅎ'], TRAIN_V = [...'ㅏㅓㅗㅜㅡㅣ'];
/* 몸으로 글자 만들기(쉬어 가기) */
const POSES = [{ j: 'ㅣ', pic: 'pose_i', how: '똑바로 서서 팔을 몸에 붙여요' }, { j: 'ㅏ', pic: 'pose_a', how: '한 팔을 옆으로 쭉 뻗어요' },
  { j: 'ㄱ', pic: 'pose_g', how: '허리를 숙여 ㄱ 모양을 만들어요' }, { j: 'ㅇ', pic: 'pose_ng', how: '두 팔로 머리 위에 동그라미를 만들어요' }];

const V = [...'ㅏㅓㅗㅜㅡㅣ'], C = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅎ'];
/* 10주 주제(화단). plays: id·kind·items(+옵션). 잠금 없음, 순서는 추천일 뿐 */
const TOPICS = [
  { n: 1, id: 't1', short: '내 이름', title: '내 이름, 우리 가족', pic: 'ryeowon', color: 'peach', home: '현관과 방문에 이름표를 붙이고, 가족 이름을 짝짝 손뼉으로 세어 보세요.', move: 'ㅇ',
    plays: [{ id: 'name-1', kind: 'name', items: FAMILY }, { id: 'listen-fam', kind: 'listen', items: ['eomma', 'appa', 'halmeoni', 'harabeoji', 'agi', 'ryeowon'] },
      { id: 'clap-1', kind: 'clap', items: ['eomma', 'appa', 'ryeowon', 'halmeoni', 'harabeoji', 'so'] }, { id: 'trace-ng', kind: 'trace', items: ['ㅇ'] }] },
  { n: 2, id: 't2', short: '동물 소리', title: '동물 소리 놀이', pic: 'hama', color: 'butter', home: '동물 흉내를 내면서 이름을 끊어 말해 보세요("하-마").', move: 'ㅣ',
    plays: [{ id: 'listen-ani', kind: 'listen', items: ['ori', 'hama', 'lion', 'nabi', 'geomi', 'yeou', 'kokkiri'] }, { id: 'clap-2', kind: 'clap', items: ['so', 'nabi', 'hama', 'ori', 'kokkiri'] },
      { id: 'blend-1', kind: 'blend', items: ['hama', 'nabi', 'ori', 'lion', 'geomi'] }, { id: 'same-1', kind: 'same', items: ['nabi', 'namu', 'oi', 'ori', 'banana', 'bada'] }] },
  { n: 3, id: 't3', short: '아 이 오 우', title: '모음 친구 ①: 아 이 오 우', pic: 'oi', color: 'mint', home: '팔을 뻗어 몸으로 ㅏ·ㅣ·ㅗ·ㅜ를 만들어 보세요.', move: 'ㅏ',
    plays: [{ id: 'letter-v1', kind: 'letter', items: ['ㅏ', 'ㅣ', 'ㅗ', 'ㅜ'] }, { id: 'pick-v1', kind: 'pick', items: ['ㅏ', 'ㅣ', 'ㅗ', 'ㅜ'] },
      { id: 'trace-v1', kind: 'trace', items: ['ㅣ', 'ㅏ', 'ㅗ', 'ㅜ'] }, { id: 'read-v1', kind: 'readword', items: ['agi', 'oi', 'uyu', 'ori', 'i_tooth'] }] },
  { n: 4, id: 't4', short: '어 으', title: '모음 친구 ②: 어 으 + 다시 보기', pic: 'eobu', color: 'lav', home: '그림책에서 ㅏ·ㅓ를 찾아 손가락으로 짚어 보세요.', move: 'ㅣ',
    plays: [{ id: 'letter-v2', kind: 'letter', items: ['ㅓ', 'ㅡ', 'ㅏ', 'ㅗ', 'ㅜ', 'ㅣ'] }, { id: 'pick-v2', kind: 'pick', items: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'] },
      { id: 'clap-4', kind: 'clap', items: CLAP_WORDS }, { id: 'trace-v2', kind: 'trace', items: ['ㅓ', 'ㅡ', 'ㅏ', 'ㅗ', 'ㅜ', 'ㅣ'] }] },
  { n: 5, id: 't5', short: 'ㄱ ㄴ', title: '자음 친구 ①: ㄱ ㄴ', pic: 'gicha', color: 'peach', home: '집 안에서 \u2018기\u2019·\u2018나\u2019로 시작하는 물건을 찾아보세요.', move: 'ㄱ',
    plays: [{ id: 'letter-gn', kind: 'letter', items: ['ㄱ', 'ㄴ'] }, { id: 'same-2', kind: 'same', items: ['nabi', 'namu', 'agi', 'appa', 'uyu', 'ubi'] },
      { id: 'merge-gn', kind: 'merge', items: [...'가나고노거너구누기니'] }, { id: 'trace-gn', kind: 'trace', items: ['ㄱ', 'ㄴ'] }] },
  { n: 6, id: 't6', short: 'ㄷ ㅁ ㅂ', title: '자음 친구 ②: ㄷ ㅁ ㅂ', pic: 'moja', color: 'butter', home: '클레이로 ㄷ·ㅁ·ㅂ을 만들어 보세요.', move: 'ㅇ',
    plays: [{ id: 'letter-dmb', kind: 'letter', items: ['ㄷ', 'ㅁ', 'ㅂ'] }, { id: 'pick-dmb', kind: 'pick', items: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅁ', 'ㅂ'] },
      { id: 'merge-dmb', kind: 'merge', items: [...'다마바도모보두무부미비'] }, { id: 'read-dmb', kind: 'readword', items: ['dari', 'dubu', 'moja', 'meori', 'banana', 'bada'] }] },
  { n: 7, id: 't7', short: 'ㅅ ㅈ ㅎ ㄹ', title: '자음 친구 ③: ㅅ ㅈ ㅎ ㄹ', pic: 'lion', color: 'mint', home: '엄마 아빠 등에 손가락으로 글자를 쓰고 맞혀 보세요.', move: 'ㄱ',
    plays: [{ id: 'letter-sjhr', kind: 'letter', items: ['ㅅ', 'ㅈ', 'ㅎ', 'ㄹ'] }, { id: 'same-3', kind: 'same', items: Object.keys(SAME) },
      { id: 'merge-sjhr', kind: 'merge', items: [...'사자하라소조호로수주후루시지히리'] }, { id: 'trace-sjhr', kind: 'trace', items: ['ㅅ', 'ㅈ', 'ㅎ', 'ㄹ', 'ㄷ', 'ㅁ', 'ㅂ'] }] },
  { n: 8, id: 't8', short: '가나다 기차', title: '가나다 기차', pic: 'gicha', color: 'lav', home: '큰 종이에 가나다 표를 같이 그리고 스티커를 붙여 보세요.', move: 'ㅏ',
    plays: [{ id: 'train', kind: 'train', items: TRAIN_C }, { id: 'merge-all', kind: 'merge', items: [...'가나다라마바사아자하고노도모보소'] },
      { id: 'pick-syl', kind: 'pick', items: [...'가나다라마바사아자하'] }, { id: 'clap-8', kind: 'clap', items: CLAP_WORDS }] },
  { n: 9, id: 't9', short: '읽을 수 있어', title: '읽을 수 있어요! 낱말', pic: 'nabi', color: 'peach', home: '장보기 목록을 그림+글자로 써 주고 아이가 \u2018읽게\u2019 해 보세요.', move: 'ㅇ',
    plays: [{ id: 'read-all', kind: 'readword', items: ['nabi', 'ori', 'moja', 'bada', 'hama', 'geomi', 'dubu', 'ubi', 'jadu', 'goguma', 'meori', 'lion'] },
      { id: 'match-all', kind: 'match', items: ['nabi', 'ori', 'moja', 'bada', 'hama', 'geomi', 'dubu', 'ubi', 'jadu', 'goguma', 'meori', 'lion'] },
      { id: 'blend-2', kind: 'blend', items: BLEND_WORDS, showText: true }, { id: 'copy-all', kind: 'copy', items: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅣ'] }] },
  { n: 10, id: 't10', short: '내 책', title: '몽글이 이야기, 내 책', pic: 'story_3', color: 'butter', home: '4쪽짜리 \u2018려원이 책\u2019을 만들어 보세요(아이가 그리고 어른이 받침 없는 말로 받아 적기).', move: 'ㅣ',
    plays: [{ id: 'story', kind: 'story', items: [0, 1, 2, 3] }, { id: 'name-2', kind: 'name', items: FAMILY, inSentence: true },
      { id: 'read-10', kind: 'readword', items: ['nabi', 'namu', 'hama', 'moja', 'ori', 'ryeowon', 'eomma', 'appa'] }, { id: 'trace-all', kind: 'trace', items: [...C, ...V] }] }
];
const PLAYS = [];
TOPICS.forEach(t => t.plays.forEach(p => { p.topic = t.id; p.row = t.id; p.name = KINDS[p.kind].kid; PLAYS.push(p); }));
const topicById = id => TOPICS.find(t => t.id === id);
const FLOWERS_TO_SUGGEST = 2;   // 이번 주제에서 꽃이 2개 이상이면 다음 주제를 추천(잠금 아님)
const WEEKEND_DAY = 6;          // 토요일 = '모아 놀기'(새 내용 없음)

/* v1 단원 → v2 놀이 (옛 기록 옮기기용) */
const V1_MAP = { '1-1': ['listen'], '1-2': ['clap'], '2-1': ['letter-a', 'pick-a'], '2-2': ['letter-b', 'pick-b'], '2-3': ['letter-c', 'pick-c'],
  '3-1': ['merge-1'], '3-2': ['merge-2'], '3-3': ['merge-3'], '4-1': ['readword', 'match'], '5-1': ['sentence'], '6-1': ['trace-v'], '6-2': ['trace-c', 'copy'] };
/* v2 놀이 → v3 놀이 */
const V2_MAP = { listen: ['listen-ani'], clap: ['clap-1'], 'letter-a': ['letter-gn', 'letter-dmb'], 'pick-a': ['pick-dmb'], 'letter-b': ['letter-v1', 'letter-v2'],
  'pick-b': ['pick-v1', 'pick-v2'], 'letter-c': ['letter-sjhr'], 'pick-c': [], 'merge-1': ['merge-all'], 'merge-2': ['merge-dmb'], 'merge-3': ['merge-gn'],
  readword: ['read-all'], match: ['match-all'], sentence: ['story'], 'trace-v': ['trace-v1', 'trace-v2'], 'trace-c': ['trace-gn', 'trace-sjhr'], copy: ['copy-all'] };
const PAPER_IDEAS = ['큰 종이에 오늘 만난 글자를 크게 같이 써 보기', '집 안에서 같은 글자 찾기 산책(과자 봉지, 책 표지)', '밀가루 반죽이나 클레이로 글자 만들기',
  '손가락으로 엄마 아빠 등에 글자 쓰고 맞히기', '그림책에서 오늘 글자 찾아 손가락으로 짚기', '크레파스로 자유롭게 끼적이기(모양이 달라도 칭찬)'];
