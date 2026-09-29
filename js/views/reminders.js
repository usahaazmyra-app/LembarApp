// Lembar · Daftar pengingat
import * as store from '../store.js';
import { h, clear, snack } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtTime, fmtWhen, fmtRelative } from '../i18n.js';
import { header, noteTitle, emptyState } from '../components.js';
import { openNote } from '../collection.js';
import { ensureNotifyPermission, markDone } from '../lib/reminders.js';

const REP = { daily: 'Setiap hari', weekly: 'Setiap minggu', monthly: 'Setiap bulan' };

export function render(view, args, ctx) {
  let tab = 'up';
  view.appendChild(header(t('Pengingat'), { backTo: 'books' }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));

  const row = (n) => {
    const r = n.reminder;
    const b = store.book(n.bookId);
    const sub = [r.repeat && r.repeat !== 'none' ? t(REP[r.repeat]) : null, b ? b.name : null].filter(Boolean).join(' · ');
    const tg = h('button', { class: 'tg' + (r.paused ? '' : ' on'), type: 'button', role: 'switch', 'aria-checked': r.paused ? 'false' : 'true', 'aria-label': t('Aktifkan {n}', { n: noteTitle(n) }) });
    tg.addEventListener('click', async e => { e.stopPropagation(); r.paused = !r.paused; await store.saveNote(n, { touch: false }); snack(r.paused ? t('Pengingat dijeda') : t('Pengingat aktif')); });
    const el = h('div', { class: 'row', style: 'cursor:pointer' },
      h('span', { style: 'min-width:62px;white-space:nowrap;flex-shrink:0;font-family:var(--serif);font-size:1.15rem;font-weight:600' + (r.paused ? ';opacity:.45' : '') }, fmtTime(r.at)),
      h('div', { class: 'grow' }, h('b', { style: 'display:block;font-size:.9rem' }, noteTitle(n)), h('span', { class: 'sub' }, fmtWhen(r.at) + (sub ? ' · ' + sub : ''))),
      tg);
    el.addEventListener('click', () => openNote(n, ctx));
    return el;
  };
  const doneRow = (n) => {
    const el = h('div', { class: 'row', style: 'cursor:pointer' },
      h('span', { class: 'tico k2' }, icon('tick', 's')),
      h('div', { class: 'grow' }, h('b', { class: 'done', style: 'display:block;font-size:.9rem' }, noteTitle(n)), h('span', { class: 'sub' }, t('Selesai {w}', { w: fmtRelative(n.reminder.doneAt || n.updatedAt) }))));
    el.addEventListener('click', () => openNote(n, ctx));
    return el;
  };

  const draw = () => {
    clear(body);
    body.appendChild(h('div', { class: 'seg' }, [['up', t('Mendatang')], ['done', t('Selesai')]].map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'on' : '', onClick: () => { tab = k; draw(); } }, l))));
    const all = store.reminders();
    if (tab === 'up') {
      const list = all.filter(n => !n.reminder.done).sort((a, b) => a.reminder.at - b.reminder.at);
      if (!list.length) { body.appendChild(emptyState('bell', t('Belum ada pengingat'), t('Buka catatan, ketuk menu ⋯, lalu Pengingat.'))); }
      const now = Date.now();
      const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
      const endWeek = endToday.getTime() + 6 * store.DAY;
      const groups = [
        [t('Terlewat'), list.filter(n => n.reminder.at < now)],
        [t('Hari ini'), list.filter(n => n.reminder.at >= now && n.reminder.at <= endToday.getTime())],
        [t('Minggu ini'), list.filter(n => n.reminder.at > endToday.getTime() && n.reminder.at <= endWeek)],
        [t('Nanti'), list.filter(n => n.reminder.at > endWeek)],
      ];
      for (const [label, items] of groups) {
        if (!items.length) continue;
        body.append(h('span', { class: 'lbl', style: label === t('Terlewat') ? 'color:var(--danger)' : '' }, label),
          h('div', { class: 'group' }, items.map(n => label === t('Terlewat') ? h('div', {}, row(n), h('div', { class: 'row-flex', style: 'padding:0 0 10px 74px' }, h('button', { class: 'btn g sm', type: 'button', onClick: async () => { await markDone(n); snack(t('Pengingat selesai')); } }, icon('tick', 's'), t('Tandai selesai')))) : row(n))));
      }
      const perm = 'Notification' in window ? Notification.permission : 'unsupported';
      if (perm === 'default' || perm === 'denied') body.appendChild(h('div', { class: 'notice k1' }, icon('bell', 's'),
        h('div', { class: 'grow' }, perm === 'denied' ? t('Notifikasi diblokir. Aktifkan izin notifikasi untuk Lembar di pengaturan HP.') : t('Izinkan notifikasi supaya pengingat bisa muncul di layar HP.'),
          perm === 'default' ? h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn p sm', type: 'button', onClick: async () => { await ensureNotifyPermission(); draw(); } }, t('Izinkan notifikasi'))) : null)));
      body.appendChild(h('p', { class: 'small muted', style: 'margin:0;display:flex;gap:8px' }, icon('info', 's'),
        t('Pengingat dijadwalkan di HP dan berjalan tanpa internet. Selama Lembar terbuka atau berjalan di latar, pengingat berbunyi tepat waktu. Kalau aplikasi ditutup penuh, pengingat yang terlewat langsung muncul saat Lembar dibuka lagi.')));
    } else {
      const list = all.filter(n => n.reminder.done).sort((a, b) => (b.reminder.doneAt || 0) - (a.reminder.doneAt || 0));
      if (!list.length) body.appendChild(emptyState('tick', t('Belum ada pengingat selesai'), null));
      else body.appendChild(h('div', { class: 'group' }, list.slice(0, 50).map(doneRow)));
    }
  };
  draw();
  ctx.watch(['notes'], draw);
}
