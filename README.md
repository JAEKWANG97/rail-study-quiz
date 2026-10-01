# 구술 훈련실

기능교재 82문항 + 신규 구술 문답서 90문항으로 연습하는 정적 모바일 웹앱. 원문 PDF 45페이지의 미리보기와 문항별 페이지 연결을 포함합니다.

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

모바일 우선: 설정은 처음에 접어두고, 답안은 16px로 표시합니다. 주요 버튼은 최소 44px 터치 영역이며 이전/다음은 화면 하단에 고정됩니다. 긴 답안을 읽고 다음 문제로 이동하면 문제 시작으로 돌아옵니다. 320px·390px 화면과 iPhone 안전 영역을 고려했습니다.

원문 번호 중복(141·169·172·183)은 모두 별도의 고유 ID로 유지했습니다. 114·122·173번은 원문에 텍스트 답안이 비어 있어 그대로 두었습니다. 6.82 표지는 PDF 33~34쪽 이미지를 함께 보여줍니다. 추출 내용은 문항 경계·페이지 헤더/푸터만 정리했으며 답안을 AI로 재작성하지 않았습니다.

```sh
npm test
npm run build
```

브라우저 회귀 검사는 `node scripts/check-browser.mjs`로 실행합니다. 현재 Mac의 기존 Playwright·Chrome 설치를 사용하며 다른 환경에서는 `PLAYWRIGHT_MODULE`과 `CHROME_BIN`을 지정합니다. 결과는 `tmp/qa/browser-report.json`에 저장됩니다.

빌드 결과 `dist/`는 상대 경로만 사용하므로 GitHub Pages 하위 경로 등 정적 호스팅에 올릴 수 있습니다. `.github/workflows/pages.yml`은 `main` 푸시 시 테스트와 빌드를 거쳐 GitHub Pages에 자동 배포합니다. 저장소의 Pages 설정은 GitHub Actions를 사용합니다.

배포 대상: https://jaekwang97.github.io/rail-study-quiz/

`version.json`에 배포 커밋과 문항 수를 기록합니다. 원문 PDF 2개·문항 데이터·페이지 이미지를 포함한 공개 배포이며 사용자 로그인·DB·외부 AI API는 사용하지 않습니다.

배포 후 `npm run check:deployment`로 실제 서버의 커밋과 모든 정적 파일 해시를 확인할 수 있습니다. 다른 주소는 `DEPLOYMENT_URL`, 다른 커밋은 `EXPECTED_REVISION`으로 지정합니다. `BROWSER_TEST_URL=https://jaekwang97.github.io/rail-study-quiz/ node scripts/check-browser.mjs`로 배포본의 기능 회귀 검사를 실행합니다.

원문 변경 시 Poppler의 `pdftotext -layout`로 `tmp/pdfs/oral.txt`, `tmp/pdfs/textbook.txt`를 갱신하고 `npm run extract`를 실행합니다. `pdftoppm -scale-to 1400 -png`로 `public/page-previews/oral-01.png` 등 미리보기를 함께 갱신합니다. 데이터 검증은 `npm test`를 실행합니다.
