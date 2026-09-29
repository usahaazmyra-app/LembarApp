// Lembar · Tag & kelola tag
import * as store from '../store.js';
import { h, clear, iconBtn, snack, confirm, promptText, sheet, btn } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { header, emptyState } from '../components.js';

const TAG_COLORS = ['k3', 'k5', 'k2', 'k6', 'k1', 'k7', 'k4', 'k8'];
const BAR_COLORS = ['#3E6DB5', '#6A55A6', '#2F6F62', '#D07A3A', '#A8902F', '#2F8A80', '#C2566A', '#6B665E'];

export function render(view, args, ctx) {
  view.appendChild(header(t('Tag'), { backTo: 'books', actions: [h('a', { class: 'btn t sm accent', href: '#/tags-manage' }, t('Kelola'))] }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  const draw = () => {
    clear(body);
    const tags = store.allTags();
    if (!tags.length) {
      body.appendChild(emptyState('tag', t('Belum ada tag'), t('Ketik # diikuti nama tag di dalam catatan, misalnya #kuliah. Tag langsung muncul di sini.')));
      return;
    }
    const max = tags[0].count;
    body.append(
      h('div', { class: 'cloud' }, tags.map((tg, i) => h('button', { type: 'button', class: TAG_COLORS[i % TAG_COLORS.length], style: `font-size:${(0.78 + 0.5 * (tg.count / max)).toFixed(2)}rem`, onClick: () => ctx.navigate('search?tag=' + encodeURIComponent(tg.name)) }, '#' + tg.name, h('small', {}, tg.count)))),
      h('div', { class: 'notice', style: 'background:var(--accent-soft)' }, icon('tag', 's'), t('Ketik # di catatan mana pun untuk membuat tag baru.')),
      h('span', { class: 'lbl' }, t('Paling sering dipakai')),
      h('div', { class: 'group' }, tags.slice(0, 8).map((tg, i) => h('a', { class: 'row', href: '#/search?tag=' + encodeURIComponent(tg.name) },
        h('span', { style: 'width:110px;overflow:hidden;text-overflow:ellipsis' }, '#' + tg.name),
        h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(tg.count / max * 100)}%;background:${BAR_COLORS[i % BAR_COLORS.length]}` })),
        h('span', { class: 'val', style: 'width:30px;text-align:right' }, tg.count)))));
  };
  draw();
  ctx.watch(['notes'], draw);
}

export function renderManage(view, args, ctx) {
  view.appendChild(header(t('Kelola tag'), { backTo: 'tags', actions: [h('button', { class: 'btn p sm', type: 'button', onClick: () => ctx.back('tags') }, t('Selesai'))] }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  const draw = () => {
    clear(body);
    const tags = store.allTags();
    body.appendChild(h('p', { class: 'small muted', style: 'margin:0' }, t('Ganti nama, gabungkan tag yang mirip, atau hapus tag. Catatannya tidak ikut terhapus.')));
    if (!tags.length) { body.appendChild(emptyState('tag', t('Belum ada tag'), null)); return; }
    body.appendChild(h('div', { class: 'group' }, tags.map(tg => h('div', { class: 'row', style: 'padding:6px 0' },
      h('span', { style: 'font-weight:700' }, '#' + tg.name), h('span', { class: 'grow val', style: 'font-size:.78rem' }, t('{n} catatan', { n: tg.count })),
      iconBtn('edit', t('Ganti nama {t}', { t: tg.name }), () => rename(tg), 'sm'),
      iconBtn('merge', t('Gabungkan {t}', { t: tg.name }), () => merge(tg, tags), 'sm'),
      h('button', { class: 'ib sm', type: 'button', style: 'color:var(--danger)', 'aria-label': t('Hapus {t}', { t: tg.name }), onClick: () => del(tg) }, icon('trash', 's'))))));
  };
  async function rename(tg) {
    const v = await promptText({ title: t('Ganti nama #{t}', { t: tg.name }), message: t('Berlaku di {n} catatan.', { n: tg.count }), value: tg.name, maxlength: 40 });
    if (!v) return;
    const to = v.replace(/^#/, '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
    if (!to) { snack(t('Nama tag hanya boleh huruf, angka, - dan _')); return; }
    if (to === tg.name) return;
    await store.renameTag(tg.name, to); snack(t('Tag diganti menjadi #{t}', { t: to }));
  }
  function merge(tg, tags) {
    const others = tags.filter(x => x.name !== tg.name);
    if (!others.length) { snack(t('Belum ada tag lain untuk digabung')); return; }
    const s = sheet(t('Gabungkan #{t} ke…', { t: tg.name }), h('div', { class: 'stack' },
      h('div', { class: 'chips wrapx' }, others.map(o => h('button', { class: 'chip', type: 'button', onClick: async () => {
        s.close(); await store.renameTag(tg.name, o.name); snack(t('#{a} digabung ke #{b}', { a: tg.name, b: o.name }));
      } }, '#' + o.name))),
      h('p', { class: 'small muted', style: 'margin:0' }, t('{n} catatan akan memakai tag tujuan, lalu #{t} dihapus.', { n: tg.count, t: tg.name }))));
  }
  async function del(tg) {
    const ok = await confirm({ title: t('Hapus #{t}?', { t: tg.name }), message: t('Tag dilepas dari {n} catatan. Catatannya tetap ada.', { n: tg.count }), ok: t('Hapus tag'), danger: true, icon: 'tag' });
    if (!ok) return;
    await store.deleteTag(tg.name); snack(t('Tag dihapus'));
  }
  draw();
  ctx.watch(['notes'], draw);
  void btn;
}
