// Lembar · atur foto: potong (crop), putar, dan tampilan zoom
// Potong bersifat tidak merusak: foto asli disimpan di block.orig, hasil potongan di block.att.
import * as store from '../store.js';
import { h, iconBtn, fullscreen, snack } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';

const RATIOS = [['free', 'Bebas', null], ['1:1', '1:1', 1], ['4:3', '4:3', 4 / 3], ['3:4', '3:4', 3 / 4], ['16:9', '16:9', 16 / 9]];

async function loadBitmap(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch (e) {
    const url = URL.createObjectURL(blob);
    try { return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
    finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
}
// gambar sumber diputar 0/90/180/270 derajat ke kanvas
function rotated(bmp, rot, maxSide) {
  const sw = bmp.width, sh = bmp.height;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.round(sw * k), hh = Math.round(sh * k);
  const c = document.createElement('canvas');
  const turn = rot % 180 !== 0;
  c.width = turn ? hh : w; c.height = turn ? w : hh;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180);
  g.drawImage(bmp, -w / 2, -hh / 2, w, hh);
  return c;
}

// Kembalikan foto asli (sebelum dipotong) beserta ukurannya
export async function restoreOriginal(block) {
  if (block.orig) { const cur = block.att; block.att = block.orig; delete block.orig; await store.deleteAttachments([cur]); }
  if (block.ow && block.oh) { block.w = block.ow; block.h = block.oh; if (block.osize) block.size = block.osize; }
  else {
    const b0 = await store.getAttachmentBlob(block.att);
    if (b0) { const bm = await loadBitmap(b0); block.w = bm.width; block.h = bm.height; block.size = b0.size; if (bm.close) bm.close(); }
  }
  delete block.crop; delete block.ow; delete block.oh; delete block.osize;
}

// Buka editor potong. Resolve true bila foto diubah.
export function openCropEditor(block) {
  return new Promise(async resolve => {
    const srcId = block.orig || block.att;
    const blob = await store.getAttachmentBlob(srcId);
    if (!blob) { snack(t('Foto tidak ditemukan')); return resolve(false); }
    const bmp = await loadBitmap(blob);
    const prev = block.crop || {};
    let rot = prev.rot || 0;
    let ratio = prev.ratio || 'free';
    let rect = prev.w ? { x: prev.x, y: prev.y, w: prev.w, h: prev.h } : { x: 0, y: 0, w: 1, h: 1 }; // relatif 0..1
    let fs, done = false;

    const canvas = h('canvas', { class: 'ie-canvas' });
    const box = h('div', { class: 'ie-box' }, ...['nw', 'ne', 'sw', 'se'].map(k => h('i', { class: 'ie-h ie-' + k, 'data-h': k })),
      h('span', { class: 'ie-grid' }));
    const stage = h('div', { class: 'ie-stage' }, h('div', { class: 'ie-wrap' }, canvas, box));
    const chips = h('div', { class: 'ie-ratios' });
    let preview = null; // kanvas pratinjau (sudah diputar)
    let aspectOfImage = 1;

    const drawPreview = () => {
      preview = rotated(bmp, rot, 1400);
      aspectOfImage = preview.width / preview.height;
      canvas.width = preview.width; canvas.height = preview.height;
      canvas.getContext('2d').drawImage(preview, 0, 0);
      layout();
    };
    const layout = () => {
      const sr = stage.getBoundingClientRect();
      const pad = 24;
      const maxW = Math.max(50, sr.width - pad * 2), maxH = Math.max(50, sr.height - pad * 2);
      let w = maxW, hh = w / aspectOfImage;
      if (hh > maxH) { hh = maxH; w = hh * aspectOfImage; }
      const wrap = canvas.parentElement;
      wrap.style.width = w + 'px'; wrap.style.height = hh + 'px';
      drawBox();
    };
    const drawBox = () => {
      box.style.left = rect.x * 100 + '%'; box.style.top = rect.y * 100 + '%';
      box.style.width = rect.w * 100 + '%'; box.style.height = rect.h * 100 + '%';
    };
    const ratioValue = () => (RATIOS.find(r => r[0] === ratio) || RATIOS[0])[2];
    // rasio dalam koordinat relatif: lebar/tinggi relatif = rasio / rasio gambar
    const applyRatio = () => {
      const r = ratioValue();
      if (!r) return;
      const rel = r / aspectOfImage;
      let w = rect.w, hh = w / rel;
      if (hh > rect.h) { hh = rect.h; w = hh * rel; }
      if (w > 1) { w = 1; hh = w / rel; }
      if (hh > 1) { hh = 1; w = hh * rel; }
      rect = { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - hh) / 2, w, h: hh };
      clamp(); drawBox();
    };
    const clamp = () => {
      rect.w = Math.min(1, Math.max(0.05, rect.w)); rect.h = Math.min(1, Math.max(0.05, rect.h));
      rect.x = Math.min(1 - rect.w, Math.max(0, rect.x)); rect.y = Math.min(1 - rect.h, Math.max(0, rect.y));
    };
    const drawChips = () => chips.replaceChildren(...RATIOS.map(([k, label]) => h('button', { type: 'button', class: 'chip' + (ratio === k ? ' on' : ''), onClick: () => { ratio = k; if (k !== 'free') { rect = { x: 0, y: 0, w: 1, h: 1 }; applyRatio(); } drawChips(); } }, k === 'free' ? t(label) : label)));

    // seret kotak / sudut
    let drag = null;
    box.addEventListener('pointerdown', e => {
      e.preventDefault();
      const wr = canvas.parentElement.getBoundingClientRect();
      drag = { id: e.pointerId, h: e.target.dataset.h || 'move', sx: e.clientX, sy: e.clientY, r0: { ...rect }, W: wr.width, H: wr.height };
      box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = (e.clientX - drag.sx) / drag.W, dy = (e.clientY - drag.sy) / drag.H;
      const r0 = drag.r0; const rv = ratioValue(); const rel = rv ? rv / aspectOfImage : null;
      if (drag.h === 'move') { rect = { ...r0, x: r0.x + dx, y: r0.y + dy }; clamp(); drawBox(); return; }
      let { x, y, w, h: hh } = r0;
      const L = drag.h.includes('w'), T = drag.h.includes('n');
      if (L) { x = r0.x + dx; w = r0.w - dx; } else w = r0.w + dx;
      if (T) { y = r0.y + dy; hh = r0.h - dy; } else hh = r0.h + dy;
      if (rel) { // pertahankan rasio: ikuti perubahan lebar
        const nh = w / rel; if (T) y = r0.y + r0.h - nh; hh = nh;
      }
      const min = 0.08;
      if (w < min || hh < min) return;
      if (x < 0 || y < 0 || x + w > 1.0001 || y + hh > 1.0001) return;
      rect = { x, y, w, h: hh }; drawBox();
    });
    const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);

    const finish = ok => { if (done) return; done = true; ro.disconnect(); fs.close(); if (bmp.close) bmp.close(); resolve(ok); };
    const save = async () => {
      saveBtn.disabled = true; saveBtn.textContent = t('Menyimpan…');
      try {
        const full = rect.x <= 0.001 && rect.y <= 0.001 && rect.w >= 0.999 && rect.h >= 0.999;
        if (full && rot === 0) {
          // kembali ke foto asli
          await restoreOriginal(block);
          return finish(true);
        }
        const src = rotated(bmp, rot, 4000);
        const sx = Math.round(rect.x * src.width), sy = Math.round(rect.y * src.height);
        const sw = Math.max(1, Math.round(rect.w * src.width)), sh = Math.max(1, Math.round(rect.h * src.height));
        const k = Math.min(1, 1600 / Math.max(sw, sh));
        const out = document.createElement('canvas'); out.width = Math.round(sw * k); out.height = Math.round(sh * k);
        out.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
        const nb = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.86));
        if (!nb) throw new Error('encode');
        if (block.orig) await store.replaceAttachment(block.att, nb);
        else { block.ow = block.w; block.oh = block.h; block.osize = block.size; block.orig = block.att; block.att = await store.putAttachment(nb); }
        block.crop = { ...rect, rot, ratio };
        block.w = out.width; block.h = out.height; block.size = nb.size;
        finish(true);
      } catch (e) { console.error(e); saveBtn.disabled = false; saveBtn.textContent = t('Simpan'); snack(t('Foto gagal disimpan')); }
    };
    const saveBtn = h('button', { class: 'btn p sm', type: 'button', onClick: save }, t('Simpan'));
    const tool = (ic, label, fn) => h('button', { class: 'ie-tool', type: 'button', onClick: fn }, icon(ic), h('span', {}, label));
    const ui = h('div', { class: 'ie' },
      h('div', { class: 'hdr ie-hdr' }, iconBtn('close', t('Batal'), () => finish(false)), h('h1', { class: 'h2', style: 'flex:1;color:#fff' }, t('Potong & putar')), saveBtn),
      stage,
      h('div', { class: 'ie-dock' }, chips,
        h('div', { class: 'ie-tools' },
          tool('rotate', t('Putar'), () => { rot = (rot + 90) % 360; rect = { x: 0, y: 0, w: 1, h: 1 }; drawPreview(); applyRatio(); }),
          tool('refresh', t('Atur ulang'), () => { rot = 0; ratio = 'free'; rect = { x: 0, y: 0, w: 1, h: 1 }; drawChips(); drawPreview(); }))));
    fs = fullscreen(ui, { onClose: () => { if (!done) { done = true; ro.disconnect(); resolve(false); } } });
    const ro = new ResizeObserver(() => layout());
    ro.observe(stage);
    drawChips();
    requestAnimationFrame(drawPreview);
  });
}

