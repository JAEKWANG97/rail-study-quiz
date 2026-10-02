import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const pdf = `${root}public/sources/technical-textbook.pdf`;
const original = JSON.parse(await readFile(`${root}public/questions.json`, 'utf8'));
const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], {encoding:'utf8'}).split('\f');
const normalize = value => value.normalize('NFC').replace(/\s/g, '');
const questions = [], referenceBlocks = [];
const titles = {
  4:'구원 운전 관련 참고사항은?', 5:'완전 부동 취급이 필요한 기타 경우는?',
  7:'완전 부동 취급 후 연장 급전하면 어떤 현상이 나타나는가?',
  9:'VCOS 취급 후 현상 및 조치는?', 11:'Pan의 상승 시간과 하강 시간은?',
  12:'PanV 전후의 Cock 차단 위치에 따른 MCB 상태는?',
  18:'BVN1 복귀 불능 시 EBCOS를 취급하면 어떤 현상이 나타나는가?',
  19:['EBCOS 투입으로 비상제동이 완해되는 경우는?', 'EBCOS 취급 시 보안장치 및 열차 분리와 관련한 주의사항은?'],
  20:'차량 간 주 공기 누설 시 조치는?', 22:'PBPS 또는 MRPS의 작동 압력은?',
  23:'주차제동 완해 시 BC 전체 완해 Cock를 차단하는 이유는?',
  25:'보안제동이 체결되지 않는 경우의 조치는?', 27:'SIV의 전압별 전원 공급처는?',
  28:'ATS·ATC 구간의 폐색구간 점유 기준은?',
  29:'산본역 상선·금정역 하선에서 후부가 맨 바깥쪽 선로전환기를 통과한 후의 운전 취급은?',
  35:'교류 모진(DCArr 방전)을 확인하는 방법은?', 37:'EPanDS를 취급해야 하는 시기는?',
  43:'기관사 안전장치(DSD)의 경고 시간과 미복귀 시 동작은?',
  55:'ATC 장치 고장 시 취급은?', 76:'무선전화기를 이용한 방호 방법은?'
};
const subtopics = {
  10:['연장 급전 여부를 확인하는 방법은?', 'IVCN을 차단하면 모니터에 표시되는 내용은?', '연장 급전 시 고장차의 IVCN을 차단하는 이유는?'],
  13:['MCB란? 교류·직류 구간에서의 역할은?', 'MCB가 사고 차단되는 경우는?'],
  15:['1칸 동력 운전 불능 시 확인할 차단기와 CN1·CN2·CN3의 역할은?', 'POWER 및 MCB ON·OFF등이 모두 소등될 때 확인할 사항은?'],
  24:['BC 전체 완해 Cock 차단 후에도 완해 불능이면 어떻게 조치하는가?', '1개 차량에 있는 BC 관련 Cock의 구성은?', '제동 불완해 시 CpRS 취급 차량에서 가능한 제동과 불가능한 제동은?', '제동축 비율의 뜻과 비율별 적용 속도는?'],
  30:['Pan 하강·제동 핸들 취거 후 EOCN을 ON 취급하면 어떤 현상이 나타나는가?', '단전 후 급전 시 MCBOS-MCBCS를 취급하는 이유는?', '운행 중 단전 시 기관사의 조치는?'],
  36:['절연 구간에서 MCB가 양 소등되는 경우는?', '직류 모진이란?', '직류 모진 시 현상과 조치는?', '주 퓨즈 용단 시 현상과 복귀 회로는?'],
  53:['출입문 스위치(DS)의 기계적 접점과 각각의 동작 조건은?', '출입문 공기압과 출입문 관련 Cock의 구성은?', '교재에 기재된 출입문 재개폐 스위치(DROS)의 참고사항은?'],
  68:['Pick Up Coil의 역할은?', '속도발전기의 역할은?', 'ATC Rack의 역할은?', 'ADU의 역할은?']
};
function locate(parent, line, fallback) {
  for (const page of parent.pageNumbers) if (normalize(pages[page - 1]).includes(normalize(line))) return page;
  return fallback;
}
function card(parent, fields) {
  const lines = fields.answer.split('\n').filter(line => line.trim());
  const first = lines[0].startsWith('[참고') ? lines[1] : lines[0];
  const page = fields.page ?? locate(parent, first, parent.page);
  const endPage = Math.max(page, fields.endPage ?? locate(parent, lines.at(-1), parent.endPage));
  questions.push({source:parent.source, parentId:parent.id, originalNumber:parent.number,
    page, endPage, pageNumbers:Array.from({length:endPage - page + 1}, (_, i) => page + i),
    imagePages:[], answerKind:'text', duplicateNumber:false, ...fields});
}
for (const parent of original.questions.filter(q => q.source === 'textbook')) {
  const number = Number(parent.id.split('-')[1]);
  const matches = [...parent.answer.matchAll(/^\[참고[^\]]*\].*$/gm)];
  for (const [index, match] of matches.entries()) {
    const block = parent.answer.slice(match.index, matches[index + 1]?.index).trim();
    const body = block.slice(block.indexOf('\n') + 1).trim();
    const blockId = `reference-${parent.id}-${index + 1}`;
    const members = [];
    if (subtopics[number]) {
      const items = [...body.matchAll(/^\d+\.\s*/gm)];
      assert.equal(items.length, subtopics[number].length, `${parent.id}: 참고사항 항목 수`);
      for (const [i, item] of items.entries()) {
        const answer = body.slice(item.index, items[i + 1]?.index).trim(), id = `${blockId}-${i + 1}`;
        card(parent, {id, kind:'reference', referenceBlock:blockId, number:`참고 ${parent.number}-${i + 1}`, question:subtopics[number][i], answer,
          ...(number === 24 && i === 3 ? {imagePages:[12], answerNote:'속도표의 열 배치는 아래 원문 그림·표에서 확인해 주세요.'} : {})});
        members.push(id);
      }
    } else {
      assert.ok(titles[number], `${parent.id}: 질문 제목 누락`);
      const question = Array.isArray(titles[number]) ? titles[number][index] : titles[number];
      card(parent, {id:blockId, kind:'reference', referenceBlock:blockId, number:`참고 ${parent.number}${matches.length > 1 ? `-${index + 1}` : ''}`, question, answer:block});
      members.push(blockId);
    }
    referenceBlocks.push({id:blockId, parentId:parent.id, text:block, members});
  }
}
for (const number of [64, 65]) {
  const parent = original.questions.find(q => q.id === `textbook-${number}`);
  const items = [...parent.answer.matchAll(/^\d\)\s+(.+)$/gm)];
  assert.equal(items.length, number === 64 ? 4 : 3);
  for (const [i, item] of items.entries()) card(parent, {id:`scenario-${parent.id}-${i + 1}`, kind:'scenario', number:`상황 ${parent.number}-${i + 1}`,
    question:`${number === 64 ? '교-교' : '교-직'} 절연 구간 · ${item[1]} 시 현상과 조치는?`, answer:parent.answer.slice(item.index, items[i + 1]?.index).trim()});
}
// Extract original shapes only. Names and descriptions are outside these crops.
const names = ['교-직 절연 구간 표지','타행 표지','절연 구간 예고 표지','교-교 절연 구간 표지','전기동차용 역행 표지','열차 정지 표지','차량 정지 표지','차량 접촉 한계 표지','차막이 표지','전차선 구분 표지','가선 종단 표지','장내 경계 표지','출발 경계 표지','폐색 경계표지','폐색신호기 식별 표지','전차선로 작업 표지'];
const rowEdges = {33:[330,440,552,664,775,887,999,1111,1223], 34:[268,387,507,627,746,866,986,1106,1225]};
await mkdir(`${root}public/signs`, {recursive:true});
const parent = original.questions.find(q => q.id === 'textbook-82');
const scale = 144 * 841.89 / 72 / 1400;
for (const [index, name] of names.entries()) {
  const page = index < 8 ? 33 : 34, row = index % 8;
  const [top, bottom] = rowEdges[page].slice(row, row + 2);
  const image = `signs/sign-${String(index + 1).padStart(2, '0')}.png`;
  const x = page === 33 ? 210 : 195, width = page === 33 ? 118 : 103;
  execFileSync('pdftoppm', ['-f',String(page),'-l',String(page),'-scale-to','2800','-x',String(x * 2),'-y',String((top + 7) * 2),'-W',String(width * 2),'-H',String((bottom - top - 14) * 2),'-singlefile','-png',pdf,`${root}public/${image.slice(0, -4)}`]);
  const description = execFileSync('pdftotext', ['-f',String(page),'-l',String(page),'-r','144','-x',String(Math.round((page === 33 ? 490 : 464) * scale)),'-y',String(Math.round((top + 3) * scale)),'-W',String(Math.round((page === 33 ? 367 : 368) * scale)),'-H',String(Math.round((bottom - top - 6) * scale)),'-layout',pdf,'-'], {encoding:'utf8'}).replace(/\f/g,'').split('\n').map(line=>line.trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();
  assert.ok(description.startsWith('-'), `${name}: 설명 추출 실패`);
  card(parent, {id:`sign-textbook-82-${index + 1}`, kind:'sign', number:`표지 ${String(index + 1).padStart(2,'0')}`, question:'이 표지의 명칭과 의미를 설명하세요.', answer:`${name}\n\n${description}`, signName:name, image, page, endPage:page, imagePages:[page],
    crop:{page, x, y:top + 7, width, height:bottom - top - 14, scaleTo:1400}, sourceDescription:description});
}
const counts = Object.fromEntries(['reference','scenario','sign'].map(kind=>[kind, questions.filter(q=>q.kind === kind).length]));
assert.equal(referenceBlocks.length, 29);
assert.equal(new Set([...original.questions, ...questions].map(q=>q.id)).size, original.questions.length + questions.length);
await writeFile(`${root}public/supplemental.json`, JSON.stringify({version:1, counts, referenceBlocks, questions}, null, 2) + '\n');
console.log(JSON.stringify({original:original.questions.length, ...counts, total:original.questions.length + questions.length}));
