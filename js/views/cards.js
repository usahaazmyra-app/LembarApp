// Kartu & baris catatan yang dipakai di banyak layar.
import { S, isLocked, bookById, urlFor } from '../store.js';
import { t } from '../i18n.js';
import { esc, ic, fmtRel, fmtTime } from '../ui.js';
import { TYPE_ICON, TYPE_NAME, MOODS, dotOf } from '../data.js';
import { describe } from '../reminders.js';

export function noteTitle(n) {
  if (n.title && n.title.trim()) return n.title.trim();
  if (n.type === 'journal' && n.date) return new Date(n.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  if (isLocked(n)) return t('Catatan terkunci');
  const first = (n.text || '').split('\n').find((l) => l.trim()) || (n.items && n.items[0] && n.items[0].text) || '';
  return first.slice(0, 60) || t('Tanpa judul');
}

export function snippet(n, len = 180) {
  if (isLocked(n)) return '';
  let s = (n.text || '').trim();
  if (!n.title || !n.title.trim()) {
    const lines = s.split('\n');
    lines.shift();
    s = lines.join(' ');
  }
  if (n.type === 'journal') s = [n.text, ...(n.gratitude || [])].filter(Boolean).join(' · ');
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > len ? s.slice(0, len) + '…' : s;
}

export function sortNotes(list, { pinnedFirst = true, by = 'updated' } = {}) {
  return list.slice().sort((a, b) => {
    if (pinnedFirst && !!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    if (by === 'title') return noteTitle(a).localeCompare(noteTitle(b));
    if (by === 'created') return b.createdAt - a.createdAt;
    return b.updatedAt - a.updatedAt;
  });
}

const firstAtt = (n, kind) => (n.attachments || []).find((a) => a.kind === kind);

function metaTop(n) {
  const bits = [];
  if (n.pinned) bits.push(`<span class="meta">${ic('pin', 's')}${esc(t('Tersemat'))}</span>`);
  else if (n.type === 'journal' && n.mood != null) bits.push(`<span class="meta">${ic('smile', 's')}${esc(t('Jurnal'))} · ${esc(t(MOODS[n.mood].n))}</span>`);
  else if (n.type === 'voice') { const a = firstAtt(n, 'audio'); bits.push(`<span class="meta">${ic('mic', 's')}${esc(t('Suara'))}${a && a.dur ? ' · ' + fmtDurS(a.dur) : ''}</span>`); }
  else if (n.type !== 'text') bits.push(`<span class="meta">${ic(TYPE_ICON[n.type], 's')}${esc(t(TYPE_NAME[n.type]))}</span>`);
  const right = [];
  if (isLocked(n)) right.push(ic('lock', 's'));
  if (n.reminder && !n.reminder.done) right.push(ic('bell', 's'));
  if (!bits.length && !right.length) return '';
  return `<div class="meta" style="justify-content:space-between">${bits.join('') || '<span></span>'}<span class="meta">${right.join('')}</span></div>`;
}
const fmtDurS = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

function checklistMini(n, max = 3) {
  const items = n.items || [];
  if (!items.length) return '';
  const done = items.filter((i) => i.done).length;
  const show = items.slice().sort((a, b) => a.done - b.done).slice(0, max);
  return `<div class="mini">${show.map((i) => `<span class="${i.done ? 'done' : ''}"><i class="mcb ${i.done ? 'on' : ''}">${i.done ? ic('check', 's') : ''}</i><b>${esc(i.text || '…')}</b></span>`).join('')}</div>
    <div class="prog"><i style="width:${Math.round((done / items.length) * 100)}%"></i></div>
    <div class="meta">${esc(t('{a} dari {b} selesai', { a: done, b: items.length }))}${n.reminder && !n.reminder.done ? ' · ' + esc(fmtTime(n.reminder.at)) : ''}</div>`;
}

function waveHTML(peaks, cls = '') {
  const p = peaks && peaks.length ? peaks : new Array(24).fill(0.3);
  return `<div class="wave">${p.slice(0, 26).map((v) => `<i class="${cls}" style="height:${Math.round(6 + v * 22)}px"></i>`).join('')}</div>`;
}

export function cardHTML(n, { sel = false, selecting = false } = {}) {
  const locked = isLocked(n);
  const img = !locked && (firstAtt(n, 'image') || firstAtt(n, 'sketch'));
  const aud = !locked && firstAtt(n, 'audio');
  const tags = (n.tags || []).slice(0, 3);
  const book = n.bookId && bookById(n.bookId);
  return `<a class="card ${n.color || 'k0'} ${sel ? 'sel' : ''}" href="#/note/${n.id}" data-id="${n.id}">
    ${selecting ? `<span class="tick">${sel ? ic('check', 's') : ''}</span>` : ''}
    ${metaTop(n)}
    ${img ? `<div class="thumb ${img.kind === 'sketch' ? 'sk' : ''}"><img data-att="${img.id}" alt=""></div>` : ''}
    <h4>${esc(noteTitle(n))}</h4>
    ${locked ? '<div class="ghost" style="width:90%"></div><div class="ghost" style="width:62%"></div>' : ''}
    ${!locked && n.items && n.items.length && (n.type === 'checklist' || !n.text) ? checklistMini(n) : ''}
    ${!locked && snippet(n) && !(n.type === 'checklist' && !n.text) ? `<p>${esc(snippet(n))}</p>` : ''}
    ${aud ? waveHTML(aud.peaks) : ''}
    ${tags.length ? `<div class="tags">${tags.map((x) => `<span class="tagpill">#${esc(x)}</span>`).join('')}</div>` : ''}
    ${book && !selecting ? `<div class="meta"><i class="dot-c" style="background:${dotOf(book.color)}"></i>${esc(book.name)}</div>` : ''}
  </a>`;
}

export function rowHTML(n, { sel = false, selecting = false, swipe = true, active = false } = {}) {
  const locked = isLocked(n);
  const items = n.items || [];
  let sub;
  if (locked) sub = t('Terkunci');
  else if (n.type === 'checklist' && items.length) sub = t('{a} dari {b} selesai', { a: items.filter((i) => i.done).length, b: items.length });
  else sub = snippet(n, 120) || fmtRel(n.updatedAt);
  if (n.reminder && !n.reminder.done) sub += ' · ' + describe(n.reminder);
  const row = `<a class="lrow ${sel ? 'sel' : ''}" href="#/note/${n.id}" data-id="${n.id}" ${active ? 'aria-current="true" style="outline:2px solid var(--accent)"' : ''}>
      <span class="tico" style="background:var(--${n.color && n.color !== 'k0' ? n.color : 'k8'})">${ic(locked ? 'lock' : TYPE_ICON[n.type])}</span>
      <div class="body"><h4>${esc(noteTitle(n))}</h4><p>${esc(sub)}</p></div>
      ${n.pinned ? `<span style="color:var(--muted)">${ic('pin', 's')}</span>` : ''}
      ${selecting ? `<span class="tick">${sel ? ic('check', 's') : ''}</span>` : ''}
    </a>`;
  if (!swipe || selecting) return row;
  return `<div class="swipe" data-swipe="${n.id}"><div class="under r">${ic('archive')}${esc(t('Arsipkan'))}</div><div class="under l">${esc(t('Hapus'))}${ic('trash')}</div>${row}</div>`;
}

export function masonry(list, cols, fn) {
  const colsArr = Array.from({ length: cols }, () => ({ h: 0, html: [] }));
  for (const n of list) {
    const est = 90 + Math.min(4, Math.ceil(noteTitle(n).length / 18)) * 22 + (snippet(n).length ? Math.min(5, Math.ceil(snippet(n).length / 30)) * 20 : 0)
      + ((n.attachments || []).some((a) => a.kind === 'image' || a.kind === 'sketch') ? 120 : 0) + (n.items && n.items.length ? 90 : 0) + ((n.tags || []).length ? 24 : 0);
    const c = colsArr.reduce((a, b) => (b.h < a.h ? b : a));
    c.html.push(fn(n));
    c.h += est;
  }
  return `<div class="masonry">${colsArr.map((c) => `<div class="col">${c.html.join('')}</div>`).join('')}</div>`;
}

export async function hydrate(root) {
  for (const img of root.querySelectorAll('img[data-att]')) {
    const u = await urlFor(img.dataset.att);
    if (u) img.src = u; else img.closest('.thumb, .ph') && img.closest('.thumb, .ph').remove();
  }
}

// Geser baris: kanan = arsip, kiri = hapus
export function bindSwipe(root, { onArchive, onDelete }) {
  root.querySelectorAll('[data-swipe]').forEach((wrap) => {
    const row = wrap.querySelector('.lrow');
    const ur = wrap.querySelector('.under.r'), ul = wrap.querySelector('.under.l');
    let sx = 0, sy = 0, dx = 0, active = false, horiz = null;
    row.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; sx = e.clientX; sy = e.clientY; dx = 0; active = true; horiz = null; });
    row.addEventListener('pointermove', (e) => {
      if (!active) return;
      const mx = e.clientX - sx, my = e.clientY - sy;
      if (horiz === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) horiz = Math.abs(mx) > Math.abs(my);
      if (!horiz) return;
      dx = mx;
      row.classList.add('dragging');
      row.style.transform = `translateX(${dx}px)`;
      ur.style.opacity = dx > 0 ? Math.min(1, dx / 90) : 0;
      ul.style.opacity = dx < 0 ? Math.min(1, -dx / 90) : 0;
    });
    const end = () => {
      if (!active) return;
      active = false;
      row.classList.remove('dragging');
      if (horiz && Math.abs(dx) > 96) {
        row.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`;
        const id = wrap.dataset.swipe;
        setTimeout(() => (dx > 0 ? onArchive(id) : onDelete(id)), 180);
      } else {
        row.style.transform = '';
        ur.style.opacity = 0; ul.style.opacity = 0;
      }
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
    row.addEventListener('click', (e) => { if (horiz && Math.abs(dx) > 5) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  });
}
