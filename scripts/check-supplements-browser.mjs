import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || `${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`);
const root=fileURLToPath(new URL('../',import.meta.url));
const url=process.env.BROWSER_TEST_URL || 'http://127.0.0.1:4182/';
const supplemental=JSON.parse(await readFile(`${root}public/supplemental.json`,'utf8'));
await mkdir(`${root}tmp/qa`,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[],passed=[],screenshots=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}});
context.on('page',page=>{
  page.on('pageerror',error=>errors.push(`${page.url()}: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
});
const ready=page=>page.waitForSelector('body[data-ready="true"]');
const id=page=>page.locator('body').getAttribute('data-current-id');
const position=page=>page.locator('#question-position').textContent();
async function settings(page){if(!await page.locator('.settings-panel').evaluate(element=>element.open))await page.locator('.settings-panel > summary').click();}
async function search(page,value){await settings(page);await page.locator('#search').fill(value);await page.locator('#open-library').click();await page.locator('#close-library').click();}
async function shot(page,name,fullPage=true){const file=`${root}tmp/qa/${name}.png`;await page.screenshot({path:file,fullPage});screenshots.push(file);}
try{
  await context.addInitScript(()=>{
    if(!['http:','https:'].includes(location.protocol))return;
    if(!localStorage.getItem('qa-seeded')){
      localStorage.setItem('rail-note-study-v1',JSON.stringify({source:'textbook',order:'sequential',duration:0,marks:{'textbook-13':{status:'learned',starred:true}}}));
      localStorage.setItem('qa-seeded','true');
    }
  });
  const page=await context.newPage();await page.clock.install();await page.goto(url);await ready(page);
  assert.equal(await page.locator('#kind').inputValue(),'all');
  assert.equal(await page.locator('#learned-count').textContent(),'1 / 241');
  await page.locator('#kind').selectOption('original');
  assert.equal(await page.locator('#learned-count').textContent(),'1 / 172');
  await page.locator('#kind').selectOption('reference');
  assert.match(await position(page),/\/ 46 /);
  await search(page,'MCB란');
  assert.equal(await id(page),'reference-textbook-13-1-1');
  assert.equal(await page.locator('#question-image').isVisible(),false);
  assert.equal(await page.locator('#answer-section').isVisible(),false);
  await page.locator('#reveal').click();
  assert.match(await page.locator('#answer').textContent(),/교류 구간에서 특고압/);
  await page.locator('#open-source').click();
  assert.match(await page.locator('#pdf-link').getAttribute('href'),/#page=7$/);
  await page.locator('#close-source').click();
  await page.locator('#mark-review').click();
  await page.reload();await ready(page);
  assert.equal(await page.locator('#kind').inputValue(),'reference');
  assert.equal(await page.locator('#review-count').textContent(),'다시 보기 1');
  await page.locator('#scope').selectOption('review');
  assert.equal(await id(page),'reference-textbook-13-1-1');
  await page.locator('#scope').selectOption('all');
  await page.locator('#kind').selectOption('original');
  assert.equal(await page.locator('#learned-count').textContent(),'1 / 172');
  await search(page,'전체 MCB 투입 불능');
  assert.equal(await id(page),'textbook-13');
  assert.equal(await page.locator('#star').getAttribute('aria-pressed'),'true');
  passed.push('기존 기록 마이그레이션 · MCB 독립 문제 · 정확한 7쪽 출처 · 추가 기록 저장 · 기존 암기/별표 유지');

  await search(page,'');await page.locator('#kind').selectOption('scenario');
  const seen=new Set();
  for(let i=0;i<7;i++){
    const currentId=await id(page), question=supplemental.questions.find(q=>q.id===currentId);
    assert.ok(!seen.has(currentId));seen.add(currentId);
    assert.equal(question.kind,'scenario');
    assert.equal(await page.locator('#answer-section').isVisible(),false);
    await page.locator('#reveal').click();
    assert.equal(await page.locator('#answer').textContent(),question.answer);
    await page.locator('#open-source').click();
    assert.match(await page.locator('#pdf-link').getAttribute('href'),new RegExp(`#page=${question.page}$`));
    await page.locator('#close-source').click();
    await page.locator('#next').click();
  }
  assert.equal(seen.size,7);
  assert.equal(await page.locator('#cycle-label').textContent(),'2회차');
  passed.push('교-교 4 · 교-직 3 상황 실제 순회 · 각 조건/현상/조치 대조 · 정확한 원문 페이지');

  await page.locator('#kind').selectOption('sign');
  const signs=supplemental.questions.filter(q=>q.kind==='sign');
  for(const question of signs){
    assert.equal(await id(page),question.id);
    await page.waitForFunction(()=>document.querySelector('#sign-image').naturalWidth>0);
    assert.equal(await page.locator('#question-image').isVisible(),true);
    assert.equal(await page.locator('#answer-section').isVisible(),false);
    assert.equal(await page.locator('#visual-reference').isVisible(),false);
    assert.equal(await page.locator('#sign-image').getAttribute('alt'),'문제로 제시된 철도 표지 그림');
    assert.ok(!(await page.locator('#question').textContent()).includes(question.signName));
    const visible=await page.locator('body').innerText();
    assert.ok(!visible.includes(question.signName),`${question.id}: 정답 선공개`);
    const accessibility=await page.locator('.question-card').ariaSnapshot();
    assert.ok(!accessibility.includes(question.signName),`${question.id}: 접근성 정답 선공개`);
    await page.locator('#reveal').click();
    assert.equal(await page.locator('#answer').textContent(),question.answer);
    assert.equal(await page.locator('#sign-image').evaluate(image=>image.naturalWidth),question.crop.width*2);
    await page.locator('#next').click();
  }
  await page.locator('#duration').selectOption('30');
  await page.clock.fastForward(31_000);
  assert.equal(await page.locator('#timer').textContent(),'0');
  assert.equal(await page.locator('#answer-section').isVisible(),true);
  assert.equal(await page.locator('#question-image').isVisible(),true);
  await page.locator('#next').click();
  assert.equal(await page.locator('#answer-section').isVisible(),false);
  assert.equal(await page.locator('#timer').textContent(),'30');
  await page.locator('#duration').selectOption('0');
  passed.push('표지 16개 실제 그림 로드 · 화면/접근성 정답 숨김 · 명칭/설명 대조 · 시간 종료 자동 공개 · 다음 문제 재시작');

  await page.locator('#kind').selectOption('reference');
  await search(page,'제동축 비율의 뜻');
  await page.locator('#reveal').click();
  assert.equal(await page.locator('#answer-note').isVisible(),true);
  await page.locator('#visual-reference summary').click();
  await page.waitForFunction(()=>document.querySelector('#visual-pages img').naturalWidth>0);
  assert.equal(await page.locator('#visual-pages img').count(),1);
  assert.match(await page.locator('#visual-pages img').getAttribute('src'),/textbook-12\.png$/);
  await page.locator('[data-source="oral"]').click();
  assert.equal(await page.locator('#empty-state').isVisible(),true);
  assert.equal(await page.locator('#next').isDisabled(),true);
  await page.locator('#show-all').click();
  assert.equal(await page.locator('#kind').inputValue(),'all');
  assert.equal(await page.locator('#empty-state').isVisible(),false);
  passed.push('속도표 원문 12쪽 제공 · 자료/유형 조합 빈 범위 · 전체 복귀');

  await page.locator('#kind').selectOption('all');
  await page.locator('#order').selectOption('shuffle');
  assert.equal(await page.locator('[data-count="all"]').textContent(),'241');
  const mixed=new Set();
  for(let i=0;i<241;i++){const currentId=await id(page);assert.ok(!mixed.has(currentId),`혼합 중복 ${currentId}`);mixed.add(currentId);await page.locator('#next').click();}
  assert.equal(mixed.size,241);
  assert.equal(await page.locator('#cycle-label').textContent(),'2회차');
  assert.equal(await page.locator('#learned-count').textContent(),'1 / 241');
  passed.push('전체 241문항 실제 랜덤 순회 중복/누락 없음 · 혼합 진도 표시');

  const layouts=[];
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:width<640?844:1000});
    await page.reload();await ready(page);
    if(width<=640)await page.locator('.settings-panel > summary').click();
    await page.locator('#order').selectOption('sequential');
    for(const kind of ['reference','scenario','sign']){
      await settings(page);
      await page.locator('#kind').selectOption(kind);
      if(kind==='reference')await search(page,'MCB란');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      assert.equal(overflow,false,`${width}/${kind} 문제 가로 넘침`);
      await settings(page);
      await page.locator('#open-library').click();
      assert.equal(await page.locator('#library-dialog').evaluate(element=>element.scrollWidth>element.clientWidth),false);
      await page.locator('.library-item').first().click();
      if(width<=640)await page.locator('.settings-panel > summary').click();
      await page.evaluate(()=>window.scrollTo(0,0));
      if(kind==='sign')await page.waitForFunction(()=>document.querySelector('#sign-image').naturalWidth>0);
      await shot(page,`${kind}-${width}`,false);
      await page.locator('#reveal').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(width<=640){
        assert.ok(await page.locator('#answer').evaluate(element=>parseFloat(getComputedStyle(element).fontSize))>=16);
        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
        const next=await page.locator('#next').boundingBox();
        assert.ok(next.height>=44 && next.y>=0 && next.y+next.height<=844);
        await page.locator('#next').click();
        assert.equal(await page.locator('#answer-section').isVisible(),false);
        assert.ok(await page.locator('.question-card').evaluate(element=>element.getBoundingClientRect().top)>=-1);
        await page.locator('.settings-panel > summary').click();
      }
      await search(page,'');
      layouts.push({width,kind,overflow});
    }
  }
  passed.push('모든 추가 유형 320/390/1440px · 문제/답안/문항 목록 가로 넘침 없음 · 고정 이동/타이머 숨김 초기화');

  const contact=await context.newPage();await contact.setViewportSize({width:800,height:1100});
  await contact.setContent(`<html lang="ko"><style>body{font:14px sans-serif;margin:20px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;padding:12px;border:1px solid #ddd;text-align:center}img{width:140px;height:140px;object-fit:contain}figcaption{height:40px;line-height:20px}</style><main>${signs.map(q=>`<figure><img src="${new URL(q.image,url)}"><figcaption>${q.number}<br>${q.signName}</figcaption></figure>`).join('')}</main></html>`);
  await contact.waitForFunction(()=>Array.from(document.images).every(image=>image.complete && image.naturalWidth>0));
  await shot(contact,'sign-contact-sheet');
  assert.deepEqual(errors,[]);
  const report={status:'PASS',url,passed,layouts,screenshots,errors};
  await writeFile(`${root}tmp/qa/supplements-browser-report.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
