// Lembar · Buku (daftar, isi buku, buku baru/edit)
import * as store from '../store.js';
import { h, clear, iconBtn, snack, sheet, confirm, toggle } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { collection } from '../collection.js';
import { emptyState, bookColorVar, noteTitle } from '../components.js';
import { requestUnlock, setupPin } from './lock.js';
import { openCreateMenu } from '../app.js';

const ICON_NAMES = { book: 'Buku', work: 'Kerja', school: 'Sekolah', heart: 'Hati', pen: 'Pena', food: 'Makanan', map: 'Peta', idea: 'Ide', star: 'Bintang', home: 'Rumah' };
const liveIn = id => store.liveNotes().filter(n => n.bookId === id);

export function render(view, args, ctx) {
  const scroller = h('div', { class: 'scroll' });
  view.appendChild(scroller);
  const draw = () => {
    clear(scroller);
    const hero = h('div', { class: 'hero' },
      h('div', { class: 'grow' }, h('h1', { class: 'title' }, t('Buku'))),
      h('a', { class: 'ib soft', href: '#/tags', 'aria-label': t('Tag') }, icon('tag')),
      h('a', { class: 'ib soft', href: '#/book-new', 'aria-label': t('Buku baru') }, icon('plus')));
    const shelf = h('div', { class: 'shelf' },
      store.books().map(b => {
        const n = liveIn(b.id).length;
        const cover = h('button', { class: 'cover', type: 'button', style: `background:${bookColorVar(b)}` },
          h('div', { class: 'row-flex', style: 'justify-content:space-between' }, icon(b.icon || 'book'), b.locked ? icon('lock', 's') : null),
          h('div', {}, h('b', {}, b.name), h('small', {}, b.locked && !store.session.unlocked ? t('Terkunci') : t('{n} catatan', { n }))));
        cover.addEventListener('click', () => openBook(b, ctx));
        return cover;
      }),
      h('a', { class: 'cover add', href: '#/book-new' }, icon('plus', 'l'), h('small', {}, t('Buku baru'))));
    const noBook = store.liveNotes().filter(n => !n.bookId).length;
    const rows = h('div', { class: 'group' },
      noBook ? h('a', { class: 'row', href: '#/book/_none' }, icon('file'), h('span', { class: 'grow' }, t('Tanpa buku')), h('span', { class: 'val' }, noBook), icon('right', 's')) : null,
      h('a', { class: 'row', href: '#/reminders' }, icon('bell'), h('span', { class: 'grow' }, t('Pengingat')), h('span', { class: 'val' }, store.reminders().filter(n => !n.reminder.done).length), icon('right', 's')),
      h('a', { class: 'row', href: '#/templates' }, icon('template'), h('span', { class: 'grow' }, t('Template')), icon('right', 's')),
      h('a', { class: 'row', href: '#/archive' }, icon('archive'), h('span', { class: 'grow' }, t('Arsip')), h('span', { class: 'val' }, store.archivedNotes().length), icon('right', 's')),
      h('a', { class: 'row', href: '#/trash' }, icon('trash'), h('span', { class: 'grow' }, t('Sampah')), h('span', { class: 'val' }, store.trashedNotes().length), icon('right', 's')));
    scroller.append(hero, h('div', { class: 'wrap stack pad-nav' }, shelf, h('span', { class: 'lbl', style: 'margin-top:6px' }, t('Lainnya')), rows));
  };
  draw();
  ctx.watch(['books', 'notes'], draw);
}

export async function openBook(b, ctx) {
  if (b.locked && !store.session.unlocked) {
    const ok = await requestUnlock({ title: t('Buku “{n}” terkunci', { n: b.name }) });
    if (!ok) return;
  }
  ctx.navigate('book/' + b.id);
}

