# 구술 훈련실

기능교재 82문항 + 신규 구술 문답서 90문항으로 연습하는 정적 모바일 웹앱. 원문 PDF 45페이지의 미리보기와 문항별 페이지 연결을 포함합니다.

2026-10-02 추가: 참고사항 46문항, 교-교·교-직 절연 구간 세부 상황 7문항, 실제 표지 그림 16문항. 기존 172문항을 포함해 총 241문항입니다. 출제유형 선택 기능 없이 모든 문항을 함께 공부합니다. 교재·검색·복습 필터는 유지하며 이전에 저장한 출제유형은 더 이상 적용하지 않습니다. 암기·별표 기록은 그대로 유지됩니다.

원문 `public/questions.json`과 기존 문항 ID·학습 기록은 그대로 보존하고 추가 문제만 `public/supplemental.json`에 분리했습니다. 참고사항 29개 묶음은 내용을 빠뜨리지 않고 46개 독립 문제로 나눴습니다. 세부 상황은 조건·현상·조치를 함께 보존합니다. 표지는 원본 PDF의 형상 열만 직접 잘라 문제에 표시하며, 명칭·설명은 답안 확인 전에는 화면과 접근성 트리에서 숨깁니다. 추가 문항에도 원문 번호·페이지와 PDF 연결을 제공합니다. 암기 진도는 전체 241문항 기준입니다.

실행:

```sh
git clone https://github.com/JAEKWANG97/rail-study-quiz.git
cd rail-study-quiz
npm start
```

기본 주소: http://127.0.0.1:4182

기능: 30/60/90/120초 및 시간 제한 없음, 시간 종료 시 답안 공개, 일시정지·재시작, 랜덤/원문 순서, 교재 선택·검색, 별표·다시 보기·암기 표시, 원문 페이지·그림·표 확인, 전체 문항 목록, Space/방향키.

학습 표시와 설정은 해당 브라우저의 localStorage에 저장됩니다. 기기 간 동기화는 없습니다.

같은 브라우저의 여러 탭은 문항별 암기 상태·별표를 실시간 반영하며 다른 탭의 기록을 덮어쓰지 않습니다. 저장소가 차단되거나 용량이 부족하면 ‘이번 탭에서 연습’을 표시하고 임시 학습은 계속 가능합니다. 기존 단일 키에 저장된 기록도 읽습니다.

모바일 우선: 학습 설정을 처음에 접어두고 현재 범위 문항 수만 요약에 표시합니다. 설정 후에는 ‘설정 닫고 문제 보기’로 이동할 수 있습니다. 답안은 16px, 주요 버튼은 최소 44px 터치 영역입니다. 이전/정답 확인/다음은 화면 하단에 고정되며 정답 확인은 답안 시작으로 이동합니다. 긴 답안을 읽고 다음 문제로 이동하면 문제 시작으로 돌아옵니다. 현재 범위 문항 수·목록과 전체 문항 진도는 구분해서 표시합니다. 320px·390px 화면과 iPhone 안전 영역을 고려했습니다.

원문 번호 중복(141·169·172·183)은 모두 별도의 고유 ID로 유지했습니다. 114·122·173번은 원문에 텍스트 답안이 비어 있어 그대로 두었습니다. 6.82 표지는 PDF 33~34쪽 이미지를 함께 보여줍니다. 추출 내용은 문항 경계·페이지 헤더/푸터만 정리했으며 답안을 AI로 재작성하지 않았습니다.

```sh
npm test
npm run build
```

브라우저 회귀 검사는 `node scripts/check-browser.mjs`로 실행합니다. 현재 Mac의 기존 Playwright·Chrome 설치를 사용하며 다른 환경에서는 `PLAYWRIGHT_MODULE`과 `CHROME_BIN`을 지정합니다. 결과는 `tmp/qa/browser-report.json`에 저장됩니다.

추가 유형 검사는 `node scripts/check-supplements-browser.mjs`로 실행합니다. 기존 기록 복원, MCB 독립 출제, 세부 상황 7개·그림 16개·혼합 241개 실제 순회, 정답 숨김, 320/390/1440px 화면과 원문 연결을 확인합니다. 결과는 `tmp/qa/supplements-browser-report.json`에 저장됩니다.

