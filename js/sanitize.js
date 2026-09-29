// Membersihkan HTML catatan agar hanya berisi format yang diizinkan.
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'H2', 'H3', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'A']);

export function sanitize(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
  const root = doc.body.firstChild;
  clean(root);
  return root.innerHTML;
}

function clean(node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) continue;
    if (child.nodeType !== 1) { child.remove(); continue; }
    const tag = child.tagName;
    if (!ALLOWED.has(tag)) {
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT') { child.remove(); continue; }
      clean(child);
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    const keep = {};
    if ((tag === 'A' || tag === 'SPAN') && child.classList.contains('wl') && child.dataset.note) {
      keep.class = 'wl';
      keep['data-note'] = child.dataset.note.replace(/[^\w-]/g, '');
      keep.contenteditable = 'false';
    }
    for (const a of Array.from(child.attributes)) child.removeAttribute(a.name);
    for (const [k, v] of Object.entries(keep)) child.setAttribute(k, v);
    if (tag === 'A' && !keep.class) { clean(child); child.replaceWith(...Array.from(child.childNodes)); continue; }
    clean(child);
  }
}

export function textOf(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString('<div>' + html.replace(/<(br|\/p|\/div|\/li|\/h2|\/h3|\/blockquote|\/pre)>/gi, '$&\n') + '</div>', 'text/html');
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}
