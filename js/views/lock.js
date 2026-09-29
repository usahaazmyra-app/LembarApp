// Lembar · PIN, sidik jari, kunci aplikasi
import * as store from '../store.js';
import { h, fullscreen, snack, iconBtn, vibrate } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';

// ---------- hashing ----------
const enc = new TextEncoder();
function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function hashSecret(secret, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 120000 }, key, 256);
  return hex(bits);
}
const normAnswer = a => (a || '').trim().toLowerCase().replace(/\s+/g, ' ');
export function newSalt() { return hex(crypto.getRandomValues(new Uint8Array(16))); }
export async function verifyPin(pin) {
  const s = store.settings();
  if (!s.pinHash) return false;
  return (await hashSecret(pin, s.pinSalt)) === s.pinHash;
}

// ---------- biometrik (WebAuthn perangkat) ----------
export function bioAvailable() {
  return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable);
}
export async function bioSupported() {
  if (!bioAvailable()) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { return false; }
}
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
export async function bioRegister() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: 'Lembar', id: location.hostname },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'lembar-local', displayName: 'Lembar' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000, attestation: 'none',
  } });
  await store.setSetting('bioCred', b64u(cred.rawId));
  await store.setSetting('bio', true);
}
export async function bioVerify() {
  const id = store.settings().bioCred;
  if (!id) return false;
  try {
    const a = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: fromB64u(id), transports: ['internal'] }],
      userVerification: 'required', timeout: 60000, rpId: location.hostname,
    } });
    return !!a;
  } catch (e) { return false; }
}

// ---------- PIN pad ----------
function pinPad({ title, sub, onDigits, bio, onBio, onForgot, onCancel, lengthRef = 4 }) {
  let val = '';
  const dots = h('div', { class: 'pins', 'aria-hidden': 'true' });
  const status = h('p', { class: 'small muted', style: 'margin:0;min-height:1.5em', role: 'status' }, sub || '');
  const drawDots = () => dots.replaceChildren(...Array.from({ length: lengthRef }, (_, i) => h('i', { class: i < val.length ? 'on' : '' })));
  drawDots();
  let busy = false;
  const press = async (d) => {
    if (busy || val.length >= lengthRef) return;
    vibrate(5); val += d; drawDots();
    if (val.length === lengthRef) {
      busy = true;
      const res = await onDigits(val);
      busy = false;
      if (res !== true) {
        dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); vibrate(40);
        if (typeof res === 'string') status.textContent = res;
        setTimeout(() => { val = ''; drawDots(); }, 250);
      }
    }
  };
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => h('button', { class: 'key', type: 'button', onClick: () => press(String(n)) }, n));
  const bioBtn = bio ? h('button', { class: 'key plain', type: 'button', 'aria-label': t('Pakai sidik jari'), style: 'color:var(--accent)', onClick: onBio }, icon('finger', 'l')) : h('span');
  const del = h('button', { class: 'key plain', type: 'button', 'aria-label': t('Hapus angka'), onClick: () => { val = val.slice(0, -1); drawDots(); } }, icon('back', 'l'));
  const onKey = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') { val = val.slice(0, -1); drawDots(); } };
  document.addEventListener('keydown', onKey);
  const el = h('div', { class: 'lockscr' },
    onCancel ? h('div', { style: 'align-self:flex-start' }, iconBtn('back', t('Kembali'), onCancel)) : null,
    h('div', { class: 'lock-hd' },
      h('div', { style: 'width:72px;height:72px;border-radius:24px;background:var(--k4);display:flex;align-items:center;justify-content:center' }, icon('lock', 'l')),
      h('h1', { class: 'h2', style: 'font-size:1.5rem' }, title), status, dots),
    h('div', { class: 'pad' }, keys, bioBtn, h('button', { class: 'key', type: 'button', onClick: () => press('0') }, '0'), del),
    onForgot ? h('button', { class: 'btn t sm accent', type: 'button', style: 'margin-top:14px', onClick: onForgot }, t('Lupa PIN? Gunakan pertanyaan pemulihan')) : null);
  el._cleanup = () => document.removeEventListener('keydown', onKey);
  el._status = status;
  return el;
}

