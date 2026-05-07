import { escapeHtml, escapeAttr } from './utils.js';

export function sanitizeRichText(html) {
  if (!html) return '';
  const allowed = new Set(['strong', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p']);
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('*').forEach(el => {
    if (!allowed.has(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes);
    } else {
      Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name));
    }
  });
  return tmp.innerHTML.trim();
}

export function richHtmlToText(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n');
  return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

export function renderRichField(value) {
  if (!value) return '';
  return /<(strong|em|u|ul|ol|li|br|p)[\s>\/]/i.test(value)
    ? sanitizeRichText(value)
    : escapeHtml(value);
}

export function isRichEmpty(html) {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, '').trim() === '';
}

export function valueToEditorHTML(value) {
  if (!value) return '';
  return /<(strong|em|u|ul|ol|li|br|p)[\s>\/]/i.test(value)
    ? sanitizeRichText(value)
    : escapeHtml(value);
}

export function getRichValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  if (el.tagName === 'TEXTAREA') return el.value.trim();
  const raw = el.innerHTML.trim();
  if (raw === '<br>' || raw === '') return '';
  return sanitizeRichText(raw);
}

export function richEditorHTML(id, value, placeholder, extraStyle) {
  const style = extraStyle ? ` style="${escapeAttr(extraStyle)}"` : '';
  return `<div class="rich-editor">
      <div class="rich-toolbar" role="toolbar" aria-label="Formatierung">
        <button type="button" class="rich-btn" data-cmd="bold" title="Fett" aria-label="Fett"><b>F</b></button>
        <button type="button" class="rich-btn" data-cmd="italic" title="Kursiv" aria-label="Kursiv"><i>K</i></button>
        <button type="button" class="rich-btn" data-cmd="underline" title="Unterstreichen" aria-label="Unterstreichen"><u>U</u></button>
        <button type="button" class="rich-btn" data-cmd="insertUnorderedList" title="Aufzählung" aria-label="Aufzählung">•≡</button>
      </div>
      <div class="rich-content" id="${escapeAttr(id)}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${escapeAttr(placeholder)}" data-placeholder="${escapeAttr(placeholder)}"${style}>${valueToEditorHTML(value)}</div>
    </div>`;
}
