import { State } from '../state.js';
import { Store, CustomFeelings, People, Places, FEELINGS } from '../store.js';
import { Sync } from '../sync.js';
import { Snapshots } from '../snapshots.js';
import { migrateRound, asNameList } from '../model.js';
import { richHtmlToText } from '../richtext.js';
import { openSheet, closeSheet, showToast } from '../ui.js';
import { escapeHtml, escapeAttr, formatDateTime, relativeTime } from '../utils.js';
import { goHome } from '../navigation.js';
import { render } from '../renderer.js';
import { HUB_STEP } from './wizard.js';

// ─── Settings & Sync-UI ──────────────────────────────────────────

export function openSettingsSheet() {
  const s         = Store.loadSettings();
  const connected = Sync.isConnected();
  const account   = connected ? Sync.getAccount() : null;
  const provider  = Sync.getProviderLabel();
  const lastSync  = s.lastSyncAt ? formatDateTime(s.lastSyncAt) : 'Noch nie';
  const hasProvider = Sync.hasProvider();

  const content = document.getElementById('sheet-content');

  let statusSection = '';
  let actionsHtml   = '';

  if (!hasProvider) {
    // Kein Anbieter gewählt — Auswahlbildschirm
    actionsHtml = `
      <button class="sheet-action" data-act="signin-onedrive">Mit Microsoft anmelden</button>
      <button class="sheet-action" data-act="signin-google">Mit Google anmelden</button>
    `;
  } else if (!connected) {
    // Anbieter bekannt, aber nicht eingeloggt
    statusSection = `
      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-label">Anbieter</div>
          <div class="settings-row-value">${escapeHtml(provider || '')}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">Status</div>
          <div class="settings-row-value">Nicht angemeldet</div>
        </div>
      </div>`;
    actionsHtml = `
      <button class="sheet-action" data-act="signin-current">Erneut anmelden</button>
      <button class="sheet-action" data-act="switch-provider">Anderen Anbieter wählen</button>
    `;
  } else {
    // Verbunden
    statusSection = `
      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-label">Status</div>
          <div class="settings-row-value">Verbunden · ${escapeHtml(provider || '')}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">Konto</div>
          <div class="settings-row-value">${escapeHtml(account?.email || account?.name || '')}</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">Letzte Synchronisation</div>
          <div class="settings-row-value">${escapeHtml(lastSync)}</div>
        </div>
      </div>`;
    actionsHtml = `
      <button class="sheet-action" data-act="sync-now">Jetzt synchronisieren</button>
      <button class="sheet-action" data-act="change-passphrase">Passphrase eingeben / ändern</button>
      <button class="sheet-action" data-act="signout">Abmelden</button>
    `;
  }

  content.innerHTML = `
    <h3 class="sheet-title">Einstellungen</h3>
    <p class="sheet-text">Geräteübergreifend synchronisieren — Ende-zu-Ende verschlüsselt.</p>
    ${statusSection}
    <div class="sheet-actions">
      ${actionsHtml}
      <button class="sheet-action" data-act="manage-lists">Listen verwalten</button>
      <button class="sheet-action" data-act="export-json">Lokale Daten exportieren (JSON)</button>
      <button class="sheet-action" data-act="close">Schließen</button>
    </div>
    <div class="settings-legal-links">
      <a href="impressum.html">Impressum</a>
      <span aria-hidden="true">·</span>
      <a href="datenschutz.html">Datenschutz</a>
    </div>
  `;
  openSheet();

  async function doSignIn(providerId) {
    closeSheet();
    try {
      showToast('Anmelden …');
      await Sync.signIn(providerId);
      await ensurePassphraseThenSync();
    } catch (e) {
      console.error(e);
      const msg = (e && e.message) ? e.message : String(e);
      if (msg.length > 60) alert('Anmeldung fehlgeschlagen:\n\n' + msg);
      else showToast('Anmeldung fehlgeschlagen: ' + msg);
    }
  }

  const handlers = {
    'signin-onedrive':  () => doSignIn('onedrive'),
    'signin-google':    () => doSignIn('googledrive'),
    'signin-current':   () => doSignIn(null),
    'switch-provider': async () => {
      await Sync.signOut();
      render();
      setTimeout(openSettingsSheet, 50);
    },
    'sync-now':          async () => { closeSheet(); await triggerManualSync(); },
    'change-passphrase': () => { closeSheet(); openPassphrasePrompt({ change: true }); },
    'signout': async () => {
      if (!confirm('Wirklich abmelden? Lokale Daten bleiben erhalten.')) return;
      closeSheet();
      await Sync.signOut();
      render();
    },
    'manage-lists': () => { closeSheet(); setTimeout(openListsSheet, 50); },
    'export-json': () => { closeSheet(); exportLocalJson(); },
    'close': closeSheet
  };
  Object.keys(handlers).forEach(act => {
    const btn = content.querySelector(`[data-act="${act}"]`);
    if (btn) btn.addEventListener('click', handlers[act]);
  });
}

// ─── Listen verwalten (Personen, Orte, Gefühle) ───────────────────

const LIST_SECTIONS = [
  { key: 'people',   label: 'Personen / Rollen', store: () => People,         placeholder: 'Person hinzufügen + Enter' },
  { key: 'places',   label: 'Orte / Kontexte',   store: () => Places,         placeholder: 'Ort hinzufügen + Enter' },
  { key: 'feelings', label: 'Gefühle',           store: () => CustomFeelings, placeholder: 'Gefühl hinzufügen + Enter' },
];

function listChipHTML(sectionKey, name) {
  return `<span class="tag-chip" data-list-section="${escapeAttr(sectionKey)}" data-list-name="${escapeAttr(name)}">
    <span class="tag-chip-name">${escapeHtml(name)}</span>
    <button type="button" class="tag-edit"   aria-label="Umbenennen">✎</button>
    <button type="button" class="tag-remove" aria-label="Löschen">🗑</button>
  </span>`;
}

function listSectionHTML(section) {
  const items = section.store().get();
  return `
    <div class="settings-section">
      <div class="settings-row-label" style="margin-bottom:8px;">${escapeHtml(section.label)}</div>
      <div class="tag-input-wrap" data-list-wrap="${escapeAttr(section.key)}">
        ${items.map(n => listChipHTML(section.key, n)).join('')}
        <input type="text" class="tag-input-field" data-list-input="${escapeAttr(section.key)}" placeholder="${escapeAttr(section.placeholder)}">
      </div>
    </div>
  `;
}

