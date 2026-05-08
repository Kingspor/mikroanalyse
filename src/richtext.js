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

function findFormatAncestor(node, tags, editor) {
  const want = Array.isArray(tags) ? tags : [tags];
  let n = node && node.nodeType === 1 ? node : node && node.parentElement;
  while (n && n !== editor) {
    if (want.includes(n.tagName.toLowerCase())) return n;
    n = n.parentElement;
  }
  return null;
}

function unwrapElement(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
  parent.normalize();
}

function getEditorFromSelection() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.focusNode;
  if (!node) return null;
  const el = node.nodeType === 1 ? node : node.parentElement;
  return el ? el.closest('.rich-content[contenteditable]') : null;
}

function placeCaretAtEnd(node) {
  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(node);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

function selectNodeContents(node) {
  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(node);
  sel.removeAllRanges();
  sel.addRange(r);
}

function toggleInline(tag, aliases, editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  const all = [tag, ...aliases];
  const startAnc = findFormatAncestor(range.startContainer, all, editor);
  const endAnc   = findFormatAncestor(range.endContainer,   all, editor);
  if (startAnc && startAnc === endAnc) {
    unwrapElement(startAnc);
    return;
  }

  const wrapper = document.createElement(tag);
  try {
    range.surroundContents(wrapper);
  } catch (e) {
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }
  wrapper.querySelectorAll(all.join(',')).forEach(unwrapElement);
  selectNodeContents(wrapper);
}

function toggleUnorderedList(editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);

  const li = findFormatAncestor(range.startContainer, 'li', editor);
  if (li) {
    const ul = li.parentNode;
    const items = Array.from(ul.children);
    const frag = document.createDocumentFragment();
    items.forEach((item, i) => {
      while (item.firstChild) frag.appendChild(item.firstChild);
      if (i < items.length - 1) frag.appendChild(document.createElement('br'));
    });
    ul.parentNode.replaceChild(frag, ul);
    return;
  }

  const ul = document.createElement('ul');
  const newLi = document.createElement('li');
  if (!range.collapsed) {
    newLi.appendChild(range.extractContents());
  }
  ul.appendChild(newLi);
  range.insertNode(ul);
  if (!newLi.firstChild) newLi.appendChild(document.createElement('br'));
  placeCaretAtEnd(newLi);
}

function exitInlineAncestor(ancestor, container, offset) {
  const startProbe = document.createRange();
  startProbe.setStart(ancestor, 0);
  startProbe.setEnd(container, offset);
  const atStart = startProbe.toString() === '';

  const endProbe = document.createRange();
  endProbe.setStart(container, offset);
  endProbe.setEnd(ancestor, ancestor.childNodes.length);
  const atEnd = endProbe.toString() === '';

  const r = document.createRange();
  if (atEnd) {
    r.setStartAfter(ancestor);
  } else if (atStart) {
    r.setStartBefore(ancestor);
  } else {
    const tail = document.createRange();
    tail.setStart(container, offset);
    tail.setEnd(ancestor, ancestor.childNodes.length);
    const fragment = tail.extractContents();
    const clone = ancestor.cloneNode(false);
    while (fragment.firstChild) clone.appendChild(fragment.firstChild);
    ancestor.parentNode.insertBefore(clone, ancestor.nextSibling);
    r.setStartBefore(clone);
  }
  r.collapse(true);
  return r;
}

const CMD_TO_TAGS = {
  bold:      ['strong', 'b'],
  italic:    ['em', 'i'],
  underline: ['u'],
};
const CMD_TO_PRIMARY = { bold: 'strong', italic: 'em', underline: 'u' };

function togglePendingInline(cmd, editor) {
  const add    = editor._pendingAdd    || (editor._pendingAdd    = new Set());
  const remove = editor._pendingRemove || (editor._pendingRemove = new Set());
  const ancestors = getAncestorFormats(editor);
  if (add.has(cmd))            add.delete(cmd);
  else if (remove.has(cmd))    remove.delete(cmd);
  else if (ancestors.has(cmd)) remove.add(cmd);
  else                         add.add(cmd);
}

function clearPendingState(editor) {
  if (editor._pendingAdd)    editor._pendingAdd.clear();
  if (editor._pendingRemove) editor._pendingRemove.clear();
}

