'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
  // Clear custom feelings key specifically
  global.localStorage.removeItem('mikro_custom_feelings');
});

const KEY = 'mikro_custom_feelings';

describe('CustomFeelings.get', () => {
  test('returns empty array when nothing stored', () => {
    const result = global.CustomFeelings.get();
    expect(result).toEqual([]);
  });

  test('returns stored feelings', () => {
    global.localStorage.setItem(KEY, JSON.stringify(['Schuld', 'Freude']));
    const result = global.CustomFeelings.get();
    expect(result).toEqual(['Schuld', 'Freude']);
  });

  test('returns empty array on malformed JSON', () => {
    global.localStorage.setItem(KEY, 'NOT_JSON{{{');
    const result = global.CustomFeelings.get();
    expect(result).toEqual([]);
  });

  test('returns empty array for empty JSON array', () => {
    global.localStorage.setItem(KEY, '[]');
    const result = global.CustomFeelings.get();
    expect(result).toEqual([]);
  });
});

describe('CustomFeelings.add', () => {
  test('adds a new feeling', () => {
    global.CustomFeelings.add('Schuld');
    const result = global.CustomFeelings.get();
    expect(result).toContain('Schuld');
  });

  test('does not add duplicate feeling', () => {
    global.CustomFeelings.add('Schuld');
    global.CustomFeelings.add('Schuld');
    const result = global.CustomFeelings.get();
    expect(result).toHaveLength(1);
    expect(result).toEqual(['Schuld']);
  });

  test('does nothing for empty string', () => {
    global.CustomFeelings.add('');
    expect(global.CustomFeelings.get()).toEqual([]);
  });

  test('does nothing for null', () => {
    global.CustomFeelings.add(null);
    expect(global.CustomFeelings.get()).toEqual([]);
  });

  test('does nothing for undefined', () => {
    global.CustomFeelings.add(undefined);
    expect(global.CustomFeelings.get()).toEqual([]);
  });

  test('accumulates multiple unique feelings', () => {
    global.CustomFeelings.add('Schuld');
    global.CustomFeelings.add('Freude');
    global.CustomFeelings.add('Stolz');
    const result = global.CustomFeelings.get();
    expect(result).toHaveLength(3);
    expect(result).toEqual(['Schuld', 'Freude', 'Stolz']);
  });

  test('persists across get() calls', () => {
    global.CustomFeelings.add('Neugier');
    // get() re-reads from localStorage
    const raw = global.localStorage.getItem(KEY);
    expect(Object.keys(JSON.parse(raw).items || {})).toContain('Neugier');
  });
});
