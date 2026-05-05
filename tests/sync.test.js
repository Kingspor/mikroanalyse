'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
});

// Helper: create a minimal analysis object
function makeAnalysis(id, updatedAt, createdAt) {
  return {
    id,
    createdAt: createdAt || updatedAt,
    updatedAt: updatedAt,
    situation: { datetime: '2024-01-01T10:00', mood: 50, need: '', context: '', contextWhat: '', contextWho: '', contextWhere: '' },
    rounds: []
  };
}

describe('Sync.mergeBundles', () => {
  test('both empty → returns empty merged list and no tombstones', () => {
    const local = { list: [], tombstones: {} };
    const remote = { list: [], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list).toEqual([]);
    expect(result.tombstones).toEqual({});
  });

  test('disjunct IDs → both survive in merged list', () => {
    const a1 = makeAnalysis('a_1', '2024-01-01T10:00:00.000Z');
    const a2 = makeAnalysis('a_2', '2024-01-02T10:00:00.000Z');
    const local = { list: [a1], tombstones: {} };
    const remote = { list: [a2], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list).toHaveLength(2);
    const ids = result.list.map(a => a.id);
    expect(ids).toContain('a_1');
    expect(ids).toContain('a_2');
  });

  test('same ID, local newer → local wins', () => {
    const localA = makeAnalysis('a_1', '2024-06-01T12:00:00.000Z');
    const remoteA = makeAnalysis('a_1', '2024-01-01T10:00:00.000Z');
    localA.situation.need = 'local-need';
    remoteA.situation.need = 'remote-need';
    const local = { list: [localA], tombstones: {} };
    const remote = { list: [remoteA], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list).toHaveLength(1);
    expect(result.list[0].situation.need).toBe('local-need');
  });

  test('same ID, remote newer → remote wins', () => {
    const localA = makeAnalysis('a_1', '2024-01-01T10:00:00.000Z');
    const remoteA = makeAnalysis('a_1', '2024-06-01T12:00:00.000Z');
    localA.situation.need = 'local-need';
    remoteA.situation.need = 'remote-need';
    const local = { list: [localA], tombstones: {} };
    const remote = { list: [remoteA], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list).toHaveLength(1);
    expect(result.list[0].situation.need).toBe('remote-need');
  });

  test('tombstone removes existing entry (entry older than tombstone)', () => {
    const a1 = makeAnalysis('a_del', '2024-01-01T10:00:00.000Z');
    const tombTs = '2024-06-01T00:00:00.000Z'; // newer than entry
    const local = { list: [a1], tombstones: { 'a_del': tombTs } };
    const remote = { list: [], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list).toHaveLength(0);
    expect(result.tombstones['a_del']).toBe(tombTs);
  });

  test('entry newer than tombstone → entry survives, tombstone removed', () => {
    const a1 = makeAnalysis('a_alive', '2024-09-01T10:00:00.000Z'); // newer than tombstone
    const tombTs = '2024-01-01T00:00:00.000Z'; // older than entry
    const local = { list: [a1], tombstones: { 'a_alive': tombTs } };
    const remote = { list: [], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    // Entry should survive
    expect(result.list).toHaveLength(1);
    expect(result.list[0].id).toBe('a_alive');
    // Tombstone should be removed
    expect(result.tombstones['a_alive']).toBeUndefined();
  });

  test('tombstone only in local → propagated to merged result', () => {
    const tombTs = '2024-06-01T00:00:00.000Z';
    const local = { list: [], tombstones: { 'a_gone': tombTs } };
    const remote = { list: [], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.tombstones['a_gone']).toBe(tombTs);
  });

  test('tombstone only in remote → propagated to merged result', () => {
    const tombTs = '2024-06-01T00:00:00.000Z';
    const local = { list: [], tombstones: {} };
    const remote = { list: [], tombstones: { 'a_remote_gone': tombTs } };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.tombstones['a_remote_gone']).toBe(tombTs);
  });

  test('tombstone in both local and remote → newer timestamp wins', () => {
    const localTs = '2024-01-01T00:00:00.000Z';
    const remoteTs = '2024-09-01T00:00:00.000Z'; // remote is newer
    const local = { list: [], tombstones: { 'a_both': localTs } };
    const remote = { list: [], tombstones: { 'a_both': remoteTs } };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.tombstones['a_both']).toBe(remoteTs);
  });

  test('tombstone in both local and remote → local timestamp wins when newer', () => {
    const localTs = '2024-09-01T00:00:00.000Z'; // local is newer
    const remoteTs = '2024-01-01T00:00:00.000Z';
    const local = { list: [], tombstones: { 'a_both': localTs } };
    const remote = { list: [], tombstones: { 'a_both': remoteTs } };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.tombstones['a_both']).toBe(localTs);
  });

  test('remote entry only (not in local) gets added', () => {
    const remoteA = makeAnalysis('a_remote_only', '2024-01-01T10:00:00.000Z');
    const local = { list: [], tombstones: {} };
    const remote = { list: [remoteA], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list).toHaveLength(1);
    expect(result.list[0].id).toBe('a_remote_only');
  });

  test('merged list is sorted by updatedAt descending', () => {
    const a1 = makeAnalysis('a_old', '2024-01-01T10:00:00.000Z');
    const a2 = makeAnalysis('a_mid', '2024-06-01T10:00:00.000Z');
    const a3 = makeAnalysis('a_new', '2024-12-01T10:00:00.000Z');
    const local = { list: [a1, a3], tombstones: {} };
    const remote = { list: [a2], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list[0].id).toBe('a_new');
    expect(result.list[1].id).toBe('a_mid');
    expect(result.list[2].id).toBe('a_old');
  });

  test('handles missing tombstones gracefully (null/undefined)', () => {
    const a1 = makeAnalysis('a_1', '2024-01-01T10:00:00.000Z');
    const local = { list: [a1] }; // no tombstones key
    const remote = { list: [] };  // no tombstones key
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list).toHaveLength(1);
    expect(result.tombstones).toEqual({});
  });

  test('uses createdAt as fallback when updatedAt is missing', () => {
    const localA = { id: 'a_1', createdAt: '2024-06-01T10:00:00.000Z', situation: {}, rounds: [] };
    const remoteA = { id: 'a_1', createdAt: '2024-01-01T10:00:00.000Z', situation: { need: 'remote' }, rounds: [] };
    const local = { list: [localA], tombstones: {} };
    const remote = { list: [remoteA], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    // local has newer createdAt so local wins
    expect(result.list[0].situation.need).toBeUndefined(); // local wins
  });

  test('tombstone kills entry arriving from remote', () => {
    const remoteA = makeAnalysis('a_killed', '2024-01-01T10:00:00.000Z');
    const tombTs = '2024-06-01T00:00:00.000Z'; // newer than entry
    const local = { list: [], tombstones: { 'a_killed': tombTs } };
    const remote = { list: [remoteA], tombstones: {} };
    const result = global.Sync.mergeBundles(local, remote);
    expect(result.list).toHaveLength(0);
  });
});