// Penampil foto dengan zoom: cubit dua jari, ketuk dua kali, atau tombol +/-.
export function openViewer(block, { onEdit, onShare, onDelete } = {}) {
  let fs;
  const img = h('img', { alt: t('Foto'), draggable: 'false' });
  store.attachmentURL(block.att).then(u => { img.src = u; });
  const stage = h('div', { class: 'zv-stage' }, img);
  let s = 1, tx = 0, ty = 0;
  const apply = (anim) => { img.style.transition = anim ? 'transform .2s' : 'none'; img.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; lvl.textContent = Math.round(s * 100) + '%'; };
  const limit = () => {
    const r = stage.getBoundingClientRect();
    const mx = Math.max(0, (r.width * (s - 1)) / 2), my = Math.max(0, (r.height * (s - 1)) / 2);
    tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty));
    if (s <= 1) { s = 1; tx = 0; ty = 0; }
  };
  const zoomTo = (ns, cx, cy) => {
    const r = stage.getBoundingClientRect();
    ns = Math.min(5, Math.max(1, ns));
    const ox = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2), oy = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
    tx = ox - (ox - tx) * (ns / s); ty = oy - (oy - ty) * (ns / s); s = ns;
    limit();
  };
  const pts = new Map(); let pinch = null, pan = null, lastTap = 0;
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s0: s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; pan = null; }
    else if (pts.size === 1) {
      const now = Date.now();
      if (now - lastTap < 300) { zoomTo(s > 1.2 ? 1 : 2.5, e.clientX, e.clientY); apply(true); lastTap = 0; return; }
      lastTap = now; pan = { x: e.clientX, y: e.clientY, tx, ty };
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); s = pinch.s0; zoomTo(pinch.s0 * d / pinch.d, pinch.cx, pinch.cy); apply(false); }
    else if (pan && s > 1) { tx = pan.tx + e.clientX - pan.x; ty = pan.ty + e.clientY - pan.y; limit(); apply(false); }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) pan = null; };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => { e.preventDefault(); zoomTo(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); apply(false); }, { passive: false });
  const lvl = h('span', { class: 'zv-lvl' }, '100%');
  const zb = (ic, label, f) => iconBtn(ic, label, () => { zoomTo(s * f); apply(true); });
  fs = fullscreen(h('div', { class: 'lb' },
    h('div', { class: 'hdr', style: 'color:#fff' }, iconBtn('close', t('Tutup'), () => fs.close()), h('span', { class: 'grow' }),
      onEdit ? iconBtn('crop', t('Potong & putar'), () => { fs.close(); setTimeout(onEdit, 250); }) : null,
      onShare ? iconBtn('share', t('Bagikan foto'), onShare) : null,
      onDelete ? iconBtn('trash', t('Hapus foto'), () => { fs.close(); onDelete(); }) : null),
    stage,
    h('div', { class: 'zv-bar' }, zb('zoomout', t('Perkecil'), 1 / 1.5), lvl, zb('zoomin', t('Perbesar'), 1.5),
      iconBtn('expand', t('Ukuran asli layar'), () => { s = 1; tx = 0; ty = 0; apply(true); }))));
  apply(false);
  return fs;
}