export function renderBook(view, [id], ctx) {
  const none = id === '_none';
  const b = none ? { id: null, name: t('Tanpa buku'), color: 'k8', icon: 'file' } : store.book(id);
  if (!b) { ctx.navigate('books', { replace: true }); return; }
  if (b.locked && !store.session.unlocked) {
    view.append(h('div', { class: 'hdr' }, iconBtn('back', t('Kembali'), () => ctx.back('books'))),
      h('div', { class: 'locked-view' }, h('span', { class: 'tico k4', style: 'width:72px;height:72px;border-radius:24px' }, icon('lock', 'l')),
        h('h2', { class: 'h2' }, t('Buku “{n}” terkunci', { n: b.name })),
        h('button', { class: 'btn p', type: 'button', onClick: async () => { if (await requestUnlock()) { clear(view); renderBook(view, [id], ctx); } } }, icon('unlock', 's'), t('Buka'))));
    return;
  }
  let tagFilter = null, sort = 'updated';
  const head = h('div', { class: 'bhead', style: `background:${bookColorVar(b)}` });
  const drawHead = () => {
    const n = liveIn(b.id).length;
    head.replaceChildren(
      h('div', { class: 'row-flex' }, iconBtn('back', t('Kembali'), () => ctx.back('books')), h('span', { class: 'grow' }),
        iconBtn('search', t('Cari di buku ini'), () => ctx.navigate('search?book=' + (b.id || '_none'))),
        none ? null : iconBtn('more', t('Atur buku'), () => bookMenu())),
      h('div', { class: 'row-flex', style: 'gap:14px;padding:0 10px' },
        h('span', { class: 'tico', style: 'width:56px;height:56px;border-radius:18px;background:var(--surface)' }, icon(b.icon || 'book', 'l')),
        h('div', { class: 'grow' }, h('h1', { class: 'title', style: 'font-size:1.75rem' }, b.name), h('span', { class: 'small', style: 'color:var(--ink2);font-weight:600' }, t('{n} catatan', { n }) + (b.locked ? ' · ' + t('Terkunci') : '')))));
  };
  const chips = h('div', { class: 'chips' });
  const listHost = h('div');
  const scroller = h('div', { class: 'scroll' }, head, h('div', { class: 'wrap stack pad-b', style: 'padding-top:14px' },
    chips,
    h('div', { class: 'sechead' },
      h('button', { class: 'btn t sm', type: 'button', style: 'padding:0;gap:6px', onClick: () => { sort = sort === 'updated' ? 'created' : sort === 'created' ? 'title' : 'updated'; coll.refresh(); drawSortLabel(); } }, icon('sort', 's'), h('span', { class: 'sortlbl' })),
      h('button', { class: 'btn p sm', type: 'button', onClick: () => openCreateMenu(b.id ? { book: b.id } : {}) }, icon('plus', 's'), t('Catatan'))),
    listHost));
  view.appendChild(scroller);
  const drawSortLabel = () => { scroller.querySelector('.sortlbl').textContent = { updated: t('Terakhir diubah'), created: t('Terakhir dibuat'), title: t('Judul A–Z') }[sort]; };
  const getNotes = () => {
    let list = liveIn(b.id);
    if (tagFilter) list = list.filter(n => store.noteTags(n).includes(tagFilter));
    if (sort === 'title') return list.sort((x, y) => (y.pinned - x.pinned) || noteTitle(x).localeCompare(noteTitle(y), undefined, { sensitivity: 'base' }));
    if (sort === 'created') return list.sort((x, y) => (y.pinned - x.pinned) || (y.createdAt - x.createdAt));
    return store.sortNotes(list);
  };
  const drawChips = () => {
    const tags = [...new Set(liveIn(b.id).flatMap(n => store.noteTags(n)))].slice(0, 10);
    chips.replaceChildren(h('button', { class: 'chip' + (!tagFilter ? ' on' : ''), type: 'button', onClick: () => { tagFilter = null; drawChips(); coll.refresh(); } }, t('Semua')),
      ...tags.map(tg => h('button', { class: 'chip' + (tagFilter === tg ? ' on' : ''), type: 'button', onClick: () => { tagFilter = tg; drawChips(); coll.refresh(); } }, '#' + tg)));
    chips.hidden = !tags.length;
  };
  const coll = collection(listHost, { root: view, ctx, getNotes, view: () => 'list', mode: 'live',
    empty: () => emptyState(b.icon || 'book', t('Buku ini masih kosong'), t('Tambahkan catatan pertama ke buku ini.'), h('button', { class: 'btn p sm', type: 'button', onClick: () => openCreateMenu(b.id ? { book: b.id } : {}) }, icon('plus', 's'), t('Catatan baru'))) });
  drawHead(); drawChips(); drawSortLabel();
  ctx.watch(['notes', 'books'], () => { drawHead(); drawChips(); coll.refresh(); });

  function bookMenu() {
    const s = sheet(b.name, h('div', { class: 'menu-list' },
      h('button', { class: 'mrow', type: 'button', onClick: () => { s.close(); ctx.navigate('book-edit/' + b.id); } }, icon('edit'), h('span', { class: 'grow' }, t('Ubah nama, warna & ikon'))),
      h('button', { class: 'mrow', type: 'button', onClick: async () => {
        s.close();
        if (!b.locked) {
          if (!store.hasPin()) { const ok = await confirm({ title: t('Atur PIN dulu'), message: t('Untuk mengunci buku, buat PIN 4 digit terlebih dahulu.'), ok: t('Buat PIN'), icon: 'lock' }); if (!ok || !(await setupPin({ requireOld: false }))) return; }
          await store.saveBook({ ...b, locked: true }); store.session.unlocked = true; b.locked = true; snack(t('Buku dikunci'));
        } else { if (!(await requestUnlock())) return; await store.saveBook({ ...b, locked: false }); b.locked = false; snack(t('Kunci buku dilepas')); }
        drawHead();
      } }, icon(b.locked ? 'unlock' : 'lock'), h('span', { class: 'grow' }, b.locked ? t('Lepas kunci buku') : t('Kunci buku ini'))),
      h('button', { class: 'mrow danger', type: 'button', onClick: async () => {
        s.close();
        const n = liveIn(b.id).length;
        const ok = await confirm({ title: t('Hapus buku “{n}”?', { n: b.name }), message: n ? (b.locked ? t('{n} catatan di dalamnya tidak ikut terhapus. Catatan itu akan dipindah ke “Tanpa buku” dan tetap terkunci.', { n }) : t('{n} catatan di dalamnya tidak ikut terhapus. Catatan itu akan dipindah ke “Tanpa buku”.', { n })) : t('Buku ini kosong.'), ok: t('Hapus buku'), danger: true, icon: 'trash' });
        if (!ok) return;
        await store.deleteBook(b.id); snack(t('Buku dihapus')); ctx.back('books');
      } }, icon('trash'), h('span', { class: 'grow' }, t('Hapus buku')))));
  }
}

