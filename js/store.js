// Lembar · state & data layer
import { db } from './db.js';
import { t } from './i18n.js';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const DAY = 86400000;

export const DEFAULT_SETTINGS = {
  theme: 'paper',          // light | paper | dark | system
  accent: 'terracotta',
  fontSize: 1,             // 0..3
  lang: 'id',
  followSystemLang: false,
  view: 'grid',
  onboarded: false,
  appLock: false,
  bio: false,
  bioCred: null,
  pinHash: null,
  pinSalt: null,
  recoveryQ: null,
  recoveryHash: null,
  lastBackup: null,
  backupRemind: true,
  backupMedia: true,
  recentSearches: [],
  activeDays: [],
  bookOrder: [],
};

export const CARD_COLORS = [
  ['', 'Polos'], ['k1', 'Kuning'], ['k2', 'Hijau'], ['k3', 'Biru'], ['k4', 'Merah muda'],
  ['k5', 'Ungu'], ['k6', 'Jingga'], ['k7', 'Toska'], ['k8', 'Abu'],
];

export const BOOK_ICONS = ['book', 'work', 'school', 'heart', 'pen', 'food', 'map', 'idea', 'star', 'home'];

const S = {
  notes: new Map(),
  books: new Map(),
  templates: new Map(),
  settings: { ...DEFAULT_SETTINGS },
  ready: false,
};
export const session = { unlocked: false, hiddenAt: 0 };

// ---------- events ----------
const listeners = new Set();
let pending = new Set();
let scheduled = false;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(kind) {
  pending.add(kind);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    const kinds = pending; pending = new Set(); scheduled = false;
    for (const l of [...listeners]) { try { l(kinds); } catch (e) { console.error(e); } }
  });
}

// ---------- init ----------
export async function init() {
  const [notes, books, templates, settings] = await Promise.all([
    db.getAll('notes'), db.getAll('books'), db.getAll('templates'), db.getAll('settings'),
  ]);
  notes.forEach(n => S.notes.set(n.id, normalizeNote(n)));
  books.forEach(b => S.books.set(b.id, b));
  templates.forEach(t => S.templates.set(t.id, t));
  settings.forEach(s => { S.settings[s.key] = s.value; });
  if (!settings.find(s => s.key === 'seeded')) await seed();
  await purgeTrash();
  S.ready = true;
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {});
  }
}

async function seed() {
  const now = Date.now();
  const en = !(navigator.language || 'id').toLowerCase().startsWith('id');
  const defs = [
    ['pribadi', en ? 'Personal' : 'Pribadi', 'k4', 'heart'],
    ['kerja', en ? 'Work' : 'Kerja', 'k3', 'work'],
    ['kuliah', en ? 'School' : 'Kuliah', 'k5', 'school'],
    ['jurnal', en ? 'Journal' : 'Jurnal', 'k2', 'pen'],
  ];
  if (en) await setSetting('lang', 'en');
  const books = defs.map(([id, name, color, icon], i) => ({ id, name, color, icon, locked: false, createdAt: now + i }));
  books.forEach(b => S.books.set(b.id, b));
  await db.putMany('books', books);
  await setSetting('seeded', true);
}

function normalizeNote(n) {
  return {
    type: 'text', title: '', blocks: [], bookId: null, tags: [], color: '', pinned: false,
    archived: false, trashedAt: null, locked: false, reminder: null, mood: null, journalDate: null,
    createdAt: Date.now(), updatedAt: Date.now(), ...n,
  };
}

// ---------- settings ----------
export function settings() { return S.settings; }
export function getSetting(k) { return S.settings[k]; }
export async function setSetting(key, value) {
  S.settings[key] = value;
  await db.put('settings', { key, value });
  emit('settings');
}

// ---------- books ----------
export function books() {
  return [...S.books.values()].sort((a, b) => a.createdAt - b.createdAt);
}
export function book(id) { return id ? S.books.get(id) : null; }
export async function saveBook(b) {
  const nb = { locked: false, color: 'k3', icon: 'book', createdAt: Date.now(), ...b, id: b.id || uid() };
  S.books.set(nb.id, nb);
  await db.put('books', nb);
  emit('books');
  return nb;
}
export async function deleteBook(id) {
  const bk = S.books.get(id);
  const affected = [...S.notes.values()].filter(n => n.bookId === id);
  // catatan dari buku terkunci tetap terkunci setelah bukunya dihapus
  for (const n of affected) { n.bookId = null; if (bk && bk.locked) n.locked = true; }
  if (affected.length) await db.putMany('notes', affected);
  S.books.delete(id);
  await db.delete('books', id);
  emit('books'); emit('notes');
}

