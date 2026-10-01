export const storageKey = 'rail-note-study-v1';
const statuses = ['none', 'learned', 'review'];

export class StudyStorage {
  constructor(storage, ids) {
    this.storage = storage;
    this.ids = new Set(ids);
  }
  settings() {
    const raw = this.storage.getItem(storageKey);
    try {
      const saved = JSON.parse(raw || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
  }
  key(id, field) { return `${storageKey}:${id}:${field}`; }
  read() {
    const saved = this.settings();
    const marks = {};
    for (const id of this.ids) {
      const legacy = saved.marks?.[id];
      const status = this.storage.getItem(this.key(id, 'status'));
      const starred = this.storage.getItem(this.key(id, 'starred'));
      if (!legacy && status === null && starred === null) continue;
      marks[id] = {
        status: statuses.includes(status) ? status : statuses.includes(legacy?.status) ? legacy.status : 'none',
        starred: starred === null ? legacy?.starred === true : starred === 'true'
      };
    }
    return {...saved, marks};
  }
  saveSettings(patch) {
    this.storage.setItem(storageKey, JSON.stringify({...this.settings(), ...patch}));
  }
  saveMark(id, patch) {
    if (!this.ids.has(id)) throw new Error('Unknown question ID');
    const entries = Object.entries(patch);
    if (!entries.every(([field, value]) => (field === 'status' && statuses.includes(value)) || (field === 'starred' && typeof value === 'boolean'))) throw new Error('Invalid learning mark');
    for (const [field, value] of entries) this.storage.setItem(this.key(id, field), String(value));
  }
  handles(event) { return event.key === null || event.key === storageKey || event.key?.startsWith(`${storageKey}:`); }
}
