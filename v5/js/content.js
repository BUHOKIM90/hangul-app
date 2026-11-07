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
    { id: 'chant', kid: '노래 톡톡', icon: 'assets/pic/playicon/pi_chant.webp', why: '음절 소리를 박자에 맞춰 하나씩 짚어요.' },
    { id: 'listen', kid: '듣고 고르기', icon: 'assets/icons/play/ear.svg', why: '낱말 소리를 듣고 그림과 이어요. 글자보다 소리가 먼저예요.' },
    { id: 'sparkle', kid: '반짝이 찾기', icon: 'assets/icons/play/seek.svg', why: '들은 소리와 같은 글자를 눈으로 찾아요.' },
    { id: 'blocks', kid: '소리 블록', icon: 'assets/icons/play/block.svg', why: '자음과 모음을 붙여 음절 하나를 만들어요.' },
    { id: 'match', kid: '그림 낱말', icon: 'assets/icons/play/cards.svg', why: '그림을 보고 알맞은 낱말 글자를 고르어요.' },
    { id: 'memory', kid: '짝 카드', icon: 'assets/pic/playicon/pi_sort.webp', why: '그림과 낱말을 기억해서 짝을 찾아요.' },
    { id: 'trace', kid: '따라 쓰기', icon: 'assets/pic/playicon/pi_trace.webp', why: '점을 따라 획 순서로 글자 모양을 익혀요.' },
    { id: 'treasure', kid: '보물 복습', icon: 'assets/icons/play/treasure.svg', why: '앞에서 만난 소리를 다시 떠올려요.' }
  ];
  const LESSONS = [
    { id: 1, title: '우리 가족', kid: '가족 소리', place: '몽글이 집', goal: '소리부터. 엄마·아빠·아기 소리를 그림과 잇고, 동그라미 ㅇ을 만나요.', words: ['eomma', 'appa', 'agi', 'ryeowon'], jamo: ['ㅇ', 'ㅏ', 'ㅣ'], chant: ['아', '이', '아'], blocks: { c: 'ㅇ', v: 'ㅏ', say: '아', word: 'agi' }, trace: 'ㅇ' },
    { id: 2, title: '아, 이', kid: '아 이', place: '마당', goal: 'ㅏ·ㅣ 모양과 소리. 아·이를 붙여 봐요.', words: ['agi', 'ima', 'oi', 'i_tooth'], jamo: ['ㅏ', 'ㅣ', 'ㅇ'], chant: ['아', '이', '이'], blocks: { c: 'ㅇ', v: 'ㅣ', say: '이', word: 'ima' }, trace: 'ㅣ' },
    { id: 3, title: '오, 우', kid: '오 우', place: '연못', goal: 'ㅗ·ㅜ 소리. 위아래로 붙는 모음이에요.', words: ['ori', 'ubi', 'uyu', 'eomma'], jamo: ['ㅗ', 'ㅜ', 'ㅏ'], chant: ['오', '우', '오'], blocks: { c: 'ㅇ', v: 'ㅗ', say: '오', word: 'ori' }, trace: 'ㅗ' },
    { id: 4, title: '어, 으', kid: '어 으', place: '숲길', goal: 'ㅓ·ㅡ 를 ㅏ·ㅣ 와 구별해요.', words: ['eobu', 'lion', 'ori', 'ubi'], jamo: ['ㅓ', 'ㅡ', 'ㅏ', 'ㅣ'], chant: ['어', '으', '어'], blocks: { c: 'ㅇ', v: 'ㅓ', say: '어', word: 'eobu' }, trace: 'ㅓ' },
    { id: 5, title: 'ㄱ, ㄴ', kid: '기역 니은', place: '기차역', goal: 'ㄱ·ㄴ 이름과 소리. 가·나를 붙여 낱말로 가요.', words: ['gicha', 'nabi', 'namu', 'goguma'], jamo: ['ㄱ', 'ㄴ', 'ㅏ', 'ㅗ'], chant: ['가', '나', '기'], blocks: { c: 'ㄱ', v: 'ㅏ', say: '가', word: 'gicha' }, trace: 'ㄱ' },
    { id: 6, title: 'ㄷ ㅁ ㅂ', kid: '다 마 바', place: '시장', goal: 'ㄷ·ㅁ·ㅂ 모양을 구별하고 음절을 붙여요.', words: ['dari', 'moja', 'banana', 'dubu', 'bada'], jamo: ['ㄷ', 'ㅁ', 'ㅂ', 'ㅏ', 'ㅗ'], chant: ['다', '마', '바'], blocks: { c: 'ㅁ', v: 'ㅗ', say: '모', word: 'moja' }, trace: 'ㅁ' },
    { id: 7, title: 'ㅅ ㅈ ㅎ ㄹ', kid: '사 자 하', place: '동물원', goal: 'ㅅ·ㅈ·ㅎ·ㄹ 소리. 그림 낱말을 소리와 함께 읽기 시작해요.', words: ['lion', 'so', 'jadu', 'hama', 'radio'], jamo: ['ㅅ', 'ㅈ', 'ㅎ', 'ㄹ', 'ㅏ'], chant: ['사', '자', '하'], blocks: { c: 'ㅎ', v: 'ㅏ', say: '하', word: 'hama' }, trace: 'ㅅ' },
    { id: 8, title: '붙여 읽기', kid: '낱말 읽기', place: '도서관', goal: '배운 소리로 받침 없는 낱말을 그림과 함께 읽어요. 보물에서 다시 만나요.', words: ['nabi', 'ori', 'moja', 'hama', 'gicha', 'bada', 'agi', 'eomma'], jamo: ['ㄱ', 'ㄴ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅎ', 'ㅏ', 'ㅗ'], chant: ['나', '비', '오'], blocks: { c: 'ㄴ', v: 'ㅏ', say: '나', word: 'nabi' }, trace: '가' }
  ];
  /* Each caption is the line heard on that clip. Unclear ui4_proc takes stay unwired. */
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
    ['한 글자씩 또박또박 읽었네', 'ui4_proc18']
  ];
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
    end: 'ui_end', book: 'ui_book', found: 'ui_found', name: 'ui_name', same: 'ui_same', blend: 'ui_blend'
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
  function sampleStroke(st) {
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
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 40) pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      pts.push(b.slice());
    }
    return pts;
  }
  function glyphPlan(g) {
    if (STROKES[g]) return STROKES[g].map(sampleStroke);
    if (isSyl(g)) {
      const p = split(g);
      return glyphPlan(p.cho).concat(glyphPlan(p.jung));
    }
    return [];
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
    return [...keys];
  }
  function choiceN(diff) { return diff === 'hard' ? 4 : diff === 'easy' ? 2 : 3; }

  root.V5C = {
    CHO, JUNG, CONF, JAMO, WORDS, STROKES, PLAYS, LESSONS, PRAISE, FACES, UI, PALS,
    hex, sylKey, jamoKey, wordKey, ko, pic, sylPic, sylWord, jamoPic, compose, split, isSyl, sampleStroke, glyphPlan,
    lesson, wordsThrough, audioKeys, choiceN
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
