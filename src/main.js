import { Store } from './store.js';
import { State } from './state.js';
import { Sync } from './sync.js';
import { render } from './renderer.js';
import { updateToolbarState, closeSheet, showToast } from './ui.js';
import { initNavigation } from './navigation.js';
import { escapeHtml } from './utils.js';
import { applyRichCommand, handleBeforeInput } from './richtext.js';

// ─── Auto-Sync (injected into Store._onWrite) ────────────────────

function autoSyncDebounced() {
  if (!Sync.isConnected() || !Sync.hasPassphrase()) return;
  clearTimeout(autoSyncDebounced._t);
  autoSyncDebounced._t = setTimeout(async () => {
    if (autoSyncDebounced._running) {
      autoSyncDebounced._pending = true;
      return;
    }
    autoSyncDebounced._running = true;
    try {
      await Sync.push();
      if (State.view === 'home') render();
    } catch (e) {
      console.warn('Auto-Sync fehlgeschlagen', e);
    } finally {
      autoSyncDebounced._running = false;
      if (autoSyncDebounced._pending) {
        autoSyncDebounced._pending = false;
        autoSyncDebounced();
      }
    }
  }, 2000);
}

Store._onWrite = autoSyncDebounced;

// ─── Global event delegation ─────────────────────────────────────

initNavigation();

document.addEventListener('mousedown', e => {
  const btn = e.target.closest('.rich-btn[data-cmd]');
  if (!btn) return;
  e.preventDefault();
  applyRichCommand(btn.dataset.cmd);
  updateToolbarState();
});

document.addEventListener('beforeinput', handleBeforeInput, true);

document.addEventListener('selectionchange', updateToolbarState);

document.getElementById('sheet-backdrop').addEventListener('click', closeSheet);

// ─── Onboarding ──────────────────────────────────────────────────

const ONBOARDING_KEY    = 'mka_onboarding_done';
const ONBOARDING_SLIDES = [
  { icon: '🔍', title: 'Willkommen bei Mikroanalyse',   text: 'Dein persönliches Werkzeug für DBT-basierte Verhaltensanalysen — strukturiert, privat und offline-fähig.' },
  { icon: '🔒', title: 'Deine Daten gehören dir',       text: 'Alle Einträge werden ausschließlich lokal in deinem Browser gespeichert. Kein Server, kein Tracking, keine Accounts.' },
  { icon: '☁️', title: 'Optionaler Cloud-Sync',        text: 'Du kannst deine Daten mit Microsoft OneDrive oder Google Drive synchronisieren — Ende-zu-Ende-verschlüsselt mit einer Passphrase, die nur du kennst.' },
  { icon: '📝', title: 'Loslegen',                      text: 'Tippe auf „Neue Analyse", um eine Situation zu erfassen und Schritt für Schritt zu analysieren.' }
];

function showOnboarding() {
  let idx     = 0;
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Einführung');

  function renderSlide() {
    const slide  = ONBOARDING_SLIDES[idx];
    const isLast = idx === ONBOARDING_SLIDES.length - 1;
    const dots   = ONBOARDING_SLIDES.map((_, i) =>
      '<span class="onboarding-dot' + (i === idx ? ' active' : '') + '"><\/span>'
    ).join('');
    overlay.innerHTML = '<div class="onboarding-slides">' +
      '<div class="onboarding-icon">' + slide.icon + '<\/div>' +
      '<h2 class="onboarding-title">' + escapeHtml(slide.title) + '<\/h2>' +
      '<p class="onboarding-text">' + escapeHtml(slide.text) + '<\/p>' +
      '<div class="onboarding-dots">' + dots + '<\/div>' +
      '<div class="onboarding-actions">' +
        '<button class="onboarding-btn-primary" id="ob-next">' + (isLast ? "Los geht's" : 'Weiter') + '<\/button>' +
        (!isLast ? '<button class="onboarding-btn-skip" id="ob-skip">Überspringen<\/button>' : '') +
      '<\/div>' +
    '<\/div>';
    overlay.querySelector('#ob-next').addEventListener('click', () => {
      if (isLast) finishOnboarding();
      else { idx++; renderSlide(); }
    });
    const skipBtn = overlay.querySelector('#ob-skip');
    if (skipBtn) skipBtn.addEventListener('click', finishOnboarding);
  }

  function finishOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, '1');
    document.body.removeChild(overlay);
    render();
  }

  renderSlide();
  document.body.appendChild(overlay);
}

// ─── Bootstrap ───────────────────────────────────────────────────

if (!localStorage.getItem(ONBOARDING_KEY)) {
  showOnboarding();
} else {
  render();
}

(async () => {
  try {
    const ok = await Sync.init();
    if (ok && Sync.isConnected() && State.view === 'home') render();
  } catch (e) {
    console.warn('Sync-Init fehlgeschlagen', e);
  }
})();
