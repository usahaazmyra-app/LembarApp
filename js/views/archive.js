// Lembar · Arsip & Sampah
import * as store from '../store.js';
import { h, confirm, snack } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { header, emptyState } from '../components.js';
import { collection } from '../collection.js';

export function render(view, args, ctx) {
  view.appendChild(header(t('Arsip'), { backTo: 'books', actions: [h('a', { class: 'ib', href: '#/search?archive=1', 'aria-label': t('Cari di arsip') }, icon('search'))] }, ctx));
  const listHost = h('div');
  const count = h('span', { class: 'lbl' });
  view.appendChild(h('div', { class: 'scroll' }, h('div', { class: 'wrap stack pad-b' },
    h('div', { class: 'notice k7' }, icon('archive', 's'), t('Catatan arsip disembunyikan dari Beranda, tapi tetap aman dan bisa dicari. Tekan lama untuk memilih.')),
    count, listHost)));
  const getNotes = () => store.archivedNotes().sort((a, b) => b.updatedAt - a.updatedAt);
  const coll = collection(listHost, { root: view, ctx, getNotes, view: () => 'list', mode: 'archive', empty: () => emptyState('archive', t('Arsip kosong'), t('Usap kartu ke kanan di Beranda (tampilan daftar) untuk mengarsipkan.')) });
  const upd = () => { const n = getNotes().length; count.textContent = t('{n} catatan', { n }); count.hidden = !n; };
  upd();
  ctx.watch(['notes'], () => { upd(); coll.refresh(); });
}

export function renderTrash(view, args, ctx) {
  const emptyBtn = h('button', { class: 'btn t sm danger', type: 'button', onClick: async () => {
    const list = store.trashedNotes();
    if (!list.length) return;
    const ok = await confirm({ title: t('Kosongkan Sampah?'), message: t('{n} catatan beserta lampirannya akan dihapus permanen dan tidak bisa dikembalikan.', { n: list.length }), ok: t('Hapus permanen'), danger: true, icon: 'trash' });
    if (!ok) return;
    await store.deleteForever(list.map(n => n.id)); snack(t('Sampah dikosongkan'));
  } }, t('Kosongkan'));
  view.appendChild(header(t('Sampah'), { backTo: 'books', actions: [emptyBtn] }, ctx));
  const listHost = h('div');
  view.appendChild(h('div', { class: 'scroll' }, h('div', { class: 'wrap stack pad-b' },
    h('div', { class: 'notice k4' }, icon('clock', 's'), t('Catatan di Sampah terhapus permanen setelah 30 hari. Ketuk catatan untuk memilih, lalu pulihkan atau hapus.')),
    listHost)));
  const getNotes = () => store.trashedNotes();
  const coll = collection(listHost, { root: view, ctx, getNotes, view: () => 'list', mode: 'trash', empty: () => emptyState('trash', t('Sampah kosong'), t('Catatan yang dihapus akan muncul di sini selama 30 hari.')) });
  const upd = () => { emptyBtn.hidden = !getNotes().length; };
  upd();
  ctx.watch(['notes'], () => { upd(); coll.refresh(); });
}
