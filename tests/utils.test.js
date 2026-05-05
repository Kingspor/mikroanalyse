'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
});

// ─── escapeHtml ───────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('returns empty string for falsy values', () => {
    expect(global.escapeHtml('')).toBe('');
    expect(global.escapeHtml(null)).toBe('');
    expect(global.escapeHtml(undefined)).toBe('');
    expect(global.escapeHtml(0)).toBe('');
  });

  test('escapes ampersand', () => {
    expect(global.escapeHtml('a & b')).toBe('a &amp; b');
  });

  test('escapes less-than', () => {
    expect(global.escapeHtml('<tag>')).toBe('&lt;tag&gt;');
  });

  test('escapes greater-than', () => {
    expect(global.escapeHtml('3 > 2')).toBe('3 &gt; 2');
  });

  test('escapes double-quote', () => {
    expect(global.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  test('escapes single-quote', () => {
    expect(global.escapeHtml("it's")).toBe('it&#039;s');
  });

  test('escapes multiple entities in one string', () => {
    const result = global.escapeHtml('<script>alert("XSS & \'stuff\'");</script>');
    expect(result).toBe('&lt;script&gt;alert(&quot;XSS &amp; &#039;stuff&#039;&quot;);&lt;/script&gt;');
  });

  test('passes through plain text unchanged', () => {
    expect(global.escapeHtml('Hello World')).toBe('Hello World');
  });

  test('coerces numbers to string', () => {
    expect(global.escapeHtml(42)).toBe('42');
  });
});

// ─── escapeAttr ───────────────────────────────────────────────────

describe('escapeAttr', () => {
  test('returns empty string for falsy values', () => {
    expect(global.escapeAttr('')).toBe('');
    expect(global.escapeAttr(null)).toBe('');
    expect(global.escapeAttr(undefined)).toBe('');
  });

  test('escapes ampersand', () => {
    expect(global.escapeAttr('a & b')).toBe('a &amp; b');
  });

  test('escapes double-quote', () => {
    expect(global.escapeAttr('say "hello"')).toBe('say &quot;hello&quot;');
  });

  test('escapes single-quote', () => {
    expect(global.escapeAttr("it's")).toBe('it&#039;s');
  });

  test('escapes less-than and greater-than', () => {
    expect(global.escapeAttr('<b>')).toBe('&lt;b&gt;');
  });

  test('escapes complex attribute value', () => {
    const result = global.escapeAttr('value="<a & b>"');
    expect(result).toBe('value=&quot;&lt;a &amp; b&gt;&quot;');
  });

  test('passes through plain text unchanged', () => {
    expect(global.escapeAttr('hello world')).toBe('hello world');
  });
});

// ─── formatDateTime ───────────────────────────────────────────────

describe('formatDateTime', () => {
  test('returns em-dash for falsy input', () => {
    expect(global.formatDateTime('')).toBe('–');
    expect(global.formatDateTime(null)).toBe('–');
    expect(global.formatDateTime(undefined)).toBe('–');
  });

  test('formats a valid ISO date string with date and time parts separated by ·', () => {
    const result = global.formatDateTime('2024-03-15T14:30');
    // Should contain the separator dot and time-like part
    expect(result).toContain('·');
    expect(result).toContain('2024');
    // Time part (14:30 or locale-equivalent)
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  test('returns escaped original string for invalid date', () => {
    const result = global.formatDateTime('not-a-date');
    // escapeHtml of 'not-a-date' = 'not-a-date' (no special chars)
    expect(result).toBe('not-a-date');
  });

  test('returns escaped string for partially invalid date', () => {
    const result = global.formatDateTime('<invalid>');
    // escapeHtml should escape the < and >
    expect(result).toBe('&lt;invalid&gt;');
  });

  test('formats datetime-local format (no seconds)', () => {
    const result = global.formatDateTime('2025-01-01T09:05');
    expect(result).toContain('·');
    expect(result).toContain('2025');
  });

  test('includes month name in German locale', () => {
    const result = global.formatDateTime('2024-12-25T10:00');
    // German month for December
    expect(result).toMatch(/Dezember|Dec|12/);
  });
});