let attempts = 0, lockedUntil = 0;
async function checkPinAttempt(pin) {
  if (Date.now() < lockedUntil) return t('Terlalu banyak percobaan. Coba lagi dalam {n} detik.', { n: Math.ceil((lockedUntil - Date.now()) / 1000) });
  if (await verifyPin(pin)) { attempts = 0; return true; }
  attempts++;
  if (attempts >= 5) { lockedUntil = Date.now() + 30000; attempts = 0; return t('Terlalu banyak percobaan. Coba lagi dalam {n} detik.', { n: 30 }); }
  return t('PIN salah. Sisa {n} percobaan.', { n: 5 - attempts });
}

// Minta buka kunci (untuk catatan/buku terkunci). Resolve true bila berhasil.
export function requestUnlock({ title = t('Masukkan PIN') } = {}) {
  if (store.session.unlocked) return Promise.resolve(true);
  if (!store.hasPin()) { snack(t('Atur PIN dulu di Pengaturan · Keamanan')); return Promise.resolve(false); }
  return new Promise(resolve => {
    let done = false, fs;
    const finish = (ok) => { if (done) return; done = true; if (ok) store.session.unlocked = true; pad._cleanup(); fs.close(); resolve(ok); store.emit('notes'); };
    const s = store.settings();
    const pad = pinPad({
      title, sub: t('Masukkan PIN 4 digit') + (s.bio ? ' ' + t('atau gunakan sidik jari') : ''),
      onDigits: async p => { const r = await checkPinAttempt(p); if (r === true) finish(true); return r; },
      bio: !!s.bio, onBio: async () => { if (await bioVerify()) finish(true); },
      onForgot: () => { pad._cleanup(); fs.close(); resolve(false); done = true; openForgot(); },
      onCancel: () => finish(false),
    });
    fs = fullscreen(pad, { onClose: () => { if (!done) { done = true; pad._cleanup(); resolve(false); } } });
    if (s.bio) setTimeout(async () => { if (!done && await bioVerify()) finish(true); }, 350);
  });
}

// Kunci aplikasi saat dibuka (tidak bisa ditutup)
export function lockGate() {
  if (document.getElementById('gate')) return Promise.resolve();
  return new Promise(resolve => {
    const s = store.settings();
    const gate = h('div', { id: 'gate', style: 'position:fixed;inset:0;z-index:90;background:var(--paper)' });
    const finish = () => { store.session.unlocked = true; pad._cleanup(); gate.remove(); resolve(); store.emit('notes'); };
    const pad = pinPad({
      title: t('Lembar terkunci'), sub: t('Masukkan PIN untuk membuka') ,
      onDigits: async p => { const r = await checkPinAttempt(p); if (r === true) finish(); return r; },
      bio: !!s.bio, onBio: async () => { if (await bioVerify()) finish(); },
      onForgot: () => openForgot(() => finish()),
    });
    gate.appendChild(pad);
    document.body.appendChild(gate);
    if (s.bio) setTimeout(async () => { if (gate.isConnected && await bioVerify()) finish(); }, 400);
  });
}

// ---------- buat / ubah PIN ----------
export const QUESTIONS = ['Nama hewan peliharaan pertamamu?', 'Nama SD tempatmu sekolah?', 'Makanan favorit waktu kecil?', 'Kota kelahiran ibumu?', 'Nama sahabat masa kecilmu?'];

