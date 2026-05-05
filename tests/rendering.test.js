'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
  // Ensure DOM is clean and correct
  document.body.innerHTML = `
    <div id="app"></div>
    <div class="sheet-backdrop" id="sheet-backdrop"></div>
    <div class="sheet" id="sheet"><div class="sheet-handle"></div><div id="sheet-content"></div></div>
    <div class="toast" id="toast"></div>
  `;
});

// Helper: override the global app reference to the current DOM element
function refreshAppRef() {
  // The app code uses `const app = document.getElementById('app')` at load time.
  // Since we reset the DOM, we need to make sure render functions use the current element.
  // Most render functions use the module-level `app` variable.
  // We patch global.app to point to the current element.
  Object.defineProperty(global, 'app', {
    value: document.getElementById('app'),
    writable: true,
    configurable: true,
  });
}

// ─── renderHome ───────────────────────────────────────────────────

describe('renderHome', () => {
  beforeEach(() => {
    refreshAppRef();
  });

  test('shows empty state when no analyses', () => {
    global.renderHome();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Noch keine Analysen');
  });

  test('shows home title', () => {
    global.renderHome();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Mikroanalyse');
  });

  test('shows FAB add button', () => {
    global.renderHome();
    expect(document.getElementById('fab-add')).not.toBeNull();
  });

  test('shows list when analyses exist', () => {
    const a = global.newAnalysis();
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.renderHome();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('1 Eintrag');
  });

  test('shows plural "Einträge" for multiple analyses', () => {
    global.Store.upsert(global.newAnalysis());
    global.Store.upsert(global.newAnalysis());
    global.Store.invalidateCache();
    global.renderHome();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('2 Einträge');
  });

  test('shows sync pill', () => {
    global.renderHome();
    expect(document.getElementById('sync-pill')).not.toBeNull();
  });

  test('shows settings button', () => {
    global.renderHome();
    expect(document.getElementById('settings-btn')).not.toBeNull();
  });

  test('clicking fab-add creates a new wizard', () => {
    global.renderHome();
    document.getElementById('fab-add').click();
    expect(global.State.view).toBe('wizard');
    expect(global.State.step).toBe(0);
  });

  test('analysis card is rendered with date', () => {
    const a = global.newAnalysis();
    a.situation.datetime = '2024-06-15T10:30';
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.renderHome();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('analysis-card');
  });
});

// ─── renderSituationStep ──────────────────────────────────────────

describe('renderSituationStep - step 0 (datetime)', () => {
  beforeEach(() => {
    refreshAppRef();
    global.State.view = 'wizard';
    global.State.current = global.newAnalysis();
    global.State.step = 0;
    global.State.roundIdx = -1;
  });

  test('renders datetime input', () => {
    global.renderSituationStep();
    expect(document.getElementById('f-datetime')).not.toBeNull();
  });

  test('shows "Wann war das?" question', () => {
    global.renderSituationStep();
    expect(document.getElementById('app').innerHTML).toContain('Wann war das?');
  });

  test('next button advances to step 1', () => {
    global.renderSituationStep();
    document.getElementById('btn-next-step').click();
    expect(global.State.step).toBe(1);
  });

  test('back button at step 0 calls goHome', () => {
    global.renderSituationStep();
    document.getElementById('btn-back-step').click();
    expect(global.State.view).toBe('home');
  });

  test('renders progress bar', () => {
    global.renderSituationStep();
    expect(document.querySelector('.progress')).not.toBeNull();
  });
});

describe('renderSituationStep - step 1 (mood slider)', () => {
  beforeEach(() => {
    refreshAppRef();
    global.State.view = 'wizard';
    global.State.current = global.newAnalysis();
    global.State.step = 1;
    global.State.roundIdx = -1;
  });

  test('renders mood slider', () => {
    global.renderSituationStep();
    expect(document.getElementById('f-mood')).not.toBeNull();
  });

  test('shows "Wie war deine Stimmung" question', () => {
    global.renderSituationStep();
    expect(document.getElementById('app').innerHTML).toContain('Wie war deine Stimmung');
  });

  test('next button advances to step 2', () => {
    global.renderSituationStep();
    document.getElementById('btn-next-step').click();
    expect(global.State.step).toBe(2);
  });

  test('back button at step 1 goes to step 0', () => {
    global.renderSituationStep();
    document.getElementById('btn-back-step').click();
    expect(global.State.step).toBe(0);
  });
});

