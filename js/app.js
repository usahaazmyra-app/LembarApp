// Lembar · bootstrap, router, shell
import './viewport.js';
import * as store from './store.js';
import { h, clear, closeAllOverlays, overlayOpen, snack, sheet, pickFile, vibrate, overlay, settled } from './ui.js';
import { icon, LOGO_SVG } from './icons.js';
import { t, setLang, detectLang } from './i18n.js';
import { requestUnlock, lockGate } from './views/lock.js';
import { startReminders } from './lib/reminders.js';
import { createNoteOfType, createPhotoNote } from './lib/create.js';

const views = {
  home: () => import('./views/home.js'),
  note: () => import('./views/editor.js'),
  sketch: () => import('./views/sketch.js'),
  books: () => import('./views/books.js'),
  book: () => import('./views/books.js').then(m => ({ render: m.renderBook })),
  'book-new': () => import('./views/books.js').then(m => ({ render: m.renderBookForm })),
  'book-edit': () => import('./views/books.js').then(m => ({ render: m.renderBookForm })),
  tags: () => import('./views/tags.js'),
  'tags-manage': () => import('./views/tags.js').then(m => ({ render: m.renderManage })),
  search: () => import('./views/search.js'),
  calendar: () => import('./views/calendar.js'),
  reminders: () => import('./views/reminders.js'),
  archive: () => import('./views/archive.js'),
  trash: () => import('./views/archive.js').then(m => ({ render: m.renderTrash })),
  settings: () => import('./views/settings.js'),
  language: () => import('./views/settings.js').then(m => ({ render: m.renderLanguage })),
  security: () => import('./views/settings.js').then(m => ({ render: m.renderSecurity })),
  backup: () => import('./views/backup.js'),
  export: () => import('./views/backup.js').then(m => ({ render: m.renderExport })),
  help: () => import('./views/help.js'),
  stats: () => import('./views/stats.js'),
  templates: () => import('./views/templates.js'),
  onboarding: () => import('./views/onboarding.js'),
};
const TABS = ['home', 'books', 'calendar', 'search'];
const MASTER_OK = ['home', 'books', 'book', 'search', 'calendar', 'archive', 'tags', 'reminders', 'trash'];

let navIdx = 1;
let current = { key: null, cleanupA: null, cleanupB: null, aKey: null };
let masterRoute = 'home';
const wideMQ = window.matchMedia('(min-width: 900px)');
export const isWide = () => wideMQ.matches;

