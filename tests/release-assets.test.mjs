import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {versionAsset} from '../scripts/release-assets.mjs';

test('HTML의 앱·통계·스타일 URL과 앱의 모든 모듈을 같은 배포 버전으로 연결한다', async () => {
  const revision='release-123';
  const html=versionAsset('index.html',await readFile(new URL('../public/index.html',import.meta.url)),revision).toString();
  for(const name of ['app.js','analytics.js','styles.css'])assert.ok(html.includes(`./${name}?v=${revision}`));
  const app=versionAsset('app.js',await readFile(new URL('../public/app.js',import.meta.url)),revision).toString();
  for(const name of ['model.js','persistence.js'])assert.ok(app.includes(`./${name}?v=${revision}`));
  assert.notEqual(versionAsset('index.html',Buffer.from('<script src="./app.js"></script>'),'old').toString(),versionAsset('index.html',Buffer.from('<script src="./app.js"></script>'),'new').toString());
});

test('문항·PDF·외부 URL과 학습 저장 키는 버전 처리로 변경하지 않는다', async () => {
  const bytes=Buffer.from('{"questions":[]}');
  assert.equal(versionAsset('questions.json',bytes,'release'),bytes);
  const html=Buffer.from('<script src="https://example.com/a.js"></script><a href="./sources/a.pdf">PDF</a>');
  assert.equal(versionAsset('index.html',html,'release').toString(),html.toString());
  const storage=await readFile(new URL('../public/persistence.js',import.meta.url));
  assert.equal(versionAsset('persistence.js',storage,'release').toString(),storage.toString());
});
