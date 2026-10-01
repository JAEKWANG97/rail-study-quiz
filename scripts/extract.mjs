import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = [
  { id: 'textbook', name: '기능교재', filename: 'technical-textbook.pdf', pages: 34, text: 'textbook.txt', pattern: /^(6\.\d+)\s+(.+)$/ },
  { id: 'oral', name: '신규 구술 문답서', filename: 'oral-questions.pdf', pages: 11, text: 'oral.txt', pattern: /^(\d{3})[.,]\s*(.+)$/ }
];

function isDecoration(line, source) {
  if (source === 'oral') return /예상문답서(?:\.hwp)?$/.test(line) || /^\d+\s+-\s*\d+\s*-$/.test(line);
  return /^(기능\s*교재|이례 사항 시 조치 및 운전 방법\(구술\)|6장|이례 사항 시|조치 및 운전 방법\(구술\))$/.test(line)
    || /^[·ㆍ]?6-\d+[·ㆍ]?$/.test(line);
}

const questions = [];
const summaries = [];
for (const source of sources) {
  const text = await readFile(path.join(root, 'tmp/pdfs', source.text), 'utf8');
  const imageInfo = execFileSync('pdfimages', ['-list', path.join(root, 'public/sources', source.filename)], {encoding: 'utf8'});
  const imagePages = new Set(imageInfo.split('\n').map(line => line.match(/^\s*(\d+)\s+\d+\s+image\s/)).filter(Boolean).map(match => Number(match[1])));
  const entries = [];
  let current = null;
  const pages = text.split('\f');
  pages.forEach((page, index) => {
    for (const raw of page.split('\n')) {
      const line = raw.trim();
      if (isDecoration(line, source.id)) continue;
      const match = line.match(source.pattern);
      if (match) {
        current = {id: `${source.id}-${entries.length + 1}`, source: source.id, number: match[1], question: match[2], page: index + 1, endPage: index + 1, lines: []};
        entries.push(current);
      } else if (current) {
        current.lines.push(line);
        if (line) current.endPage = index + 1;
      }
    }
  });
  const numberCounts = new Map();
  for (const entry of entries) numberCounts.set(entry.number, (numberCounts.get(entry.number) || 0) + 1);
  for (const entry of entries) {
    entry.answer = entry.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    delete entry.lines;
    entry.pageNumbers = Array.from({length: entry.endPage - entry.page + 1}, (_, index) => entry.page + index);
    entry.imagePages = entry.pageNumbers.filter(page => imagePages.has(page));
    entry.answerKind = entry.answer ? 'text' : entry.imagePages.length ? 'image' : 'missing';
    entry.duplicateNumber = numberCounts.get(entry.number) > 1;
    questions.push(entry);
  }
  const pdfBytes = await readFile(path.join(root, 'public/sources', source.filename));
  summaries.push({id: source.id, name: source.name, filename: source.filename, pageCount: source.pages, count: entries.length, sha256: createHash('sha256').update(pdfBytes).digest('hex')});
}

const data = {version: 1, sources: summaries, questions};
await writeFile(path.join(root, 'public/questions.json'), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({sources: summaries, total: questions.length, missing: questions.filter(question => question.answerKind === 'missing').map(({id,number,question,page}) => ({id,number,question,page})), duplicateNumbers: questions.filter(question => question.duplicateNumber).map(({id,number})=>({id,number}))}, null, 2));