export function openListsSheet() {
  const content = document.getElementById('sheet-content');
  content.innerHTML = `
    <h3 class="sheet-title">Listen verwalten</h3>
    <p class="sheet-text">Pflege deine wiederkehrenden Personen, Orte und Gefühle. Diese erscheinen als Vorschläge bei jeder Analyse.</p>
    ${LIST_SECTIONS.map(listSectionHTML).join('')}
    <div class="sheet-actions" style="margin-top: 18px;">
      <button class="sheet-action" data-act="back">Zurück zu Einstellungen</button>
      <button class="sheet-action" data-act="close">Schließen</button>
    </div>
  `;
  openSheet();

  LIST_SECTIONS.forEach(section => wireListSection(section));

  content.querySelector('[data-act="back"]').addEventListener('click', () => {
    closeSheet();
    setTimeout(openSettingsSheet, 50);
  });
  content.querySelector('[data-act="close"]').addEventListener('click', closeSheet);
}

function wireListSection(section) {
  const wrap  = document.querySelector(`[data-list-wrap="${section.key}"]`);
  const input = document.querySelector(`[data-list-input="${section.key}"]`);
  if (!wrap || !input) return;
  wrap.querySelectorAll('.tag-chip').forEach(chip => wireListChip(chip, section));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const label = input.value.trim();
      if (!label) return;
      input.value = '';
      if (section.store().get().includes(label)) return;
      section.store().add(label);
      const tmp = document.createElement('div');
      tmp.innerHTML = listChipHTML(section.key, label);
      const chip = tmp.firstElementChild;
      wrap.insertBefore(chip, input);
      wireListChip(chip, section);
    }
  });
}

function wireListChip(chip, section) {
  chip.querySelector('.tag-remove').addEventListener('click', () => {
    section.store().remove(chip.dataset.listName);
    chip.remove();
  });
  chip.querySelector('.tag-edit').addEventListener('click', () => {
    const nameEl  = chip.querySelector('.tag-chip-name');
    const oldName = nameEl.textContent;
    const input   = document.createElement('input');
    input.value   = oldName;
    input.style.cssText = 'background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.6);color:inherit;font:inherit;font-size:14px;outline:none;width:120px;';
    nameEl.replaceWith(input);
    input.focus(); input.select();
    const commit = () => {
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        section.store().rename(oldName, newName);
        chip.dataset.listName = newName;
      }
      const span = document.createElement('span');
      span.className   = 'tag-chip-name';
      span.textContent = newName || oldName;
      input.replaceWith(span);
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.value = oldName; commit(); }
    });
    input.addEventListener('blur', commit);
  });
}

// ─── Statistik / Verlauf ──────────────────────────────────────────

const STATS_RANGES = [
  { key: '30d',    label: '30 Tage', days: 30 },
  { key: '90d',    label: '90 Tage', days: 90 },
  { key: '1y',     label: '1 Jahr',  days: 365 },
  { key: 'all',    label: 'Alle',    days: null },
  { key: 'custom', label: 'Eigener', days: null }
];

