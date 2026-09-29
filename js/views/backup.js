// Lembar · Backup, pulihkan, ekspor
import * as store from '../store.js';
import { h, clear, toggle, snack, pickFile, download, shareOrDownload, btn } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtRelative, fmtBytes, fmtDayYear, fmtTime, fmtNum } from '../i18n.js';
import { header } from '../components.js';
import { noteAsMarkdown, noteAsText, printNotes } from '../lib/share.js';
import { makeZip } from '../lib/zip.js';

const stamp = () => store.dayKey();

export function render(view, args, ctx) {
  view.appendChild(header(t('Backup & pulihkan'), { backTo: 'settings' }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  let state = 'idle', lastFile = null, prog = 0;
  const draw = async () => {
    const s = store.settings();
    clear(body);
    const notes = store.allNotes().filter(n => !n.trashedAt);
    const atts = await store.allAttachments();
    const attSize = atts.reduce((a, x) => a + (x.size || 0), 0);
    body.append(h('div', { style: 'border-radius:20px;background:var(--k2);padding:16px;display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'row-flex', style: 'gap:10px' }, h('span', { class: 'tico', style: 'background:var(--surface)' }, icon('shieldok')),
        h('div', {}, h('b', { style: 'font-size:.94rem' }, t('Backup terakhir')), h('div', { class: 'small', style: 'color:var(--ink2)' }, s.lastBackup ? fmtDayYear(s.lastBackup) + ' · ' + fmtTime(s.lastBackup) : t('Belum pernah')))),
      h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('b', {}, fmtNum(notes.length)), h('span', {}, t('catatan'))),
        h('div', { class: 'kpi' }, h('b', {}, fmtNum(atts.length)), h('span', {}, t('lampiran'))),
        h('div', { class: 'kpi' }, h('b', {}, fmtBytes(attSize)), h('span', {}, t('media'))))));
    if (state === 'idle') body.appendChild(btn(t('Buat backup sekarang'), 'p', makeBackup, 'download'));
    if (state === 'busy') body.appendChild(h('div', { class: 'group', style: 'padding:14px;display:flex;flex-direction:column;gap:10px' }, h('b', { style: 'font-size:.9rem' }, t('Membuat backup…')), h('div', { class: 'prog', style: 'height:8px' }, h('i', { style: `width:${prog}%;background:var(--accent)` })), h('span', { class: 'small muted' }, t('Mengemas catatan dan lampiran'))));
    if (state === 'done' && lastFile) body.appendChild(h('div', { class: 'group', style: 'padding:14px;display:flex;gap:12px;align-items:center' },
      h('span', { class: 'tico k2' }, icon('tick')),
      h('div', { class: 'grow' }, h('b', { style: 'font-size:.875rem;overflow-wrap:anywhere' }, lastFile.name), h('div', { class: 'small muted' }, fmtBytes(lastFile.size) + ' · ' + t('Tersimpan di folder Download'))),
      btn(t('Bagikan'), 'g sm', () => shareOrDownload(lastFile, lastFile.name, 'Backup Lembar'))));
    body.append(
      h('div', { class: 'group' },
        h('div', { class: 'row' }, h('span', { class: 'grow' }, t('Sertakan foto, suara & sketsa'), h('span', { class: 'sub' }, t('File lebih besar, tapi lengkap'))), toggle(s.backupMedia !== false, v => store.setSetting('backupMedia', v), t('Sertakan media'))),
        h('div', { class: 'row' }, h('span', { class: 'grow' }, t('Ingatkan backup tiap minggu'), h('span', { class: 'sub' }, t('Muncul sebagai kartu di Beranda'))), toggle(s.backupRemind !== false, v => store.setSetting('backupRemind', v), t('Ingatkan backup')))),
      h('span', { class: 'lbl' }, t('Pulihkan & pindah HP')),
      h('div', { class: 'group', style: 'padding:14px 16px;display:flex;flex-direction:column;gap:10px' },
        step(1, t('Buat backup di HP lama, lalu kirim file .lembar lewat WhatsApp, Drive, atau kabel.')),
        step(2, t('Di HP baru, pasang Lembar lalu ketuk “Pilih file .lembar”.')),
        step(3, t('Pilih Gabungkan supaya catatan yang sudah ada tidak terhapus.')),
        btn(t('Pilih file .lembar'), 'g', openRestore, 'upload')),
      h('a', { class: 'row', href: '#/export', style: 'padding:4px 2px' }, icon('print'), h('span', { class: 'grow' }, t('Ekspor ke PDF / Markdown / Teks')), icon('right', 's')));
  };
  const step = (n, text) => h('div', { class: 'row-flex', style: 'align-items:flex-start;gap:10px;font-size:.84rem;line-height:1.45;color:var(--ink2)' }, h('b', { style: 'width:22px;height:22px;border-radius:11px;background:var(--ink);color:var(--paper);font-size:.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0' }, n), text);

  async function makeBackup() {
    state = 'busy'; prog = 15; draw();
    try {
      const data = await store.exportData({ media: store.settings().backupMedia !== false });
      prog = 70; draw();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const file = new File([blob], `lembar-${stamp()}.lembar`, { type: 'application/json' });
      download(file, file.name);
      await store.setSetting('lastBackup', Date.now());
      lastFile = file; state = 'done';
    } catch (e) { console.error(e); snack(t('Backup gagal: {e}', { e: e.message })); state = 'idle'; }
    draw();
  }

  async function openRestore() {
    const files = await pickFile({ accept: '.lembar,application/json' });
    if (!files.length) return;
    let data;
    try { data = JSON.parse(await files[0].text()); if (data.app !== 'lembar') throw new Error('x'); }
    catch (e) { snack(t('File ini bukan backup Lembar')); return; }
    restoreFlow(view, data, files[0], ctx);
  }
  draw();
  ctx.watch(['settings'], () => { if (state !== 'busy') draw(); });
}

