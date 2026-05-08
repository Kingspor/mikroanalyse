import { State } from '../state.js';
import { Store } from '../store.js';
import { FEELINGS, CustomFeelings, People, Places } from '../store.js';
import { newRound, newThought, migrateRound, asNameList } from '../model.js';
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

// ─── Namenslisten (Personen/Orte) ────────────────────────────────

export function nameListEditorHTML(scope, predefined, selected, placeholder) {
  const sel    = new Set(selected);
  const known  = new Set(predefined);
  const custom = selected.filter(x => !known.has(x));
  return `
    <div class="chips chips-compact" data-namelist-scope="${escapeAttr(scope)}">
      ${predefined.map(name => {
        const active = sel.has(name);
        return `<button type="button" class="chip ${active ? 'active' : ''}" data-namelist-pick="${escapeAttr(name)}" aria-pressed="${active}">${escapeHtml(name)}</button>`;
      }).join('')}
    </div>
    <div class="tag-input-wrap" data-namelist-tags="${escapeAttr(scope)}">
      ${custom.map(name => nameListCustomChipHTML(scope, name)).join('')}
      <input type="text" class="tag-input-field" data-namelist-input="${escapeAttr(scope)}" placeholder="${escapeAttr(placeholder)}">
    </div>
  `;
}

function nameListCustomChipHTML(scope, name) {
  return `<span class="tag-chip" data-namelist-custom="${escapeAttr(scope)}" data-namelist-name="${escapeAttr(name)}">
    <span class="tag-chip-name">${escapeHtml(name)}</span>
    <button type="button" class="tag-remove" aria-label="Löschen">🗑</button>
  </span>`;
}

export function readNameList(scope) {
  const fromChips = Array.from(document.querySelectorAll(`[data-namelist-scope="${scope}"] .chip.active`))
    .map(c => c.dataset.namelistPick);
  const fromCustom = Array.from(document.querySelectorAll(`[data-namelist-tags="${scope}"] .tag-chip[data-namelist-custom="${scope}"]`))
    .map(c => c.dataset.namelistName);
  return [...fromChips, ...fromCustom];
}