export function setupPin({ requireOld = true } = {}) {
  return new Promise(resolve => {
    let fs, step = (requireOld && store.hasPin()) ? 'old' : 'new', first = '';
    const host = h('div', { style: 'position:absolute;inset:0' });
    let pad = null;
    const finish = ok => { pad && pad._cleanup && pad._cleanup(); fs.close(); resolve(ok); };
    const drawPad = () => {
      pad && pad._cleanup && pad._cleanup();
      const titles = { old: t('Masukkan PIN lama'), new: t('Buat PIN baru'), repeat: t('Ulangi PIN') };
      const subs = { old: t('Untuk keamanan, masukkan PIN yang sekarang'), new: t('4 angka untuk mengunci buku dan catatan privat'), repeat: t('Ketik sekali lagi untuk memastikan') };
      pad = pinPad({
        title: titles[step], sub: subs[step], onCancel: () => finish(false),
        onDigits: async p => {
          if (step === 'old') { const r = await checkPinAttempt(p); if (r === true) { step = 'new'; setTimeout(drawPad, 200); return true; } return r; }
          if (step === 'new') { first = p; step = 'repeat'; setTimeout(drawPad, 200); return true; }
          if (p !== first) { step = 'new'; setTimeout(drawPad, 700); return t('PIN tidak sama. Ulangi dari awal.'); }
          setTimeout(drawQuestion, 150); return true;
        },
      });
      host.replaceChildren(pad);
    };
    const drawQuestion = () => {
      pad && pad._cleanup && pad._cleanup(); pad = null;
      const sel = h('select', {}, QUESTIONS.map(q => h('option', { value: q }, t(q))));
      const cur = store.settings().recoveryQ; if (cur) sel.value = cur;
      const ans = h('input', { type: 'text', placeholder: t('Jawabanmu'), autocomplete: 'off', maxlength: 60 });
      const saveBtn = h('button', { class: 'btn p block', type: 'button', onClick: async () => {
        if (!ans.value.trim()) { ans.focus(); ans.classList.add('err'); return; }
        saveBtn.disabled = true;
        const salt = newSalt();
        await store.setSetting('pinSalt', salt);
        await store.setSetting('pinHash', await hashSecret(first, salt));
        await store.setSetting('recoveryQ', sel.value);
        await store.setSetting('recoveryHash', await hashSecret(normAnswer(ans.value), salt + ':r'));
        store.session.unlocked = true;
        host.replaceChildren(h('div', { class: 'lockscr', style: 'justify-content:center;gap:14px;text-align:center' },
          h('div', { style: 'width:84px;height:84px;border-radius:42px;background:var(--k2);display:flex;align-items:center;justify-content:center;color:var(--ok)' }, icon('tick', 'l')),
          h('h1', { class: 'h2', style: 'font-size:1.5rem' }, t('PIN aktif')),
          h('p', { class: 'small muted', style: 'margin:0;max-width:300px' }, t('Buku dan catatan yang kamu kunci sekarang memakai PIN ini.')),
          h('button', { class: 'btn p', type: 'button', style: 'margin-top:12px;min-width:200px', onClick: () => finish(true) }, t('Selesai'))));
      } }, t('Simpan'));
      host.replaceChildren(h('div', { class: 'lockscr', style: 'align-items:stretch' },
        h('div', { class: 'stack', style: 'max-width:420px;width:100%;margin:0 auto;padding-top:20px' },
          h('h1', { class: 'h2', style: 'font-size:1.5rem' }, t('Pertanyaan pemulihan')),
          h('p', { class: 'small muted', style: 'margin:0' }, t('Dipakai kalau kamu lupa PIN. Jawabannya hanya tersimpan di perangkat ini.')),
          h('label', { class: 'field' }, t('Pertanyaan'), sel),
          h('label', { class: 'field' }, t('Jawaban'), ans),
          h('div', { class: 'notice k1' }, icon('info', 's'), t('Pilih jawaban yang mudah kamu ingat, tapi sulit ditebak orang lain.')),
          saveBtn)));
      setTimeout(() => ans.focus(), 50);
    };
    fs = fullscreen(host, { onClose: () => { pad && pad._cleanup && pad._cleanup(); } });
    drawPad();
  });
}

