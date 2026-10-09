import { makeDeck, filterQuestions, Countdown } from './model.js';
import { StudyStorage } from './persistence.js';

const $ = id => document.getElementById(id);
const allowed = {source: ['all', 'textbook', 'oral'], kind: ['all', 'original', 'reference', 'scenario', 'sign'], scope: ['all', 'unlearned', 'review', 'starred'], order: ['shuffle', 'sequential'], duration: [0, 30, 60, 90, 120]};
const kindNames = {original:'원문 문항', reference:'참고사항', scenario:'세부 상황', sign:'표지 그림'};
const state = {source: 'all', kind: 'all', scope: 'all', order: 'shuffle', duration: 60, query: '', marks: {}, deck: [], cursor: 0, cycle: 1, answerVisible: false, expirationHandled: false, clock: new Countdown(60)};
let data;
let byId;
let sourceById;
let searchTimeout;
let persistence;
const pendingMarks = {};

function restore() {
  try {
    const saved = persistence.read();
    for (const key of Object.keys(allowed)) if (allowed[key].includes(saved[key])) state[key] = saved[key];
    if (saved.marks && typeof saved.marks === 'object' && !Array.isArray(saved.marks)) {
      for (const [id, mark] of Object.entries(saved.marks)) {
        if (byId.has(id) && mark && typeof mark === 'object') {
          state.marks[id] = {status: ['learned', 'review'].includes(mark.status) ? mark.status : 'none', starred: mark.starred === true};
        }
      }
    }
  } catch { $('saved-status').textContent = '이번 탭에서 연습'; }
}

function save(settings = {}) {
  try {
    persistence.saveSettings(settings);
    $('saved-status').textContent = '학습 기록 저장됨';
  } catch { $('saved-status').textContent = '이번 탭에서 연습'; }
}

function refreshMarks() {
  try { state.marks = persistence.read().marks; } catch {}
  for (const [id, patch] of Object.entries(pendingMarks)) state.marks[id] = {...state.marks[id], ...patch};
}

function saveMark(id, patch) {
  pendingMarks[id] = {...pendingMarks[id], ...patch};
  try {
    persistence.saveMark(id, pendingMarks[id]);
    delete pendingMarks[id];
    $('saved-status').textContent = '학습 기록 저장됨';
  } catch { $('saved-status').textContent = '이번 탭에서 연습'; }
  state.marks[id] = {...state.marks[id], ...patch};
}

const selectedQuestions = () => filterQuestions(data.questions, state, state.marks);
const current = () => byId.get(state.deck[state.cursor]);
function announce(text) { $('announcement').textContent = text; }
function announceQuestion() { announce(current() ? `${current().number}. ${current().question}` : '현재 범위에 문항이 없어요.'); }

function resetQuestion() {
  state.answerVisible = false;
  state.expirationHandled = false;
  state.clock.reset(state.duration);
  if (!current()) state.clock.pause();
  $('visual-reference').open = false;
}

function scrollToQuestion(force = false) {
  const card = document.querySelector('.question-card');
  if (matchMedia('(max-width: 640px)').matches && (force || card.getBoundingClientRect().top < 0)) {
    card.scrollIntoView({block: 'start', behavior: 'auto'});
  }
}

function rebuildDeck() {
  state.deck = makeDeck(selectedQuestions(), state.order);
  state.cursor = 0;
  state.cycle = 1;
  resetQuestion();
  render();
  announceQuestion();
}

function reconcileDeck() {
  const ids = new Set(selectedQuestions().map(question => question.id));
  const oldDeck = state.deck;
  const oldId = oldDeck[state.cursor];
  const nextId = oldDeck.slice(state.cursor + 1).find(id => ids.has(id));
  state.deck = state.order === 'sequential' ? makeDeck(selectedQuestions(), 'sequential') : oldDeck.filter(id => ids.has(id));
  if (state.order === 'shuffle') {
    const included = new Set(state.deck);
    state.deck.push(...makeDeck(selectedQuestions().filter(question => !included.has(question.id)), 'shuffle'));
  }
  const keep = state.deck.indexOf(oldId);
  state.cursor = keep >= 0 ? keep : nextId ? state.deck.indexOf(nextId) : Math.min(state.cursor, Math.max(0, state.deck.length - 1));
  if (state.deck[state.cursor] !== oldId) {
    resetQuestion();
    render();
    scrollToQuestion();
    $('question').focus({preventScroll: true});
    announceQuestion();
  } else render();
}

