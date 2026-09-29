// Lembar · daftar catatan: grid/daftar, swipe, pilih banyak
import * as store from './store.js';
import { h, clear, snack, swipeable, onLongPress, confirm, vibrate } from './ui.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { noteCard, noteRow } from './components.js';
import { pickBook, pickColor, pickTags } from './pickers.js';
import { requestUnlock } from './views/lock.js';

export function openNote(n, ctx) {
  if (store.isConcealed(n)) {
    requestUnlock({ title: t('Catatan terkunci') }).then(ok => { if (ok) ctx.navigate('note/' + n.id); });
  } else ctx.navigate('note/' + n.id);
}

export function collection(host, { root, ctx, getNotes, view = () => 'grid', mode = 'live', empty, onSelect }) {
  const sel = new Set();
  let selecting = false;
  let selHdr = null, selBar = null;

  const exitSel = () => { selecting = false; sel.clear(); selHdr && selHdr.remove(); selBar && selBar.remove(); selHdr = selBar = null; root.classList.remove('selecting'); document.body.classList.remove('selecting'); draw(); onSelect && onSelect(false); };
  const enterSel = (id) => { if (!selecting) { selecting = true; root.classList.add('selecting'); document.body.classList.add('selecting'); onSelect && onSelect(true); } if (id) sel.add(id); drawBars(); draw(); };

  function act(label, ic, fn) { return h('button', { type: 'button', onClick: fn }, icon(ic), label); }
  function drawBars() {
    if (!selecting) return;
    const ids = () => [...sel];
    const list = getNotes();
    if (!selHdr) { selHdr = h('div', { class: 'hdr selhdr', style: 'position:absolute;top:0;left:0;right:0;z-index:9' }); root.appendChild(selHdr); }
    const allSel = list.length && list.every(n => sel.has(n.id));
    selHdr.replaceChildren(
      h('button', { class: 'ib', type: 'button', 'aria-label': t('Batal pilih'), onClick: exitSel }, icon('close')),
      h('span', { style: 'flex:1;font-size:1.1rem;font-weight:700' }, t('{n} dipilih', { n: sel.size })),
      mode === 'live' ? h('button', { class: 'ib', type: 'button', 'aria-label': t('Sematkan'), onClick: async () => {
        const notes = ids().map(store.note); const pin = notes.some(n => !n.pinned);
        await store.patchNotes(ids(), { pinned: pin }); snack(pin ? t('Disematkan') : t('Sematan dilepas')); exitSel();
      } }, icon('pin')) : null,
      h('button', { class: 'btn t sm accent', type: 'button', onClick: () => { if (allSel) sel.clear(); else list.forEach(n => sel.add(n.id)); drawBars(); draw(); } }, allSel ? t('Batal semua') : t('Pilih semua')));
    if (!selBar) { selBar = h('div', { class: 'selbar' }); root.appendChild(selBar); }
    const need = fn => async () => { if (!sel.size) { snack(t('Pilih catatan dulu')); return; } await fn(); };
    if (mode === 'live') selBar.replaceChildren(
      act(t('Pindah'), 'folder', need(async () => { const b = await pickBook(undefined); if (b === undefined) return; await store.patchNotes(ids(), { bookId: b }); snack(t('{n} catatan dipindah', { n: sel.size })); exitSel(); })),
      act(t('Warna'), 'drop', need(async () => { const c = await pickColor(''); if (c === undefined) return; await store.patchNotes(ids(), { color: c }); exitSel(); })),
      act(t('Tag'), 'label', need(async () => { const tags = await pickTags([], { title: t('Tambah tag ke {n} catatan', { n: sel.size }) }); if (!tags) return; await store.patchNotes(ids(), n => ({ tags: [...new Set([...(n.tags || []), ...tags])] })); exitSel(); })),
      act(t('Arsip'), 'archive', need(async () => { const i = ids(); await store.archiveNotes(i); exitSel(); snack(t('{n} catatan diarsipkan', { n: i.length }), { label: t('Urungkan'), icon: 'undo', onClick: () => store.archiveNotes(i, false) }); })),
      act(t('Hapus'), 'trash', need(async () => { const i = ids(); await store.trashNotes(i); exitSel(); snack(t('{n} catatan dipindah ke Sampah', { n: i.length }), { label: t('Urungkan'), icon: 'undo', onClick: () => store.restoreNotes(i) }); })));
    else if (mode === 'archive') selBar.replaceChildren(
      act(t('Keluarkan'), 'upload', need(async () => { const i = ids(); await store.archiveNotes(i, false); exitSel(); snack(t('{n} catatan dikeluarkan dari arsip', { n: i.length })); })),
      act(t('Hapus'), 'trash', need(async () => { const i = ids(); await store.trashNotes(i); exitSel(); snack(t('{n} catatan dipindah ke Sampah', { n: i.length }), { label: t('Urungkan'), icon: 'undo', onClick: () => store.restoreNotes(i) }); })));
    else if (mode === 'trash') selBar.replaceChildren(
      act(t('Pulihkan'), 'undo', need(async () => { const i = ids(); await store.restoreNotes(i); exitSel(); snack(t('{n} catatan dipulihkan', { n: i.length })); })),
      act(t('Hapus permanen'), 'trash', need(async () => {
        const ok = await confirm({ title: t('Hapus permanen?'), message: t('{n} catatan beserta lampirannya akan dihapus dan tidak bisa dikembalikan.', { n: sel.size }), ok: t('Hapus permanen'), danger: true, icon: 'trash' });
        if (!ok) return; await store.deleteForever(ids()); exitSel();
      })));
  }

  function onCard(n, el) {
    el.addEventListener('click', () => {
      if (el.closest('.sw-row')?.dataset.swiped) return;
      if (selecting) { sel.has(n.id) ? sel.delete(n.id) : sel.add(n.id); vibrate(6); drawBars(); draw(); return; }
      if (mode === 'trash') { enterSel(n.id); return; }
      openNote(n, ctx);
    });
    onLongPress(el, () => enterSel(n.id));
  }

  function draw() {
    const notes = getNotes();
    clear(host);
    if (!notes.length) { if (empty) host.appendChild(typeof empty === 'function' ? empty() : empty); return; }
    const v = view();
    if (v === 'grid' && mode === 'live') {
      const grid = h('div', { class: 'masonry' });
      for (const n of notes) { const c = noteCard(n, { selecting, selected: sel.has(n.id) }); onCard(n, c); grid.appendChild(c); }
      host.appendChild(grid);
    } else {
      const list = h('div', { class: 'list' });
      for (const n of notes) {
        const r = noteRow(n, { selecting, selected: sel.has(n.id), sub: mode === 'trash' ? trashSub : mode === 'archive' ? archSub : null });
        r.classList.add('sw-card');
        const wrap = h('div', { class: 'sw-row' }, r);
        onCard(n, r);
        if (mode === 'live' && !selecting) {
          swipeable(wrap, {
            rightLabel: t('Arsipkan'), leftLabel: t('Hapus'),
            onRight: async () => { await store.archiveNotes([n.id]); snack(t('Catatan diarsipkan'), { label: t('Urungkan'), icon: 'undo', onClick: () => store.archiveNotes([n.id], false) }); },
            onLeft: async () => { await store.trashNotes([n.id]); snack(t('1 catatan dipindah ke Sampah'), { label: t('Urungkan'), icon: 'undo', onClick: () => store.restoreNotes([n.id]) }); },
          });
        }
        list.appendChild(wrap);
      }
      host.appendChild(list);
    }
  }
  const trashSub = n => { const left = Math.max(0, 30 - Math.floor((Date.now() - n.trashedAt) / store.DAY)); return t('Terhapus permanen dalam {n} hari', { n: left }); };
  const archSub = null;

  draw();
  return { refresh() { if (selecting) { for (const id of [...sel]) if (!getNotes().some(n => n.id === id)) sel.delete(id); drawBars(); } draw(); }, exitSel, get selecting() { return selecting; } };
}
