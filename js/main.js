// Titik awal aplikasi Lembar.
import { S, load, setting, relock, hasPin } from './store.js';
import { persist } from './db.js';
import { start } from './router.js';
import { applyTheme } from './theme.js';
import { snack } from './ui.js';
import { t } from './i18n.js';
import { startReminders } from './reminders.js';

async function boot() {
  try {
    await load();
  } catch (e) {
    document.getElementById('app').innerHTML = `<div style="padding:40px 24px;font-family:system-ui"><h1>Lembar</h1><p>${t('Penyimpanan perangkat tidak bisa dibuka. Pastikan mode penyamaran tidak aktif, lalu muat ulang.')}</p></div>`;
    return;
  }
  applyTheme();
  persist();

  if (!setting('onboarded') && !location.hash.startsWith('#/onboarding')) {
    location.replace('#/onboarding');
  }
  await start();
  startReminders();

  // Kunci ulang setelah aplikasi ditinggalkan lebih dari 1 menit
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 60000 && hasPin()) {
      relock();
      if (setting('appLock')) window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });

  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          snack(t('Versi baru Lembar tersedia'), { action: t('Muat ulang'), timeout: 15000, onAction: () => nw.postMessage('skipWaiting') });
        }
      });
    });
  }).catch(() => { /* tanpa service worker aplikasi tetap berjalan online */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'open' && e.data.hash) location.hash = e.data.hash.replace(/^\.?\/?#?/, '#');
  });
}

boot();