export function wireNameListEditor(scope, store) {
  document.querySelectorAll(`[data-namelist-scope="${scope}"] [data-namelist-pick]`).forEach(c => {
    c.addEventListener('click', () => {
      const next = !c.classList.contains('active');
      c.classList.toggle('active', next);
      c.setAttribute('aria-pressed', next ? 'true' : 'false');
    });
  });
  const wrap  = document.querySelector(`[data-namelist-tags="${scope}"]`);
  const input = document.querySelector(`[data-namelist-input="${scope}"]`);
  if (!wrap || !input) return;

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const label = input.value.trim();
      if (!label) return;
      input.value = '';
      const chipsContainer = document.querySelector(`[data-namelist-scope="${scope}"]`);
      const existing = chipsContainer.querySelector(`[data-namelist-pick="${CSS.escape(label)}"]`);
      if (existing) {
        existing.classList.add('active');
        existing.setAttribute('aria-pressed', 'true');
        return;
      }
      store.add(label);
      const newChip = document.createElement('button');
      newChip.type = 'button';
      newChip.className = 'chip active';
      newChip.dataset.namelistPick = label;
      newChip.setAttribute('aria-pressed', 'true');
      newChip.textContent = label;
      newChip.addEventListener('click', () => {
        const next = !newChip.classList.contains('active');
        newChip.classList.toggle('active', next);
        newChip.setAttribute('aria-pressed', next ? 'true' : 'false');
      });
      chipsContainer.appendChild(newChip);
    } else if (e.key === 'Backspace' && input.value === '') {
      const customChips = wrap.querySelectorAll('.tag-chip');
      if (customChips.length) customChips[customChips.length - 1].remove();
    }
  });

  wrap.querySelectorAll('.tag-chip[data-namelist-custom] .tag-remove').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.tag-chip').remove());
  });
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
    const whoSelected   = asNameList(s.contextWho);
    const whereSelected = asNameList(s.contextWhere);
    body = `
      <div class="step-eyebrow">Ausgangssituation</div>
      <h2 class="step-question">Was ist unmittelbar<br>vorher passiert?</h2>
      <p class="step-hint">Alle Felder sind optional.</p>
      <label class="field-label">Was ist passiert?</label>
      ${richEditorHTML('f-what', what, 'Beschreibung der Situation …')}
      <label class="field-label mt">Wer war beteiligt?</label>
      ${nameListEditorHTML('who', People.get(), whoSelected, 'Person/Rolle + Enter')}
      <label class="field-label mt">Wo war das?</label>
      ${nameListEditorHTML('where', Places.get(), whereSelected, 'Ort/Kontext + Enter')}
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

  if (sitIdx === 3) {
    wireNameListEditor('who',   People);
    wireNameListEditor('where', Places);
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
      s.contextWho   = readNameList('who');
      s.contextWhere = readNameList('where');
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
  const effectiveStarter = (rounds[0] && rounds[0].starter) || a.defaultStarter || 'me';
  const app    = document.getElementById('app');

  app.innerHTML = `
    ${headerHTML('Interaktionsanalyse', `${rounds.length} ${rounds.length === 1 ? 'Runde' : 'Runden'}`, true)}
    ${progressHTML(SITUATION_STEPS + 2, SITUATION_STEPS + 2)}
    <div class="content fade-in">
      <div class="step-eyebrow">Interaktion</div>
      <h2 class="step-question">${rounds.length === 0 ? 'Erste Runde anlegen' : 'Eine weitere Runde?'}</h2>
      <p class="step-hint">${rounds.length === 0
        ? (effectiveStarter === 'me' ? 'Du startest die Interaktion.' : 'Die IP startet die Interaktion.')
        : 'Du kannst weitere Runden hinzufügen oder die Analyse beenden.'}</p>
      ${rounds.map((r, i) => roundSummaryHTML(r, i)).join('')}
      <div class="choice-stack" style="margin-top: ${rounds.length ? '20px' : '8px'};">
        <button class="choice-card" data-add-round>
          <div class="choice-icon">+</div>
          <div class="choice-text">
            <div class="choice-title">Runde hinzufügen</div>
            <div class="choice-sub">${effectiveStarter === 'me' ? 'Mein Verhalten zuerst' : 'IP-Verhalten zuerst'}</div>
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

  const addBtn = document.querySelector('[data-add-round]');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const r = newRound(effectiveStarter);
      a.rounds.push(r);
      Store.upsert(a);
      State.roundIdx  = a.rounds.length - 1;
      State.roundStep = 0;
      render();
    });
  }
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
  const starterLabel = i === 0 ? (r.starter === 'me' ? 'Ich startete' : 'IP startete') : '';
  const myRaw = r.myBehaviorVerbal || r.myBehavior || '';
  const ipRaw = r.ipBehaviorVerbal || r.ipBehavior || '';
  const my = myRaw ? myRaw.slice(0, 80) : '–';
  const ip = ipRaw ? ipRaw.slice(0, 80) : '–';
  return `
    <div class="round-summary">
      <div class="round-summary-head">
        <div class="round-summary-title">Runde ${i + 1}</div>
        ${starterLabel ? `<div class="round-summary-badge">${starterLabel}</div>` : ''}
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
      <h2 class="step-question">Was hat die IP getan,<br>was hat sie gesagt?</h2>
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
    const meStarts = r.starter === 'me';
    body = `
      <div class="step-eyebrow">Runde ${State.roundIdx + 1} · a) Interpretation</div>
      <h2 class="step-question">${meStarts
        ? 'Wie hast du die<br>Situation interpretiert?'
        : 'Wie deutest du das<br>Verhalten der IP?'}</h2>
      <p class="step-hint">${meStarts
        ? 'Was hat dich zu deinem Verhalten veranlasst?'
        : 'Was nimmst du an, was es bedeutet?'}</p>
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

function customFeelingsForRound(r) {
  const set = new Set(CustomFeelings.get());
  (r.thoughts || []).forEach(t => (t.feelings || []).forEach(f => { if (!FEELINGS.includes(f)) set.add(f); }));
  (r.standaloneFeelings || []).forEach(f => { if (!FEELINGS.includes(f)) set.add(f); });
  return [...set];
}