// ---------- notes ----------
export function allNotes() { return [...S.notes.values()]; }
export function note(id) { return S.notes.get(id); }
export function liveNotes() { return allNotes().filter(n => !n.trashedAt && !n.archived); }
export function archivedNotes() { return allNotes().filter(n => !n.trashedAt && n.archived); }
export function trashedNotes() { return allNotes().filter(n => n.trashedAt).sort((a, b) => b.trashedAt - a.trashedAt); }

export function sortNotes(list) {
  return list.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
}

export async function createNote(partial = {}) {
  const now = Date.now();
  const n = normalizeNote({ id: uid(), createdAt: now, updatedAt: now, ...partial });
  S.notes.set(n.id, n);
  await db.put('notes', n);
  markActive();
  emit('notes');
  return n;
}

export async function saveNote(n, { touch = true, silent = false } = {}) {
  if (touch) n.updatedAt = Date.now();
  S.notes.set(n.id, n);
  await db.put('notes', n);
  if (touch) markActive();
  if (!silent) emit('notes');
  return n;
}

export async function patchNotes(ids, patch, { touch = false } = {}) {
  const list = ids.map(id => S.notes.get(id)).filter(Boolean);
  for (const n of list) {
    const p = typeof patch === 'function' ? patch(n) : patch;
    Object.assign(n, p);
    if (touch) n.updatedAt = Date.now();
  }
  await db.putMany('notes', list);
  emit('notes');
  return list;
}

export const trashNotes = ids => patchNotes(ids, { trashedAt: Date.now(), pinned: false });
export const restoreNotes = ids => patchNotes(ids, { trashedAt: null });
export const archiveNotes = (ids, v = true) => patchNotes(ids, v ? { archived: true, pinned: false } : { archived: false });

export async function deleteForever(ids) {
  const atts = [];
  for (const id of ids) {
    const n = S.notes.get(id);
    if (n) atts.push(...noteAttachments(n));
    S.notes.delete(id);
  }
  await db.deleteMany('notes', ids);
  if (atts.length) await deleteAttachments(atts);
  emit('notes');
}

export async function purgeTrash() {
  const limit = Date.now() - 30 * DAY;
  const old = trashedNotes().filter(n => n.trashedAt < limit).map(n => n.id);
  if (old.length) await deleteForever(old);
}

export async function duplicateNote(id) {
  const src = S.notes.get(id);
  if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  delete copy.id;
  copy.title = src.title ? src.title + ' (' + t('salinan') + ')' : '';
  copy.pinned = false; copy.reminder = null;
  // duplicate attachments so deleting one copy does not break the other
  for (const b of copy.blocks) {
    if (b.att) { const blob = await getAttachmentBlob(b.att); if (blob) b.att = await putAttachment(blob); }
    if (b.orig) { const blob = await getAttachmentBlob(b.orig); if (blob) b.orig = await putAttachment(blob); }
  }
  return createNote(copy);
}

export function noteAttachments(n) {
  return (n.blocks || []).flatMap(b => [b.att, b.orig]).filter(Boolean); // orig = foto asli sebelum dipotong
}

// ---------- attachments ----------
const urlCache = new Map();
export async function putAttachment(blob) {
  const id = uid();
  await db.put('attachments', { id, blob, type: blob.type, size: blob.size, createdAt: Date.now() });
  return id;
}
export async function replaceAttachment(id, blob) {
  await db.put('attachments', { id, blob, type: blob.type, size: blob.size, createdAt: Date.now() });
  if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
}
export async function getAttachmentBlob(id) {
  const rec = await db.get('attachments', id);
  return rec ? rec.blob : null;
}
export async function attachmentURL(id) {
  if (!id) return '';
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await getAttachmentBlob(id);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}
export async function deleteAttachments(ids) {
  for (const id of ids) { if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); } }
  await db.deleteMany('attachments', ids);
}
export async function allAttachments() { return db.getAll('attachments'); }

// ---------- templates ----------
export function templates() { return [...S.templates.values()].sort((a, b) => a.createdAt - b.createdAt); }
export async function saveTemplate(t) {
  const nt = { createdAt: Date.now(), ...t, id: t.id || uid() };
  S.templates.set(nt.id, nt);
  await db.put('templates', nt);
  emit('templates');
  return nt;
}
export async function deleteTemplate(id) { S.templates.delete(id); await db.delete('templates', id); emit('templates'); }

// ---------- text helpers ----------
const textCache = new WeakMap();
const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
export function htmlToText(html) {
  if (!html) return '';
  tmp.innerHTML = html
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/blockquote|\/pre|\/ul|\/ol)[^>]*>/gi, '$&\n')
    .replace(/<(ul|ol|p|div|h\d|blockquote|pre)(\s[^>]*)?>/gi, '\n$&');
  return tmp.textContent.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