function flushSearch() {
  clearTimeout(searchTimeout);
  const query = $('search').value;
  if (query !== state.query) { state.query = query; rebuildDeck(); }
}

function renderCounts() {
  const progressQuestions = filterQuestions(data.questions, {kind:state.kind});
  const marks = progressQuestions.map(question => state.marks[question.id] || {});
  const learned = marks.filter(mark => mark.status === 'learned').length;
  $('learned-count').textContent = `${learned} / ${progressQuestions.length}`;
  $('learned-fill').style.width = `${learned / progressQuestions.length * 100}%`;
  const meter = document.querySelector('.small-progress');
  meter.setAttribute('aria-valuemax', progressQuestions.length);
  meter.setAttribute('aria-valuenow', learned);
  $('review-count').textContent = `다시 보기 ${marks.filter(mark => mark.status === 'review').length}`;
  $('starred-count').textContent = `별표 ${marks.filter(mark => mark.starred).length}`;
  $('total-count').textContent = `전체 ${data.questions.length}문항`;
  $('bank-count').textContent = `현재 ${selectedQuestions().length}문항`;
  $('progress-label').textContent = state.kind === 'all' ? '모든 유형 전체 진도' : `${kindNames[state.kind]} 전체 진도`;
  for (const button of document.querySelectorAll('[data-source]')) {
    const selected = button.dataset.source === state.source;
    button.setAttribute('aria-pressed', selected);
    button.classList.toggle('selected', selected);
    button.querySelector('[data-count]').textContent = progressQuestions.filter(question => button.dataset.source === 'all' || question.source === button.dataset.source).length;
  }
  for (const key of ['kind', 'scope', 'order', 'duration']) $(key).value = state[key];
}

function pageFigure(question, page, eager = false) {
  const source = sourceById.get(question.source);
  const figure = document.createElement('figure');
  figure.className = 'source-page';
  const caption = document.createElement('figcaption');
  caption.textContent = `${source.name} · PDF ${page}쪽`;
  const image = document.createElement('img');
  image.src = `./page-previews/${question.source}-${String(page).padStart(2, '0')}.png`;
  image.alt = `${source.name} PDF ${page}쪽 원문`;
  image.loading = eager ? 'eager' : 'lazy';
  image.width = 991;
  image.height = 1400;
  figure.append(caption, image);
  return figure;
}

function renderTimer() {
  const clock = state.clock.snapshot();
  const exists = Boolean(current());
  $('timer').textContent = state.duration === 0 ? '∞' : clock.remaining;
  $('timer').setAttribute('aria-label', state.duration === 0 ? '시간 제한 없음' : `남은 시간 ${clock.remaining}초`);
  $('timer-unit').textContent = state.duration === 0 ? '' : '초';
  $('time-fill').style.width = `${state.duration ? clock.remainingMs / (state.duration * 1000) * 100 : 100}%`;
  document.querySelector('.time-track').classList.toggle('warning', state.duration > 0 && clock.remaining <= 10);
  $('timer-status').textContent = !exists ? '학습 범위를 바꿔보세요' : state.answerVisible ? '답안을 확인하고 비교해 보세요' : state.duration === 0 ? '내 속도로 연습하세요' : clock.expired ? '생각할 시간이 끝났어요' : clock.running ? '답을 떠올려 보세요' : '잠깐 쉬어가는 중';
  $('pause').textContent = clock.running ? 'Ⅱ' : '▷';
  $('pause').setAttribute('aria-label', clock.running ? '타이머 일시정지' : '타이머 이어하기');
  $('pause').disabled = !exists || state.duration === 0 || clock.expired || state.answerVisible;
}

