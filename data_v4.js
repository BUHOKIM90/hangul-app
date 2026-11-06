'use strict';
/* 한글 놀이 v4 데이터 더하기(v3 data.js 위에): 새 낱말·자리표시, ㅊㅋㅌㅍ 소개 낱말, 몸 글자, 헷갈리는 짝, 놀이 아이콘·스킨, 음성 키. */
Object.assign(WORDS, WORDS_V4);
Object.keys(WORDS_V4).forEach(w => { if (EMO_V4[w] && !PH_EMOJI[w]) PH_EMOJI[w] = EMO_V4[w]; });
Object.entries(CAT_V4).forEach(([w, c]) => { if (WCAT[c] && !WCAT[c].includes(w)) { WCAT[c].push(w); PW_WORDS.push(w); } });
Object.assign(JAMO_EX, { 'ㅋ': { word: '코끼리', pic: 'kokkiri', lp: 'lp_k' }, 'ㅌ': { word: '토끼', pic: 'tokki', lp: 'lp_t' }, 'ㅊ': { word: '치마', pic: 'chima', lp: 'lp_ch' }, 'ㅍ': { word: '포도', pic: 'podo', lp: 'lp_p' } });
/* 쉬어 가기. 글자 모양을 만들라고 하지 않음. 서기/앉기 중 편한 쪽, 건너뛰기 가능.
   pic 은 assets/pic/<id>.webp. art.js에 없는 포즈는 놀이에 넣지 않는다(몽글이 점프로 대신하지 않음). */
