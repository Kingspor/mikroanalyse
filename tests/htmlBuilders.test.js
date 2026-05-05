'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
});

// ─── headerHTML ───────────────────────────────────────────────────

describe('headerHTML', () => {
  test('contains the title', () => {
    const html = global.headerHTML('Situation', '1 / 5', true);
    expect(html).toContain('Situation');
  });

  test('back button is shown when withBack=true', () => {
    const html = global.headerHTML('Test', '', true);
    // The hidden class should NOT be present
    expect(html).not.toContain('header-back hidden');
    expect(html).toContain('header-back');
  });

  test('back button has hidden class when withBack=false', () => {
    const html = global.headerHTML('Test', '', false);
    expect(html).toContain('header-back hidden');
  });

  test('shows step indicator when step is provided', () => {
    const html = global.headerHTML('Neue Analyse', '3 / 5', true);
    expect(html).toContain('3 / 5');
    expect(html).toContain('header-step');
  });

  test('does not include step indicator when step is empty string', () => {
    const html = global.headerHTML('Test', '', true);
    expect(html).not.toContain('header-step');
  });

  test('does not include step indicator when step is falsy (null)', () => {
    const html = global.headerHTML('Test', null, true);
    expect(html).not.toContain('header-step');
  });

  test('escapes HTML in title', () => {
    const html = global.headerHTML('<script>alert(1)</script>', '', false);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  test('escapes HTML in step', () => {
    const html = global.headerHTML('Title', '<b>step</b>', true);
    expect(html).toContain('&lt;b&gt;');
  });
});

// ─── progressHTML ─────────────────────────────────────────────────

describe('progressHTML', () => {
  test('renders 0% when current=0', () => {
    const html = global.progressHTML(0, 5);
    expect(html).toContain('width: 0%');
  });

  test('renders 50% at halfway', () => {
    const html = global.progressHTML(3, 6);
    expect(html).toContain('width: 50%');
  });

  test('renders 100% when current equals total', () => {
    const html = global.progressHTML(5, 5);
    expect(html).toContain('width: 100%');
  });

  test('renders ~33% at 1/3', () => {
    const html = global.progressHTML(1, 3);
    expect(html).toContain('width: 33%');
  });

  test('contains progress-fill class', () => {
    const html = global.progressHTML(1, 4);
    expect(html).toContain('progress-fill');
  });

  test('contains progress wrapper div', () => {
    const html = global.progressHTML(2, 4);
    expect(html).toContain('class="progress"');
  });
});

// ─── bottomBarHTML ────────────────────────────────────────────────

describe('bottomBarHTML', () => {
  test('renders a single button with correct id and label', () => {
    const html = global.bottomBarHTML([{ id: 'btn-ok', label: 'OK', kind: 'primary' }]);
    expect(html).toContain('id="btn-ok"');
    expect(html).toContain('OK');
    expect(html).toContain('btn-primary');
  });

  test('renders multiple buttons', () => {
    const html = global.bottomBarHTML([
      { id: 'btn-back', label: 'Zurück', kind: 'secondary' },
      { id: 'btn-next', label: 'Weiter', kind: 'primary' }
    ]);
    expect(html).toContain('id="btn-back"');
    expect(html).toContain('id="btn-next"');
    expect(html).toContain('Zurück');
    expect(html).toContain('Weiter');
  });

  test('uses btn-secondary class for kind=secondary', () => {
    const html = global.bottomBarHTML([{ id: 'btn-s', label: 'Back', kind: 'secondary' }]);
    expect(html).toContain('btn-secondary');
  });

  test('uses btn-ghost class for kind=ghost', () => {
    const html = global.bottomBarHTML([{ id: 'btn-g', label: 'Skip', kind: 'ghost' }]);
    expect(html).toContain('btn-ghost');
  });

  test('renders bottom-bar container', () => {
    const html = global.bottomBarHTML([{ id: 'btn-x', label: 'X', kind: 'primary' }]);
    expect(html).toContain('class="bottom-bar"');
  });

  test('escapes label HTML', () => {
    const html = global.bottomBarHTML([{ id: 'btn-xss', label: '<b>bold</b>', kind: 'primary' }]);
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>bold</b>');
  });
});

// ─── behaviorDetailHTML ───────────────────────────────────────────

describe('behaviorDetailHTML', () => {
  test('returns legacy text when no verbal or nonverbal', () => {
    const html = global.behaviorDetailHTML('', '', 'Legacy text');
    expect(html).toBe('Legacy text');
  });

  test('returns escaped em-dash when no verbal, nonverbal, or legacy', () => {
    const html = global.behaviorDetailHTML('', '', '');
    expect(html).toBe('–');
  });

  test('shows verbal line when verbal is present', () => {
    const html = global.behaviorDetailHTML('Ich sagte etwas', '', '');
    expect(html).toContain('Verbal:');
    expect(html).toContain('Ich sagte etwas');
  });

  test('shows nonverbal line when nonverbal is present', () => {
    const html = global.behaviorDetailHTML('', 'Verschränkte Arme', '');
    expect(html).toContain('Nonverbal:');
    expect(html).toContain('Verschränkte Arme');
  });

  test('shows both verbal and nonverbal separated by <br>', () => {
    const html = global.behaviorDetailHTML('Verbal text', 'Nonverbal text', '');
    expect(html).toContain('Verbal:');
    expect(html).toContain('Nonverbal:');
    expect(html).toContain('<br>');
  });

  test('ignores legacy when verbal or nonverbal present', () => {
    const html = global.behaviorDetailHTML('Verbal', '', 'Legacy ignored');
    expect(html).not.toContain('Legacy ignored');
  });

  test('escapes HTML in verbal content', () => {
    const html = global.behaviorDetailHTML('<script>xss</script>', '', '');
    expect(html).toContain('&lt;script&gt;');
  });

  test('escapes HTML in nonverbal content', () => {
    const html = global.behaviorDetailHTML('', '<img onerror>', '');
    expect(html).toContain('&lt;img onerror&gt;');
  });

  test('escapes HTML in legacy content', () => {
    const html = global.behaviorDetailHTML('', '', '<b>legacy</b>');
    expect(html).toContain('&lt;b&gt;legacy&lt;/b&gt;');
  });
});

// ─── thoughtCardHTML ──────────────────────────────────────────────

describe('thoughtCardHTML', () => {
  test('includes thought number', () => {
    const t = global.newThought();
    const html = global.thoughtCardHTML(t, 0);
    expect(html).toContain('Gedanke 1');
  });

  test('includes thought id in data attribute', () => {
    const t = global.newThought();
    const html = global.thoughtCardHTML(t, 0);
    expect(html).toContain(`data-thought-id="${t.id}"`);
  });

  test('shows active class on active feelings', () => {
    const t = global.newThought();
    t.feelings = ['Angst'];
    const html = global.thoughtCardHTML(t, 0);
    // The chip for 'Angst' should have class active
    expect(html).toMatch(/chip.*active.*Angst|Angst.*chip.*active/s);
  });

  test('no active class when no feelings selected', () => {
    const t = global.newThought();
    t.feelings = [];
    const html = global.thoughtCardHTML(t, 0);
    // None of the standard feelings should have active class
    // (assuming all FEELINGS chips are rendered without active)
    const activeCount = (html.match(/class="chip active"/g) || []).length;
    expect(activeCount).toBe(0);
  });

  test('renders all standard FEELINGS as chip buttons', () => {
    const t = global.newThought();
    const html = global.thoughtCardHTML(t, 0);
    // Standard feelings
    ['Angst', 'Trauer', 'Ärger', 'Ablehnung', 'Scham'].forEach(f => {
      expect(html).toContain(f);
    });
  });

  test('includes textarea for thought text', () => {
    const t = global.newThought();
    t.text = 'Mein Gedanke';
    const html = global.thoughtCardHTML(t, 0);
    expect(html).toContain('Mein Gedanke');
    expect(html).toContain('textarea');
  });

  test('includes tag-input-wrap for custom feelings', () => {
    const t = global.newThought();
    const html = global.thoughtCardHTML(t, 0);
    expect(html).toContain('tag-input-wrap');
    expect(html).toContain('tag-input-field');
  });

  test('shows existing custom feelings as tag chips', () => {
    const t = global.newThought();
    t.feelings = ['Schuld'];
    const html = global.thoughtCardHTML(t, 0);
    expect(html).toContain('Schuld');
    expect(html).toContain('tag-chip');
  });

  test('renders second thought with index 1 (Gedanke 2)', () => {
    const t = global.newThought();
    const html = global.thoughtCardHTML(t, 1);
    expect(html).toContain('Gedanke 2');
  });
});

// ─── roundSummaryHTML ─────────────────────────────────────────────

describe('roundSummaryHTML', () => {
  test('includes round number (1-based)', () => {
    const r = global.newRound('ip');
    const html = global.roundSummaryHTML(r, 0);
    expect(html).toContain('Runde 1');
  });

  test('shows "IP startete" badge for starter=ip', () => {
    const r = global.newRound('ip');
    const html = global.roundSummaryHTML(r, 0);
    expect(html).toContain('IP startete');
  });

  test('shows "Ich startete" badge for starter=me', () => {
    const r = global.newRound('me');
    const html = global.roundSummaryHTML(r, 0);
    expect(html).toContain('Ich startete');
  });

  test('shows "–" for empty myBehavior', () => {
    const r = global.newRound('ip');
    r.myBehavior = '';
    r.myBehaviorVerbal = '';
    const html = global.roundSummaryHTML(r, 0);
    // Should show em dash for empty behavior
    expect(html).toContain('–');
  });

  test('shows myBehaviorVerbal (preferred over myBehavior)', () => {
    const r = global.newRound('me');
    r.myBehaviorVerbal = 'Ich fragte';
    r.myBehavior = 'Old combined';
    const html = global.roundSummaryHTML(r, 0);
    expect(html).toContain('Ich fragte');
  });

  test('shows ipBehaviorVerbal (preferred over ipBehavior)', () => {
    const r = global.newRound('ip');
    r.ipBehaviorVerbal = 'IP schrie';
    r.ipBehavior = 'Old combined';
    const html = global.roundSummaryHTML(r, 0);
    expect(html).toContain('IP schrie');
  });

  test('shows tension value', () => {
    const r = global.newRound('ip');
    r.tension = 75;
    const html = global.roundSummaryHTML(r, 0);
    expect(html).toContain('75');
  });

  test('includes edit button with correct data attribute', () => {
    const r = global.newRound('ip');
    const html = global.roundSummaryHTML(r, 2);
    expect(html).toContain('data-edit-round="2"');
  });

  test('truncates long behavior text to 80 chars', () => {
    const r = global.newRound('ip');
    r.ipBehaviorVerbal = 'a'.repeat(100);
    const html = global.roundSummaryHTML(r, 0);
    // The actual displayed value should be truncated to 80 chars
    expect(html).toContain('a'.repeat(80));
    expect(html).not.toContain('a'.repeat(81));
  });
});

// ─── sliderHTML ───────────────────────────────────────────────────

describe('sliderHTML', () => {
  test('renders range input with correct id', () => {
    const html = global.sliderHTML('f-mood', 50, ['Ruhig', 'Mittel', 'Angespannt']);
    expect(html).toContain('id="f-mood"');
    expect(html).toContain('type="range"');
  });

  test('sets initial value on range input', () => {
    const html = global.sliderHTML('f-tension', 75, ['Entspannt', 'Mittel', 'Sehr hoch']);
    expect(html).toContain('value="75"');
  });

  test('clamps value to 0 minimum', () => {
    const html = global.sliderHTML('f-val', -10, ['A', 'B', 'C']);
    expect(html).toContain('value="0"');
  });

  test('clamps value to 100 maximum', () => {
    const html = global.sliderHTML('f-val', 150, ['A', 'B', 'C']);
    expect(html).toContain('value="100"');
  });

  test('renders display div with id pattern', () => {
    const html = global.sliderHTML('f-mood', 50, ['Ruhig', 'Mittel', 'Angespannt']);
    expect(html).toContain('id="f-mood-display"');
  });

  test('renders scale labels', () => {
    const html = global.sliderHTML('f-mood', 50, ['Ruhig', 'Mittel', 'Angespannt']);
    expect(html).toContain('Ruhig');
    expect(html).toContain('Mittel');
    expect(html).toContain('Angespannt');
  });
});
