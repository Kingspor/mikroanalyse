import { State } from './state.js';
import { Store } from './store.js';
import { newAnalysis, migrateRound } from './model.js';
import { getRichValue } from './richtext.js';
import { showToast } from './ui.js';
import { getRoundSequence, saveRoundField, HUB_STEP } from './views/wizard.js';
import { render } from './renderer.js';

export function startNewAnalysis() {
  State.current   = newAnalysis();
  State.view      = 'wizard';
  State.step      = 0;
  State.roundIdx  = -1;
  State.roundStep = 0;
  Store.upsert(State.current);
  render();
}

export function openDetail(id) {
  State.detailId = id;
  State.view     = 'detail';
  render();
}

export function goHome() {
  State.view          = 'home';
  State.current       = null;
  State.detailId      = null;
  State.step          = 0;
  State.roundIdx      = -1;
  State.roundStep     = 0;
  State.selectionMode = false;
  State.selectedIds   = [];
  render();
}

export function initNavigation() {
  document.addEventListener('click', e => {
    if (e.target && e.target.id === 'header-back') {
      if (State.view === 'detail') return goHome();
      if (State.view === 'wizard') {
        saveCurrentStep();
        if (State.current) {
          State.current._draft = { step: State.step, roundIdx: State.roundIdx, roundStep: State.roundStep };
          Store.upsert(State.current);
        }
        showToast('Gespeichert – kannst du später weitermachen');
        goHome();
      }
    }
  });
}

export function saveCurrentStep() {
  const a = State.current;
  if (!a) return;
  if (State.roundIdx >= 0) {
    const r = a.rounds[State.roundIdx];
    if (r) {
      migrateRound(r);
      const seq = getRoundSequence(r.starter);
      const key = seq[State.roundStep];
      if (key && key !== 'done') saveRoundField(r, key);
    }
  } else {
    const s      = a.situation;
    const sitIdx = State.step;
    const elDt   = document.getElementById('f-datetime');
    const elTitle = document.getElementById('f-title');
    if (sitIdx === 0 && elDt) {
      s.datetime = elDt.value || s.datetime;
      if (elTitle) s.title = elTitle.value.trim();
    }
    const elMood = document.getElementById('f-mood');
    if (sitIdx === 1 && elMood) s.mood = Math.max(0, Math.min(100, parseInt(elMood.value, 10) || 50));
    if (sitIdx === 2) s.need = getRichValue('f-need');
    if (sitIdx === 3) {
      const elWho   = document.getElementById('f-who');
      const elWhere = document.getElementById('f-where');
      s.contextWhat  = getRichValue('f-what');
      if (elWho)   s.contextWho   = elWho.value.trim();
      if (elWhere) s.contextWhere = elWhere.value.trim();
    }
  }
}
