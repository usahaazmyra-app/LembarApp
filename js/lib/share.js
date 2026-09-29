// Lembar · bagikan catatan sebagai teks, gambar kartu, atau PDF (cetak)
import * as store from '../store.js';
import { h, sheet, snack, shareOrDownload, download, escapeHTML, sanitizeHTML } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtDate } from '../i18n.js';
import { noteTitle } from '../components.js';
import { colorRow } from '../pickers.js';

export function noteAsText(n) {
  const out = [];
  const title = noteTitle(n);
  out.push(title);
  out.push('');
  for (const b of n.blocks) {
    if (b.t === 'text' || b.t === 'prompt') {
      if (b.label) out.push(b.label);
      const txt = store.htmlToText(b.html).trim();
      if (txt) out.push(txt);
      out.push('');
    } else if (b.t === 'check') {
      if (b.label) out.push(b.label);
      b.items.filter(i => i.text).forEach(i => out.push((i.done ? '☑ ' : '☐ ') + i.text));
      out.push('');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function noteAsMarkdown(n) {
  const out = ['# ' + noteTitle(n), ''];
  const tags = store.noteTags(n);
  for (const b of n.blocks) {
    if (b.t === 'text' || b.t === 'prompt') {
      if (b.label) out.push('## ' + b.label);
      out.push(htmlToMd(b.html)); out.push('');
    } else if (b.t === 'check') {
      if (b.label) out.push('## ' + b.label);
      b.items.filter(i => i.text).forEach(i => out.push(`- [${i.done ? 'x' : ' '}] ${i.text}`)); out.push('');
    } else if (b.t === 'image') out.push('*(' + t('foto') + ')*', '');
    else if (b.t === 'audio') out.push('*(' + t('rekaman suara') + ')*', '');
    else if (b.t === 'sketch') out.push('*(' + t('sketsa') + ')*', '');
  }
  if (tags.length) out.push(tags.map(x => '#' + x).join(' '));
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function htmlToMd(html) {
  const d = document.createElement('div'); d.innerHTML = sanitizeHTML(html || '');
  const walk = (node, ctx = {}) => {
    let s = '';
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { s += c.textContent; continue; }
      if (c.nodeType !== 1) continue;
      const inner = walk(c, ctx);
      switch (c.tagName) {
        case 'B': case 'STRONG': s += '**' + inner + '**'; break;
        case 'I': case 'EM': s += '*' + inner + '*'; break;
        case 'H1': s += '\n## ' + inner + '\n'; break;
        case 'H2': s += '\n### ' + inner + '\n'; break;
        case 'H3': s += '\n#### ' + inner + '\n'; break;
        case 'LI': s += (ctx.ol ? (ctx.i = (ctx.i || 0) + 1) + '. ' : '- ') + inner.trim() + '\n'; break;
        case 'UL': s += '\n' + walk(c, {}) ; break;
        case 'OL': s += '\n' + walk(c, { ol: true }); break;
        case 'BLOCKQUOTE': s += '\n> ' + inner.trim().replace(/\n/g, '\n> ') + '\n'; break;
        case 'PRE': s += '\n```\n' + c.textContent + '\n```\n'; break;
        case 'BR': s += '\n'; break;
        case 'DIV': case 'P': s += '\n' + inner; break;
        case 'A': s += '[[' + inner + ']]'; break;
        default: s += inner;
      }
    }
    return s;
  };
  return walk(d).replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- gambar kartu ----------
function wrapLines(ctx, text, maxW) {
  const lines = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const w of para.split(/\s+/)) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}
export async function renderCard(n, colorKey) {
  try { await document.fonts.ready; } catch (e) { /* noop */ }
  const css = getComputedStyle(document.documentElement);
  const col = k => css.getPropertyValue('--' + k).trim();
  const W = 1080, P = 88;
  const bg = colorKey ? col(colorKey) : col('paper');
  const c = document.createElement('canvas'); c.width = W; c.height = 1350;
  const x = c.getContext('2d');
  const serif = '600 64px Fraunces, Georgia, serif';
  const sans = '500 38px "Plus Jakarta Sans", system-ui, sans-serif';
  x.font = serif;
  const titleLines = wrapLines(x, noteTitle(n), W - P * 2).slice(0, 4);
  x.font = sans;
  let body = noteAsText(n).split('\n').slice(1).join('\n').trim();
  let bodyLines = wrapLines(x, body, W - P * 2);
  const maxBody = 14;
  if (bodyLines.length > maxBody) { bodyLines = bodyLines.slice(0, maxBody); bodyLines[maxBody - 1] += ' …'; }
  const H = Math.max(900, P + 60 + titleLines.length * 80 + 40 + bodyLines.length * 58 + 180);
  c.height = Math.min(1920, H);
  x.fillStyle = bg; x.fillRect(0, 0, W, c.height);
  x.fillStyle = col('ink'); x.textBaseline = 'top';
  let y = P;
  const b = store.book(n.bookId);
  if (b) { x.font = '700 30px "Plus Jakarta Sans", system-ui, sans-serif'; x.fillStyle = col('ink2'); x.fillText(b.name.toUpperCase(), P, y); y += 60; }
  x.fillStyle = col('ink'); x.font = serif;
  for (const l of titleLines) { x.fillText(l, P, y); y += 80; }
  y += 24;
  x.font = sans; x.fillStyle = col('ink2');
  for (const l of bodyLines) { x.fillText(l, P, y); y += 58; }
  const tags = store.noteTags(n).slice(0, 4);
  if (tags.length) { y += 20; x.font = '700 30px "Plus Jakarta Sans", system-ui, sans-serif'; x.fillText(tags.map(g => '#' + g).join('   '), P, y); }
  const fy = c.height - P - 10;
  x.strokeStyle = 'rgba(43,42,40,.25)'; x.setLineDash([8, 8]); x.lineWidth = 2;
  x.beginPath(); x.moveTo(P, fy - 30); x.lineTo(W - P, fy - 30); x.stroke(); x.setLineDash([]);
  x.fillStyle = '#C24E2E'; roundRect(x, P, fy, 40, 40, 12); x.fill();
  x.fillStyle = '#FAF7F2'; roundRect(x, P + 11, fy + 8, 18, 24, 3); x.fill();
  x.fillStyle = col('ink2'); x.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif'; x.textBaseline = 'middle';
  x.fillText(t('Ditulis di Lembar') + ' · ' + fmtDate(n.updatedAt), P + 56, fy + 20);
  return new Promise(res => c.toBlob(res, 'image/png'));
}
function roundRect(x, X, Y, w, hh, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + hh, r); x.arcTo(X + w, Y + hh, X, Y + hh, r); x.arcTo(X, Y + hh, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }

// ---------- cetak / PDF ----------
export async function printNotes(notes) {
  const root = document.getElementById('print');
  root.innerHTML = '';
  for (const n of notes) {
    const art = h('article', {}, h('h1', {}, noteTitle(n)), h('div', { class: 'pm' }, [store.book(n.bookId)?.name, fmtDate(n.updatedAt), store.noteTags(n).map(x => '#' + x).join(' ')].filter(Boolean).join(' · ')));
    for (const b of n.blocks) {
      if (b.t === 'text' || b.t === 'prompt') { if (b.label) art.appendChild(h('h3', {}, b.label)); art.appendChild(h('div', { html: sanitizeHTML(b.html) })); }
      else if (b.t === 'check') { if (b.label) art.appendChild(h('h3', {}, b.label)); art.appendChild(h('ul', { class: 'cl' }, b.items.filter(i => i.text).map(i => h('li', {}, (i.done ? '☑ ' : '☐ ') + i.text)))); }
      else if ((b.t === 'image' || b.t === 'sketch') && b.att) { const u = await store.attachmentURL(b.att); if (u) art.appendChild(h('p', {}, h('img', { src: u, alt: '' }))); }
    }
    root.appendChild(art);
  }
  await Promise.all([...root.querySelectorAll('img')].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
  const clean = () => { root.innerHTML = ''; window.removeEventListener('afterprint', clean); };
  window.addEventListener('afterprint', clean);
  window.print();
}

export function openShare(n) {
  let fmt = 'card', color = n.color || 'k5';
  const preview = h('img', { alt: t('Pratinjau kartu'), style: 'width:100%;max-width:300px;align-self:center;border-radius:18px;box-shadow:var(--shadow-lg);background:var(--surface2);min-height:200px' });
  const textPrev = h('pre', { style: 'white-space:pre-wrap;font:500 .84rem/1.55 var(--sans);background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:12px;margin:0;max-height:240px;overflow:auto' });
  const colorWrap = h('div', { class: 'stack', style: 'gap:8px' }, h('span', { class: 'small', style: 'font-weight:700' }, t('Warna kartu')), colorRow(color, k => { color = k || ''; draw(); }, 30));
  let blobUrl = null;
  const draw = async () => {
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === fmt));
    preview.hidden = fmt !== 'card'; colorWrap.hidden = fmt !== 'card'; textPrev.hidden = fmt !== 'text';
    if (fmt === 'text') textPrev.textContent = noteAsText(n);
    if (fmt === 'card') { const b = await renderCard(n, color); if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = URL.createObjectURL(b); preview.src = blobUrl; }
  };
  const seg = h('div', { class: 'seg' }, [['text', t('Teks')], ['card', t('Gambar kartu')], ['pdf', 'PDF']].map(([k, l]) => h('button', { type: 'button', 'data-k': k, onClick: () => { fmt = k; draw(); } }, l)));
  const safeName = (noteTitle(n).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'catatan').toLowerCase();
  const act = (ic, label, fn) => h('button', { class: 'qa', type: 'button', onClick: fn }, h('span', { style: 'width:52px;height:52px;border-radius:18px;background:var(--paper);border:1px solid var(--line);display:flex;align-items:center;justify-content:center' }, icon(ic)), label);
  const send = async () => {
    if (fmt === 'text') {
      if (navigator.share) { try { await navigator.share({ title: noteTitle(n), text: noteAsText(n) }); } catch (e) { /* batal */ } }
      else { await copy(); }
    } else if (fmt === 'card') { const b = await renderCard(n, color); await shareOrDownload(b, safeName + '.png', noteTitle(n)); }
    else { s.close(); setTimeout(() => printNotes([n]), 300); }
  };
  const save = async () => {
    if (fmt === 'text') download(new Blob([noteAsText(n)], { type: 'text/plain' }), safeName + '.txt');
    else if (fmt === 'card') download(await renderCard(n, color), safeName + '.png');
    else { s.close(); setTimeout(() => printNotes([n]), 300); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(noteAsText(n)); snack(t('Teks disalin')); } catch (e) { snack(t('Tidak bisa menyalin')); } };
  const s = sheet(t('Bagikan sebagai'), h('div', { class: 'stack' },
    seg, preview, textPrev, colorWrap,
    h('div', { class: 'quickacts', style: 'grid-template-columns:repeat(4,minmax(0,1fr))' },
      act('share', t('Kirim ke…'), send), act('download', t('Simpan'), save), act('copy', t('Salin teks'), copy), act('print', t('Cetak / PDF'), () => { s.close(); setTimeout(() => printNotes([n]), 300); }))),
    { onClose: () => { if (blobUrl) URL.revokeObjectURL(blobUrl); } });
  draw();
  void escapeHTML;
}