describe('renderSituationStep - step 2 (need)', () => {
  beforeEach(() => {
    refreshAppRef();
    global.State.view = 'wizard';
    global.State.current = global.newAnalysis();
    global.State.step = 2;
    global.State.roundIdx = -1;
  });

  test('renders need textarea', () => {
    global.renderSituationStep();
    expect(document.getElementById('f-need')).not.toBeNull();
  });

  test('shows "Bedürfnis" question', () => {
    global.renderSituationStep();
    expect(document.getElementById('app').innerHTML).toContain('Bedürfnis');
  });

  test('next button advances to step 3', () => {
    global.renderSituationStep();
    document.getElementById('btn-next-step').click();
    expect(global.State.step).toBe(3);
  });
});

describe('renderSituationStep - step 3 (W-Fragen)', () => {
  beforeEach(() => {
    refreshAppRef();
    global.State.view = 'wizard';
    global.State.current = global.newAnalysis();
    global.State.step = 3;
    global.State.roundIdx = -1;
  });

  test('renders contextWhat textarea', () => {
    global.renderSituationStep();
    expect(document.getElementById('f-what')).not.toBeNull();
  });

  test('renders contextWho input', () => {
    global.renderSituationStep();
    expect(document.getElementById('f-who')).not.toBeNull();
  });

  test('renders contextWhere input', () => {
    global.renderSituationStep();
    expect(document.getElementById('f-where')).not.toBeNull();
  });

  test('next button advances to STARTER_STEP (4)', () => {
    global.renderSituationStep();
    document.getElementById('btn-next-step').click();
    // STARTER_STEP = 4
    expect(global.State.step).toBe(4);
  });

  test('uses legacy context as fallback for contextWhat', () => {
    global.State.current.situation.context = 'Legacy context';
    global.State.current.situation.contextWhat = '';
    global.renderSituationStep();
    const textarea = document.getElementById('f-what');
    expect(textarea.value).toBe('Legacy context');
  });
});

// ─── renderStarterStep ────────────────────────────────────────────

describe('renderStarterStep', () => {
  beforeEach(() => {
    refreshAppRef();
    global.State.view = 'wizard';
    global.State.current = global.newAnalysis();
    global.State.step = 4; // STARTER_STEP
    global.State.roundIdx = -1;
  });

  test('shows choice cards for me and ip', () => {
    global.renderStarterStep();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('data-starter-pick="me"');
    expect(app.innerHTML).toContain('data-starter-pick="ip"');
  });

  test('next button is disabled until starter is selected', () => {
    global.renderStarterStep();
    const nextBtn = document.getElementById('btn-starter-next');
    expect(nextBtn.disabled).toBe(true);
  });

  test('clicking a starter card enables next button', () => {
    global.renderStarterStep();
    const meCard = document.querySelector('[data-starter-pick="me"]');
    meCard.click();
    const nextBtn = document.getElementById('btn-starter-next');
    expect(nextBtn.disabled).toBe(false);
  });

  test('clicking me card sets defaultStarter to "me"', () => {
    global.renderStarterStep();
    document.querySelector('[data-starter-pick="me"]').click();
    expect(global.State.current.defaultStarter).toBe('me');
  });

  test('clicking ip card sets defaultStarter to "ip"', () => {
    global.renderStarterStep();
    document.querySelector('[data-starter-pick="ip"]').click();
    expect(global.State.current.defaultStarter).toBe('ip');
  });

  test('back button goes to step SITUATION_STEPS-1 = 3', () => {
    global.renderStarterStep();
    document.getElementById('btn-starter-back').click();
    expect(global.State.step).toBe(3);
  });

  test('next button starts round 1 directly when starter is selected', () => {
    global.renderStarterStep();
    document.querySelector('[data-starter-pick="ip"]').click();
    document.getElementById('btn-starter-next').click();
    expect(global.State.roundIdx).toBe(0);
    expect(global.State.roundStep).toBe(0);
    expect(global.State.current.rounds).toHaveLength(1);
    expect(global.State.current.rounds[0].starter).toBe('ip');
  });
});

// ─── renderRoundsHub ──────────────────────────────────────────────

