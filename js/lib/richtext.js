// Lembar · ubah HTML catatan ke teks biasa atau Markdown
import { sanitizeHTML } from '../ui.js';

// Ubah HTML catatan ke Markdown (md = true) atau teks biasa (md = false).
// Daftar poin, angka (1. 2.) dan huruf (a. b.) beserta sub-daftarnya ikut dipertahankan.
export function convertHTML(html, md) {
  const d = document.createElement('div'); d.innerHTML = sanitizeHTML(html || '');
  const letter = i => { let out = ''; i += 1; while (i > 0) { i -= 1; out = String.fromCharCode(97 + (i % 26)) + out; i = Math.floor(i / 26); } return out; };
  const isList = c => c.nodeType === 1 && (c.tagName === 'OL' || c.tagName === 'UL');
  const list = (el, depth) => {
    let out = depth ? '' : '\n';
    let i = 0;
    const ty = el.tagName === 'OL' ? (el.getAttribute('type') || (depth === 1 && el.parentElement && el.parentElement.closest('ol') ? 'a' : '1')) : '';
    const alpha = ty === 'a' || ty === 'A';
    const roman = ty === 'i' || ty === 'I';
    const toRoman = n => { const m = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let r = ''; for (const [v, c] of m) while (n >= v) { r += c; n -= v; } return r; };
    for (const li of el.children) {
      if (isList(li)) { out += list(li, depth + 1); continue; }
      if (li.tagName !== 'LI') continue;
      const marker = el.tagName === 'UL' ? (md ? '- ' : '• ') : (alpha ? letter(i) : roman ? toRoman(i + 1) : String(i + 1)) + '. ';
      i++;
      let own = '', nested = '';
      for (const c of li.childNodes) { if (isList(c)) nested += list(c, depth + 1); else own += walk({ childNodes: [c] }); }
      out += '   '.repeat(depth) + marker + own.replace(/\s*\n\s*/g, ' ').trim() + (md && (alpha || roman) ? '  ' : '') + '\n' + nested;
    }
    return out + (depth ? '' : '\n');
  };
  const walk = (node) => {
    let s = '';
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { s += c.textContent; continue; }
      if (c.nodeType !== 1) continue;
      if (isList(c)) { s += list(c, 0); continue; }
      const inner = walk(c);
      switch (c.tagName) {
        case 'B': case 'STRONG': s += md ? '**' + inner + '**' : inner; break;
        case 'I': case 'EM': s += md ? '*' + inner + '*' : inner; break;
        case 'H1': case 'H2': s += '\n\n' + (md ? '### ' : '') + inner.trim() + '\n'; break;
        case 'H3': s += '\n\n' + (md ? '#### ' : '') + inner.trim() + '\n'; break;
        case 'BLOCKQUOTE': s += '\n' + (md ? '> ' + inner.trim().replace(/\n/g, '\n> ') : '“' + inner.trim() + '”') + '\n'; break;
        case 'PRE': s += md ? '\n```\n' + c.textContent + '\n```\n' : '\n' + c.textContent + '\n'; break;
        case 'BR': s += md ? '  \n' : '\n'; break;
        case 'DIV': case 'P': s += (md ? '\n\n' : '\n') + inner; break;
        case 'A': s += md ? '[[' + inner + ']]' : inner; break;
        default: s += inner;
      }
    }
    return s;
  };
  return walk(d).replace(/ /g, ' ').replace(/[ \t]+\n/g, m => (md && m.startsWith('  ') ? '  \n' : '\n')).replace(/\n{3,}/g, '\n\n').trim();
}
export const htmlToPlain = html => convertHTML(html, false);