// ---------- theme ----------
export function applyTheme() {
  const s = store.settings();
  const root = document.documentElement;
  let theme = s.theme;
  if (theme === 'system') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'paper';
  root.dataset.theme = theme;
  root.dataset.accent = s.accent || 'terracotta';
  root.style.setProperty('--fz', [0.9, 1, 1.1, 1.22][s.fontSize ?? 1]);
  const bg = getComputedStyle(root).getPropertyValue('--paper').trim() || '#FAF7F2';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  setLang(s.followSystemLang ? detectLang() : (s.lang || 'id'));
  try { localStorage.setItem('lembar-theme', JSON.stringify({ theme: s.theme, accent: s.accent, fz: [0.9, 1, 1.1, 1.22][s.fontSize ?? 1], lang: document.documentElement.lang })); } catch (e) { /* noop */ }
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__lembarInstall = e; store.emit('settings'); });
window.addEventListener('appinstalled', () => { window.__lembarInstall = null; });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------- routing ----------
function parseHash() {
  const raw = (location.hash || '#/home').replace(/^#\/?/, '') || 'home';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { raw, name: parts[0] || 'home', args: parts.slice(1).map(decodeURIComponent), query };
}

export async function navigate(path, { replace = false } = {}) {
  await settled();
  if (overlayOpen()) await closeAllOverlays();
  const cur = parseHash();
  if (path === cur.raw && !replace) return;
  const to = path.split(/[/?]/)[0];
  const st = history.state || {};
  // Tab: dari Beranda ke tab lain = push (Back kembali ke Beranda); antar tab lain = replace
  if (TABS.includes(cur.name) && TABS.includes(to) && cur.name !== 'home') {
    if (to === 'home' && st.fromHome && st.idx > 1) { history.back(); return; }
    history.replaceState({ ...st }, '', '#/' + path);
  } else if (replace) history.replaceState({ ...st, idx: navIdx }, '', '#/' + path);
  else if (isWide() && cur.name === 'note' && to === 'note') history.replaceState({ ...st }, '', '#/' + path);
  else history.pushState({ idx: ++navIdx, fromHome: cur.name === 'home' && TABS.includes(to) }, '', '#/' + path);
  route();
}
// Paksa render ulang halaman saat ini (dipakai setelah data berubah di tempat)
export function refresh() { current.key = null; current.aKey = null; return route(); }
export async function back(fallback = 'home') {
  await settled();
  if (overlayOpen()) await closeAllOverlays();
  if (history.state && history.state.idx > 1) history.back();
  else navigate(fallback, { replace: true });
}

const ctxFor = (paneKey) => {
  const unsubs = [];
  return {
    navigate, back, isWide, refresh, pane: paneKey,
    watch(kinds, fn) { unsubs.push(store.subscribe(k => { if (kinds.some(x => k.has(x))) fn(k); })); },
    onDispose(fn) { unsubs.push(fn); },
    _dispose() { unsubs.forEach(u => u()); },
  };
};

async function mountView(pane, name, args, query) {
  const el = document.getElementById(pane);
  const loader = views[name] || views.home;
  const mod = await loader();
  clear(el);
  const view = h('div', { class: 'view' });
  el.appendChild(view);
  const ctx = ctxFor(pane);
  let cleanup = null;
  try { cleanup = await mod.render(view, args, ctx, query); }
  catch (e) { console.error(e); view.appendChild(h('div', { class: 'empty' }, h('b', {}, t('Terjadi kesalahan')), h('p', { class: 'small muted' }, String(e.message || e)))); }
  return async () => { ctx._dispose(); if (typeof cleanup === 'function') { try { await cleanup(); } catch (e) { console.error(e); } } };
}

let routing = Promise.resolve();
export function route() { routing = routing.then(doRoute).catch(e => console.error(e)); return routing; }

async function doRoute() {
  document.body.classList.remove('selecting');
  const r = parseHash();
  // flag sekali pakai (?rec=1, ?new=1) dihapus dari URL agar tidak terulang saat Back/muat ulang
  const once = {};
  for (const k of ['rec', 'new']) if (k in r.query) { once[k] = r.query[k]; delete r.query[k]; }
  if (Object.keys(once).length && r.name !== 'new') {
    const qs = new URLSearchParams(r.query).toString();
    r.raw = r.raw.split('?')[0] + (qs ? '?' + qs : '');
    history.replaceState(history.state, '', '#/' + r.raw);
  }
  if (r.raw === current.key) return;
  // pembuatan catatan baru
  if (r.name === 'new') {
    const n = await createNoteOfType(r.args[0] || 'text', { ...r.query, ...once });
    const next = n.type === 'sketch' && n.blocks[0] ? '#/sketch/' + n.id + '/' + n.blocks[0].id + '?new=1' : '#/note/' + n.id + (once.rec ? '?rec=1' : '');
    history.replaceState({ idx: navIdx }, '', next);
    return doRoute();
  }
  if (r.name === 'journal') {
    const key = r.args[0] && r.args[0] !== 'today' ? r.args[0] : store.dayKey();
    const n = store.journalFor(key) || await createNoteOfType('journal', { date: key });
    history.replaceState({ idx: navIdx }, '', '#/note/' + n.id);
    return doRoute();
  }
  if (!store.settings().onboarded && r.name !== 'onboarding') {
    history.replaceState({ idx: navIdx }, '', '#/onboarding');
    return doRoute();
  }
  current.key = r.raw;
  const wide = isWide();
  const main = document.getElementById('main');
  const split = wide && (r.name === 'note');
  if (MASTER_OK.includes(r.name)) masterRoute = r.raw;
  main.classList.toggle('split', split);
  document.body.classList.toggle('no-nav', !TABS.includes(r.name) || wide);

  if (split) {
    const mr = masterRoute;
    if (current.aKey !== mr) {
      current.cleanupA && await current.cleanupA();
      const m = parseMaster(mr);
      current.cleanupA = await mountView('pane-a', m.name, m.args, m.query);
      current.aKey = mr;
    }
    current.cleanupB && await current.cleanupB();
    current.cleanupB = await mountView('pane-b', r.name, r.args, { ...r.query, ...once });
  } else {
    current.cleanupB && await current.cleanupB(); current.cleanupB = null;
    clear(document.getElementById('pane-b'));
    current.cleanupA && await current.cleanupA();
    current.cleanupA = await mountView('pane-a', r.name, r.args, { ...r.query, ...once });
    current.aKey = r.raw;
  }
  renderChrome(r);
}
function parseMaster(raw) {
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'home', args: parts.slice(1).map(decodeURIComponent), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

// ---------- chrome: bottom nav, FAB, sidebar ----------
function renderChrome(r) {
  const pane = document.getElementById('pane-a');
  pane.querySelectorAll(':scope > .nav, :scope > .fab').forEach(e => e.remove());
  if (TABS.includes(r.name) && !isWide()) {
    const tab = (name, ic, label) => h('a', { href: '#/' + name, class: r.name === name ? 'on' : '', 'aria-current': r.name === name ? 'page' : null }, icon(ic), label);
    pane.appendChild(h('nav', { class: 'nav', 'aria-label': t('Navigasi utama') },
      tab('home', 'home', t('Beranda')), tab('books', 'books', t('Buku')), h('div', { class: 'gap' }),
      tab('calendar', 'calendar', t('Kalender')), tab('search', 'search', t('Cari'))));
    const fab = h('button', { class: 'fab', 'aria-label': t('Buat catatan baru'), type: 'button', onClick: () => openCreateMenu() }, icon('plus', 'l'));
    pane.appendChild(fab);
  }
  renderSide(r);
}

function renderSide(r) {
  const side = document.getElementById('side');
  if (!isWide()) { clear(side); return; }
  clear(side);
  const live = store.liveNotes();
  const on = (name) => (r.name === name || (r.name === 'note' && parseMaster(masterRoute).name === name)) ? ' on' : '';
  const si = (href, ic, label, count, extraOn) => h('a', { class: 'si' + (extraOn ?? on(href.split('/')[0])), href: '#/' + href }, typeof ic === 'string' ? icon(ic) : ic, label, count != null ? h('small', {}, count) : null);
  side.append(
    h('div', { class: 'side-logo', html: LOGO_SVG + '<span class="h2" style="font-size:1.35rem">Lembar</span>' }),
    h('button', { class: 'btn p', style: 'margin-bottom:12px', type: 'button', onClick: () => openCreateMenu() }, icon('plus', 's'), t('Catatan baru')),
    si('home', 'home', t('Semua catatan'), live.length),
    si('search', 'search', t('Cari')),
    si('calendar', 'calendar', t('Kalender')),
    si('reminders', 'bell', t('Pengingat'), store.reminders().filter(n => !n.reminder.done).length || null),
    si('tags', 'tag', t('Tag')),
    h('span', { class: 'lbl', style: 'padding:14px 10px 4px' }, t('Buku')),
    ...store.books().map(b => {
      const active = (r.name === 'book' && r.args[0] === b.id) || (r.name === 'note' && masterRoute === 'book/' + b.id);
      return si('book/' + b.id, h('i', { class: 'bdot', style: `background:var(--${b.color || 'k8'});box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)` }), b.name,
        b.locked ? icon('lock', 'xs') : live.filter(n => n.bookId === b.id).length, active ? ' on' : '');
    }),
    si('book-new', 'plus', t('Buku baru')),
    h('div', { style: 'flex:1;min-height:12px' }),
    si('archive', 'archive', t('Arsip'), store.archivedNotes().length || null),
    si('trash', 'trash', t('Sampah'), store.trashedNotes().length || null),
    si('settings', 'settings', t('Pengaturan')),
  );
}

// ---------- menu buat catatan ----------
export function openCreateMenu(query = {}) {
  const q = new URLSearchParams(query).toString();
  const suffix = q ? '?' + q : '';
  const items = [
    ['template', t('Dari template'), 'accent-soft', () => navigate('templates' + suffix)],
    ['journal', t('Jurnal hari ini'), 'k2', () => navigate('journal/today')],
    ['photo', t('Foto'), 'k6', null],
    ['mic', t('Rekam suara'), 'k7', () => navigate('new/voice?rec=1' + (q ? '&' + q : ''))],
    ['sketch', t('Sketsa'), 'k8', () => navigate('new/sketch' + suffix)],
    ['check', t('Checklist'), 'k3', () => navigate('new/checklist' + suffix)],
    ['text', t('Teks'), 'k1', () => navigate('new/text' + suffix)],
  ];
  let entry;
  const bloom = h('div', { class: 'bloom' + (isWide() ? ' bloom-wide' : '') }, items.map(([ic, label, bg, fn], i) =>
    h('button', { type: 'button', style: `transition-delay:${(items.length - i) * 18}ms`, onClick: () => {
      if (!fn) { entry.close(); setTimeout(() => openPhotoSheet(query), 260); return; }
      fn();
    } },
      h('span', { class: 'ic', style: `background:var(--${bg})${ic === 'template' ? ';color:var(--accent)' : ''}` }, icon(ic, 's')), label)));
  const fab = isWide() ? null : h('button', { class: 'fab open', 'aria-label': t('Tutup menu'), type: 'button', onClick: () => entry.close() }, icon('plus', 'l'));
  entry = overlay(h('div', {}, bloom, fab), {});
  vibrate(8);
}

export function openPhotoSheet(query = {}) {
  const make = async (opts, scan) => {
    const files = await pickFile(opts);
    if (!files.length) return;
    s.close();
    snack(t('Memproses foto…'));
    try { const n = await createPhotoNote(files, { ...query, scan }); navigate('note/' + n.id); }
    catch (e) { console.error(e); snack(t('Foto tidak bisa dibaca. Coba format JPG atau PNG.')); }
  };
  const row = (ic, bg, title, sub, fn) => h('button', { class: 'lrow', type: 'button', onClick: fn },
    h('span', { class: 'tico', style: `background:var(--${bg})` }, icon(ic)),
    h('div', { class: 'body-t' }, h('h4', {}, title), h('p', {}, sub)));
  const s = sheet(t('Tambah foto'), h('div', { class: 'list' },
    row('camera', 'k6', t('Ambil dengan kamera'), t('Foto langsung masuk ke catatan'), () => make({ accept: 'image/*', capture: 'environment' })),
    row('photo', 'k3', t('Pilih dari galeri'), t('Bisa pilih beberapa sekaligus'), () => make({ accept: 'image/*', multiple: true })),
    row('scan', 'k2', t('Pindai dokumen'), t('Kontras ditingkatkan, cocok untuk kertas dan papan tulis'), () => make({ accept: 'image/*', capture: 'environment' }, true)),
    h('p', { class: 'small muted', style: 'margin:0;display:flex;gap:8px' }, icon('shield', 's'), t('Foto disimpan di perangkat dan dikompres agar hemat ruang.'))));
}

// ---------- global link handling ----------
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  navigate(a.getAttribute('href').slice(2));
});
window.addEventListener('popstate', () => { setTimeout(() => { if (!overlayOpen()) route(); }, 0); });
window.addEventListener('hashchange', () => route());
wideMQ.addEventListener?.('change', () => { current.key = null; current.aKey = null; route(); });
store.subscribe(k => { if ((k.has('books') || k.has('notes')) && isWide()) renderSide(parseHash()); if (k.has('settings')) applyTheme(); });

