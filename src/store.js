import { Snapshots } from './snapshots.js';

export const STORAGE_KEY   = 'mikroanalysen_v1';
export const TOMBSTONE_KEY = 'mikroanalysen_tombstones_v1';
export const SETTINGS_KEY  = 'mikroanalysen_settings_v1';
export const FEELINGS      = ['Angst', 'Trauer', 'Ärger', 'Ablehnung', 'Scham'];

export const CustomFeelings = {
  KEY: 'mikro_custom_feelings',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch { return []; } },
  add(f) {
    if (!f) return;
    const list = this.get();
    if (!list.includes(f)) { list.push(f); localStorage.setItem(this.KEY, JSON.stringify(list)); }
  },
  remove(f) {
    localStorage.setItem(this.KEY, JSON.stringify(this.get().filter(x => x !== f)));
  },
  rename(oldF, newF) {
    if (!newF || newF === oldF) return;
    const list = this.get();
    const idx = list.indexOf(oldF);
    if (idx !== -1) { list[idx] = newF; localStorage.setItem(this.KEY, JSON.stringify(list)); }
    Store.loadAll().forEach(a => {
      let changed = false;
      a.rounds.forEach(r => {
        (r.thoughts || []).forEach(t => {
          const i = (t.feelings || []).indexOf(oldF);
          if (i !== -1) { t.feelings[i] = newF; changed = true; }
        });
        const si = (r.standaloneFeelings || []).indexOf(oldF);
        if (si !== -1) { r.standaloneFeelings[si] = newF; changed = true; }
      });
      if (changed) Store.upsert(a);
    });
  }
};

export const Store = {
  _cache: null,
  // Injected by main.js after all modules are loaded; called after every write.
  _onWrite: () => {},

  loadAll() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { this._cache = []; return this._cache; }
      const data = JSON.parse(raw);
      this._cache = Array.isArray(data) ? data : [];
      return this._cache;
    } catch (e) {
      console.error('Speicher-Lesefehler', e);
      this._cache = [];
      return this._cache;
    }
  },
  saveAll(list) {
    this._cache = list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  },
  upsert(analysis) {
    const list = this.loadAll();
    const idx  = list.findIndex(a => a.id === analysis.id);
    analysis.updatedAt = new Date().toISOString();
    if (idx >= 0) list[idx] = analysis;
    else list.unshift(analysis);
    this.saveAll(list);
    Snapshots.push(analysis);
    this._onWrite();
  },
  remove(id) {
    const list = this.loadAll().filter(a => a.id !== id);
    this.saveAll(list);
    Snapshots.remove(id);
    const tomb = this.loadTombstones();
    tomb[id] = new Date().toISOString();
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(tomb));
    this._onWrite();
  },
  get(id) {
    return this.loadAll().find(a => a.id === id) || null;
  },
  invalidateCache() {
    this._cache = null;
  },
  loadTombstones() {
    try { return JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  },
  saveTombstones(tomb) {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(tomb));
  },
  loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  },
  saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }
};
