// Lembar · panduan awal (3 langkah)
import * as store from '../store.js';
import { h, clear } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';

export function render(view, args, ctx, query = {}) {
  let step = 0;
  const finish = async () => { await store.setSetting('onboarded', true); ctx.navigate(query.again ? 'settings' : 'home', { replace: true }); };
  const root = h('div', { class: 'ob' });
  view.appendChild(root);
  const stages = [
    () => h('div', { class: 'ob-stage', style: 'background:var(--k1)' },
      h('div', { style: 'width:170px;height:290px;border-radius:30px;background:var(--surface);border:2px solid var(--ink);display:flex;flex-direction:column;gap:10px;padding:26px 16px;position:relative' },
        h('div', { class: 'ghost', style: 'width:70%;height:10px;background:var(--ink)' }), h('div', { class: 'ghost', style: 'width:100%' }), h('div', { class: 'ghost', style: 'width:88%' }), h('div', { class: 'ghost', style: 'width:60%' }),
        h('div', { style: 'margin-top:12px;height:60px;border-radius:12px;background:var(--k3)' }), h('div', { style: 'height:44px;border-radius:12px;background:var(--k2)' }),
        h('div', { style: 'position:absolute;right:-34px;bottom:40px;width:74px;height:74px;border-radius:37px;background:#C24E2E;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px rgba(194,78,46,.35)' }, icon('lock', 'l'))),
      h('span', { class: 'tagpill', style: 'position:absolute;left:24px;top:28px;background:var(--surface);padding:8px 12px;font-size:.75rem' }, t('Tanpa internet')),
      h('span', { class: 'tagpill', style: 'position:absolute;right:22px;top:86px;background:var(--surface);padding:8px 12px;font-size:.75rem' }, t('Tanpa akun'))),
    () => h('div', { class: 'ob-stage', style: 'background:var(--k3)' },
      h('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px' },
        [['text', 'k1', t('Teks')], ['check', 'k2', t('Checklist')], ['sketch', 'k6', t('Sketsa')], ['mic', 'k4', t('Suara')]].map(([ic, bg, l]) => h('div', { class: 'tile', style: `background:var(--${bg})` }, icon(ic, 'l'), l))),
      h('div', { class: 'tile', style: 'position:absolute;right:30px;bottom:26px;width:76px;height:76px;background:var(--k5);transform:rotate(8deg)' }, icon('photo'), t('Foto'))),
    () => h('div', { class: 'ob-stage', style: 'background:var(--k2);flex-direction:column;gap:16px' },
      swipeDemo('var(--ok)', t('Arsip'), 'archive', 96, t('Daftar belanja'), t('Beras, telur, kopi…')),
      swipeDemo('var(--danger)', t('Hapus'), 'trash', -96, t('Catatan lama'), t('Draf yang sudah tidak dipakai')),
      h('div', { class: 'snack in', style: 'position:relative;width:300px;max-width:84%' }, h('span', { class: 'snack-msg' }, t('Dipindah ke Sampah')), h('button', { type: 'button', tabindex: '-1' }, t('Urungkan')))),
  ];
  const texts = [
    [t('Tersimpan di HP-mu saja'), t('Lembar bekerja tanpa internet dan tanpa akun. Catatanmu tidak pernah keluar dari perangkat, kecuali kamu sendiri yang membagikannya.')],
    [t('Tulis dengan caramu'), t('Teks, checklist, coretan tangan, rekaman suara, atau foto, bahkan dicampur dalam satu catatan. Mulai cepat dengan template.')],
    [t('Rapi dengan satu usapan'), t('Usap ke kanan untuk arsip, ke kiri untuk hapus, tekan lama untuk memilih banyak. Salah geser? Tinggal urungkan.')],
  ];
  function swipeDemo(bg, label, ic, dx, title, sub) {
    return h('div', { style: 'position:relative;width:300px;max-width:84%;height:78px' },
      h('div', { style: `position:absolute;inset:0;border-radius:18px;background:${bg};color:#fff;display:flex;align-items:center;${dx > 0 ? 'padding-left:20px' : 'justify-content:flex-end;padding-right:20px'};gap:8px;font-weight:700;font-size:.8rem` }, dx > 0 ? icon(ic) : null, label, dx < 0 ? icon(ic) : null),
      h('div', { class: 'lrow', style: `position:absolute;inset:0;transform:translateX(${dx}px);box-shadow:0 8px 20px rgba(27,26,24,.14)` }, h('div', {}, h('h4', {}, title), h('p', {}, sub))));
  }
  const draw = () => {
    clear(root);
    root.append(
      h('div', { class: 'hdr', style: 'justify-content:space-between;padding-left:24px' }, h('span', { class: 'lbl' }, t('Langkah {n} dari 3', { n: step + 1 })), h('button', { class: 'btn t sm', type: 'button', onClick: finish }, t('Lewati'))),
      stages[step](),
      h('div', { style: 'padding:26px 28px 0;display:flex;flex-direction:column;gap:12px;max-width:560px' }, h('h1', { class: 'title', style: 'font-size:1.85rem' }, texts[step][0]), h('p', { class: 'small muted', style: 'margin:0;font-size:.94rem;line-height:1.6' }, texts[step][1])),
      h('div', { style: 'flex:1' }),
      h('div', { style: 'padding:0 24px;display:flex;align-items:center;justify-content:space-between' },
        h('div', { class: 'ob-dots', 'aria-hidden': 'true' }, [0, 1, 2].map(i => h('i', { class: i === step ? 'on' : '' }))),
        step < 2 ? h('button', { class: 'btn p', type: 'button', style: 'min-width:140px', onClick: () => { step++; draw(); } }, t('Lanjut'), icon('right', 's'))
          : h('button', { class: 'btn p', type: 'button', style: 'min-width:170px', onClick: finish }, t('Mulai menulis'))));
  };
  let sx = null;
  root.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (dx < -60 && step < 2) { step++; draw(); } else if (dx > 60 && step > 0) { step--; draw(); } });
  draw();
}
