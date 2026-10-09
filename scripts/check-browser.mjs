import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || `${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`);
const root = fileURLToPath(new URL('../', import.meta.url));
const url = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:4182';
await mkdir(`${root}tmp/qa`, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const passed = [];
const errors = [];
const screenshots = [];
async function createContext(options = {}) {
  const context = await browser.newContext(options);
  context.on('page', page => {
    page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${page.url()}: ${message.text()}`); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  });
  return context;
}
try {
  const context = await createContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(url);
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(await page.locator('[data-count="all"]').textContent(), '240');
  assert.equal(await page.locator('#kind').count(), 0);
  await page.locator('#order').selectOption('sequential');
  await page.locator('[data-source="textbook"]').click();
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-1');
  await page.locator('#next').click();
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-2');
  await page.locator('#previous').click();
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-1');
  passed.push('데이터 로드 · 교재 선택 · 원문 순서 · 다음/이전');

  const seen = new Set();
  await page.locator('#order').selectOption('shuffle');
  for (let index=0; index<150; index++) {
    const id = await page.locator('body').getAttribute('data-current-id');
    assert.ok(!seen.has(id), `중복 문항: ${id}`); seen.add(id);
    await page.locator('#next').click();
  }
  assert.equal(seen.size, 150);
  assert.equal(await page.locator('#cycle-label').textContent(), '2회차');
  passed.push('기능교재 전체150문항 실제 순회: 중복·누락 없음');

  await page.locator('#order').selectOption('sequential');
  await page.locator('#next').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-3');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-2');
  assert.ok((await page.locator('#announcement').textContent()).startsWith('6.2.'));
  await page.locator('#search').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-2');
  await page.locator('#open-library').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-2');
  await page.locator('#close-library').click();
  passed.push('버튼 포커스에서 방향키 이동 · 입력/모달에서는 이동 차단 · 이전 문항 안내');

  await page.locator('#search').fill('6.12');
  await page.locator('#open-library').click();
  await page.clock.runFor(200);
  const matches=await page.locator('.library-item').count();
  assert.equal(matches,Number((await page.locator('#question-position').textContent()).match(/\/ (\d+)/)[1]));
  await page.locator('.library-item').first().click();
  assert.ok(await page.locator('body').getAttribute('data-current-id'));
  assert.equal(await page.locator('#next').isDisabled(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'question');
  await page.locator('#search').fill(''); await page.clock.runFor(200);
  passed.push('검색 지연 중 목록 열기 · 유효 문항 선택 · 목록 이동 초점/안내');

  await page.locator('#reset-timer').click();
  await page.clock.fastForward(61_000);
  assert.equal(await page.locator('#timer').textContent(), '0');
  assert.equal(await page.locator('#answer-section').isVisible(), true);
  await page.locator('#reset-timer').click();
  await page.clock.runFor(5000);
  await page.locator('#pause').click();
  const paused = await page.locator('#timer').textContent();
  await page.clock.fastForward(15_000);
  assert.equal(await page.locator('#timer').textContent(), paused);
  await page.locator('#pause').click();
  await page.clock.runFor(2000);
  assert.ok(Number(await page.locator('#timer').textContent()) < Number(paused));
  passed.push('시간 종료 자동 공개 · 일시정지 · 재개 · 재시작');

  await page.locator('#order').selectOption('sequential');
  await page.locator('#reveal').click();
  await page.locator('#star').click();
  await page.locator('#mark-learned').click();
  assert.equal(await page.locator('#learned-count').textContent(), '1 / 240');
  await page.reload(); await page.waitForSelector('body[data-ready="true"]');
  assert.equal(await page.locator('#learned-count').textContent(), '1 / 240');
  assert.equal(await page.locator('#star').getAttribute('aria-pressed'), 'true');
  await page.locator('#scope').selectOption('unlearned');
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-2');
  await page.locator('#scope').selectOption('starred');
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'textbook-1');
  await page.locator('#star').click();
  assert.equal(await page.locator('#empty-state').isVisible(), true);
  await page.locator('#show-all').click();
  await page.locator('#reveal').click();
  await page.locator('#mark-review').click();
  await page.locator('#scope').selectOption('review');
  assert.equal(await page.locator('#question-position').textContent(), '1 / 1 문항 · 원문 순서');
  passed.push('별표 · 암기/복습 · 저장 후 새로고침 · 필터 · 빈 범위 복귀');

  await page.locator('#scope').selectOption('all');
  await page.locator('[data-source="oral"]').click();
  await page.locator('#search').fill('주변압기 냉각 동작방법');
  await page.clock.runFor(200);
  assert.equal(await page.locator('body').getAttribute('data-current-id'), 'oral-14');
  await page.locator('#reveal').click();
  assert.equal(await page.locator('#answer-notice').isVisible(), true);
  assert.equal(await page.locator('#answer').textContent(), '');
  await page.locator('#open-source').click();
  await page.waitForFunction(()=>document.querySelector('#source-pages img')?.naturalWidth > 0);
  assert.ok((await page.locator('#pdf-link').getAttribute('href')).endsWith('#page=3'));
  await page.locator('#close-source').click();
  passed.push('빈 답안 안내 · 원문 페이지 이미지 · PDF 페이지 연결');

  await page.locator('[data-source="textbook"]').click();
  await page.locator('#search').fill('각종 표지');
  await page.clock.runFor(200);
  assert.equal(await page.locator('#empty-state').isVisible(),true);
  await page.locator('#show-all').click();
  await page.locator('#open-library').click();
  assert.equal(await page.locator('.library-item').count(),240);
  assert.equal(await page.locator('.library-item').filter({has:page.getByText('6.82',{exact:true})}).count(),0);
  await page.locator('.library-item').filter({has:page.getByText('표지 01',{exact:true})}).click();
  assert.equal(await page.locator('#library-dialog').isVisible(), false);
  await page.waitForFunction(()=>document.querySelector('#sign-image').naturalWidth>0);
  assert.equal(await page.locator('#question-image').isVisible(),true);
  passed.push('각종 표지 묶음 검색/목록 제외 · 개별 이미지 표지 문제 유지');

  await page.locator('#search').fill('없는문항을찾습니다');
  await page.clock.runFor(200);
  await page.locator('#show-all').click();
  await page.locator('#duration').selectOption('0');
  await page.clock.fastForward(3600_000);
  assert.equal(await page.locator('#timer').textContent(), '∞');
  assert.equal(await page.locator('#answer-section').isVisible(), false);
  await page.locator('#duration').selectOption('60');
  passed.push('검색 결과 없음 복귀 · 시간 제한 없는 연습');

  const filteredPage=await context.newPage();
  await filteredPage.goto(url); await filteredPage.waitForSelector('body[data-ready="true"]');
  await filteredPage.locator('#order').selectOption('sequential');
  await filteredPage.locator('[data-source="textbook"]').click();
  await filteredPage.locator('#scope').selectOption('unlearned');
  await filteredPage.locator('#next').click(); await filteredPage.locator('#next').click();
  assert.equal(await filteredPage.locator('body').getAttribute('data-current-id'),'textbook-3');
  await filteredPage.locator('#reveal').click(); await filteredPage.locator('#mark-learned').click();
  assert.equal(await filteredPage.locator('body').getAttribute('data-current-id'),'textbook-4');
  assert.equal(await filteredPage.locator('#cycle-label').textContent(),'1회차');
  assert.ok((await filteredPage.locator('#announcement').textContent()).startsWith('6.4.'));
  assert.equal(await filteredPage.evaluate(()=>document.activeElement.id),'question');
  await filteredPage.close();
  passed.push('미암기 필터 중간 표시 변경 후 다음 문제 유지 · 회차 유지 · 접근성 안내');

  const tabs=await createContext({viewport:{width:1440,height:1000}});
  const tabA=await tabs.newPage(); const tabB=await tabs.newPage();
  for(const tab of [tabA,tabB]){
    await tab.goto(url); await tab.waitForSelector('body[data-ready="true"]');
    await tab.locator('#order').selectOption('sequential');
    await tab.locator('[data-source="textbook"]').click();
  }
  await tabA.locator('#reveal').click(); await tabA.locator('#mark-learned').click();
  await tabB.waitForFunction(()=>document.querySelector('#learned-count').textContent==='1 / 240');
  await tabB.locator('#next').click(); await tabB.locator('#reveal').click(); await tabB.locator('#mark-review').click();
  await tabB.locator('#duration').selectOption('90');
  await tabA.waitForFunction(()=>document.querySelector('#review-count').textContent==='다시 보기 1');
  await tabA.reload(); await tabA.waitForSelector('body[data-ready="true"]');
  assert.equal(await tabA.locator('#learned-count').textContent(),'1 / 240');
  assert.equal(await tabA.locator('#review-count').textContent(),'다시 보기 1');
  await tabB.locator('#previous').click(); await tabB.locator('#star').click();
  await tabA.waitForFunction(()=>document.querySelector('#star').getAttribute('aria-pressed')==='true');
  assert.equal(await tabA.locator('#learned-count').textContent(),'1 / 240');
  await tabA.locator('#scope').selectOption('unlearned');
  assert.equal(await tabA.locator('body').getAttribute('data-current-id'),'textbook-2');
  await tabB.locator('#reveal').click(); await tabB.locator('#mark-learned').click();
  await tabA.waitForFunction(()=>document.querySelector('#question-position').textContent.startsWith('2 /'));
  assert.equal(await tabA.locator('body').getAttribute('data-current-id'),'textbook-2');
  await tabA.locator('#previous').click();
  assert.equal(await tabA.locator('body').getAttribute('data-current-id'),'textbook-1');
  await tabs.close();
  passed.push('실제 두 탭의 표시·설정 저장 간 기록 보존 · 같은 문항 별표/암기 보존 · 실시간 반영');

  const blocked=await createContext();
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  const blockedPage=await blocked.newPage(); await blockedPage.goto(url); await blockedPage.waitForSelector('body[data-ready="true"]');
  await blockedPage.locator('#order').selectOption('sequential');
  await blockedPage.locator('[data-source="textbook"]').click();
  await blockedPage.locator('#reveal').click(); await blockedPage.locator('#mark-learned').click();
  assert.equal(await blockedPage.locator('#learned-count').textContent(),'1 / 240');
  await blockedPage.locator('#next').click(); await blockedPage.locator('#reveal').click(); await blockedPage.locator('#mark-learned').click();
  assert.equal(await blockedPage.locator('#learned-count').textContent(),'2 / 240');
  assert.equal(await blockedPage.locator('#saved-status').textContent(),'이번 탭에서 연습');
  await blocked.close();
  passed.push('저장소 접근 차단에서도 학습·임시 기록 계속 사용');

  const corrupt=await createContext();
  const corruptPage=await corrupt.newPage();
  await corruptPage.goto(url); await corruptPage.waitForSelector('body[data-ready="true"]');
  await corruptPage.evaluate(()=>localStorage.setItem('rail-note-study-v1','{broken'));
  await corruptPage.reload(); await corruptPage.waitForSelector('body[data-ready="true"]');
  await corruptPage.locator('#reveal').click(); await corruptPage.locator('#mark-learned').click();
  assert.equal(await corruptPage.locator('#learned-count').textContent(),'1 / 240');
  await corruptPage.reload(); await corruptPage.waitForSelector('body[data-ready="true"]');
  assert.equal(await corruptPage.locator('#learned-count').textContent(),'1 / 240');
  await corruptPage.locator('#duration').selectOption('90');
  assert.equal(await corruptPage.evaluate(()=>JSON.parse(localStorage.getItem('rail-note-study-v1')).duration),90);
  await corrupt.close();
  passed.push('손상된 이전 설정 JSON에서 문항 기록 저장·새로고침 복원 · 설정 복구');

  const longPage=await context.newPage();
  await longPage.goto(url); await longPage.waitForSelector('body[data-ready="true"]');
  await longPage.locator('#order').selectOption('sequential');
  await longPage.locator('[data-source="textbook"]').click();
  await longPage.locator('#search').fill('제동 불완해 발생 시 조치');
  await longPage.locator('#open-library').click();
  await longPage.locator('.library-item').filter({has:longPage.getByText('6.24',{exact:true})}).click();
  await longPage.locator('#reveal').click();
  assert.ok((await longPage.locator('#answer').textContent()).length>=600);
  for(const width of [320,390,641]){
    await longPage.setViewportSize({width,height:844});
    assert.equal(await longPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await longPage.close();
  passed.push('긴 답안 6.24의 320/390/641px 가로 넘침 검사');

  await page.locator('#order').selectOption('sequential');
  const layouts = [];
  for (const width of [1440,390,320]) {
    const height = width <= 640 ? 844 : 1000;
    await page.setViewportSize({width,height});
    await page.reload(); await page.waitForSelector('body[data-ready="true"]');
    const layout = await page.evaluate(()=>({width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth, questionWidth:document.querySelector('.question-card').getBoundingClientRect().width}));
    assert.equal(layout.overflow, false, `가로 넘침: ${width}px`);
    layouts.push(layout);
    const filename = `${root}tmp/qa/preview-${width}.png`;
    await page.screenshot({path:filename,fullPage:true}); screenshots.push(filename);
    await page.locator('#reveal').click();
    assert.equal(await page.locator('#answer-section').isVisible(), true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), false);
    if(width<=640) {
      assert.ok(await page.locator('#answer').evaluate(element=>parseFloat(getComputedStyle(element).fontSize))>=16);
      for(const id of ['pause','star','reveal','reset-timer','previous','next','open-source','mark-review','mark-learned']) {
        const box = await page.locator(`#${id}`).boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, `터치 영역: ${id} (${width}px)`);
      }
      await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      const next = await page.locator('#next').boundingBox();
      assert.ok(next.y>=0 && next.y+next.height<=height, `하단 버튼 화면 밖: ${width}px`);
      const currentId=await page.locator('body').getAttribute('data-current-id');
      await page.locator('#next').click();
      assert.notEqual(await page.locator('body').getAttribute('data-current-id'),currentId);
      assert.ok(await page.locator('.question-card').evaluate(element=>element.getBoundingClientRect().top)>=-1, '다음 문항 위쪽으로 스크롤 복귀');
      await page.locator('#previous').click();
      await page.locator('#reveal').click();
      await page.evaluate(()=>window.scrollTo(0,0));
      if(width===390) {
        const filename=`${root}tmp/qa/answer-390.png`;
        await page.screenshot({path:filename,fullPage:false}); screenshots.push(filename);
      }
      await page.locator('.settings-panel > summary').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.locator('.settings-panel > summary').click();
      await page.locator('#open-source').click();
      await page.waitForFunction(()=>document.querySelector('#source-pages img')?.naturalWidth>0);
      assert.equal(await page.locator('#source-dialog').isVisible(),true);
      assert.equal(await page.locator('#source-dialog').evaluate(element=>element.scrollWidth>element.clientWidth),false);
      const close=await page.locator('#close-source').boundingBox();
      assert.ok(close.width>=44&&close.height>=44);
      await page.locator('#close-source').click();
    }
  }
  passed.push('1440/390/320px 모바일 반응형 · 긴 답안 가로 넘침 없음');
  passed.push('모바일 16px 답안 · 44px 이상 터치 영역 · 설정/원문 보기 · 고정 하단 이동 · 새 문항 스크롤 복귀');
  assert.deepEqual(errors, []);
  const report={status:'PASS',url,passed,layouts,screenshots,errors};
  await writeFile(`${root}tmp/qa/browser-report.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
