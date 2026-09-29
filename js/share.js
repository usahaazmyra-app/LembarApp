// Berbagi catatan: teks, gambar kartu, PDF (cetak).
import { t } from './i18n.js';
import { esc, download } from './ui.js';
import { noteTitle } from './views/cards.js';
import { bookById, urlFor } from './store.js';
import { CARD_COLORS } from './data.js';

export function noteToText(n) {
  const out = [noteTitle(n)];
  if (n.type === 'journal') {
    if (n.text) out.push('', n.text);
    const g = (n.gratitude || []).filter(Boolean);
    if (g.length) out.push('', t('3 hal yang kusyukuri') + ':', ...g.map((x, i) => `${i + 1}. ${x}`));
    if (n.tomorrow) out.push('', t('Satu hal untuk besok') + ': ' + n.tomorrow);
  } else if (n.text) out.push('', n.text);
  if (n.items && n.items.length) out.push('', ...n.items.map((i) => (i.done ? '☑ ' : '☐ ') + i.text));
  return out.join('\n').trim();
}

export function noteToMarkdown(n) {
  const out = ['# ' + noteTitle(n), ''];
  const md = htmlToMd(n.html || '');
  if (n.type === 'journal') {
    if (n.text) out.push(n.text, '');
    const g = (n.gratitude || []).filter(Boolean);
    if (g.length) out.push('## ' + t('3 hal yang kusyukuri'), ...g.map((x, i) => `${i + 1}. ${x}`), '');
    if (n.tomorrow) out.push('## ' + t('Satu hal untuk besok'), n.tomorrow, '');
  } else if (md) out.push(md, '');
  if (n.items && n.items.length) out.push(...n.items.map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}`), '');
  return out.join('\n').trim() + '\n';
}

function htmlToMd(html) {
  const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
  const walk = (node, ctx = {}) => {
    let s = '';
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { s += c.textContent; continue; }
      if (c.nodeType !== 1) continue;
      const inner = walk(c, ctx);
      switch (c.tagName) {
        case 'B': case 'STRONG': s += inner.trim() ? `**${inner}**` : inner; break;
        case 'I': case 'EM': s += inner.trim() ? `*${inner}*` : inner; break;
        case 'H2': case 'H3': s += `\n## ${inner.trim()}\n`; break;
        case 'BR': s += '\n'; break;
        case 'LI': s += (ctx.ol ? `${++ctx.n}. ` : '- ') + inner.trim() + '\n'; break;
        case 'UL': s += '\n' + walk(c, { ol: false }) + '\n'; break;
        case 'OL': s += '\n' + walk(c, { ol: true, n: 0 }) + '\n'; break;
        case 'BLOCKQUOTE': s += '\n> ' + inner.trim() + '\n'; break;
        case 'PRE': s += '\n```\n' + c.textContent + '\n```\n'; break;
        case 'P': case 'DIV': s += inner + '\n'; break;
        default: s += inner;
      }
    }
    return s;
  };
  return walk(doc.body.firstChild).replace(/\n{3,}/g, '\n\n').trim();
}

