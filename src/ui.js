import { escapeHtml, escapeAttr } from './utils.js';

export function headerHTML(title, step, withBack) {
  return `
    <div class="header">
      <button class="header-back ${withBack ? '' : 'hidden'}" id="header-back" aria-label="Zurück">←</button>
      <div class="header-title">${escapeHtml(title)}</div>
      ${step ? `<div class="header-step">${escapeHtml(step)}</div>` : ''}
    </div>
  `;
}

export function progressHTML(current, total) {
  const pct = Math.round((current / total) * 100);
  return `<div class="progress" role="progressbar" aria-valuenow="${current}" aria-valuemin="1" aria-valuemax="${total}" aria-label="Schritt ${current} von ${total}"><div class="progress-fill" style="width: ${pct}%"></div></div>`;
}

export function bottomBarHTML(buttons) {
  return `
    <div class="bottom-bar">
      ${buttons.map(b => `<button class="btn btn-${b.kind}" id="${b.id}">${escapeHtml(b.label)}</button>`).join('')}
    </div>
  `;
}

export function labelForValue(v, scale) {
  if (v < 34) return scale[0];
  if (v < 67) return scale[1];
  return scale[2];
}

export function sliderHTML(id, value, scale) {
  const v = Math.max(0, Math.min(100, value));
  return `
    <div class="slider-wrap">
      <div class="slider-value" id="${id}-display">${v}</div>
      <div class="slider-label-current" id="${id}-current">${labelForValue(v, scale)}</div>
      <input type="range" min="0" max="100" step="1" value="${v}" id="${id}" style="--val: ${v}%" aria-label="${escapeAttr(scale[0])} bis ${escapeAttr(scale[2])}" aria-valuetext="${v} – ${labelForValue(v, scale)}">
      <div class="slider-scale">
        <span>${scale[0]}</span><span>${scale[1]}</span><span>${scale[2]}</span>
      </div>
    </div>
  `;
}

export function wireSlider(id) {
  const el      = document.getElementById(id);
  const display = document.getElementById(id + '-display');
  const current = document.getElementById(id + '-current');
  const update  = () => {
    const v = parseInt(el.value, 10);
    el.style.setProperty('--val', v + '%');
    if (display) display.textContent = v;
    if (current) {
      const spans = el.parentElement.querySelectorAll('.slider-scale span');
      const scale = Array.from(spans).map(s => s.textContent);
      current.textContent = labelForValue(v, scale);
      el.setAttribute('aria-valuetext', `${v} – ${labelForValue(v, scale)}`);
    }
  };
  el.addEventListener('input', update);
  update();
}

export function openSheet() {
  document.getElementById('sheet').classList.add('open');
  document.getElementById('sheet-backdrop').classList.add('open');
}

export function closeSheet() {
  document.getElementById('sheet').classList.remove('open');
  document.getElementById('sheet-backdrop').classList.remove('open');
}

let toastTimer = null;
export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export function updateToolbarState() {
  const sel = document.getSelection();
  if (!sel || !sel.focusNode) return;
  const editor = sel.focusNode.nodeType === 1
    ? sel.focusNode.closest('[contenteditable]')
    : sel.focusNode.parentElement && sel.focusNode.parentElement.closest('[contenteditable]');
  if (!editor) return;
  const toolbar = editor.closest('.rich-editor') && editor.closest('.rich-editor').querySelector('.rich-toolbar');
  if (!toolbar) return;
  toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
    try { btn.classList.toggle('active', document.queryCommandState(btn.dataset.cmd)); } catch (e) {}
  });
}