const POSE_HOW = {
  'ㅣ': '두 발을 바닥에 붙이고 머리만 하늘 쪽으로 길게. 팔은 편하게.',
  'ㅏ': '한 팔만 옆으로 천천히. 아프면 바로 내려요.',
  'ㅓ': '반대 팔만 옆으로 살살. 아프면 내려요.',
  'ㅗ': '두 팔을 앞으로 천천히. 하늘까지 안 가도 돼요.',
  'ㅜ': '무릎을 살짝 구부렸다 펴요. 아프면 그만.',
  'ㅡ': '두 팔을 낮게 벌려요. 눕지 않아도 돼요.',
  'ㅇ': '어깨를 앞으로, 뒤로 한 번씩만.',
  'ㄱ': '고개만 천천히 끄덕. 세게 숙이지 않아요.',
  'ㄴ': '한 발을 앞으로 살살 내밀어요.',
  'ㄷ': '두 손을 가슴 앞에 살포시 모아요.',
  'ㄹ': '손목만 살살 돌려요.',
  'ㅁ': '두 발을 어깨만큼 벌리고 가만히 서요.',
  'ㅂ': '배에 손을 얹고 숨 한 번 크게.',
  'ㅅ': '두 팔을 아래로 털어요.',
  'ㅈ': '제자리에서 무릎만 살짝.',
  'ㅎ': '웃으면서 볼을 살살 만져요.',
  'ㅋ': '한 손만 위로. 다 안 올라가도 돼요.',
  'ㅌ': '양손을 앞으로 밀었다 내려요.',
  'ㅊ': '손가락을 하나씩 펴요.',
  'ㅍ': '양팔을 옆구리에 붙였다 내려요.',
  'ㅑ': '한 팔만 옆으로 살살.', 'ㅕ': '어깨만 으쓱.', 'ㅛ': '숨 한 번 크게.', 'ㅠ': '발을 앞뒤로 까딱.',
  'ㅐ': '손목을 살살.', 'ㅔ': '손가락 인사.', 'ㄲ': '한 손만 위로.', 'ㄸ': '무릎만 살짝.',
  'ㅃ': '숨 한 번.', 'ㅆ': '팔을 털어요.', 'ㅉ': '어깨만.', 'ㅘ': '발을 붙이고 서요.',
  'ㅝ': '고개만 살짝.', 'ㅚ': '볼을 살살.', 'ㅟ': '한 발만 살살.', 'ㅢ': '두 손 모아요.'
};
const POSE_SIT = {
  'ㅣ': '엉덩이를 의자에 붙이고 등만 길게. 발은 바닥에.',
  'ㅏ': '앉아서 한 팔만 옆으로 살살.',
  'ㅓ': '앉아서 반대 팔만 옆으로.',
  'ㅗ': '앉아서 두 손을 무릎 위에 올리고 숨 쉬어요.',
  'ㅜ': '앉아서 발을 앞뒤로 까딱.',
  'ㅡ': '앉아서 두 팔을 무릎 옆에 내려요.',
  'ㅇ': '앉아서 어깨만 살살 한 바퀴. 아프면 그만.',
  'ㄱ': '앉아서 고개만 살짝.',
  'ㄴ': '앉아서 한 다리만 앞으로 편하게.',
  'ㄷ': '앉아서 두 손을 가슴 앞에 모아요.',
  'ㄹ': '앉아서 손가락을 살살 펴요.',
  'ㅁ': '앉아서 두 손을 포개요.',
  'ㅂ': '앉아서 배에 손 얹고 숨만.',
  'ㅅ': '앉아서 손을 털어요.',
  'ㅈ': '앉아서 발목을 살살.',
  'ㅎ': '앉아서 볼을 살살.',
  'ㅋ': '앉아서 한 손만 위로.',
  'ㅌ': '앉아서 양손을 앞으로 밀어요.',
  'ㅊ': '앉아서 손가락 인사.',
  'ㅍ': '앉아서 허리만 세워요. 젖히지 않아요.'
};
Object.keys(POSE_HOW).forEach(j => { if (!POSE_SIT[j]) POSE_SIT[j] = '앉아서 해도 돼요. 아프면 그만, 하기 싫으면 안 해도 돼요.'; });
const POSE_PIC = { 'ㅣ': 'pose_i', 'ㅏ': 'pose_a', 'ㅓ': 'pose_eo', 'ㅗ': 'pose_o', 'ㅜ': 'pose_u', 'ㅡ': 'pose_eu', 'ㅇ': 'pose_ng', 'ㄱ': 'pose_g', 'ㄴ': 'pose_n', 'ㄷ': 'pose_d', 'ㄹ': 'pose_r', 'ㅁ': 'pose_m', 'ㅂ': 'pose_b', 'ㅅ': 'pose_s', 'ㅈ': 'pose_j', 'ㅎ': 'pose_h', 'ㅋ': 'pose_k', 'ㅌ': 'pose_t', 'ㅊ': 'pose_ch', 'ㅍ': 'pose_p' };
const POSE_PIC_SIT = {};
function poseArtReady() { return Object.keys(POSE_PIC).some(j => typeof ARTS !== 'undefined' && ARTS.pic.includes(POSE_PIC[j])); }
/* 헷갈리는 짝(오답 보기 먼저) */
const CONF = { 'ㅏ': 'ㅓ', 'ㅓ': 'ㅏ', 'ㅗ': 'ㅜ', 'ㅜ': 'ㅗ', 'ㅡ': 'ㅣ', 'ㅣ': 'ㅡ', 'ㄱ': 'ㅋ', 'ㅋ': 'ㄱ', 'ㄷ': 'ㅌ', 'ㅌ': 'ㄷ', 'ㅂ': 'ㅍ', 'ㅍ': 'ㅂ', 'ㅈ': 'ㅊ', 'ㅊ': 'ㅈ', 'ㄴ': 'ㄷ', 'ㅁ': 'ㅂ', 'ㅅ': 'ㅈ', 'ㅎ': 'ㅇ', 'ㅇ': 'ㅎ', 'ㄹ': 'ㄷ' };
/* 놀이 아이콘(아이 화면, 그림 없을 때) */
const PLAY_ICON = { chant: '🎵', yesterday: '🃏', letter: '🌟', balloon: '🎈', sort: '🧺', memory: '🃏', block: '🧱', dictate: '👂', echo: '🗣️', stickerstory: '📖', map: '🗺️', cloud: '☁️', treasure: '🎁',
  name: '🏷️', listen: '👂', clap: '👏', blend: '🧩', same: '🔔', pick: '🔍', trace: '✏️', copy: '✏️', merge: '🧱', train: '🚂', readword: '📖', match: '🃏', story: '📚', seek: '🔎', choose: '🖼️', body: '🤸', pick3: '🎲' };
