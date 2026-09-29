// Router berbasis hash + gerbang kunci aplikasi.
import { S, setting, hasPin, isUnlocked } from './store.js';
import { sidebar, create, openCreateMenu } from './views/shell.js';

const ROUTES = [
  [/^\/?$/, 'home', () => import('./views/home.js')],
  [/^\/note\/([\w-]+)$/, 'note', () => import('./views/editor.js')],
  [/^\/new\/(\w+)$/, 'new', null],
  [/^\/journal(?:\/([\d-]+))?$/, 'journal', () => import('./views/editor.js')],
  [/^\/sketch\/([\w-]+)(?:\/([\w-]+))?$/, 'sketch', () => import('./views/sketch.js')],
  [/^\/books$/, 'books', () => import('./views/books.js')],
  [/^\/book\/new$/, 'bookNew', () => import('./views/books.js')],
  [/^\/book\/([\w-]+)\/edit$/, 'bookEdit', () => import('./views/books.js')],
  [/^\/book\/([\w-]+)$/, 'book', () => import('./views/books.js')],
  [/^\/tags$/, 'tags', () => import('./views/tags.js')],
  [/^\/tags\/manage$/, 'tagsManage', () => import('./views/tags.js')],
  [/^\/search$/, 'search', () => import('./views/search.js')],
  [/^\/calendar$/, 'calendar', () => import('./views/calendar.js')],
  [/^\/reminders$/, 'reminders', () => import('./views/reminders.js')],
  [/^\/ring\/([\w-]+)$/, 'ring', () => import('./views/reminders.js')],
  [/^\/archive$/, 'archive', () => import('./views/bin.js')],
  [/^\/trash$/, 'trash', () => import('./views/bin.js')],
  [/^\/settings$/, 'settings', () => import('./views/settings.js')],
  [/^\/settings\/(\w+)$/, 'settingsSub', () => import('./views/settings.js')],
  [/^\/help$/, 'help', () => import('./views/help.js')],
  [/^\/stats$/, 'stats', () => import('./views/stats.js')],
  [/^\/templates$/, 'templates', () => import('./views/templates.js')],
  [/^\/onboarding$/, 'onboarding', () => import('./views/onboarding.js')],
  [/^\/unlock$/, 'unlock', () => import('./views/lock.js')],
  [/^\/pin$/, 'pin', () => import('./views/lock.js')],
  [/^\/forgot$/, 'forgot', () => import('./views/lock.js')]
];

let cleanup = null;
export const current = { name: '', params: [], query: {}, hash: '' };

export function parse(hash) {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const [re, name, loader] of ROUTES) {
    const m = path.match(re);
    if (m) return { name, params: m.slice(1), query, loader, hash: '#' + raw };
  }
  return { name: 'home', params: [], query, loader: ROUTES[0][2], hash: '#/' };
}

const wide = () => window.matchMedia('(min-width: 900px)').matches;
const split = () => window.matchMedia('(min-width: 1100px)').matches;

export async function route() {
  const r = parse(location.hash);
  if (r.name === 'new') { await create(r.params[0]); return; }

  // Gerbang kunci aplikasi
  const bare = ['unlock', 'forgot', 'onboarding', 'pin'];
  if (setting('appLock') && hasPin() && !isUnlocked() && !bare.includes(r.name)) {
    location.replace('#/unlock?next=' + encodeURIComponent(r.hash));
    return;
  }

  if (cleanup) { try { cleanup(); } catch (e) { /* abaikan */ } cleanup = null; }
  Object.assign(current, { name: r.name, params: r.params, query: r.query, hash: r.hash });
  document.querySelectorAll('.snack').forEach((s) => s.remove());

  const app = document.getElementById('app');
  const full = ['onboarding', 'unlock', 'forgot', 'pin', 'sketch', 'ring'].includes(r.name);
  let main;
  if (full || !wide()) {
    app.innerHTML = '<div class="frame-solo"><main id="main"></main></div>';
    main = document.getElementById('main');
  } else {
    app.innerHTML = `<div class="frame"><aside class="side" aria-label="Menu">${sidebar(r.name)}</aside><main id="main"></main></div>`;
    const sn = app.querySelector('[data-side-new]');
    if (sn) sn.addEventListener('click', () => openCreateMenu({}));
    main = document.getElementById('main');
  }

  const mod = await r.loader();
  // Tampilan terpisah (daftar + catatan) di layar lebar
  if (r.name === 'note' && split() && !full) {
    main.innerHTML = '<div class="split"><div class="pane-list" id="paneList"></div><div class="pane-main" id="paneMain"></div></div>';
    const home = await import('./views/home.js');
    const c1 = await home.renderList(document.getElementById('paneList'), { activeId: r.params[0] });
    const c2 = await mod.render(document.getElementById('paneMain'), r);
    cleanup = () => { c1 && c1(); c2 && c2(); };
  } else {
    cleanup = await mod.render(main, r);
  }
  if (!r.query.keepScroll) window.scrollTo(0, 0);
}

export function start() {
  window.addEventListener('hashchange', route);
  let lastWide = wide();
  let lastSplit = split();
  window.addEventListener('resize', () => {
    if (wide() !== lastWide || split() !== lastSplit) { lastWide = wide(); lastSplit = split(); route(); }
  });
  return route();
}