describe('renderRoundsHub', () => {
  beforeEach(() => {
    refreshAppRef();
    const a = global.newAnalysis();
    a.defaultStarter = 'ip';
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 5; // HUB_STEP
    global.State.roundIdx = -1;
  });

  test('renders choice cards for me and ip starter', () => {
    global.renderRoundsHub();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('data-starter="me"');
    expect(app.innerHTML).toContain('data-starter="ip"');
  });

  test('shows "Erste Runde anlegen" when no rounds exist', () => {
    global.renderRoundsHub();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Erste Runde anlegen');
  });

  test('shows "Eine weitere Runde?" when rounds exist', () => {
    global.State.current.rounds.push(global.newRound('ip'));
    global.renderRoundsHub();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Eine weitere Runde?');
  });

  test('clicking ip starter adds a round and enters roundStep', () => {
    global.renderRoundsHub();
    document.querySelector('[data-starter="ip"]').click();
    expect(global.State.current.rounds).toHaveLength(1);
    expect(global.State.current.rounds[0].starter).toBe('ip');
    expect(global.State.roundIdx).toBe(0);
  });

  test('clicking me starter adds a me-round', () => {
    global.renderRoundsHub();
    document.querySelector('[data-starter="me"]').click();
    expect(global.State.current.rounds[0].starter).toBe('me');
  });

  test('finish button saves and goes to detail view', () => {
    global.renderRoundsHub();
    document.getElementById('btn-hub-finish').click();
    expect(global.State.view).toBe('detail');
  });

  test('back button goes to STARTER_STEP', () => {
    global.renderRoundsHub();
    document.getElementById('btn-hub-back').click();
    expect(global.State.step).toBe(4); // STARTER_STEP
  });

  test('renders round summaries for existing rounds', () => {
    global.State.current.rounds.push(global.newRound('ip'));
    global.renderRoundsHub();
    expect(document.querySelector('.round-summary')).not.toBeNull();
  });
});

// ─── renderRoundStep ──────────────────────────────────────────────

describe('renderRoundStep - ip starter', () => {
  beforeEach(() => {
    refreshAppRef();
    const a = global.newAnalysis();
    a.defaultStarter = 'ip';
    const r = global.newRound('ip');
    a.rounds.push(r);
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 5; // HUB_STEP
    global.State.roundIdx = 0;
    global.State.roundStep = 0;
  });

  test('step 0 (ipBehavior) renders verbal and nonverbal textareas', () => {
    global.renderRoundStep();
    expect(document.getElementById('f-verbal')).not.toBeNull();
    expect(document.getElementById('f-nonverbal')).not.toBeNull();
  });

  test('step 0 shows "Was tut die andere Person?" question', () => {
    global.renderRoundStep();
    expect(document.getElementById('app').innerHTML).toContain('Was tut die andere Person?');
  });

  test('next button advances roundStep from 0 to 1', () => {
    global.renderRoundStep();
    document.getElementById('btn-r-next').click();
    expect(global.State.roundStep).toBe(1);
  });

  test('back button at roundStep=0 of round 0 returns to STARTER_STEP', () => {
    global.renderRoundStep();
    document.getElementById('btn-r-back').click();
    expect(global.State.roundIdx).toBe(-1);
    expect(global.State.step).toBe(4); // STARTER_STEP
    expect(global.State.current.rounds).toHaveLength(0);
  });
});

describe('renderRoundStep - me starter', () => {
  beforeEach(() => {
    refreshAppRef();
    const a = global.newAnalysis();
    a.defaultStarter = 'me';
    const r = global.newRound('me');
    a.rounds.push(r);
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 5;
    global.State.roundIdx = 0;
    global.State.roundStep = 0;
  });

  test('step 0 (interpretation) renders textarea for interpretation', () => {
    global.renderRoundStep();
    expect(document.getElementById('f-val')).not.toBeNull();
  });

  test('step 0 shows interpretation question with optional label for round 1', () => {
    global.renderRoundStep();
    expect(document.getElementById('app').innerHTML).toContain('Interpretation');
    expect(document.getElementById('app').innerHTML).toContain('optional');
  });

  test('step 4 (myBehavior) renders verbal and nonverbal textareas', () => {
    global.State.roundStep = 4;
    global.renderRoundStep();
    expect(document.getElementById('f-verbal')).not.toBeNull();
    expect(document.getElementById('f-nonverbal')).not.toBeNull();
  });

  test('step 4 shows "Was hast du getan" question', () => {
    global.State.roundStep = 4;
    global.renderRoundStep();
    expect(document.getElementById('app').innerHTML).toContain('Was hast du getan');
  });
});