function render() {
  renderCounts();
  const question = current();
  const exists = Boolean(question);
  document.body.dataset.currentId = question?.id || '';
  $('cycle-label').textContent = `${state.cycle}회차`;
  if (exists) {
    const orderLabel = document.createElement('span');
    orderLabel.className = 'position-order';
    orderLabel.textContent = ` · ${state.order === 'shuffle' ? '랜덤' : '원문 순서'}`;
    $('question-position').replaceChildren(`${state.cursor + 1} / ${state.deck.length} 문항`, orderLabel);
  } else $('question-position').textContent = '현재 범위에 문항이 없어요';
  $('source-label').textContent = exists ? sourceById.get(question.source).name : '학습 범위';
  $('question-number').textContent = exists ? `${question.number}${question.duplicateNumber ? ' · 원문 번호 중복' : ''}` : '0문항';
  $('question').textContent = exists ? question.question : '지금 볼 문제가 없어요';
  $('kind-label').textContent = exists ? kindNames[question.kind || 'original'] : '';
  $('origin-label').hidden = !exists || !question.parentId;
  $('origin-label').textContent = exists && question.parentId ? `기능교재 ${question.originalNumber} · PDF ${question.page}쪽에서 분리한 문제` : '';
  $('question-image').hidden = !exists || !question.image;
  if (exists && question.image) {
    const image = $('sign-image');
    if (image.dataset.questionId !== question.id) {
      image.src = `./${question.image}`;
      image.dataset.questionId = question.id;
    }
    image.alt = '문제로 제시된 철도 표지 그림';
  } else { $('sign-image').removeAttribute('src'); delete $('sign-image').dataset.questionId; }
  $('thinking-hint').hidden = !exists || state.answerVisible;
  const instruction = question?.kind === 'sign' ? '표지 그림을 보고 명칭과 의미를 말해보세요.' : '화면을 보지 않고 답을 말해보세요.';
  $('thinking-hint').replaceChildren(instruction, document.createElement('br'), state.duration === 0 ? '정답 확인을 누르면 교재의 답안을 보여드려요.' : '시간이 끝나면 교재의 답안을 보여드려요.');
  $('empty-state').hidden = exists;
  $('empty-message').textContent = state.query ? '검색어나 교재를 바꿔보세요.' : state.scope === 'review' ? '답안을 본 뒤 ‘다시 볼래요’를 누르면 이곳에 모여요.' : state.scope === 'starred' ? '문제 오른쪽 별표를 누르면 이곳에 모여요.' : '학습 범위를 바꾸면 다시 연습할 수 있어요.';
  document.querySelector('.question-actions').hidden = !exists;
  $('answer-section').hidden = !exists || !state.answerVisible;
  $('star').hidden = !exists;
  $('next').disabled = !exists;
  $('previous').disabled = !exists || state.cursor === 0;
  $('open-library').disabled = !exists;
  $('reveal').textContent = state.answerVisible ? '정답 숨기기 ↗' : '정답 확인 ↘';
  $('dock-reveal').disabled = !exists;
  $('dock-reveal').textContent = state.answerVisible ? '정답 숨기기' : '정답 확인';
  $('reveal').setAttribute('aria-expanded', state.answerVisible);
  $('dock-reveal').setAttribute('aria-expanded', state.answerVisible);
  document.body.dataset.kind = question?.kind || 'original';
  if (exists) {
    const mark = state.marks[question.id] || {};
    $('star').textContent = mark.starred ? '★' : '☆';
    $('star').setAttribute('aria-pressed', Boolean(mark.starred));
    $('star').setAttribute('aria-label', mark.starred ? '문제 별표 해제' : '문제에 별표하기');
    $('mark-learned').setAttribute('aria-pressed', mark.status === 'learned');
    $('mark-review').setAttribute('aria-pressed', mark.status === 'review');
    $('answer').textContent = question.answer || '';
    $('answer-notice').hidden = Boolean(question.answer);
    $('answer-notice').textContent = '이 문항은 원문에 텍스트 답안이 비어 있어요. ‘원문 보기’로 확인해 주세요.';
    $('answer-note').hidden = !question.answerNote;
    $('answer-note').textContent = question.answerNote || '';
    const visualPages = question.number === '6.82' ? question.pageNumbers : question.id === 'oral-2' ? [1] : question.imagePages;
    $('visual-reference').hidden = visualPages.length === 0;
    if ($('visual-pages').dataset.questionId !== question.id) {
      $('visual-pages').replaceChildren(...visualPages.map(page => pageFigure(question, page)));
      $('visual-pages').dataset.questionId = question.id;
    }
  }
  renderTimer();
}

