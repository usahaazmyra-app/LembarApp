// Pemilih bersama: buku, warna kartu.
import { S, bookCount } from '../store.js';
import { t } from '../i18n.js';
import { esc, ic, sheet, go } from '../ui.js';
import { CARD_COLORS, dotOf } from '../data.js';

export function pickBook({ current = null, title = 'Pindahkan ke buku', count = 1 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const books = S.books.slice().sort((a, b) => a.name.localeCompare(b.name));
    const opt = (id, name, sub, dot) => `<button class="mrow" data-b="${id}" style="min-height:56px;border-radius:14px;padding:0 10px;${id === (current || '') ? 'background:var(--accent-soft)' : ''}">
        <span class="dot-c" style="width:12px;height:12px;border-radius:6px;background:${dot}"></span>
        <span class="grow">${esc(name)}<span class="small muted" style="display:block;font-weight:500">${esc(sub)}</span></span>
        ${id === (current || '') ? ic('check') : ''}</button>`;
    const { node, close } = sheet(`<div><h2 class="h2">${esc(t(title))}</h2>${count > 1 ? `<p class="small muted" style="margin:4px 0 0">${esc(t('{n} catatan dipilih', { n: count }))}</p>` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        ${opt('', t('Tanpa buku'), t('Tidak masuk buku mana pun'), 'var(--line)')}
        ${books.map((b) => opt(b.id, b.name, b.locked ? t('Terkunci · perlu PIN') : t('{n} catatan', { n: bookCount(b.id) }), dotOf(b.color))).join('')}
        <a class="mrow" href="#/book/new" style="min-height:56px;padding:0 10px;color:var(--accent)">${ic('plus')}<span class="grow">${esc(t('Buku baru…'))}</span></a>
      </div>`, { onClose: () => { if (!done) resolve(undefined); } });
    node.addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]');
      if (!b) return;
      done = true;
      resolve(b.dataset.b || null);
      close();
    });
  });
}

export function swatchesHTML(current, attr = 'data-color') {
  return `<div class="swatches">${CARD_COLORS.map((c) => `<button class="sw ${c.id === current ? 'on' : ''}" ${attr}="${c.id}" style="background:var(--${c.id})" aria-label="${esc(t('Warna {c}', { c: t(c.name) }))}" aria-pressed="${c.id === current}"></button>`).join('')}</div>`;
}

export function pickColor(current) {
  return new Promise((resolve) => {
    let done = false;
    const { node, close } = sheet(`<h2 class="h2">${esc(t('Warna kartu'))}</h2>${swatchesHTML(current)}`, { onClose: () => { if (!done) resolve(null); } });
    node.addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      done = true;
      resolve(b.dataset.color);
      close();
    });
  });
}

export { go };
