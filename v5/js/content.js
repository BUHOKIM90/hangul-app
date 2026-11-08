'use strict';
/* v5 content: early-literacy sequence, strokes, praise. Data only. */
(function (root) {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const CONF = { 'ㅏ': 'ㅓ', 'ㅓ': 'ㅏ', 'ㅗ': 'ㅜ', 'ㅜ': 'ㅗ', 'ㅡ': 'ㅣ', 'ㅣ': 'ㅡ', 'ㄱ': 'ㄴ', 'ㄴ': 'ㄱ', 'ㄷ': 'ㅌ', 'ㅁ': 'ㅂ', 'ㅂ': 'ㅁ', 'ㅅ': 'ㅈ', 'ㅈ': 'ㅅ', 'ㅇ': 'ㅎ', 'ㅎ': 'ㅇ', 'ㄹ': 'ㄷ' };
  const JAMO = {
    'ㄱ': { name: '기역', word: '기차' }, 'ㄴ': { name: '니은', word: '나비' }, 'ㄷ': { name: '디귿', word: '다리' },
    'ㄹ': { name: '리을', word: '라디오' }, 'ㅁ': { name: '미음', word: '모자' }, 'ㅂ': { name: '비읍', word: '바나나' },
    'ㅅ': { name: '시옷', word: '사자' }, 'ㅇ': { name: '이응', word: '오이' }, 'ㅈ': { name: '지읒', word: '자두' },
    'ㅎ': { name: '히읗', word: '하마' }, 'ㅏ': { name: '아', word: '아기' }, 'ㅓ': { name: '어', word: '어부' },
    'ㅗ': { name: '오', word: '오리' }, 'ㅜ': { name: '우', word: '우비' }, 'ㅡ': { name: '으', word: '으르렁' },
    'ㅣ': { name: '이', word: '이마' }
  };
  const WORDS = {
    ryeowon: ['려원', 'people'], eomma: ['엄마', 'people'], appa: ['아빠', 'people'], halmeoni: ['할머니', 'people'],
    harabeoji: ['할아버지', 'people'], agi: ['아기', 'people'], nuna: ['누나', 'people'], ima: ['이마', 'body'],
    i_tooth: ['이', 'body'], oi: ['오이', 'food'], ori: ['오리', 'animal'], ubi: ['우비', 'thing'], uyu: ['우유', 'food'],
    eobu: ['어부', 'people'], lion: ['사자', 'animal'], gicha: ['기차', 'thing'], nabi: ['나비', 'animal'],
    namu: ['나무', 'thing'], goguma: ['고구마', 'food'], dari: ['다리', 'body'], moja: ['모자', 'thing'],
    banana: ['바나나', 'food'], dubu: ['두부', 'food'], bada: ['바다', 'thing'], so: ['소', 'animal'],
    jadu: ['자두', 'food'], hama: ['하마', 'animal'], radio: ['라디오', 'thing']
  };
  const STROKES = {
    'ㄱ': [[[18, 22], [78, 22], [78, 86]]],
    'ㄴ': [[[24, 18], [24, 80], [82, 80]]],
    'ㄷ': [[[22, 16], [80, 16]], [[22, 16], [22, 84], [80, 84]]],
    'ㄹ': [[[22, 14], [78, 14], [78, 46]], [[22, 46], [78, 46]], [[22, 46], [22, 86], [80, 86]]],
    'ㅁ': [[[24, 18], [24, 82]], [[24, 18], [76, 18], [76, 82]], [[24, 82], [76, 82]]],
    'ㅂ': [[[26, 14], [26, 84]], [[74, 14], [74, 84]], [[26, 48], [74, 48]], [[26, 84], [74, 84]]],
    'ㅅ': [[[50, 16], [18, 84]], [[48, 46], [82, 84]]],
    'ㅇ': [{ c: [50, 50, 32] }],
    'ㅈ': [[[22, 18], [78, 18], [20, 84]], [[50, 48], [82, 84]]],
    'ㅎ': [[[38, 12], [62, 12]], [[20, 30], [80, 30]], { c: [50, 64, 20] }],
    'ㅏ': [[[36, 10], [36, 90]], [[36, 50], [74, 50]]],
    'ㅓ': [[[26, 50], [64, 50]], [[64, 10], [64, 90]]],
    'ㅗ': [[[50, 28], [50, 62]], [[14, 62], [86, 62]]],
    'ㅜ': [[[14, 36], [86, 36]], [[50, 36], [50, 82]]],
    'ㅡ': [[[12, 50], [88, 50]]],
    'ㅣ': [[[50, 10], [50, 90]]]
  };
  const PLAYS = [
    { id: 'chant', kid: '노래 톡톡', icon: 'assets/pic/playicon/pi_chant.webp', why: '들은 음절을 칸 순서대로 눌러요. 다음 칸이 켜져 있어서 이 놀이는 점수를 올리지 않아요.' },
    { id: 'listen', kid: '듣고 고르기', icon: 'assets/icons/play/ear.svg', why: '낱말 소리를 듣고 그림을 골라요. 그림 위에는 글자를 적지 않아요.' },
    { id: 'sparkle', kid: '글자 찾기', icon: 'assets/icons/play/seek.svg', why: '들은 글자를 모양으로 찾아요. 반짝임은 틀린 뒤에만 나와요.' },
    { id: 'blocks', kid: '소리 블록', icon: 'assets/icons/play/block.svg', why: '자음과 모음을 골라 음절 하나를 만들어요. 고를 글자가 있어야 점수가 생겨요.' },
    { id: 'match', kid: '그림 낱말', icon: 'assets/icons/play/cards.svg', why: '배운 소리로 읽을 수 있는 낱말만 글자로 맞춰요. 받침이 있는 낱말은 넣지 않아요.' },
    { id: 'memory', kid: '짝 카드', icon: 'assets/pic/playicon/pi_sort.webp', why: '그림과 낱말을 짝지어요. 카드 뒷면에 정답을 미리 칠하지 않아요.' },
    { id: 'trace', kid: '따라 쓰기', icon: 'assets/pic/playicon/pi_trace.webp', why: '분홍 점선을 손가락으로 따라 획 순서대로 써요. 새로 배운 글자마다 써 봐요. 따라 쓴 것은 읽기 점수로 세지 않아요.' },
    { id: 'phrase', kid: '짧은 글 읽기', icon: 'assets/pic/playicon/pi_read.webp', why: '배운 글자로만 된 두 낱말 글을 읽고 맞는 그림을 골라요. 도전에서는 소리 없이 먼저 혼자 읽어요.' },
    { id: 'treasure', kid: '보물 복습', icon: 'assets/icons/play/treasure.svg', why: '힌트가 필요했던 소리나 낱말을 다시 떠올려요.' }
  ];
  /* hear = picture listening. read = no batchim, only jamo taught by that lesson.
     sight = whole-word shape, not sounding out. onset = first syllable only. */
  const LESSONS = [
    { id: 1, title: '우리 가족', kid: '가족 소리', place: '몽글이 집', goal: '소리부터. 엄마·아빠·아기 그림을 듣고 고르고, ㅇ과 ㅏ를 만나요. 아직 낱말은 읽지 않아요.', words: ['eomma', 'appa', 'agi', 'ryeowon'], hear: ['eomma', 'appa', 'agi', 'ryeowon'], read: [], sight: [], onset: [], jamo: ['ㅇ', 'ㅏ', 'ㅣ'], focus: ['ㅇ', 'ㅏ'], contrast: { 'ㅇ': 'ㅎ', 'ㅏ': 'ㅣ', 'ㅣ': 'ㅏ' }, chant: ['아', '이', '아'], blocks: { c: 'ㅇ', v: 'ㅏ', say: '아', word: 'agi' }, trace: 'ㅇ', flow: { easy: ['chant', 'listen', 'sparkle', 'blocks'], mid: ['chant', 'listen', 'sparkle', 'blocks', 'trace'], hard: ['chant', 'listen', 'sparkle', 'blocks', 'trace', 'treasure'] } },
    { id: 2, title: '아, 이', kid: '아 이', place: '몽글이 마당', goal: 'ㅏ와 ㅣ를 구별하고 이를 붙여요. 이만 소리 내어 읽고, 엄마·아빠는 낱말 모양으로만 맞춰요.', words: ['agi', 'ima', 'oi', 'i_tooth', 'eomma', 'appa'], hear: ['agi', 'ima', 'oi', 'i_tooth'], read: ['i_tooth'], sight: ['eomma', 'appa'], onset: [], jamo: ['ㅏ', 'ㅣ', 'ㅇ'], focus: ['ㅏ', 'ㅣ'], contrast: { 'ㅏ': 'ㅣ', 'ㅣ': 'ㅏ' }, chant: ['아', '이', '이'], blocks: { c: 'ㅇ', v: 'ㅣ', say: '이', word: 'i_tooth' }, trace: 'ㅣ', flow: { easy: ['chant', 'listen', 'sparkle', 'blocks'], mid: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'trace'], hard: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'memory', 'trace', 'treasure'] } },
    { id: 3, title: '오, 우', kid: '오 우', place: '연못', goal: 'ㅗ·ㅜ를 구별하고 오를 붙여요. 오이는 아는 소리라 글자로 읽어요. 우유·오리는 아직 그림만 들어요.', words: ['ori', 'ubi', 'uyu', 'oi'], hear: ['ori', 'ubi', 'uyu', 'oi'], read: ['oi'], sight: [], onset: [], jamo: ['ㅗ', 'ㅜ', 'ㅏ'], focus: ['ㅗ', 'ㅜ'], contrast: { 'ㅗ': 'ㅜ', 'ㅜ': 'ㅗ' }, chant: ['오', '우', '오'], blocks: { c: 'ㅇ', v: 'ㅗ', say: '오', word: 'ori' }, trace: 'ㅗ', flow: { easy: ['chant', 'listen', 'sparkle', 'blocks'], mid: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'trace'], hard: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'trace', 'treasure'] } },
    { id: 4, title: '어, 으', kid: '어 으', place: '숲속 동굴', goal: 'ㅓ·ㅡ를 ㅏ·ㅣ와 구별해요. 자음은 ㄱ 하나만 새로 만나, 가를 붙이고 아기를 읽어요. 사자 글자는 아직 읽지 않아요.', words: ['eobu', 'lion', 'ori', 'ubi', 'agi'], hear: ['eobu', 'lion', 'ori', 'ubi'], read: ['agi'], sight: [], onset: [{ word: 'eobu', syl: '어' }, { word: 'ori', syl: '오' }], jamo: ['ㅓ', 'ㅡ', 'ㄱ', 'ㅏ', 'ㅣ'], focus: ['ㅓ', 'ㅡ'], contrast: { 'ㅓ': 'ㅏ', 'ㅡ': 'ㅣ', 'ㅏ': 'ㅓ', 'ㅣ': 'ㅡ', 'ㄱ': 'ㄴ' }, chant: ['어', '으', '어'], blocks: { c: 'ㄱ', v: 'ㅏ', say: '가', word: 'agi' }, trace: 'ㄱ', flow: { easy: ['chant', 'listen', 'sparkle', 'blocks'], mid: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'trace'], hard: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'trace', 'treasure'] } },
    { id: 5, title: 'ㄴ, ㄷ', kid: '나 다', place: '기차역', goal: '오늘은 ㄴ·ㄷ만 새로 만나요. 나를 붙여 누나를 읽어요. 다는 소리로 붙이고, 다리 글자는 아직 읽지 않아요.', words: ['nabi', 'nuna', 'dari', 'gicha', 'agi'], hear: ['nabi', 'nuna', 'dari', 'gicha'], read: ['nuna', 'agi'], sight: [], onset: [], jamo: ['ㄴ', 'ㄷ', 'ㅏ', 'ㅜ'], focus: ['ㄴ', 'ㄷ'], contrast: { 'ㄴ': 'ㄱ', 'ㄷ': 'ㅌ', 'ㄱ': 'ㄴ' }, chant: ['나', '다', '누'], blocks: { c: 'ㄴ', v: 'ㅏ', say: '나', word: 'nabi' }, trace: 'ㄴ', flow: { easy: ['chant', 'listen', 'sparkle', 'blocks'], mid: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'trace'], hard: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'memory', 'trace', 'treasure'] } },
    { id: 6, title: 'ㅁ, ㅂ', kid: '마 바', place: '시장', goal: '오늘은 ㅁ·ㅂ만 새로 만나요. 아는 소리로 나비·나무·바다·두부를 읽어요.', words: ['bada', 'banana', 'nabi', 'namu', 'dari', 'dubu', 'ima', 'ubi'], hear: ['bada', 'banana', 'nabi', 'namu', 'dari'], read: ['nabi', 'namu', 'ima', 'banana', 'bada', 'dubu', 'ubi'], sight: [], onset: [], jamo: ['ㅁ', 'ㅂ', 'ㅏ', 'ㅗ'], focus: ['ㅁ', 'ㅂ'], contrast: { 'ㅁ': 'ㅂ', 'ㅂ': 'ㅁ' }, chant: ['바', '마', '바'], blocks: { c: 'ㅂ', v: 'ㅏ', say: '바', word: 'bada' }, trace: 'ㅁ', flow: { easy: ['chant', 'listen', 'sparkle', 'blocks'], mid: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'trace'], hard: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'memory', 'trace', 'treasure'] } },
    { id: 7, title: 'ㅅ, ㅈ', kid: '사 자', place: '동물원', goal: '헷갈리는 ㅅ·ㅈ을 구별하고, 사자·소·자두·모자를 읽어요.', words: ['lion', 'so', 'jadu', 'moja'], hear: ['lion', 'so', 'jadu', 'moja'], read: ['lion', 'so', 'jadu', 'moja'], sight: [], onset: [], jamo: ['ㅅ', 'ㅈ', 'ㅏ', 'ㅗ'], focus: ['ㅅ', 'ㅈ'], contrast: { 'ㅅ': 'ㅈ', 'ㅈ': 'ㅅ' }, chant: ['사', '자', '소'], blocks: { c: 'ㅅ', v: 'ㅏ', say: '사', word: 'lion' }, trace: 'ㅅ', flow: { easy: ['chant', 'listen', 'sparkle', 'blocks'], mid: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'trace'], hard: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'memory', 'trace', 'treasure'] } },
    { id: 8, title: '붙여 읽기', kid: '낱말 읽기', place: '도서관', goal: 'ㅎ·ㄹ을 만나고, 배운 소리로만 된 낱말을 그림과 읽어요. ㄹ은 찾고, 획이 많은 쓰기는 하지 않아요.', words: ['hama', 'ori', 'radio', 'dari', 'nabi', 'agi', 'moja', 'goguma'], hear: ['hama', 'ori', 'radio', 'dari'], read: ['hama', 'ori', 'radio', 'dari', 'moja', 'nabi', 'agi', 'goguma'], sight: [], onset: [], jamo: ['ㅎ', 'ㄹ', 'ㄱ', 'ㄴ', 'ㅏ', 'ㅗ'], focus: ['ㅎ', 'ㄹ'], contrast: { 'ㅎ': 'ㅇ', 'ㄹ': 'ㄷ' }, chant: ['하', '라', '오'], blocks: { c: 'ㅎ', v: 'ㅏ', say: '하', word: 'hama' }, trace: 'ㅎ', flow: { easy: ['chant', 'listen', 'sparkle', 'blocks'], mid: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'treasure'], hard: ['chant', 'listen', 'sparkle', 'blocks', 'match', 'memory', 'trace', 'treasure'] } }
  ];

  /* Lesson voice + look: intro clip (verified: "려원아, 오늘은 …에 가볼까?"), scene, letters to write, phrases. */
  const LESSON_EXTRA = {
    1: { intro: 'u_01', scene: 'assets/pic/scene_01.webp', write: ['ㅇ', 'ㅏ'], phrases: [] },
    2: { intro: 'u_02', scene: 'assets/pic/scene_02.webp', write: ['ㅣ', 'ㅏ'], phrases: [] },
    3: { intro: 'u_03', scene: 'assets/pic/scene_03.webp', write: ['ㅗ', 'ㅜ'], phrases: [] },
    4: { intro: 'u_04', scene: 'assets/pic/scene_04.webp', write: ['ㄱ', 'ㅓ', 'ㅡ'], phrases: [] },
    5: { intro: 'u_05', scene: 'assets/pic/scene_05.webp', write: ['ㄴ', 'ㄷ'], phrases: [] },
    6: { intro: 'u_28', scene: 'assets/pic/scene_28.webp', write: ['ㅁ', 'ㅂ'], phrases: ['s_1', 's_2'] },
    7: { intro: 'u_08', scene: 'assets/pic/scene_08.webp', write: ['ㅅ', 'ㅈ'], phrases: ['s_4', 's_6', 's_1'] },
    8: { intro: 'u_20', scene: 'assets/pic/scene_20.webp', write: ['ㅎ', 'ㄹ'], phrases: ['s_6', 's_4', 's_2', 's_1'] }
  };
  /* Phrase clips with their picture. s_3 and st_4 are not used: their recordings do not say the caption. */
  const PHRASES = {
    s_1: { text: '나비도 나무도', pic: 'assets/pic/phrase_1.webp', words: ['nabi', 'namu'] },
    s_2: { text: '바나나 나무', pic: 'assets/pic/phrase_2.webp', words: ['banana', 'namu'] },
    s_4: { text: '나비 모자', pic: 'assets/pic/phrase_4.webp', words: ['nabi', 'moja'] },
    s_6: { text: '아기 모자', pic: 'assets/pic/phrase_6.webp', words: ['agi', 'moja'] }
  };
  const PHRASE_DECOY = ['assets/pic/phrase_3.webp', 'assets/pic/phrase_5.webp'];
  LESSONS.forEach(l => {
    Object.assign(l, LESSON_EXTRA[l.id] || {});
    const ph = (l.phrases || []).length ? ['phrase'] : [];
    const later = l.id >= 2 ? ['match'] : [];
    /* Every lesson writes its new letters; reading lessons end with a phrase. Review lives inside listen/letter steps. */
    l.flow = {
      easy: ['chant', 'listen', 'sparkle', 'blocks', 'trace'],
      mid: ['chant', 'listen', 'sparkle', 'blocks'].concat(later, ph, ['trace']),
      hard: ['chant', 'listen', 'sparkle', 'blocks'].concat(later, l.id >= 2 ? ['memory'] : [], ph, ['trace', 'treasure'])
    };
  });
  /* What the clip really says, where audio/lines.js is wrong or silent (checked by listening/ASR). */
  const CAPTION = {
    ui_retry: '다시 골라 볼까?',
    ui_merge: '',
    ui_listen: '',
    ui4_chant: '반짝이는 칸을 눌러 봐!',
    ui4_balloon: '들은 글자를 눌러 봐!',
    ui4_block: '블록으로 글자 만들자!',
    ui4_memory: '카드를 뒤집어서 짝꿍을 찾아볼까?',
    ui4_treasure: '보물 상자를 열어 볼까?',
    ui4_treasure2: '반짝! 보물을 찾았어!',
    ui4_try: '괜찮아. 같이 해 보자.',
    ui4_tapnext: '여기 눌러 볼까?',
    ui4_hint: '여기 반짝이는 데를 봐!',
    ui4_slow: '천천히 해도 돼. 몽글이가 기다릴게.',
    ui4_echo2: '이번엔 려원이가 혼자 읽어 볼까?',
    ui4_today: '오늘 뭐 할까?',
    ui4_town: '몽글이 마을이 더 예뻐졌어!',
    ui4_bye: '오늘은 여기까지. 내일 또 하자!',
    ui4_newtmr: '내일 또 새 놀이가 기다려!',
    ui4_free: '더 놀고 싶으면, 놀이터에서 배운 놀이를 해 볼까?',
    ui4_again: '오늘은 좋아하는 친구들을 한 번 더 만나 볼까?',
    ui4_yest: '어제 만난 친구 기억나?',
    u_01: '려원아, 오늘은 몽글이 집에 가 볼까?',
    u_02: '려원아, 오늘은 몽글이 마당에 가 볼까?',
    u_03: '려원아, 오늘은 연못에 가 볼까?',
    u_04: '려원아, 오늘은 숲속 동굴에 가 볼까?',
    u_05: '려원아, 오늘은 기차역에 가 볼까?',
    u_28: '려원아, 오늘은 시장에 가 볼까?',
    u_08: '려원아, 오늘은 동물원에 가 볼까?',
    u_20: '려원아, 오늘은 도서관에 가 볼까?',
    s_1: '나비도 나무도', s_2: '바나나 나무', s_4: '나비 모자', s_6: '아기 모자',
    w_dwaeji: '돼지.',
    w_gawi: '가위.',
    w_gimchi: '김치.',
    w_girin: '기린.',
    w_gita: '기타.',
    w_gwaja: '과자.',
    w_haema: '해마.',
    w_hodu: '호두.',
    w_hyuji: '휴지.',
    w_jido: '지도.',
    w_keikeu: '케이크.',
    w_ojingeo: '오징어.',
    w_pija: '피자.',
    w_pungseon: '풍선.',
    w_saeu: '새우.',
    w_sangeo: '상어.',
    w_seonmul: '선물.',
    w_siso: '시소.',
    w_ssiat: '씨앗.',
    w_subak: '수박.',
    w_tajo: '타조.',
    w_tokki: '토끼.',
    w_tomato: '토마토.',
    w_ttalgi: '딸기.',
    w_wonsungi: '원숭이.',
    w_yagu: '야구.',
    w_gangaji: '강아지.',
    w_mul: '물.',
    w_bae: '배.'
  };
  /* Letter-picture cards (ㅏ with 아기 …). */
  const LP = { 'ㅏ': 'a', 'ㅓ': 'eo', 'ㅗ': 'o', 'ㅜ': 'u', 'ㅡ': 'eu', 'ㅣ': 'i', 'ㄱ': 'g', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄹ': 'r', 'ㅁ': 'm', 'ㅂ': 'b', 'ㅅ': 's', 'ㅇ': 'ng', 'ㅈ': 'j', 'ㅎ': 'h' };
  function letterPic(g) { return LP[g] ? 'assets/pic/lp_' + LP[g] + '.webp' : ''; }
  /* Each caption is the line heard on that clip. Unclear ui4_proc takes stay unwired.
     Reward boasts (level, jar, sticker) are not play praise — they would be untrue mid-lesson. */
  const PRAISE = [
    ['잘했어!', 'ui_good1'],
    ['멋져!', 'ui_good2'],
    ['최고야!', 'ui_good3'],
    ['찾았다!', 'ui_found'],
    ['스티커 받았어!', 'ui_sticker'],
    ['우와, 한 단계 올라갔어!', 'ui_levelup'],
    ['와, 별 병이 꽉 찼어!', 'ui_jarfull'],
    ['스티커를 모았어!', 'ui_book'],
    ['끝까지 들었네', 'ui4_proc1'],
    ['순서대로 썼네', 'ui4_proc2'],
    ['끝까지 들었네!', 'ui4_proc5'],
    ['두 개를 붙여서 글자를 만들었네', 'ui4_proc6'],
    ['다시 찾아냈어. 포기하지 않았네.', 'ui4_proc7'],
    ['천천히 끝까지 해냈네', 'ui4_proc11'],
    ['글자를 하나하나 찾아냈네', 'ui4_proc12'],
    ['이야기를 끝까지 들었네.', 'ui4_proc13'],
    ['들은 글자를 쏙 잡았네', 'ui4_proc15'],
    ['어려웠는데 다시 해봤네', 'ui4_proc16'],
    ['그림을 보고 잘 생각했네.', 'ui4_proc17'],
    ['한 글자씩 또박또박 읽었네', 'ui4_proc18'],
    ['혼자 읽었네!', 'ui4_proc3'],
    ['반짝! 보물을 찾았어!', 'ui4_treasure2'],
    ['같은 소리끼리 잘 모았네!', 'ui4_proc9']
  ];
  const PRAISE_BY = {};
  PRAISE.forEach(p => { PRAISE_BY[p[1]] = p; });
  const POOL_KEYS = {
    short: ['ui_good1', 'ui_good2', 'ui_good3', 'ui_found'],
    any: ['ui_good1', 'ui_good2', 'ui_good3'],
    picture: ['ui4_proc17', 'ui_found'],
    find: ['ui_found', 'ui4_proc12'],
    read: ['ui4_proc3', 'ui4_proc18'],
    treasure: ['ui4_treasure2', 'ui_found'],
    blocks: ['ui4_proc6'],
    trace: ['ui4_proc2', 'ui4_proc11'],
    chant: ['ui4_proc1', 'ui4_proc5', 'ui4_proc18'],
    retry: ['ui4_proc7', 'ui4_proc16']
  };
  const PLAY_POOL = {
    beat: ['short'],
    listen: ['any', 'picture'],
    match: ['read', 'any'],
    treasure: ['treasure', 'any'],
    phrase: ['read', 'any', 'picture'],
    sparkle: ['any', 'find'],
    blocks: ['any', 'blocks'],
    trace: ['any', 'trace'],
    chant: ['any', 'chant'],
    memory: ['any', 'picture']
  };
  function praisePool(type, helped) {
    const ids = (PLAY_POOL[type] || PLAY_POOL.listen).slice();
    if (helped) ids.push('retry');
    const out = [];
    const seen = {};
    ids.forEach(id => {
      (POOL_KEYS[id] || []).forEach(k => {
        if (seen[k] || !PRAISE_BY[k]) return;
        seen[k] = 1;
        out.push(PRAISE_BY[k]);
      });
    });
    return out;
  }
  const ENCOURAGE = {
    hint: [
      ['다시 찾아냈어! 포기하지 않았네!', 'ui4_proc7'],
      ['어려웠는데 다시 해봤네', 'ui4_proc16'],
      ['찾았다!', 'ui_found']
    ],
    shown: [
      ['괜찮아. 같이 해 보자.', 'ui4_try'],
      ['같이 해 보자!', 'ui_together']
    ]
  };
  function encouragePool(kind) {
    return (ENCOURAGE[kind] || ENCOURAGE.shown).slice();
  }
  const SYL_PIC = {
    '아': 'agi', '이': 'ima', '오': 'ori', '우': 'ubi', '어': 'eobu',
    '가': 'gicha', '나': 'nabi', '기': 'gicha', '다': 'dari', '마': 'moja',
    '바': 'banana', '사': 'lion', '자': 'jadu', '하': 'hama', '모': 'moja', '비': 'nabi'
  };
  const PALS = [
    ['assets/char/monggeul_cheer.webp', '몽글이'],
    ['assets/friends/bori.webp', '보리'],
    ['assets/friends/tori.webp', '토리'],
    ['assets/friends/momo.webp', '모모'],
    ['assets/friends/gureum.webp', '구름']
  ];
  const FACES = [
    'assets/char/monggeul_laugh.webp', 'assets/char/monggeul_clap.webp', 'assets/char/monggeul_cheer.webp',
    'assets/char/monggeul_jump.webp', 'assets/char/monggeul_wave.webp'
  ];
  const UI = {
    hello: 'ui_hello', listen: 'ui_listen', retry: 'ui_retry', hint: 'ui_hwhint', together: 'ui_together',
    find: 'ui_find', trace: 'ui_trace', merge: 'ui_merge', match: 'ui_match', which: 'ui_which',
    end: 'ui_end', book: 'ui_book', found: 'ui_found', name: 'ui_name', same: 'ui_same', blend: 'ui_blend',
    chant: 'ui4_chant', letter: 'ui4_balloon', block: 'ui4_block', memory: 'ui4_memory', treasure: 'ui4_treasure',
    tapnext: 'ui4_tapnext', hint2: 'ui4_hint', slow: 'ui4_slow', tryit: 'ui4_try', alone: 'ui4_echo2', write: 'ui_stage6'
  };

  function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'); }
  function sylKey(ch) { return 'sy_' + hex(ch); }
  function jamoKey(ch) { return 'j_' + hex(ch); }
  function wordKey(id) { return 'w_' + id; }
  function ko(id) { return (WORDS[id] || [id])[0]; }
  function pic(id) { return 'assets/pic/' + id + '.webp'; }
  function wordIdByKo(name) {
    const ids = Object.keys(WORDS);
    for (let i = 0; i < ids.length; i++) if (WORDS[ids[i]][0] === name) return ids[i];
    return '';
  }
  function sylPic(ch) { return SYL_PIC[ch] ? pic(SYL_PIC[ch]) : ''; }
  function sylWord(ch) { return SYL_PIC[ch] ? ko(SYL_PIC[ch]) : ch; }
  function jamoPic(g) {
    const name = JAMO[g] && JAMO[g].word;
    const id = name && wordIdByKo(name);
    return id ? pic(id) : '';
  }
  function compose(c, v) {
    return String.fromCharCode(0xAC00 + CHO.indexOf(c) * 588 + JUNG.indexOf(v) * 28);
  }
  function split(s) {
    const n = s.charCodeAt(0) - 0xAC00;
    return { cho: CHO[Math.floor(n / 588)], jung: JUNG[Math.floor((n % 588) / 28)] };
  }
  function isSyl(s) { return typeof s === 'string' && s.length === 1 && s >= '가' && s <= '힣'; }
  function sampleStroke(st, dense) {
    if (st.c) {
      const cx = st.c[0], cy = st.c[1], r = st.c[2], n = 6, pts = [];
      for (let i = 0; i < n; i++) {
        const t = -i / n * Math.PI * 2;
        pts.push([+(cx + r * Math.sin(t)).toFixed(1), +(cy - r * Math.cos(t)).toFixed(1)]);
      }
      return pts;
    }
    const pts = [st[0].slice()];
    for (let i = 1; i < st.length; i++) {
      const a = st[i - 1], b = st[i];
      if (dense !== false && Math.hypot(b[0] - a[0], b[1] - a[1]) > 40) pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      pts.push(b.slice());
    }
    return pts;
  }
  function glyphPlan(g, dense) {
    if (STROKES[g]) return STROKES[g].map(st => sampleStroke(st, dense));
    if (isSyl(g)) {
      const p = split(g);
      return glyphPlan(p.cho, dense).concat(glyphPlan(p.jung, dense));
    }
    return [];
  }
  function hasBatchim(ch) {
    return isSyl(ch) && ((ch.charCodeAt(0) - 0xAC00) % 28) !== 0;
  }
  function jamoThrough(id) {
    const out = [];
    LESSONS.forEach(l => {
      if (l.id <= id) l.jamo.forEach(j => { if (out.indexOf(j) < 0) out.push(j); });
    });
    return out;
  }
  function hearOf(lesson) {
    const list = lesson && (lesson.hear || lesson.words) || [];
    return list.slice();
  }
  function wordDecodable(wordId, lessonId) {
    const name = ko(wordId);
    if (!name) return false;
    const known = jamoThrough(lessonId);
    for (let i = 0; i < name.length; i++) {
      const ch = name[i];
      if (!isSyl(ch) || hasBatchim(ch)) return false;
      const p = split(ch);
      if (known.indexOf(p.cho) < 0 || known.indexOf(p.jung) < 0) return false;
    }
    return true;
  }
  function flowFor(lesson, diff) {
    const table = (lesson && lesson.flow) || {};
    const d = diff === 'easy' || diff === 'hard' ? diff : 'mid';
    const steps = table[d] || table.mid || ['listen'];
    return steps.slice();
  }
  /* A path passes only when enough plays were unaided. Letter mastery is separate. */
  function passLesson(solos, total) {
    return total >= 3 && solos >= 2 && solos * 2 > total;
  }
  /* 익힘: three clean identifications, and more clean hits than hints. */
  function mastered(sk) {
    return !!(sk && sk.solo >= 3 && sk.box >= 3 && sk.help < sk.solo);
  }
  function confuse(lesson, g) {
    if (lesson && lesson.contrast && lesson.contrast[g]) return lesson.contrast[g];
    return CONF[g] || '';
  }
  function lesson(id) { return LESSONS.find(l => l.id === id) || LESSONS[0]; }
  function wordsThrough(id) {
    const out = [];
    LESSONS.forEach(l => { if (l.id <= id) l.words.forEach(w => { if (!out.includes(w)) out.push(w); }); });
    return out;
  }
  function audioKeys() {
    const keys = new Set(Object.values(UI).concat(PRAISE.map(p => p[1])));
    LESSONS.forEach(l => {
      l.words.forEach(w => keys.add(wordKey(w)));
      l.jamo.forEach(j => keys.add(jamoKey(j)));
      l.chant.forEach(s => keys.add(sylKey(s)));
      keys.add(sylKey(l.blocks.say));
      keys.add(jamoKey(l.blocks.c));
      keys.add(jamoKey(l.blocks.v));
      if (isSyl(l.trace)) {
        const p = split(l.trace);
        keys.add(jamoKey(p.cho)); keys.add(jamoKey(p.jung)); keys.add(sylKey(l.trace));
      } else keys.add(jamoKey(l.trace));
    });
    Object.keys(CAPTION).forEach(k => { if (CAPTION[k]) keys.add(k); });
    Object.keys(WORDS).forEach(id => { keys.add('hw_' + id); keys.add('hy_' + id); keys.add(wordKey(id)); });
    LESSONS.forEach(l => {
      (l.write || []).forEach(j => keys.add(jamoKey(j)));
      knownSylsOf(l).forEach(ch => { keys.add(sylKey(ch)); keys.add('fy_' + hex(ch)); keys.add('dy_' + hex(ch)); });
    });
    return [...keys];
  }
  function knownSylsOf(l) {
    const out = [];
    (l.chant || []).concat([l.blocks.say], (l.onset || []).map(o => o.syl)).forEach(s => { if (out.indexOf(s) < 0) out.push(s); });
    ['아', '이', '오', '우', '어', '으'].forEach(s => { if (out.indexOf(s) < 0) out.push(s); });
    return out;
  }
  function choiceN(diff) { return diff === 'hard' ? 4 : 3; }

  root.V5C = {
    CHO, JUNG, CONF, JAMO, WORDS, STROKES, PLAYS, LESSONS, PRAISE, FACES, UI, PALS, praisePool, encouragePool,
    hex, sylKey, jamoKey, wordKey, ko, pic, sylPic, sylWord, jamoPic, compose, split, isSyl, sampleStroke, glyphPlan,
    lesson, wordsThrough, audioKeys, choiceN, hasBatchim, jamoThrough, hearOf, wordDecodable,
    flowFor, passLesson, mastered, confuse, CAPTION, PHRASES, PHRASE_DECOY, letterPic
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