describe('renderRoundStep - tension step', () => {
  beforeEach(() => {
    refreshAppRef();
    const a = global.newAnalysis();
    a.defaultStarter = 'ip';
    const r = global.newRound('ip');
    a.rounds.push(r);
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.roundIdx = 0;
    // ip sequence: ['ipBehavior', 'interpretation', 'thoughts', 'tension', ...]
    // tension is at index 3
    global.State.roundStep = 3;
  });

  test('renders tension slider', () => {
    global.renderRoundStep();
    expect(document.getElementById('f-val')).not.toBeNull();
    expect(document.getElementById('app').innerHTML).toContain('type="range"');
  });

  test('shows "innere Spannung" question', () => {
    global.renderRoundStep();
    expect(document.getElementById('app').innerHTML).toContain('innere Spannung');
  });
});

// ─── renderRoundDone ──────────────────────────────────────────────

describe('renderRoundDone', () => {
  beforeEach(() => {
    refreshAppRef();
    const a = global.newAnalysis();
    a.defaultStarter = 'ip';
    const r = global.newRound('ip');
    a.rounds.push(r);
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.roundIdx = 0;
    // done is last step (index 7)
    global.State.roundStep = 7;
  });

  test('renders three buttons: back, finish, new round', () => {
    global.renderRoundDone();
    expect(document.getElementById('btn-rd-back')).not.toBeNull();
    expect(document.getElementById('btn-rd-finish')).not.toBeNull();
    expect(document.getElementById('btn-rd-new')).not.toBeNull();
  });

  test('"Analyse beenden" button saves and goes to detail view', () => {
    global.renderRoundDone();
    document.getElementById('btn-rd-finish').click();
    expect(global.State.view).toBe('detail');
    expect(global.State.current).toBeNull();
  });

  test('"Nächste Runde" button creates next round and enters it', () => {
    global.renderRoundDone();
    document.getElementById('btn-rd-new').click();
    expect(global.State.roundIdx).toBe(1);
    expect(global.State.roundStep).toBe(0);
    expect(global.State.current.rounds).toHaveLength(2);
  });

  test('"Zurück" button decrements roundStep', () => {
    global.renderRoundDone();
    document.getElementById('btn-rd-back').click();
    expect(global.State.roundStep).toBe(6);
  });
});

// ─── renderDetail ─────────────────────────────────────────────────

describe('renderDetail', () => {
  beforeEach(() => {
    refreshAppRef();
  });

  test('calls goHome when analysis not found', () => {
    global.State.view = 'detail';
    global.State.detailId = 'nonexistent';
    global.renderDetail();
    expect(global.State.view).toBe('home');
  });

  test('renders detail view for existing analysis', () => {
    const a = global.newAnalysis();
    a.situation.need = 'Test need';
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Ausgangssituation');
  });

  test('renders mood value', () => {
    const a = global.newAnalysis();
    a.situation.mood = 42;
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('42 / 100');
  });

  test('renders need section', () => {
    const a = global.newAnalysis();
    a.situation.need = 'Verbindung';
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Verbindung');
  });

  test('renders round section when rounds exist', () => {
    const a = global.newAnalysis();
    const r = global.newRound('ip');
    r.interpretation = 'Meine Deutung';
    a.rounds.push(r);
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Runde 1');
  });

  test('renders "muted" class for missing need', () => {
    const a = global.newAnalysis();
    a.situation.need = '';
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Nicht angegeben');
  });

  test('edit button switches to wizard view', () => {
    const a = global.newAnalysis();
    a.defaultStarter = 'ip';
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();
    document.getElementById('btn-detail-edit').click();
    expect(global.State.view).toBe('wizard');
    expect(global.State.step).toBe(0);
  });

  test('contextWho and contextWhere rendered when present', () => {
    const a = global.newAnalysis();
    a.situation.contextWho = 'Meine Kollegin';
    a.situation.contextWhere = 'Büro';
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('Meine Kollegin');
    expect(app.innerHTML).toContain('Büro');
  });

  test('contextWho section hidden when empty', () => {
    const a = global.newAnalysis();
    a.situation.contextWho = '';
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();
    const app = document.getElementById('app');
    expect(app.innerHTML).not.toContain('Wer war beteiligt?');
  });
});