function restoreFlow(view, data, file, ctx) {
  let mode = 'merge', state = 'choose', result = null, prog = 0;
  clear(view);
  view.appendChild(header(t('Pulihkan backup'), { back: () => ctx.navigate('backup', { replace: true }) }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  const existing = store.allNotes().length;
  const inFile = new Set(data.notes.map(n => n.id));
  const lost = store.allNotes().filter(n => !inFile.has(n.id)).length;
  const draw = () => {
    clear(body);
    body.appendChild(h('div', { style: 'border-radius:20px;background:var(--k3);padding:16px;display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'row-flex', style: 'gap:10px' }, h('span', { class: 'tico', style: 'background:var(--surface)' }, icon('file')),
        h('div', { style: 'min-width:0' }, h('b', { style: 'font-size:.9rem;overflow-wrap:anywhere' }, file.name), h('div', { class: 'small', style: 'color:var(--ink2)' }, t('Dibuat {w}', { w: fmtRelative(data.exportedAt) }) + ' · ' + fmtBytes(file.size)))),
      h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('b', {}, data.notes.length), h('span', {}, t('catatan'))),
        h('div', { class: 'kpi' }, h('b', {}, (data.books || []).length), h('span', {}, t('buku'))),
        h('div', { class: 'kpi' }, h('b', {}, (data.attachments || []).length), h('span', {}, t('lampiran'))))));
    if (state === 'choose') {
      const choice = (k, title, sub) => h('button', { type: 'button', class: 'lrow', style: mode === k ? 'border-color:var(--accent);background:var(--accent-soft)' : '', 'aria-pressed': mode === k ? 'true' : 'false', onClick: () => { mode = k; draw(); } },
        h('span', { style: `width:22px;height:22px;border-radius:11px;border:2px solid ${mode === k ? 'var(--accent)' : 'var(--line)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px` }, mode === k ? h('i', { style: 'width:10px;height:10px;border-radius:5px;background:var(--accent);display:block' }) : null),
        h('div', { class: 'body-t' }, h('h4', { style: 'font-family:var(--sans);font-size:.9rem' }, title), h('p', { style: '-webkit-line-clamp:3' }, sub)));
      body.append(h('span', { class: 'lbl' }, t('Cara memulihkan')),
        choice('merge', t('Gabungkan (disarankan)'), t('Catatan yang sudah ada tetap aman. Jika ada yang sama, versi terbaru yang dipakai.')),
        choice('replace', t('Ganti semua'), t('Semua catatan di HP ini dihapus lalu diganti isi backup.')),
        mode === 'replace' && existing ? h('div', { class: 'notice', style: 'background:var(--danger-soft);color:var(--danger)' }, icon('warn', 's'), lost ? t('{n} catatan yang tidak ada di backup akan hilang.', { n: lost }) : t('Catatan di HP ini akan diganti isi backup.')) : null,
        btn(t('Pulihkan sekarang'), 'p', go));
    } else if (state === 'busy') {
      body.appendChild(h('div', { class: 'group', style: 'padding:16px;display:flex;flex-direction:column;gap:10px' },
        h('div', { class: 'row-flex', style: 'justify-content:space-between;font-weight:700;font-size:.875rem' }, t('Memulihkan…'), prog + '%'),
        h('div', { class: 'prog', style: 'height:8px' }, h('i', { style: `width:${prog}%;background:var(--accent)` })),
        h('span', { class: 'small muted' }, t('Jangan tutup aplikasi sampai selesai.'))));
    } else {
      body.appendChild(h('div', { class: 'empty' },
        h('div', { style: 'width:76px;height:76px;border-radius:38px;background:var(--k2);color:var(--ok);display:flex;align-items:center;justify-content:center' }, icon('tick', 'l')),
        h('h2', { class: 'h2' }, t('Pemulihan selesai')),
        h('p', { class: 'small muted' }, t('{a} catatan ditambahkan, {b} diperbarui ke versi terbaru.', { a: result.added, b: result.updated })),
        btn(t('Lihat catatan'), 'p', () => ctx.navigate('home', { replace: true }))));
    }
  };
  async function go() {
    state = 'busy'; draw();
    try {
      result = await store.importData(data, mode, (d, total) => { const p = Math.round(d / Math.max(1, total) * 100); if (p !== prog) { prog = p; const bar = body.querySelector('.prog i'); if (bar) bar.style.width = p + '%'; } });
      state = 'done';
    } catch (e) { console.error(e); snack(t('Pemulihan gagal: {e}', { e: e.message })); state = 'choose'; }
    draw();
  }
  draw();
}

