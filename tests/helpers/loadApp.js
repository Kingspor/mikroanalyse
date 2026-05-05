'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const HTML_PATH = path.resolve(__dirname, '../../index.html');

// ─── Script extraction ────────────────────────────────────────────────────────

function extractMainScript(html) {
  // Match plain <script> blocks that have NO type attribute or type="text/javascript"
  const re = /<script(?:\s+type="text\/javascript")?\s*>([\s\S]*?)<\/script>/gi;
  let longest = '';
  let m;
  while ((m = re.exec(html)) !== null) {
    const body = m[1];
    if (body.includes('PopupBridge')) continue; // skip the auth bridge IIFE
    if (body.length > longest.length) longest = body;
  }
  if (!longest) throw new Error('Main app script not found in index.html');
  return longest;
}

let _patchedCode = null;
function getPatchedCode() {
  if (_patchedCode) return _patchedCode;
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const raw  = extractMainScript(html);

  // `const` and `let` at top level are NOT added to global (window) properties.
  // Replace them all with `var` so vm.runInThisContext makes them accessible as
  // global.XXX in the test environment.  This is safe for testing purposes.
  _patchedCode = raw
    .replace(/\bconst\s+/g, 'var ')
    .replace(/\blet\s+/g,   'var ');

  return _patchedCode;
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

function installMocks() {
  // DOM shell ─ elements the app references at startup
  document.body.innerHTML = `
    <div id="app"></div>
    <div id="sheet-backdrop" class="sheet-backdrop"></div>
    <div id="sheet" class="sheet">
      <div class="sheet-handle"></div>
      <div id="sheet-content"></div>
    </div>
    <div id="toast" class="toast"></div>
  `;

  // fetch
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 200,
    text: jest.fn().mockResolvedValue(''),
    json: jest.fn().mockResolvedValue({}),
  });

  // navigator.share / clipboard
  Object.defineProperty(global.navigator, 'share', {
    value: jest.fn().mockResolvedValue(undefined),
    writable: true, configurable: true,
  });
  Object.defineProperty(global.navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    writable: true, configurable: true,
  });

  // jsPDF (window.jspdf used in exportPdf)
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

  // MSAL
  global.msal = null;
  global.msalReady = Promise.resolve();
  global.msalLoadError = null;

  // misc browser APIs
  global.confirm = jest.fn(() => true);
  global.alert   = jest.fn();
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = jest.fn();
}

// ─── Loader ───────────────────────────────────────────────────────────────────

let _loaded = false;

function loadApp() {
  installMocks();

  if (!_loaded) {
    // Script-tag injection runs in the jsdom window context so top-level var
    // declarations become window/global properties.  const/let are pre-patched
    // to var in getPatchedCode() so they also land on global.
    const scriptEl = document.createElement('script');
    scriptEl.textContent = getPatchedCode();
    document.head.appendChild(scriptEl);
    _loaded = true;
  }
}

// ─── State reset (call in beforeEach) ────────────────────────────────────────

function resetState() {
  global.localStorage.clear();

  if (global.Store) {
    global.Store.invalidateCache();
  }
  if (global.CustomFeelings) {
    // wipe custom feelings from localStorage
    global.localStorage.removeItem('mikro_custom_feelings');
  }
  if (global.State) {
    Object.assign(global.State, {
      view: 'home', current: null, step: 0,
      roundIdx: -1, roundStep: 0, detailId: null,
    });
  }
  if (global.Sync) {
    global.Sync.account    = null;
    global.Sync._passphrase = null;
    global.Sync.msal       = null;
    global.Sync._initialized = false;
  }

  // Re-install mocks so jest.fn() call counts are fresh
  installMocks();

  // Clear DOM app container
  const app = document.getElementById('app');
  if (app) app.innerHTML = '';
}

module.exports = { loadApp, resetState };
