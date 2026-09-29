// Lembar · helper UI: DOM builder, overlay (sheet/dialog), snackbar, sanitizer
import { icon } from './icons.js';
import { t } from './i18n.js';

// ---------- DOM ----------
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else Object.assign(el.style, v); }
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export const $ = (sel, root = document) => root.querySelector(sel);

export function iconBtn(name, label, onClick, cls = '') {
  return h('button', { class: 'ib ' + cls, 'aria-label': label, title: label, type: 'button', onClick }, icon(name));
}
export function btn(label, cls, onClick, iconName) {
  return h('button', { class: 'btn ' + (cls || ''), type: 'button', onClick }, iconName ? icon(iconName, 's') : null, label);
}
export function toggle(on, onChange, label) {
  const b = h('button', { class: 'tg' + (on ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label });
  b.addEventListener('click', () => {
    const v = !b.classList.contains('on');
    b.classList.toggle('on', v); b.setAttribute('aria-checked', v ? 'true' : 'false');
    onChange(v);
  });
  return b;
}
export function debounce(fn, ms) {
  let tm; const d = (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(tm); fn(...a); };
  d.cancel = () => clearTimeout(tm);
  return d;
}
export function vibrate(ms = 10) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* noop */ } }
export function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- sanitizer untuk isi catatan ----------
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'BR', 'P', 'DIV', 'SPAN', 'A', 'MARK']);
export function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1) {
        if (!ALLOWED.has(child.tagName)) {
          if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(child.tagName)) { child.remove(); continue; }
          walk(child);
          child.replaceWith(...child.childNodes);
          continue;
        }
        for (const attr of [...child.attributes]) {
          const keep = (child.tagName === 'A' && (attr.name === 'data-note' || attr.name === 'class' || attr.name === 'contenteditable'));
          if (!keep) child.removeAttribute(attr.name);
        }
        if (child.tagName === 'A') { child.className = 'wl'; child.setAttribute('contenteditable', 'false'); }
        walk(child);
      } else if (child.nodeType !== 3) child.remove();
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

// ---------- overlay stack (terhubung dengan tombol Kembali Android) ----------
const stack = [];
let ignorePops = 0;
let settleResolvers = [];
export function settled() { return ignorePops === 0 ? Promise.resolve() : new Promise(r => settleResolvers.push(r)); }
window.addEventListener('popstate', () => {
  if (ignorePops > 0) { ignorePops--; if (ignorePops === 0) settleResolvers.splice(0).forEach(r => r()); return; }
  if (stack.length) { const top = stack.pop(); top.close(true); }
});
function register(entry) {
  stack.push(entry);
  const push = () => history.pushState({ lembarOverlay: stack.length }, '');
  if (ignorePops > 0) settled().then(push); else push();
}
function unregister(entry, fromBack) {
  const i = stack.indexOf(entry);
  if (i >= 0) stack.splice(i, 1);
  if (!fromBack) { ignorePops++; history.back(); }
}
export function overlayOpen() { return stack.length > 0; }
// Entri riwayat tanpa tampilan: tombol Kembali memanggil onBack (dipakai mode pilih)
export function backHandler(onBack) {
  let closed = false;
  const entry = { close(fromBack, silent) { if (closed) return; closed = true; if (!silent) unregister(entry, fromBack); onBack(); } };
  register(entry);
  return { release() { if (closed) return; closed = true; unregister(entry, false); } };
}
export function closeAllOverlays() {
  return new Promise(resolve => {
    if (!stack.length) return resolve();
    const n = stack.length;
    const entries = [...stack].reverse();
    stack.length = 0;
    entries.forEach(e => e.close(true, true));
    ignorePops += 1;
    const done = () => { window.removeEventListener('popstate', done); setTimeout(resolve, 0); };
    window.addEventListener('popstate', done);
    history.go(-n);
  });
}