export function renderExport(view, args, ctx) {
  let fmt = 'pdf', scope = 'all', split = false;
  const sel = new Set();
  view.appendChild(header(t('Ekspor catatan'), { backTo: 'backup' }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  const pool = () => store.liveNotes().filter(n => !store.isLockedNote(n)).filter(n => scope === 'all' || sel.has(n.bookId || '_none'));
  const draw = () => {
    clear(body);
    const f = (k, title, sub) => h('button', { type: 'button', class: 'qa', style: `padding:14px 8px;${fmt === k ? 'border-color:var(--accent);background:var(--accent-soft)' : ''}`, 'aria-pressed': fmt === k ? 'true' : 'false', onClick: () => { fmt = k; draw(); } }, icon('file'), h('b', { style: 'font-size:.875rem' }, title), h('span', { class: 'muted', style: 'font-size:.69rem;line-height:1.3' }, sub));
    const books = [...store.books(), { id: '_none', name: t('Tanpa buku') }];
    body.append(
      h('span', { class: 'lbl' }, t('Format')),
      h('div', { class: 'quickacts', style: 'grid-template-columns:repeat(3,minmax(0,1fr))' }, f('pdf', 'PDF', t('Siap cetak & dibagikan')), f('md', 'Markdown', t('Untuk aplikasi catatan lain')), f('txt', t('Teks'), t('Paling sederhana'))),
      h('span', { class: 'lbl' }, t('Cakupan')),
      h('div', { class: 'seg' }, [['all', t('Semua catatan')], ['books', t('Pilih buku')]].map(([k, l]) => h('button', { type: 'button', class: scope === k ? 'on' : '', onClick: () => { scope = k; draw(); } }, l))),
      scope === 'books' ? h('div', { class: 'chips wrapx' }, books.filter(b => !b.locked).map(b => h('button', { class: 'chip' + (sel.has(b.id) ? ' on' : ''), type: 'button', onClick: () => { sel.has(b.id) ? sel.delete(b.id) : sel.add(b.id); draw(); } }, b.name))) : null,
      fmt !== 'pdf' ? h('div', { class: 'group' }, h('div', { class: 'row' }, h('span', { class: 'grow' }, t('Satu file per buku'), h('span', { class: 'sub' }, t('Dikemas dalam satu file .zip'))), toggle(split, v => { split = v; }, t('Satu file per buku')))) : null,
      h('div', { class: 'notice k1' }, icon('lock', 's'), t('Catatan terkunci tidak ikut diekspor. Foto hanya disertakan di PDF.')),
      btn(t('Ekspor {n} catatan', { n: pool().length }), 'p', run, 'download'));
  };
  async function run() {
    const list = store.sortNotes(pool());
    if (!list.length) { snack(t('Tidak ada catatan untuk diekspor')); return; }
    if (fmt === 'pdf') { printNotes(list); return; }
    const conv = fmt === 'md' ? noteAsMarkdown : noteAsText;
    const ext = fmt === 'md' ? 'md' : 'txt';
    const sep = fmt === 'md' ? '\n\n---\n\n' : '\n\n==========\n\n';
    if (!split) {
      const blob = new Blob([list.map(conv).join(sep)], { type: fmt === 'md' ? 'text/markdown' : 'text/plain' });
      await shareOrDownload(blob, `lembar-${stamp()}.${ext}`, 'Lembar');
    } else {
      const groups = new Map();
      for (const n of list) { const k = store.book(n.bookId)?.name || t('Tanpa buku'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
      const files = [...groups.entries()].map(([name, ns]) => ({ name: name.replace(/[\\/:*?"<>|]/g, '-') + '.' + ext, data: ns.map(conv).join(sep) }));
      await shareOrDownload(makeZip(files), `lembar-${stamp()}.zip`, 'Lembar');
    }
    snack(t('Ekspor selesai'));
  }
  draw();
}
