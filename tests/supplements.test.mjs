import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {filterQuestions, makeDeck} from '../public/model.js';
import {StudyStorage, storageKey} from '../public/persistence.js';

const root = new URL('../', import.meta.url);
const bytes = await readFile(new URL('public/questions.json', root));
const original = JSON.parse(bytes);
const supplemental = JSON.parse(await readFile(new URL('public/supplemental.json', root), 'utf8'));
const all = [...original.questions, ...supplemental.questions];
const byId = new Map(all.map(q=>[q.id,q]));
const normalize = value => value.replace(/\s/g,'');

test('기존 172문항 데이터는 바이트 단위로 보존하고 추가 ID만 사용한다', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '82ce00aa4057e6a1223c46a761dff754fa09d49d9ca4e13645fa24f76698a186');
  assert.equal(all.length, 241);
  assert.equal(byId.size, all.length);
  assert.deepEqual(supplemental.counts, {reference:46,scenario:7,sign:16});
  for (const q of supplemental.questions) {
    const parent = byId.get(q.parentId);
    assert.equal(q.source, parent.source);
    assert.equal(q.originalNumber, parent.number);
    assert.ok(q.page >= parent.page && q.endPage <= parent.endPage);
    assert.deepEqual(q.pageNumbers, Array.from({length:q.endPage-q.page+1},(_,i)=>q.page+i));
    assert.ok(q.question && q.answer);
  }
});

test('참고 29개 묶음의 본문을 빠짐없이 46개의 원문 답안으로 출제한다', () => {
  const expected = original.questions.flatMap(parent => [...parent.answer.matchAll(/^\[참고[^\]]*\].*$/gm)].map((match,index,matches)=>({parentId:parent.id,text:parent.answer.slice(match.index,matches[index+1]?.index).trim()})));
  assert.equal(expected.length,29);
  assert.deepEqual(supplemental.referenceBlocks.map(({parentId,text})=>({parentId,text})),expected);
  const members = [];
  for (const block of supplemental.referenceBlocks) {
    const cards = block.members.map(id=>byId.get(id));
    members.push(...block.members);
    for (const q of cards) assert.ok(byId.get(q.parentId).answer.includes(q.answer));
    const combined = normalize(cards.map(q=>q.answer).join('\n'));
    const body = block.text.slice(block.text.indexOf('\n')+1);
    assert.ok(combined === normalize(block.text) || combined === normalize(body), `${block.id}: 본문 누락`);
  }
  assert.equal(new Set(members).size,46);
  const mcb = byId.get('reference-textbook-13-1-1');
  assert.match(mcb.question,/MCB란/);
  assert.match(mcb.answer,/직류 구간에서는 특고압 회로의 개폐 작용만/);
  assert.equal(mcb.page,7);
  const speed = byId.get('reference-textbook-24-1-4');
  assert.deepEqual(speed.imagePages,[12]);
  assert.ok(speed.answerNote);
});

test('교-교 4상황과 교-직 3상황에 원문 조건·현상·조치 전체를 보존한다', () => {
  for (const [id,count] of [['textbook-64',4],['textbook-65',3]]) {
    const cards = supplemental.questions.filter(q=>q.kind==='scenario' && q.parentId===id);
    assert.equal(cards.length,count);
    assert.equal(normalize(cards.map(q=>q.answer).join('\n')),normalize(byId.get(id).answer));
    for (const q of cards) { assert.match(q.answer,/① 현상/); assert.match(q.answer,/② 조치/); }
  }
  assert.match(byId.get('scenario-textbook-64-1').answer,/관제사 퇴행 운전 승인/);
  assert.match(byId.get('scenario-textbook-65-1').answer,/15km\/h 이하/);
});

