export function makeDeck(questions, order = 'shuffle', random = Math.random) {
  const deck = questions.map(question => question.id);
  if (order === 'shuffle') {
    for (let index = deck.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [deck[index], deck[other]] = [deck[other], deck[index]];
    }
  }
  return deck;
}

export function filterQuestions(questions, {source = 'all', scope = 'all', query = ''}, marks = {}) {
  const search = query.normalize('NFC').trim().toLocaleLowerCase('ko-KR');
  return questions.filter(question => {
    const mark = marks[question.id] || {};
    if (source !== 'all' && question.source !== source) return false;
    if (scope === 'review' && mark.status !== 'review') return false;
    if (scope === 'starred' && !mark.starred) return false;
    if (scope === 'unlearned' && mark.status === 'learned') return false;
    return !search || `${question.number} ${question.question} ${question.answer}`.normalize('NFC').toLocaleLowerCase('ko-KR').includes(search);
  });
}

export class Countdown {
  constructor(seconds = 60, now = Date.now) {
    this.now = now;
    this.reset(seconds);
  }
  reset(seconds = this.duration) {
    this.duration = seconds;
    this.remainingMs = seconds * 1000;
    this.running = seconds > 0;
    this.deadline = this.now() + this.remainingMs;
  }
  snapshot() {
    const remainingMs = this.running ? Math.max(0, this.deadline - this.now()) : this.remainingMs;
    return {remaining: Math.ceil(remainingMs / 1000), remainingMs, running: this.running && remainingMs > 0, expired: this.duration > 0 && remainingMs === 0, duration: this.duration};
  }
  pause() {
    this.remainingMs = this.snapshot().remainingMs;
    this.running = false;
  }
  resume() {
    if (this.duration === 0 || this.remainingMs <= 0) return;
    this.deadline = this.now() + this.remainingMs;
    this.running = true;
  }
}