function todayDateInput() { return new Date().toISOString().slice(0, 10); }
function daysAgoDateInput(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function statsAggregate(rangeKey, customFrom, customTo) {
  let cutoffStart = null;
  let cutoffEnd   = null;
  if (rangeKey === 'custom') {
    if (customFrom) cutoffStart = customFrom + 'T00:00';
    if (customTo)   cutoffEnd   = customTo   + 'T23:59';
  } else {
    const r = STATS_RANGES.find(x => x.key === rangeKey);
    if (r && r.days) {
      const d = new Date(); d.setDate(d.getDate() - r.days);
      cutoffStart = d.toISOString();
    }
  }
  const all = Store.loadAll().filter(a => a.rounds && a.rounds.length > 0);
  const list = all.filter(a => {
    const dt = a.situation.datetime || a.createdAt || '';
    if (cutoffStart && dt < cutoffStart) return false;
    if (cutoffEnd   && dt > cutoffEnd)   return false;
    return true;
  });

  const sorted = list.slice().sort((a, b) => {
    const da = a.situation.datetime || a.createdAt || '';
    const db = b.situation.datetime || b.createdAt || '';
    return da.localeCompare(db);
  });

  const perAnalysis = sorted.map((a, i) => {
    const tensions = (a.rounds || []).map(r => r.tension || 0);
    const avg = tensions.length ? Math.round(tensions.reduce((s, x) => s + x, 0) / tensions.length) : 0;
    return {
      n:        i + 1,
      datetime: a.situation.datetime || a.createdAt,
      title:    a.situation.title || formatDateTime(a.situation.datetime || a.createdAt),
      mood:     a.situation.mood || 0,
      avgTension: avg
    };
  });

  const perRound = [];
  sorted.forEach((a, ai) => {
    (a.rounds || []).forEach((r, ri) => {
      perRound.push({
        n: perRound.length + 1,
        analysisN: ai + 1,
        roundN:    ri + 1,
        datetime:  a.situation.datetime || a.createdAt,
        title:     a.situation.title || formatDateTime(a.situation.datetime || a.createdAt),
        tension:   r.tension || 0
      });
    });
  });

  const counts = new Map();
  list.forEach(a => {
    (a.rounds || []).forEach(r => {
      (r.thoughts || []).forEach(t => {
        (t.feelings || []).forEach(f => counts.set(f, (counts.get(f) || 0) + 1));
      });
      (r.standaloneFeelings || []).forEach(f => counts.set(f, (counts.get(f) || 0) + 1));
    });
  });
  const topFeelings = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return { perAnalysis, perRound, topFeelings, total: list.length };
}

function smoothSvgPath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function buildStressChartSVG(points, opts) {
  const W = 320, H = 170, padL = 28, padR = 8, padT = 10, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  if (!points.length) {
    return `<div class="stats-empty">Noch keine Daten.</div>`;
  }
  const xAt = i => padL + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const yAt = v => padT + innerH - (innerH * Math.max(0, Math.min(100, v)) / 100);

  const seriesPaths = (opts.series || []).map(s => {
    const xy = points.map((p, i) => ({ x: xAt(i), y: yAt(p[s.key]) }));
    const path = smoothSvgPath(xy);
    const dots = points.map((p, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p[s.key]).toFixed(1)}" r="2.8" fill="${s.color}"/>`).join('');
    return `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="1.6" stroke-linejoin="round"/>${dots}`;
  }).join('');

  const ticks = [0, 25, 50, 75, 100].map(v =>
    `<line x1="${padL}" y1="${yAt(v).toFixed(1)}" x2="${W - padR}" y2="${yAt(v).toFixed(1)}" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
     <text x="${padL - 4}" y="${(yAt(v) + 3).toFixed(1)}" font-size="9" fill="#857a6b" text-anchor="end">${v}</text>`
  ).join('');

  const numberLabels = points.map((p, i) =>
    `<text x="${xAt(i).toFixed(1)}" y="${(padT + innerH + 11).toFixed(1)}" font-size="10" fill="#857a6b" text-anchor="middle" font-weight="500">${escapeHtml(String(p.numLabel != null ? p.numLabel : i + 1))}</text>`
  ).join('');

  const xAxisTitle = opts.xAxisTitle
    ? `<text x="${(padL + innerW / 2).toFixed(1)}" y="${(padT + innerH + 22).toFixed(1)}" font-size="9" fill="#857a6b" text-anchor="middle">${escapeHtml(opts.xAxisTitle)}</text>`
    : '';

  const firstLabel = points[0].label || '';
  const lastLabel  = points[points.length - 1].label || '';
  const dateLabels = `
    <text x="${padL}"        y="${(H - 2).toFixed(1)}" font-size="8" fill="#a89c8a" text-anchor="start">${escapeHtml(firstLabel)}</text>
    <text x="${W - padR}"    y="${(H - 2).toFixed(1)}" font-size="8" fill="#a89c8a" text-anchor="end">${escapeHtml(lastLabel)}</text>
  `;

  const legend = (opts.series || []).map((s, i) =>
    `<g transform="translate(${padL + i * 90}, 0)">
       <line x1="0" y1="6" x2="14" y2="6" stroke="${s.color}" stroke-width="1.6"/>
       <text x="18" y="9" font-size="9" fill="#857a6b">${escapeHtml(s.label)}</text>
     </g>`
  ).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" class="stats-chart" role="img" aria-label="Stress-Verlauf">
      <g transform="translate(0,2)">${legend}</g>
      ${ticks}
      ${seriesPaths}
      ${numberLabels}
      ${xAxisTitle}
      ${dateLabels}
    </svg>
  `;
}

function shortDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.`;
}

export function openStatsSheet(opts = {}) {
  const mode  = opts.mode  === 'round' ? 'round' : 'analysis';
  const range = STATS_RANGES.some(r => r.key === opts.range) ? opts.range : 'all';
  const customFrom = (range === 'custom') ? (opts.from || daysAgoDateInput(30)) : null;
  const customTo   = (range === 'custom') ? (opts.to   || todayDateInput())     : null;
  const data  = statsAggregate(range, customFrom, customTo);
  const content = document.getElementById('sheet-content');

  let chartHTML, modeLabel, indexListHTML;
  if (mode === 'analysis') {
    const points = data.perAnalysis.map(p => ({
      mood: p.mood, avgTension: p.avgTension,
      label: shortDateLabel(p.datetime),
      numLabel: p.n
    }));
    chartHTML = buildStressChartSVG(points, {
      series: [
        { key: 'mood',       label: 'Stimmung',   color: '#c9a55d' },
        { key: 'avgTension', label: 'Ø Spannung', color: '#a8553f' },
      ],
      xAxisTitle: 'Analyse'
    });
    modeLabel = `${data.perAnalysis.length} Analyse${data.perAnalysis.length === 1 ? '' : 'n'}`;
    indexListHTML = data.perAnalysis.map(p =>
      `<div class="stats-index-row"><span class="stats-index-num">${p.n}.</span><span class="stats-index-text">${escapeHtml(p.title)}<span class="stats-index-meta">· ${escapeHtml(shortDateLabel(p.datetime))}</span></span></div>`
    ).join('');
  } else {
    const points = data.perRound.map(p => ({
      tension: p.tension,
      label: shortDateLabel(p.datetime),
      numLabel: p.n
    }));
    chartHTML = buildStressChartSVG(points, {
      series: [{ key: 'tension', label: 'Spannung', color: '#a8553f' }],
      xAxisTitle: 'Runde'
    });
    modeLabel = `${data.perRound.length} Runde${data.perRound.length === 1 ? '' : 'n'}`;
    indexListHTML = data.perRound.map(p =>
      `<div class="stats-index-row"><span class="stats-index-num">${p.n}.</span><span class="stats-index-text">${escapeHtml(p.title)} <span class="stats-index-meta">· Analyse ${p.analysisN}, Runde ${p.roundN}</span></span></div>`
    ).join('');
  }

  const maxCount = data.topFeelings.length ? data.topFeelings[0][1] : 1;
  const feelingBars = data.topFeelings.map(([name, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    return `<div class="stats-feel-row">
      <div class="stats-feel-label">${escapeHtml(name)}</div>
      <div class="stats-feel-bar"><div class="stats-feel-fill" style="width:${pct}%"></div></div>
      <div class="stats-feel-count">${count}</div>
    </div>`;
  }).join('');

  content.innerHTML = `
    <h3 class="sheet-title">Statistik</h3>
    <p class="sheet-text">Stress-Verlauf und häufigste Gefühle über alle Analysen.</p>

    <div class="settings-section">
      <div class="settings-row-label" style="margin-bottom: 6px;">Zeitraum</div>
      <div class="stats-mode-toggle" role="tablist">
        ${STATS_RANGES.map(r => `<button class="stats-mode-btn ${range === r.key ? 'active' : ''}" data-stats-range="${r.key}">${escapeHtml(r.label)}</button>`).join('')}
      </div>
      ${range === 'custom' ? `
        <div class="stats-custom-range">
          <label class="stats-date-field">
            <span>Von</span>
            <input type="date" id="stats-custom-from" value="${escapeAttr(customFrom)}" max="${escapeAttr(customTo)}">
          </label>
          <label class="stats-date-field">
            <span>Bis</span>
            <input type="date" id="stats-custom-to" value="${escapeAttr(customTo)}" min="${escapeAttr(customFrom)}">
          </label>
        </div>
      ` : ''}
    </div>

    <div class="settings-section">
      <div class="settings-row-label" style="margin-bottom: 6px;">Stress-Verlauf · ${escapeHtml(modeLabel)}</div>
      <div class="stats-mode-toggle" role="tablist">
        <button class="stats-mode-btn ${mode === 'analysis' ? 'active' : ''}" data-stats-mode="analysis">Pro Analyse</button>
        <button class="stats-mode-btn ${mode === 'round' ? 'active' : ''}"    data-stats-mode="round">Pro Runde</button>
      </div>
      ${chartHTML}
      ${indexListHTML ? `<div class="stats-index-list">${indexListHTML}</div>` : ''}
    </div>

    <div class="settings-section">
      <div class="settings-row-label" style="margin-bottom: 8px;">Häufigste Gefühle</div>
      ${data.topFeelings.length === 0
        ? `<div class="stats-empty">Noch keine Gefühle erfasst.</div>`
        : `<div class="stats-feel-list">${feelingBars}</div>`}
    </div>

    <div class="sheet-actions" style="margin-top: 18px;">
      <button class="sheet-action" data-act="close">Schließen</button>
    </div>
  `;
  openSheet();

  content.querySelectorAll('[data-stats-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.statsMode;
      if (next !== mode) openStatsSheet({ mode: next, range, from: customFrom, to: customTo });
    });
  });
  content.querySelectorAll('[data-stats-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.statsRange;
      if (next === range) return;
      const passOpts = { mode, range: next };
      if (next === 'custom') {
        passOpts.from = customFrom || daysAgoDateInput(30);
        passOpts.to   = customTo   || todayDateInput();
      }
      openStatsSheet(passOpts);
    });
  });
  if (range === 'custom') {
    const fromEl = content.querySelector('#stats-custom-from');
    const toEl   = content.querySelector('#stats-custom-to');
    const apply = () => openStatsSheet({ mode, range: 'custom', from: fromEl.value, to: toEl.value });
    if (fromEl) fromEl.addEventListener('change', apply);
    if (toEl)   toEl.addEventListener('change', apply);
  }
  content.querySelector('[data-act="close"]').addEventListener('click', closeSheet);
}

