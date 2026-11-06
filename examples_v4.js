'use strict';
/* 11/06 커리큘럼에 맞춘 보기 낱말.
   읽기 과제(글자를 보고 고르는 놀이)에 새로 넣는 낱말은, 그 단원까지 배운 자모 조합만.
   단원이 통글자로 소개한 낱말(엄마·려원 등)은 그 단원 목표로 남긴다.
   음성 파일이 없는 낱말은 읽기 풀에 넣지 않는다(오프라인·무음 방지). */
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
function sylParts(ch) {
  if (!ch || ch < '가' || ch > '힣') return null;
  const n = ch.charCodeAt(0) - 0xAC00;
  return { cho: CHO[Math.floor(n / 588)], jung: JUNG[Math.floor((n % 588) / 28)], jong: JONG[n % 28] };
}
function taughtCaps(unitN) {
  const onset = new Set(), vow = new Set(), bat = new Set();
  (CURR.units || []).forEach(u => {
    if (u.n > unitN) return;
    String(u.jamo || '').split(/\s+/).filter(Boolean).forEach(t => {
      if (t.startsWith('받침')) bat.add(t.slice(2));
      else if (JUNG.includes(t)) vow.add(t);
      else if (CHO.includes(t)) onset.add(t);
    });
  });
  return { onset, vow, bat };
}
function canDecodeKr(kr, caps) {
  const parts = [...kr].map(sylParts).filter(Boolean);
  if (!parts.length || parts.length !== [...kr].length) return false;
  return parts.every(p => caps.onset.has(p.cho) && caps.vow.has(p.jung) && (p.jong === '' || caps.bat.has(p.jong)));
}
function canDecodeWord(w, ctx) {
  const kr = WORDS[w];
  if (!kr || !ctx || !ctx.u) return false;
  return canDecodeKr(kr, taughtCaps(ctx.u.n));
}
/* 단원 통글자이거나, 배운 자모로만 읽히는 낱말 */
function readCardOk(w, ctx) {
  if (!w || !WORDS[w]) return false;
  if (!ctx) return true;
  if (canDecodeWord(w, ctx)) return true;
  if ((ctx.unitW || []).includes(w) || (ctx.newW || []).includes(w)) return true;
  if (run && run.p && (run.p.items || []).includes(w)) return true;
  return false;
}
const EX_V4 = [
  { id: 'nugu', kr: '누구', emo: '🧒', cat: 'people', unit: 5 },
  { id: 'gagu', kr: '가구', emo: '🪑', cat: 'thing', unit: 5 },
  { id: 'eomeoni', kr: '어머니', emo: '👩', cat: 'people', unit: 6 },
  { id: 'binu', kr: '비누', emo: '🧼', cat: 'thing', unit: 7 },
  { id: 'baguni', kr: '바구니', emo: '🧺', cat: 'thing', unit: 7 },
  { id: 'sonamu', kr: '소나무', emo: '🌲', cat: 'thing', unit: 7 },
  { id: 'abeoji', kr: '아버지', emo: '🧔', cat: 'people', unit: 8 },
  { id: 'gaji', kr: '가지', emo: '🍆', cat: 'food', unit: 8 },
  { id: 'baji', kr: '바지', emo: '👖', cat: 'thing', unit: 8 },
  { id: 'uri', kr: '우리', emo: '👨‍👩‍👧', cat: 'people', unit: 9 },
  { id: 'nara', kr: '나라', emo: '🗺️', cat: 'thing', unit: 9 },
  { id: 'sori', kr: '소리', emo: '🔔', cat: 'thing', unit: 9 },
  { id: 'bori', kr: '보리', emo: '🌾', cat: 'food', unit: 9 },
  { id: 'jari', kr: '자리', emo: '💺', cat: 'thing', unit: 9 },
  { id: 'kadeu', kr: '카드', emo: '🃏', cat: 'thing', unit: 10 },
  { id: 'pokeu', kr: '포크', emo: '🍴', cat: 'thing', unit: 11 },
  { id: 'keopi', kr: '커피', emo: '☕', cat: 'food', unit: 11 },
  { id: 'yeoja', kr: '여자', emo: '👧', cat: 'people', unit: 13 },
  { id: 'yuri', kr: '유리', emo: '🪟', cat: 'thing', unit: 13 },
  { id: 'maemi', kr: '매미', emo: '🦗', cat: 'animal', unit: 14 },
  { id: 'begae', kr: '베개', emo: '🛏️', cat: 'thing', unit: 14 },
  { id: 'gang', kr: '강', emo: '🏞️', cat: 'thing', unit: 16 },
  { id: 'nonggu', kr: '농구', emo: '🏀', cat: 'thing', unit: 16 },
  { id: 'manggo', kr: '망고', emo: '🥭', cat: 'food', unit: 16 },
  { id: 'gongju', kr: '공주', emo: '👸', cat: 'people', unit: 16 },
  { id: 'mom', kr: '몸', emo: '🧒', cat: 'body', unit: 17 },
  { id: 'him', kr: '힘', emo: '💪', cat: 'body', unit: 17 },
  { id: 'maeum', kr: '마음', emo: '💗', cat: 'thing', unit: 17 },
  { id: 'don', kr: '돈', emo: '🪙', cat: 'thing', unit: 18 },
  { id: 'muneo', kr: '문어', emo: '🐙', cat: 'animal', unit: 18 },
  { id: 'chingu', kr: '친구', emo: '🧒', cat: 'people', unit: 18 },
  { id: 'sonnim', kr: '손님', emo: '🧑', cat: 'people', unit: 18 },
  { id: 'bul', kr: '불', emo: '🔥', cat: 'thing', unit: 19 },
  { id: 'gil', kr: '길', emo: '🛣️', cat: 'thing', unit: 19 },
  { id: 'sinbal', kr: '신발', emo: '👟', cat: 'thing', unit: 19 },
  { id: 'buk', kr: '북', emo: '🥁', cat: 'thing', unit: 20 },
  { id: 'hakgyo', kr: '학교', emo: '🏫', cat: 'thing', unit: 20 },
  { id: 'sikdang', kr: '식당', emo: '🍽️', cat: 'thing', unit: 20 },
  { id: 'eumak', kr: '음악', emo: '🎵', cat: 'thing', unit: 20 },
  { id: 'sip', kr: '십', emo: '🔟', cat: 'thing', unit: 21 },
  { id: 'kkoma', kr: '꼬마', emo: '👶', cat: 'people', unit: 24 },
  { id: 'ttakji', kr: '딱지', emo: '🎴', cat: 'thing', unit: 24 },
  { id: 'ppallae', kr: '빨래', emo: '👕', cat: 'thing', unit: 25 },
  { id: 'jjajang', kr: '짜장', emo: '🍜', cat: 'food', unit: 25 },
  { id: 'wang', kr: '왕', emo: '👑', cat: 'people', unit: 26 },
  { id: 'wangja', kr: '왕자', emo: '🤴', cat: 'people', unit: 26 },
  { id: 'jwi', kr: '쥐', emo: '🐭', cat: 'animal', unit: 27 },
  { id: 'uisa', kr: '의사', emo: '🩺', cat: 'people', unit: 27 }
];
EX_V4.forEach(ex => {
  if (Object.values(WORDS).includes(ex.kr) || WORDS[ex.id]) return;
  WORDS[ex.id] = ex.kr;
  if (!PH_EMOJI[ex.id]) PH_EMOJI[ex.id] = ex.emo;
  if (WCAT[ex.cat] && !WCAT[ex.cat].includes(ex.id)) WCAT[ex.cat].push(ex.id);
  if (Array.isArray(WORD_IDS) && !WORD_IDS.includes(ex.id)) WORD_IDS.push(ex.id);
});
if (typeof PIC_CLASH_PAIRS !== 'undefined') {
  [['eomeoni', 'eomma'], ['abeoji', 'appa']].forEach(pair => {
    if (!PIC_CLASH_PAIRS.some(([a, b]) => (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0]))) PIC_CLASH_PAIRS.push(pair);
  });
}
function readExtras(ctx, pred) {
  if (!ctx) return [];
  const ok = w => (!pred || pred(w)) && canDecodeWord(w, ctx);
  return Object.keys(WORDS).filter(ok);
}