test('16개 표지에 명칭 없는 문제 그림과 원문 설명·출처를 연결한다', async () => {
  const cards = supplemental.questions.filter(q=>q.kind==='sign');
  assert.equal(cards.length,16);
  assert.equal(new Set(cards.map(q=>q.image)).size,16);
  const paragraphCounts = [2,2,1,2,2,2,2,2,2,2,2,1,1,1,1,2];
  for (const [index,q] of cards.entries()) {
    assert.equal(q.page,index<8?33:34);
    assert.equal(q.question,'이 표지의 명칭과 의미를 설명하세요.');
    assert.ok(!q.question.includes(q.signName));
    assert.equal(q.answer,`${q.signName}\n\n${q.sourceDescription}`);
    assert.equal(q.sourceDescription.split('\n').filter(line=>line.startsWith('-')).length,paragraphCounts[index]);
    // Layout extraction interleaves the name column; description characters must remain an ordered subsequence.
    let cursor=0; const source=normalize(byId.get(q.parentId).answer);
    for(const character of normalize(q.sourceDescription)) {cursor=source.indexOf(character,cursor);assert.ok(cursor>=0,`${q.id}: 원문 설명 일치`);cursor++;}
    const png=await readFile(new URL(`public/${q.image}`,root));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),q.crop.width*2);
    assert.equal(png.readUInt32BE(20),q.crop.height*2);
    assert.ok(q.crop.x+q.crop.width < (q.page===33?339:316));
  }
});

test('출제유형 필터 없이 교재·검색·학습 필터를 결합하고 전체 문항을 순회한다', () => {
  for (const kind of ['original','reference','scenario','sign','all']) {
    assert.equal(filterQuestions(all,{kind}).length,240,'이전 유형 설정은 출제를 제한하지 않는다');
  }
  assert.equal(filterQuestions(all,{source:'oral'}).length,90);
  assert.equal(filterQuestions(all,{source:'textbook'}).length,150);
  assert.ok(filterQuestions(all,{query:'6.64'}).some(q=>q.kind==='scenario'));
  assert.ok(filterQuestions(all,{query:'타행'}).some(q=>q.kind==='sign'));
  assert.equal(filterQuestions(all,{scope:'starred'},{'reference-textbook-13-1-1':{starred:true}}).length,1);
  const deck=makeDeck(all);
  assert.equal(new Set(deck).size,240);
});

test('각종 표지 묶음만 출제·검색·복습에서 제외하고 이미지 표지16개와 기록은 유지한다', () => {
  const marks={'textbook-82':{status:'learned',starred:true}};
  assert.ok(byId.has('textbook-82'),'원문 데이터는 보존');
  assert.ok(!makeDeck(all).includes('textbook-82'));
  assert.equal(filterQuestions(all,{query:'각종 표지'}).some(q=>q.id==='textbook-82'),false);
  assert.equal(filterQuestions(all,{scope:'starred'},marks).length,0);
  const signs=filterQuestions(all,{}).filter(q=>q.kind==='sign');
  assert.equal(signs.length,16);
  assert.ok(signs.every(q=>q.image && q.parentId==='textbook-82'));
  const values=new Map([[storageKey,JSON.stringify({marks})]]);
  const store=new StudyStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},byId.keys());
  store.saveSettings({duration:30});
  assert.deepEqual(store.read().marks['textbook-82'],marks['textbook-82']);
});

test('기존 단일 키와 문항별 학습 기록을 추가 문항 도입 후에도 보존한다', () => {
  const values=new Map([[storageKey,JSON.stringify({source:'textbook',duration:90,marks:{'textbook-13':{status:'learned',starred:true}}})]]);
  const adapter={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const store=new StudyStorage(adapter,byId.keys());
  assert.equal(store.read().marks['textbook-13'].status,'learned');
  store.saveSettings({kind:'reference'});
  store.saveMark('reference-textbook-13-1-1',{status:'review'});
  const restored=new StudyStorage(adapter,byId.keys()).read();
  assert.equal(restored.marks['textbook-13'].status,'learned');
  assert.equal(restored.marks['textbook-13'].starred,true);
  assert.equal(restored.marks['reference-textbook-13-1-1'].status,'review');
  assert.equal(restored.duration,90);
  assert.equal(restored.kind,'reference');
});