모바일 UX 회귀 검사는 `node scripts/check-ux-browser.mjs`로 실행합니다. 출제유형 선택 제거·이전 유형 설정 무시·전체241문항, 설정 닫기, 정답 고정 버튼과 자동 공개, 범위/진도 구분, 통계 제외/차단 시 학습을 확인합니다. 결과는 `tmp/qa/ux-browser-report.json`에 저장됩니다. 세 브라우저 검사 모두 `BROWSER_TEST_URL`로 공개 배포본을 검사할 수 있습니다.

방문 통계: 기존 Cloudflare 계정의 Web Analytics에 `jaekwang97.github.io`를 등록했습니다. GitHub Pages·DNS·호스팅은 그대로 유지하고 `public/analytics-config.json`의 공개 사이트 식별자로 연결합니다. 이 식별자는 브라우저에 공개되는 beacon ID이며 API 인증키가 아닙니다. API 인증키를 소스에 넣지 마세요.

`public/analytics.js`는 실제 호스트의 `/rail-study-quiz/` 경로에서만 공식 스니펫을 로드합니다. 로컬 실행·자동화 브라우저·Do Not Track(1)은 전송하지 않습니다. 사용자 검색어·답안·학습 기록을 통계 이벤트로 보내지 않으며, 통계 스크립트나 설정 요청이 차단되어도 학습은 계속됩니다. 학습 기록은 여전히 해당 브라우저에만 저장됩니다.

계정 소유자의 Cloudflare → Observability → Analytics → Web Analytics → jaekwang97.github.io에서 기간별 Visits·Page views와 유입 경로를 봅니다. Visits는 고유 사람 수가 아닙니다. 수집 시작 이전의 방문 추이는 복원할 수 없고 문제 넘김은 별도 페이지뷰가 아닙니다. 데이터 반영까지 몇 분 걸릴 수 있습니다. 공식 안내: https://developers.cloudflare.com/web-analytics/get-started/ · 지표 정의: https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/

빌드 결과 `dist/`는 상대 경로만 사용하므로 GitHub Pages 하위 경로 등 정적 호스팅에 올릴 수 있습니다. HTML의 JavaScript/CSS와 앱의 모듈 import에는 배포 커밋 `?v=...`를 자동으로 붙여 이전 코드 캐시와 새 HTML의 혼합을 방지합니다. 학습 저장 키와 문항 데이터는 변경하지 않습니다. `.github/workflows/pages.yml`은 `main` 푸시 시 테스트와 빌드를 거쳐 GitHub Pages에 자동 배포합니다. 저장소의 Pages 설정은 GitHub Actions를 사용합니다.

배포 대상: https://jaekwang97.github.io/rail-study-quiz/

`version.json`에 배포 커밋과 문항 수를 기록합니다. 원문 PDF 2개·문항 데이터·페이지 이미지를 포함한 공개 배포이며 사용자 로그인·DB·외부 AI API는 사용하지 않습니다.

배포 후 `npm run check:deployment`로 실제 서버의 커밋과 모든 정적 파일 해시를 확인할 수 있습니다. 다른 주소는 `DEPLOYMENT_URL`, 다른 커밋은 `EXPECTED_REVISION`으로 지정합니다. `BROWSER_TEST_URL=https://jaekwang97.github.io/rail-study-quiz/ node scripts/check-browser.mjs`로 배포본의 기능 회귀 검사를 실행합니다.

원문 변경 시 Poppler의 `pdftotext -layout`로 `tmp/pdfs/oral.txt`, `tmp/pdfs/textbook.txt`를 갱신하고 `npm run extract`를 실행합니다. `pdftoppm -scale-to 1400 -png`로 `public/page-previews/oral-01.png` 등 미리보기를 함께 갱신합니다. 데이터 검증은 `npm test`를 실행합니다.

추가 데이터와 표지 이미지 재생성: Poppler가 설치된 환경에서 `npm run supplements`. 기존 172문항 파일은 수정하지 않습니다. 참고 질문 제목은 스크립트의 명시적 목록으로 관리하고 답안은 원문 부분 문자열을 사용합니다. 표지 명칭은 원문 표와 대조한 목록, 설명은 해당 행의 관련 내용 열에서 추출합니다. 그림 좌표는 현재 원본 PDF에 고정되어 있으므로 원문 변경 시 전부 재검토해야 합니다. 속도표는 텍스트 추출의 열 배치 한계 때문에 원문 이미지도 제공합니다. 학습 자료는 제공된 교재 기준이며 실제 운전 지침을 대신하지 않습니다.
