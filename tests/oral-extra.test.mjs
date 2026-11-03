import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {filterQuestions, makeDeck} from '../public/model.js';
import {StudyStorage, storageKey} from '../public/persistence.js';

const root = new URL('../public/', import.meta.url);
const original = JSON.parse(await readFile(new URL('questions.json', root), 'utf8'));
const supplemental = JSON.parse(await readFile(new URL('supplemental.json', root), 'utf8'));
const extra = JSON.parse(await readFile(new URL('oral-extra.json', root), 'utf8'));
const all = [...original.questions, ...supplemental.questions, ...extra.questions];

test('기존 구술 90문항은 제외하고 신규 구술 50문항과 교재를 전체 200문항으로 학습한다', () => {
  assert.equal(extra.questions.length, 50);
  assert.equal(new Set(all.map(q => q.id)).size, all.length);
  assert.equal(extra.sources[0].name, '신규 구술');
  assert.equal(filterQuestions(all, {source:'oral'}).length, 0);
  assert.equal(filterQuestions(all, {source:'textbook'}).length, 150);
  assert.deepEqual(filterQuestions(all, {source:'oral-extra'}), extra.questions);
  const deck = makeDeck(all);
  assert.equal(deck.length, 200);
  assert.equal(new Set(deck).size, 200);
  assert.ok(extra.questions.every(q => deck.includes(q.id)));
  assert.ok(!deck.some(id => /^oral-\d/.test(id)));
  assert.equal(filterQuestions(all, {scope:'starred'}, {'oral-1':{starred:true}}).length, 0);
  assert.equal(filterQuestions(all, {scope:'review'}, {'oral-1':{status:'review'}}).length, 0);
});

test('추가본은 원본 PDF와 9쪽 미리보기를 연결하고 모든 문항에 답안을 보존한다', async () => {
  const [source] = extra.sources;
  assert.equal(source.count, 50);
  assert.equal(source.pageCount, 9);
  const pdf = await readFile(new URL(`sources/${source.filename}`, root));
  assert.equal(createHash('sha256').update(pdf).digest('hex'), '91a5fd8c2e9536d64f6f2876315c1a033100d42e177a97d3a868de7308c5f38d');
  assert.equal(source.sha256, createHash('sha256').update(pdf).digest('hex'));
  for (let page = 1; page <= 9; page++) {
    const png = await readFile(new URL(`page-previews/oral-extra-${String(page).padStart(2,'0')}.png`, root));
    assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(20), 1400);
  }
  for (const q of extra.questions) {
    assert.equal(q.source, source.id);
    assert.ok(q.question && q.answer);
    assert.ok(q.page >= 1 && q.endPage <= 9 && q.page <= q.endPage);
    assert.deepEqual(q.pageNumbers, Array.from({length:q.endPage-q.page+1}, (_,i) => q.page+i));
    assert.doesNotMatch(q.answer, /신규구술\s+\d/);
  }
});

test('페이지를 넘긴 답안 3개와 두 줄짜리 질문을 끊거나 별도 문항으로 나누지 않는다', () => {
  assert.deepEqual(extra.questions.filter(q => q.page !== q.endPage).map(q => [q.id,q.pageNumbers]), [
    ['oral-extra-16',[3,4]], ['oral-extra-22',[4,5]], ['oral-extra-34',[6,7]]
  ]);
  const find = id => extra.questions.find(q => q.id === id);
  assert.match(find('oral-extra-16').answer, /CIBM, FLBM → M차, M’차\nMTOM, MTBM → M’차/);
  assert.match(find('oral-extra-22').answer, /ATS위치에서 ADU 15현시 점등 및 8초마다 경고음 발생$/);
  assert.equal(find('oral-extra-34').answer, '무여자 시 비상제동 작용 공기를 공급');
  assert.match(find('oral-extra-19').question, /승객을 차 외로 유도하는 방법$/);
  assert.equal(find('oral-extra-01').answer.split('\n').length, 9);
});

test('추가본의 선택·암기·별표를 저장해도 기존 구술과 교재 기록을 유지한다', () => {
  const marks = {'oral-1':{status:'learned',starred:true}, 'textbook-1':{status:'review',starred:false}};
  const values = new Map([[storageKey,JSON.stringify({source:'oral',marks})]]);
  const adapter = {getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value)};
  const store = new StudyStorage(adapter, all.map(q => q.id));
  store.saveSettings({source:'oral-extra'});
  store.saveMark('oral-extra-01', {status:'learned',starred:true});
  const saved = new StudyStorage(adapter, all.map(q => q.id)).read();
  assert.equal(saved.source, 'oral-extra');
  for (const [id,mark] of Object.entries(marks)) assert.deepEqual(saved.marks[id], mark);
  assert.deepEqual(saved.marks['oral-extra-01'], {status:'learned',starred:true});
});