export function managedFeelChipHTML(scope, name, active) {
  const fa = escapeAttr(name);
  const ds = scope === 'standalone'
    ? `data-standalone-feel="${fa}"`
    : `data-feel-thought="${escapeAttr(scope)}" data-feel="${fa}"`;
  return `<span class="chip chip-managed ${active ? 'active' : ''}" ${ds} role="button" tabindex="0" aria-pressed="${active}">
    <span class="chip-managed-name">${escapeHtml(name)}</span>
    <button type="button" class="chip-managed-action chip-managed-edit"   aria-label="Umbenennen">✎</button>
    <button type="button" class="chip-managed-action chip-managed-remove" aria-label="Löschen">🗑</button>
  </span>`;
}

export function renderThoughtsEditor(r) {
  const items   = r.thoughts && r.thoughts.length ? r.thoughts : [];
  const customs = customFeelingsForRound(r);
  return `
    <div class="step-eyebrow">Runde ${State.roundIdx + 1} · b/c) Gedanken &amp; Gefühle</div>
    <h2 class="step-question">Welche Gedanken<br>kommen — mit welchen Gefühlen?</h2>
    <p class="step-hint">Du kannst mehrere Gedanken erfassen. Pro Gedanke wählst du die zugehörigen Gefühle.</p>
    <div id="thoughts-list" class="stack" style="gap: 14px; margin-bottom: 18px;">
      ${items.map((t, i) => thoughtCardHTML(t, i, customs)).join('')}
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
        ${customs.map(f => managedFeelChipHTML('standalone', f, (r.standaloneFeelings||[]).includes(f))).join('')}
      </div>
      <div class="tag-input-wrap" id="standalone-tags">
        <input type="text" class="tag-input-field" id="standalone-tag-input" placeholder="Eigenes Gefühl + Enter">
      </div>
    </div>
  `;
}

export function thoughtCardHTML(t, i, customsList) {
  const tid     = escapeAttr(t.id);
  const customs = customsList || (() => {
    const s = new Set(CustomFeelings.get());
    (t.feelings || []).forEach(f => { if (!FEELINGS.includes(f)) s.add(f); });
    return [...s];
  })();
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
        ${customs.map(f => managedFeelChipHTML(t.id, f, (t.feelings||[]).includes(f))).join('')}
      </div>
      <div class="tag-input-wrap" id="tags-${tid}">
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

function appendManagedChipToRow(chipRow, scope, label) {
  const tmp = document.createElement('div');
  tmp.innerHTML = managedFeelChipHTML(scope, label, true);
  const chip = tmp.firstElementChild;
  chipRow.appendChild(chip);
  chip.addEventListener('click', e => {
    if (e.target.closest('.chip-managed-action')) return;
    chip.classList.toggle('active');
  });
  return chip;
}

export function wireTagInputs(r) {
  document.querySelectorAll('.tag-input-field[data-t-tag-id]').forEach(input => {
    const tid  = input.dataset.tTagId;
    const card = input.closest('.thought-card');
    const chipRow = card && card.querySelector(`[data-t-chips="${tid}"]`);
    if (!chipRow) return;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const label = input.value.trim();
        if (!label) return;
        input.value = '';
        const existing = chipRow.querySelector(`[data-feel="${CSS.escape(label)}"]`);
        if (existing) {
          existing.classList.add('active');
          existing.setAttribute('aria-pressed', 'true');
          return;
        }
        CustomFeelings.add(label);
        const chip = appendManagedChipToRow(chipRow, tid, label);
        wireManagedFeelChipActions(chip, r);
      }
    });
  });
}

export function wireStandaloneFeelings(r) {
  document.querySelectorAll('[data-standalone-feel]').forEach(c => {
    c.addEventListener('click', e => {
      if (e.target.closest('.chip-managed-action')) return;
      c.classList.toggle('active');
    });
  });
  const standaloneInput = document.getElementById('standalone-tag-input');
  const chipRow         = document.getElementById('standalone-feel-chips');
  if (standaloneInput && chipRow) {
    standaloneInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const label = standaloneInput.value.trim();
        if (!label) return;
        standaloneInput.value = '';
        const existing = chipRow.querySelector(`[data-standalone-feel="${CSS.escape(label)}"]`);
        if (existing) {
          existing.classList.add('active');
          existing.setAttribute('aria-pressed', 'true');
          return;
        }
        CustomFeelings.add(label);
        const chip = appendManagedChipToRow(chipRow, 'standalone', label);
        wireManagedFeelChipActions(chip, r);
      }
    });
  }
  document.querySelectorAll('#standalone-feel-chips .chip-managed').forEach(chip => wireManagedFeelChipActions(chip, r));
}