export function overlay(node, opts) { return mountOverlay(node, opts); }
function mountOverlay(node, { onClose, dismissable = true, cls = '' } = {}) {
  const root = document.getElementById('overlays');
  const scrim = h('div', { class: 'scrim ' + cls });
  const wrap = h('div', { class: 'ov ' + cls }, scrim, node);
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  let closed = false;
  const entry = {
    close(fromBack, silent) {
      if (closed) return; closed = true;
      if (!silent) unregister(entry, fromBack);
      wrap.classList.remove('in');
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 220);
      document.removeEventListener('keydown', onKey);
      onClose && onClose();
    },
  };
  const onKey = (e) => { if (e.key === 'Escape' && dismissable && stack[stack.length - 1] === entry) entry.close(); };
  document.addEventListener('keydown', onKey);
  if (dismissable) scrim.addEventListener('click', () => entry.close());
  register(entry);
  return entry;
}

export function sheet(title, content, opts = {}) {
  const body = h('div', { class: 'sheet-body' }, content);
  const node = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
    h('div', { class: 'grab' }),
    title ? h('div', { class: 'sheet-hd' }, h('h2', { class: 'h2' }, title), opts.action || null) : null,
    body);
  const entry = mountOverlay(node, opts);
  const close = () => entry.close();
  // geser ke bawah untuk menutup
  let y0 = null;
  node.addEventListener('touchstart', e => { if (body.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  node.addEventListener('touchmove', e => {
    if (y0 == null) return; const dy = e.touches[0].clientY - y0;
    if (dy > 0) node.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  node.addEventListener('touchend', e => {
    if (y0 == null) return; const dy = (e.changedTouches[0].clientY - y0); y0 = null;
    node.style.transform = '';
    if (dy > 110) close();
  });
  return { close, node, body };
}

export function dialog({ title, message, icon: ic, tone = '', actions = [], content = null, dismissable = true }) {
  let entry;
  const acts = h('div', { class: 'dlg-acts' }, actions.map(a => {
    const b = h('button', { class: 'btn ' + (a.cls || 'g'), type: 'button' }, a.label);
    b.addEventListener('click', async () => { const r = a.onClick ? await a.onClick() : undefined; if (r !== false) entry.close(); });
    return b;
  }));
  const node = h('div', { class: 'dlg ' + tone, role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
    ic ? h('div', { class: 'dlg-ic' }, icon(ic, 'l')) : null,
    h('h2', { class: 'h2' }, title),
    message ? h('p', { class: 'small muted' }, message) : null,
    content,
    acts);
  entry = mountOverlay(node, { dismissable, cls: 'center' });
  const first = node.querySelector('input,textarea');
  if (first) setTimeout(() => first.focus(), 60);
  return { close: () => entry.close(), node };
}

export function confirm({ title, message, ok = t('Ya'), cancel = t('Batal'), danger = false, icon: ic }) {
  return new Promise(resolve => {
    let decided = false;
    const d = dialog({
      title, message, icon: ic, tone: danger ? 'danger' : '',
      actions: [
        { label: cancel, cls: 'g', onClick: () => { decided = true; resolve(false); } },
        { label: ok, cls: danger ? 'danger' : 'p', onClick: () => { decided = true; resolve(true); } },
      ],
    });
    const obs = new MutationObserver(() => { if (!d.node.isConnected) { obs.disconnect(); if (!decided) resolve(false); } });
    obs.observe(document.getElementById('overlays'), { childList: true, subtree: true });
  });
}

export function promptText({ title, message, value = '', placeholder = '', ok = t('Simpan'), maxlength = 80 }) {
  return new Promise(resolve => {
    let decided = false;
    const input = h('input', { class: 'field-input', type: 'text', value, placeholder, maxlength });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); d.node.querySelector('.btn.p').click(); } });
    const d = dialog({
      title, message, content: input,
      actions: [
        { label: t('Batal'), cls: 'g', onClick: () => { decided = true; resolve(null); } },
        { label: ok, cls: 'p', onClick: () => { const v = input.value.trim(); if (!v) { input.focus(); return false; } decided = true; resolve(v); } },
      ],
    });
    const obs = new MutationObserver(() => { if (!d.node.isConnected) { obs.disconnect(); if (!decided) resolve(null); } });
    obs.observe(document.getElementById('overlays'), { childList: true, subtree: true });
  });
}

export function fullscreen(node, { onClose, cls = '' } = {}) {
  const entry = mountOverlay(h('div', { class: 'fs ' + cls }, node), { onClose, cls: 'full' });
  return { close: () => entry.close() };
}

// ---------- snackbar ----------
let snackTimer;
export function snack(message, action) {
  const root = document.getElementById('snack');
  clear(root);
  clearTimeout(snackTimer);
  const el = h('div', { class: 'snack', role: 'status' },
    h('span', { class: 'snack-msg' }, message),
    action ? h('button', { type: 'button', onClick: () => { hide(); action.onClick(); } }, action.icon ? icon(action.icon, 's') : null, action.label) : null);
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const hide = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 200); };
  snackTimer = setTimeout(hide, (action && action.duration) || (action ? 5000 : 2600));
  return hide;
}

