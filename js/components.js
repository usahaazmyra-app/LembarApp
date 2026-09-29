// Lembar · komponen bersama: kartu catatan, baris, header
import * as store from './store.js';
import { h, iconBtn } from './ui.js';
import { icon, TYPE_ICON } from './icons.js';
import { t, fmtRelative, fmtDur, fmtWhen } from './i18n.js';

export const MOODS = [
  { n: 'Buruk', c: '#B3261E', mouth: 'M8 16.5c2.5-2.5 5.5-2.5 8 0' },
  { n: 'Lesu', c: '#C9692C', mouth: 'M8.5 15.5c2-1.2 5-1.2 7 0' },
  { n: 'Biasa', c: '#A8902F', mouth: 'M8.5 15h7' },
  { n: 'Senang', c: '#3F8A63', mouth: 'M8.5 14.5c2 1.8 5 1.8 7 0' },
  { n: 'Luar biasa', c: '#2F6F62', mouth: 'M8 14c2.5 3 5.5 3 8 0' },
];
export function moodFace(i, size = 26) {
  const m = MOODS[i];
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><path d="${m.mouth}"/></g>`;
  return s;
}

export function header(title, { back, backTo = 'home', actions = [], cls = '' } = {}, ctx) {
  return h('div', { class: 'hdr ' + cls },
    back !== false ? iconBtn('back', t('Kembali'), () => (typeof back === 'function' ? back() : ctx.back(backTo))) : null,
    h('h1', { class: 'h2' }, title),
    ...actions);
}

export function checkStats(n) {
  let total = 0, done = 0;
  for (const b of n.blocks) if (b.t === 'check') for (const it of b.items) { if (!it.text && !it.done) continue; total++; if (it.done) done++; }
  return { total, done };
}

function firstMedia(n) {
  return n.blocks.find(b => (b.t === 'image' || b.t === 'sketch') && b.att);
}
function snippet(n, len = 180) {
  const txt = store.noteText(n).replace(/\s+/g, ' ').trim();
  return txt.length > len ? txt.slice(0, len) + '…' : txt;
}
export function noteTitle(n) {
  if (n.title && n.title.trim()) return n.title.trim();
  const first = store.noteText(n).split('\n').find(l => l.trim());
  if (first) return first.trim().slice(0, 60);
  return t('Tanpa judul');
}

function metaTop(n) {
  const bits = [];
  if (n.pinned) bits.push(h('span', { class: 'meta' }, icon('pin', 'xs'), t('Tersemat')));
  if (n.type === 'journal' && n.mood != null) bits.push(h('span', { class: 'meta' }, icon('journal', 'xs'), t('Jurnal') + ' · ' + t(MOODS[n.mood].n)));
  else if (n.type === 'journal') bits.push(h('span', { class: 'meta' }, icon('journal', 'xs'), t('Jurnal')));
  const audio = n.blocks.find(b => b.t === 'audio');
  if (audio && !n.pinned) bits.push(h('span', { class: 'meta' }, icon('mic', 'xs'), t('Suara') + ' · ' + fmtDur(audio.dur)));
  if (store.isLockedNote(n)) bits.push(h('span', { class: 'meta' }, icon('lock', 'xs'), t('Terkunci')));
  const right = n.reminder && !n.reminder.done ? icon('bell', 'xs') : null;
  if (!bits.length && !right) return null;
  return h('div', { class: 'meta', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('span', { class: 'meta' }, bits), right ? h('span', { class: 'meta', title: fmtWhen(n.reminder.at) }, right) : null);
}

function mediaThumb(b, cls = 'thumb') {
  const img = h('img', { class: cls, alt: '', loading: 'lazy', decoding: 'async' });
  if (b.w && b.h) img.style.aspectRatio = `${b.w} / ${b.h}`;
  store.attachmentURL(b.att).then(u => { if (u) img.src = u; });
  if (b.t === 'sketch') img.style.background = '#fff';
  return img;
}

function miniChecklist(n) {
  const items = [];
  for (const b of n.blocks) if (b.t === 'check') for (const it of b.items) if (it.text) items.push(it);
  if (!items.length) return null;
  const show = items.filter(i => !i.done).slice(0, 3);
  const doneShow = show.length < 3 ? items.filter(i => i.done).slice(0, 3 - show.length) : [];
  const { total, done } = checkStats(n);
  return [
    h('div', { class: 'mini' }, [...show, ...doneShow].map(it => h('span', { class: it.done ? 'done' : '' },
      h('i', { class: 'mcb' + (it.done ? ' on' : '') }, it.done ? icon('tick') : null), it.text))),
    h('div', { class: 'prog' }, h('i', { style: `width:${total ? Math.round(done / total * 100) : 0}%` })),
    h('div', { class: 'meta' }, t('{d} dari {n} selesai', { d: done, n: total })),
  ];
}

export function miniWave(peaks = [], count = 22, cls = '') {
  const arr = peaks.length ? resample(peaks, count) : Array.from({ length: count }, (_, i) => 0.3 + 0.6 * Math.abs(Math.sin(i * 1.7)));
  return h('div', { class: 'wave ' + cls }, arr.map(v => h('i', { style: `height:${Math.max(3, Math.round(v * 26))}px` })));
}
export function resample(arr, n) {
  if (!arr.length) return Array(n).fill(0.1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * arr.length / n), b = Math.max(a + 1, Math.floor((i + 1) * arr.length / n));
    let m = 0; for (let j = a; j < b && j < arr.length; j++) m = Math.max(m, arr[j]);
    out.push(m);
  }
  return out;
}

export function noteCard(n, opts = {}) {
  const concealed = store.isConcealed(n);
  const cls = 'card ' + (n.color || '') + (opts.selected ? ' sel' : '');
  const el = h('button', { class: cls, type: 'button', 'data-id': n.id });
  if (opts.selecting) el.appendChild(h('span', { class: opts.selected ? 'tick' : 'untick' }, opts.selected ? icon('tick', 's') : null));
  const mt = metaTop(n); if (mt) el.appendChild(mt);
  if (concealed) {
    el.append(h('h4', {}, noteTitle(n)), h('div', { class: 'ghost', style: 'width:90%' }), h('div', { class: 'ghost', style: 'width:64%' }));
    return el;
  }
  const media = firstMedia(n);
  if (media) el.appendChild(mediaThumb(media));
  el.appendChild(h('h4', {}, noteTitle(n)));
  const cl = miniChecklist(n);
  const audio = n.blocks.find(b => b.t === 'audio');
  if (cl && n.type === 'checklist') el.append(...cl);
  else {
    const sn = snippet(n);
    const title = noteTitle(n);
    if (sn && sn !== title && !sn.startsWith(title + '…')) el.appendChild(h('p', {}, sn.startsWith(title) ? sn.slice(title.length).trim() || sn : sn));
    if (cl) el.append(...cl);
  }
  if (audio) el.appendChild(miniWave(audio.peaks));
  const tags = store.noteTags(n).slice(0, 3);
  if (tags.length) el.appendChild(h('div', { class: 'tags' }, tags.map(tg => h('span', { class: 'tagpill' }, '#' + tg))));
  if (opts.showDate) el.appendChild(h('div', { class: 'meta' }, fmtRelative(n.updatedAt)));
  return el;
}

export function typeTile(n) {
  const bg = n.color || ({ checklist: 'k3', journal: 'k2', voice: 'k7', photo: 'k6', sketch: 'k8' }[n.type] || 'k1');
  return h('span', { class: 'tico ' + bg }, icon(TYPE_ICON[n.type] || 'text'));
}

export function noteRow(n, opts = {}) {
  const concealed = store.isConcealed(n);
  const el = h('button', { class: 'lrow' + (opts.selected ? ' sel' : ''), type: 'button', 'data-id': n.id });
  if (opts.selecting) el.appendChild(h('span', { class: opts.selected ? 'tick' : 'untick' }, opts.selected ? icon('tick', 's') : null));
  let sub;
  if (concealed) sub = t('Terkunci');
  else if (n.type === 'checklist' || (checkStats(n).total && !snippet(n, 80))) { const s = checkStats(n); sub = t('{d} dari {n} selesai', { d: s.done, n: s.total }); }
  else sub = snippet(n, 90) || fmtRelative(n.updatedAt);
  const extra = opts.sub ? opts.sub(n) : null;
  el.append(typeTile(n),
    h('div', { class: 'body-t' }, h('h4', {}, noteTitle(n)), h('p', {}, extra || sub),
      !concealed && opts.tags !== false && store.noteTags(n).length ? h('div', { class: 'tags', style: 'margin-top:6px' }, store.noteTags(n).slice(0, 3).map(tg => h('span', { class: 'tagpill' }, '#' + tg))) : null),
    h('span', { class: 'end' }, n.pinned ? icon('pin', 's') : null, n.reminder && !n.reminder.done ? icon('bell', 's') : null, store.isLockedNote(n) ? icon('lock', 's') : null));
  return el;
}

export function emptyState(ic, title, text, action) {
  return h('div', { class: 'empty' },
    h('span', { class: 'tico', style: 'width:64px;height:64px;border-radius:22px;background:var(--accent-soft);color:var(--accent)' }, icon(ic, 'l')),
    h('b', { style: 'font-size:1.05rem' }, title),
    text ? h('p', { class: 'small muted' }, text) : null,
    action || null);
}

export function bookColorVar(b) { return `var(--${(b && b.color) || 'k8'})`; }
export function bookChip(n, onClick) {
  const b = store.book(n.bookId);
  return h('button', { class: 'bookchip', type: 'button', onClick, 'aria-label': t('Buku') + ': ' + (b ? b.name : t('Tanpa buku')) },
    h('i', { style: `background:${b ? bookColorVar(b) : 'var(--line)'};box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)` }),
    b ? b.name : t('Tanpa buku'), icon('down', 'xs'));
}