export function wireManagedFeelChipActions(chip, r) {
  const editBtn   = chip.querySelector('.chip-managed-edit');
  const removeBtn = chip.querySelector('.chip-managed-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      const name = chip.dataset.feel || chip.dataset.standaloneFeel;
      if (!name) return;
      collectThoughtsFromDom(r);
      CustomFeelings.remove(name);
      r.thoughts.forEach(t => { t.feelings = (t.feelings || []).filter(f => f !== name); });
      r.standaloneFeelings = (r.standaloneFeelings || []).filter(f => f !== name);
      document.querySelectorAll(`.chip-managed[data-feel="${CSS.escape(name)}"], .chip-managed[data-standalone-feel="${CSS.escape(name)}"]`).forEach(el => el.remove());
    });
  }
  if (editBtn) {
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      startManagedRename(chip, r);
    });
  }
}

function startManagedRename(chip, r) {
  const nameEl  = chip.querySelector('.chip-managed-name');
  if (!nameEl) return;
  const oldName = nameEl.textContent;
  const input   = document.createElement('input');
  input.className = 'chip-managed-rename';
  input.value     = oldName;
  nameEl.replaceWith(input);
  input.focus(); input.select();

  let done = false;
  const finish = (apply) => {
    if (done) return;
    done = true;
    const newName = (input.value || '').trim();
    const span = document.createElement('span');
    span.className = 'chip-managed-name';
    if (apply && newName && newName !== oldName) {
      collectThoughtsFromDom(r);
      CustomFeelings.rename(oldName, newName);
      r.thoughts.forEach(t => {
        const i = (t.feelings || []).indexOf(oldName);
        if (i !== -1) t.feelings[i] = newName;
      });
      const si = (r.standaloneFeelings || []).indexOf(oldName);
      if (si !== -1) r.standaloneFeelings[si] = newName;
      document.querySelectorAll(`.chip-managed[data-feel="${CSS.escape(oldName)}"], .chip-managed[data-standalone-feel="${CSS.escape(oldName)}"]`).forEach(el => {
        if (el.dataset.feel)            el.dataset.feel            = newName;
        if (el.dataset.standaloneFeel)  el.dataset.standaloneFeel  = newName;
        const n = el.querySelector('.chip-managed-name');
        if (n) n.textContent = newName;
      });
      span.textContent = newName;
    } else {
      span.textContent = oldName;
    }
    if (input.parentNode) input.replaceWith(span);
  };
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter')  { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', e => e.stopPropagation());
}

export function attachThoughtListHandlers(r) {
  document.querySelectorAll('[data-feel-thought]').forEach(c => {
    c.addEventListener('click', e => {
      if (e.target.closest('.chip-managed-action')) return;
      c.classList.toggle('active');
    });
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
  document.querySelectorAll('#thoughts-list .chip-managed').forEach(chip => wireManagedFeelChipActions(chip, r));
  wireTagInputs(r);
}

export function rerenderThoughtsList(r) {
  const list = document.getElementById('thoughts-list');
  if (!list) return;
  const customs = customFeelingsForRound(r);
  list.innerHTML = r.thoughts.map((t, i) => thoughtCardHTML(t, i, customs)).join('');
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
    const feelings = Array.from(feelEls).map(c => c.dataset.feel).filter(Boolean);
    const rawText = textEl
      ? (textEl.tagName === 'TEXTAREA' ? textEl.value.trim() : sanitizeRichText(textEl.innerHTML.trim()))
      : '';
    next.push({
      id: tid || ('t_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      text: rawText === '<br>' ? '' : rawText,
      feelings
    });
  });
  r.thoughts = next;

  r.standaloneFeelings = Array.from(document.querySelectorAll('[data-standalone-feel].active')).map(c => c.dataset.standaloneFeel).filter(Boolean);
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
