/* Curriculum and score rules. No browser. */
import fs from 'fs';
import vm from 'vm';

const root = new URL('..', import.meta.url).pathname;
const context = { console, globalThis: null };
context.globalThis = context;
context.window = context;
context.Audio = function () { this.play = () => Promise.resolve(); };
context.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); }
};
context.document = {
  getElementById() { return null; },
  addEventListener() {},
  documentElement: { dataset: {} }
};
context.matchMedia = () => ({ matches: true });
vm.createContext(context);
vm.runInContext(fs.readFileSync(root + 'v5/js/content.js', 'utf8'), context);
vm.runInContext(fs.readFileSync(root + 'v5/js/engine.js', 'utf8'), context);

const C = context.V5C;
const X = context.V5X;
const fail = [];
function check(name, ok) { if (!ok) fail.push(name); }

const neverRead = ['eomma', 'appa', 'ryeowon', 'uyu', 'gicha'];
C.LESSONS.forEach(lesson => {
  const flow = C.flowFor(lesson, 'mid');
  check(lesson.id + ' flow starts with chant', flow[0] === 'chant');
  check(lesson.id + ' listen before match', !flow.includes('match') || flow.indexOf('listen') < flow.indexOf('match'));
  check(lesson.id + ' sparkle before blocks', !flow.includes('blocks') || flow.indexOf('sparkle') < flow.indexOf('blocks'));
  check(lesson.id + ' trace not before sparkle', !flow.includes('trace') || flow.indexOf('sparkle') < flow.indexOf('trace'));
  check(lesson.id + ' easy has three scored', ['listen', 'sparkle', 'blocks'].every(id => C.flowFor(lesson, 'easy').includes(id)));
  (lesson.read || []).forEach(id => {
    check(lesson.id + ' read ' + id, C.wordDecodable(id, lesson.id));
    if (lesson.id > 1) {
      const earlier = C.wordDecodable(id, lesson.id - 1);
      if (!earlier) check(lesson.id + ' new read uses new letters ' + id, true);
    }
  });
  neverRead.forEach(id => check(lesson.id + ' does not read ' + id, !(lesson.read || []).includes(id)));
  check(lesson.id + ' focus letters are in the lesson', (lesson.focus || []).every(g => lesson.jamo.includes(g) || C.jamoThrough(lesson.id).includes(g)));
});

check('엄마 not decodable at 8', !C.wordDecodable('eomma', 8));
check('아빠 not decodable at 8', !C.wordDecodable('appa', 8));
check('려원 not decodable at 8', !C.wordDecodable('ryeowon', 8));
check('우유 not decodable at 8', !C.wordDecodable('uyu', 8));
check('기차 not decodable at 8', !C.wordDecodable('gicha', 8));
check('아기 waits for ㄱ', !C.wordDecodable('agi', 4) && C.wordDecodable('agi', 5));
check('오이 from lesson 3', C.wordDecodable('oi', 3));
check('사자 waits for ㅅㅈ', !C.wordDecodable('lion', 6) && C.wordDecodable('lion', 7));
check('하마 waits for ㅎ', !C.wordDecodable('hama', 7) && C.wordDecodable('hama', 8));
check('오리 waits for ㄹ', !C.wordDecodable('ori', 7) && C.wordDecodable('ori', 8));
check('2 of 3 passes', C.passLesson(2, 3) === true);
check('2 of 4 does not', C.passLesson(2, 4) === false);
check('1 of 3 does not', C.passLesson(1, 3) === false);
check('empty does not', C.passLesson(0, 0) === false);
check('3 of 3 passes', C.passLesson(3, 3) === true);

check('two solos are not mastery', C.mastered({ solo: 2, box: 2, help: 0 }) === false);
check('three solos are mastery', C.mastered({ solo: 3, box: 3, help: 0 }) === true);
check('hints cancel mastery', C.mastered({ solo: 3, box: 3, help: 3 }) === false);

X.bump('j:ㅏ', 'hint');
X.bump('j:ㅏ', 'hint');
X.bump('j:ㅏ', 'shown');
let sk = X.S.skill['j:ㅏ'];
check('hints do not raise the box', sk.box === 0 && sk.solo === 0 && sk.help === 3);
X.bump('j:ㅏ', 'solo');
X.bump('j:ㅏ', 'solo');
sk = X.S.skill['j:ㅏ'];
check('two clean hits are not 익힘', sk.box === 2 && sk.solo === 2 && C.mastered(sk) === false);
X.bump('j:ㅏ', 'retry');
sk = X.S.skill['j:ㅏ'];
check('a retry does not raise the box', sk.box === 2 && sk.solo === 2);
X.bump('j:ㅏ', 'solo');
sk = X.S.skill['j:ㅏ'];
check('three clean hits do not erase three hints', sk.solo === 3 && C.mastered(sk) === false);
X.bump('j:ㅏ', 'solo');
sk = X.S.skill['j:ㅏ'];
check('more clean hits than hints is 익힘', C.mastered(sk) === true);
X.bump('j:ㅏ', 'shown');
sk = X.S.skill['j:ㅏ'];
check('a revealed answer drops 익힘', sk.box === 2 && C.mastered(sk) === false);

context.localStorage.store['hangul-v5'] = JSON.stringify({
  v: 5, done: { 1: '2020-01-01' }, skill: { 'j:ㄱ': { box: 5, seen: 4, ok: 4, help: 0 } }
});
X.load();
check('old done flags are cleared', !X.S.done[1]);
check('old boxes are cleared', !X.S.skill['j:ㄱ'] || X.S.skill['j:ㄱ'].box === 0);
check('score version is stored', X.S.scoreV === 1);

if (fail.length) {
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('literacy rules ok', C.LESSONS.length, 'lessons');
