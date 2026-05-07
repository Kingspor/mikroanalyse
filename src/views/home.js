import { State } from '../state.js';
import { Store } from '../store.js';
import { Sync } from '../sync.js';
import { escapeHtml, escapeAttr, formatDateTime, relativeTime } from '../utils.js';
import { startNewAnalysis, openDetail } from '../navigation.js';
import { openSettingsSheet, triggerManualSync, openBulkDeleteSheet, openBulkExportSheet } from './sheets.js';

export function renderHome() {
  const list = Store.loadAll();
  list.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));

  const settings  = Store.loadSettings();
  const synced    = Sync.isConnected();
  const syncLabel = !Sync.hasClientId()
    ? 'Sync nicht eingerichtet'
    : !synced
      ? 'Mit OneDrive verbinden'
      : settings.lastSyncAt
        ? 'Synchronisiert · ' + relativeTime(settings.lastSyncAt)
        : 'Verbunden · noch nicht synchronisiert';

  const sel         = State.selectionMode;
  const selectedIds = State.selectedIds;
  const selCount    = selectedIds.length;
  const app         = document.getElementById('app');

  app.innerHTML = `
    <div class="home-hero fade-in">
      <div class="home-hero-top">
        <div class="home-eyebrow">Mikroanalyse</div>
        <button class="settings-btn" id="settings-btn" aria-label="Einstellungen">⋯</button>
      </div>
      <h1 class="home-title">Eine ruhige <em>Reflexion</em><br>einer Begegnung.</h1>
      <p class="home-subtitle">Schritt für Schritt verstehen, was war.</p>
      <button class="sync-pill ${synced ? 'sync-pill-ok' : ''}" id="sync-pill">
        <span class="sync-dot"></span>
        ${escapeHtml(syncLabel)}
      </button>
    </div>
    <div class="list-wrap fade-in">
      ${list.length === 0 ? `
        <div class="list-empty">
          <div class="list-empty-icon">+</div>
          Noch keine Analysen.<br>
          Lege unten eine neue an.
        </div>
      ` : `
        <div class="list-section-title">
          <span>${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}</span>
          ${list.length > 0 ? `<button class="select-mode-btn" id="btn-select-toggle">${sel ? 'Fertig' : 'Auswählen'}</button>` : ''}
        </div>
        ${list.map(a => renderAnalysisCard(a, sel, selectedIds.includes(a.id))).join('')}
      `}
    </div>
    ${!sel ? `<button class="fab-add" id="fab-add" aria-label="Neue Analyse">+</button>` : ''}
    ${sel ? `
      <div class="selection-bar" id="selection-bar">
        <span class="selection-count">${selCount === 0 ? 'Nichts gewählt' : selCount === 1 ? '1 Eintrag gewählt' : `${selCount} Einträge gewählt`}</span>
        <div class="selection-bar-actions">
          <button class="selection-bar-btn" id="btn-select-all">${selCount === list.length ? 'Alle abwählen' : 'Alle wählen'}</button>
          <button class="selection-bar-btn selection-bar-btn-danger" id="btn-delete-sel" ${selCount === 0 ? 'disabled' : ''}>Löschen</button>
          <button class="selection-bar-btn selection-bar-btn-primary" id="btn-export-sel" ${selCount === 0 ? 'disabled' : ''}>Exportieren</button>
        </div>
      </div>
    ` : ''}
  `;

  if (!sel) {
    document.getElementById('fab-add').addEventListener('click', startNewAnalysis);
  }
  if (document.getElementById('btn-select-toggle')) {
    document.getElementById('btn-select-toggle').addEventListener('click', () => {
      State.selectionMode = !State.selectionMode;
      State.selectedIds   = [];
      renderHome();
    });
  }
  if (sel) {
    document.querySelectorAll('[data-select]').forEach(el => {
      el.addEventListener('click', () => {
        const id  = el.dataset.select;
        const idx = State.selectedIds.indexOf(id);
        if (idx === -1) State.selectedIds.push(id);
        else State.selectedIds.splice(idx, 1);
        renderHome();
      });
    });
    document.getElementById('btn-select-all').addEventListener('click', () => {
      if (selCount === list.length) State.selectedIds = [];
      else State.selectedIds = list.map(a => a.id);
      renderHome();
    });
    document.getElementById('btn-delete-sel').addEventListener('click', () => {
      if (!State.selectedIds.length) return;
      openBulkDeleteSheet(State.selectedIds.slice());
    });
    document.getElementById('btn-export-sel').addEventListener('click', () => {
      if (!State.selectedIds.length) return;
      const chosen = State.selectedIds.map(id => Store.get(id)).filter(Boolean);
      openBulkExportSheet(chosen);
    });
  } else {
    document.querySelectorAll('[data-open]').forEach(el => {
      el.addEventListener('click', () => openDetail(el.dataset.open));
    });
  }
  document.getElementById('settings-btn').addEventListener('click', openSettingsSheet);
  document.getElementById('sync-pill').addEventListener('click', () => {
    if (!Sync.hasClientId()) openSettingsSheet();
    else if (!Sync.isConnected()) openSettingsSheet();
    else triggerManualSync();
  });
}

export function renderAnalysisCard(a, selMode, isSelected) {
  const dt        = formatDateTime(a.situation.datetime);
  const title     = a.situation.title ? escapeHtml(a.situation.title) : '';
  const snippet   = (a.situation.context || a.situation.need || 'Ohne Beschreibung').slice(0, 140);
  const meta      = a._draft
    ? '<span class="draft-badge">In Bearbeitung</span>'
    : `${a.rounds.length} ${a.rounds.length === 1 ? 'Runde' : 'Runden'}`;
  const selectAttr    = selMode ? `data-select="${a.id}"` : `data-open="${a.id}"`;
  const selectedClass = isSelected ? ' selected' : '';
  return `
    <div class="analysis-card${selectedClass}" ${selectAttr}>
      ${selMode ? `<div class="card-select-circle${isSelected ? ' checked' : ''}"></div>` : ''}
      <div class="analysis-card-top">
        <div class="analysis-card-date">${dt}</div>
        <div class="analysis-card-meta">${meta}</div>
      </div>
      ${title ? `<div class="analysis-card-title">${title}</div>` : ''}
      <div class="analysis-card-snippet">${escapeHtml(snippet)}</div>
      <div class="analysis-card-stats">
        <span class="analysis-card-stat">Stimmung <strong>${a.situation.mood}</strong></span>
        ${a.rounds.length > 0 ? `<span class="analysis-card-stat">Ø Spannung <strong>${avgTension(a)}</strong></span>` : ''}
      </div>
    </div>
  `;
}

export function avgTension(a) {
  if (!a.rounds.length) return '–';
  const sum = a.rounds.reduce((s, r) => s + (r.tension || 0), 0);
  return Math.round(sum / a.rounds.length);
}
