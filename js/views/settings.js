// Lembar · Pengaturan, Bahasa, Keamanan
import * as store from '../store.js';
import { h, clear, toggle, snack, confirm } from '../ui.js';
import { icon, LOGO_SVG } from '../icons.js';
import { t, LANGS, getLang, fmtRelative, fmtBytes, fmtDay, fmtDayYear, greeting, detectLang, setLang } from '../i18n.js';
import { header } from '../components.js';
import { setupPin, requestUnlock, removePin, bioSupported, bioRegister, bioVerify } from './lock.js';

export const APP_VERSION = '1.0.0';
const ACCENTS = [['terracotta', 'Terakota', '#C24E2E'], ['blue', 'Biru', '#3E6DB5'], ['green', 'Hijau', '#2F6F62'], ['purple', 'Ungu', '#6A55A6'], ['charcoal', 'Arang', '#2B2A28']];

const row = (href, ic, label, val, sub) => h('a', { class: 'row', href }, icon(ic), h('span', { class: 'grow' }, label, sub ? h('span', { class: 'sub' }, sub) : null), val != null ? h('span', { class: 'val' }, val) : null, icon('right', 's'));

export function render(view, args, ctx) {
  view.appendChild(header(t('Pengaturan'), { backTo: 'home' }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  const draw = async () => {
    const s = store.settings();
    clear(body);
    const lang = LANGS.find(l => l.code === getLang());
    body.append(
      h('span', { class: 'lbl' }, t('Umum')),
      h('div', { class: 'group' },
        row('#/language', 'globe', t('Bahasa'), s.followSystemLang ? t('Ikuti HP') : lang.native),
        row('#/help', 'help', t('Bantuan & FAQ')),
        row('#/stats', 'stats', t('Statistik menulis'))),
      h('span', { class: 'lbl' }, t('Tampilan')),
      themeGroup(s),
      h('span', { class: 'lbl' }, t('Keamanan')),
      h('div', { class: 'group' }, row('#/security', 'shield', t('PIN & kunci'), store.hasPin() ? (s.appLock ? t('Aplikasi terkunci') : t('PIN aktif')) : t('Belum diatur'))),
      h('span', { class: 'lbl' }, t('Data')),
      h('div', { class: 'group' },
        row('#/backup', 'download', t('Backup & pulihkan'), null, s.lastBackup ? t('Terakhir: {w}', { w: fmtRelative(s.lastBackup) }) : t('Belum pernah backup')),
        row('#/export', 'print', t('Ekspor PDF / Markdown / Teks')),
        h('div', { class: 'row' }, icon('device'), h('span', { class: 'grow' }, t('Penyimpanan terpakai'), h('span', { class: 'sub storage-sub' }, t('Menghitung…')))),
        h('div', { class: 'row' }, icon('trash'), h('span', { class: 'grow' }, t('Hapus otomatis Sampah')), h('span', { class: 'val' }, t('30 hari')))),
      installRow() || '',
      h('span', { class: 'lbl' }, t('Tentang')),
      h('div', { class: 'group' },
        row('#/onboarding?again=1', 'sparkle', t('Lihat panduan awal')),
        h('div', { class: 'row' }, h('span', { style: 'width:22px;height:22px', html: LOGO_SVG }), h('span', { class: 'grow' }, 'Lembar ' + APP_VERSION, h('span', { class: 'sub' }, t('Semua data tersimpan di perangkat ini. Tanpa akun, tanpa iklan, tanpa pelacakan.'))))),
    );
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      const el = body.querySelector('.storage-sub');
      if (el) el.textContent = t('{u} dipakai', { u: fmtBytes(est.usage || 0) }) + ' · ' + (persisted ? t('penyimpanan permanen aktif') : t('penyimpanan belum permanen'));
    }
  };
  function themeGroup(s) {
    const seg = h('div', { class: 'seg' }, [['light', t('Terang'), 'sun'], ['paper', t('Kertas'), 'file'], ['dark', t('Gelap'), 'moon'], ['system', t('Ikuti HP'), 'device']].map(([k, l]) =>
      h('button', { type: 'button', class: s.theme === k ? 'on' : '', 'aria-pressed': s.theme === k ? 'true' : 'false', onClick: () => store.setSetting('theme', k) }, l)));
    const acc = h('div', { class: 'row-flex', style: 'gap:10px' }, ACCENTS.map(([k, n, c]) => h('button', { class: 'sw' + (s.accent === k ? ' on' : ''), type: 'button', style: `background:${c};width:28px;height:28px`, 'aria-label': t('Aksen {n}', { n: t(n) }), onClick: () => store.setSetting('accent', k) })));
    const fz = s.fontSize ?? 1;
    const stepper = h('div', { class: 'row-flex', style: 'gap:10px' },
      h('button', { class: 'ib soft sm', type: 'button', 'aria-label': t('Perkecil huruf'), disabled: fz <= 0, onClick: () => store.setSetting('fontSize', Math.max(0, fz - 1)) }, h('span', { style: 'font:700 .8rem var(--serif)' }, 'A')),
      h('div', { class: 'prog', style: 'flex:1;height:6px' }, h('i', { style: `width:${Math.round(fz / 3 * 100)}%;background:var(--accent)` })),
      h('button', { class: 'ib soft sm', type: 'button', 'aria-label': t('Perbesar huruf'), disabled: fz >= 3, onClick: () => store.setSetting('fontSize', Math.min(3, fz + 1)) }, h('span', { style: 'font:700 1.15rem var(--serif)' }, 'A')));
    return h('div', { class: 'group', style: 'padding:14px 16px;display:flex;flex-direction:column;gap:14px' },
      seg,
      h('div', { class: 'row-flex' }, h('span', { class: 'grow', style: 'font-size:.9rem;font-weight:600' }, t('Warna aksen')), acc),
      h('div', {}, h('span', { style: 'font-size:.9rem;font-weight:600' }, t('Ukuran huruf')), h('div', { style: 'padding:10px 0' }, stepper),
        h('p', { style: 'margin:0;font-family:var(--serif);font-size:1rem;line-height:1.5;color:var(--ink2)' }, t('Pratinjau: tulisan catatanmu akan terlihat seperti ini.'))));
  }
  function installRow() {
    const upd = window.__lembarUpdate;
    const updRow = upd ? h('div', { class: 'group' }, h('button', { class: 'row', type: 'button', onClick: () => upd.postMessage('skipWaiting') },
      icon('refresh'), h('span', { class: 'grow' }, t('Versi baru Lembar tersedia'), h('span', { class: 'sub' }, t('Ketuk untuk memuat ulang dan memakai versi terbaru'))), icon('right', 's'))) : null;
    const ev = window.__lembarInstall;
    if (!ev) return updRow;
    return h('div', { class: 'stack' }, updRow, h('div', { class: 'group' }, h('button', { class: 'row', type: 'button', onClick: async () => { window.__lembarInstall = null; try { ev.prompt(); await ev.userChoice; } catch (e) { /* noop */ } draw(); } },
      icon('download'), h('span', { class: 'grow' }, t('Pasang Lembar di layar utama'), h('span', { class: 'sub' }, t('Buka seperti aplikasi biasa, tanpa bilah browser'))), icon('right', 's'))));
  }
  draw();
  ctx.watch(['settings'], draw);
}

export function renderLanguage(view, args, ctx) {
  const hdrHost = h('div', { style: 'display:contents' });
  view.appendChild(hdrHost);
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  let preview = getLang();
  const draw = () => {
    const s = store.settings();
    hdrHost.replaceChildren(header(t('Bahasa'), { backTo: 'settings' }, ctx));
    clear(body);
    const active = s.followSystemLang ? detectLang() : (s.lang || 'id');
    const prev = getLang(); setLang(preview);
    const pv = h('div', { class: 'group', style: 'padding:16px;display:flex;flex-direction:column;gap:10px', lang: preview },
      h('span', { class: 'lbl' }, t('Pratinjau')), h('span', { class: 'small muted', style: 'font-weight:600' }, fmtDayYear(Date.now())),
      h('span', { style: 'font:600 1.6rem/1.15 var(--serif)' }, greeting()),
      h('div', { class: 'search', style: 'height:44px;font-size:.875rem' }, icon('search', 's'), t('Cari catatan, tag, atau isi…')),
      h('span', { class: 'btn p sm', style: 'align-self:flex-start' }, icon('plus', 's'), t('Catatan baru')));
    setLang(prev);
    body.append(pv,
      h('div', { class: 'group' }, h('div', { class: 'row' }, icon('device'), h('span', { class: 'grow' }, t('Ikuti bahasa HP'), h('span', { class: 'sub' }, t('Saat ini: {l}', { l: LANGS.find(l => l.code === detectLang()).native }))),
        toggle(s.followSystemLang, async v => { preview = v ? detectLang() : (s.lang || 'id'); await store.setSetting('followSystemLang', v); }, t('Ikuti bahasa HP')))),
      h('span', { class: 'lbl' }, t('Pilih bahasa')),
      h('div', { class: 'group' }, LANGS.map(l => h('button', { class: 'row', type: 'button', disabled: s.followSystemLang, style: s.followSystemLang ? 'opacity:.45' : '', 'aria-pressed': active === l.code ? 'true' : 'false', onClick: async () => { preview = l.code; await store.setSetting('lang', l.code); } },
        h('span', { class: 'tico' + (active === l.code ? '' : ''), style: `width:36px;height:36px;font:700 .75rem var(--sans);text-transform:uppercase;${active === l.code ? 'background:var(--accent);color:var(--on-accent)' : ''}` }, l.code),
        h('span', { class: 'grow' }, l.native, h('span', { class: 'sub' }, t(l.name))),
        active === l.code ? icon('tick', 's') : null))),
      h('p', { class: 'small muted', style: 'margin:0' }, t('Hanya tampilan aplikasi yang berubah. Isi catatanmu tidak ikut diterjemahkan.')));
  };
  draw();
  ctx.watch(['settings'], draw);
}

export function renderSecurity(view, args, ctx) {
  view.appendChild(header(t('PIN & kunci'), { backTo: 'settings' }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  const draw = async () => {
    const s = store.settings();
    clear(body);
    if (!store.hasPin()) {
      body.append(h('div', { class: 'empty' },
        h('span', { class: 'tico k4', style: 'width:72px;height:72px;border-radius:24px' }, icon('lock', 'l')),
        h('h2', { class: 'h2' }, t('Kunci catatan privat')),
        h('p', { class: 'small muted' }, t('Buat PIN 4 digit untuk mengunci buku, catatan tertentu, atau seluruh aplikasi. Kamu juga bisa memakai sidik jari.')),
        h('button', { class: 'btn p', type: 'button', onClick: async () => { if (await setupPin({ requireOld: false })) draw(); } }, t('Buat PIN'))));
      return;
    }
    const bioOk = await bioSupported();
    body.append(
      h('div', { class: 'group' },
        h('button', { class: 'row', type: 'button', onClick: async () => { if (await setupPin({ requireOld: true })) snack(t('PIN diperbarui')); } }, icon('shield'), h('span', { class: 'grow' }, t('Ubah PIN & pertanyaan pemulihan')), icon('right', 's')),
        h('div', { class: 'row' }, icon('lock'), h('span', { class: 'grow' }, t('Kunci aplikasi'), h('span', { class: 'sub' }, t('Minta PIN setiap membuka Lembar atau setelah 1 menit di latar'))),
          toggle(s.appLock, async v => { if (!v && !(await requestUnlock({ force: true, title: t('Masukkan PIN') }))) { draw(); return; } await store.setSetting('appLock', v); snack(v ? t('Kunci aplikasi aktif') : t('Kunci aplikasi mati')); }, t('Kunci aplikasi'))),
        h('div', { class: 'row', style: bioOk ? '' : 'opacity:.5' }, icon('finger'), h('span', { class: 'grow' }, t('Buka dengan sidik jari'), h('span', { class: 'sub' }, bioOk ? t('Memakai sensor biometrik HP') : t('Tidak tersedia di perangkat atau browser ini'))),
          bioOk ? toggle(s.bio, async v => {
            if (v) { try { await bioRegister(); const ok = await bioVerify(); if (!ok) throw new Error('verify'); snack(t('Sidik jari aktif')); } catch (e) { await store.setSetting('bio', false); snack(t('Sidik jari tidak bisa diaktifkan')); draw(); } }
            else { await store.setSetting('bio', false); await store.setSetting('bioCred', null); }
          }, t('Buka dengan sidik jari')) : null)),
      h('span', { class: 'lbl' }, t('Yang terkunci')),
      h('div', { class: 'group' },
        h('div', { class: 'row' }, icon('books'), h('span', { class: 'grow' }, t('Buku terkunci')), h('span', { class: 'val' }, store.books().filter(b => b.locked).length)),
        h('div', { class: 'row' }, icon('file'), h('span', { class: 'grow' }, t('Catatan terkunci')), h('span', { class: 'val' }, store.allNotes().filter(n => n.locked && !n.trashedAt).length))),
      h('div', { class: 'notice', style: 'background:var(--surface2);color:var(--ink2)' }, icon('info', 's'), t('Kunci membatasi akses di dalam Lembar. Untuk perlindungan penuh, aktifkan juga kunci layar HP dan buat backup secara rutin.')),
      h('button', { class: 'btn t danger', type: 'button', onClick: async () => {
        if (!(await requestUnlock({ force: true }))) return;
        const ok = await confirm({ title: t('Hapus PIN?'), message: t('Semua buku dan catatan terkunci akan terbuka, dan kunci aplikasi dimatikan.'), ok: t('Hapus PIN'), danger: true, icon: 'unlock' });
        if (!ok) return;
        await removePin(); snack(t('PIN dihapus')); draw();
      } }, t('Hapus PIN')));
  };
  draw();
  void fmtDay;
}
