'use strict';
/* Nihon 2026-11-15 (#3 #5 #2): pure rules, no DOM, no clock of their own — every function takes `today` ('YYYY-MM-DD', local)
   so the fake-clock tests (nihon/qa/coach_test.mjs) can drive them.
   #3 date-based expanding review (boxes 1·3·7·14 days, Vlach 2008; Fritz 2007; v1 curriculum.md §3)
   #5 parent checkpoints A/B/C (parent menu only — the child never sees them)
   #2 daily stop: quota or whole-app time cap reached → closing screen */
(function (G) {
  const Coach = {};
  const BOXES = [1, 3, 7, 14];
  Coach.BOXES = BOXES;
  const pad = n => String(n).padStart(2, '0');
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  Coach.addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  Coach.diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5); /* days from a to b */
  const nextBox = b => BOXES[Math.min(BOXES.length - 1, BOXES.indexOf(b) + 1)] || 1;

  /* One answer for item `key`. srs[key] = { b: box (days), d: due date, l: last answered, ok: last result, r: last warm-up date }.
     - first right answer → box 1, due tomorrow
     - right on/after the due date → next box (1→3→7→14), due = today + box
     - right before the due date → unchanged (no extra credit for massed practice)
     - wrong (any time) → box 1, due tomorrow; silent: the child only sees the normal hint flow */
  Coach.mark = function (srs, key, ok, today) {
    if (!key) return null;
    let e = srs[key];
    if (!ok) e = srs[key] = Object.assign(e || {}, { b: 1, d: Coach.addDays(today, 1) });
    else if (!e) e = srs[key] = { b: 1, d: Coach.addDays(today, 1) };
    else if (today >= e.d) { e.b = nextBox(e.b); e.d = Coach.addDays(today, e.b); }
    e.l = today; e.ok = !!ok;
    return e;
  };
  Coach.isDue = (e, today) => !!e && e.d <= today;
  /* Keys a warm-up can show: letters, syllables, words, and the two sound games (phonological). */
  Coach.kind = k => { const i = k.indexOf(':'); return i < 0 ? '' : k.slice(0, i); };
  Coach.PHON = ['count', 'first'];
  Coach.SHOW = ['j', 'sy', 'w', 'count', 'first'];
  /* Warm-up picks: at most `max` (3) due items, oldest due first, exactly one phonological item when there is any due item and
     a sound-game item exists. An item already shown in a warm-up today never comes back the same day unless it was then
     answered wrong. `valid(key)` says whether the app can still present it (recording + picture exist). */
  Coach.pickWarm = function (srs, today, valid, max) {
    max = max || 3;
    const ok = k => Coach.SHOW.includes(Coach.kind(k)) && (!valid || valid(k));
    const fresh = ([k, e]) => !(e.r === today && e.ok !== false);
    const all = Object.entries(srs).filter(([k]) => ok(k)).filter(fresh);
    const order = (a, b) => (a[1].d < b[1].d ? -1 : a[1].d > b[1].d ? 1 : a[1].b - b[1].b || (a[0] < b[0] ? -1 : 1));
    const due = all.filter(([, e]) => Coach.isDue(e, today)).sort(order);
    const dueMain = due.filter(([k]) => !Coach.PHON.includes(Coach.kind(k)));
    if (!due.length) return [];
    /* the phonological one: the oldest due sound item, else the sound item seen longest ago (filler, not advanced unless due) */
    const phon = due.find(([k]) => Coach.PHON.includes(Coach.kind(k))) ||
      all.filter(([k]) => Coach.PHON.includes(Coach.kind(k))).sort((a, b) => ((a[1].l || '') < (b[1].l || '') ? -1 : 1))[0];
    const out = phon ? [phon[0]] : [];
    for (const [k] of dueMain) { if (out.length >= max) break; out.push(k); }
    return out.slice(0, max);
  };
  /* Shown in a warm-up today (for the once-a-day rule). */
  Coach.shown = function (srs, keys, today) { keys.forEach(k => { if (srs[k]) srs[k].r = today; }); };
  /* Old saves (R3: items = key -> [right, wrong, lastSeenStage], no dates). Nothing is lost: `items` stays as it was, and every
     item gets a box: shaky ones (never right, or wrong at least half as often as right) are due today — the ones seen at the
     earliest stage count as oldest — solid ones (3+ right, never wrong) box 7 spread over the next week, the rest box 3. */
  Coach.migrate = function (items, stage, today) {
    const srs = {};
    let h = 0;
    Object.keys(items || {}).sort().forEach(k => {
      const [r, w, seen] = items[k];
      h = (h * 31 + k.length + r * 7 + w) % 9973;
      if (!r || w * 2 >= r) srs[k] = { b: 1, d: Coach.addDays(today, -Math.min(30, Math.max(0, (stage || 0) - (seen || 0)))) };
      else if (r >= 3 && !w) srs[k] = { b: 7, d: Coach.addDays(today, 1 + h % 7) };
      else srs[k] = { b: 3, d: Coach.addDays(today, 1 + h % 3) };
    });
    return srs;
  };
  /* Review ranking for the "mistakes first" review stages: wrong answers weigh most, then how overdue (by date, not stage). */
  Coach.weight = function (v, e, today) {
    const over = e ? Coach.diff(e.d, today) : 0;
    return v[1] * 2 - v[0] + (e && over >= 0 ? 2 + Math.min(14, over) * 0.2 : 0);
  };

  /* #2 the day is over for the child: today's quota of new stages done, or the whole-app time cap reached.
     log = per-day log ([right, wrong, stages, seconds]); count = new stages finished today. */
  Coach.closed = function (o) {
    if (!o.on) return '';
    if (o.count >= o.perDay) return 'quota';
    if (o.secs >= o.capMin * 60) return 'cap';
    return '';
  };

  /* #5 parent checkpoints from the 글자 점검 records (parent shows a letter, the child reads it, parent taps ✓/✗)
     plus the app's own "pick by sound" record for the basic vowels. Thresholds from the brief:
       A (≈ week 3)  ≥ 5/6 basic vowels
       B (≈ week 7)  ≥ 8/10 basic consonants by name AND ≥ 7/10 new no-받침 syllables read
       C (≈ week 12) ≥ 7/10 two-syllable no-받침 words read without a picture AND own name written alone
     A record field is 'x/n'. The full 글자 점검 (14 consonants, 14 syllables) counts too, scaled to the same share. */
  const frac = s => { const m = /^(\d+)\/(\d+)$/.exec(s || ''); return m ? [+m[1], +m[2]] : null; };
  function latest(checks, fields) {
    for (let i = checks.length - 1; i >= 0; i--) for (const f of fields) { const v = frac(checks[i][f]); if (v && v[1]) return { got: v[0], of: v[1], date: checks[i].date, f }; }
    return null;
  }
  const meets = (r, need, of) => r && r.got / r.of >= need / of - 1e-9;
  Coach.checkpoints = function (checks, appVowels) {
    checks = checks || [];
    const part = (label, r, need, of) => ({ label, need: need + '/' + of, got: r ? r.got + '/' + r.of : null, date: r ? r.date : null, pass: !!meets(r, need, of), src: r ? r.src || '점검' : null });
    const status = parts => (parts.every(p => p.pass) ? 'pass' : parts.some(p => p.got) ? 'practice' : 'none');
    let vA = latest(checks, ['A모음', '모음']);
    if (!vA && appVowels && appVowels.of) vA = Object.assign({ src: '앱 기록' }, appVowels);
    const A = { id: 'A', week: 3, title: '기본 모음', parts: [part('기본 모음 6개', vA, 5, 6)] };
    const B = { id: 'B', week: 7, title: '자음 + 처음 보는 글자', parts: [part('기본 자음 이름', latest(checks, ['B자음', '자음']), 8, 10), part('처음 보는 받침 없는 글자 읽기', latest(checks, ['B새글자', '글자']), 7, 10)] };
    const C = { id: 'C', week: 12, title: '두 글자 낱말 + 이름 쓰기', parts: [part('그림 없이 두 글자 낱말 읽기', latest(checks, ['C낱말', '낱말']), 7, 10), part('혼자 이름 쓰기', latest(checks, ['C이름']), 1, 1)] };
    [A, B, C].forEach(c => { c.status = status(c.parts); });
    A.tip = A.status === 'pass' ? '모음은 잘 알고 있어요. 자음 마을로 계속 가면 됩니다.' : '목욕할 때 "아~ 이~ 오~ 우~" 입 모양 거울 놀이를 해 보세요.';
    B.tip = B.status === 'pass' ? '받침 동굴로 갈 준비가 됐어요. 간판에서 받침 글자를 같이 찾아보세요.' : '과자 봉지·간판에서 아는 자음을 찾아 이름을 말해 보세요(ㄱ 기역, ㄴ 니은).';
    C.tip = C.status === 'pass' ? '그림책 한 쪽을 아이가 손가락으로 짚으며 읽게 해 보세요.' : '종이에 이름을 크게 써 주고, 아이가 보고 쓴 다음 가리고 한 번 더 써 보게 해 주세요.';
    return { A, B, C };
  };

  G.Coach = Coach;
})(typeof window !== 'undefined' ? window : globalThis);
