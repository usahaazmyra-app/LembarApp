// Lembar · Pencarian & filter
import * as store from '../store.js';
import { h, clear, sheet, debounce, btn } from '../ui.js';
import { icon, TYPE_ICON } from '../icons.js';
import { t, fmtRelative } from '../i18n.js';
import { noteTitle, typeTile, emptyState, bookColorVar } from '../components.js';
import { colorRow } from '../pickers.js';
import { openNote } from '../collection.js';

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TYPES = [['all', 'Semua'], ['text', 'Teks'], ['checklist', 'Checklist'], ['voice', 'Suara'], ['photo', 'Foto'], ['sketch', 'Sketsa'], ['journal', 'Jurnal']];

// pencarian terakhir disimpan agar tetap ada saat kembali dari hasil pencarian
let last = null;
export function render(view, args, ctx, query = {}) {
  const F = { type: 'all', books: new Set(query.book ? [query.book === '_none' ? null : query.book] : []), color: null, time: 'any', has: new Set(), archive: query.archive === '1', tag: query.tag || null };
  let q = '';
  const restore = !query.tag && !query.book && !query.archive && last;
  if (restore) { q = last.q; Object.assign(F, { type: last.type, color: last.color, time: last.time, archive: last.archive, tag: last.tag, books: new Set(last.books), has: new Set(last.has) }); }
  const input = h('input', { type: 'search', placeholder: t('Cari catatan, tag, atau isi…'), 'aria-label': t('Cari'), enterkeyhint: 'search', autocomplete: 'off' });
  const clearBtn = h('button', { class: 'ib sm', type: 'button', 'aria-label': t('Hapus pencarian'), hidden: true, onClick: () => { input.value = ''; q = ''; clearBtn.hidden = true; draw(); input.focus(); } }, icon('close', 's'));
  const box = h('label', { class: 'search focus', style: 'flex:1;width:auto;min-width:0' }, icon('search'), input, clearBtn);
  const filterBtn = h('button', { class: 'ib soft', type: 'button', 'aria-label': t('Filter'), onClick: () => openFilter() }, icon('settings'));
  const top = h('div', { class: 'hero', style: 'align-items:center;gap:8px;padding-bottom:8px' }, box, filterBtn);
  const chips = h('div', { class: 'chips' });
  const active = h('div', { class: 'chips' });
  const body = h('div', { class: 'stack', style: 'gap:0' });
  view.append(h('div', { class: 'scroll' }, top, h('div', { class: 'wrap stack pad-nav', style: 'gap:12px' }, chips, active, body)));

  const run = debounce(() => { q = input.value.trim(); draw(); }, 160);
  input.addEventListener('input', () => { clearBtn.hidden = !input.value; run(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { run.flush(); remember(); input.blur(); } });
  if (q) { input.value = q; clearBtn.hidden = false; }
  if (!query.tag && !query.book && !q && !ctx.isWide()) setTimeout(() => input.focus(), 120);

  function remember() {
    if (!q) return;
    const list = [q, ...(store.settings().recentSearches || []).filter(x => x !== q)].slice(0, 8);
    store.setSetting('recentSearches', list);
  }

  function matches(n, tokens) {
    const concealed = store.isConcealed(n);
    const hay = norm(noteTitle(n) + '\n' + (concealed ? '' : store.noteText(n) + '\n' + store.noteTags(n).map(x => '#' + x).join(' ')));
    return tokens.every(tk => hay.includes(tk));
  }
  function filtered() {
    let list = store.allNotes().filter(n => !n.trashedAt && (F.archive || !n.archived));
    list = list.filter(n => !(store.isConcealed(n) && store.book(n.bookId)?.locked));
    if (F.type !== 'all') list = list.filter(n => n.type === F.type || (F.type === 'checklist' && n.blocks.some(b => b.t === 'check')) || (F.type === 'photo' && n.blocks.some(b => b.t === 'image')) || (F.type === 'voice' && n.blocks.some(b => b.t === 'audio')) || (F.type === 'sketch' && n.blocks.some(b => b.t === 'sketch' && b.att)));
    if (F.books.size) list = list.filter(n => F.books.has(n.bookId || null));
    if (F.color !== null) list = list.filter(n => (n.color || '') === F.color);
    if (F.tag) list = list.filter(n => store.noteTags(n).includes(F.tag));
    const days = { d7: 7, d30: 30, d365: 365 }[F.time];
    if (days) list = list.filter(n => n.updatedAt > Date.now() - days * store.DAY);
    if (F.has.has('image')) list = list.filter(n => n.blocks.some(b => b.t === 'image'));
    if (F.has.has('audio')) list = list.filter(n => n.blocks.some(b => b.t === 'audio'));
    if (F.has.has('check')) list = list.filter(n => n.blocks.some(b => b.t === 'check'));
    if (F.has.has('reminder')) list = list.filter(n => n.reminder && !n.reminder.done);
    if (F.has.has('pinned')) list = list.filter(n => n.pinned);
    const tokens = norm(q).split(/\s+/).filter(Boolean).map(x => x.replace(/^#/, ''));
    if (tokens.length) list = list.filter(n => matches(n, tokens));
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  function filterCount() { return (F.books.size ? 1 : 0) + (F.color !== null ? 1 : 0) + (F.time !== 'any' ? 1 : 0) + F.has.size + (F.archive ? 1 : 0) + (F.tag ? 1 : 0); }

  function highlight(text, tokens) {
    const frag = document.createDocumentFragment();
    if (!tokens.length) { frag.append(text); return frag; }
    const nt = norm(text);
    let best = -1; for (const tk of tokens) { const i = nt.indexOf(tk); if (i >= 0 && (best < 0 || i < best)) best = i; }
    let start = best > 40 ? best - 40 : 0;
    let s = text.slice(start, start + 170); let ns = nt.slice(start, start + 170);
    if (start > 0) frag.append('…');
    let pos = 0;
    const re = new RegExp(tokens.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    let m;
    while ((m = re.exec(ns))) { if (m.index > pos) frag.append(s.slice(pos, m.index)); frag.append(h('mark', {}, s.slice(m.index, m.index + m[0].length))); pos = m.index + m[0].length; if (!m[0].length) re.lastIndex++; }
    frag.append(s.slice(pos));
    if (start + 170 < text.length) frag.append('…');
    return frag;
  }

  function drawChips() {
    chips.replaceChildren(...TYPES.map(([k, l]) => h('button', { class: 'chip' + (F.type === k ? ' on' : ''), type: 'button', onClick: () => { F.type = k; draw(); } }, k !== 'all' ? icon(TYPE_ICON[k], 'xs') : null, t(l))));
    const act = [];
    if (F.tag) act.push(['#' + F.tag, () => { F.tag = null; }]);
    for (const b of F.books) act.push([b ? store.book(b)?.name || '?' : t('Tanpa buku'), () => F.books.delete(b)]);
    if (F.color !== null) act.push([t('Warna'), () => { F.color = null; }]);
    if (F.time !== 'any') act.push([{ d7: t('7 hari'), d30: t('30 hari'), d365: t('1 tahun') }[F.time], () => { F.time = 'any'; }]);
    for (const x of F.has) act.push([{ image: t('Berisi foto'), audio: t('Berisi suara'), check: t('Berisi checklist'), reminder: t('Ada pengingat'), pinned: t('Tersemat') }[x], () => F.has.delete(x)]);
    if (F.archive) act.push([t('Termasuk arsip'), () => { F.archive = false; }]);
    active.replaceChildren(...act.map(([label, rm]) => h('button', { class: 'chip on', type: 'button', 'aria-label': t('Hapus filter {f}', { f: label }), onClick: () => { rm(); draw(); } }, label, icon('close', 'xs'))));
    active.hidden = !act.length;
    const c = filterCount();
    filterBtn.replaceChildren(icon('settings'), c ? h('span', { class: 'dot' }) : '');
  }

  function draw() {
    last = { q, type: F.type, color: F.color, time: F.time, archive: F.archive, tag: F.tag, books: [...F.books], has: [...F.has] };
    drawChips();
    clear(body);
    const tokens = norm(q).split(/\s+/).filter(Boolean).map(x => x.replace(/^#/, ''));
    const noQuery = !tokens.length && !filterCount() && F.type === 'all';
    if (noQuery) {
      const recent = store.settings().recentSearches || [];
      if (recent.length) {
        body.append(h('div', { class: 'sechead', style: 'margin-bottom:8px' }, h('span', { class: 'lbl' }, t('Pencarian terakhir')), h('button', { class: 'btn t sm accent', type: 'button', onClick: () => { store.setSetting('recentSearches', []); draw(); } }, t('Hapus'))),
          h('div', { class: 'chips wrapx', style: 'margin-bottom:18px' }, recent.map(r => h('button', { class: 'chip', type: 'button', onClick: () => { input.value = r; clearBtn.hidden = false; q = r; draw(); } }, icon('clock', 'xs'), r))));
      }
      const tags = store.allTags().slice(0, 12);
      if (tags.length) body.append(h('span', { class: 'lbl', style: 'margin-bottom:8px' }, t('Tag')), h('div', { class: 'chips wrapx', style: 'margin-bottom:18px' }, tags.map(tg => h('button', { class: 'chip', type: 'button', onClick: () => { F.tag = tg.name; draw(); } }, '#' + tg.name))));
      const recentNotes = store.sortNotes(store.liveNotes().filter(n => !(store.isConcealed(n) && store.book(n.bookId)?.locked))).slice(0, 5);
      if (recentNotes.length) { body.append(h('span', { class: 'lbl' }, t('Baru dibuka'))); recentNotes.forEach(n => body.appendChild(resultRow(n, []))); }
      if (!recent.length && !tags.length && !recentNotes.length) body.appendChild(emptyState('search', t('Cari apa saja'), t('Judul, isi, item checklist, dan tag semuanya bisa dicari.')));
      return;
    }
    const list = filtered();
    body.appendChild(h('span', { class: 'lbl', style: 'margin-bottom:4px' }, t('{n} hasil', { n: list.length })));
    if (!list.length) {
      body.appendChild(h('div', { class: 'empty' },
        h('span', { class: 'tico', style: 'width:64px;height:64px;border-radius:22px;background:var(--k8)' }, icon('search', 'l')),
        h('b', { style: 'font-size:1.05rem' }, t('Tidak ada yang cocok')),
        h('p', { class: 'small muted' }, q ? t('Belum ada catatan berisi “{q}”.', { q }) : t('Tidak ada catatan dengan filter ini.')),
        h('div', { class: 'stack', style: 'width:100%;max-width:320px;gap:10px' },
          q ? btn(t('Buat catatan “{q}”', { q }), 'p', async (e) => { if (e?.currentTarget?.disabled) return; if (e?.currentTarget) e.currentTarget.disabled = true; const n = await store.createNote({ type: 'text', title: q, blocks: [{ id: store.uid(), t: 'text', html: '' }] }); ctx.navigate('note/' + n.id); }, 'plus') : null,
          !F.archive ? btn(t('Cari juga di Arsip'), 'g', () => { F.archive = true; draw(); }, 'archive') : null,
          filterCount() ? btn(t('Atur ulang filter'), 't', () => { resetF(); draw(); }) : null)));
      return;
    }
    list.slice(0, 200).forEach(n => body.appendChild(resultRow(n, tokens)));
  }
  function resultRow(n, tokens) {
    const concealed = store.isConcealed(n);
    const text = concealed ? t('Terkunci') : store.noteText(n).replace(/\s+/g, ' ').trim();
    const titleEl = h('h4', {}, highlight(noteTitle(n), tokens));
    const b = store.book(n.bookId);
    const row = h('button', { class: 'res', type: 'button', onClick: () => { remember(); openNote(n, ctx); } },
      typeTile(n),
      h('div', { class: 'grow' }, titleEl,
        text && text !== noteTitle(n) ? h('p', {}, highlight(text, concealed ? [] : tokens)) : null,
        h('div', { class: 'meta', style: 'margin-top:6px' }, b ? h('span', { class: 'meta' }, h('i', { style: `width:8px;height:8px;border-radius:4px;display:block;background:${bookColorVar(b)};box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)` }), b.name) : null, fmtRelative(n.updatedAt), n.archived ? ' · ' + t('Arsip') : '')));
    return row;
  }
  function resetF() { F.books.clear(); F.color = null; F.time = 'any'; F.has.clear(); F.archive = false; F.tag = null; }

  function openFilter() {
    const fc = (label, on, fn) => h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', onClick: () => { fn(); drawSheet(); draw(); } }, label);
    const content = h('div', { class: 'stack' });
    const drawSheet = () => {
      content.replaceChildren(
        h('span', { class: 'lbl' }, t('Buku')),
        h('div', { class: 'chips wrapx' }, fc(t('Semua'), !F.books.size, () => F.books.clear()),
          ...store.books().map(b => fc(b.name, F.books.has(b.id), () => { F.books.has(b.id) ? F.books.delete(b.id) : F.books.add(b.id); })),
          fc(t('Tanpa buku'), F.books.has(null), () => { F.books.has(null) ? F.books.delete(null) : F.books.add(null); })),
        h('span', { class: 'lbl' }, t('Warna kartu')),
        colorRow(F.color === null ? '__' : F.color, k => { F.color = F.color === k ? null : k; drawSheet(); draw(); }, 30),
        h('span', { class: 'lbl' }, t('Waktu diubah')),
        h('div', { class: 'seg' }, [['any', t('Kapan saja')], ['d7', t('7 hari')], ['d30', t('30 hari')], ['d365', t('1 tahun')]].map(([k, l]) => h('button', { type: 'button', class: F.time === k ? 'on' : '', onClick: () => { F.time = k; drawSheet(); draw(); } }, l))),
        h('span', { class: 'lbl' }, t('Berisi')),
        h('div', { class: 'chips wrapx' }, [['image', t('Foto')], ['audio', t('Suara')], ['check', t('Checklist')], ['reminder', t('Pengingat')], ['pinned', t('Tersemat')]].map(([k, l]) => fc(l, F.has.has(k), () => { F.has.has(k) ? F.has.delete(k) : F.has.add(k); }))),
        h('div', { class: 'row', style: 'border:0;padding:0' }, h('span', { class: 'grow' }, t('Sertakan Arsip')),
          h('button', { class: 'tg' + (F.archive ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': F.archive ? 'true' : 'false', 'aria-label': t('Sertakan Arsip'), onClick: () => { F.archive = !F.archive; drawSheet(); draw(); } })),
        h('div', { class: 'row-flex' }, btn(t('Atur ulang'), 'g', () => { resetF(); drawSheet(); draw(); }), btn(t('Tampilkan {n} hasil', { n: filtered().length }), 'p grow', () => s.close())));
    };
    drawSheet();
    const s = sheet(t('Filter'), content);
  }

  draw();
  ctx.watch(['notes'], draw);
}
