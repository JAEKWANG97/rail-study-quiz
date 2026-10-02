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
        localStorage.setItem('rail-note-study-v1',JSON.stringify({source:'all',kind:'original',order:'sequential',duration:0,marks:{}}));
        localStorage.setItem('ux-seeded','true');
      }
    });
    const page=await context.newPage();await page.clock.install();await page.goto(url);await ready(page);
    assert.equal(await page.locator('#total-count').textContent(),'전체 241문항');
    assert.equal(await page.locator('#bank-count').textContent(),'현재 172문항');
    assert.equal(await page.locator('#kind').isVisible(),true);
    assert.equal(await page.locator('#kind option').count(),5);
    assert.match(await page.locator('#progress-label').textContent(),/전체 진도/);
    if(width<=640)assert.equal(await page.locator('.settings-panel').evaluate(el=>el.open),false);
    for(const [kind,count] of [['reference',46],['scenario',7],['sign',16],['all',241]]){
      await settings(page);await page.locator('#kind').selectOption(kind);
      assert.equal(await page.locator('#bank-count').textContent(),`현재 ${count}문항`);
      if(width<=640)assert.equal(await page.locator('.settings-panel').evaluate(el=>el.open),false);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.locator('#kind').selectOption('sign');
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
    await page.locator('#kind').selectOption('original');await settings(page);
    await page.locator('#star').click();await page.locator('#scope').selectOption('starred');
    assert.equal(await page.locator('#bank-count').textContent(),'현재 1문항');
    assert.equal(await page.locator('#learned-count').textContent(),'0 / 172');
    assert.match(await page.locator('#open-library').textContent(),/현재 범위 문항 목록/);
    await page.locator('#scope').selectOption('all');
    await page.locator('#kind').selectOption('all');await settings(page);
    await page.locator('#open-library').click();
    assert.equal(await page.locator('.library-item').count(),241);
    await page.locator('#close-library').click();
    await page.reload();await ready(page);
    assert.equal(await page.locator('#kind').inputValue(),'all');
    assert.equal(await page.locator('#starred-count').textContent(),'별표 1');
    layouts.push({width,height,overflow:false});
    await context.close();
  }
  passed.push('320/390/1440px 유형·전체241 상시 발견, 유형별 현재 범위, 모바일 설정 접기');
  passed.push('320/390px 고정 정답 버튼 44px 이상·표지 답안 이동/숨김·시간 종료/다음 초기화');
  passed.push('복습 필터 현재1과 유형 전체172 진도 구분·현재 목록241·설정/별표 유지');
  assert.deepEqual(analyticsRequests,[]);
  passed.push('브라우저 자동화 검사는 실제 통계에 전송하지 않음');
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/analytics-config.json',route=>route.abort());
  await page.goto(url);await ready(page);
  await page.locator('#dock-reveal').click();assert.equal(await page.locator('#answer-section').isVisible(),true);
  await page.locator('#next').click();assert.equal(await page.locator('#answer-section').isVisible(),false);
  passed.push('통계 설정 요청 차단 시에도 문제·정답·다음 학습 계속 동작');
  await context.close();
  assert.deepEqual(errors,[]);
  const report={status:'PASS',url,passed,layouts,errors,analyticsRequests};
  await writeFile(`${root}tmp/qa/ux-browser-report.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