export function openPassphrasePrompt(opts = {}) {
  const { change = false, onSuccess = null, message = null } = opts;
  const content = document.getElementById('sheet-content');
  content.innerHTML = `
    <h3 class="sheet-title">${change ? 'Passphrase eingeben' : 'Verschlüsselungs-Passphrase'}</h3>
    <p class="sheet-text">
      ${message ? escapeHtml(message) : (change
        ? 'Gib die Passphrase ein, mit der deine Cloud-Daten verschlüsselt sind.'
        : 'Wähle eine Passphrase. Sie verschlüsselt alle Daten lokal vor dem Hochladen — der Cloud-Anbieter kann nichts lesen. Wenn du sie verlierst, sind die Cloud-Daten unwiederbringlich verloren.')}
    </p>
    <input type="password" id="pass-input" placeholder="Passphrase" autocomplete="new-password" autocapitalize="off" spellcheck="false" style="margin-bottom: 12px;">
    ${!change ? `
      <input type="password" id="pass-input-2" placeholder="Passphrase wiederholen" autocomplete="new-password" autocapitalize="off" spellcheck="false">
      <p style="font-size: 12px; color: var(--ink-muted); margin: 12px 0 0;">Mind. 8 Zeichen. Schreib sie dir an einem sicheren Ort auf.</p>
    ` : ''}
    <div class="sheet-actions" style="margin-top: 18px;">
      <button class="sheet-action" data-act="ok">Bestätigen</button>
      <button class="sheet-action" data-act="cancel">Abbrechen</button>
    </div>
  `;
  openSheet();

  content.querySelector('[data-act="ok"]').addEventListener('click', async () => {
    const v1 = document.getElementById('pass-input').value;
    if (!v1) { showToast('Bitte Passphrase eingeben'); return; }
    if (!change && v1.length < 8) { showToast('Mind. 8 Zeichen'); return; }
    if (!change) {
      const v2 = document.getElementById('pass-input-2').value;
      if (v1 !== v2) { showToast('Passphrasen stimmen nicht überein'); return; }
    }
    Sync.setPassphrase(v1);
    closeSheet();
    if (onSuccess) await onSuccess();
  });
  content.querySelector('[data-act="cancel"]').addEventListener('click', closeSheet);
}

export async function ensurePassphraseThenSync() {
  if (!Sync.hasPassphrase()) {
    let remoteExists = false;
    try { const r = await Sync.fetchRemote(); remoteExists = !!r; } catch (e) {}
    openPassphrasePrompt({
      change: remoteExists,
      message: remoteExists
        ? 'In der Cloud liegen verschlüsselte Daten. Gib deine Passphrase ein, um sie zu entschlüsseln.'
        : null,
      onSuccess: doInitialSync
    });
    return;
  }
  await doInitialSync();
}

export async function doInitialSync() {
  try {
    showToast('Synchronisiere …');
    await Sync.syncNow();
    showToast('Synchronisiert');
    render();
  } catch (e) {
    console.error(e);
    if (e.code === 'BAD_PASSPHRASE') {
      Sync.clearPassphrase();
      openPassphrasePrompt({
        change: true,
        message: 'Falsche Passphrase. Bitte erneut eingeben.',
        onSuccess: doInitialSync
      });
    } else {
      showToast('Sync fehlgeschlagen: ' + (e.message || e));
    }
  }
}

export async function triggerManualSync() {
  if (!Sync.isConnected()) { openSettingsSheet(); return; }
  if (!Sync.hasPassphrase()) {
    openPassphrasePrompt({
      change: true,
      message: 'Gib deine Passphrase ein, um zu synchronisieren.',
      onSuccess: doInitialSync
    });
    return;
  }
  await doInitialSync();
}

