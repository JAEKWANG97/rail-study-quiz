import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(`${root}dist`, {recursive: true});
await cp(`${root}public`, `${root}dist`, {recursive: true});
let revision = process.env.GITHUB_SHA || 'local';
if (revision === 'local') {
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); } catch {}
}
const {questions} = JSON.parse(await readFile(`${root}public/questions.json`, 'utf8'));
const supplemental = JSON.parse(await readFile(`${root}public/supplemental.json`, 'utf8'));
await writeFile(`${root}dist/version.json`, JSON.stringify({revision, questionCount: questions.length + supplemental.questions.length, counts:{original:questions.length, ...supplemental.counts}}, null, 2) + '\n');
console.log('정적 사이트 빌드 완료: dist/');