function reveal() {
  if (!current()) return;
  state.answerVisible = !state.answerVisible;
  state.clock.pause();
  render();
  announce(state.answerVisible ? '교재 답안을 공개했어요.' : '답안을 숨겼어요.');
}

function next() {
  if (!current()) return;
  if (state.cursor + 1 < state.deck.length) state.cursor++;
  else { state.deck = makeDeck(selectedQuestions(), state.order); state.cursor = 0; state.cycle++; }
  resetQuestion();
  render();
  scrollToQuestion();
  announceQuestion();
}

function markStatus(status) {
  const question = current();
  if (!question) return;
  refreshMarks();
  const mark = state.marks[question.id] || {};
  saveMark(question.id, {status: mark.status === status ? 'none' : status});
  reconcileDeck();
}

function openSource() {
  const question = current();
  if (!question) return;
  const source = sourceById.get(question.source);
  $('source-dialog-title').textContent = `${source.name} · ${question.number}`;
  $('pdf-link').href = `./sources/${source.filename}#page=${question.page}`;
  $('source-pages').replaceChildren(...question.pageNumbers.map((page, index) => pageFigure(question, page, index === 0)));
  $('source-dialog').showModal();
}

function openLibrary() {
  flushSearch();
  const questions = selectedQuestions();
  $('library-title').textContent = `현재 범위의 문항 · ${questions.length}개`;
  const buttons = questions.map(question => {
    const button = document.createElement('button');
    button.className = 'library-item';
    const number = document.createElement('span'); number.className = 'item-number'; number.textContent = question.number;
    const title = document.createElement('span'); title.className = 'item-title'; title.textContent = question.question;
    const mark = document.createElement('span'); mark.className = 'item-mark';
    const status = state.marks[question.id] || {};
    mark.textContent = status.status === 'learned' ? '외움' : status.status === 'review' ? '복습' : status.starred ? '★' : '';
    button.append(number, title, mark);
    button.addEventListener('click', () => {
      const index = state.deck.indexOf(question.id);
      if (index < 0) { openLibrary(); return; }
      state.cursor = index;
      resetQuestion(); render(); $('library-dialog').close(); scrollToQuestion();
      $('question').focus({preventScroll: true}); announceQuestion();
    });
    return button;
  });
  $('library-list').replaceChildren(...buttons);
  $('library-dialog').showModal();
}

