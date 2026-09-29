// Lembar · kanvas sketsa
import * as store from '../store.js';
import { h, iconBtn, snack, confirm } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { isEmptyNote } from './editor.js';

const COLORS = [['Arang', '#2B2A28'], ['Terakota', '#C24E2E'], ['Biru', '#3E6DB5'], ['Hijau', '#2F6F62'], ['Kuning', '#E0A526'], ['Ungu', '#6A55A6']];
const VW = 1000;

export async function render(view, [nid, bid], ctx, query = {}) {
  const note = store.note(nid);
  const block = note && note.blocks.find(b => b.id === bid);
  if (!note || !block) { ctx.navigate('home', { replace: true }); return; }
  let strokes = JSON.parse(JSON.stringify(block.strokes || []));
  // riwayat aksi: 'stroke' atau { clear: coretanSebelumnya }, supaya "Hapus semua" bisa diurungkan
  let ops = strokes.map(() => 'stroke');
  let redo = [];
  let tool = 'pen', color = COLORS[0][1], width = 6, changed = false;
  let vh = block.vh || null;

  const titleIn = h('input', { type: 'text', value: note.title || '', placeholder: t('Judul sketsa'), 'aria-label': t('Judul sketsa'), style: 'flex:1;min-width:0;border:0;background:transparent;font:600 1.06rem var(--serif);color:var(--ink);outline:none' });
  titleIn.addEventListener('input', () => { changed = true; });
  const undoBtn = iconBtn('undo', t('Urungkan'), () => {
    const op = ops.pop(); if (!op) return;
    if (op === 'stroke') redo.push({ stroke: strokes.pop() });
    else { redo.push({ clearOf: op.clear }); strokes = op.clear; }
    changed = true; redraw(); upd();
  });
  const redoBtn = iconBtn('redo', t('Ulangi'), () => {
    const r = redo.pop(); if (!r) return;
    if (r.stroke) { strokes.push(r.stroke); ops.push('stroke'); }
    else { ops.push({ clear: r.clearOf }); strokes = []; }
    changed = true; redraw(); upd();
  });
  const upd = () => { undoBtn.style.opacity = ops.length ? 1 : .35; redoBtn.style.opacity = redo.length ? 1 : .35; };
  const blank = () => !strokes.length && !titleIn.value.trim();
  const doneBtn = h('button', { class: 'btn p sm', type: 'button', onClick: async () => {
    // sketsa baru yang masih kosong: kembali saja, catatannya dibuang saat keluar
    if (query.new && blank() && isEmptyNote({ ...note, title: '' })) { ctx.back(); return; }
    await persist();
    if (query.new) ctx.navigate('note/' + note.id, { replace: true }); else ctx.back('note/' + note.id);
  } }, t('Selesai'));
  const top = h('div', { class: 'ed-top' }, iconBtn('back', t('Kembali'), async () => { await persist(); ctx.back(); }), titleIn, undoBtn, redoBtn, doneBtn);

  const canvas = h('canvas', { 'aria-label': t('Kanvas gambar'), role: 'img' });
  const area = h('div', { class: 'sk-canvas' }, canvas);
  const toolBtn = (k, ic, label) => h('button', { class: 'tool' + (tool === k ? ' on' : ''), type: 'button', 'data-tool': k, 'aria-label': label, 'aria-pressed': tool === k ? 'true' : 'false', onClick: () => { tool = k; drawTools(); } }, icon(ic));
  const toolsEl = h('div', { class: 'tools' });
  const colorsEl = h('div', { class: 'row-flex', style: 'gap:10px' });
  const range = h('input', { type: 'range', min: 2, max: 28, value: width, 'aria-label': t('Ketebalan') });
  range.addEventListener('input', () => { width = +range.value; });
  const drawTools = () => {
    toolsEl.replaceChildren(toolBtn('pen', 'pen', t('Pena')), toolBtn('marker', 'marker', t('Stabilo')), toolBtn('line', 'line', t('Garis lurus')), toolBtn('eraser', 'eraser', t('Penghapus')),
      h('button', { class: 'tool', type: 'button', 'aria-label': t('Hapus semua'), onClick: async () => { if (!strokes.length) return; if (await confirm({ title: t('Hapus semua coretan?'), ok: t('Hapus'), danger: true, icon: 'trash' })) { ops.push({ clear: strokes }); strokes = []; redo = []; changed = true; redraw(); upd(); } } }, icon('trash')));
    colorsEl.replaceChildren(...COLORS.map(([n, c]) => h('button', { class: 'sw' + (c === color ? ' on' : ''), type: 'button', style: `background:${c};width:28px;height:28px`, 'aria-label': t('Warna {n}', { n: t(n) }), onClick: () => { color = c; if (tool === 'eraser') tool = 'pen'; drawTools(); } })), range);
  };
  drawTools();
  const dock = h('div', { class: 'dock' }, toolsEl, colorsEl);
  view.appendChild(h('div', { class: 'sk' }, top, area, dock));

  // ---------- canvas ----------
  const g = canvas.getContext('2d');
  let scale = 1, offX = 0, offY = 0, dpr = 1;
  function layout() {
    const r = area.getBoundingClientRect();
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    if (!vh) vh = Math.round(VW * r.height / r.width);
    scale = Math.min(r.width / VW, r.height / vh);
    offX = (r.width - VW * scale) / 2; offY = (r.height - vh * scale) / 2;
    redraw();
  }
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) - offX) / scale, ((e.clientY - r.top) - offY) / scale];
  }
  function strokeStyle(ctx2, s) {
    ctx2.lineCap = 'round'; ctx2.lineJoin = 'round';
    ctx2.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx2.globalAlpha = s.tool === 'marker' ? 0.35 : 1;
    ctx2.strokeStyle = s.color; ctx2.lineWidth = s.tool === 'marker' ? s.w * 3 : s.tool === 'eraser' ? s.w * 3 : s.w;
  }
  function drawStroke(ctx2, s) {
    const p = s.pts; if (!p.length) return;
    strokeStyle(ctx2, s);
    ctx2.beginPath();
    ctx2.moveTo(p[0][0], p[0][1]);
    if (p.length === 1) { ctx2.lineTo(p[0][0] + 0.1, p[0][1] + 0.1); }
    else if (s.tool === 'line') ctx2.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    else {
      for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx2.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
      ctx2.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    }
    ctx2.stroke();
    ctx2.globalAlpha = 1; ctx2.globalCompositeOperation = 'source-over';
  }
  function redraw(extra) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
    for (const s of strokes) drawStroke(g, s);
    if (extra) drawStroke(g, extra);
  }
  let cur = null, raf = 0, curPid = null;
  canvas.addEventListener('pointerdown', e => {
    if (cur || (e.pointerType === 'touch' && e.isPrimary === false)) return;
    canvas.setPointerCapture(e.pointerId);
    cur = { tool, color, w: width, pts: [toLogical(e)] };
    curPid = e.pointerId;
  });
  canvas.addEventListener('pointermove', e => {
    if (!cur || e.pointerId !== curPid) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (cur.tool === 'line') cur.pts = [cur.pts[0], toLogical(e)];
    else for (const ev of evs) { const pt = toLogical(ev); const last = cur.pts[cur.pts.length - 1]; if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) > 1.2) cur.pts.push(pt); }
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(cur); });
  });
  const end = (e) => {
    if (!cur || (e && e.pointerId !== curPid)) return;
    cur.pts = cur.pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    strokes.push(cur); ops.push('stroke'); cur = null; curPid = null; redo = []; changed = true; redraw(); upd();
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  const ro = new ResizeObserver(() => layout());
  ro.observe(area);
  upd();

  let persisting = null;
  function persist() { if (!persisting) persisting = doPersist().finally(() => { persisting = null; }); return persisting; }
  async function doPersist() {
    // blok sketsa kosong di catatan lain tidak perlu disimpan
    const onlySketchNote = note.type === 'sketch' && note.blocks.filter(x => x.t === 'sketch').length === 1;
    if (!strokes.length && !block.att && !query.new && !onlySketchNote && note.blocks.includes(block)) {
      note.blocks.splice(note.blocks.indexOf(block), 1);
      if (!note.blocks.length) note.blocks.push({ id: store.uid(), t: 'text', html: '' });
      note.title = titleIn.value; changed = false;
      await store.saveNote(note); return;
    }
    if (!changed) return;
    changed = false;
    note.title = titleIn.value;
    block.strokes = strokes; block.vw = VW; block.vh = vh;
    if (strokes.length) {
      const out = document.createElement('canvas');
      const k = 1.2; out.width = VW * k; out.height = vh * k;
      const c2 = out.getContext('2d');
      c2.fillStyle = '#fff'; c2.fillRect(0, 0, out.width, out.height);
      // gambar ke lapisan terpisah supaya penghapus tidak melubangi latar putih
      const layer = document.createElement('canvas'); layer.width = out.width; layer.height = out.height;
      const lc = layer.getContext('2d'); lc.setTransform(k, 0, 0, k, 0, 0);
      for (const s of strokes) drawStroke(lc, s);
      c2.drawImage(layer, 0, 0);
      const blob = await new Promise(r => out.toBlob(r, 'image/png'));
      if (!blob) { snack(t('Sketsa gagal disimpan')); changed = true; return; }
      if (block.att) await store.replaceAttachment(block.att, blob);
      else block.att = await store.putAttachment(blob);
      block.w = out.width; block.h = out.height;
    } else if (block.att) { await store.deleteAttachments([block.att]); block.att = null; }
    await store.saveNote(note);
  }

  return async () => {
    ro.disconnect();
    if (!store.note(note.id)) return;
    await persist();
    if ((query.new || note.type === 'sketch') && isEmptyNote(note)) { await store.deleteForever([note.id]); snack(t('Sketsa kosong dibuang')); }
  };
}
