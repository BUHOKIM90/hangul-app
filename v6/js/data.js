'use strict';
/* v6 data: words, jamo, strokes, curriculum, praise, stickers, outfits. Data only. */
(function (G) {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
  function split(ch) {
    const c = ch.charCodeAt(0) - 0xAC00;
    if (c < 0 || c > 11171) return null;
    return { cho: CHO[Math.floor(c / 588)], jung: JUNG[Math.floor((c % 588) / 28)], jong: JONG[c % 28].trim() };
  }
  function join(cho, jung, jong) {
    const i = CHO.indexOf(cho), j = JUNG.indexOf(jung), k = JONG.indexOf(jong || ' ');
    if (i < 0 || j < 0 || k < 0) return '';
    return String.fromCharCode(0xAC00 + i * 588 + j * 28 + k);
  }
  const hex = ch => ch.charCodeAt(0).toString(16).toUpperCase();
  const syKey = ch => 'sy_' + hex(ch);
  const fyKey = ch => 'fy_' + hex(ch);
  const dyKey = ch => 'dy_' + hex(ch);
  const jKey = ch => 'j_' + hex(ch);

  /* Clip files that exist in audio/ and are used by v6 (checked against the repo at build time). */
  const SY = '가감강개갸거게겨고곰공과교구국귀규그글기김까꼬꽃끼나내냐너네녀노놀뇨누눈뉴느늘니다달더도돼두드디딸떡라람랑래러렁려로루르리린릴림마말매먀머메며면모몽묘무문물뮤므미바박발밤밥방배버별보봇부북분브비빗빠빵뽀사산상새서선섯소손수숭스시씨아악앗애야양어엄에여오옷요우워원위유으의이입자잔장저조주즈지집징찌차책처초추츠치카커컵케코콩쿠크키타탕터토투트티파퍼포푸풍프피하할해햐허헤혀호화효후휴흐히';
  const FY = '거고구기끼나누니다도두디라려리마머모무미바방부비빠사소스아어엄여오우원유이자주차코포하할허';
  const DY = '가거고구그기나너노누느니다더도두드디라러로루르리마머모무므미바박방버보봉부브비사서소수스시아어오우으이자저조주즈지초하허호후흐히';
  const J = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅓㅔㅕㅗㅘㅚㅛㅜㅝㅟㅠㅡㅢㅣ';
  const has = { sy: c => SY.includes(c), fy: c => FY.includes(c), dy: c => DY.includes(c), j: c => J.includes(c) };

  /* key|hangul|picture|group. Picture = colour emoji glyph (vector font, offline). '' = no picture card. */
  const WORD_ROWS = `
ryeowon|려원|👧|fam
eomma|엄마|👩|fam
appa|아빠|👨|fam
agi|아기|👶|fam
nuna|누나|👧🏻|fam
halmeoni|할머니|👵|fam
harabeoji|할아버지|👴|fam
ai|아이|🧒|fam
oi|오이|🥒|food
uyu|우유|🥛|food
banana|바나나|🍌|food
podo|포도|🍇|food
goguma|고구마|🍠|food
gochu|고추|🌶️|food
gogi|고기|🍖|food
pija|피자|🍕|food
gwaja|과자|🍪|food
keikeu|케이크|🎂|food
tomato|토마토|🍅|food
ttalgi|딸기|🍓|food
subak|수박|🍉|food
sagwa|사과|🍎|food
bae|배|🍐|food
juseu|주스|🧃|food
chijeu|치즈|🧀|food
hobak|호박|🎃|food
hodu|호두|🌰|food
satang|사탕|🍬|food
ppang|빵|🍞|food
bap|밥|🍚|food
tteok|떡|🍡|food
guk|국|🍲|food
ramyeon|라면|🍜|food
gimbap|김밥|🍙|food
beoseot|버섯|🍄|food
kong|콩|🫘|food
nabi|나비|🦋|ani
ori|오리|🦆|ani
so|소|🐮|ani
hama|하마|🦛|ani
lion|사자|🦁|ani
geomi|거미|🕷️|ani
yeou|여우|🦊|ani
kokkiri|코끼리|🐘|ani
gangaji|강아지|🐶|ani
goyangi|고양이|🐱|ani
tokki|토끼|🐰|ani
dwaeji|돼지|🐷|ani
girin|기린|🦒|ani
wonsungi|원숭이|🐵|ani
sangeo|상어|🦈|ani
saeu|새우|🦐|ani
ojingeo|오징어|🦑|ani
gorae|고래|🐳|ani
gorilla|고릴라|🦍|ani
geobuk|거북|🐢|ani
ageo|악어|🐊|ani
gom|곰|🐻|ani
mal|말|🐴|ani
gae|개|🐕|ani
ge|게|🦀|ani
mogi|모기|🦟|ani
kkachi|까치|🐦|ani
sora|소라|🐚|ani
gicha|기차|🚂|ride
cha|차|🚗|ride
beoseu|버스|🚌|ride
sobangcha|소방차|🚒|ride
moja|모자|👒|thing
gudu|구두|👞|thing
radio|라디오|📻|thing
gawi|가위|✂️|thing
gabang|가방|🎒|thing
chima|치마|👗|thing
gita|기타|🎸|thing
yagu|야구|⚾|thing
jido|지도|🗺️|thing
hyuji|휴지|🧻|thing
pungseon|풍선|🎈|thing
seonmul|선물|🎁|thing
robot|로봇|🤖|thing
yoyo|요요|🪀|thing
uija|의자|🪑|thing
geurim|그림|🖼️|thing
chaek|책|📕|thing
keop|컵|🥤|thing
ot|옷|👕|thing
gong|공|⚽|thing
mun|문|🚪|thing
jip|집|🏠|thing
ubi|우비|☔|thing
hwabun|화분|🪴|thing
nemo|네모|🟥|thing
nunsaram|눈사람|⛄|thing
namu|나무|🌳|nature
bada|바다|🏖️|nature
pado|파도|🌊|nature
dal|달|🌙|nature
byeol|별|⭐|nature
san|산|⛰️|nature
mul|물|💧|nature
kkot|꽃|🌸|nature
ssiat|씨앗|🌱|nature
dari|다리|🦵|body
i_tooth|이|🦷|body
ko|코|👃|body
gwi|귀|👂|body
ip|입|👄|body
son|손|✋|body
bal|발|🦶|body
eobu|어부|🎣|fam
eureureong|으르렁|🐯|ani
dubu|두부||food
jadu|자두||food
ima|이마||body`;
  const WORDS = {};
  WORD_ROWS.trim().split('\n').forEach(r => {
    const [key, w, pic, grp] = r.trim().split('|');
    WORDS[key] = { key, w, pic, grp, clip: 'w_' + key, syl: Array.from(w) };
  });
  /* hy_ = "그건 X야!", hw_ = "X 글씨를 찾아볼까?" — only keys whose recordings exist. */
  const HY = new Set('agi ai appa bada banana beoseu cha chijeu chima dari dubu eobu eomma eureureong geobuk geomi gicha gita gochu gogi goguma gorae gudu haema halmeoni hama harabeoji heori hodu i_tooth ima jadu jido juseu keikeu ki kkot ko kokkiri lion meori mogi moja nabi namu nuna nunsaram oi ojingeo ori pado pija podo pungseon radio ryeowon saeu sangeo siso so sobangcha sora tajo tomato tteokguk ubi uyu yeou'.split(' '));
  const HW = HY;
  const CLAP = new Set('appa banana eomma goguma halmeoni hama harabeoji kokkiri nabi ori ryeowon so'.split(' '));
  /* Words whose syllables are all simple CV (no batchim). */
  function noBatchim(w) { return Array.from(w).every(ch => { const s = split(ch); return s && !s.jong; }); }

  const BASIC_V = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'];
  const VROW = { 'ㅏ': '아', 'ㅓ': '어', 'ㅗ': '오', 'ㅜ': '우', 'ㅡ': '으', 'ㅣ': '이', 'ㅑ': '야', 'ㅕ': '여', 'ㅛ': '요', 'ㅠ': '유', 'ㅐ': '애', 'ㅔ': '에' };
  const JNAME = {
    'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음', 'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒',
    'ㅊ': '치읓', 'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅎ': '히읗'
  };
  /* Picture friend for each letter (shown on the letter card). */
  const JPIC = {
    'ㅏ': 'agi', 'ㅓ': 'eobu', 'ㅗ': 'ori', 'ㅜ': 'uyu', 'ㅡ': 'eureureong', 'ㅣ': 'i_tooth',
    'ㄱ': 'gicha', 'ㄴ': 'nabi', 'ㄷ': 'dari', 'ㄹ': 'radio', 'ㅁ': 'moja', 'ㅂ': 'banana', 'ㅅ': 'lion', 'ㅇ': 'oi', 'ㅈ': 'jido', 'ㅎ': 'hama',
    'ㅊ': 'chima', 'ㅋ': 'kokkiri', 'ㅌ': 'tomato', 'ㅍ': 'podo', 'ㅑ': 'yagu', 'ㅕ': 'yeou', 'ㅛ': 'yoyo', 'ㅠ': 'uyu', 'ㅐ': 'gae', 'ㅔ': 'ge'
  };

  /* Strokes on a 100×100 box: polyline [[x,y],…] or circle {c:[cx,cy,r]}. */
  const STROKES = {
    'ㄱ': [[[20, 22], [78, 22], [76, 86]]],
    'ㄴ': [[[24, 16], [24, 80], [82, 80]]],
    'ㄷ': [[[22, 18], [80, 18]], [[22, 18], [22, 82], [82, 82]]],
    'ㄹ': [[[22, 14], [78, 14], [78, 46]], [[22, 46], [78, 46]], [[22, 46], [22, 86], [80, 86]]],
    'ㅁ': [[[24, 18], [24, 82]], [[24, 18], [76, 18], [76, 82]], [[24, 82], [76, 82]]],
    'ㅂ': [[[26, 14], [26, 84]], [[74, 14], [74, 84]], [[26, 48], [74, 48]], [[26, 84], [74, 84]]],
    'ㅅ': [[[50, 16], [18, 84]], [[48, 46], [82, 84]]],
    'ㅇ': [{ c: [50, 50, 32] }],
    'ㅈ': [[[22, 18], [78, 18], [20, 84]], [[50, 48], [82, 84]]],
    'ㅊ': [[[40, 8], [60, 8]], [[22, 28], [78, 28], [20, 88]], [[50, 56], [82, 88]]],
    'ㅋ': [[[20, 20], [78, 20], [76, 86]], [[22, 52], [77, 52]]],
    'ㅌ': [[[22, 16], [78, 16]], [[22, 48], [78, 48]], [[22, 16], [22, 84], [80, 84]]],
    'ㅍ': [[[16, 18], [84, 18]], [[36, 18], [34, 80]], [[64, 18], [66, 80]], [[16, 82], [84, 82]]],
    'ㅎ': [[[38, 12], [62, 12]], [[20, 30], [80, 30]], { c: [50, 64, 20] }],
    'ㅏ': [[[36, 8], [36, 92]], [[36, 50], [74, 50]]],
    'ㅑ': [[[36, 8], [36, 92]], [[36, 38], [72, 38]], [[36, 64], [72, 64]]],
    'ㅓ': [[[26, 50], [64, 50]], [[64, 8], [64, 92]]],
    'ㅕ': [[[24, 38], [60, 38]], [[24, 64], [60, 64]], [[62, 8], [62, 92]]],
    'ㅗ': [[[50, 30], [50, 62]], [[12, 64], [88, 64]]],
    'ㅛ': [[[38, 30], [38, 62]], [[62, 30], [62, 62]], [[12, 64], [88, 64]]],
    'ㅜ': [[[12, 36], [88, 36]], [[50, 36], [50, 80]]],
    'ㅠ': [[[12, 36], [88, 36]], [[38, 36], [36, 80]], [[62, 36], [64, 80]]],
    'ㅡ': [[[10, 50], [90, 50]]],
    'ㅣ': [[[50, 8], [50, 92]]],
    'ㅐ': [[[28, 8], [28, 92]], [[28, 50], [54, 50]], [[66, 8], [66, 92]]],
    'ㅔ': [[[16, 50], [42, 50]], [[46, 8], [46, 92]], [[70, 8], [70, 92]]]
  };
  /* Double consonants: the base letter twice, side by side. */
  [['ㄲ', 'ㄱ'], ['ㄸ', 'ㄷ'], ['ㅃ', 'ㅂ'], ['ㅆ', 'ㅅ'], ['ㅉ', 'ㅈ']].forEach(([d, b]) => {
    STROKES[d] = place(STROKES[b], [0, 6, 50, 88]).concat(place(STROKES[b], [50, 6, 50, 88]));
  });
  const VERT = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅣ';
  const HORI = 'ㅗㅛㅜㅠㅡ';
  /* Boxes [x,y,w,h] for jamo inside a syllable block. */
  function boxes(s) {
    const v = VERT.includes(s.jung);
    if (!s.jong) return v ? [[2, 12, 58, 76], [44, 2, 54, 96]] : [[16, 0, 68, 54], [2, 38, 96, 58]];
    return v ? [[8, 4, 48, 50], [44, 2, 48, 56], [16, 60, 68, 36]] : [[22, 2, 56, 34], [4, 24, 92, 36], [18, 62, 64, 34]];
  }
  function place(strokes, b) {
    const [x, y, w, h] = b;
    return strokes.map(st => st.c
      ? { c: [x + st.c[0] * w / 100, y + st.c[1] * h / 100, st.c[2] * Math.min(w, h) / 100] }
      : st.map(p => [x + p[0] * w / 100, y + p[1] * h / 100]));
  }
  /* Strokes for one jamo or one syllable; null if not writable. */
  /* Complex vowels = a horizontal part under the first consonant + a vertical part on the right. */
  const COMPLEX = { 'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ'], 'ㅚ': ['ㅗ', 'ㅣ'], 'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ'], 'ㅟ': ['ㅜ', 'ㅣ'], 'ㅢ': ['ㅡ', 'ㅣ'] };
  function strokesFor(ch) {
    if (STROKES[ch]) return STROKES[ch];
    const s = split(ch);
    if (!s || !STROKES[s.cho] || (s.jong && !STROKES[s.jong])) return null;
    if (COMPLEX[s.jung]) {
      const [h, v] = COMPLEX[s.jung];
      const bx = s.jong ? [[12, 4, 38, 34], [4, 24, 56, 30], [52, 2, 44, 60], [18, 64, 60, 32]] : [[6, 4, 48, 44], [2, 26, 62, 44], [50, 0, 48, 92]];
      let out = place(STROKES[s.cho], bx[0]).concat(place(STROKES[h], bx[1]), place(STROKES[v], bx[2]));
      if (s.jong) out = out.concat(place(STROKES[s.jong], bx[3]));
      return out;
    }
    if (!STROKES[s.jung]) return null;
    const b = boxes(s);
    let out = place(STROKES[s.cho], b[0]).concat(place(STROKES[s.jung], b[1]));
    if (s.jong) out = out.concat(place(STROKES[s.jong], b[2]));
    return out;
  }

  /* Curriculum: 96 stages. */
  const W = {
    1: { name: '소리 숲', color: '#7BD389', icon: '🌳' },
    2: { name: '모음 바다', color: '#6EC6FF', icon: '🌊' },
    3: { name: '자음 마을', color: '#FFB86B', icon: '🏡' },
    4: { name: '자음 마을 2', color: '#FF9AA2', icon: '🎪' },
    5: { name: '무지개 모음', color: '#C3A6FF', icon: '🌈' },
    6: { name: '받침 동굴', color: '#9C8CFF', icon: '💎' },
    7: { name: '낱말 공원', color: '#5ED6B4', icon: '🎡' },
    8: { name: '이야기 하늘', color: '#7FB2FF', icon: '☁️' }
  };
  const ST = [];
  const add = (w, k, o, title) => ST.push(Object.assign({ id: ST.length + 1, w, k, title }, o));
  for (let n = 1; n <= 6; n++) add(1, 'sound', { n }, '소리 놀이 ' + n);
  add(1, 'name', { n: 1 }, '내 이름 려원');
  [['ㅏ'], ['ㅣ'], ['rev'], ['ㅗ'], ['ㅜ'], ['rev'], ['ㅓ'], ['ㅡ'], ['rev']].forEach(([v]) => {
    if (v === 'rev') add(2, 'vrev', {}, '모음 복습'); else add(2, 'vowel', { v }, v + ' 만나기');
  });
  add(2, 'name', { n: 2 }, '내 이름 쓰기');
  const C1 = ['ㄱ', 'ㄴ', 'ㄷ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅎ', 'ㄹ'];
  C1.forEach((c, i) => {
    add(3, 'cons1', { c }, c + ' 노래');
    add(3, 'cons2', { c }, c + ' 낱말');
    if (i % 3 === 2 || i === C1.length - 1) add(3, 'crev', {}, '자음 복습');
  });
  add(3, 'name', { n: 3 }, '려원이 글자 ㄹ');
  ['ㅊ', 'ㅋ', 'ㅌ', 'ㅍ'].forEach((c, i) => {
    add(4, 'cons1', { c }, c + ' 노래');
    add(4, 'cons2', { c }, c + ' 낱말');
    if (i % 2 === 1) add(4, 'crev', {}, '자음 복습');
  });
  ['ㅑ', 'ㅕ', 'rev', 'ㅛ', 'ㅠ', 'rev', 'ㅐ', 'ㅔ'].forEach(v => {
    if (v === 'rev') add(5, 'vrev2', {}, '무지개 복습'); else add(5, 'vowel2', { v }, v + ' 만나기');
  });
  const BAT = ['ㅇ', 'ㄴ', 'ㅁ', 'ㄹ', 'ㄱ', 'ㅂ', 'ㅅ'];
  BAT.forEach((b, i) => {
    add(6, 'bat1', { b }, b + ' 받침');
    add(6, 'bat2', { b }, b + ' 받침 낱말');
    if (i === 3 || i === BAT.length - 1) add(6, 'brev', {}, '받침 복습');
  });
  add(7, 'name', { n: 4 }, '내 이름 혼자 쓰기');
  [['fam', '가족'], ['ani', '동물'], ['food', '먹거리'], ['ride', '탈것과 물건'], ['body', '몸'], ['nature', '자연'],
    ['ani', '동물 2'], ['food', '먹거리 2'], ['thing', '물건'], ['mix', '낱말 모음'], ['mix', '낱말 모음 2'], ['mix', '낱말 대장'], ['mix', '낱말 왕']]
    .forEach(([g, t]) => add(7, 'word', { g }, t));
  for (let n = 1; n <= 10; n++) add(8, 'story', { n }, '이야기 ' + n);

  /* Two-word phrases read word by word (each word clip lights its word). */
  const PHRASES = [
    ['agi', 'uyu'], ['eomma', 'moja'], ['appa', 'gudu'], ['nabi', 'namu'], ['hama', 'moja'], ['ori', 'bada'],
    ['banana', 'uyu'], ['halmeoni', 'gabang'], ['gangaji', 'gong'], ['tokki', 'ttalgi'], ['gom', 'ppang'], ['ryeowon', 'chima'],
    ['goyangi', 'mul'], ['harabeoji', 'chaek'], ['kokkiri', 'pungseon'], ['robot', 'gicha'], ['agi', 'yoyo'], ['dal', 'byeol']
  ];
  /* Recorded short sentences (caption verified in v5 QA). */
  const SENTENCES = [
    { clip: 's_1', text: '나비도 나무도', pics: ['nabi', 'namu'] },
    { clip: 's_2', text: '바나나 나무', pics: ['banana', 'namu'] },
    { clip: 's_4', text: '나비 모자', pics: ['nabi', 'moja'] },
    { clip: 's_6', text: '아기 모자', pics: ['agi', 'moja'] }
  ];

  /* Praise. Voiced lines: caption == what the clip says (v5 listening QA). Cheers: shown with a jingle, no voice. */
  const PRAISE_VOICE = {
    good1: ['잘했어!', 'ui_good1', 'any'], good2: ['멋져!', 'ui_good2', 'any'], good3: ['최고야!', 'ui_good3', 'any'],
    found: ['찾았다!', 'ui_found', 'find'], p1: ['끝까지 들었네', 'ui4_proc1', 'listen'], p5: ['끝까지 들었네!', 'ui4_proc5', 'listen'],
    p2: ['순서대로 썼네', 'ui4_proc2', 'write'], p11: ['천천히 끝까지 해냈네', 'ui4_proc11', 'write'],
    p3: ['혼자 읽었네!', 'ui4_proc3', 'read'], p18: ['한 글자씩 또박또박 읽었네', 'ui4_proc18', 'read'],
    p6: ['두 개를 붙여서 글자를 만들었네', 'ui4_proc6', 'block'], p12: ['글자를 하나하나 찾아냈네', 'ui4_proc12', 'find'],
    p15: ['들은 글자를 쏙 잡았네', 'ui4_proc15', 'find'], p17: ['그림을 보고 잘 생각했네.', 'ui4_proc17', 'picture'],
    p9: ['같은 소리끼리 잘 모았네!', 'ui4_proc9', 'same'], p7: ['다시 찾아냈어. 포기하지 않았네.', 'ui4_proc7', 'retry'],
    p16: ['어려웠는데 다시 해봤네', 'ui4_proc16', 'retry'], t2: ['반짝! 보물을 찾았어!', 'ui4_treasure2', 'treasure']
  };
  const CHEERS = ['딩동댕!', '우와!', '짝짝짝!', '반짝반짝!', '척척박사!', '대단해!', '역시 려원이!', '최고 최고!', '굉장해!', '해냈다!', '멋쟁이 려원!', '똑똑해!', '와아, 맞았어!', '엄지 척!'];
  /* Which voiced praise fits each play. Every pool also gets all 14 cheers → ≥ 16 kinds per play. */
  const PRAISE_FIT = {
    chant: ['good1', 'good2', 'good3', 'p1', 'p5', 'p18'], pop: ['good1', 'good2', 'good3', 'found', 'p12', 'p15'],
    pick: ['good1', 'good2', 'good3', 'p17', 'p1'], clap: ['good1', 'good2', 'good3', 'p1', 'p18'], first: ['good1', 'good2', 'good3', 'p9', 'p17'],
    block: ['good1', 'good2', 'good3', 'p6'], trace: ['good1', 'good2', 'good3', 'p2', 'p11'], train: ['good1', 'good2', 'good3', 'p18', 'p12'],
    memory: ['good1', 'good2', 'good3', 'found', 'p17'], read: ['good1', 'good2', 'good3', 'p3', 'p18'], batchim: ['good1', 'good2', 'good3', 'p6', 'p15'],
    story: ['good1', 'good2', 'good3', 'p3', 'p18', 'p17'], treasure: ['t2', 'found', 'good2']
  };

  /* Stickers: 6 themes × 20. Index 4,14 = shiny, 9,19 = gold. */
  const STICKER_SETS = [
    ['동물', '🐶🐱🐰🐻🐼🦊🐯🦁🐮🐷🐸🐵🐔🐧🐤🦄🐨🦒🐘🦔'],
    ['간식', '🍎🍓🍌🍇🍉🍑🍒🥝🍞🧁🍩🍪🍦🍭🍫🍕🍔🍟🍙🥕'],
    ['탈것', '🚗🚕🚌🚑🚒🚓🚜🚲🛴🚂🚀✈️🚁⛵🚤🛸🏎️🚛🚚🛻'],
    ['바다', '🐳🐬🦈🐠🐡🐙🦑🦀🦞🐢🦭🐚🐋🦐🐟🌊⚓🏝️🐧🐊'],
    ['하늘', '🌙⭐🌟☀️🪐🌍☄️🌈⚡❄️☁️🌠🌌🌞🌛🌝🔭🛰️👽🎆'],
    ['장난감', '🎈🎁🎀🧸🪀🎨🎪🎠🎡🎢🪁⚽🏀🎸🥁🎺🎹🧩🪄👑']
  ];
  const STICKERS = [];
  STICKER_SETS.forEach(([name, s], si) => {
    Array.from(s.matchAll(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}️?)*/gu)).map(m => m[0]).slice(0, 20).forEach((e, i) => {
      STICKERS.push({ id: si * 20 + i, set: si, e, r: (i % 10 === 9) ? 2 : (i % 10 === 4 ? 1 : 0) });
    });
  });

  /* Outfits for 몽글이 (drawn in ui.js). slot: hat, eyes, neck, back, body. */
  const OUTFITS = [
    { id: 'hat_party', slot: 'hat', name: '고깔모자', cost: 8 },
    { id: 'hat_ribbon', slot: 'hat', name: '리본', cost: 8 },
    { id: 'hat_flower', slot: 'hat', name: '꽃핀', cost: 10 },
    { id: 'hat_cap', slot: 'hat', name: '야구모자', cost: 12 },
    { id: 'hat_bunny', slot: 'hat', name: '토끼 귀', cost: 15 },
    { id: 'hat_beret', slot: 'hat', name: '베레모', cost: 15 },
    { id: 'hat_chef', slot: 'hat', name: '요리사 모자', cost: 20 },
    { id: 'hat_wizard', slot: 'hat', name: '마법사 모자', cost: 25 },
    { id: 'hat_crown', slot: 'hat', name: '왕관', cost: 40, lv: 5 },
    { id: 'eyes_round', slot: 'eyes', name: '동그란 안경', cost: 10 },
    { id: 'eyes_star', slot: 'eyes', name: '별 안경', cost: 15 },
    { id: 'eyes_heart', slot: 'eyes', name: '하트 안경', cost: 15 },
    { id: 'eyes_sun', slot: 'eyes', name: '선글라스', cost: 20 },
    { id: 'neck_bow', slot: 'neck', name: '나비넥타이', cost: 8 },
    { id: 'neck_scarf', slot: 'neck', name: '목도리', cost: 12 },
    { id: 'neck_pearl', slot: 'neck', name: '진주 목걸이', cost: 18 },
    { id: 'neck_medal', slot: 'neck', name: '금메달', cost: 30, lv: 3 },
    { id: 'back_cape', slot: 'back', name: '빨간 망토', cost: 20 },
    { id: 'back_star', slot: 'back', name: '별 망토', cost: 30, lv: 4 },
    { id: 'back_wing', slot: 'back', name: '요정 날개', cost: 35, lv: 6 },
    { id: 'body_pink', slot: 'body', name: '분홍 옷', cost: 15, color: '#FFC1D9' },
    { id: 'body_mint', slot: 'body', name: '민트 옷', cost: 15, color: '#B5F0DA' },
    { id: 'body_lemon', slot: 'body', name: '레몬 옷', cost: 15, color: '#FFF1A6' },
    { id: 'body_lilac', slot: 'body', name: '보라 옷', cost: 20, color: '#D9C8FF' },
    { id: 'body_peach', slot: 'body', name: '복숭아 옷', cost: 20, color: '#FFD3B5' },
    { id: 'body_rainbow', slot: 'body', name: '무지개 옷', cost: 50, lv: 8, color: 'rainbow' }
  ];

  /* Friends (all drawn in ui.js). lv = level that unlocks the friend. */
  const FRIENDS = [
    { id: 'lumi', name: '별사탕 공주 루미', short: '루미', lv: 1 },
    { id: 'tori', name: '구름토끼 토리', short: '토리', lv: 1 },
    { id: 'mong', name: '솜사탕양 몽글이', short: '몽글이', lv: 2 },
    { id: 'pomi', name: '리본고양이 뽀미', short: '뽀미', lv: 3 },
    { id: 'kong', name: '아기용 콩이', short: '콩이', lv: 4 },
    { id: 'piyak', name: '병아리 삐약이', short: '삐약이', lv: 5 },
    { id: 'bori', name: '꿀곰 보리', short: '보리', lv: 6 },
    { id: 'dori', name: '바둑강아지 도리', short: '도리', lv: 7 },
    { id: 'sori', name: '꼬리여우 소리', short: '소리', lv: 8 },
    { id: 'pang', name: '대나무판다 팡팡', short: '팡팡', lv: 9 },
    { id: 'yuni', name: '무지개유니콘 유니', short: '유니', lv: 11 }
  ];
  G.D = {
    CHO, JUNG, split, join, hex, syKey, fyKey, dyKey, jKey, has, SY, WORDS, HY, HW, CLAP, noBatchim,
    BASIC_V, VROW, JNAME, JPIC, STROKES, strokesFor, WORLDS: W, STAGES: ST, PHRASES, SENTENCES,
    PRAISE_VOICE, CHEERS, PRAISE_FIT, STICKER_SETS, STICKERS, OUTFITS, FRIENDS
  };
})(window);