export function renderBookForm(view, [id], ctx) {
  const existing = id ? store.book(id) : null;
  if (id && !existing) { ctx.navigate('books', { replace: true }); return; }
  if (existing && existing.locked && !store.session.unlocked) {
    view.appendChild(h('div', { class: 'hdr' }, iconBtn('back', t('Kembali'), () => ctx.back('books'))));
    requestUnlock({ title: t('Buku ini terkunci') }).then(ok => { if (ok) { clear(view); renderBookForm(view, [id], ctx); } else ctx.back('books'); });
    return;
  }
  const st = { name: existing ? existing.name : '', color: existing ? existing.color : 'k7', icon: existing ? existing.icon : 'book', locked: existing ? !!existing.locked : false };
  const nameIn = h('input', { type: 'text', value: st.name, placeholder: t('Misal: Liburan Bali'), maxlength: 40 });
  const preview = h('div', { class: 'cover', style: 'width:150px;height:190px;border-radius:10px 24px 24px 10px;padding:18px 16px 16px 26px;align-self:center;box-shadow:0 4px 0 rgba(43,42,40,.08),0 16px 30px rgba(43,42,40,.14)' });
  const drawPreview = () => {
    preview.style.background = `var(--${st.color})`;
    preview.replaceChildren(h('div', { class: 'row-flex', style: 'justify-content:space-between' }, icon(st.icon, 'l'), st.locked ? icon('lock') : null),
      h('div', {}, h('b', { style: 'font-size:1.3rem;white-space:normal' }, nameIn.value || t('Nama buku')), h('small', {}, t('{n} catatan', { n: existing ? liveIn(existing.id).length : 0 }))));
  };
  nameIn.addEventListener('input', drawPreview);
  const colors = h('div', { class: 'swatches', style: 'justify-content:space-between' });
  const drawColors = () => colors.replaceChildren(...store.CARD_COLORS.filter(c => c[0]).map(([k, n]) => h('button', { class: 'sw' + (st.color === k ? ' on' : ''), type: 'button', style: `background:var(--${k});width:34px;height:34px;border-radius:17px`, 'aria-label': t(n), onClick: () => { st.color = k; drawColors(); drawPreview(); } })));
  const icons = h('div', { class: 'icons-pick' });
  const drawIcons = () => icons.replaceChildren(...store.BOOK_ICONS.map(ic => h('button', { class: st.icon === ic ? 'on' : '', type: 'button', 'aria-label': t(ICON_NAMES[ic] || 'Ikon'), 'aria-pressed': st.icon === ic ? 'true' : 'false', onClick: () => { st.icon = ic; drawIcons(); drawPreview(); } }, icon(ic))));
  const saveBtn = h('button', { class: 'btn p sm', type: 'button', onClick: async () => {
    const name = nameIn.value.trim();
    if (!name) { nameIn.focus(); nameIn.classList.add('err'); return; }
    if (st.locked && !(existing && existing.locked) && !store.hasPin()) { if (!(await setupPin({ requireOld: false }))) return; }
    const b = await store.saveBook({ ...(existing || {}), name, color: st.color, icon: st.icon, locked: st.locked });
    if (st.locked) store.session.unlocked = true;
    snack(existing ? t('Buku diperbarui') : t('Buku “{n}” dibuat', { n: name }));
    if (existing) ctx.back('book/' + b.id); else ctx.navigate('book/' + b.id, { replace: true });
  } }, t('Simpan'));
  view.appendChild(h('div', { class: 'hdr' }, iconBtn('close', t('Batal'), () => ctx.back('books')), h('h1', { class: 'h2' }, existing ? t('Ubah buku') : t('Buku baru')), saveBtn));
  view.appendChild(h('div', { class: 'scroll' }, h('div', { class: 'wrap stack pad-b' },
    preview,
    h('label', { class: 'field' }, t('Nama buku'), nameIn),
    h('div', { class: 'stack', style: 'gap:10px' }, h('span', { class: 'small', style: 'font-weight:700;color:var(--ink2)' }, t('Warna sampul')), colors),
    h('div', { class: 'stack', style: 'gap:10px' }, h('span', { class: 'small', style: 'font-weight:700;color:var(--ink2)' }, t('Ikon')), icons),
    h('div', { class: 'group' }, h('div', { class: 'row' }, icon('lock'), h('span', { class: 'grow' }, t('Kunci buku ini'), h('span', { class: 'sub' }, t('Perlu PIN atau sidik jari untuk membuka'))), toggle(st.locked, v => { st.locked = v; drawPreview(); }, t('Kunci buku ini')))))));
  drawColors(); drawIcons(); drawPreview();
  if (!existing) setTimeout(() => nameIn.focus(), 80);
}