// ---------- lupa PIN ----------
export function openForgot(onSuccess) {
  const s = store.settings();
  if (!s.recoveryHash) { snack(t('Pertanyaan pemulihan belum diatur')); return; }
  let fs; let tries = 0;
  const ans = h('input', { type: 'text', placeholder: t('Jawabanmu'), autocomplete: 'off' });
  const msg = h('p', { class: 'small', style: 'margin:0;min-height:1.4em;font-weight:600', role: 'status' });
  const verify = async () => {
    const ok = (await hashSecret(normAnswer(ans.value), s.pinSalt + ':r')) === s.recoveryHash;
    if (!ok) { tries++; ans.classList.add('err'); msg.style.color = 'var(--danger)'; msg.textContent = tries >= 3 ? t('Jawaban belum cocok. Tunggu sebentar lalu coba lagi.') : t('Jawaban belum cocok.'); if (tries >= 3) { vbtn.disabled = true; setTimeout(() => { vbtn.disabled = false; tries = 0; }, 30000); } return; }
    fs.close();
    store.session.unlocked = true;
    const done = await setupPin({ requireOld: false });
    if (done && onSuccess) onSuccess();
  };
  const vbtn = h('button', { class: 'btn p block', type: 'button', onClick: verify }, t('Verifikasi'));
  ans.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); });
  fs = fullscreen(h('div', { class: 'lockscr', style: 'align-items:stretch;z-index:95' },
    h('div', { style: 'align-self:flex-start' }, iconBtn('back', t('Kembali'), () => fs.close())),
    h('div', { class: 'stack', style: 'max-width:420px;width:100%;margin:0 auto;padding-top:12px' },
      h('div', { style: 'width:64px;height:64px;border-radius:20px;background:var(--k1);display:flex;align-items:center;justify-content:center' }, icon('lock', 'l')),
      h('h1', { class: 'title', style: 'font-size:1.75rem' }, t('Lupa PIN?')),
      h('p', { class: 'small muted', style: 'margin:0' }, t('Jawab pertanyaan pemulihan yang kamu buat saat mengatur PIN.')),
      h('div', { class: 'group', style: 'padding:14px 16px' }, h('span', { class: 'lbl' }, t('Pertanyaan')), h('p', { style: 'margin:6px 0 0;font-family:var(--serif);font-size:1.12rem;font-weight:600' }, t(s.recoveryQ || ''))),
      h('label', { class: 'field' }, t('Jawaban'), ans), msg,
      h('div', { class: 'notice', style: 'background:var(--surface2);color:var(--muted)' }, icon('shield', 's'), t('Demi privasi, catatan terkunci tidak bisa dibuka tanpa PIN atau jawaban ini. Catatan lain tetap bisa diakses.')),
      vbtn)));
  const gate = document.getElementById('gate');
  if (gate) { const ov = document.getElementById('overlays'); ov.style.zIndex = '95'; setTimeout(() => { const obs = new MutationObserver(() => { if (!ov.children.length) { ov.style.zIndex = ''; obs.disconnect(); } }); obs.observe(ov, { childList: true }); }, 0); }
  setTimeout(() => ans.focus(), 60);
}

export async function removePin() {
  for (const k of ['pinHash', 'pinSalt', 'recoveryQ', 'recoveryHash', 'bioCred']) await store.setSetting(k, null);
  await store.setSetting('bio', false);
  await store.setSetting('appLock', false);
  const lockedBooks = store.books().filter(b => b.locked);
  for (const b of lockedBooks) await store.saveBook({ ...b, locked: false });
  const lockedNotes = store.allNotes().filter(n => n.locked).map(n => n.id);
  if (lockedNotes.length) await store.patchNotes(lockedNotes, { locked: false });
}