// ---------- lifecycle ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { store.session.hiddenAt = Date.now(); return; }
  if (store.session.hiddenAt && Date.now() - store.session.hiddenAt > 60000) {
    store.session.unlocked = false;
    if (store.settings().appLock && store.hasPin()) lockGate();
    else {
      const r = parseHash();
      const n = r.name === 'note' ? store.note(r.args[0]) : null;
      const b = r.name === 'book' ? store.book(r.args[0]) : null;
      const m = isWide() && masterRoute ? parseMaster(masterRoute) : null;
      const mb = m && m.name === 'book' ? store.book(m.args[0]) : null;
      if ((n && store.isLockedNote(n)) || (b && b.locked) || (mb && mb.locked)) refresh(); else store.emit('notes');
    }
  }
});

function offerUpdate(worker) {
  window.__lembarUpdate = worker;
  store.emit('settings');
  snack(t('Versi baru Lembar tersedia'), { label: t('Muat ulang'), icon: 'refresh', onClick: () => worker.postMessage('skipWaiting'), duration: 12000 });
}
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    window.__lembarSW = reg;
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          offerUpdate(nw);
        }
      });
    });
  }).catch(e => console.warn('SW', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'open-note') navigate('note/' + e.data.id);
  });
}

async function boot() {
  try {
    await store.init();
  } catch (e) {
    document.getElementById('splash').innerHTML = '<div style="padding:24px;text-align:center;font-family:system-ui"><b>' + t('Lembar tidak bisa membuka penyimpanan.') + '</b><p>' + t('Pastikan tidak dalam mode penyamaran, lalu muat ulang.') + '</p></div>';
    console.error(e);
    return;
  }
  applyTheme();
  const s0 = () => store.settings();
  const sp = new URLSearchParams(location.search);
  if (sp.has('text') || sp.has('title') || sp.has('url')) {
    const title = (sp.get('title') || '').trim();
    const body = [sp.get('text'), sp.get('url')].filter(Boolean).join('\n').trim();
    const esc = x => x.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>');
    const n = await store.createNote({ type: 'text', title: title.slice(0, 200), blocks: [{ id: store.uid(), t: 'text', html: esc(body) }] });
    if (!s0().onboarded) await store.setSetting('onboarded', true);
    history.replaceState({ idx: navIdx }, '', location.pathname + '#/note/' + n.id);
  } else history.replaceState({ idx: navIdx }, '', location.hash || '#/home');
  const s = store.settings();
  const hideSplash = () => { const sp = document.getElementById('splash'); if (!sp) return; sp.classList.add('hide'); setTimeout(() => sp.remove(), 400); };
  if (s.appLock && store.hasPin()) { hideSplash(); await lockGate(true); }
  await route();
  hideSplash();
  startReminders();
  registerSW();
}
export { requestUnlock };
boot();
