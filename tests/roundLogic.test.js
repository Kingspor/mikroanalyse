'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
  // Reset dom to have app element and required fields
  document.body.innerHTML = `
    <div id="app"></div>
    <div class="sheet-backdrop" id="sheet-backdrop"></div>
    <div class="sheet" id="sheet"><div id="sheet-content"></div></div>
    <div class="toast" id="toast"></div>
  `;
});

// ─── getRoundSequence ─────────────────────────────────────────────

describe('getRoundSequence', () => {
  test('returns correct sequence for starter="ip"', () => {
    const seq = global.getRoundSequence('ip');
    expect(seq).toEqual(['ipBehavior', 'interpretation', 'thoughts', 'tension', 'need', 'myBehavior', 'desiredEffect', 'done']);
  });

  test('returns correct sequence for starter="me"', () => {
    const seq = global.getRoundSequence('me');
    expect(seq).toEqual(['interpretation', 'thoughts', 'tension', 'need', 'myBehavior', 'desiredEffect', 'ipNext', 'done']);
  });

  test('ip sequence starts with ipBehavior', () => {
    const seq = global.getRoundSequence('ip');
    expect(seq[0]).toBe('ipBehavior');
  });

  test('me sequence starts with interpretation', () => {
    const seq = global.getRoundSequence('me');
    expect(seq[0]).toBe('interpretation');
  });

  test('both sequences end with "done"', () => {
    expect(global.getRoundSequence('ip').at(-1)).toBe('done');
    expect(global.getRoundSequence('me').at(-1)).toBe('done');
  });

  test('ip sequence has 8 steps', () => {
    expect(global.getRoundSequence('ip')).toHaveLength(8);
  });

  test('me sequence has 8 steps', () => {
    expect(global.getRoundSequence('me')).toHaveLength(8);
  });

  test('ip sequence includes interpretation (mandatory)', () => {
    expect(global.getRoundSequence('ip')).toContain('interpretation');
  });

  test('me sequence includes interpretation (optional)', () => {
    expect(global.getRoundSequence('me')).toContain('interpretation');
  });

  test('me sequence includes ipNext', () => {
    expect(global.getRoundSequence('me')).toContain('ipNext');
  });

  test('ip sequence does not include ipNext', () => {
    expect(global.getRoundSequence('ip')).not.toContain('ipNext');
  });
});

// ─── totalRoundSteps ──────────────────────────────────────────────

describe('totalRoundSteps', () => {
  test('returns 8 for ip-starter round', () => {
    const r = global.newRound('ip');
    expect(global.totalRoundSteps(r)).toBe(8);
  });

  test('returns 8 for me-starter round', () => {
    const r = global.newRound('me');
    expect(global.totalRoundSteps(r)).toBe(8);
  });
});

// ─── saveRoundField ───────────────────────────────────────────────

