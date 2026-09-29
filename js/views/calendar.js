// Lembar · Kalender jurnal
import * as store from '../store.js';
import { h, clear, iconBtn } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtMonth, fmtDayYear, fmtWeekdayShort } from '../i18n.js';
import { MOODS, noteRow, noteTitle } from '../components.js';
import { openNote } from '../collection.js';

export function render(view, args, ctx) {
  const today = new Date();
  let ym = { y: today.getFullYear(), m: today.getMonth() };
  let sel = store.dayKey(today);
  const body = h('div', { class: 'wrap stack pad-nav', style: 'gap:12px' });
  const hero = h('div', { class: 'hero', style: 'align-items:center' },
    h('div', { class: 'grow' }, h('h1', { class: 'title' }, t('Kalender'))),
    iconBtn('back', t('Bulan sebelumnya'), () => shift(-1), 'soft'),
    iconBtn('right', t('Bulan berikutnya'), () => shift(1), 'soft'));
  view.appendChild(h('div', { class: 'scroll' }, hero, body));
  const shift = d => { ym.m += d; if (ym.m < 0) { ym.m = 11; ym.y--; } if (ym.m > 11) { ym.m = 0; ym.y++; } draw(); };

  // swipe kiri/kanan untuk ganti bulan
  let sx = null;
  body.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  body.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 70 && e.target.closest('.cal')) shift(dx < 0 ? 1 : -1); });

  function dayInfo() {
    const map = new Map();
    for (const n of store.allNotes()) {
      if (n.trashedAt) continue;
      const k = n.type === 'journal' && n.journalDate ? n.journalDate : store.dayKey(n.createdAt);
      if (!map.has(k)) map.set(k, { journal: null, notes: [] });
      const e = map.get(k);
      if (n.type === 'journal') e.journal = n; else e.notes.push(n);
    }
    return map;
  }

  function draw() {
    clear(body);
    const info = dayInfo();
    const first = new Date(ym.y, ym.m, 1);
    const lead = (first.getDay() + 6) % 7; // Senin = 0
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    const todayKey = store.dayKey(today);
    const stk = store.streak();
    const grid = h('div', { class: 'cal', role: 'grid', 'aria-label': fmtMonth(first) });
    [1, 2, 3, 4, 5, 6, 0].forEach(d => grid.appendChild(h('span', { class: 'wd', 'aria-hidden': 'true' }, fmtWeekdayShort(d).replace('.', ''))));
    for (let i = 0; i < lead; i++) grid.appendChild(h('span', { class: 'day blank' }));
    let journalDays = 0;
    for (let d = 1; d <= days; d++) {
      const key = store.dayKey(new Date(ym.y, ym.m, d));
      const e = info.get(key);
      const mood = e && e.journal && e.journal.mood != null ? MOODS[e.journal.mood].c : null;
      if (e && e.journal) journalDays++;
      const dot = mood ? h('i', { style: `background:${mood}` }) : e && e.journal ? h('i', { style: 'background:var(--muted)' }) : e && e.notes.length ? h('i', { style: 'border:1.5px solid var(--muted);width:6px;height:6px' }) : h('i', { style: 'background:transparent' });
      const future = key > todayKey;
      const b = h('button', { type: 'button', class: 'day' + (key === sel ? ' sel' : '') + (key === todayKey ? ' today' : '') + (future ? ' future' : ''), 'aria-label': fmtDayYear(new Date(ym.y, ym.m, d)) + (e && e.journal ? ', ' + t('ada jurnal') : ''), 'aria-pressed': key === sel ? 'true' : 'false', onClick: () => { sel = key; draw(); } }, d, dot);
      grid.appendChild(b);
    }
    body.append(
      h('div', { class: 'sechead' }, h('span', { class: 'h2' }, fmtMonth(first)), h('span', { class: 'meta' }, icon('pen', 'xs'), t('Streak {n} hari', { n: stk }))),
      grid,
      h('div', { class: 'legend', 'aria-label': t('Arti warna mood') }, MOODS.map(m => h('span', {}, h('b', { style: `background:${m.c}` }), t(m.n)))),
      h('div', { class: 'meta' }, t('{n} hari menulis jurnal bulan ini', { n: journalDays })),
      dayPanel(info.get(sel), sel, todayKey));
  }

  function dayPanel(e, key, todayKey) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const panel = h('div', { style: 'border-radius:18px;background:var(--k2);padding:14px;display:flex;flex-direction:column;gap:10px' });
    const j = e && e.journal;
    panel.appendChild(h('div', { class: 'sechead' }, h('b', {}, fmtDayYear(date) + (key === todayKey ? ' · ' + t('Hari ini') : '')),
      j && j.mood != null ? h('span', { class: 'tagpill', style: 'background:var(--surface)' }, t(MOODS[j.mood].n)) : null));
    if (j) {
      const txt = store.isConcealed(j) ? t('Terkunci') : store.noteText(j).replace(/\s+/g, ' ').trim().slice(0, 220);
      panel.appendChild(h('button', { class: 'card', type: 'button', style: 'margin:0', onClick: () => openNote(j, ctx) }, h('h4', {}, key === todayKey ? t('Jurnal hari ini') : noteTitle(j)), h('p', {}, txt || t('Belum ada isi. Ketuk untuk menulis.'))));
    } else if (key <= todayKey) {
      panel.appendChild(h('button', { class: 'btn p', type: 'button', onClick: () => ctx.navigate('journal/' + key) }, icon('pen', 's'), key === todayKey ? t('Tulis jurnal hari ini') : t('Tulis jurnal untuk hari ini')));
    } else panel.appendChild(h('p', { class: 'small', style: 'margin:0;color:var(--ink2)' }, t('Tanggal ini belum tiba.')));
    const notes = e ? e.notes : [];
    if (notes.length) {
      panel.appendChild(h('span', { class: 'lbl', style: 'color:var(--ink2)' }, t('Catatan dibuat di tanggal ini ({n})', { n: notes.length })));
      notes.slice(0, 6).forEach(n => { const r = noteRow(n, { tags: false }); r.addEventListener('click', () => openNote(n, ctx)); panel.appendChild(r); });
    }
    return panel;
  }

  draw();
  ctx.watch(['notes'], draw);
}