// ---------- gestur ----------
export function onLongPress(el, fn, ms = 480) {
  let timer = null; let sx = 0; let sy = 0; let fired = false;
  el.addEventListener('pointerdown', e => {
    if (e.button && e.button !== 0) return;
    fired = false; sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { fired = true; vibrate(15); fn(e); }, ms);
  });
  const cancel = () => clearTimeout(timer);
  el.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) cancel(); });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (!fired) { fired = true; fn(e); } });
  el.addEventListener('click', e => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false; } }, true);
}

export function swipeable(row, { onLeft, onRight, leftLabel, rightLabel }) {
  const card = row.querySelector('.sw-card');
  let x0 = 0, y0 = 0, dx = 0, active = false, locked = null;
  const under = h('div', { class: 'sw-under' },
    h('span', { class: 'sw-r' }, icon('archive'), rightLabel),
    h('span', { class: 'sw-l' }, leftLabel, icon('trash')));
  row.insertBefore(under, card);
  row.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; active = true; locked = null; card.style.transition = 'none'; }, { passive: true });
  row.addEventListener('touchmove', e => {
    if (!active) return;
    const mx = e.touches[0].clientX - x0; const my = e.touches[0].clientY - y0;
    if (locked == null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    if (locked !== 'x') return;
    dx = mx;
    card.style.transform = `translateX(${dx}px)`;
    row.classList.toggle('to-right', dx > 0);
    row.classList.toggle('to-left', dx < 0);
  }, { passive: true });
  row.addEventListener('touchcancel', () => { active = false; card.style.transition = ''; card.style.transform = ''; row.classList.remove('to-right', 'to-left'); });
  row.addEventListener('touchend', () => {
    if (!active) return; active = false;
    card.style.transition = '';
    const w = row.offsetWidth * 0.33;
    if (locked === 'x' && dx > w && onRight) { card.style.transform = 'translateX(110%)'; vibrate(12); setTimeout(onRight, 160); }
    else if (locked === 'x' && dx < -w && onLeft) { card.style.transform = 'translateX(-110%)'; vibrate(12); setTimeout(onLeft, 160); }
    else card.style.transform = '';
    if (locked === 'x' && Math.abs(dx) > 10) { row.dataset.swiped = '1'; setTimeout(() => delete row.dataset.swiped, 50); }
  });
}

// ---------- file helpers ----------
export function pickFile({ accept = '*/*', capture = null, multiple = false } = {}) {
  return new Promise(resolve => {
    const input = h('input', { type: 'file', accept, style: 'position:fixed;left:-9999px' });
    if (capture) input.setAttribute('capture', capture);
    if (multiple) input.multiple = true;
    input.addEventListener('change', () => { resolve([...input.files]); input.remove(); });
    input.addEventListener('cancel', () => { resolve([]); input.remove(); });
    document.body.appendChild(input);
    input.click();
  });
}
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: 'display:none' });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
export async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  download(blob, filename);
  return 'downloaded';
}
