// Lembar · editor catatan (teks kaya, checklist, foto, suara, sketsa, jurnal)
import * as store from '../store.js';
import { h, clear, iconBtn, snack, sheet, confirm, debounce, sanitizeHTML, escapeHTML, fullscreen, pickFile, vibrate } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtRelative, fmtWhen, fmtDur, fmtBytes, fmtDate } from '../i18n.js';
import { bookChip, noteTitle, MOODS, moodFace, checkStats, resample, emptyState } from '../components.js';
import { pickBook, pickTags, pickReminder, colorRow } from '../pickers.js';
import { requestUnlock, setupPin } from './lock.js';
import { recordAudio } from '../lib/recorder.js';
import { imageBlocks } from '../lib/create.js';
import { openShare } from '../lib/share.js';
import { ensureNotifyPermission } from '../lib/reminders.js';

const uid = store.uid;
const players = new Set();
const stopPlayers = (except) => players.forEach(a => { if (a !== except) a.pause(); });
const REPEAT_LABEL = { daily: 'Setiap hari', weekly: 'Setiap minggu', monthly: 'Setiap bulan' };

export function isEmptyNote(n) {
  if (n.mood != null) return false;
  if (n.reminder || (n.tags && n.tags.length) || n.pinned || n.locked || n.color) return false;
  if (n.type !== 'journal' && n.title && n.title.trim()) return false;
  for (const b of n.blocks) {
    if (b.att) return false;
    if ((b.t === 'text' || b.t === 'prompt') && store.htmlToText(b.html).trim()) return false;
    if (b.t === 'check' && b.items.some(i => i.text.trim())) return false;
  }
  return true;
}

