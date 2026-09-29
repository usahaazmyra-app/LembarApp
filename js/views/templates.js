// Lembar · Pilih template
import * as store from '../store.js';
import { h, clear, confirm, snack } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { header } from '../components.js';
import { builtinTemplates } from '../lib/templates.js';
import { createFromTemplate } from '../lib/create.js';

function preview(blocks, color) {
  const pv = h('div', { class: 'pv ' + (color || 'k8') }, h('div', { class: 'hd' }));
  for (const b of blocks.slice(0, 3)) {
    if (b.t === 'check') pv.appendChild(h('div', { class: 'row-flex', style: 'gap:6px' }, h('i', { style: 'width:9px;height:9px;border-radius:3px;border:1.5px solid rgba(43,42,40,.5);display:block' }), h('div', { class: 'ln', style: 'flex:1' })));
    else pv.appendChild(h('div', { class: 'ln', style: `width:${60 + Math.random() * 40}%` }));
  }
  return pv;
}

export function render(view, args, ctx, query = {}) {
  let cat = 'Semua';
  view.appendChild(header(t('Mulai dari template'), { backTo: 'home' }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  const use = async (id) => { const n = await createFromTemplate(id, query.book || null); ctx.navigate('note/' + n.id, { replace: true }); };
  const draw = () => {
    clear(body);
    const cats = ['Semua', 'Pribadi', 'Kuliah', 'Kerja', 'Buatanku'];
    body.appendChild(h('div', { class: 'chips' }, cats.map(c => h('button', { class: 'chip' + (cat === c ? ' on' : ''), type: 'button', onClick: () => { cat = c; draw(); } }, t(c)))));
    const grid = h('div', { class: 'tgrid' });
    if (cat !== 'Buatanku') for (const tp of builtinTemplates().filter(x => cat === 'Semua' || x.cat === cat)) {
      grid.appendChild(h('button', { class: 'tpl', type: 'button', onClick: () => use(tp.id) }, preview(tp.blocks(), tp.color), h('b', {}, tp.name), h('span', {}, tp.desc)));
    }
    if (cat === 'Semua' || cat === 'Buatanku') for (const tp of store.templates()) {
      const card = h('button', { class: 'tpl', type: 'button', onClick: () => use(tp.id) }, preview(tp.blocks, tp.color), h('b', {}, tp.name), h('span', {}, tp.desc || t('Template buatanmu')));
      const del = h('button', { class: 'ib sm del', type: 'button', 'aria-label': t('Hapus template {n}', { n: tp.name }), style: 'background:var(--surface);position:absolute;top:14px;right:14px', onClick: async e => { e.stopPropagation(); if (await confirm({ title: t('Hapus template “{n}”?', { n: tp.name }), ok: t('Hapus'), danger: true, icon: 'trash' })) { await store.deleteTemplate(tp.id); snack(t('Template dihapus')); draw(); } } }, icon('trash', 's'));
      card.appendChild(del);
      grid.appendChild(card);
    }
    grid.appendChild(h('div', { class: 'tpl', style: 'border:1.5px dashed var(--line);background:transparent;justify-content:center;align-items:center;text-align:center;min-height:150px' },
      h('span', { style: 'width:44px;height:44px;border-radius:14px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;padding:0' }, icon('plus')),
      h('b', {}, t('Template sendiri')), h('span', {}, t('Buka catatan mana pun, ketuk ⋯ lalu “Simpan sebagai template”.'))));
    body.appendChild(grid);
  };
  draw();
}