export async function shareText(n) {
  const text = noteToText(n);
  if (navigator.share) {
    try { await navigator.share({ title: noteTitle(n), text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return 'fail'; }
}

export async function copyText(n) {
  try { await navigator.clipboard.writeText(noteToText(n)); return true; } catch (e) { return false; }
}

// Gambar kartu cantik untuk dibagikan
export async function cardImage(n, colorId = 'k5') {
  await document.fonts.ready;
  const W = 1080, P = 88;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const col = CARD_COLORS.find((x) => x.id === colorId) || CARD_COLORS[5];
  const lines = (text, font, maxW) => {
    g.font = font;
    const out = [];
    for (const para of String(text).split('\n')) {
      let cur = '';
      for (const w of para.split(/\s+/)) {
        const test = cur ? cur + ' ' + w : w;
        if (g.measureText(test).width > maxW && cur) { out.push(cur); cur = w; } else cur = test;
      }
      out.push(cur);
    }
    return out;
  };
  const titleFont = '600 64px Fraunces, Georgia, serif';
  const bodyFont = '500 36px "Plus Jakarta Sans", system-ui, sans-serif';
  const title = lines(noteTitle(n), titleFont, W - P * 2).slice(0, 4);
  let bodyText = noteToText(n).split('\n').slice(1).join('\n').trim();
  let body = lines(bodyText, bodyFont, W - P * 2);
  const maxBody = 18;
  if (body.length > maxBody) { body = body.slice(0, maxBody); body[maxBody - 1] += '…'; }
  const book = n.bookId && bookById(n.bookId);
  const H = P + (book ? 70 : 0) + title.length * 78 + 30 + body.length * 54 + 60 + 90 + P;
  c.width = W; c.height = Math.max(H, 1080);
  g.fillStyle = col.hex; g.fillRect(0, 0, W, c.height);
  let y = P;
  g.textBaseline = 'top';
  if (book) { g.font = '700 30px "Plus Jakarta Sans", sans-serif'; g.fillStyle = '#4A463F'; g.fillText(book.name.toUpperCase(), P, y); y += 70; }
  g.fillStyle = '#2B2A28'; g.font = titleFont;
  for (const l of title) { g.fillText(l, P, y); y += 78; }
  y += 30;
  g.fillStyle = '#4A463F'; g.font = bodyFont;
  for (const l of body) { g.fillText(l, P, y); y += 54; }
  y = c.height - P - 50;
  g.strokeStyle = 'rgba(43,42,40,.25)'; g.setLineDash([10, 10]); g.lineWidth = 2;
  g.beginPath(); g.moveTo(P, y - 30); g.lineTo(W - P, y - 30); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#C24E2E'; roundRect(g, P, y, 44, 44, 13); g.fill();
  g.fillStyle = '#FAF7F2'; g.fillRect(P + 13, y + 10, 18, 24);
  g.fillStyle = '#4A463F'; g.font = '700 28px "Plus Jakarta Sans", sans-serif'; g.fillText(t('Ditulis di Lembar'), P + 62, y + 8);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

export async function shareBlob(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  }
  download(blob, name);
  return 'saved';
}

// PDF lewat dialog cetak browser (Simpan sebagai PDF)
export async function printNotes(notes) {
  const parts = [];
  for (const n of notes) {
    const imgs = [];
    for (const a of (n.attachments || []).filter((x) => x.kind === 'image' || x.kind === 'sketch')) {
      const u = await urlFor(a.id);
      if (u) imgs.push(`<img src="${u}" style="max-width:100%;max-height:420px;border-radius:8px;margin:8px 0">`);
    }
    const journal = n.type === 'journal' ? `${n.text ? `<p>${esc(n.text).replace(/\n/g, '<br>')}</p>` : ''}${(n.gratitude || []).filter(Boolean).length ? `<h2>${esc(t('3 hal yang kusyukuri'))}</h2><ol>${n.gratitude.filter(Boolean).map((g) => `<li>${esc(g)}</li>`).join('')}</ol>` : ''}${n.tomorrow ? `<h2>${esc(t('Satu hal untuk besok'))}</h2><p>${esc(n.tomorrow)}</p>` : ''}` : '';
    parts.push(`<article><h1>${esc(noteTitle(n))}</h1><div class="m">${esc(new Date(n.updatedAt).toLocaleString())}</div>
      ${n.type === 'journal' ? journal : n.html || ''}
      ${n.items && n.items.length ? `<ul class="cl">${n.items.map((i) => `<li>${i.done ? '☑' : '☐'} ${esc(i.text)}</li>`).join('')}</ul>` : ''}
      ${imgs.join('')}</article>`);
  }
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Lembar</title><style>
    body{font-family:Georgia,serif;color:#2B2A28;margin:0;padding:0}
    article{padding:28px 8px;page-break-after:always}
    h1{font-size:24pt;margin:0 0 4px} h2{font-size:14pt;margin:14px 0 4px}
    .m{font:10pt system-ui;color:#6B665E;margin-bottom:14px}
    p,li{font-size:12pt;line-height:1.6} ul.cl{list-style:none;padding:0}
    blockquote{border-left:3px solid #C24E2E;margin:8px 0;padding:4px 12px;font-style:italic}
    pre{background:#EFEBE4;padding:8px;border-radius:6px;white-space:pre-wrap}
  </style></head><body>${parts.join('')}</body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(doc); f.contentDocument.close();
  await new Promise((r) => setTimeout(r, 400));
  f.contentWindow.focus();
  f.contentWindow.print();
  setTimeout(() => f.remove(), 60000);
}