export function noteText(n) {
  const c = textCache.get(n);
  if (c && c.at === n.updatedAt && c.len === n.blocks.length) return c.text;
  const parts = [];
  for (const b of n.blocks || []) {
    if (b.t === 'text' || b.t === 'prompt') { if (b.label) parts.push(b.label); parts.push(htmlToText(b.html)); }
    else if (b.t === 'check') parts.push(b.items.map(i => i.text).join('\n'));
    else if (b.caption) parts.push(b.caption);
  }
  const text = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  textCache.set(n, { at: n.updatedAt, len: n.blocks.length, text });
  return text;
}
export function wordCount(n) {
  const t = (n.title + ' ' + noteText(n)).trim();
  return t ? t.split(/\s+/).length : 0;
}
const TAG_RE = /(^|[\s(])#([\p{L}\p{N}_-]{1,40})/gu;
export function hashtags(text) {
  const out = new Set();
  for (const m of (text || '').matchAll(TAG_RE)) out.add(m[2].toLowerCase());
  return [...out];
}
export function noteTags(n) {
  const set = new Set((n.tags || []).map(t => t.toLowerCase()));
  hashtags(noteText(n)).forEach(t => set.add(t));
  return [...set];
}
export function allTags() {
  const counts = new Map();
  for (const n of allNotes()) {
    if (n.trashedAt || isConcealed(n)) continue;
    for (const t of noteTags(n)) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function replaceTagInHtml(html, from, to) {
  const re = new RegExp('(^|[\\s(>\\u00a0]|&nbsp;)#' + from.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '(?![\\p{L}\\p{N}_-])', 'giu');
  return (html || '').replace(re, (m, pre) => to ? pre + '#' + to : pre + from);
}
export async function renameTag(from, to) {
  const raw = (to || '').replace(/^#/, '').trim();
  to = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
  if (raw && !to) return 0; // nama baru tidak valid: jangan sampai tag terhapus
  const changed = [];
  for (const n of allNotes()) {
    if (!noteTags(n).includes(from)) continue;
    n.tags = [...new Set((n.tags || []).map(t => t.toLowerCase() === from ? to : t).filter(Boolean))];
    for (const b of n.blocks) {
      if (b.html) b.html = replaceTagInHtml(b.html, from, to);
      if (b.t === 'check') b.items.forEach(i => { i.text = replaceTagInHtml(i.text, from, to); });
    }
    textCache.delete(n);
    changed.push(n);
  }
  if (changed.length) await db.putMany('notes', changed);
  emit('notes');
  return changed.length;
}
export const deleteTag = tag => renameTag(tag, '');

// ---------- lock ----------
export function isLockedNote(n) {
  if (!n) return false;
  const b = book(n.bookId);
  return !!(n.locked || (b && b.locked));
}
export function isConcealed(n) { return isLockedNote(n) && !session.unlocked; }
export function hasPin() { return !!S.settings.pinHash; }

// ---------- activity ----------
export function dayKey(d = new Date()) {
  const x = new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
function markActive() {
  const k = dayKey();
  const days = S.settings.activeDays || [];
  if (days[days.length - 1] === k || days.includes(k)) return;
  const next = [...days, k].slice(-800);
  setSetting('activeDays', next);
}
export function streak() {
  const set = new Set(S.settings.activeDays || []);
  let d = new Date(); let count = 0;
  if (!set.has(dayKey(d))) d = new Date(Date.now() - DAY);
  while (set.has(dayKey(d))) { count++; d = new Date(d); d.setDate(d.getDate() - 1); }
  return count;
}
export function weekActivity() {
  const set = new Set(S.settings.activeDays || []);
  const out = [];
  for (let i = 6; i >= 0; i--) out.push(set.has(dayKey(new Date(Date.now() - i * DAY))));
  return out;
}

// ---------- journal ----------
export function journalFor(key) {
  return allNotes().find(n => n.type === 'journal' && n.journalDate === key && !n.trashedAt);
}

// ---------- reminders ----------
export function nextOccurrence(r, from = Date.now()) {
  if (!r || r.repeat === 'none' || !r.repeat) return null;
  let t = new Date(r.at);
  const step = () => {
    if (r.repeat === 'daily') t.setDate(t.getDate() + 1);
    else if (r.repeat === 'weekly') {
      const days = (r.days && r.days.length) ? r.days : [t.getDay()];
      do { t.setDate(t.getDate() + 1); } while (!days.includes(t.getDay()));
    } else if (r.repeat === 'monthly') {
      const dom = r.dom || new Date(r.at).getDate();
      t.setDate(1); t.setMonth(t.getMonth() + 1);
      t.setDate(Math.min(dom, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
    }
  };
  step();
  let guard = 0;
  while (t.getTime() <= from && guard++ < 1000) step();
  return t.getTime();
}
export function reminders() {
  return allNotes().filter(n => n.reminder && !n.trashedAt);
}

// ---------- backup ----------
export async function exportData({ media = true } = {}) {
  const atts = [];
  if (media) {
    const all = await allAttachments();
    for (const a of all) atts.push({ id: a.id, type: a.type, data: await blobToBase64(a.blob) });
  }
  const keep = ['theme', 'accent', 'fontSize', 'lang', 'view', 'activeDays'];
  const st = {}; keep.forEach(k => { st[k] = S.settings[k]; });
  return {
    app: 'lembar', version: 1, exportedAt: Date.now(),
    notes: allNotes(), books: books(), templates: templates(), settings: st, attachments: atts,
  };
}

export async function importData(data, mode = 'merge', onProgress = () => {}) {
  if (!data || data.app !== 'lembar' || !Array.isArray(data.notes)) throw new Error('bad-file');
  // 1) urai semua lampiran dulu: file rusak berhenti di sini sebelum data lama disentuh
  const fileAtts = (data.attachments || []).map(a => ({ id: a.id, type: a.type, blob: base64ToBlob(a.data, a.type) }));
  const wasEmpty = S.notes.size === 0;
  let done = 0, total = 1; const tick = () => onProgress(++done, total);
  const incoming = data.notes.map(normalizeNote);
  // 2) tentukan catatan mana yang ditambah / diperbarui
  let added = 0, updated = 0;
  const changed = [];
  if (mode === 'replace') { changed.push(...incoming); added = incoming.length; }
  else for (const n of incoming) {
    const cur = S.notes.get(n.id);
    if (!cur) { added++; changed.push(n); } else if (n.updatedAt > cur.updatedAt) { updated++; changed.push(n); }
  }
  total = Math.max(1, changed.length + fileAtts.length);
  const changedAtts = new Set(changed.flatMap(noteAttachments));
  const existingAtts = new Set((await allAttachments()).map(a => a.id));
  // 3) tulis lampiran: yang belum ada, atau milik catatan yang ikut dipulihkan
  for (const a of fileAtts) {
    if (!existingAtts.has(a.id) || changedAtts.has(a.id)) {
      await db.put('attachments', { id: a.id, blob: a.blob, type: a.type, size: a.blob.size, createdAt: Date.now() });
      if (urlCache.has(a.id)) { URL.revokeObjectURL(urlCache.get(a.id)); urlCache.delete(a.id); }
    }
    tick();
  }
  // 4) ganti semua: hapus data lama, tapi lampiran yang masih dipakai catatan pulihan tetap disimpan
  if (mode === 'replace') {
    await db.clear('notes'); await db.clear('books'); await db.clear('templates');
    const keepAtt = new Set([...changedAtts, ...fileAtts.map(a => a.id)]);
    const drop = [...existingAtts].filter(id => !keepAtt.has(id));
    if (drop.length) await deleteAttachments(drop);
    S.notes.clear(); S.books.clear(); S.templates.clear();
  }
  for (const b of data.books || []) { if (mode === 'replace' || !S.books.has(b.id)) S.books.set(b.id, b); }
  await db.putMany('books', [...S.books.values()]);
  for (const t of data.templates || []) { if (mode === 'replace' || !S.templates.has(t.id)) S.templates.set(t.id, t); }
  await db.putMany('templates', [...S.templates.values()]);
  for (const n of changed) { S.notes.set(n.id, n); textCache.delete(n); tick(); }
  if (changed.length) await db.putMany('notes', changed);
  const st = data.settings || {};
  if (st.activeDays) {
    const merged = [...new Set([...(mode === 'replace' ? [] : (S.settings.activeDays || [])), ...st.activeDays])].sort();
    await setSetting('activeDays', merged);
  }
  // tampilan ikut dipulihkan saat mengganti semua, atau saat HP ini masih kosong
  if (mode === 'replace' || wasEmpty) {
    for (const k of ['theme', 'accent', 'fontSize', 'lang', 'view']) if (st[k] != null) await setSetting(k, st[k]);
  }
  emit('notes'); emit('books'); emit('templates');
  return { added, updated };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
export function base64ToBlob(b64, type) {
  const bin = atob(b64 || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: type || 'application/octet-stream' });
}

export function isReady() { return S.ready; }