function exportLocalJson() {
  const bundle = {
    exportedAt: new Date().toISOString(),
    list: Store.loadAll(),
    tombstones: Store.loadTombstones()
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `mikroanalysen_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exportiert');
}

// ─── Share Sheet ─────────────────────────────────────────────────

export function openShareSheet(a) {
  const content = document.getElementById('sheet-content');
  content.innerHTML = `
    <h3 class="sheet-title">Analyse exportieren</h3>
    <p class="sheet-text">Wie möchtest du die Analyse weitergeben?</p>
    <div class="sheet-actions">
      <button class="sheet-action" data-act="share">Als Text teilen</button>
      <button class="sheet-action" data-act="copy">Text in Zwischenablage</button>
      <button class="sheet-action" data-act="pdf">Als PDF speichern</button>
      <button class="sheet-action danger" data-act="delete">Analyse löschen</button>
    </div>
  `;
  openSheet();

  content.querySelector('[data-act="share"]').addEventListener('click', () => { closeSheet(); shareAsText(a); });
  content.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    closeSheet();
    try {
      await navigator.clipboard.writeText(buildTextExport(a));
      showToast('In Zwischenablage kopiert');
    } catch (e) { showToast('Kopieren nicht möglich'); }
  });
  content.querySelector('[data-act="pdf"]').addEventListener('click', () => { closeSheet(); exportPdf(a); });
  content.querySelector('[data-act="delete"]').addEventListener('click', () => {
    closeSheet();
    if (confirm('Analyse wirklich löschen? Das kann nicht rückgängig gemacht werden.')) {
      Store.remove(a.id);
      showToast('Gelöscht');
      goHome();
    }
  });
}

export function openBulkDeleteSheet(ids) {
  const n        = ids.length;
  const analyses = ids.map(id => Store.get(id)).filter(Boolean);
  const content  = document.getElementById('sheet-content');
  content.innerHTML = `
    <h3 class="sheet-title">${n} ${n === 1 ? 'Eintrag' : 'Einträge'} löschen</h3>
    <p class="sheet-text">${analyses.map(a => escapeHtml(a.situation.title || formatDateTime(a.situation.datetime))).join('<br>')}</p>
    <div class="sheet-actions">
      <button class="sheet-action danger" id="btn-bulk-delete-confirm">Endgültig löschen</button>
      <button class="sheet-action" id="btn-bulk-delete-cancel">Abbrechen</button>
    </div>
  `;
  openSheet();
  document.getElementById('btn-bulk-delete-confirm').addEventListener('click', () => {
    closeSheet();
    ids.forEach(id => Store.remove(id));
    showToast(`${n} ${n === 1 ? 'Eintrag' : 'Einträge'} gelöscht`);
    State.selectionMode = false;
    State.selectedIds   = [];
    render();
  });
  document.getElementById('btn-bulk-delete-cancel').addEventListener('click', closeSheet);
}

export function openBulkExportSheet(analyses) {
  const n       = analyses.length;
  const content = document.getElementById('sheet-content');
  content.innerHTML = `
    <h3 class="sheet-title">${n} ${n === 1 ? 'Eintrag' : 'Einträge'} exportieren</h3>
    <p class="sheet-text">Wie sollen die Einträge exportiert werden?</p>
    <div class="sheet-actions">
      <button class="sheet-action" data-act="combined">Gemeinsames PDF</button>
      <button class="sheet-action" data-act="separate">Einzelne PDFs (${n} Dateien)</button>
    </div>
  `;
  openSheet();
  content.querySelector('[data-act="combined"]').addEventListener('click', () => {
    closeSheet();
    exportPdfMulti(analyses, true);
    State.selectionMode = false;
    State.selectedIds   = [];
    render();
  });
  content.querySelector('[data-act="separate"]').addEventListener('click', () => {
    closeSheet();
    exportPdfMulti(analyses, false);
    State.selectionMode = false;
    State.selectedIds   = [];
    render();
  });
}

export function openHistorySheet(a) {
  const snaps = Snapshots.list(a.id);
  if (snaps.length === 0) { showToast('Noch kein Verlauf verfügbar'); return; }
  const content = document.getElementById('sheet-content');
  content.innerHTML = '<div class="sheet-title">Verlauf</div>' +
    '<p style="padding:0 16px 12px;font-size:13px;color:var(--ink-muted)">Zeitpunkt antippen zum Wiederherstellen</p>' +
    [...snaps].reverse().map(s => {
      const dt = new Date(s.ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return '<button class="sheet-action" data-snap-ts="' + s.ts + '" style="flex-direction:column;align-items:flex-start;gap:2px">' +
        '<span style="font-weight:500">' + relativeTime(s.ts) + '</span>' +
        '<span style="font-size:11px;color:var(--ink-muted)">' + dt + ' · ' + (s.data.rounds ? s.data.rounds.length : 0) + ' Runde(n)</span>' +
        '</button>';
    }).join('') +
    '<button class="sheet-action" id="btn-snap-cancel">Abbrechen</button>';
  openSheet();
  content.querySelectorAll('[data-snap-ts]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeSheet();
      const ts       = parseInt(btn.dataset.snapTs, 10);
      const restored = Snapshots.restore(a.id, ts);
      if (!restored) { showToast('Snapshot nicht gefunden'); return; }
      delete restored._draft;
      Store.upsert(restored);
      State.current   = Store.get(restored.id);
      State.step      = State.current.rounds.length > 0 ? HUB_STEP : 0;
      State.roundIdx  = -1;
      State.roundStep = 0;
      showToast('Auf ' + relativeTime(ts) + ' zurückgesetzt');
      render();
    });
  });
  document.getElementById('btn-snap-cancel').addEventListener('click', closeSheet);
}

// ─── Text- / PDF-Export ──────────────────────────────────────────

export function buildTextExport(a) {
  a.rounds.forEach(migrateRound);
  const lines = [];
  lines.push('MIKROANALYSE');
  lines.push('═══════════════════════════════════');
  lines.push('');
  if (a.situation.title) { lines.push(a.situation.title); lines.push(''); }
  lines.push(formatDateTime(a.situation.datetime));
  lines.push('');
  lines.push('AUSGANGSSITUATION');
  lines.push('───────────────────────────────────');
  lines.push(`Stimmung / Stresslevel: ${a.situation.mood} / 100`);
  lines.push('');
  lines.push('Bedürfnis zu Beginn:');
  lines.push(richHtmlToText(a.situation.need) || '–');
  lines.push('');
  lines.push('Was vorher passiert ist:');
  lines.push(richHtmlToText(a.situation.contextWhat || a.situation.context) || '–');
  const whoList   = asNameList(a.situation.contextWho);
  const whereList = asNameList(a.situation.contextWhere);
  if (whoList.length)   { lines.push(''); lines.push('Wer war beteiligt:');  lines.push(whoList.join(' · ')); }
  if (whereList.length) { lines.push(''); lines.push('Wo war das:');         lines.push(whereList.join(' · ')); }
  lines.push('');

  function pushReaction(r) {
    lines.push('a) Interpretation:');
    lines.push(richHtmlToText(r.interpretation) || '–');
    lines.push('');
    lines.push('b/c) Gedanken & Gefühle:');
    if (!r.thoughts || r.thoughts.length === 0) {
      lines.push('–');
    } else {
      r.thoughts.forEach((t, ti) => {
        const feelings = (t.feelings || []).join(' · ');
        lines.push(`  Gedanke ${ti + 1}: ${richHtmlToText(t.text) || '–'}`);
        if (feelings) lines.push(`     Gefühle: ${feelings}`);
      });
    }
    const standaloneF = (r.standaloneFeelings || []).join(' · ');
    if (standaloneF) { lines.push(''); lines.push(`Gefühle ohne Gedanken: ${standaloneF}`); }
    lines.push('');
    lines.push(`d) Spannung: ${r.tension} / 100`);
    lines.push('');
    lines.push('e) Bedürfnis:');
    lines.push(richHtmlToText(r.need) || '–');
    lines.push('');
  }

  a.rounds.forEach((r, i) => {
    lines.push('');
    lines.push(`RUNDE ${i + 1}${i === 0 ? ` — ${r.starter === 'me' ? 'Ich startete' : 'IP startete'}` : ''}`);
    lines.push('───────────────────────────────────');

    function pushBehavior(label, verbal, nonverbal, legacy) {
      lines.push(`${label}:`);
      if (verbal || nonverbal) {
        if (verbal)   lines.push(`  Verbal: ${richHtmlToText(verbal)}`);
        if (nonverbal) lines.push(`  Nonverbal: ${richHtmlToText(nonverbal)}`);
      } else { lines.push(richHtmlToText(legacy) || '–'); }
      lines.push('');
    }

    if (r.starter === 'me') {
      pushReaction(r);
      pushBehavior('f) Mein Verhalten', r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
      lines.push('g) Gewünschte Wirkung auf IP:');
      lines.push(richHtmlToText(r.desiredEffect) || '–');
      lines.push('');
      pushBehavior('IP-Verhalten (Reaktion)', r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
    } else {
      pushBehavior('IP-Verhalten', r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
      pushReaction(r);
      pushBehavior('f) Mein Verhalten', r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
      lines.push('g) Gewünschte Wirkung auf IP:');
      lines.push(richHtmlToText(r.desiredEffect) || '–');
      lines.push('');
    }
  });
  return lines.join('\n');
}

async function shareAsText(a) {
  const text = buildTextExport(a);
  if (navigator.share) {
    try { await navigator.share({ title: 'Mikroanalyse', text }); }
    catch (e) { if (e.name !== 'AbortError') showToast('Teilen nicht möglich'); }
  } else {
    try { await navigator.clipboard.writeText(text); showToast('Text in Zwischenablage'); }
    catch (e) { showToast('Teilen nicht verfügbar'); }
  }
}

export function exportPdf(a) {
  const fname = `Mikroanalyse_${(a.situation.datetime || '').replace(/[:T]/g, '-')}.pdf`;
  _buildPdf([a], fname);
}

export function exportPdfMulti(analyses, oneFile) {
  if (oneFile) {
    const stamp = new Date().toISOString().slice(0, 10);
    _buildPdf(analyses, `Mikroanalyse_Sammlung_${stamp}.pdf`);
  } else {
    analyses.forEach(a => exportPdf(a));
    if (analyses.length > 1) showToast(`${analyses.length} PDFs gespeichert`);
  }
}

function _buildPdf(analyses, fname) {
  try {
    const { jsPDF }    = window.jspdf;
    const doc          = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth    = 210;
    const pageHeight   = 297;
    const marginX      = 18;
    const marginTop    = 22;
    const marginBottom = 22;
    const maxWidth     = pageWidth - 2 * marginX;
    let y = marginTop;

    function ensureSpace(needed) {
      if (y + needed > pageHeight - marginBottom) { doc.addPage(); y = marginTop; }
    }
    function writeHeading(text, size, gap) {
      size = size || 16; gap = gap || 6;
      ensureSpace(size * 0.6 + gap);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(42, 38, 34);
      doc.text(text, marginX, y); y += size * 0.45 + gap;
    }
    function writeLabel(text) {
      ensureSpace(7);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 110, 100);
      doc.text(text.toUpperCase(), marginX, y); y += 4;
    }
    function writeBody(text) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(42, 38, 34);
      const lines = doc.splitTextToSize(text || '–', maxWidth);
      lines.forEach(line => { ensureSpace(6); doc.text(line, marginX, y); y += 5.5; });
      y += 3;
    }
    function writeSubLabel(text) {
      ensureSpace(6);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(120, 110, 100);
      doc.text(text + ':', marginX, y); y += 4;
    }
    function pdfStyleStr(t) {
      if (t.bold && t.italic) return 'bolditalic';
      if (t.bold)             return 'bold';
      if (t.italic)           return 'italic';
      return 'normal';
    }
    function writeRichBody(html) {
      const raw = String(html == null ? '' : html).trim();
      if (!raw) { writeBody('–'); return; }
      const tmp = document.createElement('div');
      tmp.innerHTML = raw;

      const blocks = [{ segs: [], indent: 0, bullet: false }];
      const top = () => blocks[blocks.length - 1];
      const newBlock = (o) => blocks.push({ segs: [], indent: (o && o.indent) || 0, bullet: !!(o && o.bullet) });

      function walk(node, style, ctx) {
        if (node.nodeType === 3) {
          if (node.textContent) top().segs.push({ text: node.textContent, bold: !!style.bold, italic: !!style.italic, underline: !!style.underline });
          return;
        }
        if (node.nodeType !== 1) return;
        const tag = node.tagName.toLowerCase();
        if (tag === 'br') { newBlock({ indent: ctx.indent }); return; }
        if (tag === 'strong' || tag === 'b') { Array.from(node.childNodes).forEach(c => walk(c, Object.assign({}, style, { bold: true }), ctx)); return; }
        if (tag === 'em' || tag === 'i')     { Array.from(node.childNodes).forEach(c => walk(c, Object.assign({}, style, { italic: true }), ctx)); return; }
        if (tag === 'u')                     { Array.from(node.childNodes).forEach(c => walk(c, Object.assign({}, style, { underline: true }), ctx)); return; }
        if (tag === 'p') {
          if (top().segs.length > 0) newBlock({ indent: ctx.indent });
          Array.from(node.childNodes).forEach(c => walk(c, style, ctx));
          newBlock({ indent: ctx.indent });
          return;
        }
        if (tag === 'ul' || tag === 'ol') {
          Array.from(node.childNodes).forEach(c => walk(c, style, Object.assign({}, ctx, { indent: (ctx.indent || 0) + 1 })));
          return;
        }
        if (tag === 'li') {
          newBlock({ indent: ctx.indent, bullet: true });
          Array.from(node.childNodes).forEach(c => walk(c, style, ctx));
          return;
        }
        Array.from(node.childNodes).forEach(c => walk(c, style, ctx));
      }
      Array.from(tmp.childNodes).forEach(c => walk(c, {}, { indent: 0 }));

      while (blocks.length > 1 && blocks[blocks.length - 1].segs.length === 0 && !blocks[blocks.length - 1].bullet) blocks.pop();
      if (blocks.length === 1 && blocks[0].segs.length === 0) { writeBody('–'); return; }

      doc.setFontSize(11); doc.setTextColor(42, 38, 34);
      const lh = 5.5, indentStep = 4, bulletGap = 3.5;

      blocks.forEach(block => {
        const baseX = marginX + (block.indent || 0) * indentStep;
        let x = baseX;
        if (block.bullet) {
          ensureSpace(6);
          doc.setFont('helvetica', 'normal');
          doc.text('•', baseX, y);
          x += bulletGap;
        }
        const tokens = [];
        block.segs.forEach(seg => {
          (seg.text || '').split(/(\s+)/).forEach(p => {
            if (p) tokens.push({ text: p, bold: seg.bold, italic: seg.italic, underline: seg.underline });
          });
        });
        if (tokens.length === 0) { ensureSpace(6); y += lh; return; }

        let curX = x;
        let atLineStart = true;
        const lineMax = pageWidth - marginX;
        tokens.forEach(tok => {
          const isWs = /^\s+$/.test(tok.text);
          if (atLineStart && isWs) return;
          doc.setFont('helvetica', pdfStyleStr(tok));
          const w = doc.getTextWidth(tok.text);
          if (curX + w > lineMax && !atLineStart) {
            ensureSpace(6); y += lh; curX = x; atLineStart = true;
            if (isWs) return;
          }
          ensureSpace(6);
          doc.text(tok.text, curX, y);
          if (tok.underline && !isWs) {
            const uy = y + 0.6;
            doc.setLineWidth(0.2); doc.setDrawColor(42, 38, 34);
            doc.line(curX, uy, curX + w, uy);
          }
          curX += w;
          atLineStart = false;
        });
        y += lh;
      });
      y += 3;
    }
    function drawChart(opts) {
      const w = opts.width || maxWidth;
      const h = opts.height || 60;
      ensureSpace(h + 4);
      const cx = marginX, cy = y;
      const padL = 12, padR = 4, padT = 6, padB = 14;
      const innerW = w - padL - padR;
      const innerH = h - padT - padB;
      const xCount = opts.xCount;
      const xAt = i => cx + padL + (xCount === 1 ? innerW / 2 : (innerW * i) / Math.max(1, xCount - 1));
      const yAt = v => cy + padT + innerH - (innerH * Math.max(0, Math.min(100, v)) / 100);

      doc.setDrawColor(230, 223, 211);
      doc.setLineWidth(0.2);
      doc.rect(cx, cy, w, h);

      doc.setFontSize(7); doc.setTextColor(133, 122, 107);
      [0, 25, 50, 75, 100].forEach(v => {
        const ly = yAt(v);
        doc.setDrawColor(238, 232, 220);
        doc.line(cx + padL, ly, cx + w - padR, ly);
        doc.text(String(v), cx + padL - 1, ly + 1.5, { align: 'right' });
      });

      if (opts.refLine != null) {
        const ry = yAt(opts.refLine);
        doc.setDrawColor(201, 165, 93);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(cx + padL, ry, cx + w - padR, ry);
        doc.setLineDashPattern([], 0);
        doc.setTextColor(201, 165, 93);
        doc.setFontSize(7);
        doc.text(opts.refLineLabel || `Stimmung Start ${opts.refLine}`, cx + w - padR, ry - 0.8, { align: 'right' });
      }

      (opts.series || []).forEach(s => {
        const [r, g, b] = s.color;
        doc.setDrawColor(r, g, b);
        doc.setFillColor(r, g, b);
        doc.setLineWidth(0.5);
        const pts = s.values.map((v, i) => v == null ? null : { x: xAt(i), y: yAt(v) }).filter(Boolean);
        if (pts.length >= 2) {
          const STEPS = 14;
          let prev = pts[0];
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2] || p2;
            const c1x = p1.x + (p2.x - p0.x) / 6;
            const c1y = p1.y + (p2.y - p0.y) / 6;
            const c2x = p2.x - (p3.x - p1.x) / 6;
            const c2y = p2.y - (p3.y - p1.y) / 6;
            for (let t = 1; t <= STEPS; t++) {
              const tt = t / STEPS, u = 1 - tt;
              const sx = u*u*u*p1.x + 3*u*u*tt*c1x + 3*u*tt*tt*c2x + tt*tt*tt*p2.x;
              const sy = u*u*u*p1.y + 3*u*u*tt*c1y + 3*u*tt*tt*c2y + tt*tt*tt*p2.y;
              doc.line(prev.x, prev.y, sx, sy);
              prev = { x: sx, y: sy };
            }
          }
        }
        pts.forEach(p => doc.circle(p.x, p.y, 0.9, 'F'));
      });

      if (opts.xLabels && opts.xLabels.length) {
        doc.setFontSize(8); doc.setTextColor(120, 110, 100);
        opts.xLabels.forEach((label, i) => {
          doc.text(String(label), xAt(i), cy + h - 4, { align: 'center' });
        });
      }
      if (opts.xAxisTitle) {
        doc.setFontSize(7); doc.setTextColor(133, 122, 107);
        doc.text(opts.xAxisTitle, cx + padL + innerW / 2, cy + h - 0.5, { align: 'center' });
      }
      if (opts.legend && opts.legend.length) {
        doc.setFontSize(7);
        let lx = cx + padL;
        opts.legend.forEach(item => {
          const [lr, lg, lb] = item.color;
          doc.setDrawColor(lr, lg, lb); doc.setLineWidth(0.6);
          doc.line(lx, cy + 2, lx + 6, cy + 2);
          doc.setTextColor(120, 110, 100);
          doc.text(item.label, lx + 7.5, cy + 3, { align: 'left' });
          lx += 7.5 + doc.getTextWidth(item.label) + 6;
        });
      }
      y = cy + h + 4;
    }
    function rule() {
      ensureSpace(6);
      doc.setDrawColor(230, 223, 211); doc.setLineWidth(0.2);
      doc.line(marginX, y, pageWidth - marginX, y); y += 6;
    }

    const isBulk = analyses.length > 1;

    if (isBulk) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(148, 138, 126);
      doc.text('MIKROANALYSE — SAMMLUNG', marginX, y); y += 6;
      writeHeading(`${analyses.length} Analysen`, 20, 4);
      const sorted = analyses.slice().sort((a, b) =>
        (a.situation.datetime || a.createdAt || '').localeCompare(b.situation.datetime || b.createdAt || '')
      );
      const moodValues    = sorted.map(a => Number(a.situation.mood) || 0);
      const tensionValues = sorted.map(a => {
        const ts = (a.rounds || []).map(r => r.tension || 0);
        return ts.length ? Math.round(ts.reduce((s, x) => s + x, 0) / ts.length) : 0;
      });
      writeLabel('Übersicht: Stimmung & Spannung');
      drawChart({
        height: 70,
        xCount: sorted.length,
        series: [
          { color: [201, 165, 93], values: moodValues },
          { color: [168,  85, 63], values: tensionValues }
        ],
        xLabels: sorted.map((_, i) => String(i + 1)),
        xAxisTitle: 'Analyse',
        legend: [
          { color: [201, 165, 93], label: 'Stimmung Start' },
          { color: [168,  85, 63], label: 'Ø Spannung' }
        ]
      });
      writeLabel('Inhalt');
      sorted.forEach((a, i) => {
        const title = a.situation.title || formatDateTime(a.situation.datetime || a.createdAt) || 'Ohne Titel';
        const dt    = a.situation.title ? ` · ${formatDateTime(a.situation.datetime || a.createdAt)}` : '';
        ensureSpace(5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(42, 38, 34);
        doc.text(`${i + 1}.  ${title}${dt}`, marginX, y);
        y += 5;
      });
      analyses = sorted;
    }

    analyses.forEach((a, ai) => {
      if (ai > 0 || isBulk) { doc.addPage(); y = marginTop; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(148, 138, 126);
      doc.text(isBulk ? `ANALYSE ${ai + 1} / ${analyses.length}` : 'MIKROANALYSE', marginX, y); y += 6;
      const headingPrefix = isBulk ? `${ai + 1}. ` : '';
      if (a.situation.title) {
        writeHeading(headingPrefix + a.situation.title, 20, 2);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(120, 110, 100);
        doc.text(formatDateTime(a.situation.datetime), marginX, y); y += 6;
      } else {
        writeHeading(headingPrefix + formatDateTime(a.situation.datetime), 18, 4);
      }
      rule();
      writeHeading('Ausgangssituation', 14, 4);
      writeLabel('Stimmung / Stresslevel'); writeBody(`${a.situation.mood} / 100`);
      writeLabel('Bedürfnis zu Beginn');    writeRichBody(a.situation.need);
      writeLabel('Was vorher passiert ist'); writeRichBody(a.situation.contextWhat || a.situation.context);
      const pdfWho   = asNameList(a.situation.contextWho);
      const pdfWhere = asNameList(a.situation.contextWhere);
      if (pdfWho.length)   { writeLabel('Wer war beteiligt'); writeBody(pdfWho.join(' · ')); }
      if (pdfWhere.length) { writeLabel('Wo war das');        writeBody(pdfWhere.join(' · ')); }

      a.rounds.forEach(migrateRound);

      if (a.rounds.length >= 1) {
        rule();
        writeLabel('Spannungsverlauf');
        drawChart({
          height: 56,
          xCount: a.rounds.length,
          series: [{ color: [168, 85, 63], values: a.rounds.map(r => r.tension || 0) }],
          xLabels: a.rounds.map((_, i) => String(i + 1)),
          xAxisTitle: 'Runde',
          refLine: typeof a.situation.mood === 'number' ? a.situation.mood : null,
          refLineLabel: `Stimmung Start ${a.situation.mood}`
        });
      }

      a.rounds.forEach((r, i) => {
        rule();
        writeHeading(`Runde ${i + 1}${i === 0 ? ` — ${r.starter === 'me' ? 'Ich startete' : 'IP startete'}` : ''}`, 14, 4);

        function writeBehavior(label, verbal, nonverbal, legacy) {
          writeLabel(label);
          if (verbal || nonverbal) {
            if (verbal)   { writeSubLabel('Verbal');   writeRichBody(verbal); }
            if (nonverbal) { writeSubLabel('Nonverbal'); writeRichBody(nonverbal); }
          } else { writeRichBody(legacy); }
        }
        function writeReaction() {
          writeLabel('a) Interpretation'); writeRichBody(r.interpretation);
          writeLabel('b/c) Gedanken & Gefühle');
          if (!r.thoughts || r.thoughts.length === 0) {
            writeBody('–');
          } else {
            r.thoughts.forEach((t, ti) => {
              writeSubLabel(`Gedanke ${ti + 1}`);
              writeRichBody(t.text);
              const feelings = (t.feelings || []).join(' · ');
              if (feelings) writeBody(`Gefühle: ${feelings}`);
            });
          }
          const standaloneF = (r.standaloneFeelings || []).join(' · ');
          if (standaloneF) { writeLabel('Gefühle ohne Gedanken'); writeBody(standaloneF); }
          writeLabel('d) Spannung'); writeBody(`${r.tension} / 100`);
          writeLabel('e) Bedürfnis'); writeRichBody(r.need);
        }

        if (r.starter === 'me') {
          writeReaction();
          writeBehavior('f) Mein Verhalten', r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
          writeLabel('g) Gewünschte Wirkung'); writeRichBody(r.desiredEffect);
          writeBehavior('IP-Verhalten (Reaktion)', r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
        } else {
          writeBehavior('IP-Verhalten', r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
          writeReaction();
          writeBehavior('f) Mein Verhalten', r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
          writeLabel('g) Gewünschte Wirkung'); writeRichBody(r.desiredEffect);
        }
      });
    });
    doc.save(fname);
    showToast('PDF gespeichert');
  } catch (e) {
    console.error(e);
    showToast('PDF-Export fehlgeschlagen');
  }
}
