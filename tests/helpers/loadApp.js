'use strict';

// ─── Mock setup ───────────────────────────────────────────────────────────────

function installMocks() {
  document.body.innerHTML = `
    <div id="app"></div>
    <div id="sheet-backdrop" class="sheet-backdrop"></div>
    <div id="sheet" class="sheet">
      <div class="sheet-handle"></div>
      <div id="sheet-content"></div>
    </div>
    <div id="toast" class="toast"></div>
  `;

  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 200,
    text: jest.fn().mockResolvedValue(''),
    json: jest.fn().mockResolvedValue({}),
  });

  Object.defineProperty(global.navigator, 'share', {
    value: jest.fn().mockResolvedValue(undefined),
    writable: true, configurable: true,
  });
  Object.defineProperty(global.navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    writable: true, configurable: true,
  });

  global.jspdf = {
    jsPDF: jest.fn(() => ({
      setFont: jest.fn(), setFontSize: jest.fn(),
      setTextColor: jest.fn(), setDrawColor: jest.fn(),
      setLineWidth: jest.fn(), text: jest.fn(),
      line: jest.fn(), addPage: jest.fn(),
      splitTextToSize: jest.fn(t => [t]),
      save: jest.fn(),
    })),
  };

  global.msal = null;
  global.msalReady = Promise.resolve();
  global.msalLoadError = null;

  global.confirm = jest.fn(() => true);
  global.alert   = jest.fn();
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = jest.fn();
}

// ─── Module imports ───────────────────────────────────────────────────────────

let _loaded = false;

function loadApp() {
  installMocks();

  if (!_loaded) {
    const utils      = require('../../src/utils.js');
    const state      = require('../../src/state.js');
    const store      = require('../../src/store.js');
    const crypto     = require('../../src/crypto.js');
    const model      = require('../../src/model.js');
    const sync       = require('../../src/sync.js');
    const richtext   = require('../../src/richtext.js');
    const ui         = require('../../src/ui.js');
    const renderer   = require('../../src/renderer.js');
    const navigation = require('../../src/navigation.js');
    navigation.initNavigation();
    const home       = require('../../src/views/home.js');
    const wizard     = require('../../src/views/wizard.js');
    const detail     = require('../../src/views/detail.js');
    const sheets     = require('../../src/views/sheets.js');

    // utils
    global.escapeHtml      = utils.escapeHtml;
    global.escapeAttr      = utils.escapeAttr;
    global.formatDateTime  = utils.formatDateTime;

    // state / store
    global.State           = state.State;
    global.Store           = store.Store;
    global.CustomFeelings  = store.CustomFeelings;

    // crypto / sync
    global.Crypto          = crypto.Crypto;
    global.Sync            = sync.Sync;

    // model
    global.newAnalysis     = model.newAnalysis;
    global.newRound        = model.newRound;
    global.newThought      = model.newThought;
    global.migrateRound    = model.migrateRound;

    // ui
    global.headerHTML      = ui.headerHTML;
    global.progressHTML    = ui.progressHTML;
    global.bottomBarHTML   = ui.bottomBarHTML;
    global.sliderHTML      = ui.sliderHTML;

    // renderer / navigation
    global.render          = renderer.render;
    global.startNewAnalysis = navigation.startNewAnalysis;
    global.openDetail      = navigation.openDetail;
    global.goHome          = navigation.goHome;

    // views – home
    global.renderHome      = home.renderHome;

    // views – wizard
    global.renderWizard         = wizard.renderWizard;
    global.renderSituationStep  = wizard.renderSituationStep;
    global.renderStarterStep    = wizard.renderStarterStep;
    global.renderRoundsHub      = wizard.renderRoundsHub;
    global.renderRoundStep      = wizard.renderRoundStep;
    global.renderRoundDone      = wizard.renderRoundDone;
    global.getRoundSequence     = wizard.getRoundSequence;
    global.saveRoundField       = wizard.saveRoundField;
    global.thoughtCardHTML      = wizard.thoughtCardHTML;
    global.roundSummaryHTML     = wizard.roundSummaryHTML;
    global.totalRoundSteps      = wizard.totalRoundSteps;

    // views – detail
    global.renderDetail         = detail.renderDetail;
    global.behaviorDetailHTML   = detail.behaviorDetailHTML;

    // views – sheets
    global.buildTextExport      = sheets.buildTextExport;

    _loaded = true;
  }
}

// ─── State reset (call in beforeEach) ────────────────────────────────────────

function resetState() {
  global.localStorage.clear();

  if (global.Store)  global.Store.invalidateCache();
  if (global.State) {
    Object.assign(global.State, {
      view: 'home', current: null, step: 0,
      roundIdx: -1, roundStep: 0, detailId: null,
    });
  }
  if (global.Sync) {
    global.Sync._passphrase = null;
  }

  installMocks();

  const app = document.getElementById('app');
  if (app) app.innerHTML = '';
}

module.exports = { loadApp, resetState };
