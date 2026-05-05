'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
});

// ─── Store.loadAll ────────────────────────────────────────────────

describe('Store.loadAll', () => {
  test('returns empty array when localStorage is empty', () => {
    const result = global.Store.loadAll();
    expect(result).toEqual([]);
  });

  test('parses JSON array from localStorage', () => {
    const data = [{ id: 'a_1', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', situation: { mood: 50 }, rounds: [] }];
    global.localStorage.setItem('mikroanalysen_v1', JSON.stringify(data));
    global.Store.invalidateCache();
    const result = global.Store.loadAll();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a_1');
  });

  test('returns empty array when localStorage contains non-array JSON', () => {
    global.localStorage.setItem('mikroanalysen_v1', JSON.stringify({ not: 'an array' }));
    global.Store.invalidateCache();
    const result = global.Store.loadAll();
    expect(result).toEqual([]);
  });

  test('returns empty array on malformed JSON', () => {
    global.localStorage.setItem('mikroanalysen_v1', 'NOT_VALID_JSON{{{');
    global.Store.invalidateCache();
    const result = global.Store.loadAll();
    expect(result).toEqual([]);
  });

  test('uses in-memory cache on second call', () => {
    const data = [{ id: 'a_cache', situation: {}, rounds: [] }];
    global.localStorage.setItem('mikroanalysen_v1', JSON.stringify(data));
    global.Store.invalidateCache();
    const first = global.Store.loadAll();
    // Overwrite localStorage to prove cache is used
    global.localStorage.setItem('mikroanalysen_v1', JSON.stringify([]));
    const second = global.Store.loadAll();
    expect(second).toBe(first); // same reference
    expect(second).toHaveLength(1);
  });
});

// ─── Store.saveAll ────────────────────────────────────────────────

describe('Store.saveAll', () => {
  test('persists list to localStorage', () => {
    const list = [{ id: 'a_x', situation: {}, rounds: [] }];
    global.Store.saveAll(list);
    const raw = global.localStorage.getItem('mikroanalysen_v1');
    expect(JSON.parse(raw)).toEqual(list);
  });

  test('updates in-memory cache', () => {
    const list = [{ id: 'a_y', situation: {}, rounds: [] }];
    global.Store.saveAll(list);
    // loadAll should return from cache (same reference)
    expect(global.Store.loadAll()).toBe(list);
  });

  test('clears cache after invalidateCache', () => {
    const list = [{ id: 'a_z', situation: {}, rounds: [] }];
    global.Store.saveAll(list);
    global.Store.invalidateCache();
    // Now localStorage still has the data, so loadAll re-reads it
    const loaded = global.Store.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('a_z');
  });
});

// ─── Store.upsert ─────────────────────────────────────────────────

describe('Store.upsert', () => {
  test('adds a new analysis at the beginning of the list', () => {
    const a1 = { id: 'a_1', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', situation: { mood: 50 }, rounds: [] };
    global.Store.upsert(a1);
    const list = global.Store.loadAll();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('a_1');
  });

  test('updates existing analysis in-place', () => {
    const a1 = { id: 'a_1', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', situation: { mood: 50, need: '' }, rounds: [] };
    global.Store.upsert(a1);
    const a1Updated = { ...a1, situation: { ...a1.situation, need: 'Ruhe' } };
    global.Store.upsert(a1Updated);
    const list = global.Store.loadAll();
    expect(list).toHaveLength(1);
    expect(list[0].situation.need).toBe('Ruhe');
  });

  test('sets updatedAt timestamp on upsert', () => {
    const before = new Date().toISOString();
    const a = { id: 'a_ts', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', situation: {}, rounds: [] };
    global.Store.upsert(a);
    const stored = global.Store.get('a_ts');
    expect(stored.updatedAt >= before).toBe(true);
  });

  test('prepends new entry (unshift) to list', () => {
    const a1 = { id: 'a_first', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', situation: {}, rounds: [] };
    const a2 = { id: 'a_second', createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z', situation: {}, rounds: [] };
    global.Store.upsert(a1);
    global.Store.upsert(a2);
    const list = global.Store.loadAll();
    expect(list[0].id).toBe('a_second');
    expect(list[1].id).toBe('a_first');
  });
});

// ─── Store.get ────────────────────────────────────────────────────

describe('Store.get', () => {
  test('returns analysis by id', () => {
    const a = { id: 'a_get', situation: {}, rounds: [] };
    global.Store.upsert(a);
    const found = global.Store.get('a_get');
    expect(found).not.toBeNull();
    expect(found.id).toBe('a_get');
  });

  test('returns null if id does not exist', () => {
    const result = global.Store.get('nonexistent');
    expect(result).toBeNull();
  });
});

// ─── Store.remove ─────────────────────────────────────────────────

describe('Store.remove', () => {
  test('removes analysis by id from list', () => {
    const a = { id: 'a_rm', situation: {}, rounds: [] };
    global.Store.upsert(a);
    global.Store.remove('a_rm');
    expect(global.Store.get('a_rm')).toBeNull();
  });

  test('writes tombstone to localStorage', () => {
    const a = { id: 'a_tomb', situation: {}, rounds: [] };
    global.Store.upsert(a);
    global.Store.remove('a_tomb');
    const tombs = global.Store.loadTombstones();
    expect(tombs['a_tomb']).toBeDefined();
    expect(typeof tombs['a_tomb']).toBe('string');
  });

  test('ignores removing nonexistent id gracefully', () => {
    expect(() => global.Store.remove('a_does_not_exist')).not.toThrow();
  });
});

// ─── Store.loadTombstones / saveTombstones ─────────────────────────

describe('Store.loadTombstones', () => {
  test('returns empty object when no tombstones saved', () => {
    expect(global.Store.loadTombstones()).toEqual({});
  });

  test('returns saved tombstones', () => {
    const tombs = { 'a_1': '2024-01-01T00:00:00.000Z' };
    global.Store.saveTombstones(tombs);
    expect(global.Store.loadTombstones()).toEqual(tombs);
  });

  test('returns empty object on malformed JSON', () => {
    global.localStorage.setItem('mikroanalysen_tombstones_v1', 'INVALID{{{');
    expect(global.Store.loadTombstones()).toEqual({});
  });
});

// ─── Store.loadSettings / saveSettings ────────────────────────────

describe('Store.loadSettings', () => {
  test('returns empty object when no settings saved', () => {
    expect(global.Store.loadSettings()).toEqual({});
  });

  test('returns saved settings', () => {
    global.Store.saveSettings({ clientId: 'test-uuid', lastSyncAt: '2024-01-01T00:00:00.000Z' });
    const s = global.Store.loadSettings();
    expect(s.clientId).toBe('test-uuid');
    expect(s.lastSyncAt).toBe('2024-01-01T00:00:00.000Z');
  });

  test('returns empty object on malformed JSON', () => {
    global.localStorage.setItem('mikroanalysen_settings_v1', 'bad json{{');
    expect(global.Store.loadSettings()).toEqual({});
  });
});

// ─── Store.invalidateCache ────────────────────────────────────────

describe('Store.invalidateCache', () => {
  test('forces re-read from localStorage on next loadAll', () => {
    const a = { id: 'a_inv', situation: {}, rounds: [] };
    global.Store.saveAll([a]);
    // Replace localStorage content without going through saveAll
    const b = { id: 'a_new', situation: {}, rounds: [] };
    global.localStorage.setItem('mikroanalysen_v1', JSON.stringify([b]));
    global.Store.invalidateCache();
    const list = global.Store.loadAll();
    expect(list[0].id).toBe('a_new');
  });
});
