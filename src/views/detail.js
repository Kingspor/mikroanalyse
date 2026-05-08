import { State } from '../state.js';
import { Store } from '../store.js';
import { Snapshots } from '../snapshots.js';
import { migrateRound, asNameList } from '../model.js';
import { renderRichField, isRichEmpty } from '../richtext.js';
import { headerHTML, bottomBarHTML } from '../ui.js';
import { escapeHtml, formatDateTime } from '../utils.js';
import { goHome } from '../navigation.js';
import { render } from '../renderer.js';
import { HUB_STEP } from './wizard.js';
import { openShareSheet } from './sheets.js';

export function renderDetail() {
  const a = Store.get(State.detailId);
  if (!a) return goHome();

  const needsMigration = a.rounds.some(r => !Array.isArray(r.thoughts));
  a.rounds.forEach(migrateRound);
  if (needsMigration) Store.upsert(a);

  const app = document.getElementById('app');
  app.innerHTML = `
    ${headerHTML(a.situation.title || formatDateTime(a.situation.datetime), '', true)}
    <div class="content fade-in">
      <div class="detail-section">
        <h3>Ausgangssituation</h3>
        ${a.situation.title ? `
        <div class="detail-row">
          <div class="detail-row-label">Titel</div>
          <div class="detail-row-value">${escapeHtml(a.situation.title)}</div>
        </div>` : ''}
        <div class="detail-row">
          <div class="detail-row-label">Stimmung / Stresslevel</div>
          <div class="detail-row-value">${a.situation.mood} / 100</div>
        </div>
        <div class="detail-row">
          <div class="detail-row-label">Bedürfnis zu Beginn</div>
          <div class="detail-row-value ${!isRichEmpty(a.situation.need) ? '' : 'muted'}">${renderRichField(a.situation.need) || 'Nicht angegeben'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-row-label">Was vorher passiert ist</div>
          <div class="detail-row-value ${!isRichEmpty(a.situation.contextWhat || a.situation.context) ? '' : 'muted'}">${renderRichField(a.situation.contextWhat || a.situation.context) || 'Nicht angegeben'}</div>
        </div>
        ${asNameList(a.situation.contextWho).length ? `
        <div class="detail-row">
          <div class="detail-row-label">Wer war beteiligt?</div>
          <div class="detail-row-value">${escapeHtml(asNameList(a.situation.contextWho).join(' · '))}</div>
        </div>` : ''}
        ${asNameList(a.situation.contextWhere).length ? `
        <div class="detail-row">
          <div class="detail-row-label">Wo war das?</div>
          <div class="detail-row-value">${escapeHtml(asNameList(a.situation.contextWhere).join(' · '))}</div>
        </div>` : ''}
      </div>

      ${a.rounds.length ? `<div class="detail-divider"></div>` : ''}

      ${a.rounds.length >= 1 ? `
        <div class="detail-section">
          <h3>Verlauf</h3>
          ${tensionPerRoundSVG(a.rounds, a.situation.mood)}
        </div>
        <div class="detail-divider"></div>
      ` : ''}

      ${a.rounds.map((r, i) => `
        <div class="detail-section">
          <h3>Runde ${i + 1}${i === 0 ? ` <span class="text-muted-sm">· ${r.starter === 'me' ? 'Ich startete' : 'IP startete'}</span>` : ''}</h3>
          ${r.starter === 'me' ? renderRoundDetailMe(r) : renderRoundDetailIp(r)}
        </div>
        ${i < a.rounds.length - 1 ? '<div class="detail-divider"></div>' : ''}
      `).join('')}
    </div>
    ${bottomBarHTML(a._draft ? [
      { id: 'btn-detail-edit',  label: 'Weiter bearbeiten', kind: 'primary' },
      { id: 'btn-detail-share', label: 'Optionen',          kind: 'secondary' }
    ] : [
      { id: 'btn-detail-edit',  label: 'Bearbeiten', kind: 'secondary' },
      { id: 'btn-detail-share', label: 'Optionen',   kind: 'primary' }
    ])}
  `;

  document.getElementById('btn-detail-edit').addEventListener('click', () => {
    Snapshots.push(a, true);
    const copy = JSON.parse(JSON.stringify(a));
    if (!copy.defaultStarter) {
      copy.defaultStarter = (copy.rounds && copy.rounds[0] && copy.rounds[0].starter) || 'me';
    }
    const draft = copy._draft;
    delete copy._draft;
    Store.upsert(copy);
    State.current = copy;
    State.view    = 'wizard';
    if (draft) {
      State.step      = draft.step;
      State.roundIdx  = draft.roundIdx;
      State.roundStep = draft.roundStep;
    } else {
      State.step      = copy.rounds.length > 0 ? HUB_STEP : 0;
      State.roundIdx  = -1;
      State.roundStep = 0;
    }
    render();
  });
  document.getElementById('btn-detail-share').addEventListener('click', () => openShareSheet(a));
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

function tensionPerRoundSVG(rounds, situationMood) {
  const W = 320, H = 150, padL = 28, padR = 12, padT = 14, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xAt = i => padL + (rounds.length === 1 ? innerW / 2 : (innerW * i) / (rounds.length - 1));
  const yAt = v => padT + innerH - (innerH * Math.max(0, Math.min(100, v)) / 100);

  const ticks = [0, 25, 50, 75, 100].map(v =>
    `<line x1="${padL}" y1="${yAt(v).toFixed(1)}" x2="${W - padR}" y2="${yAt(v).toFixed(1)}" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
     <text x="${padL - 4}" y="${(yAt(v) + 3).toFixed(1)}" font-size="9" fill="#857a6b" text-anchor="end">${v}</text>`
  ).join('');

  const moodRef = (typeof situationMood === 'number') ? `
    <line x1="${padL}" y1="${yAt(situationMood).toFixed(1)}" x2="${W - padR}" y2="${yAt(situationMood).toFixed(1)}" stroke="#c9a55d" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="${W - padR}" y="${(yAt(situationMood) - 2).toFixed(1)}" font-size="8" fill="#c9a55d" text-anchor="end">Stimmung Start ${situationMood}</text>
  ` : '';

  const tensionPoints = rounds.map((r, i) => ({ x: xAt(i), y: yAt(r.tension || 0) }));
  const path = smoothSvgPath(tensionPoints);
  const dots = rounds.map((r, i) =>
    `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(r.tension || 0).toFixed(1)}" r="3.5" fill="#a8553f"/>
     <text x="${xAt(i).toFixed(1)}" y="${(yAt(r.tension || 0) - 6).toFixed(1)}" font-size="8" fill="#a8553f" text-anchor="middle">${r.tension || 0}</text>`
  ).join('');

  const xLabels = rounds.map((r, i) =>
    `<text x="${xAt(i).toFixed(1)}" y="${(H - 10).toFixed(1)}" font-size="10" fill="#857a6b" text-anchor="middle" font-weight="500">${i + 1}</text>`
  ).join('');

  const xAxisTitle = `<text x="${(padL + innerW / 2).toFixed(1)}" y="${(H - 0).toFixed(1)}" font-size="8" fill="#857a6b" text-anchor="middle">Runde</text>`;

  return `
    <svg viewBox="0 0 ${W} ${H}" class="stats-chart" role="img" aria-label="Spannungsverlauf">
      ${ticks}
      ${moodRef}
      <path d="${path}" fill="none" stroke="#a8553f" stroke-width="1.6" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
      ${xAxisTitle}
    </svg>
  `;
}

export function behaviorDetailHTML(verbal, nonverbal, legacy) {
  if (verbal || nonverbal) {
    const parts = [];
    if (verbal)   parts.push(`<span style="color:var(--ink-muted);font-size:12px">Verbal:</span> ${renderRichField(verbal)}`);
    if (nonverbal) parts.push(`<span style="color:var(--ink-muted);font-size:12px">Nonverbal:</span> ${renderRichField(nonverbal)}`);
    return parts.join('<br>');
  }
  return renderRichField(legacy || '–');
}

function renderRoundDetailMe(r) {
  const myHtml = behaviorDetailHTML(r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
  const ipHtml = behaviorDetailHTML(r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
  const myHas  = r.myBehaviorVerbal || r.myBehaviorNonverbal || r.myBehavior;
  const ipHas  = r.ipBehaviorVerbal || r.ipBehaviorNonverbal || r.ipBehavior;
  return `
    ${roundReactionDetail(r)}
    <div class="detail-row">
      <div class="detail-row-label">f) Mein Verhalten</div>
      <div class="detail-row-value ${myHas ? '' : 'muted'}">${myHtml}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row-label">g) Gewünschte Wirkung</div>
      <div class="detail-row-value ${!isRichEmpty(r.desiredEffect) ? '' : 'muted'}">${renderRichField(r.desiredEffect) || '–'}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row-label">IP-Verhalten</div>
      <div class="detail-row-value ${ipHas ? '' : 'muted'}">${ipHtml}</div>
    </div>
  `;
}

function renderRoundDetailIp(r) {
  const myHtml = behaviorDetailHTML(r.myBehaviorVerbal, r.myBehaviorNonverbal, r.myBehavior);
  const ipHtml = behaviorDetailHTML(r.ipBehaviorVerbal, r.ipBehaviorNonverbal, r.ipBehavior);
  const myHas  = r.myBehaviorVerbal || r.myBehaviorNonverbal || r.myBehavior;
  const ipHas  = r.ipBehaviorVerbal || r.ipBehaviorNonverbal || r.ipBehavior;
  return `
    <div class="detail-row">
      <div class="detail-row-label">IP-Verhalten</div>
      <div class="detail-row-value ${ipHas ? '' : 'muted'}">${ipHtml}</div>
    </div>
    ${roundReactionDetail(r)}
    <div class="detail-row">
      <div class="detail-row-label">f) Mein Verhalten</div>
      <div class="detail-row-value ${myHas ? '' : 'muted'}">${myHtml}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row-label">g) Gewünschte Wirkung</div>
      <div class="detail-row-value ${!isRichEmpty(r.desiredEffect) ? '' : 'muted'}">${renderRichField(r.desiredEffect) || '–'}</div>
    </div>
  `;
}

function roundReactionDetail(r) {
  const thoughts     = r.thoughts || [];
  const thoughtsHtml = thoughts.length === 0 ? `
    <div class="detail-row">
      <div class="detail-row-label">b/c) Gedanken &amp; Gefühle</div>
      <div class="detail-row-value muted">Nicht angegeben</div>
    </div>
  ` : `
    <div class="detail-row">
      <div class="detail-row-label">b/c) Gedanken &amp; Gefühle</div>
      ${thoughts.map((t, i) => {
        const allFeelings = (t.feelings || []).join(' · ');
        return `
          <div class="detail-thought">
            <div class="detail-thought-num">Gedanke ${i + 1}</div>
            <div class="detail-thought-text ${!isRichEmpty(t.text) ? '' : 'muted'}">${renderRichField(t.text) || '–'}</div>
            ${allFeelings ? `<div class="detail-thought-feelings">${escapeHtml(allFeelings)}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  const standalone     = r.standaloneFeelings || [];
  const standaloneHtml = standalone.length ? `
    <div class="detail-row">
      <div class="detail-row-label">Gefühle ohne Gedanken</div>
      <div class="detail-row-value">${escapeHtml(standalone.join(' · '))}</div>
    </div>
  ` : '';

  return `
    <div class="detail-row">
      <div class="detail-row-label">a) Interpretation</div>
      <div class="detail-row-value ${!isRichEmpty(r.interpretation) ? '' : 'muted'}">${renderRichField(r.interpretation) || '–'}</div>
    </div>
    ${thoughtsHtml}
    ${standaloneHtml}
    <div class="detail-row">
      <div class="detail-row-label">d) Spannung</div>
      <div class="detail-row-value">${r.tension} / 100</div>
    </div>
    <div class="detail-row">
      <div class="detail-row-label">e) Bedürfnis</div>
      <div class="detail-row-value ${!isRichEmpty(r.need) ? '' : 'muted'}">${renderRichField(r.need) || '–'}</div>
    </div>
  `;
}
