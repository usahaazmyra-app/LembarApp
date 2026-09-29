// Lembar · Statistik menulis
import * as store from '../store.js';
import { h, clear } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtWeekdayShort, fmtNum, locale } from '../i18n.js';
import { header, MOODS } from '../components.js';

function longestStreak(days) {
  const s = [...new Set(days)].sort(); let best = 0, cur = 0, prev = null;
  for (const k of s) {
    const d = new Date(k + 'T12:00:00');
    if (prev && (d - prev) / store.DAY < 1.5) cur++; else cur = 1;
    best = Math.max(best, cur); prev = d;
  }
  return best;
}

export function render(view, args, ctx) {
  let range = 'week';
  view.appendChild(header(t('Statistik menulis'), { backTo: 'home' }, ctx));
  const body = h('div', { class: 'wrap stack pad-b' });
  view.appendChild(h('div', { class: 'scroll' }, body));
  const draw = () => {
    clear(body);
    const all = store.allNotes().filter(n => !n.trashedAt);
    const st = store.streak(); const longest = longestStreak(store.settings().activeDays || []);
    body.appendChild(h('div', { style: 'border-radius:22px;background:var(--accent-soft);padding:18px;display:flex;align-items:center;gap:16px' },
      h('div', { style: 'width:72px;height:72px;border-radius:36px;background:var(--accent);color:var(--on-accent);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0' }, h('b', { style: 'font:600 1.75rem/1 var(--serif)' }, st), h('span', { style: 'font-size:.66rem;font-weight:700' }, t('hari'))),
      h('div', {}, h('b', { style: 'font-size:1rem' }, t('Streak menulis')), h('p', { class: 'small', style: 'margin:2px 0 0;color:var(--ink2)' }, t('Terpanjang: {n} hari.', { n: longest }) + ' ' + (st ? t('Tulis satu catatan lagi hari ini untuk lanjut.') : t('Tulis satu catatan hari ini untuk memulai.'))))));
    body.appendChild(h('div', { class: 'seg' }, [['week', t('Minggu')], ['month', t('Bulan')], ['year', t('Tahun')]].map(([k, l]) => h('button', { type: 'button', class: range === k ? 'on' : '', onClick: () => { range = k; draw(); } }, l))));
    // --- data grafik
    const now = new Date(); let labels = [], vals = [], cur = 0, sum = '';
    if (range === 'week') {
      const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      for (let i = 0; i < 7; i++) { const s = monday.getTime() + i * store.DAY; labels.push(fmtWeekdayShort((i + 1) % 7).replace('.', '')); vals.push(all.filter(n => n.createdAt >= s && n.createdAt < s + store.DAY).length); }
      cur = (now.getDay() + 6) % 7; sum = t('{n} minggu ini', { n: vals.reduce((a, b) => a + b, 0) });
    } else if (range === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const weeks = Math.ceil(days / 7);
      for (let w = 0; w < weeks; w++) { const s = first + w * 7 * store.DAY, e = Math.min(first + days * store.DAY, s + 7 * store.DAY); labels.push(t('M{n}', { n: w + 1 })); vals.push(all.filter(n => n.createdAt >= s && n.createdAt < e).length); }
      cur = Math.floor((now.getDate() - 1) / 7); sum = t('{n} bulan ini', { n: vals.reduce((a, b) => a + b, 0) });
    } else {
      for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const e = new Date(d.getFullYear(), d.getMonth() + 1, 1); labels.push(new Intl.DateTimeFormat(locale(), { month: 'short' }).format(d).replace('.', '')); vals.push(all.filter(n => n.createdAt >= d.getTime() && n.createdAt < e.getTime()).length); }
      cur = 5; sum = t('{n} dalam 6 bulan', { n: vals.reduce((a, b) => a + b, 0) });
    }
    const max = Math.max(1, ...vals);
    body.appendChild(h('div', { class: 'group', style: 'padding:14px 16px' },
      h('div', { class: 'sechead' }, h('b', { style: 'font-size:.9rem' }, t('Catatan dibuat')), h('span', { class: 'meta' }, sum)),
      h('div', { class: 'chart', role: 'img', 'aria-label': labels.map((l, i) => l + ' ' + vals[i]).join(', ') }, vals.map((v, i) => h('div', { class: 'bcol' + (i === cur ? ' now' : '') }, h('span', {}, v), h('i', { style: `height:${Math.round(v / max * 78)}%` }), labels[i])))));
    const words = all.reduce((a, n) => a + store.wordCount(n), 0);
    body.appendChild(h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('b', {}, fmtNum(all.length)), h('span', {}, t('total catatan'))),
      h('div', { class: 'kpi' }, h('b', {}, words >= 10000 ? fmtNum(Math.round(words / 1000)) + t('rb') : fmtNum(words)), h('span', {}, t('kata ditulis'))),
      h('div', { class: 'kpi' }, h('b', {}, fmtNum(all.filter(n => n.type === 'journal').length)), h('span', {}, t('jurnal')))));
    const types = [['text', t('Teks'), '#6A55A6'], ['checklist', t('Checklist'), '#3E6DB5'], ['photo', t('Foto'), '#D07A3A'], ['voice', t('Suara'), '#2F8A80'], ['sketch', t('Sketsa'), '#6B665E'], ['journal', t('Jurnal'), '#2F6F62']]
      .map(([k, l, c]) => [l, c, all.filter(n => n.type === k).length]).filter(x => x[2]).sort((a, b) => b[2] - a[2]);
    if (types.length) {
      const tmax = types[0][2];
      body.appendChild(h('div', { class: 'group', style: 'padding:14px 16px;display:flex;flex-direction:column;gap:10px' }, h('b', { style: 'font-size:.9rem' }, t('Jenis catatan')),
        types.map(([l, c, v]) => h('div', { class: 'tr' }, h('span', { style: 'width:80px' }, l), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(v / tmax * 100)}%;background:${c}` })), h('span', { class: 'muted', style: 'width:30px;text-align:right' }, v)))));
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const moods = all.filter(n => n.type === 'journal' && n.mood != null && n.createdAt >= monthStart);
    if (moods.length) {
      body.appendChild(h('div', { class: 'group', style: 'padding:14px 16px;display:flex;flex-direction:column;gap:10px' }, h('b', { style: 'font-size:.9rem' }, t('Mood bulan ini')),
        h('div', { style: 'display:flex;height:14px;border-radius:7px;overflow:hidden' }, MOODS.map((m, i) => { const c = moods.filter(n => n.mood === i).length; return c ? h('i', { style: `flex:${c};background:${m.c};display:block`, title: t(m.n) + ': ' + c }) : null; })),
        h('div', { class: 'chips wrapx' }, MOODS.map((m, i) => { const c = moods.filter(n => n.mood === i).length; return c ? h('span', { class: 'meta' }, h('i', { style: `width:10px;height:10px;border-radius:5px;background:${m.c};display:block` }), t(m.n) + ' ' + c) : null; }))));
    }
    if (all.length >= 3) {
      const buckets = new Array(12).fill(0); all.forEach(n => { buckets[Math.floor(new Date(n.createdAt).getHours() / 2)]++; });
      const b = buckets.indexOf(Math.max(...buckets));
      const hh = x => String(x).padStart(2, '0') + '.00';
      body.appendChild(h('div', { class: 'notice k7' }, icon(b >= 9 || b < 3 ? 'moon' : 'sun', 's'), t('Kamu paling sering menulis pukul {a}–{b}.', { a: hh(b * 2), b: hh((b * 2 + 2) % 24) })));
    }
  };
  draw();
  ctx.watch(['notes'], draw);
}