/* 놀이 겉모습 돌리기(spec 5장): skin = SKINS[type][(day + slot) % n] */
const SKINS = { balloon: [['🎈', '풍선'], ['🐟', '물고기'], ['🌠', '별똥별']], sort: [['🧺', '과일 바구니'], ['📦', '장난감 상자'], ['📮', '우체통']], map: [['🌳', '숲'], ['🌊', '바다'], ['☁️', '하늘']] };
/* 세계(단계)별 지도 꾸밈: 배경은 CSS(.w1~.w6), 장식 이모지는 피자 그림이 오면 assets/pic/map_w1.webp 등으로 바뀜 */
/* deco = assets/map/<id>.svg 자리. 피자 그림이 오면 같은 이름으로 webp를 얹는다. */
const WORLDS = [
  { n: 1, name: '몽글이 숲', deco: ['deco_tree', 'deco_mushroom', 'deco_flower', 'deco_bush'], acc: 'mark_flower' },
  { n: 2, name: '자음 기차역', deco: ['deco_train', 'deco_house', 'deco_star', 'deco_flower'], acc: 'deco_train' },
  { n: 3, name: '글자 놀이터', deco: ['deco_ball', 'deco_flower', 'deco_star', 'deco_house'], acc: 'deco_ball' },
  { n: 4, name: '받침 나라', deco: ['deco_castle', 'deco_star', 'deco_house', 'flag_goal'], acc: 'deco_castle' },
  { n: 5, name: '글자 탐험대', deco: ['deco_tree', 'deco_star', 'flag_start', 'deco_bush'], acc: 'flag_start' },
  { n: 6, name: '려원이 도서관', deco: ['deco_book', 'deco_star', 'deco_house', 'deco_flower'], acc: 'deco_book' }];
const TOWN_BUILDINGS = ['🏠', '🚉', '🎪', '🏰', '⛺', '📚'];
const TOWN_PROPS = ['🌷', '🪑', '🏮', '🌳', '🎐', '🪁', '🐤', '🌻', '🚲', '🎈', '🏵️', '🪴', '🧸', '⛲', '🎠', '🌈', '⭐'];
const READY_DAYS = 55;   // v4 1부: 1~55일(1·2단계)까지 내용·음성 있음. 56일부터는 지도에 '곧 열려요'
const START_DAYS = [[1, '1일 · 처음부터'], [6, '6일 · ㅣ ㅏ'], [11, '11일 · ㅗ ㅜ'], [21, '21일 · 자음'], [56, '56일 · 읽기(곧)'], [76, '76일 · 받침(곧)']];
Object.assign(VOICE, { unit: n => 'u_' + pad2v(n), st4: (u, k) => 'st4_' + pad2v(u) + '_' + k });
function pad2v(n) { return String(n).padStart(2, '0'); }
/* 피자 그림 끼워 넣을 자리: assets/pic/<id>.webp가 art.js 목록에 있으면 그림, 없으면 CSS·이모지 자리표시 */
const ARTX = id => ARTS.pic.includes(id);
const artImg = (id, emo, cls) => ARTX(id) ? '<img class="' + (cls || '') + '" alt="" src="assets/pic/' + id + '.webp">' : emo;
function sceneBg(node, u) { const id = 'scene_' + pad2v(u); if (ARTX(id)) { node.style.backgroundImage = 'url(assets/pic/' + id + '.webp)'; node.style.backgroundSize = 'cover'; node.style.backgroundPosition = 'center'; node.classList.add('hasbg'); } return node; }
/* 피자 batch 3·8 추가 낱말 + 곧 올 그림(파일이 오면 import_pics_v4.py가 바로 넣음) */
Object.assign(WORDS, { keikeu: '케이크', kkot: '꽃', nunsaram: '눈사람', pungseon: '풍선', tteokguk: '떡국', sobangcha: '소방차', sangeo: '상어', ojingeo: '오징어', geobuk: '거북' });
Object.assign(PH_EMOJI, { keikeu: '🎂', kkot: '🌸', nunsaram: '⛄', pungseon: '🎈', tteokguk: '🥣', sobangcha: '🚒', sangeo: '🦈', ojingeo: '🦑', geobuk: '🐢' });
/* 바다 무리(같은 무리 헷갈리기용): 그림이 있는 것만 그림 고르기에 들어감 */
WCAT.sea = ['gorae', 'haema', 'saeu', 'sora', 'sangeo', 'ojingeo', 'geobuk'].filter(w => WORDS[w]);
['sora'].forEach(w => { const a = WCAT.animal.indexOf(w); if (a >= 0) WCAT.animal.splice(a, 1); });
['sobangcha', 'keikeu', 'kkot', 'nunsaram', 'pungseon', 'tteokguk'].forEach((w, k) => { const c = ['thing', 'food', 'thing', 'thing', 'thing', 'food'][k]; if (WCAT[c] && !WCAT[c].includes(w)) WCAT[c].push(w); });
WCAT.sea.forEach(w => { if (ARTS.pic.includes(w) && !PW_WORDS.includes(w)) PW_WORDS.push(w); });
/* 그림이 너무 닮아 한 판에 같이 내면 안 되는 짝(개 ↔ 강아지) */
const PIC_CLASH_PAIRS = [['gae', 'gangaji'], ['ai', 'agi']];   // 11/04 아이·아기 그림이 거의 같음
const PIC_CLASH = (a, b) => PIC_CLASH_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
