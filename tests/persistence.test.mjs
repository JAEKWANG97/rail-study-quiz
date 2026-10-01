import test from 'node:test';
import assert from 'node:assert/strict';
import { StudyStorage, storageKey } from '../public/persistence.js';

function fixture() {
  const values = new Map();
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  const ids = ['textbook-1', 'textbook-2'];
  return {storage, a: new StudyStorage(storage, ids), b: new StudyStorage(storage, ids)};
}

test('여러 탭의 다른 문항 표시와 설정 저장이 기록을 덮어쓰지 않는다', () => {
  const {a,b} = fixture();
  a.read(); b.read();
  a.saveMark('textbook-1', {status: 'learned'});
  b.saveMark('textbook-2', {status: 'review'});
  b.saveSettings({source: 'oral'});
  assert.equal(a.read().marks['textbook-1'].status, 'learned');
  assert.equal(a.read().marks['textbook-2'].status, 'review');
});

test('같은 문항의 암기 표시와 별표는 서로 독립적으로 저장된다', () => {
  const {a,b} = fixture();
  a.read(); b.read();
  a.saveMark('textbook-1', {status: 'learned'});
  b.saveMark('textbook-1', {starred: true});
  assert.deepEqual(a.read().marks['textbook-1'], {status: 'learned', starred: true});
  a.saveMark('textbook-1', {status: 'none'});
  b.saveMark('textbook-1', {starred: false});
  assert.deepEqual(a.read().marks['textbook-1'], {status: 'none', starred: false});
});

test('기존 단일 키의 기록을 보존하고 변경한 필드만 덮어쓴다', () => {
  const {storage,a} = fixture();
  storage.setItem(storageKey, JSON.stringify({duration:90, marks:{'textbook-1':{status:'learned',starred:true}, unknown:{status:'review'}}}));
  a.saveSettings({source:'textbook'});
  a.saveMark('textbook-1', {status:'review'});
  const saved = a.read();
  assert.equal(saved.duration,90);
  assert.deepEqual(saved.marks['textbook-1'],{status:'review',starred:true});
  assert.equal(saved.marks.unknown,undefined);
});

test('잘못된 문항/표시는 저장하지 않고 저장소 실패를 호출자에게 전달한다', () => {
  const {a} = fixture();
  assert.throws(()=>a.saveMark('unknown',{status:'learned'}));
  assert.throws(()=>a.saveMark('textbook-1',{status:'invalid'}));
  const blocked = new StudyStorage({getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}},['textbook-1']);
  assert.throws(()=>blocked.read(),/blocked/);
  assert.throws(()=>blocked.saveMark('textbook-1',{starred:true}),/quota/);
});

test('손상된 설정 JSON이 정상 문항 기록의 읽기와 저장을 막지 않는다', () => {
  const {storage,a} = fixture();
  storage.setItem(storageKey,'{broken');
  a.saveMark('textbook-1',{status:'learned',starred:true});
  assert.deepEqual(a.read().marks['textbook-1'],{status:'learned',starred:true});
  a.saveSettings({duration:90});
  assert.equal(JSON.parse(storage.getItem(storageKey)).duration,90);
  assert.equal(a.read().marks['textbook-1'].status,'learned');
});
