import { Snapshots } from './snapshots.js';

export const STORAGE_KEY   = 'mikroanalysen_v1';
export const TOMBSTONE_KEY = 'mikroanalysen_tombstones_v1';
export const SETTINGS_KEY  = 'mikroanalysen_settings_v1';
export const FEELINGS      = ['Angst', 'Trauer', 'Ärger', 'Ablehnung', 'Scham'];

// Forward-declared; defined below after makeNamedList.

function makeNamedList(KEY, contextRenameAnalyses) {
  function readRaw() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { items: {}, tombstones: {} };
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const ts = new Date().toISOString();
        const items = {};
        parsed.forEach(name => { if (typeof name === 'string' && name) items[name] = ts; });
        const migrated = { items, tombstones: {} };
        localStorage.setItem(KEY, JSON.stringify(migrated));
        return migrated;
      }
      return {
        items:      parsed && typeof parsed.items === 'object'      ? parsed.items      : {},
        tombstones: parsed && typeof parsed.tombstones === 'object' ? parsed.tombstones : {}
      };
    } catch { return { items: {}, tombstones: {} }; }
  }
  function writeRaw(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
  function aliveNames(state) {
    return Object.keys(state.items).filter(name => {
      const itemTs = state.items[name] || '';
      const tombTs = state.tombstones[name] || '';
      return itemTs > tombTs;
    });
  }
  return {
    KEY,
    get() { return aliveNames(readRaw()); },
    getRaw() { return readRaw(); },
    setRaw(state) { writeRaw(state); },
    add(name) {
      if (!name) return;
      const state = readRaw();
      state.items[name] = new Date().toISOString();
      writeRaw(state);
    },
    remove(name) {
      if (!name) return;
      const state = readRaw();
      state.tombstones[name] = new Date().toISOString();
      writeRaw(state);
    },
    rename(oldName, newName) {
      if (!newName || newName === oldName) return;
      const state = readRaw();
      const ts = new Date().toISOString();
      state.tombstones[oldName] = ts;
      state.items[newName] = ts;
      writeRaw(state);
      if (typeof contextRenameAnalyses === 'function') contextRenameAnalyses(oldName, newName);
    }
  };
}

export const CustomFeelings = makeNamedList('mikro_custom_feelings', (oldName, newName) => {
  Store.loadAll().forEach(a => {
    let changed = false;
    a.rounds.forEach(r => {
      (r.thoughts || []).forEach(t => {
        const i = (t.feelings || []).indexOf(oldName);
        if (i !== -1) { t.feelings[i] = newName; changed = true; }
      });
      const si = (r.standaloneFeelings || []).indexOf(oldName);
      if (si !== -1) { r.standaloneFeelings[si] = newName; changed = true; }
    });
    if (changed) Store.upsert(a);
  });
});

export const People = makeNamedList('mikro_people', (oldName, newName) => {
  Store.loadAll().forEach(a => {
    const arr = a.situation && Array.isArray(a.situation.contextWho) ? a.situation.contextWho : null;
    if (!arr) return;
    const i = arr.indexOf(oldName);
    if (i !== -1) { arr[i] = newName; Store.upsert(a); }
  });
});

export const Places = makeNamedList('mikro_places', (oldName, newName) => {
  Store.loadAll().forEach(a => {
    const arr = a.situation && Array.isArray(a.situation.contextWhere) ? a.situation.contextWhere : null;
    if (!arr) return;
    const i = arr.indexOf(oldName);
    if (i !== -1) { arr[i] = newName; Store.upsert(a); }
  });
});

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