export async function render(view, [id], ctx, query = {}) {
  const note = store.note(id);
  if (!note) {
    view.append(h('div', { class: 'hdr' }, iconBtn('back', t('Kembali'), () => ctx.back())), emptyState('file', t('Catatan tidak ditemukan'), t('Mungkin sudah dihapus permanen.')));
    return;
  }
  if (store.isConcealed(note)) {
    view.append(h('div', { class: 'hdr' }, iconBtn('back', t('Kembali'), () => ctx.back())),
      h('div', { class: 'locked-view' },
        h('span', { class: 'tico k4', style: 'width:72px;height:72px;border-radius:24px' }, icon('lock', 'l')),
        h('h2', { class: 'h2' }, t('Catatan ini terkunci')),
        h('p', { class: 'small muted', style: 'margin:0' }, t('Masukkan PIN untuk membukanya.')),
        h('button', { class: 'btn p', type: 'button', onClick: async () => { if (await requestUnlock({ title: t('Catatan terkunci') })) { clear(view); render(view, [id], ctx, query); } } }, icon('unlock', 's'), t('Buka'))));
    return;
  }

  // ---------- state ----------
  let lastFocus = null; // { blockId, el }
  let savedRange = null;
  const blockEls = new Map();
  const savedEl = h('span', { class: 'saved' }, icon('tick', 's'), t('Tersimpan'));
  const setSaved = busy => { savedEl.classList.toggle('busy', busy); savedEl.replaceChildren(busy ? '' : icon('tick', 's'), busy ? t('Menyimpan…') : t('Tersimpan')); };

  let dirty = false;
  let leaving = false; // true saat pindah ke sketsa: jangan hapus catatan kosong
  let disposed = false, hideUndo = null;
  const removedAtts = new Set();
  const doSave = async () => {
    collect();
    dirty = false;
    await store.saveNote(note);
    setSaved(false);
    drawMeta();
  };
  const save = debounce(doSave, 500);
  const touch = () => { dirty = true; setSaved(true); save(); };

  function collect() {
    note.title = titleEl.value.replace(/\n/g, ' ');
    for (const b of note.blocks) {
      const el = blockEls.get(b.id);
      if (!el) continue;
      if (b.t === 'text' || b.t === 'prompt') { const rt = el.querySelector('.rt'); if (rt) b.html = cleanHTML(rt.innerHTML); }
    }
  }
  function cleanHTML(html) {
    const s = html.replace(/<br\s*\/?>\s*$/i, '');
    return /^(\s|&nbsp;|<br\s*\/?>|<div>(<br\s*\/?>)?<\/div>)*$/i.test(s) ? '' : s;
  }

  // ---------- top bar ----------
  const chipHost = h('span');
  const drawChip = () => chipHost.replaceChildren(bookChip(note, async () => {
    const b = await pickBook(note.bookId);
    if (b === undefined) return;
    note.bookId = b; await store.saveNote(note, { touch: false }); drawChip();
  }));
  drawChip();
  const top = h('div', { class: 'ed-top' },
    iconBtn('back', t('Kembali'), () => ctx.back()),
    chipHost, h('span', { class: 'grow' }), savedEl,
    iconBtn('share', t('Bagikan'), () => { save.flush(); openShare(note); }),
    iconBtn('more', t('Lainnya'), () => openMenu()));

  // ---------- body ----------
  const scroller = h('div', { class: 'scroll' });
  const doc = h('div', { class: 'doc pad-b' });
  const metaEl = h('div', { class: 'meta' });
  const titleEl = h('textarea', { class: 'doc-title', rows: 1, placeholder: note.type === 'checklist' ? t('Judul daftar') : t('Judul'), 'aria-label': t('Judul catatan'), maxlength: 200 });
  titleEl.value = note.title || '';
  const autoGrow = () => { titleEl.style.height = 'auto'; titleEl.style.height = titleEl.scrollHeight + 'px'; };
  titleEl.addEventListener('input', () => { autoGrow(); touch(); });
  titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); focusFirstEditable(); } });
  const moodHost = h('div');
  const infoHost = h('div', { class: 'meta-bar' });
  const tagsHost = h('div', { class: 'edtags' });
  const progHost = h('div');
  const blocksHost = h('div', { class: 'stack', style: 'gap:10px' });
  const backHost = h('div');
  doc.append(metaEl, titleEl, moodHost, infoHost, tagsHost, progHost, blocksHost, backHost);
  scroller.appendChild(doc);
  const sugg = h('div', { class: 'sugg', hidden: true, role: 'listbox', 'aria-label': t('Tautkan ke catatan') });
  const toolbar = buildToolbar();
  view.append(top, scroller, sugg, toolbar);
  view.classList.add('editor');
  if (note.color) view.classList.add(note.color);
  if (note.trashedAt) view.insertBefore(h('div', { class: 'notice k4', style: 'margin:0 12px 6px' }, icon('trash', 's'), h('span', { class: 'grow' }, t('Catatan ini ada di Sampah.')), h('button', { class: 'btn g sm', type: 'button', onClick: async () => { await store.restoreNotes([note.id]); snack(t('Catatan dipulihkan')); ctx.refresh(); } }, t('Pulihkan'))), scroller);
  if (note.archived) view.insertBefore(h('div', { class: 'notice k7', style: 'margin:0 12px 6px' }, icon('archive', 's'), h('span', { class: 'grow' }, t('Catatan ini diarsipkan.')), h('button', { class: 'btn g sm', type: 'button', onClick: async () => { await store.archiveNotes([note.id], false); snack(t('Dikeluarkan dari arsip')); ctx.refresh(); } }, t('Keluarkan'))), scroller);

  function drawMeta() {
    metaEl.replaceChildren(t('Diubah {t}', { t: fmtRelative(note.updatedAt) }) + ' · ' + t('{n} kata', { n: store.wordCount(note) }));
    drawTags(); drawProgress();
  }
  function drawInfo() {
    clear(infoHost);
    if (note.pinned) infoHost.appendChild(h('span', { class: 'pill' }, icon('pin', 'xs'), t('Tersemat')));
    if (store.isLockedNote(note)) infoHost.appendChild(h('span', { class: 'pill' }, icon('lock', 'xs'), t('Terkunci')));
    if (note.reminder && !note.reminder.done) {
      const r = note.reminder;
      infoHost.appendChild(h('button', { class: 'pill', type: 'button', onClick: editReminder }, icon('bell', 'xs'), fmtWhen(r.at) + (r.repeat && r.repeat !== 'none' ? ' · ' + t(REPEAT_LABEL[r.repeat]) : '')));
    }
  }
  function drawTags() {
    const all = store.noteTags(note);
    const explicit = new Set((note.tags || []).map(x => x.toLowerCase()));
    tagsHost.replaceChildren(...all.map(tg => h('span', { class: 'tagpill' }, '#' + tg,
      explicit.has(tg) ? h('button', { type: 'button', 'aria-label': t('Hapus tag {t}', { t: tg }), onClick: async () => { note.tags = note.tags.filter(x => x.toLowerCase() !== tg); await store.saveNote(note, { touch: false }); drawTags(); } }, icon('close', 'xs')) : null)),
      h('button', { class: 'tagadd', type: 'button', onClick: async () => { const r = await pickTags(note.tags || []); if (!r) return; note.tags = r; await store.saveNote(note, { touch: false }); drawTags(); } }, '+ ' + t('tag')));
  }
  function drawProgress() {
    clear(progHost);
    if (note.type !== 'checklist') return;
    const { total, done } = checkStats(note);
    if (!total) return;
    progHost.appendChild(h('div', { class: 'cl-prog' },
      h('div', { class: 'prog', style: 'height:8px' }, h('i', { style: `width:${Math.round(done / total * 100)}%` })),
      h('span', { class: 'meta' }, t('{d} dari {n} selesai', { d: done, n: total }))));
  }
  function drawMood() {
    clear(moodHost);
    if (note.type !== 'journal') return;
    moodHost.appendChild(h('div', { class: 'moods', role: 'radiogroup', 'aria-label': t('Mood hari ini'), style: 'background:var(--surface);border-radius:20px;padding:10px 8px' },
      MOODS.map((m, i) => h('button', { type: 'button', class: 'mood' + (note.mood === i ? ' on' : ''), role: 'radio', 'aria-checked': note.mood === i ? 'true' : 'false', onClick: async () => { note.mood = note.mood === i ? null : i; vibrate(8); drawMood(); await doSave(); } },
        h('b', { style: `background:${m.c}` }, moodFace(i)), t(m.n)))));
  }

  // ---------- blok ----------
  function drawBlocks() {
    stopPlayers(); savedRange = null;
    clear(blocksHost); blockEls.clear();
    note.blocks.forEach((b, i) => { const el = renderBlock(b, i); blockEls.set(b.id, el); blocksHost.appendChild(el); });
  }
  function ensureTrailingText() {
    const last = note.blocks[note.blocks.length - 1];
    if (!last || ['image', 'audio', 'sketch'].includes(last.t)) note.blocks.push({ id: uid(), t: 'text', html: '' });
  }
  function renderBlock(b, i) {
    const wrap = h('div', { class: 'blk', 'data-bid': b.id });
    wrap.addEventListener('focusin', () => { lastFocus = { blockId: b.id }; });
    if (b.t === 'text' || b.t === 'prompt') {
      if (b.label) wrap.appendChild(h('div', { class: 'prompt-lbl' }, b.label));
      const firstText = note.blocks.findIndex(x => x.t === 'text' || x.t === 'prompt') === i;
      const rt = h('div', { class: 'rt', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': b.label || t('Isi catatan'), 'data-ph': b.label ? t('Ketuk untuk menulis…') : (firstText ? t('Mulai menulis… ketik # untuk tag, [[ untuk menautkan catatan') : t('Lanjut menulis…')), spellcheck: 'true' });
      rt.innerHTML = sanitizeHTML(b.html);
      rt.addEventListener('input', () => { touch(); checkLinkTrigger(rt); });
      rt.addEventListener('keydown', e => onRtKey(e, rt));
      rt.addEventListener('paste', e => { e.preventDefault(); const txt = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, txt); });
      rt.addEventListener('blur', () => { setTimeout(() => { if (!sugg.contains(document.activeElement)) hideSugg(); }, 150); });
      wrap.appendChild(rt);
    } else if (b.t === 'check') {
      if (b.label) wrap.appendChild(h('div', { class: 'prompt-lbl' }, b.label));
      wrap.appendChild(checklist(b));
    } else if (b.t === 'image') {
      const img = h('img', { alt: t('Foto'), loading: 'lazy' });
      if (b.w && b.h) img.style.aspectRatio = `${b.w} / ${b.h}`;
      store.attachmentURL(b.att).then(u => { img.src = u; });
      img.addEventListener('click', () => openLightbox(b));
      wrap.classList.add('img-blk');
      wrap.append(img, h('div', { class: 'blk-tools' }, iconBtn('trash', t('Hapus foto'), () => removeBlock(b))),
        b.original && b.size ? h('div', { class: 'cap' }, t('Dikompres {a} → {b}', { a: fmtBytes(b.original), b: fmtBytes(b.size) })) : null);
    } else if (b.t === 'audio') {
      wrap.appendChild(audioPlayer(b));
    } else if (b.t === 'sketch') {
      const btn = h('button', { class: 'sketch-blk', type: 'button', 'aria-label': t('Buka sketsa') });
      if (b.att) { const img = h('img', { alt: t('Sketsa') }); store.attachmentURL(b.att).then(u => { img.src = u; }); btn.appendChild(img); }
      else btn.append(h('div', { style: 'height:140px;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--muted);font-weight:700' }, icon('sketch'), t('Ketuk untuk menggambar')));
      btn.addEventListener('click', async () => { await doSave(); leaving = true; ctx.navigate('sketch/' + note.id + '/' + b.id); });
      wrap.append(btn, h('div', { class: 'blk-tools' }, iconBtn('trash', t('Hapus sketsa'), () => removeBlock(b))));
    }
    return wrap;
  }

  async function removeBlock(b) {
    const idx = note.blocks.indexOf(b);
    if (idx < 0) return;
    note.blocks.splice(idx, 1);
    if (b.att) removedAtts.add(b.att);
    ensureTrailingText();
    await doSave();
    drawBlocks();
    hideUndo = snack(t('Blok dihapus'), { label: t('Urungkan'), icon: 'undo', onClick: async () => { if (disposed) return; if (b.att) removedAtts.delete(b.att); note.blocks.splice(Math.min(idx, note.blocks.length), 0, b); await doSave(); drawBlocks(); } });
  }

  function insertBlocks(blocks) {
    collect();
    let idx = note.blocks.length;
    if (lastFocus) { const i = note.blocks.findIndex(x => x.id === lastFocus.blockId); if (i >= 0) idx = i + 1; }
    const prev = note.blocks[idx - 1];
    if (prev && (prev.t === 'text') && !store.htmlToText(prev.html).trim() && note.blocks.length > 1) { note.blocks.splice(idx - 1, 1); idx--; }
    note.blocks.splice(idx, 0, ...blocks);
    ensureTrailingText();
    drawBlocks();
    doSave();
    return idx;
  }

  // ---------- checklist ----------
  function checklist(b) {
    const root = h('div', { class: 'cl' });
    const undoneHost = h('div');
    const doneHost = h('div');
    let showDone = true;
    // blok checklist boleh dihapus kecuali satu-satunya checklist di catatan jenis Checklist
    const removable = () => note.type !== 'checklist' || note.blocks.filter(x => x.t === 'check').length > 1;
    const delItem = (it) => {
      if (b.items.length === 1) {
        if (removable() && !it.text.trim()) { removeBlock(b); return; }
        it.text = ''; it.done = false; touch(); draw(it.id); return;
      }
      const i = b.items.indexOf(it);
      b.items.splice(i, 1); touch();
      const next = b.items[Math.min(i, b.items.length - 1)] || b.items[i - 1];
      draw(next && next.id);
    };
    const draw = (focusId, atEnd = true) => {
      clear(undoneHost); clear(doneHost);
      const undone = b.items.filter(i => !i.done), done = b.items.filter(i => i.done);
      undone.forEach(it => undoneHost.appendChild(item(it)));
      undoneHost.appendChild(h('button', { class: 'cl-add', type: 'button', onClick: () => addItem(null) }, icon('plus'), t('Tambah item')));
      if (done.length) {
        doneHost.appendChild(h('button', { class: 'cl-donehd lbl', type: 'button', 'aria-expanded': showDone ? 'true' : 'false', onClick: () => { showDone = !showDone; draw(); } }, icon(showDone ? 'down' : 'right', 'xs'), t('Selesai ({n})', { n: done.length })));
        if (showDone) done.forEach(it => doneHost.appendChild(item(it)));
      }
      if (focusId) { const el = root.querySelector(`[data-iid="${focusId}"] .cl-tx`); if (el) { el.focus(); placeCaret(el, atEnd); } }
    };
    const item = (it) => {
      const tx = h('div', { class: 'cl-tx', contenteditable: 'true', role: 'textbox', 'aria-label': t('Item'), 'data-ph': t('Item baru') });
      tx.textContent = it.text;
      const cb = h('button', { class: 'cbx' + (it.done ? ' on' : ''), type: 'button', role: 'checkbox', 'aria-checked': it.done ? 'true' : 'false', 'aria-label': it.text || t('Item') }, h('span', {}, it.done ? icon('tick', 's') : null));
      cb.addEventListener('click', async () => {
        it.text = tx.textContent; it.done = !it.done; vibrate(10);
        cb.classList.add('pop'); setTimeout(() => cb.classList.remove('pop'), 160);
        await doSave(); setTimeout(() => draw(), 140);
        const st = checkStats(note);
        if (it.done && st.total && st.done === st.total) { confetti(); snack(t('Semua beres!') + ' 🎉'); }
      });
      tx.addEventListener('input', () => { it.text = tx.textContent; touch(); });
      tx.addEventListener('paste', e => {
        e.preventDefault();
        const lines = (e.clipboardData.getData('text/plain') || '').split(/\r?\n/).map(s => s.replace(/^\s*([-*•]|\[[ xX]\])\s*/, '').trim()).filter(Boolean);
        if (!lines.length) return;
        document.execCommand('insertText', false, lines[0]);
        it.text = tx.textContent;
        let at = b.items.indexOf(it);
        const extra = lines.slice(1).map(text => ({ id: uid(), text, done: false }));
        b.items.splice(at + 1, 0, ...extra);
        touch(); draw(extra.length ? extra[extra.length - 1].id : it.id);
      });
      tx.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); it.text = tx.textContent; addItem(it); }
        else if (e.key === 'Backspace' && !tx.textContent) {
          e.preventDefault();
          if (b.items.length === 1) { if (removable()) removeBlock(b); return; }
          const i = b.items.indexOf(it);
          b.items.splice(i, 1); touch();
          const prev = b.items[i - 1] || b.items[i];
          draw(prev && prev.id);
        }
      });
      const row = h('div', { class: 'cl-it' + (it.done ? ' dn' : ''), 'data-iid': it.id },
        cb, tx,
        !it.done ? dragHandle(it, row => row) : null,
        h('button', { class: 'cl-del', type: 'button', 'aria-label': t('Hapus item'), onClick: () => { it.text = tx.textContent; delItem(it); } }, icon('close', 's')));
      return row;
    };
    const addItem = (after) => {
      const ni = { id: uid(), text: '', done: false };
      let last = -1; b.items.forEach((x, k) => { if (!x.done) last = k; });
      const at = after ? b.items.indexOf(after) + 1 : last + 1;
      b.items.splice(at, 0, ni); touch(); draw(ni.id);
    };
    const dragHandle = (it) => {
      const hnd = h('button', { class: 'cl-drag', type: 'button', 'aria-label': t('Geser untuk mengurutkan') }, icon('drag', 's'));
      hnd.addEventListener('pointerdown', e => {
        e.preventDefault();
        const row = hnd.closest('.cl-it');
        const rows = [...undoneHost.querySelectorAll('.cl-it')];
        const startY = e.clientY; let idx = rows.indexOf(row); const orig = idx;
        const hgt = row.offsetHeight;
        row.classList.add('dragging'); hnd.setPointerCapture(e.pointerId);
        const move = ev => {
          const dy = ev.clientY - startY;
          row.style.transform = `translateY(${dy}px)`;
          const target = Math.max(0, Math.min(rows.length - 1, orig + Math.round(dy / hgt)));
          if (target !== idx) {
            idx = target;
            rows.forEach((r, i) => { if (r === row) return; let shift = 0; if (orig < idx && i > orig && i <= idx) shift = -hgt; if (orig > idx && i < orig && i >= idx) shift = hgt; r.style.transform = shift ? `translateY(${shift}px)` : ''; r.style.transition = 'transform .15s'; });
          }
        };
        const up = () => {
          hnd.removeEventListener('pointermove', move); hnd.removeEventListener('pointerup', up); hnd.removeEventListener('pointercancel', up);
          rows.forEach(r => { r.style.transform = ''; r.style.transition = ''; }); row.classList.remove('dragging');
          if (idx !== orig) {
            const undone = b.items.filter(i => !i.done); const done = b.items.filter(i => i.done);
            const [m] = undone.splice(orig, 1); undone.splice(idx, 0, m);
            b.items = [...undone, ...done]; touch(); vibrate(8);
          }
          draw();
        };
        hnd.addEventListener('pointermove', move); hnd.addEventListener('pointerup', up); hnd.addEventListener('pointercancel', up);
      });
      return hnd;
    };
    root.append(undoneHost, doneHost);
    draw();
    return root;
  }

  // ---------- audio ----------
  function audioPlayer(b) {
    const audio = new Audio(); audio.preload = 'metadata'; players.add(audio);
    store.attachmentURL(b.att).then(u => { audio.src = u; });
    const peaks = resample(b.peaks || [], 44);
    const bars = peaks.map(v => h('i', { style: `height:${Math.max(4, Math.round(v * 32))}px` }));
    const wave = h('div', { class: 'wave', role: 'slider', 'aria-label': t('Posisi rekaman'), tabindex: '0' }, bars);
    const playBtn = h('button', { class: 'play', type: 'button', 'aria-label': t('Putar rekaman') }, icon('play', 's'));
    const time = h('span', {}, '0:00 / ' + fmtDur(b.dur));
    const speeds = [1, 1.5, 2]; let sp = 0;
    const spBtn = h('button', { class: 'tagpill', type: 'button', style: 'border:0;background:var(--surface)', onClick: () => { sp = (sp + 1) % 3; audio.playbackRate = speeds[sp]; spBtn.textContent = speeds[sp].toLocaleString(document.documentElement.lang) + '×'; } }, '1×');
    const upd = () => {
      const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : b.dur || 1;
      const p = audio.currentTime / dur;
      bars.forEach((el, i) => el.classList.toggle('dim', i / bars.length > p));
      time.textContent = fmtDur(audio.currentTime) + ' / ' + fmtDur(b.dur || dur);
      wave.setAttribute('aria-valuenow', Math.round(p * 100));
    };
    bars.forEach(el => el.classList.add('dim'));
    audio.addEventListener('timeupdate', upd);
    const setPlayIcon = () => { playBtn.replaceChildren(icon('play', 's')); playBtn.setAttribute('aria-label', t('Putar rekaman')); };
    audio.addEventListener('ended', () => { setPlayIcon(); audio.currentTime = 0; upd(); });
    playBtn.addEventListener('click', () => {
      if (audio.paused) { stopPlayers(audio); audio.play().catch(() => snack(t('Rekaman tidak bisa diputar'))); playBtn.replaceChildren(icon('pause', 's')); playBtn.setAttribute('aria-label', t('Jeda rekaman')); }
      else { audio.pause(); playBtn.replaceChildren(icon('play', 's')); playBtn.setAttribute('aria-label', t('Putar rekaman')); }
    });
    audio.addEventListener('pause', setPlayIcon);
    wave.addEventListener('click', e => { const r = wave.getBoundingClientRect(); const p = (e.clientX - r.left) / r.width; const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : b.dur; if (!dur) return; audio.currentTime = Math.max(0, p * dur); upd(); });
    return h('div', { class: 'audio' },
      h('div', { class: 'row-flex', style: 'gap:12px' }, playBtn, wave),
      h('div', { class: 'meta', style: 'justify-content:space-between;color:var(--ink2)' }, time,
        h('span', { class: 'row-flex', style: 'gap:6px' }, spBtn, h('button', { class: 'tagpill', type: 'button', style: 'border:0;background:var(--surface)', onClick: () => removeBlock(b) }, t('Hapus')))));
  }

  // ---------- rich text ----------
  function onRtKey(e, rt) {
    if (!sugg.hidden) {
      const items = [...sugg.querySelectorAll('button')];
      const cur = items.findIndex(x => x.classList.contains('on'));
      if (e.key === 'ArrowDown') { e.preventDefault(); items.forEach(x => x.classList.remove('on')); items[(cur + 1) % items.length]?.classList.add('on'); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); items.forEach(x => x.classList.remove('on')); items[(cur - 1 + items.length) % items.length]?.classList.add('on'); return; }
      if (e.key === 'Enter' && items.length) { e.preventDefault(); (items[cur] || items[0]).click(); return; }
      if (e.key === 'Escape') { hideSugg(); return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); cmd('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); cmd('italic'); }
  }
  function cmd(name, arg) {
    const sel = window.getSelection();
    const ae = document.activeElement;
    if (name === 'insertText' && ae && view.contains(ae) && (ae === titleEl || ae.classList.contains('cl-tx'))) { document.execCommand('insertText', false, arg); return; }
    const inRt = sel.anchorNode && sel.anchorNode.parentElement && sel.anchorNode.parentElement.closest ? sel.anchorNode.parentElement.closest('.rt') || (sel.anchorNode.classList && sel.anchorNode.classList.contains('rt') ? sel.anchorNode : null) : null;
    if (!inRt) {
      const target = lastFocus && blockEls.get(lastFocus.blockId)?.querySelector('.rt') || blocksHost.querySelector('.rt');
      if (!target) return;
      target.focus();
      if (savedRange && target.contains(savedRange.startContainer)) { sel.removeAllRanges(); sel.addRange(savedRange); } else placeCaret(target, true);
    }
    if (name === 'block') {
      const cur = document.queryCommandValue('formatBlock').toLowerCase();
      document.execCommand('formatBlock', false, cur === arg ? 'div' : arg);
    } else document.execCommand(name, false, arg);
    touch(); updateToolbar();
  }
  document.addEventListener('selectionchange', onSel);
  function onSel() {
    const sel = window.getSelection();
    if (sel.rangeCount && sel.anchorNode && view.contains(sel.anchorNode) && sel.anchorNode.parentElement?.closest('.rt')) savedRange = sel.getRangeAt(0).cloneRange();
    updateToolbar();
  }

  function buildToolbar() {
    const tb = (ic, label, fn, key) => {
      const b = h('button', { type: 'button', 'aria-label': label, title: label, 'data-k': key || '' }, typeof ic === 'string' ? icon(ic, 's') : ic);
      b.addEventListener('pointerdown', e => e.preventDefault());
      b.addEventListener('click', fn);
      return b;
    };
    return h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': t('Format dan sisipkan') },
      tb('bold', t('Tebal'), () => cmd('bold'), 'bold'),
      tb('italic', t('Miring'), () => cmd('italic'), 'italic'),
      tb(h('span', { style: 'font-size:.8rem;font-weight:800' }, 'H'), t('Judul bagian'), () => cmd('block', 'h2'), 'h2'),
      tb('list', t('Daftar'), () => cmd('insertUnorderedList'), 'ul'),
      tb('quote', t('Kutipan'), () => cmd('block', 'blockquote'), 'bq'),
      tb('code', t('Kode'), () => cmd('block', 'pre'), 'pre'),
      h('span', { class: 'sep' }),
      tb('check', t('Sisipkan checklist'), () => { const nb = { id: uid(), t: 'check', items: [{ id: uid(), text: '', done: false }] }; insertBlocks([nb]); setTimeout(() => blockEls.get(nb.id)?.querySelector('.cl-tx')?.focus(), 30); }),
      tb('photo', t('Sisipkan foto'), () => addPhotos({ accept: 'image/*', multiple: true })),
      tb('camera', t('Ambil foto'), () => addPhotos({ accept: 'image/*', capture: 'environment' })),
      tb('mic', t('Rekam suara'), () => startRecording()),
      tb('sketch', t('Sisipkan sketsa'), async () => { const nb = { id: uid(), t: 'sketch', att: null, strokes: [] }; insertBlocks([nb]); await doSave(); leaving = true; ctx.navigate('sketch/' + note.id + '/' + nb.id); }),
      tb('link', t('Tautkan catatan'), () => { cmd('insertText', '[['); const rt = document.activeElement; if (rt && rt.classList.contains('rt')) checkLinkTrigger(rt); }),
      tb('tag', t('Tambah tag'), () => cmd('insertText', '#')),
    );
  }
  function updateToolbar() {
    const map = { bold: () => document.queryCommandState('bold'), italic: () => document.queryCommandState('italic'),
      h2: () => document.queryCommandValue('formatBlock').toLowerCase() === 'h2', bq: () => document.queryCommandValue('formatBlock').toLowerCase() === 'blockquote',
      pre: () => document.queryCommandValue('formatBlock').toLowerCase() === 'pre', ul: () => document.queryCommandState('insertUnorderedList') };
    toolbar.querySelectorAll('button[data-k]').forEach(b => { const f = map[b.dataset.k]; if (f) { try { b.classList.toggle('on', !!f()); } catch (e) { /* noop */ } } });
  }

  async function addPhotos(opts) {
    const files = await pickFile(opts);
    if (!files.length) return;
    setSaved(true);
    try {
      const bl = await imageBlocks(files);
      if (!bl.length) throw new Error('no image');
      insertBlocks(bl);
    } catch (e) { console.error(e); setSaved(false); snack(t('Foto tidak bisa dibaca. Coba format JPG atau PNG.')); }
  }
  async function startRecording() {
    collect();
    const r = await recordAudio();
    if (!r) return;
    const blk = { id: uid(), t: 'audio', att: r.att, dur: r.dur, peaks: r.peaks };
    if (note.type === 'voice' && !note.blocks.some(b => b.t === 'audio')) { note.blocks.unshift(blk); ensureTrailingText(); drawBlocks(); await doSave(); }
    else insertBlocks([blk]);
    snack(t('Rekaman tersimpan · {d}', { d: fmtDur(r.dur) }));
  }

  // ---------- tautan [[ ----------
  let linkCtx = null;
  function checkLinkTrigger(rt) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return hideSugg();
    const r = sel.getRangeAt(0);
    const node = r.startContainer;
    if (node.nodeType !== 3) return hideSugg();
    const before = node.textContent.slice(0, r.startOffset);
    const m = before.match(/\[\[([^[\]\n]{0,40})$/);
    if (!m) return hideSugg();
    linkCtx = { node, start: r.startOffset - m[0].length, end: r.startOffset, query: m[1], rt };
    showSugg(m[1]);
  }
  function showSugg(q) {
    const ql = q.toLowerCase();
    const cands = store.liveNotes().filter(n => n.id !== note.id && !store.isConcealed(n))
      .map(n => ({ n, title: noteTitle(n) }))
      .filter(x => !ql || x.title.toLowerCase().includes(ql))
      .sort((a, b) => b.n.updatedAt - a.n.updatedAt).slice(0, 6);
    sugg.replaceChildren(h('span', { class: 'lbl', style: 'padding:8px 10px 4px' }, t('Tautkan ke catatan')),
      ...cands.map((c, i) => h('button', { type: 'button', class: i === 0 ? 'on' : '', role: 'option', onPointerdown: e => e.preventDefault(), onClick: () => insertLink(c.n.id, c.title) }, icon('file', 's'), h('span', { class: 'grow' }, c.title))),
      q.trim() ? h('button', { type: 'button', style: 'color:var(--accent-ink)', onPointerdown: e => e.preventDefault(), onClick: async () => { const nn = await store.createNote({ type: 'text', title: q.trim(), bookId: note.bookId, blocks: [{ id: uid(), t: 'text', html: '' }] }); insertLink(nn.id, q.trim()); } }, icon('plus', 's'), t('Buat catatan “{q}”', { q: q.trim() })) : null);
    if (!cands.length && !q.trim()) sugg.appendChild(h('span', { class: 'small muted', style: 'padding:6px 10px 10px' }, t('Ketik judul catatan yang ingin ditautkan')));
    const tbRect = toolbar.getBoundingClientRect(); const vr = view.getBoundingClientRect();
    sugg.style.bottom = (vr.bottom - tbRect.top + 8) + 'px'; sugg.style.top = 'auto';
    sugg.hidden = false;
  }
  function hideSugg() { sugg.hidden = true; linkCtx = null; }
  function insertLink(targetId, title) {
    if (!linkCtx) return;
    const { node, start, end, rt } = linkCtx;
    const range = document.createRange();
    range.setStart(node, start); range.setEnd(node, Math.min(end + (node.textContent.slice(end, end + 2) === ']]' ? 2 : 0), node.textContent.length));
    range.deleteContents();
    const a = document.createElement('a'); a.className = 'wl'; a.setAttribute('data-note', targetId); a.setAttribute('contenteditable', 'false'); a.textContent = title;
    const space = document.createTextNode(' ');
    range.insertNode(space); range.insertNode(a);
    const sel = window.getSelection(); const r2 = document.createRange(); r2.setStartAfter(space); r2.collapse(true); sel.removeAllRanges(); sel.addRange(r2);
    hideSugg(); rt.focus(); touch();
  }
  doc.addEventListener('click', async e => {
    const a = e.target.closest('a.wl');
    if (!a) return;
    e.preventDefault();
    const target = store.note(a.dataset.note);
    if (!target) { snack(t('Catatan tertaut sudah dihapus')); return; }
    await doSave();
    ctx.navigate('note/' + target.id);
  });

  function drawBacklinks() {
    clear(backHost);
    const refs = store.allNotes().filter(n => n.id !== note.id && !n.trashedAt && n.blocks.some(b => b.html && b.html.includes(`data-note="${note.id}"`)));
    if (!refs.length) return;
    let open = false;
    const list = h('div', { class: 'backlinks' });
    const btnEl = h('button', { class: 'notice', type: 'button', style: 'width:100%;background:var(--surface);border:1px solid var(--line);color:var(--ink);align-items:center', 'aria-expanded': 'false', onClick: () => {
      open = !open; btnEl.setAttribute('aria-expanded', open ? 'true' : 'false'); btnEl.lastChild.replaceWith(icon(open ? 'up' : 'down', 's'));
      list.replaceChildren(...(open ? refs.map(n => h('a', { class: 'lrow', href: '#/note/' + n.id, onClick: async e => { e.preventDefault(); await doSave(); ctx.navigate('note/' + n.id); } }, h('span', { class: 'tico' }, icon('link', 's')), h('div', { class: 'body-t' }, h('h4', {}, noteTitle(n)), h('p', {}, fmtRelative(n.updatedAt))))) : []));
    } }, icon('link', 's'), h('span', { class: 'grow', style: 'text-align:left' }, t('Disebut di {n} catatan lain', { n: refs.length })), icon('down', 's'));
    backHost.append(h('div', { class: 'sp' }), btnEl, list);
  }

  // ---------- lightbox ----------
  function openLightbox(b) {
    let fs;
    const img = h('img', { alt: t('Foto') });
    store.attachmentURL(b.att).then(u => { img.src = u; });
    fs = fullscreen(h('div', { class: 'lb' },
      h('div', { class: 'hdr', style: 'color:#fff' }, iconBtn('close', t('Tutup'), () => fs.close()), h('span', { class: 'grow' }),
        iconBtn('share', t('Bagikan foto'), async () => { const blob = await store.getAttachmentBlob(b.att); const { shareOrDownload } = await import('../ui.js'); shareOrDownload(blob, 'foto-lembar.jpg', t('Foto')); }),
        iconBtn('trash', t('Hapus foto'), () => { fs.close(); removeBlock(b); })),
      img));
  }

  // ---------- menu lainnya ----------
  async function editReminder() {
    const r = await pickReminder(note.reminder && !note.reminder.done ? note.reminder : null);
    if (r === undefined) return;
    note.reminder = r;
    await store.saveNote(note, { touch: false });
    drawInfo();
    if (r) { ensureNotifyPermission(); snack(t('Pengingat dipasang · {w}', { w: fmtWhen(r.at) })); } else snack(t('Pengingat dihapus'));
  }
  async function toggleLock() {
    if (!note.locked) {
      if (!store.hasPin()) { const ok = await confirm({ title: t('Atur PIN dulu'), message: t('Untuk mengunci catatan, buat PIN 4 digit terlebih dahulu.'), ok: t('Buat PIN'), icon: 'lock' }); if (!ok) return false; if (!(await setupPin({ requireOld: false }))) return false; }
      note.locked = true; store.session.unlocked = true;
    } else {
      if (!(await requestUnlock())) return false;
      note.locked = false;
    }
    await store.saveNote(note, { touch: false }); drawInfo();
    snack(note.locked ? t('Catatan dikunci') : t('Kunci dilepas'));
    return true;
  }
  function openMenu() {
    collect(); save.flush();
    const s2 = { close: () => {} };
    const qa = (ic, label, on, fn) => h('button', { class: 'qa' + (on ? ' on' : ''), type: 'button', onClick: fn }, icon(ic), label);
    const mrow = (ic, label, fn, cls = '', val) => h('button', { class: 'mrow ' + cls, type: 'button', onClick: fn }, icon(ic), h('span', { class: 'grow' }, label), val ? h('span', { class: 'muted', style: 'font-weight:500' }, val) : null);
    const content = h('div', { class: 'stack' },
      h('div', { class: 'quickacts' },
        qa('pin', note.pinned ? t('Tersemat') : t('Sematkan'), note.pinned, async () => { note.pinned = !note.pinned; await store.saveNote(note, { touch: false }); drawInfo(); sh.close(); snack(note.pinned ? t('Disematkan') : t('Sematan dilepas')); }),
        qa('bell', t('Pengingat'), note.reminder && !note.reminder.done, () => { sh.close(); setTimeout(editReminder, 250); }),
        qa('lock', note.locked ? t('Terkunci') : t('Kunci'), note.locked, async () => { sh.close(); setTimeout(toggleLock, 250); }),
        qa('share', t('Bagikan'), false, () => { sh.close(); setTimeout(() => openShare(note), 250); })),
      h('div', { class: 'stack', style: 'gap:10px' }, h('span', { class: 'small', style: 'font-weight:700' }, t('Warna kartu')),
        colorRow(note.color, async k => { view.classList.remove(...store.CARD_COLORS.map(c => c[0]).filter(Boolean)); if (k) view.classList.add(k); note.color = k; await store.saveNote(note, { touch: false }); })),
      h('div', { class: 'menu-list', style: 'border-top:1px solid var(--line);padding-top:6px' },
        mrow('folder', t('Pindah ke buku'), async () => { sh.close(); const b = await pickBook(note.bookId); if (b === undefined) return; note.bookId = b; await store.saveNote(note, { touch: false }); drawChip(); }, '', store.book(note.bookId)?.name || t('Tanpa buku')),
        mrow('label', t('Atur tag'), async () => { sh.close(); const r = await pickTags(note.tags || []); if (!r) return; note.tags = r; await store.saveNote(note, { touch: false }); drawTags(); }, '', t('{n} tag', { n: store.noteTags(note).length })),
        mrow('template', t('Simpan sebagai template'), async () => { sh.close(); const { saveNoteAsTemplate } = await import('../lib/create.js'); await saveNoteAsTemplate(note); }),
        mrow('copy', t('Duplikat'), async () => { sh.close(); const c = await store.duplicateNote(note.id); snack(t('Catatan diduplikat')); ctx.navigate('note/' + c.id); }),
        mrow('archive', note.archived ? t('Keluarkan dari arsip') : t('Arsipkan'), async () => { sh.close(); const was = note.archived; const wasPinned = note.pinned; await store.archiveNotes([note.id], !was); if (!was) { ctx.back(); snack(t('Catatan diarsipkan'), { label: t('Urungkan'), icon: 'undo', onClick: async () => { await store.archiveNotes([note.id], false); if (wasPinned) await store.patchNotes([note.id], { pinned: true }); } }); } else snack(t('Dikeluarkan dari arsip')); }),
        mrow('trash', t('Pindahkan ke Sampah'), async () => { sh.close(); const wasPinned = note.pinned; await store.trashNotes([note.id]); ctx.back(); snack(t('1 catatan dipindah ke Sampah'), { label: t('Urungkan'), icon: 'undo', onClick: async () => { await store.restoreNotes([note.id]); if (wasPinned) await store.patchNotes([note.id], { pinned: true }); } }); }, 'danger')),
      h('div', { class: 'meta', style: 'justify-content:center;font-weight:500' }, t('Dibuat {a} · Diubah {b} · {n} kata', { a: fmtDate(note.createdAt), b: fmtRelative(note.updatedAt), n: store.wordCount(note) })));
    const sh = sheet(null, content);
    void s2;
  }

  // ---------- helpers ----------
  function placeCaret(el, atEnd = true) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(!atEnd);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function focusFirstEditable() {
    const el = blocksHost.querySelector('.rt, .cl-tx');
    if (el) { el.focus(); placeCaret(el, true); }
  }

  // ---------- mount ----------
  ensureTrailingText();
  drawMood(); drawInfo(); drawBlocks(); drawMeta(); drawBacklinks();
  requestAnimationFrame(autoGrow);
  const fresh = Date.now() - note.createdAt < 4000 && isEmptyNote(note);
  if (fresh && !query.rec) setTimeout(() => { if (note.type === 'checklist') blocksHost.querySelector('.cl-tx')?.focus(); else if (note.type === 'journal') blocksHost.querySelector('.rt')?.focus(); else titleEl.focus(); }, 80);
  if (query.rec) setTimeout(startRecording, 250);

  ctx.watch(['books'], drawChip);
  ctx.watch(['notes'], () => {
    const cur = store.note(note.id);
    if (!cur) return;
    if (cur.reminder !== note.reminder) { note.reminder = cur.reminder; drawInfo(); }
  });

  const onHide = () => { if (document.hidden) { collect(); save.flush(); } };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  return async () => {
    document.removeEventListener('selectionchange', onSel);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
    disposed = true; if (hideUndo && removedAtts.size) hideUndo();
    stopPlayers(); players.forEach(a => { if (!document.contains(a)) { a.removeAttribute('src'); players.delete(a); } });
    save.cancel();
    if (!store.note(note.id)) return;
    collect();
    if (!leaving && isEmptyNote(note) && !note.trashedAt) { await store.deleteForever([note.id]); return; }
    if (dirty) await store.saveNote(note);
    if (removedAtts.size) {
      const used = new Set(store.allNotes().flatMap(n => store.noteAttachments(n)));
      const gone = [...removedAtts].filter(a => !used.has(a));
      if (gone.length) await store.deleteAttachments(gone);
    }
  };
}

function confetti() {
  const root = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const colors = ['#C24E2E', '#2F6F62', '#E0A526', '#5B7FC1', '#B85C9E', '#3F8A63'];
  for (let i = 0; i < 40; i++) root.appendChild(h('i', { style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.4}s;transform:rotate(${Math.random() * 360}deg)` }));
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 2200);
}
void escapeHTML;
