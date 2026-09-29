// Kerangka: navigasi bawah, tombol +, menu buat catatan, sidebar layar lebar.
import { S, newNote, saveNote, live, bookCount, isLocked } from '../store.js';
import { t } from '../i18n.js';
import { esc, ic, el, go, openLayer, closeLayer } from '../ui.js';
import { dotOf } from '../data.js';

export function bottomNav(active) {
  const item = (id, href, icon, label) => `<a class="${active === id ? 'on' : ''}" href="${href}" ${active === id ? 'aria-current="page"' : ''}>${ic(icon)}${esc(t(label))}</a>`;
  return `<nav class="nav" aria-label="${esc(t('Navigasi utama'))}">
    ${item('home', '#/', 'home', 'Beranda')}
    ${item('books', '#/books', 'book', 'Buku')}
    <div class="gap"></div>
    ${item('calendar', '#/calendar', 'cal', 'Kalender')}
    ${item('search', '#/search', 'search', 'Cari')}
  </nav>
  <button class="fab" data-fab aria-label="${esc(t('Buat catatan baru'))}" aria-expanded="false">${ic('plus', 'l')}</button>`;
}

const MENU = [
  ['template', 'spark', 'Dari template', 'accent'],
  ['journal', 'smile', 'Jurnal hari ini', 'k2'],
  ['photo', 'image', 'Foto', 'k6'],
  ['voice', 'mic', 'Rekam suara', 'k7'],
  ['sketch', 'pen', 'Sketsa', 'k8'],
  ['checklist', 'checksq', 'Checklist', 'k3'],
  ['text', 'text', 'Teks', 'k1']
];

export function openCreateMenu(context = {}) {
  const fab = document.querySelector('[data-fab]');
  const node = el(`<div class="bloom" role="menu">${MENU.map(([k, i, l, c]) => `<button role="menuitem" data-k="${k}"><span class="ic" style="background:${c === 'accent' ? 'var(--accent-soft);color:var(--accent)' : 'var(--' + c + ')'}">${ic(i, 's')}</span>${esc(t(l))}</button>`).join('')}</div>`);
  if (fab) { fab.classList.add('open'); fab.setAttribute('aria-expanded', 'true'); fab.style.zIndex = 55; }
  openLayer(node, { onClose: () => { if (fab) { fab.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); fab.style.zIndex = ''; } } });
  node.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) create(b.dataset.k, context);
  });
}

export async function create(kind, context = {}) {
  if (kind === 'template') return go('#/templates' + (context.bookId ? '?book=' + context.bookId : ''));
  if (kind === 'journal') return go('#/journal');
  const type = kind === 'photo' ? 'photo' : kind === 'voice' ? 'voice' : kind === 'sketch' ? 'sketch' : kind === 'checklist' ? 'checklist' : 'text';
  const init = { bookId: context.bookId || null };
  if (type === 'checklist') init.items = [];
  const n = newNote(type, init);
  if (init.bookId && isLocked(n) && !S.session.key) init.bookId = null;
  n.bookId = init.bookId;
  n._fresh = true;
  await saveNote(n, { touch: false });
  if (type === 'sketch') return go('#/sketch/' + n.id + '?fresh=1');
  const q = type === 'photo' ? '?add=photo' : type === 'voice' ? '?add=voice' : '?fresh=1';
  go('#/note/' + n.id + q);
}

export function bindShell(root, context = {}) {
  root.querySelectorAll('[data-fab]').forEach((b) => b.addEventListener('click', () => {
    if (document.querySelector('.bloom')) closeLayer(); else openCreateMenu(context);
  }));
}

/* ---------- sidebar layar lebar ---------- */
export function sidebar(route) {
  const n = live().filter((x) => !x.archived).length;
  const rem = live().filter((x) => x.reminder && !x.reminder.done).length;
  const si = (href, icon, label, on, extra = '') => `<a class="si ${on ? 'on' : ''}" href="${href}">${icon}${esc(t(label))}${extra}</a>`;
  const books = S.books.slice().sort((a, b) => a.name.localeCompare(b.name));
  return `<div style="display:flex;align-items:center;gap:10px;padding:0 6px 14px">
      <img src="icons/favicon.svg" width="32" height="32" alt=""><span class="h2" style="font-size:22px">Lembar</span></div>
    <button class="btn p" data-side-new style="margin-bottom:12px">${ic('plus', 's')}${esc(t('Catatan baru'))}</button>
    ${si('#/', ic('home'), 'Semua catatan', route === 'home', `<small>${n}</small>`)}
    ${si('#/search', ic('search'), 'Cari', route === 'search')}
    ${si('#/reminders', ic('bell'), 'Pengingat', route === 'reminders', rem ? `<small>${rem}</small>` : '')}
    ${si('#/calendar', ic('cal'), 'Kalender', route === 'calendar')}
    ${si('#/tags', ic('hash'), 'Tag', route === 'tags' || route === 'tagsManage')}
    <span class="lbl" style="padding:14px 10px 4px">${esc(t('Buku'))}</span>
    ${books.map((b) => si('#/book/' + b.id, `<i class="dot-c" style="background:${dotOf(b.color)}"></i>`, b.name, false, `<small>${b.locked ? ic('lock', 's') : bookCount(b.id)}</small>`)).join('')}
    ${si('#/book/new', ic('plus', 's'), 'Buku baru', route === 'bookNew')}
    <div style="flex:1;min-height:16px"></div>
    ${si('#/archive', ic('archive'), 'Arsip', route === 'archive')}
    ${si('#/trash', ic('trash'), 'Sampah', route === 'trash')}
    ${si('#/settings', ic('sliders'), 'Pengaturan', route === 'settings' || route === 'settingsSub')}`;
}
