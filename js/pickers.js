// Lembar · lembar pilihan bersama (buku, warna, tag, pengingat)
import * as store from './store.js';
import { h, sheet, btn } from './ui.js';
import { icon } from './icons.js';
import { t, fmtWeekdayShort } from './i18n.js';
import { bookColorVar } from './components.js';

export function pickBook(currentId, { title = t('Pindahkan ke buku') } = {}) {
  return new Promise(resolve => {
    let decided = false;
    const opt = (id, name, color, sub) => h('button', { class: 'mrow', type: 'button', style: currentId === id ? 'background:var(--accent-soft)' : '', onClick: () => { decided = true; s.close(); resolve(id); } },
      h('span', { style: `width:30px;height:36px;border-radius:4px 10px 10px 4px;background:${color};flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)` }),
      h('span', { class: 'grow' }, name, sub ? h('span', { class: 'sub', style: 'display:block;font-size:.75rem;color:var(--muted);font-weight:500' }, sub) : null),
      currentId === id ? icon('tick', 's') : null);
    const live = store.liveNotes();
    const s = sheet(title, h('div', { class: 'menu-list' },
      opt(null, t('Tanpa buku'), 'var(--surface2)'),
      store.books().map(b => opt(b.id, b.name, bookColorVar(b), b.locked ? t('Terkunci') : t('{n} catatan', { n: live.filter(n => n.bookId === b.id).length }))),
      h('button', { class: 'mrow', type: 'button', style: 'color:var(--accent-ink)', onClick: async () => {
        const { promptText } = await import('./ui.js');
        const name = await promptText({ title: t('Buku baru'), placeholder: t('Nama buku') });
        if (!name) return;
        const b = await store.saveBook({ name, color: 'k7', icon: 'book' });
        decided = true; s.close(); resolve(b.id);
      } }, icon('plus', 's'), t('Buku baru…'))),
      { onClose: () => { if (!decided) resolve(undefined); } });
  });
}

export function colorRow(current, onPick, size = 28) {
  const wrap = h('div', { class: 'swatches', style: 'justify-content:space-between;flex-wrap:nowrap;gap:4px' });
  for (const [k, name] of store.CARD_COLORS) {
    const b = h('button', { type: 'button', class: 'sw' + (k === (current || '') ? ' on' : '') + (k ? '' : ' none'), style: `width:${size}px;height:${size}px;border-radius:${size / 2}px;${k ? `background:var(--${k})` : ''}`, 'aria-label': t(name), title: t(name) });
    b.addEventListener('click', () => { wrap.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); b.classList.add('on'); onPick(k); });
    wrap.appendChild(b);
  }
  return wrap;
}

export function pickColor(current) {
  return new Promise(resolve => {
    let decided = false;
    const s = sheet(t('Warna kartu'), colorRow(current, k => { decided = true; setTimeout(() => s.close(), 120); resolve(k); }), { onClose: () => { if (!decided) resolve(undefined); } });
  });
}

