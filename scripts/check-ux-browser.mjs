import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || `${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`);
const root=fileURLToPath(new URL('../',import.meta.url));
const url=process.env.BROWSER_TEST_URL || 'http://127.0.0.1:4182/';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[],passed=[],layouts=[],analyticsRequests=[];
await mkdir(`${root}tmp/qa`,{recursive:true});
async function settings(page){if(!await page.locator('.settings-panel').evaluate(el=>el.open))await page.locator('.settings-panel > summary').click();}
async function ready(page){await page.waitForSelector('body[data-ready=true]');}
try{
  for(const width of [320,390,1440]){
    const height=width===1440?1000:844;
    const context=await browser.newContext({viewport:{width,height}});
    context.on('page',page=>{
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',request=>{if(request.url().includes('cloudflareinsights.com'))analyticsRequests.push(request.url());});
    });
    await context.addInitScript(()=>{
      if(!['http:','https:'].includes(location.protocol))return;
      if(!localStorage.getItem('ux-seeded')){
        localStorage.setItem('rail-note-study-v1',JSON.stringify({source:'all',kind:'original',order:'sequential',duration:0,marks:{'textbook-82':{status:'learned',starred:true}}}));
        localStorage.setItem('ux-seeded','true');
      }
    });
    const page=await context.newPage();await page.clock.install();await page.goto(url);await ready(page);
    assert.equal(await page.locator('#bank-count').textContent(),'현재 240문항');
    assert.equal(await page.locator('#kind, .type-picker, #type-label').count(),0);
    assert.equal(await page.locator('#progress-label').textContent(),'전체 문항 진도');
    if(width<=640)assert.equal(await page.locator('.settings-panel').evaluate(el=>el.open),false);
    await settings(page);
    assert.equal(await page.locator('.settings-panel').innerText().then(text=>text.includes('출제 유형')),false);
    await page.locator('#open-library').click();
    assert.equal(await page.locator('.library-item').count(),240);
    assert.equal(await page.locator('.library-item').filter({has:page.getByText('각종 표지',{exact:true})}).count(),0);
    await page.locator('.library-item').filter({has:page.getByText('표지 01',{exact:true})}).click();
    if(width<=640)await page.locator('#apply-settings').click();
    await page.waitForFunction(()=>document.querySelector('#sign-image').naturalWidth>0);
    await page.evaluate(()=>scrollTo(0,0));
    if(width<=640){
      for(const selector of ['#previous','#dock-reveal','#next']){
        const box=await page.locator(selector).boundingBox();
        assert.ok(box && box.width>=44 && box.height>=44 && box.x>=0 && box.x+box.width<=width && box.y>=0 && box.y+box.height<=height,selector);
      }
      assert.equal(await page.locator('.sign-question').evaluate(el=>getComputedStyle(el).paddingTop),'12px');
      await page.screenshot({path:`${root}tmp/qa/ux-sign-${width}.png`});
      await page.locator('#dock-reveal').click();
      assert.equal(await page.locator('#answer-section').isVisible(),true);
      assert.equal(await page.locator('#dock-reveal').textContent(),'정답 숨기기');
      assert.equal(await page.locator('#reveal').getAttribute('aria-expanded'),'true');
      assert.ok(await page.locator('#answer-section').evaluate(el=>el.getBoundingClientRect().top)<height-80);
      await page.locator('#dock-reveal').click();
      assert.equal(await page.locator('#answer-section').isVisible(),false);
      await settings(page);await page.locator('#duration').selectOption('30');
      await page.locator('#apply-settings').click();
      assert.equal(await page.locator('.settings-panel').evaluate(el=>el.open),false);
      assert.ok(await page.locator('.question-card').evaluate(el=>el.getBoundingClientRect().top)>=-1);
      await page.clock.fastForward(31_000);
      assert.equal(await page.locator('#dock-reveal').getAttribute('aria-expanded'),'true');
      await page.locator('#next').click();
      assert.equal(await page.locator('#dock-reveal').textContent(),'정답 확인');
      assert.equal(await page.locator('#answer-section').isVisible(),false);
      await settings(page);await page.locator('#duration').selectOption('0');
    }else assert.equal(await page.locator('#dock-reveal').isVisible(),false);
    await settings(page);
    await page.locator('#star').click();await page.locator('#scope').selectOption('starred');
    assert.equal(await page.locator('#bank-count').textContent(),'현재 1문항');
    assert.equal(await page.locator('#learned-count').textContent(),'0 / 240');
    assert.match(await page.locator('#open-library').textContent(),/현재 범위 문항 목록/);
    await page.locator('#scope').selectOption('all');
    await settings(page);
    await page.locator('#open-library').click();
    assert.equal(await page.locator('.library-item').count(),240);
    await page.locator('#close-library').click();
    await page.reload();await ready(page);
    assert.equal(await page.locator('#bank-count').textContent(),'현재 240문항');
    assert.equal(await page.locator('#starred-count').textContent(),'별표 1');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rail-note-study-v1')).marks['textbook-82'].status),'learned');
    layouts.push({width,height,overflow:false});
    await context.close();
  }
  passed.push('320/390/1440px 출제유형 선택 완전 제거·과거 original 설정 무시·목록 전체240');
  passed.push('320/390px 고정 정답 버튼 44px 이상·표지 답안 이동/숨김·시간 종료/다음 초기화');
  passed.push('별표 필터 현재1과 전체240 진도 구분·현재 목록240·설정/별표 유지');
  assert.deepEqual(analyticsRequests,[]);
  passed.push('브라우저 자동화 검사는 실제 통계에 전송하지 않음');
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/analytics-config.json',route=>route.abort());
  await page.goto(url);await ready(page);
  assert.equal(await page.locator('#kind').count(),0);
  assert.equal(await page.locator('#bank-count').textContent(),'현재 240문항');
  assert.ok(await page.locator('.question-card').evaluate(el=>el.getBoundingClientRect().top)<300);
  await page.screenshot({path:`${root}tmp/qa/ux-default-390.png`});
  await settings(page);await page.locator('#open-library').click();
  assert.equal(await page.locator('.library-item').count(),240);
  await page.locator('#close-library').click();
  await page.locator('#apply-settings').click();
  passed.push('신규 사용자 전체240·출제유형 선택 없음·문제 카드 상단 배치·목록240');
  await page.locator('#dock-reveal').click();assert.equal(await page.locator('#answer-section').isVisible(),true);
  await page.locator('#next').click();assert.equal(await page.locator('#answer-section').isVisible(),false);
  passed.push('통계 설정 요청 차단 시에도 문제·정답·다음 학습 계속 동작');
  await context.close();
  assert.deepEqual(errors,[]);
  const report={status:'PASS',url,passed,layouts,errors,analyticsRequests};
  await writeFile(`${root}tmp/qa/ux-browser-report.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
