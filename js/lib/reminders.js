// Lembar · penjadwal pengingat (lokal, tanpa internet)
import * as store from '../store.js';
import { h, dialog, snack, vibrate } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtWhen } from '../i18n.js';
import { noteTitle, checkStats } from '../components.js';

const shown = new Set();
const queue = [];
let showing = false;
let started = false;

export function startReminders() {
  if (started) return; started = true;
  check();
  setInterval(check, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}

export async function ensureNotifyPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') { try { return await Notification.requestPermission(); } catch (e) { return 'denied'; } }
  return Notification.permission;
}

async function notify(n, at) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const body = store.isConcealed(n) ? t('Catatan terkunci') : (store.noteText(n).replace(/\s+/g, ' ').slice(0, 120) || fmtWhen(at));
  const opts = { body, tag: 'lembar-' + n.id, renotify: true, icon: './icons/icon-192.png', badge: './icons/maskable-192.png', data: { id: n.id }, vibrate: [120, 60, 120], requireInteraction: true };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(noteTitle(n), opts);
    else new Notification(noteTitle(n), opts);
  } catch (e) { /* noop */ }
}

async function check() {
  if (!store.isReady()) return;
  const now = Date.now();
  for (const n of store.reminders()) {
    const r = n.reminder;
    if (!r || r.done || r.paused || r.at > now) continue;
    const at = r.at;
    const repeating = r.repeat && r.repeat !== 'none';
    if (repeating) {
      // pengingat berulang langsung dijadwalkan ke kejadian berikutnya,
      // jadi tetap berbunyi walau dialognya ditutup tanpa memilih apa pun
      if (r.repeat === 'monthly' && !r.dom) {
        const ref = new Date(r.resume || at);
        const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
        r.dom = ref.getDate() === lastDay ? 31 : ref.getDate(); // akhir bulan tetap akhir bulan
      }
      r.at = r.resume && r.resume > now ? r.resume : store.nextOccurrence({ ...r, at: r.resume || at }, now);
      delete r.resume; r.fired = false;
      await store.saveNote(n, { touch: false });
      notify(n, at);
    } else if (!r.fired) { r.fired = true; await store.saveNote(n, { touch: false }); notify(n, at); }
    const key = n.id + ':' + at;
    if (!shown.has(key)) { shown.add(key); queue.push({ id: n.id, at }); }
  }
  pump();
}

function pump() {
  if (showing || !queue.length || document.hidden) return;
  const q = queue.shift();
  const n = store.note(q.id);
  if (!n || !n.reminder || n.reminder.done || n.trashedAt) return pump();
  showing = true;
  ring(n, q.at).finally(() => { showing = false; setTimeout(pump, 300); });
}

export async function markDone(n) {
  const r = n.reminder;
  if (!r) return;
  if (r.repeat && r.repeat !== 'none') {
    // kejadian berikutnya sudah dijadwalkan saat berbunyi; batalkan tunda bila ada
    if (r.resume) { r.at = r.resume; delete r.resume; }
    if (r.at <= Date.now()) r.at = store.nextOccurrence(r);
    r.fired = false;
  } else { r.done = true; r.doneAt = Date.now(); r.fired = false; }
  await store.saveNote(n, { touch: false });
}
export async function snooze(n, ms) {
  const r = n.reminder;
  if (!r) return;
  // untuk pengingat berulang, simpan jadwal berikutnya agar seri tidak hilang
  if (r.repeat && r.repeat !== 'none' && !r.resume) r.resume = r.at;
  r.at = typeof ms === 'number' ? Date.now() + ms : ms();
  r.fired = false;
  await store.saveNote(n, { touch: false });
}

function ring(n, at = n.reminder.at) {
  vibrate([200, 80, 200]);
  return new Promise(resolve => {
    const late = Date.now() - at > 5 * 60000;
    const concealed = store.isConcealed(n);
    const preview = [];
    if (!concealed) {
      for (const b of n.blocks) if (b.t === 'check') for (const it of b.items) if (it.text && preview.length < 4) preview.push(h('span', { class: it.done ? 'done' : '' }, h('i', { class: 'mcb' + (it.done ? ' on' : '') }, it.done ? icon('tick') : null), it.text));
      if (!preview.length) { const txt = store.noteText(n).slice(0, 160); if (txt) preview.push(h('span', {}, txt)); }
    }
    const tomorrow8 = () => { const d = new Date(Date.now() + 86400000); d.setHours(8, 0, 0, 0); return d.getTime(); };
    const st = checkStats(n);
    let d;
    const snoozeBtn = (label, ms) => h('button', { class: 'btn g sm', type: 'button', style: 'flex:1', onClick: async () => { await snooze(n, ms); d.close(); snack(t('Diingatkan lagi {w}', { w: fmtWhen(n.reminder.at) })); resolve(); } }, label);
    d = dialog({
      title: noteTitle(n), icon: 'bell',
      message: (late ? t('Terlewat · ') : '') + fmtWhen(at) + (n.reminder.repeat && n.reminder.repeat !== 'none' ? ' · ' + t('berulang') : ''),
      content: h('div', { class: 'stack', style: 'gap:12px' },
        preview.length ? h('div', { class: 'mini', style: 'font-size:.9rem' }, preview) : null,
        st.total ? h('span', { class: 'meta' }, t('{d} dari {n} selesai', { d: st.done, n: st.total })) : null,
        h('span', { class: 'lbl' }, t('Tunda')),
        h('div', { class: 'row-flex' }, snoozeBtn(t('10 menit'), 600000), snoozeBtn(t('1 jam'), 3600000), snoozeBtn(t('Besok'), tomorrow8))),
      actions: [
        { label: t('Tandai selesai'), cls: 'g', onClick: async () => { await markDone(n); snack(t('Pengingat selesai')); resolve(); } },
        { label: t('Buka catatan'), cls: 'p', onClick: async () => { await markDone(n); resolve(); const { navigate } = await import('../app.js'); setTimeout(() => navigate('note/' + n.id), 250); } },
      ],
    });
    const obs = new MutationObserver(() => { if (!d.node.isConnected) { obs.disconnect(); resolve(); } });
    obs.observe(document.getElementById('overlays'), { childList: true, subtree: true });
  });
}

export function previewRing(n) { return ring(n); }
