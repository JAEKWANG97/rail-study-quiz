import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { versionAsset } from './release-assets.mjs';
import { isStudyQuestion } from '../public/model.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = process.env.DEPLOYMENT_URL || 'https://jaekwang97.github.io/rail-study-quiz/';
const revision = process.env.EXPECTED_REVISION || execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8'}).trim();
const versionResponse = await fetch(new URL(`version.json?v=${revision}`, site));
assert.equal(versionResponse.status, 200, '배포 버전 파일 HTTP 상태');
const version = await versionResponse.json();
assert.equal(version.revision, revision, '배포본과 로컬 커밋 일치');
const original = JSON.parse(await readFile(`${root}public/questions.json`, 'utf8'));
const supplemental = JSON.parse(await readFile(`${root}public/supplemental.json`, 'utf8'));
const activeOriginal = original.questions.filter(isStudyQuestion);
assert.equal(version.questionCount, activeOriginal.length + supplemental.questions.length);
assert.equal(version.archivedQuestionCount,1);
assert.deepEqual(version.counts, {original:activeOriginal.length, ...supplemental.counts});
const files = [];
async function collect(directory = '') {
  for (const entry of await readdir(`${root}public/${directory}`, {withFileTypes:true})) {
    const relative = `${directory}${entry.name}`;
    if (entry.isDirectory()) await collect(`${relative}/`);
    else if (entry.isFile()) files.push(relative);
  }
}
await collect();
let cursor = 0;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await Promise.all(Array.from({length:6}, async () => {
  while (cursor < files.length) {
    const file = files[cursor++];
    const response = await fetch(new URL(`${file}?v=${revision}`, site));
    assert.equal(response.status, 200, `${file}: HTTP 상태`);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())), sha(versionAsset(file, await readFile(`${root}public/${file}`), revision)), `${file}: 배포 파일 해시`);
  }
}));
console.log(JSON.stringify({status:'PASS',site,revision,questionCount:version.questionCount,verifiedAssets:files.length,pages:files.filter(file=>file.startsWith('page-previews/')).length,pdfs:files.filter(file=>file.endsWith('.pdf')).length},null,2));
