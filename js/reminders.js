// Penjadwal pengingat. Berjalan selama aplikasi terbuka; memakai Notification Triggers bila didukung.
import { S, live, patchNote, noteById } from './store.js';
import { t, locale } from './i18n.js';
import { fmtTime } from './ui.js';

const DAY = 864e5;

export function nextAt(rem, after = Date.now()) {
  if (!rem) return null;
  const base = new Date(rem.at);
  if (rem.repeat === 'none' || !rem.repeat) return rem.at;
  let d = new Date(base);
  const guard = 800;
  for (let i = 0; i < guard && d.getTime() <= after; i++) {
    if (rem.repeat === 'daily') d = new Date(d.getTime() + DAY);
    else if (rem.repeat === 'weekly') {
      const days = rem.days && rem.days.length ? rem.days : [base.getDay()];
      d = new Date(d.getTime() + DAY);
      let tries = 0;
      while (!days.includes(d.getDay()) && tries++ < 7) d = new Date(d.getTime() + DAY);
    } else if (rem.repeat === 'monthly') {
      d = new Date(d); d.setMonth(d.getMonth() + 1);
    } else break;
  }
  return d.getTime();
}

export function describe(rem) {
  if (!rem) return '';
  const d = new Date(rem.at);
  const date = d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  const rep = { daily: t('Setiap hari'), weekly: t('Setiap minggu'), monthly: t('Setiap bulan') }[rem.repeat];
  return date + ', ' + fmtTime(rem.at) + (rep ? ' · ' + rep : '');
}

export async function ensurePermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
  }
  return Notification.permission;
}

async function reg() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.ready; } catch (e) { return null; }
}

// Jadwalkan notifikasi sistem ke depan bila browser mendukung pemicu waktu
export async function schedule(note) {
  if (!note || !note.reminder || note.reminder.done) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!('showTrigger' in Notification.prototype) || typeof TimestampTrigger === 'undefined') return;
  const r = await reg();
  if (!r) return;
  try {
    await r.showNotification(note.title || t('Pengingat Lembar'), {
      body: t('Pengingat untuk catatanmu'), tag: 'rem-' + note.id, data: { noteId: note.id },
      icon: 'icons/icon-192.png', badge: 'icons/maskable-192.png',
      showTrigger: new TimestampTrigger(note.reminder.at)
    });
  } catch (e) { /* tidak didukung */ }
}

async function notify(note) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const r = await reg();
  const opts = { body: describe(note.reminder), tag: 'rem-' + note.id, data: { noteId: note.id }, icon: 'icons/icon-192.png', badge: 'icons/maskable-192.png', requireInteraction: true };
  try {
    if (r) await r.showNotification(note.title || t('Pengingat Lembar'), opts);
    else new Notification(note.title || t('Pengingat Lembar'), opts);
  } catch (e) { /* abaikan */ }
}

let ringing = false;
export async function checkDue() {
  const now = Date.now();
  const due = live().filter((n) => n.reminder && !n.reminder.done && n.reminder.at <= now && (n.reminder.firedAt || 0) < n.reminder.at);
  for (const n of due) {
    const rem = { ...n.reminder, firedAt: n.reminder.at };
    await patchNote(n.id, { reminder: rem });
    if (document.hidden) await notify(noteById(n.id));
    if (!document.hidden && !ringing) {
      ringing = true;
      const m = await import('./views/reminders.js');
      m.showRing(n.id, () => { ringing = false; });
    }
  }
}

export async function snooze(id, ms) {
  const n = noteById(id);
  if (!n || !n.reminder) return;
  const rem = { ...n.reminder, at: Date.now() + ms, firedAt: 0, snoozedFrom: n.reminder.snoozedFrom || n.reminder.at };
  const m = await patchNote(id, { reminder: rem });
  schedule(m);
}

export async function markDone(id) {
  const n = noteById(id);
  if (!n || !n.reminder) return;
  let rem;
  if (!n.reminder.repeat || n.reminder.repeat === 'none') rem = { ...n.reminder, done: true, doneAt: Date.now() };
  else {
    const base = { ...n.reminder, at: n.reminder.snoozedFrom || n.reminder.at };
    rem = { ...n.reminder, at: nextAt(base, Date.now()), firedAt: 0, snoozedFrom: null, lastDoneAt: Date.now() };
  }
  const m = await patchNote(id, { reminder: rem });
  schedule(m);
}

// Setelah berbunyi, pengingat berulang otomatis maju ke jadwal berikutnya
export async function rollRepeats() {
  const now = Date.now();
  for (const n of live().filter((x) => x.reminder && !x.reminder.done && x.reminder.repeat && x.reminder.repeat !== 'none' && x.reminder.firedAt >= x.reminder.at && x.reminder.at < now - 60000)) {
    const base = { ...n.reminder, at: n.reminder.snoozedFrom || n.reminder.at };
    await patchNote(n.id, { reminder: { ...n.reminder, at: nextAt(base, now), firedAt: 0, snoozedFrom: null } });
  }
}

export function startReminders() {
  const tick = () => { checkDue().then(rollRepeats).catch(() => {}); };
  tick();
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

export const upcomingCount = () => S.notes.filter((n) => !n.deletedAt && n.reminder && !n.reminder.done).length;
