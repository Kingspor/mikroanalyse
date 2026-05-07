import { State } from './state.js';
import { renderHome } from './views/home.js';
import { renderWizard } from './views/wizard.js';
import { renderDetail } from './views/detail.js';

export function render() {
  if (State.view === 'home')   renderHome();
  else if (State.view === 'wizard') renderWizard();
  else if (State.view === 'detail') renderDetail();

  const ann = document.getElementById('sr-announcer');
  if (ann) ann.textContent = { home: 'Startseite', wizard: 'Analyse-Wizard', detail: 'Detailansicht' }[State.view] || '';
}
