import { State } from '../state.js';
import { Store } from '../store.js';
import { FEELINGS, CustomFeelings } from '../store.js';
import { newRound, newThought, migrateRound } from '../model.js';
import { richEditorHTML, getRichValue, sanitizeRichText, richHtmlToText, valueToEditorHTML } from '../richtext.js';
import { headerHTML, progressHTML, bottomBarHTML, sliderHTML, wireSlider, showToast } from '../ui.js';
import { escapeHtml, escapeAttr } from '../utils.js';
import { goHome } from '../navigation.js';
import { render } from '../renderer.js';
import { openHistorySheet } from './sheets.js';

export const SITUATION_STEPS = 4;
export const STARTER_STEP    = SITUATION_STEPS;     // = 4
export const HUB_STEP        = SITUATION_STEPS + 1; // = 5

export function renderWizard() {
  const a = State.current;
  if (!a) return goHome();
  if (State.roundIdx >= 0) return renderRoundStep();
  if (State.step === HUB_STEP) return renderRoundsHub();
  renderSituationStep();
}

// ─── Situations-Schritte ─────────────────────────────────────────

export function renderSituationStep() {
  const a   = State.current;
  const s   = a.situation;
  const cur = State.step;
  const totalSteps  = SITUATION_STEPS + 1;
  const progressTotal = totalSteps + 1;

  if (cur === STARTER_STEP) return renderStarterStep();

  const sitIdx = cur;
  let body = '';

  if (sitIdx === 0) {
    body = `
      <div class="step-eyebrow">Ausgangssituation</div>
      <h2 class="step-question">Wann war das?</h2>
      <p class="step-hint">Datum und Uhrzeit der Situation – und ein optionaler Titel.</p>
      <input type="datetime-local" id="f-datetime" value="${s.datetime}">
      <label class="field-label mt">Titel <span style="font-weight:400; color:var(--ink-muted)">(optional)</span></label>
      <input type="text" id="f-title" placeholder="z. B. Gespräch mit Kollegen …" value="${escapeAttr(s.title || '')}">
    `;
  } else if (sitIdx === 1) {
    body = `
      <div class="step-eyebrow">Ausgangssituation</div>
      <h2 class="step-question">Wie war deine Stimmung,<br>dein Stresslevel?</h2>
      <p class="step-hint">Vor der Begegnung.</p>
      ${sliderHTML('f-mood', s.mood, ['Ruhig', 'Mittel', 'Angespannt'])}
    `;
  } else if (sitIdx === 2) {
    body = `
      <div class="step-eyebrow">Ausgangssituation</div>
      <h2 class="step-question">Was war dein Bedürfnis<br>zu Beginn?</h2>
      <p class="step-hint">Was hast du gebraucht, gewünscht?</p>
      ${richEditorHTML('f-need', s.need, 'z. B. Ruhe, Anerkennung, Verbindung …')}
    `;
  } else if (sitIdx === 3) {
    const what = s.contextWhat !== undefined && s.contextWhat !== '' ? s.contextWhat : (s.context || '');
    body = `
      <div class="step-eyebrow">Ausgangssituation</div>
      <h2 class="step-question">Was ist unmittelbar<br>vorher passiert?</h2>
      <p class="step-hint">Alle Felder sind optional.</p>
      <label class="field-label">Was ist passiert?</label>
      ${richEditorHTML('f-what', what, 'Beschreibung der Situation …')}
      <label class="field-label mt">Wer war beteiligt?</label>
      <input type="text" id="f-who" placeholder="Personen, Rollen …" value="${escapeAttr(s.contextWho || '')}">
      <label class="field-label mt">Wo war das?</label>
      <input type="text" id="f-where" placeholder="Ort, Kontext …" value="${escapeAttr(s.contextWhere || '')}">
    `;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    ${headerHTML('Situation', `${cur + 1} / ${totalSteps}`, true)}
    ${progressHTML(cur + 1, progressTotal)}
    <div class="content fade-in">
      ${body}
    </div>
    ${bottomBarHTML([
      { id: 'btn-back-step', label: 'Zurück', kind: 'secondary' },
      { id: 'btn-next-step', label: 'Weiter', kind: 'primary' }
    ])}
  `;

  if (sitIdx === 1) {
    wireSlider('f-mood');
  } else {
    const first = app.querySelector('.content [contenteditable], .content input[type="text"], .content input[type="datetime-local"]');
    if (first) first.focus();
  }

  function persist() {
    if (sitIdx === 0) {
      s.datetime = document.getElementById('f-datetime').value || s.datetime;
      const titleEl = document.getElementById('f-title');
      if (titleEl) s.title = titleEl.value.trim();
    }
    if (sitIdx === 1) s.mood = Math.max(0, Math.min(100, parseInt(document.getElementById('f-mood').value, 10) || 50));
    if (sitIdx === 2) s.need = getRichValue('f-need');
    if (sitIdx === 3) {
      s.contextWhat  = getRichValue('f-what');
      s.contextWho   = document.getElementById('f-who').value.trim();
      s.contextWhere = document.getElementById('f-where').value.trim();
    }
    Store.upsert(a);
  }

  document.getElementById('btn-next-step').addEventListener('click', () => {
    persist();
    if (sitIdx < SITUATION_STEPS - 1) State.step++;
    else State.step = STARTER_STEP;
    render();
  });
  document.getElementById('btn-back-step').addEventListener('click', () => {
    persist();
    if (sitIdx === 0) goHome();
    else { State.step--; render(); }
  });
}

// ─── Starter-Wahl ────────────────────────────────────────────────

export function renderStarterStep() {
  const a           = State.current;
  const totalSteps  = SITUATION_STEPS + 1;
  const progressTotal = totalSteps + 1;
  const app = document.getElementById('app');

  app.innerHTML = `
    ${headerHTML('Neue Analyse', `${STARTER_STEP + 1} / ${totalSteps}`, true)}
    ${progressHTML(STARTER_STEP + 1, progressTotal)}
    <div class="content fade-in">
      <div class="step-eyebrow">Art der Interaktion</div>
      <h2 class="step-question">Welche Interaktion<br>möchtest du analysieren?</h2>
      <p class="step-hint">Wer hat den ersten Schritt gemacht?</p>
      <div class="choice-stack" style="margin-top: 20px;">
        <button class="choice-card ${a.defaultStarter === 'me' ? 'choice-active' : ''}" data-starter-pick="me">
          <div class="choice-icon">A</div>
          <div class="choice-text">
            <div class="choice-title">Ich starte</div>
            <div class="choice-sub">Mein Verhalten löst die Interaktion aus</div>
          </div>
        </button>
        <button class="choice-card ${a.defaultStarter === 'ip' ? 'choice-active' : ''}" data-starter-pick="ip">
          <div class="choice-icon">B</div>
          <div class="choice-text">
            <div class="choice-title">IP startet</div>
            <div class="choice-sub">Das Verhalten der IP löst die Interaktion aus</div>
          </div>
        </button>
      </div>
    </div>
    ${bottomBarHTML([
      { id: 'btn-starter-back', label: 'Zurück', kind: 'secondary' },
      { id: 'btn-starter-next', label: 'Weiter', kind: 'primary' }
    ])}
  `;

  document.querySelectorAll('[data-starter-pick]').forEach(btn => {
    btn.addEventListener('click', () => {
      a.defaultStarter = btn.dataset.starterPick;
      Store.upsert(a);
      document.querySelectorAll('[data-starter-pick]').forEach(b => b.classList.remove('choice-active'));
      btn.classList.add('choice-active');
    });
  });

  const nextBtn = document.getElementById('btn-starter-next');
  function updateNextState() { nextBtn.disabled = !a.defaultStarter; }
  updateNextState();
  document.querySelectorAll('[data-starter-pick]').forEach(btn => btn.addEventListener('click', updateNextState));

  nextBtn.addEventListener('click', () => {
    if (!a.defaultStarter) return;
    if (a.rounds.length > 0) { State.step = HUB_STEP; render(); return; }
    const r = newRound(a.defaultStarter);
    a.rounds.push(r);
    Store.upsert(a);
    State.roundIdx  = a.rounds.length - 1;
    State.roundStep = 0;
    render();
  });
  document.getElementById('btn-starter-back').addEventListener('click', () => {
    State.step = SITUATION_STEPS - 1;
    render();
  });
}

// ─── Runden-Hub ──────────────────────────────────────────────────

export function finishEditing(a) {
  delete a._draft;
  Store.upsert(a);
  showToast('Analyse gespeichert');
  State.detailId  = a.id;
  State.view      = 'detail';
  State.current   = null;
  State.step      = 0;
  State.roundIdx  = -1;
  render();
}

export function renderRoundsHub() {
  const a      = State.current;
  const rounds = a.rounds;
  const def    = a.defaultStarter;
  const app    = document.getElementById('app');

  app.innerHTML = `
    ${headerHTML('Interaktionsanalyse', `${rounds.length} ${rounds.length === 1 ? 'Runde' : 'Runden'}`, true)}
    ${progressHTML(SITUATION_STEPS + 2, SITUATION_STEPS + 2)}
    <div class="content fade-in">
      <div class="step-eyebrow">Interaktion</div>
      <h2 class="step-question">${rounds.length === 0 ? 'Erste Runde anlegen' : 'Eine weitere Runde?'}</h2>
      <p class="step-hint">${rounds.length === 0
        ? 'Standardmäßig ' + (def === 'me' ? 'startest du.' : 'startet die IP.') + ' Du kannst pro Runde wechseln.'
        : 'Du kannst weitere Runden hinzufügen oder die Analyse beenden.'}</p>
      ${rounds.map((r, i) => roundSummaryHTML(r, i)).join('')}
      <div class="choice-stack" style="margin-top: ${rounds.length ? '20px' : '8px'};">
        <button class="choice-card ${def === 'me' ? 'choice-active' : ''}" data-starter="me">
          <div class="choice-icon">A</div>
          <div class="choice-text">
            <div class="choice-title">Ich starte diese Runde</div>
            <div class="choice-sub">Mein Verhalten zuerst${def === 'me' ? ' · Standard' : ''}</div>
          </div>
        </button>
        <button class="choice-card ${def === 'ip' ? 'choice-active' : ''}" data-starter="ip">
          <div class="choice-icon">B</div>
          <div class="choice-text">
            <div class="choice-title">IP startet diese Runde</div>
            <div class="choice-sub">IP-Verhalten zuerst${def === 'ip' ? ' · Standard' : ''}</div>
          </div>
        </button>
      </div>
    </div>
    ${bottomBarHTML([
      { id: 'btn-hub-situation', label: 'Situation', kind: 'secondary' },
      { id: 'btn-hub-history',   label: 'Verlauf',   kind: 'ghost' },
      { id: 'btn-hub-finish',    label: rounds.length === 0 ? 'Ohne Runden speichern' : 'Analyse beenden', kind: 'primary' }
    ])}
  `;

  document.querySelectorAll('[data-starter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = newRound(btn.dataset.starter);
      a.rounds.push(r);
      Store.upsert(a);
      State.roundIdx  = a.rounds.length - 1;
      State.roundStep = 0;
      render();
    });
  });
  document.querySelectorAll('[data-edit-round]').forEach(btn => {
    btn.addEventListener('click', () => {
      State.roundIdx  = parseInt(btn.dataset.editRound, 10);
      State.roundStep = 0;
      render();
    });
  });
  document.querySelectorAll('[data-delete-round]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.deleteRound, 10);
      if (!confirm(`Runde ${idx + 1} wirklich löschen?`)) return;
      a.rounds.splice(idx, 1);
      Store.upsert(a);
      render();
    });
  });
  document.getElementById('btn-hub-situation').addEventListener('click', () => { State.step = 0; render(); });
  document.getElementById('btn-hub-history').addEventListener('click', () => openHistorySheet(a));
  document.getElementById('btn-hub-finish').addEventListener('click', () => finishEditing(a));
}

export function roundSummaryHTML(r, i) {
  const starterLabel = r.starter === 'me' ? 'Ich startete' : 'IP startete';
  const myRaw = r.myBehaviorVerbal || r.myBehavior || '';
  const ipRaw = r.ipBehaviorVerbal || r.ipBehavior || '';
  const my = myRaw ? myRaw.slice(0, 80) : '–';
  const ip = ipRaw ? ipRaw.slice(0, 80) : '–';
  return `
    <div class="round-summary">
      <div class="round-summary-head">
        <div class="round-summary-title">Runde ${i + 1}</div>
        <div class="round-summary-badge">${starterLabel}</div>
      </div>
      <div class="round-summary-row"><strong>Mein Verhalten</strong>${escapeHtml(my)}</div>
      <div class="round-summary-row"><strong>IP-Verhalten</strong>${escapeHtml(ip)}</div>
      <div class="round-summary-row"><strong>Spannung</strong>${r.tension}</div>
      <button class="round-edit-btn" data-edit-round="${i}">Bearbeiten</button>
      <button class="round-edit-btn round-delete-btn" data-delete-round="${i}">Löschen</button>
    </div>
  `;
}

// ─── Runden-Sequenz ──────────────────────────────────────────────

export function getRoundSequence(starter) {
  if (starter === 'ip') {
    return ['ipBehavior', 'interpretation', 'thoughts', 'tension', 'need', 'myBehavior', 'desiredEffect', 'done'];
  }
  return ['interpretation', 'thoughts', 'tension', 'need', 'myBehavior', 'desiredEffect', 'ipNext', 'done'];
}

export function totalRoundSteps(r) {
  return getRoundSequence(r.starter).length;
}

export function renderRoundStep() {
  const a   = State.current;
  const r   = a.rounds[State.roundIdx];
  migrateRound(r);
  const seq   = getRoundSequence(r.starter);
  const total = seq.length;
  const cur   = State.roundStep;
  const key   = seq[cur];
  const app   = document.getElementById('app');

  if (key === 'done') return renderRoundDone();

  let body = '';

  if (key === 'ipBehavior') {
    body = `
      <div class="step-eyebrow">Runde ${State.roundIdx + 1} · IP-Verhalten</div>
      <h2 class="step-question">Was tut die andere Person?</h2>
      <p class="step-hint">Was wurde gesagt, was wurde körperlich gezeigt?</p>
      <label class="field-label">Verbal</label>
      ${richEditorHTML('f-verbal', r.ipBehaviorVerbal || r.ipBehavior || '', 'Was wurde gesagt …')}
      <label class="field-label mt">Nonverbal</label>
      ${richEditorHTML('f-nonverbal', r.ipBehaviorNonverbal || '', 'Gestik, Mimik, Körpersprache …')}
    `;
  } else if (key === 'ipNext') {
    body = `
      <div class="step-eyebrow">Runde ${State.roundIdx + 1} · IP-Verhalten</div>
      <h2 class="step-question">Wie hat die IP reagiert?</h2>
      <p class="step-hint">Was wurde gesagt, was wurde körperlich gezeigt?</p>
      <label class="field-label">Verbal</label>
      ${richEditorHTML('f-verbal', r.ipBehaviorVerbal || r.ipBehavior || '', 'Was wurde gesagt …')}
      <label class="field-label mt">Nonverbal</label>
      ${richEditorHTML('f-nonverbal', r.ipBehaviorNonverbal || '', 'Gestik, Mimik, Körpersprache …')}
    `;
  } else if (key === 'interpretation') {
    const isOptional = r.starter === 'me' && State.roundIdx === 0;
    const optLabel   = isOptional
      ? ` <span style="text-transform: none; letter-spacing: 0; color: var(--ink-muted); font-weight: 400;">· optional</span>`
      : '';
    body = `
      <div class="step-eyebrow">Runde ${State.roundIdx + 1} · a) Interpretation${optLabel}</div>
      <h2 class="step-question">Wie deutest du das<br>Verhalten der IP?</h2>
      <p class="step-hint">${isOptional ? 'Du kannst dieses Feld leer lassen.' : 'Was nimmst du an, was es bedeutet?'}</p>
      ${richEditorHTML('f-val', r.interpretation, 'Meine Interpretation …')}
    `;
  } else if (key === 'thoughts') {
    body = renderThoughtsEditor(r);
  } else if (key === 'tension') {
    body = `
      <div class="step-eyebrow">Runde ${State.roundIdx + 1} · d) Spannung</div>
      <h2 class="step-question">Wie hoch war deine<br>innere Spannung?</h2>
      <p class="step-hint">In diesem Moment.</p>
      ${sliderHTML('f-val', r.tension, ['Entspannt', 'Mittel', 'Sehr hoch'])}
    `;
  } else if (key === 'need') {
    body = `
      <div class="step-eyebrow">Runde ${State.roundIdx + 1} · e) Bedürfnis</div>
      <h2 class="step-question">Was war dein Bedürfnis?</h2>
      <p class="step-hint">Was hättest du gebraucht?</p>
      ${richEditorHTML('f-val', r.need, 'Mein Bedürfnis …')}
    `;
  } else if (key === 'myBehavior') {
    body = `
      <div class="step-eyebrow">Runde ${State.roundIdx + 1} · f) Mein Verhalten</div>
      <h2 class="step-question">Was hast du getan,<br>was hast du gesagt?</h2>
      <p class="step-hint">Was habe ich gesagt, was habe ich körperlich gezeigt?</p>
      <label class="field-label">Verbal</label>
      ${richEditorHTML('f-verbal', r.myBehaviorVerbal || r.myBehavior || '', 'Was ich gesagt habe …')}
      <label class="field-label mt">Nonverbal</label>
      ${richEditorHTML('f-nonverbal', r.myBehaviorNonverbal || '', 'Gestik, Mimik, Körpersprache …')}
    `;
  } else if (key === 'desiredEffect') {
    body = `
      <div class="step-eyebrow">Runde ${State.roundIdx + 1} · g) Wirkung</div>
      <h2 class="step-question">Welche Wirkung wolltest<br>du bei der IP erzielen?</h2>
      <p class="step-hint">Auch unbewusste Absichten zählen.</p>
      ${richEditorHTML('f-val', r.desiredEffect, 'Gewünschte Wirkung …')}
    `;
  }

  app.innerHTML = `
    ${headerHTML(`Runde ${State.roundIdx + 1}`, `${cur + 1} / ${total - 1}`, true)}
    ${progressHTML(cur + 1, total)}
    <div class="content fade-in">${body}</div>
    ${bottomBarHTML([
      { id: 'btn-r-back',   label: 'Zurück',   kind: 'secondary' },
      { id: 'btn-r-finish', label: 'Beenden',  kind: 'ghost' },
      { id: 'btn-r-next',   label: 'Weiter',   kind: 'primary' }
    ])}
  `;

  if (key === 'tension') wireSlider('f-val');
  if (key === 'thoughts') wireThoughtsEditor(r);
  if (key !== 'tension' && key !== 'thoughts') {
    const first = app.querySelector('.content [contenteditable]');
    if (first) first.focus();
  }

  document.getElementById('btn-r-next').addEventListener('click', () => {
    saveRoundField(r, key);
    Store.upsert(a);
    State.roundStep++;
    render();
  });
  document.getElementById('btn-r-finish').addEventListener('click', () => {
    saveRoundField(r, key);
    finishEditing(a);
  });
  document.getElementById('btn-r-back').addEventListener('click', () => {
    saveRoundField(r, key);
    Store.upsert(a);
    if (cur === 0) { State.roundIdx = -1; State.step = HUB_STEP; }
    else State.roundStep--;
    render();
  });
}

export function saveRoundField(r, key) {
  if (key === 'thoughts') { collectThoughtsFromDom(r); return; }
  if (key === 'ipBehavior' || key === 'ipNext') {
    r.ipBehaviorVerbal    = getRichValue('f-verbal');
    r.ipBehaviorNonverbal = getRichValue('f-nonverbal');
    r.ipBehavior = [r.ipBehaviorVerbal, r.ipBehaviorNonverbal].filter(Boolean).map(richHtmlToText).join(' / ');
    return;
  }
  if (key === 'myBehavior') {
    r.myBehaviorVerbal    = getRichValue('f-verbal');
    r.myBehaviorNonverbal = getRichValue('f-nonverbal');
    r.myBehavior = [r.myBehaviorVerbal, r.myBehaviorNonverbal].filter(Boolean).map(richHtmlToText).join(' / ');
    return;
  }
  const el = document.getElementById('f-val');
  if (!el) return;
  if (key === 'tension')        r.tension       = Math.max(0, Math.min(100, parseInt(el.value, 10) || 50));
  else if (key === 'interpretation') r.interpretation = getRichValue('f-val');
  else if (key === 'need')      r.need          = getRichValue('f-val');
  else if (key === 'desiredEffect')  r.desiredEffect  = getRichValue('f-val');
}

// ─── Gedanken-Gefühl-Editor ──────────────────────────────────────

export function renderThoughtsEditor(r) {
  const items           = r.thoughts && r.thoughts.length ? r.thoughts : [];
  const standaloneCustom = (r.standaloneFeelings || []).filter(f => !FEELINGS.includes(f));
  return `
    <div class="step-eyebrow">Runde ${State.roundIdx + 1} · b/c) Gedanken &amp; Gefühle</div>
    <h2 class="step-question">Welche Gedanken<br>kommen — mit welchen Gefühlen?</h2>
    <p class="step-hint">Du kannst mehrere Gedanken erfassen. Pro Gedanke wählst du die zugehörigen Gefühle.</p>
    <div id="thoughts-list" class="stack" style="gap: 14px; margin-bottom: 18px;">
      ${items.map((t, i) => thoughtCardHTML(t, i)).join('')}
    </div>
    <button class="choice-card" id="add-thought" style="justify-content: center; padding: 16px 20px;">
      <div class="choice-icon">+</div>
      <div class="choice-text">
        <div class="choice-title" style="font-size: 16px;">Gedanke hinzufügen</div>
        <div class="choice-sub">Mit eigenen Gefühlen verknüpfen</div>
      </div>
    </button>
    <div class="thought-card" id="standalone-feels-section" style="margin-top: 18px;">
      <div class="thought-feel-label" style="margin-bottom: 10px;">Gefühle ohne Gedanken</div>
      <p class="step-hint" style="margin: 0 0 10px;">Gefühle, die keinem bestimmten Gedanken zuzuordnen sind.</p>
      <div class="chips chips-compact" id="standalone-feel-chips">
        ${FEELINGS.map(f => `
          <button class="chip ${(r.standaloneFeelings||[]).includes(f) ? 'active' : ''}" data-standalone-feel="${escapeAttr(f)}">${escapeHtml(f)}</button>
        `).join('')}
      </div>
      <div class="tag-input-wrap" id="standalone-tags">
        ${standaloneCustom.map(f => tagChipHTML(f, null)).join('')}
        <input type="text" class="tag-input-field" id="standalone-tag-input" placeholder="Eigenes Gefühl + Enter">
      </div>
    </div>
  `;
}

export function thoughtCardHTML(t, i) {
  const tid           = escapeAttr(t.id);
  const customFeelings = (t.feelings || []).filter(f => !FEELINGS.includes(f));
  return `
    <div class="thought-card" data-thought-id="${tid}" data-thought-idx="${i}">
      <div class="thought-card-head">
        <span class="thought-card-num">Gedanke ${i + 1}</span>
        <button class="thought-remove" data-remove-thought="${tid}" aria-label="Entfernen">×</button>
      </div>
      <div class="rich-editor" style="margin-bottom: 4px;">
        <div class="rich-toolbar" role="toolbar" aria-label="Formatierung">
          <button type="button" class="rich-btn" data-cmd="bold" title="Fett" aria-label="Fett"><b>F</b></button>
          <button type="button" class="rich-btn" data-cmd="italic" title="Kursiv" aria-label="Kursiv"><i>K</i></button>
          <button type="button" class="rich-btn" data-cmd="underline" title="Unterstreichen" aria-label="Unterstreichen"><u>U</u></button>
          <button type="button" class="rich-btn" data-cmd="insertUnorderedList" title="Aufzählung" aria-label="Aufzählung">•≡</button>
        </div>
        <div class="rich-content thought-rich" data-t-id="${tid}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Gedanke ${i + 1}" data-placeholder="Der Satz, der innerlich klingt …">${valueToEditorHTML(t.text)}</div>
      </div>
      <div class="thought-feel-label">Verknüpfte Gefühle</div>
      <div class="chips chips-compact" data-t-chips="${tid}">
        ${FEELINGS.map(f => {
          const active = (t.feelings||[]).includes(f);
          return `<button class="chip ${active ? 'active' : ''}" data-feel-thought="${tid}" data-feel="${escapeAttr(f)}" aria-pressed="${active}">${escapeHtml(f)}</button>`;
        }).join('')}
      </div>
      <div class="tag-input-wrap" id="tags-${tid}">
        ${customFeelings.map(f => tagChipHTML(f, tid)).join('')}
        <input type="text" class="tag-input-field" data-t-tag-id="${tid}" placeholder="Eigenes Gefühl + Enter">
      </div>
    </div>
  `;
}

export function tagChipHTML(f, scope) {
  const fa = escapeAttr(f);
  const ds = scope
    ? `data-tag-feel-thought="${escapeAttr(scope)}" data-tag-feel="${fa}"`
    : `data-standalone-tag="${fa}"`;
  return `<span class="tag-chip" ${ds}>
    <span class="tag-chip-name">${escapeHtml(f)}</span>
    <button type="button" class="tag-edit"  aria-label="Umbenennen">✎</button>
    <button type="button" class="tag-remove" aria-label="Löschen">🗑</button>
  </span>`;
}

export function createTagChip(label, scope) {
  const wrap = document.createElement('span');
  wrap.className = 'tag-chip';
  if (scope) { wrap.dataset.tagFeelThought = scope; wrap.dataset.tagFeel = label; }
  else        { wrap.dataset.standaloneTag = label; }
  wrap.innerHTML = `<span class="tag-chip-name">${escapeHtml(label)}</span>
    <button type="button" class="tag-edit"  aria-label="Umbenennen">✎</button>
    <button type="button" class="tag-remove" aria-label="Löschen">🗑</button>`;
  wireTagChipButtons(wrap);
  return wrap;
}

export function wireTagChipButtons(chip) {
  chip.querySelector('.tag-remove').addEventListener('click', () => {
    const f = chip.dataset.tagFeel || chip.dataset.standaloneTag;
    CustomFeelings.remove(f);
    chip.remove();
  });
  chip.querySelector('.tag-edit').addEventListener('click', () => {
    const nameEl  = chip.querySelector('.tag-chip-name');
    const oldName = nameEl.textContent;
    const input   = document.createElement('input');
    input.value   = oldName;
    input.style.cssText = 'background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.6);color:inherit;font:inherit;font-size:14px;outline:none;width:80px;';
    nameEl.replaceWith(input);
    input.focus(); input.select();
    const commit = () => {
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        CustomFeelings.rename(oldName, newName);
        if (chip.dataset.tagFeel)       chip.dataset.tagFeel       = newName;
        if (chip.dataset.standaloneTag) chip.dataset.standaloneTag = newName;
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

export function wireThoughtsEditor(r) {
  if (!r.thoughts || r.thoughts.length === 0) {
    r.thoughts = [newThought()];
    rerenderThoughtsList(r);
  } else {
    attachThoughtListHandlers(r);
  }
  const addBtn = document.getElementById('add-thought');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      collectThoughtsFromDom(r);
      r.thoughts.push(newThought());
      rerenderThoughtsList(r);
    });
  }
  wireTagInputs(r);
  wireStandaloneFeelings(r);
}

export function wireTagInputs(r) {
  document.querySelectorAll('.tag-input-field[data-t-tag-id]').forEach(input => {
    const tid  = input.dataset.tTagId;
    const wrap = input.closest('.tag-input-wrap');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const label = input.value.trim();
        if (!label) return;
        CustomFeelings.add(label);
        const chip = createTagChip(label, tid);
        wrap.insertBefore(chip, input);
        input.value = '';
      } else if (e.key === 'Backspace' && input.value === '') {
        const chips = wrap.querySelectorAll('.tag-chip');
        if (chips.length) chips[chips.length - 1].remove();
      }
    });
  });
}

export function wireStandaloneFeelings(r) {
  document.querySelectorAll('[data-standalone-feel]').forEach(c => {
    c.addEventListener('click', () => c.classList.toggle('active'));
  });
  const standaloneInput = document.getElementById('standalone-tag-input');
  const standaloneWrap  = document.getElementById('standalone-tags');
  if (standaloneInput && standaloneWrap) {
    standaloneInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const label = standaloneInput.value.trim();
        if (!label) return;
        CustomFeelings.add(label);
        const chip = createTagChip(label, null);
        standaloneWrap.insertBefore(chip, standaloneInput);
        standaloneInput.value = '';
      } else if (e.key === 'Backspace' && standaloneInput.value === '') {
        const chips = standaloneWrap.querySelectorAll('.tag-chip');
        if (chips.length) chips[chips.length - 1].remove();
      }
    });
  }
  document.querySelectorAll('#standalone-tags .tag-chip, #standalone-feels-section .tag-chip').forEach(wireTagChipButtons);
}

export function attachThoughtListHandlers(r) {
  document.querySelectorAll('[data-feel-thought]').forEach(c => {
    c.addEventListener('click', () => c.classList.toggle('active'));
  });
  document.querySelectorAll('[data-remove-thought]').forEach(b => {
    b.addEventListener('click', () => {
      const tid = b.dataset.removeThought;
      collectThoughtsFromDom(r);
      r.thoughts = r.thoughts.filter(t => t.id !== tid);
      if (r.thoughts.length === 0) r.thoughts.push(newThought());
      rerenderThoughtsList(r);
    });
  });
  document.querySelectorAll('#thoughts-list .tag-chip').forEach(wireTagChipButtons);
  wireTagInputs(r);
}

export function rerenderThoughtsList(r) {
  const list = document.getElementById('thoughts-list');
  if (!list) return;
  list.innerHTML = r.thoughts.map((t, i) => thoughtCardHTML(t, i)).join('');
  attachThoughtListHandlers(r);
}

export function collectThoughtsFromDom(r) {
  const list = document.getElementById('thoughts-list');
  if (!list) return;
  const cards = list.querySelectorAll('[data-thought-id]');
  const next  = [];
  cards.forEach(card => {
    const tid     = card.dataset.thoughtId;
    const textEl  = card.querySelector(`[data-t-id="${tid}"]`);
    const feelEls = card.querySelectorAll(`[data-feel-thought="${tid}"].active`);
    const predefined = Array.from(feelEls).map(c => c.dataset.feel);
    const customChips = card.querySelectorAll(`[data-tag-feel-thought="${tid}"]`);
    const custom  = Array.from(customChips).map(c => c.dataset.tagFeel).filter(Boolean);
    const rawText = textEl
      ? (textEl.tagName === 'TEXTAREA' ? textEl.value.trim() : sanitizeRichText(textEl.innerHTML.trim()))
      : '';
    next.push({
      id: tid || ('t_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      text: rawText === '<br>' ? '' : rawText,
      feelings: [...predefined, ...custom]
    });
  });
  r.thoughts = next;

  const predefined  = Array.from(document.querySelectorAll('[data-standalone-feel].active')).map(c => c.dataset.standaloneFeel);
  const customChips = document.querySelectorAll('#standalone-tags .tag-chip[data-standalone-tag]');
  const custom      = Array.from(customChips).map(c => c.dataset.standaloneTag).filter(Boolean);
  r.standaloneFeelings = [...predefined, ...custom];
}

export function renderRoundDone() {
  const a     = State.current;
  const r     = a.rounds[State.roundIdx];
  const total = totalRoundSteps(r);
  const app   = document.getElementById('app');

  app.innerHTML = `
    ${headerHTML(`Runde ${State.roundIdx + 1}`, 'Abschluss', true)}
    ${progressHTML(total, total)}
    <div class="content fade-in">
      <div class="step-eyebrow">Runde abgeschlossen</div>
      <h2 class="step-question">Nächste Runde?</h2>
      <p class="step-hint">Die Interaktion läuft weiter – oder beende die Analyse hier.</p>
    </div>
    ${bottomBarHTML([
      { id: 'btn-rd-back',   label: 'Zurück',          kind: 'secondary' },
      { id: 'btn-rd-finish', label: 'Analyse beenden', kind: 'secondary' },
      { id: 'btn-rd-new',    label: 'Nächste Runde',   kind: 'primary' }
    ])}
  `;
  document.getElementById('btn-rd-back').addEventListener('click', () => { State.roundStep--; render(); });
  document.getElementById('btn-rd-finish').addEventListener('click', () => finishEditing(a));
  document.getElementById('btn-rd-new').addEventListener('click', () => {
    const nextIdx = State.roundIdx + 1;
    if (nextIdx >= a.rounds.length) {
      const next = newRound(a.defaultStarter);
      a.rounds.push(next);
      Store.upsert(a);
    }
    State.roundIdx  = nextIdx;
    State.roundStep = 0;
    render();
  });
}
