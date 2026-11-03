'use strict';
/* 한글 놀이 v4 데이터 더하기(v3 data.js 위에): 새 낱말·자리표시, ㅊㅋㅌㅍ 소개 낱말, 몸 글자, 헷갈리는 짝, 놀이 아이콘·스킨, 음성 키. */
Object.assign(WORDS, WORDS_V4);
Object.keys(WORDS_V4).forEach(w => { if (EMO_V4[w] && !PH_EMOJI[w]) PH_EMOJI[w] = EMO_V4[w]; });
Object.entries(CAT_V4).forEach(([w, c]) => { if (WCAT[c] && !WCAT[c].includes(w)) { WCAT[c].push(w); PW_WORDS.push(w); } });
Object.assign(JAMO_EX, { 'ㅋ': { word: '코끼리', pic: 'kokkiri', lp: 'lp_k' }, 'ㅌ': { word: '토끼', pic: 'tokki', lp: 'lp_t' }, 'ㅊ': { word: '치마', pic: 'chima', lp: 'lp_ch' }, 'ㅍ': { word: '포도', pic: 'podo', lp: 'lp_p' } });
/* 몸으로 글자(쉬어 가기). pic = 피자 포즈 그림(없으면 몽글이 점프) */
const POSE_HOW = { 'ㅣ': '똑바로 서서 팔을 몸에 붙여요', 'ㅏ': '한 팔을 옆으로 쭉 뻗어요', 'ㅓ': '반대쪽 팔을 옆으로 쭉 뻗어요', 'ㅗ': '두 팔을 머리 위로 올리고 한 손을 위로 콕', 'ㅜ': '두 팔을 옆으로 벌리고 한 발을 아래로 콕',
  'ㅡ': '바닥에 누워 몸을 쭉 펴요', 'ㅇ': '두 팔로 머리 위에 동그라미를 만들어요', 'ㄱ': '허리를 숙여 ㄱ 모양을 만들어요', 'ㄴ': '앉아서 다리를 앞으로 쭉 뻗어요', 'ㄷ': '엄마 아빠랑 둘이 ㄷ 모양을 만들어요',
  'ㄹ': '팔을 꼬불꼬불 흔들어요', 'ㅁ': '엄마 아빠랑 손을 잡고 네모를 만들어요', 'ㅂ': '두 팔을 위로 들고 가운데 손을 모아요', 'ㅅ': '두 팔을 비스듬히 내려 지붕을 만들어요', 'ㅈ': '팔을 위에 한 줄 놓고 ㅅ처럼 서요',
  'ㅎ': '손으로 모자를 쓰고 동그랗게 웃어요', 'ㅋ': 'ㄱ 모양에서 팔 하나를 더 뻗어요', 'ㅌ': 'ㄷ 모양에 팔 하나를 더해요', 'ㅊ': 'ㅈ 위에 손가락 모자를 콕', 'ㅍ': '두 팔을 위아래로 쭉, 다리도 쭉' };
const POSE_PIC = { 'ㅣ': 'pose_i', 'ㅏ': 'pose_a', 'ㄱ': 'pose_g', 'ㅇ': 'pose_ng' };
/* 헷갈리는 짝(오답 보기 먼저) */
const CONF = { 'ㅏ': 'ㅓ', 'ㅓ': 'ㅏ', 'ㅗ': 'ㅜ', 'ㅜ': 'ㅗ', 'ㅡ': 'ㅣ', 'ㅣ': 'ㅡ', 'ㄱ': 'ㅋ', 'ㅋ': 'ㄱ', 'ㄷ': 'ㅌ', 'ㅌ': 'ㄷ', 'ㅂ': 'ㅍ', 'ㅍ': 'ㅂ', 'ㅈ': 'ㅊ', 'ㅊ': 'ㅈ', 'ㄴ': 'ㄷ', 'ㅁ': 'ㅂ', 'ㅅ': 'ㅈ', 'ㅎ': 'ㅇ', 'ㅇ': 'ㅎ', 'ㄹ': 'ㄷ' };
/* 놀이 아이콘(아이 화면, 그림 없을 때) */
const PLAY_ICON = { chant: '🎵', yesterday: '🃏', letter: '🌟', balloon: '🎈', sort: '🧺', memory: '🃏', block: '🧱', dictate: '👂', echo: '🗣️', stickerstory: '📖', map: '🗺️', cloud: '☁️', treasure: '🎁',
  name: '🏷️', listen: '👂', clap: '👏', blend: '🧩', same: '🔔', pick: '🔍', trace: '✏️', copy: '✏️', merge: '🧱', train: '🚂', readword: '📖', match: '🃏', story: '📚', seek: '🔎', choose: '🖼️', body: '🤸', pick3: '🎲' };
/* 놀이 겉모습 돌리기(spec 5장): skin = SKINS[type][(day + slot) % n] */
const SKINS = { balloon: [['🎈', '풍선'], ['🐟', '물고기'], ['🌠', '별똥별']], sort: [['🧺', '과일 바구니'], ['📦', '장난감 상자'], ['📮', '우체통']], map: [['🌳', '숲'], ['🌊', '바다'], ['☁️', '하늘']] };
/* 세계(단계)별 지도 꾸밈: 배경은 CSS(.w1~.w6), 장식 이모지는 피자 그림이 오면 assets/pic/map_w1.webp 등으로 바뀜 */
const WORLDS = [
  { n: 1, name: '몽글이 숲', deco: ['🌳', '🍄', '🌼', '🌲'], acc: '🎀' }, { n: 2, name: '자음 기차역', deco: ['🚉', '🚂', '🛤️', '🎫'], acc: '🎒' },
  { n: 3, name: '글자 놀이터', deco: ['🛝', '🎠', '🪁', '⚽'], acc: '🦸' }, { n: 4, name: '받침 나라', deco: ['🏰', '🧱', '🚩', '🗝️'], acc: '🧭' },
  { n: 5, name: '글자 탐험대', deco: ['🧭', '🏕️', '🔭', '⛺'], acc: '✏️' }, { n: 6, name: '려원이 도서관', deco: ['📚', '🖍️', '📖', '🪑'], acc: '🎨' }];
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
const PIC_CLASH_PAIRS = [['gae', 'gangaji']];
const PIC_CLASH = (a, b) => PIC_CLASH_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
