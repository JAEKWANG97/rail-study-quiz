import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { makeDeck, filterQuestions, Countdown, isStudyQuestion } from '../public/model.js';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('public/questions.json', root), 'utf8'));

test('교재 82문항과 구술 90문항을 고유 ID로 보존한다', () => {
  assert.equal(data.questions.length, 172);
  assert.equal(new Set(data.questions.map(question => question.id)).size, 172);
  const textbook = data.questions.filter(question => question.source === 'textbook');
  assert.deepEqual(textbook.map(question => question.number), Array.from({length: 82}, (_, index) => `6.${index + 1}`));
  const oral = data.questions.filter(question => question.source === 'oral');
  assert.equal(oral.length, 90);
  for (const number of ['141', '169', '172', '183']) assert.equal(oral.filter(question => question.number === number).length, 2);
});

test('원문에 빈 답안인 3개를 임의로 채우지 않는다', () => {
  assert.deepEqual(data.questions.filter(question => question.answerKind === 'missing').map(question => question.number), ['114', '122', '173']);
  assert.ok(data.questions.filter(question => question.answerKind === 'missing').every(question => question.answer === ''));
});

test('문항의 원문 페이지와 미리보기 이미지가 모두 존재한다', async () => {
  for (const source of data.sources) {
    assert.equal(data.questions.filter(question => question.source === source.id).length, source.count);
    for (let page = 1; page <= source.pageCount; page++) await access(new URL(`public/page-previews/${source.id}-${String(page).padStart(2, '0')}.png`, root));
  }
  for (const question of data.questions) {
    const source = data.sources.find(source => source.id === question.source);
    assert.ok(question.page >= 1 && question.endPage <= source.pageCount && question.endPage >= question.page);
    assert.deepEqual(question.pageNumbers, Array.from({length: question.endPage - question.page + 1}, (_, index) => question.page + index));
    for (const page of question.pageNumbers) await access(new URL(`public/page-previews/${question.source}-${String(page).padStart(2, '0')}.png`, root));
    assert.doesNotMatch(question.answer, /예상문답서\.hwp|^\s*[·ㆍ]?6-\d+[·ㆍ]?\s*$/m);
  }
  assert.deepEqual(data.questions.find(question => question.number === '6.82').pageNumbers, [33, 34]);
});

test('원본 PDF 사본의 해시가 추출 기록과 일치한다', async () => {
  for (const source of data.sources) {
    const bytes = await readFile(new URL(`public/sources/${source.filename}`, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
  }
});

test('랜덤 출제는 한 바퀴 안에서 누락이나 중복이 없다', () => {
  const original = data.questions.filter(isStudyQuestion).map(question => question.id);
  const shuffled = makeDeck(data.questions, 'shuffle', () => .37);
  assert.equal(shuffled.length, original.length);
  assert.deepEqual([...shuffled].sort(), [...original].sort());
  assert.notDeepEqual(shuffled, original);
  assert.deepEqual(makeDeck(data.questions, 'sequential'), original);
});

test('교재, 검색, 복습, 별표, 미암기 필터를 함께 적용한다', () => {
  const marks = {'textbook-1': {status: 'review', starred: true}, 'textbook-2': {status: 'learned'}, 'oral-1': {status: 'review'}};
  assert.deepEqual(filterQuestions(data.questions, {source: 'textbook', scope: 'review'}, marks).map(question=>question.id), ['textbook-1']);
  assert.deepEqual(filterQuestions(data.questions, {scope: 'starred'}, marks).map(question=>question.id), ['textbook-1']);
  assert.equal(filterQuestions(data.questions, {scope: 'unlearned'}, marks).length, 170);
  assert.ok(filterQuestions(data.questions, {query:'구원열차'}).length > 0);
  assert.equal(filterQuestions(data.questions, {query:'문제에없는검색어'}).length, 0);
});

test('타이머는 탭이 오래 멈췄다가 돌아와도 실제 경과 시간으로 종료된다', () => {
  let now = 1000;
  const clock = new Countdown(60, () => now);
  now += 12500;
  assert.equal(clock.snapshot().remaining, 48);
  now += 60000;
  assert.equal(clock.snapshot().remaining, 0);
  assert.equal(clock.snapshot().expired, true);
});

test('일시정지, 재개, 재시작과 시간 제한 없음', () => {
  let now = 0;
  const clock = new Countdown(60, () => now);
  now += 10000; clock.pause(); now += 30000;
  assert.equal(clock.snapshot().remaining, 50);
  clock.resume(); now += 10000;
  assert.equal(clock.snapshot().remaining, 40);
  clock.reset(); assert.equal(clock.snapshot().remaining, 60);
  clock.reset(0); now += 999999;
  assert.equal(clock.snapshot().expired, false);
  assert.equal(clock.snapshot().running, false);
});
