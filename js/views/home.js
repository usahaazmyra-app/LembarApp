// Lembar · Beranda
import * as store from '../store.js';
import { h, clear, snack, iconBtn, escapeHTML } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtDay, greeting } from '../i18n.js';
import { collection } from '../collection.js';
import { emptyState } from '../components.js';

export function render(view, args, ctx) {
  let filter = 'all';
  const scroller = h('div', { class: 'scroll' });
  const wrap = h('div', { class: 'wrap stack pad-nav' });
  const pull = h('div', { class: 'pull-hint' }, icon('down', 's'), t('Lepas untuk catat kilat'));
  const quickHost = h('div');
  const bannerHost = h('div');
  const chipsHost = h('div', { class: 'chips' });
  const streakHost = h('div');
  const headHost = h('div');
  const listHost = h('div');

  const heroTitle = h('h1', { class: 'title' }, greeting());
  const hero = h('div', { class: 'hero' },
    h('div', { class: 'grow' }, h('span', { class: 'lbl' }, fmtDay(Date.now())), heroTitle),
    ctx.isWide() ? null : h('a', { class: 'ib soft', href: '#/settings', 'aria-label': t('Pengaturan') }, icon('settings')));

  wrap.append(bannerHost, h('a', { class: 'search', href: '#/search' }, icon('search'), h('span', {}, t('Cari catatan, tag, atau isi…'))),
    quickHost, chipsHost, streakHost, headHost, listHost);
  scroller.append(pull, hero, wrap);
  view.appendChild(scroller);

  const getNotes = () => {
    let list = store.liveNotes().filter(n => !(store.isConcealed(n) && store.book(n.bookId)?.locked));
    if (filter === 'pinned') list = list.filter(n => n.pinned);
    else if (filter === 'checklist') list = list.filter(n => n.type === 'checklist' || n.blocks.some(b => b.t === 'check'));
    else if (filter === 'journal') list = list.filter(n => n.type === 'journal');
    else if (filter.startsWith('#')) list = list.filter(n => !store.isConcealed(n) && store.noteTags(n).includes(filter.slice(1)));
    return store.sortNotes(list);
  };

  const hasAny = () => store.liveNotes().length > 0;
  const coll = collection(listHost, {
    root: view, ctx, getNotes, view: () => store.settings().view,
    empty: () => hasAny() ? emptyState('search', t('Tidak ada catatan di filter ini'), t('Coba pilih filter lain.'), h('button', { class: 'btn g sm', type: 'button', onClick: () => { filter = 'all'; drawAll(); } }, t('Tampilkan semua'))) : firstRun(),
  });

  function firstRun() {
    const start = (ic, bg, title, sub, fn) => h('button', { class: 'lrow', type: 'button', onClick: fn },
      h('span', { class: 'tico', style: `background:var(--${bg})` }, icon(ic)), h('div', { class: 'body-t' }, h('h4', {}, title), h('p', {}, sub)));
    return h('div', { class: 'stack' },
      h('div', { class: 'empty', style: 'padding-top:10px' },
        h('div', { html: '<svg width="170" height="130" viewBox="0 0 170 130" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--ink)"><path d="M30 20h80a6 6 0 0 1 6 6v84a6 6 0 0 1-6 6H30z" fill="var(--k1)"/><path d="M30 20v96"/><path d="M44 44h54M44 58h54M44 72h38M44 86h46" stroke="var(--muted)" opacity=".5"/><path d="M122 30l18 18-44 44-22 4 4-22z" fill="var(--paper)"/><path d="m116 36 18 18"/><path d="M142 94c6 2 10 6 12 12M150 84c4 0 8 2 10 5" stroke="var(--accent)"/></svg>' }),
        h('h2', { class: 'h2' }, t('Lembar masih kosong')),
        h('p', { class: 'small muted' }, t('Ketuk + untuk menulis, atau mulai dari salah satu ide di bawah.'))),
      h('span', { class: 'lbl' }, t('Mulai cepat')),
      start('journal', 'k2', t('Tulis jurnal hari ini'), t('Catat mood dan hal yang disyukuri'), () => ctx.navigate('journal/today')),
      start('check', 'k1', t('Buat daftar tugas'), t('Checklist yang bisa dicentang'), () => ctx.navigate('new/checklist')),
      start('template', 'accent-soft', t('Lihat template'), t('Rapat, kuliah, resep, dan lainnya'), () => ctx.navigate('templates')),
      start('upload', 'k8', t('Pindah dari HP lama?'), t('Pulihkan dari file .lembar'), () => ctx.navigate('backup')));
  }

  function drawBanner() {
    clear(bannerHost);
    const s = store.settings();
    const n = store.allNotes().length;
    if (!s.backupRemind || n < 3) return;
    const last = s.lastBackup || 0;
    const first = Math.min(...store.allNotes().map(x => x.createdAt));
    if (Date.now() - Math.max(last, first) < 7 * store.DAY) return;
    if (sessionStorage.getItem('lembar-banner-hide')) return;
    bannerHost.appendChild(h('div', { class: 'banner' },
      h('span', { class: 'tico', style: 'background:var(--surface)' }, icon('shieldok')),
      h('div', { class: 'grow' }, h('b', {}, last ? t('Sudah seminggu belum backup') : t('Amankan catatanmu')), h('div', { class: 'small', style: 'color:var(--ink2)' }, t('Buat backup supaya catatan tidak hilang saat ganti HP.'))),
      h('a', { class: 'btn p sm', href: '#/backup' }, t('Backup')),
      iconBtn('close', t('Tutup'), () => { try { sessionStorage.setItem('lembar-banner-hide', '1'); } catch (e) { /* noop */ } drawBanner(); }, 'sm')));
  }

  function drawChips() {
    const base = [['all', t('Semua')], ['pinned', t('Tersemat')], ['checklist', t('Checklist')], ['journal', t('Jurnal')]];
    const tags = store.allTags().slice(0, 8).map(x => ['#' + x.name, '#' + x.name]);
    chipsHost.replaceChildren(...[...base, ...tags].map(([k, label]) => h('button', { class: 'chip' + (filter === k ? ' on' : ''), type: 'button', onClick: () => { filter = k; drawChips(); coll.refresh(); } }, label)));
    chipsHost.hidden = !hasAny();
  }

  function drawStreak() {
    clear(streakHost);
    if (!hasAny()) return;
    const st = store.streak();
    const week = store.weekActivity();
    const weekCount = store.allNotes().filter(n => n.createdAt > Date.now() - 7 * store.DAY && !n.trashedAt).length;
    streakHost.appendChild(h('a', { class: 'streak', href: '#/stats', 'aria-label': t('Lihat statistik menulis') },
      h('span', { class: 'ic' }, icon('pen', 's')),
      h('div', { style: 'display:flex;flex-direction:column;gap:1px;min-width:0' },
        h('span', { style: 'font-size:.84rem;font-weight:700' }, st > 0 ? t('{n} hari berturut-turut menulis', { n: st }) : t('Mulai streak menulis hari ini')),
        h('span', { class: 'muted', style: 'font-size:.75rem;font-weight:500' }, t('{n} catatan minggu ini', { n: weekCount }))),
      h('div', { class: 'dotw', 'aria-hidden': 'true' }, week.map(on => h('i', { class: on ? '' : 'off' })))));
  }

  function drawHead() {
    clear(headHost);
    if (!hasAny()) return;
    const v = store.settings().view;
    const setV = (x) => { store.setSetting('view', x); };
    headHost.appendChild(h('div', { class: 'sechead' },
      h('span', { class: 'lbl' }, t('Tersemat & terbaru')),
      h('div', { class: 'row-flex', style: 'gap:2px' },
        h('button', { class: 'ib sm' + (v === 'grid' ? ' on' : ''), type: 'button', 'aria-label': t('Tampilan grid'), 'aria-pressed': v === 'grid' ? 'true' : 'false', onClick: () => setV('grid') }, icon('grid', 's')),
        h('button', { class: 'ib sm' + (v === 'list' ? ' on' : ''), type: 'button', 'aria-label': t('Tampilan daftar'), 'aria-pressed': v === 'list' ? 'true' : 'false', onClick: () => setV('list') }, icon('list', 's')))));
  }

  // ---- catat kilat (tarik ke bawah) ----
  function openQuick() {
    if (quickHost.firstChild) { quickHost.querySelector('input')?.focus(); return; }
    const input = h('input', { type: 'text', placeholder: t('Tulis sesuatu, lalu Simpan'), 'aria-label': t('Catatan kilat'), maxlength: 300 });
    const close = () => clear(quickHost);
    const save = async () => {
      const v = input.value.trim(); if (!v) { close(); return; }
      const lines = v.split(/\n/);
      await store.createNote({ type: 'text', title: lines[0].slice(0, 120), blocks: [{ id: store.uid(), t: 'text', html: lines.length > 1 || lines[0].length > 120 ? escapeHTML(v) : '' }] });
      close(); snack(t('Catatan kilat tersimpan'));
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') close(); });
    quickHost.appendChild(h('div', { class: 'quick' },
      h('span', { class: 'meta', style: 'color:var(--accent-ink)' }, icon('flash', 'xs'), t('Catat kilat')),
      input,
      h('div', { class: 'row-flex', style: 'justify-content:flex-end' },
        h('button', { class: 'btn t sm', type: 'button', onClick: close }, t('Batal')),
        h('button', { class: 'btn p sm', type: 'button', onClick: save }, t('Simpan')))));
    setTimeout(() => input.focus(), 30);
  }
  let py = null, pulled = 0;
  scroller.addEventListener('touchstart', e => { py = scroller.scrollTop <= 0 ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
  scroller.addEventListener('touchmove', e => {
    if (py == null || coll.selecting) return;
    pulled = e.touches[0].clientY - py;
    pull.style.height = Math.max(0, Math.min(56, pulled * 0.45)) + 'px';
    pull.firstChild.style.transform = pulled > 110 ? 'rotate(180deg)' : '';
  }, { passive: true });
  scroller.addEventListener('touchend', () => {
    if (py != null && pulled > 110 && !coll.selecting) openQuick();
    py = null; pull.style.height = '0px';
  });

  function drawAll() { heroTitle.textContent = greeting(); drawBanner(); drawChips(); drawStreak(); drawHead(); coll.refresh(); }
  drawAll();
  ctx.watch(['notes', 'books'], () => { drawBanner(); drawChips(); drawStreak(); drawHead(); coll.refresh(); });
  ctx.watch(['settings'], () => { drawHead(); coll.refresh(); drawBanner(); });
}
