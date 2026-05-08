'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
});

// ─── newAnalysis ──────────────────────────────────────────────────

describe('newAnalysis', () => {
  test('returns object with required top-level fields', () => {
    const a = global.newAnalysis();
    expect(a).toHaveProperty('id');
    expect(a).toHaveProperty('createdAt');
    expect(a).toHaveProperty('updatedAt');
    expect(a).toHaveProperty('defaultStarter');
    expect(a).toHaveProperty('situation');
    expect(a).toHaveProperty('rounds');
  });

  test('id starts with "a_"', () => {
    const a = global.newAnalysis();
    expect(a.id).toMatch(/^a_/);
  });

  test('id is unique per call', () => {
    const a1 = global.newAnalysis();
    const a2 = global.newAnalysis();
    expect(a1.id).not.toBe(a2.id);
  });

  test('rounds is empty array', () => {
    const a = global.newAnalysis();
    expect(Array.isArray(a.rounds)).toBe(true);
    expect(a.rounds).toHaveLength(0);
  });

  test('defaultStarter is null', () => {
    const a = global.newAnalysis();
    expect(a.defaultStarter).toBeNull();
  });

  test('situation has all required fields', () => {
    const a = global.newAnalysis();
    const s = a.situation;
    expect(s).toHaveProperty('datetime');
    expect(s).toHaveProperty('mood');
    expect(s).toHaveProperty('need');
    expect(s).toHaveProperty('context');
    expect(s).toHaveProperty('contextWhat');
    expect(s).toHaveProperty('contextWho');
    expect(s).toHaveProperty('contextWhere');
  });

  test('situation.mood defaults to 50', () => {
    const a = global.newAnalysis();
    expect(a.situation.mood).toBe(50);
  });

  test('situation.datetime is in datetime-local format (YYYY-MM-DDTHH:MM)', () => {
    const a = global.newAnalysis();
    // Should match YYYY-MM-DDTHH:MM (no seconds)
    expect(a.situation.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test('createdAt and updatedAt are valid ISO strings', () => {
    const a = global.newAnalysis();
    expect(() => new Date(a.createdAt)).not.toThrow();
    expect(() => new Date(a.updatedAt)).not.toThrow();
    expect(isNaN(new Date(a.createdAt).getTime())).toBe(false);
  });

  test('situation default fields have correct types', () => {
    const a = global.newAnalysis();
    expect(a.situation.need).toBe('');
    expect(a.situation.context).toBe('');
    expect(a.situation.contextWhat).toBe('');
    expect(a.situation.contextWho).toEqual([]);
    expect(a.situation.contextWhere).toEqual([]);
  });
});

// ─── newRound ────────────────────────────────────────────────────

describe('newRound', () => {
  test('creates round with starter="ip"', () => {
    const r = global.newRound('ip');
    expect(r.starter).toBe('ip');
  });

  test('creates round with starter="me"', () => {
    const r = global.newRound('me');
    expect(r.starter).toBe('me');
  });

  test('id starts with "r_"', () => {
    const r = global.newRound('ip');
    expect(r.id).toMatch(/^r_/);
  });

  test('id is unique per call', () => {
    const r1 = global.newRound('ip');
    const r2 = global.newRound('ip');
    expect(r1.id).not.toBe(r2.id);
  });

  test('all required fields are present', () => {
    const r = global.newRound('me');
    expect(r).toHaveProperty('id');
    expect(r).toHaveProperty('starter');
    expect(r).toHaveProperty('ipBehavior');
    expect(r).toHaveProperty('ipBehaviorVerbal');
    expect(r).toHaveProperty('ipBehaviorNonverbal');
    expect(r).toHaveProperty('interpretation');
    expect(r).toHaveProperty('thoughts');
    expect(r).toHaveProperty('tension');
    expect(r).toHaveProperty('need');
    expect(r).toHaveProperty('myBehavior');
    expect(r).toHaveProperty('myBehaviorVerbal');
    expect(r).toHaveProperty('myBehaviorNonverbal');
    expect(r).toHaveProperty('desiredEffect');
  });

  test('thoughts is an empty array', () => {
    const r = global.newRound('ip');
    expect(Array.isArray(r.thoughts)).toBe(true);
    expect(r.thoughts).toHaveLength(0);
  });

  test('tension defaults to 50', () => {
    const r = global.newRound('ip');
    expect(r.tension).toBe(50);
  });

  test('string fields default to empty string', () => {
    const r = global.newRound('me');
    expect(r.ipBehavior).toBe('');
    expect(r.ipBehaviorVerbal).toBe('');
    expect(r.ipBehaviorNonverbal).toBe('');
    expect(r.interpretation).toBe('');
    expect(r.need).toBe('');
    expect(r.myBehavior).toBe('');
    expect(r.myBehaviorVerbal).toBe('');
    expect(r.myBehaviorNonverbal).toBe('');
    expect(r.desiredEffect).toBe('');
  });
});

// ─── newThought ───────────────────────────────────────────────────

describe('newThought', () => {
  test('id starts with "t_"', () => {
    const t = global.newThought();
    expect(t.id).toMatch(/^t_/);
  });

  test('id is unique per call', () => {
    const t1 = global.newThought();
    const t2 = global.newThought();
    expect(t1.id).not.toBe(t2.id);
  });

  test('has required fields', () => {
    const t = global.newThought();
    expect(t).toHaveProperty('id');
    expect(t).toHaveProperty('text');
    expect(t).toHaveProperty('feelings');
  });

  test('text defaults to empty string', () => {
    const t = global.newThought();
    expect(t.text).toBe('');
  });

  test('feelings is empty array', () => {
    const t = global.newThought();
    expect(Array.isArray(t.feelings)).toBe(true);
    expect(t.feelings).toHaveLength(0);
  });

  test('has no feelingsOther field', () => {
    const t = global.newThought();
    expect(t).not.toHaveProperty('feelingsOther');
  });
});

// ─── migrateRound ────────────────────────────────────────────────

describe('migrateRound', () => {
  test('already migrated (thoughts is array) → returns round unchanged', () => {
    const r = global.newRound('ip');
    r.thoughts = [{ id: 't_1', text: 'existing', feelings: ['Angst'], feelingsOther: '' }];
    const result = global.migrateRound(r);
    expect(result).toBe(r); // same reference
    expect(result.thoughts).toHaveLength(1);
    expect(result.thoughts[0].text).toBe('existing');
  });

  test('old format with thought/feelings/feelingsOther → migrated to thoughts array', () => {
    const r = global.newRound('ip');
    delete r.thoughts;
    r.thought = 'Ich dachte daran';
    r.feelings = ['Angst', 'Trauer'];
    r.feelingsOther = 'Schuld';

    const result = global.migrateRound(r);
    expect(Array.isArray(result.thoughts)).toBe(true);
    expect(result.thoughts).toHaveLength(1);
    const t = result.thoughts[0];
    expect(t.text).toBe('Ich dachte daran');
    // feelingsOther is merged into feelings during migration
    expect(t.feelings).toEqual(['Angst', 'Trauer', 'Schuld']);
    expect(t).not.toHaveProperty('feelingsOther');
  });

  test('old format with empty thought/feelings → thoughts stays empty array', () => {
    const r = global.newRound('me');
    delete r.thoughts;
    r.thought = '';
    r.feelings = [];
    r.feelingsOther = '';

    const result = global.migrateRound(r);
    expect(Array.isArray(result.thoughts)).toBe(true);
    expect(result.thoughts).toHaveLength(0);
  });

  test('migration removes legacy fields', () => {
    const r = global.newRound('ip');
    delete r.thoughts;
    r.thought = 'Ein Gedanke';
    r.feelings = ['Ärger'];
    r.feelingsOther = '';

    global.migrateRound(r);
    expect(r).not.toHaveProperty('thought');
    expect(r).not.toHaveProperty('feelings');
    expect(r).not.toHaveProperty('feelingsOther');
  });

  test('old format with feelings array (non-empty) but no text → migrates to one thought', () => {
    const r = global.newRound('ip');
    delete r.thoughts;
    r.thought = '';
    r.feelings = ['Scham'];
    r.feelingsOther = '';

    const result = global.migrateRound(r);
    expect(result.thoughts).toHaveLength(1);
    expect(result.thoughts[0].feelings).toEqual(['Scham']);
  });

  test('old format with non-array feelings → defaults to empty array', () => {
    const r = global.newRound('ip');
    delete r.thoughts;
    r.thought = 'Test';
    r.feelings = null; // invalid
    r.feelingsOther = '';

    const result = global.migrateRound(r);
    expect(Array.isArray(result.thoughts[0].feelings)).toBe(true);
    expect(result.thoughts[0].feelings).toHaveLength(0);
  });

  test('double migration does not change data', () => {
    const r = global.newRound('ip');
    delete r.thoughts;
    r.thought = 'Gedanke';
    r.feelings = ['Angst'];
    r.feelingsOther = '';

    global.migrateRound(r);
    const countAfterFirst = r.thoughts.length;
    // Second migration: thoughts is already array, so it returns immediately
    global.migrateRound(r);
    expect(r.thoughts).toHaveLength(countAfterFirst);
  });
});
