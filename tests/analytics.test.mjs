import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldTrack, beacon} from '../public/analytics.js';
const location={hostname:'jaekwang97.github.io',pathname:'/rail-study-quiz/'};
const siteId='a'.repeat(32);
test('통계는 올바른 공개 식별자가 있는 실제 배포 경로에서만 수집한다',()=>{
  assert.equal(shouldTrack(location,{},siteId),true);
  for(const id of ['',null,'invalid',siteId+'x'])assert.equal(shouldTrack(location,{},id),false);
  assert.equal(shouldTrack({...location,hostname:'localhost'},{},siteId),false);
  assert.equal(shouldTrack({...location,pathname:'/other-project/'},{},siteId),false);
  assert.equal(shouldTrack({...location,pathname:'/rail-study-quiz-other/'},{},siteId),false);
});
test('자동화 검사와 Do Not Track 방문은 수집에서 제외한다',()=>{
  assert.equal(shouldTrack(location,{webdriver:true},siteId),false);
  assert.equal(shouldTrack(location,{doNotTrack:'1'},siteId),false);
  assert.equal(shouldTrack(location,{doNotTrack:'0'},siteId),true);
});
test('Cloudflare 스니펫에는 공개 식별자만 넣고 검색/학습 데이터는 넣지 않는다',()=>{
  const attributes={};const script={setAttribute:(key,value)=>attributes[key]=value};
  assert.equal(beacon({createElement:()=>script},siteId),script);
  assert.equal(script.src,'https://static.cloudflareinsights.com/beacon.min.js');
  assert.equal(script.defer,true);
  assert.equal(script.type,'module');
  assert.deepEqual(JSON.parse(attributes['data-cf-beacon']),{token:siteId});
});
