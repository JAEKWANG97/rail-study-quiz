import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const id = 'oral-extra';
const filename = 'oral-extra.pdf';
const pdf = `${root}public/sources/${filename}`;
const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], {encoding:'utf8'}).split('\f').filter(page => page.trim());
assert.equal(pages.length, 9, '추가 PDF 페이지가 바뀌면 문항 경계도 재검토해야 합니다.');
const questions = [];
let current;
for (const [index, page] of pages.entries()) {
  for (const raw of page.split('\n')) {
    const text = raw.trim();
    if (!text || /^신규구술(?:\s+\d+)?$/.test(text)) continue;
    const indent = raw.length - raw.trimStart().length;
    if (indent === 7) {
      // The long evacuation heading wraps mid-word before its first answer.
      if (current && current.lines.length === 0) current.question += text;
      else {
        const number = String(questions.length + 1).padStart(2, '0');
        current = {id:`${id}-${number}`, source:id, number, question:text, page:index+1, endPage:index+1, lines:[]};
        questions.push(current);
      }
    } else {
      assert.ok(current && indent >= 9, `분류할 수 없는 본문: ${index+1}쪽 ${text}`);
      current.lines.push(raw.slice(9).trimEnd());
    }
    current.endPage = index + 1;
  }
}
assert.equal(questions.length, 50, '상위 항목 50개를 각각 한 문항으로 유지합니다.');
for (const question of questions) {
  question.answer = question.lines.join('\n').trim();
  delete question.lines;
  assert.ok(question.answer, `${question.id}: 빈 답안`);
  question.pageNumbers = Array.from({length:question.endPage-question.page+1}, (_, index) => question.page+index);
  question.imagePages = [];
  question.answerKind = 'text';
  question.duplicateNumber = false;
}
const source = {id, name:'신규 구술', filename, pageCount:pages.length, count:questions.length, sha256:createHash('sha256').update(await readFile(pdf)).digest('hex')};
await writeFile(`${root}public/oral-extra.json`, JSON.stringify({version:1, sources:[source], questions}, null, 2)+'\n');
await mkdir(`${root}public/page-previews`, {recursive:true});
for (let page = 1; page <= pages.length; page++) {
  execFileSync('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', '1400', '-png', pdf, `${root}public/page-previews/${id}-${String(page).padStart(2, '0')}`]);
}
console.log(JSON.stringify({source, crossPage:questions.filter(q => q.page !== q.endPage).map(q => ({id:q.id, pages:q.pageNumbers}))}, null, 2));