export function pickTags(initial = [], { title = t('Tag') } = {}) {
  return new Promise(resolve => {
    const sel = new Set(initial);
    let decided = false;
    const all = store.allTags();
    const list = h('div', { class: 'chips wrapx' });
    const draw = () => {
      list.replaceChildren(...[...new Set([...all.map(x => x.name), ...sel])].map(name => {
        const on = sel.has(name);
        return h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', onClick: () => { on ? sel.delete(name) : sel.add(name); draw(); } }, on ? icon('tick', 'xs') : null, '#' + name);
      }));
    };
    const input = h('input', { class: 'field-input', placeholder: t('Tag baru, misal kuliah'), maxlength: 40 });
    const add = () => { const v = input.value.replace(/^#/, '').trim().toLowerCase().replace(/\s+/g, '-'); if (v) { sel.add(v); input.value = ''; draw(); } };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    draw();
    const s = sheet(title, h('div', { class: 'stack' },
      h('div', { class: 'row-flex' }, input, btn(t('Tambah'), 'g sm', add)),
      list,
      btn(t('Simpan'), 'p block', () => { add(); decided = true; s.close(); resolve([...sel]); })),
      { onClose: () => { if (!decided) resolve(undefined); } });
  });
}

// ---------- pengingat ----------
function toLocalInput(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
export function pickReminder(current) {
  return new Promise(resolve => {
    let decided = false;
    const now = new Date();
    const at = (d, hh, mm = 0) => { const x = new Date(d); x.setHours(hh, mm, 0, 0); return x.getTime(); };
    const evening = at(now, 17) > Date.now() + 5 * 60000 ? at(now, 17) : at(new Date(Date.now() + 86400000), 17);
    const tomorrow = at(new Date(Date.now() + 86400000), 8);
    const nextMon = (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return at(d, 8); })();
    const quick = [
      [t('Nanti sore'), evening], [t('Besok pagi'), tomorrow], [t('Senin depan'), nextMon], [t('Pilih sendiri'), null],
    ];
    let chosen = current ? current.at : null;
    let repeat = current ? current.repeat || 'none' : 'none';
    let days = current && current.days ? [...current.days] : [];
    const init = toLocalInput(chosen || evening);
    const dateIn = h('input', { type: 'date', value: init.date });
    const timeIn = h('input', { type: 'time', value: init.time });
    const custom = h('div', { class: 'group', style: 'padding:6px 16px' },
      h('label', { class: 'row' }, icon('calendar'), h('span', { class: 'grow' }, t('Tanggal')), dateIn),
      h('label', { class: 'row' }, icon('clock'), h('span', { class: 'grow' }, t('Waktu')), timeIn));
    [dateIn, timeIn].forEach(i => { i.style.cssText = 'border:0;background:transparent;font:600 .9rem var(--sans);color:var(--accent-ink)'; i.addEventListener('change', () => { chosen = null; qsel = 3; drawQuick(); }); });
    let qsel = current ? 3 : 0;
    const qwrap = h('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px' });
    const fmt = ts => new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en-US' : 'id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(ts);
    const drawQuick = () => {
      qwrap.replaceChildren(...quick.map(([label, ts], i) => h('button', { type: 'button', class: 'qa', style: `align-items:flex-start;padding:12px;${qsel === i ? 'border-color:var(--accent);background:var(--accent-soft)' : ''}`, onClick: () => { qsel = i; if (ts) { const v = toLocalInput(ts); dateIn.value = v.date; timeIn.value = v.time; } drawQuick(); } },
        h('b', { style: 'font-size:.875rem' }, label), h('span', { class: 'muted', style: 'font-weight:500' }, ts ? fmt(ts) : t('Tanggal & waktu')))));
      custom.hidden = qsel !== 3;
    };
    drawQuick();
    const reps = [['none', t('Tidak')], ['daily', t('Harian')], ['weekly', t('Mingguan')], ['monthly', t('Bulanan')]];
    const seg = h('div', { class: 'seg' });
    const dayRow = h('div', { style: 'display:flex;justify-content:space-between' });
    const drawRep = () => {
      seg.replaceChildren(...reps.map(([k, l]) => h('button', { type: 'button', class: repeat === k ? 'on' : '', onClick: () => { repeat = k; drawRep(); } }, l)));
      dayRow.hidden = repeat !== 'weekly';
      dayRow.replaceChildren(...[1, 2, 3, 4, 5, 6, 0].map(d => h('button', { type: 'button', 'aria-label': fmtWeekdayShort(d), style: `width:40px;height:40px;border-radius:20px;border:1px solid var(--line);font-weight:700;font-size:.7rem;padding:0;${days.includes(d) ? 'background:var(--ink);color:var(--paper);border-color:var(--ink)' : 'background:var(--paper)'}`, onClick: () => { days = days.includes(d) ? days.filter(x => x !== d) : [...days, d]; drawRep(); } }, fmtWeekdayShort(d).replace('.', '').slice(0, 3))));
    };
    drawRep();
    const save = () => {
      const [y, m, d] = dateIn.value.split('-').map(Number);
      const [hh, mm] = timeIn.value.split(':').map(Number);
      let ts = new Date(y, m - 1, d, hh, mm).getTime();
      if (!dateIn.value || !timeIn.value || !isFinite(ts)) { (dateIn.value ? timeIn : dateIn).focus(); import('./ui.js').then(u => u.snack(t('Isi tanggal dan waktu dulu'))); return; }
      if (ts < Date.now() - 30000 && repeat === 'none') { dateIn.focus(); import('./ui.js').then(u => u.snack(t('Pilih waktu yang belum lewat'))); return; }
      if (repeat === 'weekly' && !days.length) days = [new Date(ts).getDay()];
      // pengingat berulang: mulai dari kejadian pertama yang sesuai hari terpilih dan belum lewat
      if (repeat === 'weekly') {
        const d0 = new Date(ts);
        for (let i = 0; i < 8; i++) { const c = new Date(d0); c.setDate(d0.getDate() + i); if (days.includes(c.getDay()) && c.getTime() >= Date.now() - 30000) { ts = c.getTime(); break; } }
      } else if (repeat !== 'none' && ts < Date.now() - 30000) {
        ts = store.nextOccurrence({ at: ts, repeat, dom: new Date(ts).getDate() }, Date.now());
      }
      decided = true; s.close();
      const out = { at: ts, repeat, days: repeat === 'weekly' ? days : [], done: false, fired: false };
      if (repeat === 'monthly') out.dom = new Date(y, m - 1, d).getDate();
      resolve(out);
    };
    const s = sheet(t('Ingatkan saya'), h('div', { class: 'stack' },
      qwrap, custom,
      h('span', { class: 'lbl', style: 'display:flex;gap:6px;align-items:center' }, icon('repeat', 'xs'), t('Ulangi')), seg, dayRow,
      h('div', { class: 'row-flex' },
        current ? btn(t('Hapus pengingat'), 't danger sm', () => { decided = true; s.close(); resolve(null); }) : null,
        h('span', { class: 'grow' }),
        btn(t('Simpan pengingat'), 'p', save))),
      { onClose: () => { if (!decided) resolve(undefined); } });
  });
}