function ancestorFormatsAtNode(startNode, editor) {
  const formats = new Set();
  let el = startNode && startNode.nodeType === 1 ? startNode : startNode && startNode.parentElement;
  while (el && el !== editor) {
    const tag = el.tagName && el.tagName.toLowerCase();
    if (tag === 'strong' || tag === 'b') formats.add('bold');
    else if (tag === 'em' || tag === 'i') formats.add('italic');
    else if (tag === 'u') formats.add('underline');
    el = el.parentElement;
  }
  return formats;
}

export function handleBeforeInput(e) {
  const t = e.target;
  const editor = t && t.closest && t.closest('.rich-content[contenteditable]');
  if (!editor) return;
  if (e.inputType !== 'insertText' || e.data == null || e.data === '') return;
  const add    = editor._pendingAdd;
  const remove = editor._pendingRemove;
  if ((!add || !add.size) && (!remove || !remove.size)) return;

  e.preventDefault();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) { clearPendingState(editor); return; }
  let range = sel.getRangeAt(0);

  const ancestorsBefore = ancestorFormatsAtNode(range.startContainer, editor);
  const desired = new Set(ancestorsBefore);
  if (add)    add.forEach(f => desired.add(f));
  if (remove) remove.forEach(f => desired.delete(f));

  if (remove && remove.size) {
    for (const cmd of remove) {
      const tags = CMD_TO_TAGS[cmd] || [];
      let n = range.startContainer;
      let target = null;
      while (n && n !== editor) {
        if (n.nodeType === 1 && tags.includes(n.tagName.toLowerCase())) target = n;
        n = n.parentNode;
      }
      if (target) {
        let outermost = target;
        let p = target.parentElement;
        while (p && p !== editor && tags.includes(p.tagName.toLowerCase())) {
          outermost = p; p = p.parentElement;
        }
        range = exitInlineAncestor(outermost, range.startContainer, range.startOffset);
      }
    }
  }

  const remaining = ancestorFormatsAtNode(range.startContainer, editor);
  const toApply = [];
  for (const f of desired) if (!remaining.has(f)) toApply.push(f);

  let node = document.createTextNode(e.data);
  for (const cmd of toApply) {
    const tag = CMD_TO_PRIMARY[cmd];
    if (!tag) continue;
    const w = document.createElement(tag);
    w.appendChild(node);
    node = w;
  }
  range.deleteContents();
  range.insertNode(node);

  let tn = node;
  while (tn.firstChild) tn = tn.firstChild;
  const r = document.createRange();
  r.setStart(tn, tn.nodeType === 3 ? tn.length : 0);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);

  clearPendingState(editor);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

export function applyRichCommand(cmd) {
  const editor = getEditorFromSelection();
  if (!editor) return;
  const sel = window.getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  const isInline = cmd === 'bold' || cmd === 'italic' || cmd === 'underline';
  if (range && range.collapsed && isInline) {
    togglePendingInline(cmd, editor);
    return;
  }
  if (cmd === 'bold')                     toggleInline('strong', ['b'],  editor);
  else if (cmd === 'italic')              toggleInline('em',     ['i'],  editor);
  else if (cmd === 'underline')           toggleInline('u',      [],     editor);
  else if (cmd === 'insertUnorderedList') toggleUnorderedList(editor);
  else return;
  clearPendingState(editor);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function getAncestorFormats(editor) {
  const formats = new Set();
  const sel = window.getSelection();
  if (!sel || !sel.focusNode) return formats;
  let el = sel.focusNode.nodeType === 1 ? sel.focusNode : sel.focusNode.parentElement;
  while (el && el !== editor) {
    const tag = el.tagName && el.tagName.toLowerCase();
    if (tag === 'strong' || tag === 'b') formats.add('bold');
    else if (tag === 'em' || tag === 'i') formats.add('italic');
    else if (tag === 'u') formats.add('underline');
    else if (tag === 'li') formats.add('insertUnorderedList');
    el = el.parentElement;
  }
  return formats;
}

export function getActiveRichFormats(editor) {
  const formats = getAncestorFormats(editor);
  if (editor && editor._pendingAdd)    editor._pendingAdd.forEach(f => formats.add(f));
  if (editor && editor._pendingRemove) editor._pendingRemove.forEach(f => formats.delete(f));
  return formats;
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