function connectEvents() {
  document.querySelectorAll('[data-source]').forEach(button => button.addEventListener('click', () => { state.source = button.dataset.source; save({source: state.source}); rebuildDeck(); }));
  $('scope').addEventListener('change', event => { state.scope = event.target.value; save({scope: state.scope}); rebuildDeck(); });
  $('kind').addEventListener('change', event => {
    state.kind = event.target.value; save({kind: state.kind});
    if (matchMedia('(max-width: 640px)').matches) document.querySelector('.settings-panel').open = false;
    rebuildDeck();
    scrollToQuestion();
  });
  $('order').addEventListener('change', event => { state.order = event.target.value; save({order: state.order}); rebuildDeck(); });
  $('duration').addEventListener('change', event => { state.duration = Number(event.target.value); save({duration: state.duration}); resetQuestion(); render(); });
  $('search').addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(flushSearch, 160); });
  $('reveal').addEventListener('click', reveal);
  $('dock-reveal').addEventListener('click', () => {
    reveal();
    if (state.answerVisible) $('answer-section').scrollIntoView({block:'start', behavior:'auto'});
    else scrollToQuestion(true);
  });
  $('apply-settings').addEventListener('click', () => {
    document.querySelector('.settings-panel').open = false;
    scrollToQuestion(true);
    $('question').focus({preventScroll:true});
    announceQuestion();
  });
  $('next').addEventListener('click', next);
  $('previous').addEventListener('click', () => { if (state.cursor > 0) { state.cursor--; resetQuestion(); render(); scrollToQuestion(); announceQuestion(); } });
  $('reset-timer').addEventListener('click', () => { resetQuestion(); render(); announce('타이머를 다시 시작했어요.'); });
  $('pause').addEventListener('click', () => { state.clock.snapshot().running ? state.clock.pause() : state.clock.resume(); renderTimer(); });
  $('star').addEventListener('click', () => {
    const question = current(); if (!question) return;
    refreshMarks();
    const mark = state.marks[question.id] || {};
    saveMark(question.id, {starred: !mark.starred});
    reconcileDeck();
  });
  $('mark-review').addEventListener('click', () => markStatus('review'));
  $('mark-learned').addEventListener('click', () => markStatus('learned'));
  $('open-source').addEventListener('click', openSource);
  $('close-source').addEventListener('click', () => $('source-dialog').close());
  $('open-library').addEventListener('click', openLibrary);
  $('close-library').addEventListener('click', () => $('library-dialog').close());
  $('show-all').addEventListener('click', () => { clearTimeout(searchTimeout); state.scope = 'all'; state.source = 'all'; state.kind = 'all'; state.query = ''; $('search').value = ''; save({scope: 'all', source: 'all', kind:'all'}); rebuildDeck(); });
  window.addEventListener('storage', event => {
    if (!persistence.handles(event)) return;
    refreshMarks();
    reconcileDeck();
    if ($('library-dialog').open) openLibrary();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,select,textarea,[contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    if (event.code === 'Space' && event.target.closest('button,a,summary')) return;
    if (event.target.closest('a,summary')) return;
    if (event.code === 'Space') { event.preventDefault(); reveal(); }
    if (event.code === 'ArrowRight') { event.preventDefault(); next(); }
    if (event.code === 'ArrowLeft' && state.cursor > 0) { event.preventDefault(); state.cursor--; resetQuestion(); render(); scrollToQuestion(); announceQuestion(); }
  });
  setInterval(() => {
    if (!current()) return;
    if (state.clock.snapshot().expired && !state.expirationHandled) {
      state.expirationHandled = true; state.answerVisible = true; state.clock.pause(); render(); announce('시간이 끝나 교재 답안을 공개했어요.');
    } else renderTimer();
  }, 150);
}

try {
  const responses = await Promise.all(['questions.json', 'supplemental.json'].map(file => fetch(`./${file}`)));
  if (responses.some(response => !response.ok)) throw new Error('Question data unavailable');
  const [original, supplemental] = await Promise.all(responses.map(response => response.json()));
  data = {...original, questions:[...original.questions, ...supplemental.questions]};
  byId = new Map(data.questions.map(question => [question.id, question]));
  sourceById = new Map(data.sources.map(source => [source.id, source]));
  persistence = new StudyStorage({getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value)}, byId.keys());
  restore();
  for (const kind of ['all', ...Object.keys(kindNames)]) {
    const count = filterQuestions(data.questions, {kind}).length;
    $('kind').querySelector(`[value="${kind}"]`).textContent = `${kind === 'all' ? '전체 섞어서' : kindNames[kind]} · ${count}문항`;
  }
  for (const source of data.sources) document.querySelector(`[data-count="${source.id}"]`).textContent = source.count;
  document.querySelector('[data-count="all"]').textContent = data.questions.length;
  if (matchMedia('(max-width: 640px)').matches) document.querySelector('.settings-panel').open = false;
  connectEvents();
  rebuildDeck();
  document.body.dataset.ready = 'true';
} catch (error) {
  $('question').textContent = '문항을 불러오지 못했어요.';
  $('thinking-hint').textContent = '사이트를 새로고침해 주세요. 로컬에서는 npm start로 실행한 주소를 열어주세요.';
  document.querySelector('.question-actions').hidden = true;
  $('next').disabled = true;
  $('previous').disabled = true;
  $('pause').disabled = true;
  $('dock-reveal').disabled = true;
  announce('문항을 불러오지 못했어요.');
  console.error(error);
}