describe('saveRoundField', () => {
  function mountInput(id, value, tagName = 'input') {
    const el = document.createElement(tagName);
    el.id = id;
    el.value = value;
    document.body.appendChild(el);
    return el;
  }

  afterEach(() => {
    // Remove any mounted test inputs
    ['f-val', 'f-verbal', 'f-nonverbal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  });

  test('saves tension from f-val input (clamped to 0-100)', () => {
    const r = global.newRound('ip');
    mountInput('f-val', '75');
    global.saveRoundField(r, 'tension');
    expect(r.tension).toBe(75);
  });

  test('tension defaults to 50 for invalid input', () => {
    const r = global.newRound('ip');
    mountInput('f-val', 'abc');
    global.saveRoundField(r, 'tension');
    expect(r.tension).toBe(50);
  });

  test('tension clamped to 0 for negative values', () => {
    const r = global.newRound('ip');
    mountInput('f-val', '-10');
    global.saveRoundField(r, 'tension');
    expect(r.tension).toBe(0);
  });

  test('tension clamped to 100 for values over 100', () => {
    const r = global.newRound('ip');
    mountInput('f-val', '150');
    global.saveRoundField(r, 'tension');
    expect(r.tension).toBe(100);
  });

  test('saves interpretation from f-val', () => {
    const r = global.newRound('ip');
    mountInput('f-val', '  sie war wütend  ', 'textarea');
    global.saveRoundField(r, 'interpretation');
    expect(r.interpretation).toBe('sie war wütend');
  });

  test('saves need from f-val', () => {
    const r = global.newRound('ip');
    mountInput('f-val', '  Ruhe  ', 'textarea');
    global.saveRoundField(r, 'need');
    expect(r.need).toBe('Ruhe');
  });

  test('saves desiredEffect from f-val', () => {
    const r = global.newRound('ip');
    mountInput('f-val', '  Deeskalation  ', 'textarea');
    global.saveRoundField(r, 'desiredEffect');
    expect(r.desiredEffect).toBe('Deeskalation');
  });

  test('saves ipBehavior from f-verbal and f-nonverbal', () => {
    const r = global.newRound('ip');
    mountInput('f-verbal', 'Du bist unmöglich!', 'textarea');
    mountInput('f-nonverbal', 'Verschränkte Arme', 'textarea');
    global.saveRoundField(r, 'ipBehavior');
    expect(r.ipBehaviorVerbal).toBe('Du bist unmöglich!');
    expect(r.ipBehaviorNonverbal).toBe('Verschränkte Arme');
    expect(r.ipBehavior).toBe('Du bist unmöglich! / Verschränkte Arme');
  });

  test('saves ipBehavior with only verbal (no nonverbal)', () => {
    const r = global.newRound('ip');
    mountInput('f-verbal', 'Verbal only', 'textarea');
    mountInput('f-nonverbal', '', 'textarea');
    global.saveRoundField(r, 'ipBehavior');
    expect(r.ipBehavior).toBe('Verbal only');
  });

  test('saves ipNext the same way as ipBehavior', () => {
    const r = global.newRound('me');
    mountInput('f-verbal', 'Sie sagte nichts', 'textarea');
    mountInput('f-nonverbal', 'Blickkontakt gemieden', 'textarea');
    global.saveRoundField(r, 'ipNext');
    expect(r.ipBehaviorVerbal).toBe('Sie sagte nichts');
    expect(r.ipBehaviorNonverbal).toBe('Blickkontakt gemieden');
    expect(r.ipBehavior).toBe('Sie sagte nichts / Blickkontakt gemieden');
  });

  test('saves myBehavior from f-verbal and f-nonverbal', () => {
    const r = global.newRound('me');
    mountInput('f-verbal', 'Ich fragte nach', 'textarea');
    mountInput('f-nonverbal', 'Ruhige Haltung', 'textarea');
    global.saveRoundField(r, 'myBehavior');
    expect(r.myBehaviorVerbal).toBe('Ich fragte nach');
    expect(r.myBehaviorNonverbal).toBe('Ruhige Haltung');
    expect(r.myBehavior).toBe('Ich fragte nach / Ruhige Haltung');
  });

  test('saveRoundField for thoughts calls collectThoughtsFromDom', () => {
    const r = global.newRound('ip');
    r.thoughts = [{ id: 't_1', text: 'original', feelings: [], feelingsOther: '' }];
    // Create thoughts-list DOM structure
    const thoughtsList = document.createElement('div');
    thoughtsList.id = 'thoughts-list';
    // No thought cards → collectThoughtsFromDom will clear r.thoughts
    document.body.appendChild(thoughtsList);
    global.saveRoundField(r, 'thoughts');
    expect(Array.isArray(r.thoughts)).toBe(true);
    // After DOM collect with empty list, thoughts should be empty
    expect(r.thoughts).toHaveLength(0);
    thoughtsList.remove();
  });

  test('does nothing for f-val when element is absent', () => {
    const r = global.newRound('ip');
    r.interpretation = 'original';
    // No f-val element in DOM
    global.saveRoundField(r, 'interpretation');
    // Should not change — element not found, early return
    expect(r.interpretation).toBe('original');
  });
});
