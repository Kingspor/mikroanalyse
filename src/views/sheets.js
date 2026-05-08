import { State } from '../state.js';
import { Store } from '../store.js';
import { Sync } from '../sync.js';
import { Snapshots } from '../snapshots.js';
import { migrateRound } from '../model.js';
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
    'export-json': () => { closeSheet(); exportLocalJson(); },
    'close': closeSheet
  };
  Object.keys(handlers).forEach(act => {
    const btn = content.querySelector(`[data-act="${act}"]`);
    if (btn) btn.addEventListener('click', handlers[act]);
  });
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
  if (a.situation.contextWho)   { lines.push(''); lines.push('Wer war beteiligt:');  lines.push(a.situation.contextWho); }
  if (a.situation.contextWhere) { lines.push(''); lines.push('Wo war das:'); lines.push(a.situation.contextWhere); }
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
    lines.push(`RUNDE ${i + 1} — ${r.starter === 'me' ? 'Ich startete' : 'IP startete'}`);
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
      pushBehavior('f) Mein Verhalten', r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
      lines.push('g) Gewünschte Wirkung auf IP:');
      lines.push(richHtmlToText(r.desiredEffect) || '–');
      lines.push('');
      pushBehavior('IP-Verhalten (Reaktion)', r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
      pushReaction(r);
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
    function rule() {
      ensureSpace(6);
      doc.setDrawColor(230, 223, 211); doc.setLineWidth(0.2);
      doc.line(marginX, y, pageWidth - marginX, y); y += 6;
    }

    analyses.forEach((a, ai) => {
      if (ai > 0) { doc.addPage(); y = marginTop; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(148, 138, 126);
      doc.text('MIKROANALYSE', marginX, y); y += 6;
      if (a.situation.title) {
        writeHeading(a.situation.title, 20, 2);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(120, 110, 100);
        doc.text(formatDateTime(a.situation.datetime), marginX, y); y += 6;
      } else {
        writeHeading(formatDateTime(a.situation.datetime), 18, 4);
      }
      rule();
      writeHeading('Ausgangssituation', 14, 4);
      writeLabel('Stimmung / Stresslevel'); writeBody(`${a.situation.mood} / 100`);
      writeLabel('Bedürfnis zu Beginn');    writeBody(richHtmlToText(a.situation.need));
      writeLabel('Was vorher passiert ist'); writeBody(richHtmlToText(a.situation.contextWhat || a.situation.context));
      if (a.situation.contextWho)   { writeLabel('Wer war beteiligt'); writeBody(a.situation.contextWho); }
      if (a.situation.contextWhere) { writeLabel('Wo war das');        writeBody(a.situation.contextWhere); }

      a.rounds.forEach(migrateRound);
      a.rounds.forEach((r, i) => {
        rule();
        writeHeading(`Runde ${i + 1} — ${r.starter === 'me' ? 'Ich startete' : 'IP startete'}`, 14, 4);

        function writeBehavior(label, verbal, nonverbal, legacy) {
          writeLabel(label);
          if (verbal || nonverbal) {
            if (verbal)   writeBody(`Verbal: ${richHtmlToText(verbal)}`);
            if (nonverbal) writeBody(`Nonverbal: ${richHtmlToText(nonverbal)}`);
          } else { writeBody(richHtmlToText(legacy)); }
        }
        function writeReaction() {
          writeLabel('a) Interpretation'); writeBody(richHtmlToText(r.interpretation));
          writeLabel('b/c) Gedanken & Gefühle');
          if (!r.thoughts || r.thoughts.length === 0) {
            writeBody('–');
          } else {
            r.thoughts.forEach((t, ti) => {
              const feelings = (t.feelings || []).join(' · ');
              writeBody(`Gedanke ${ti + 1}: ${richHtmlToText(t.text) || '–'}${feelings ? '\n     Gefühle: ' + feelings : ''}`);
            });
          }
          const standaloneF = (r.standaloneFeelings || []).join(' · ');
          if (standaloneF) { writeLabel('Gefühle ohne Gedanken'); writeBody(standaloneF); }
          writeLabel('d) Spannung'); writeBody(`${r.tension} / 100`);
          writeLabel('e) Bedürfnis'); writeBody(richHtmlToText(r.need));
        }

        if (r.starter === 'me') {
          writeBehavior('f) Mein Verhalten', r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
          writeLabel('g) Gewünschte Wirkung'); writeBody(richHtmlToText(r.desiredEffect));
          writeBehavior('IP-Verhalten (Reaktion)', r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
          writeReaction();
        } else {
          writeBehavior('IP-Verhalten', r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
          writeReaction();
          writeBehavior('f) Mein Verhalten', r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
          writeLabel('g) Gewünschte Wirkung'); writeBody(richHtmlToText(r.desiredEffect));
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
