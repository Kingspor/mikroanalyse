'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
  document.body.innerHTML = `
    <div id="app"></div>
    <div class="sheet-backdrop" id="sheet-backdrop"></div>
    <div class="sheet" id="sheet"><div class="sheet-handle"></div><div id="sheet-content"></div></div>
    <div class="toast" id="toast"></div>
  `;
  // Keep global.app in sync with the DOM
  Object.defineProperty(global, 'app', {
    value: document.getElementById('app'),
    writable: true,
    configurable: true,
  });
});

// ─── goHome ───────────────────────────────────────────────────────

describe('goHome', () => {
  test('sets view to "home"', () => {
    global.State.view = 'wizard';
    global.goHome();
    expect(global.State.view).toBe('home');
  });

  test('clears current analysis', () => {
    global.State.current = global.newAnalysis();
    global.goHome();
    expect(global.State.current).toBeNull();
  });

  test('clears detailId', () => {
    global.State.detailId = 'some-id';
    global.goHome();
    expect(global.State.detailId).toBeNull();
  });

  test('resets step to 0', () => {
    global.State.step = 3;
    global.goHome();
    expect(global.State.step).toBe(0);
  });

  test('resets roundIdx to -1', () => {
    global.State.roundIdx = 2;
    global.goHome();
    expect(global.State.roundIdx).toBe(-1);
  });

  test('resets roundStep to 0', () => {
    global.State.roundStep = 4;
    global.goHome();
    expect(global.State.roundStep).toBe(0);
  });

  test('triggers render, updating DOM to home view', () => {
    global.goHome();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('home-hero');
  });
});

// ─── render (routing) ─────────────────────────────────────────────

describe('render routing', () => {
  test('routes to home view when State.view = "home"', () => {
    global.State.view = 'home';
    global.render();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('fab-add');
  });

  test('routes to detail view when State.view = "detail" with valid id', () => {
    const a = global.newAnalysis();
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.render();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('detail-section');
  });

  test('routes to wizard situation step when view=wizard, roundIdx=-1, step<HUB_STEP', () => {
    const a = global.newAnalysis();
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 0;
    global.State.roundIdx = -1;
    global.render();
    const app = document.getElementById('app');
    expect(app.innerHTML).toContain('f-datetime');
  });

  test('routes to situation step when view=wizard, step=HUB_STEP, roundIdx=-1 (hub removed)', () => {
    const a = global.newAnalysis();
    a.defaultStarter = 'ip';
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 5; // HUB_STEP (now falls through to situation step rendering)
    global.State.roundIdx = -1;
    global.render();
    const app = document.getElementById('app');
    // Falls through to renderSituationStep since hub is no longer in dispatch
    expect(app.innerHTML).not.toBe('');
  });

  test('routes to round step when roundIdx >= 0', () => {
    const a = global.newAnalysis();
    const r = global.newRound('ip');
    a.rounds.push(r);
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.roundIdx = 0;
    global.State.roundStep = 0;
    global.render();
    const app = document.getElementById('app');
    // ipBehavior step: shows verbal/nonverbal textareas
    expect(app.innerHTML).toContain('f-verbal');
  });

  test('routes to home when wizard view has no current analysis', () => {
    global.State.view = 'wizard';
    global.State.current = null;
    global.render();
    expect(global.State.view).toBe('home');
  });
});

// ─── Wizard back/forward navigation ───────────────────────────────

describe('Wizard step navigation', () => {
  beforeEach(() => {
    const a = global.newAnalysis();
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 0;
    global.State.roundIdx = -1;
    global.State.roundStep = 0;
    global.renderSituationStep();
  });

  test('clicking Weiter from step 0 goes to step 1', () => {
    document.getElementById('btn-next-step').click();
    expect(global.State.step).toBe(1);
  });

  test('clicking Zurück from step 0 goes home', () => {
    document.getElementById('btn-back-step').click();
    expect(global.State.view).toBe('home');
  });
});

describe('Full wizard flow navigation', () => {
  test('can navigate forward through all situation steps', () => {
    const a = global.newAnalysis();
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 0;
    global.State.roundIdx = -1;

    // Step 0 → 1
    global.renderSituationStep();
    document.getElementById('btn-next-step').click();
    expect(global.State.step).toBe(1);

    // Step 1 → 2
    global.renderSituationStep();
    document.getElementById('btn-next-step').click();
    expect(global.State.step).toBe(2);

    // Step 2 → 3
    global.renderSituationStep();
    document.getElementById('btn-next-step').click();
    expect(global.State.step).toBe(3);

    // Step 3 → STARTER_STEP (4)
    global.renderSituationStep();
    document.getElementById('btn-next-step').click();
    expect(global.State.step).toBe(4); // STARTER_STEP
  });

  test('starter step next starts round 1 directly', () => {
    const a = global.newAnalysis();
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 4; // STARTER_STEP
    global.State.roundIdx = -1;

    global.renderStarterStep();
    document.querySelector('[data-starter-pick="ip"]').click();
    document.getElementById('btn-starter-next').click();
    expect(global.State.roundIdx).toBe(0);
    expect(global.State.roundStep).toBe(0);
  });
});

// ─── header-back click delegation ─────────────────────────────────

describe('header-back click delegation', () => {
  test('in detail view, header-back calls goHome', () => {
    const a = global.newAnalysis();
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.State.view = 'detail';
    global.State.detailId = a.id;
    global.renderDetail();

    // Simulate click on header-back
    const backBtn = document.getElementById('header-back');
    expect(backBtn).not.toBeNull();
    backBtn.click();
    expect(global.State.view).toBe('home');
  });

  test('in wizard view, header-back calls goHome when confirm returns true', () => {
    global.confirm = jest.fn(() => true);
    const a = global.newAnalysis();
    global.State.view = 'wizard';
    global.State.current = a;
    global.State.step = 2;
    global.State.roundIdx = -1;
    global.renderSituationStep();

    const backBtn = document.getElementById('header-back');
    expect(backBtn).not.toBeNull();
    backBtn.click();
    expect(global.State.view).toBe('home');
  });
});

// ─── openDetail ───────────────────────────────────────────────────

describe('openDetail', () => {
  test('sets detailId and view to detail', () => {
    const a = global.newAnalysis();
    global.Store.upsert(a);
    global.Store.invalidateCache();
    global.openDetail(a.id);
    expect(global.State.detailId).toBe(a.id);
    expect(global.State.view).toBe('detail');
  });
});

// ─── startNewAnalysis ─────────────────────────────────────────────

describe('startNewAnalysis', () => {
  test('creates new analysis, sets wizard view', () => {
    global.startNewAnalysis();
    expect(global.State.view).toBe('wizard');
    expect(global.State.current).not.toBeNull();
    expect(global.State.step).toBe(0);
    expect(global.State.roundIdx).toBe(-1);
  });

  test('saves new analysis to store', () => {
    global.startNewAnalysis();
    const id = global.State.current.id;
    global.Store.invalidateCache();
    expect(global.Store.get(id)).not.toBeNull();
  });
});
