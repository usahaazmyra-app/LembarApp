// Kunci privat: PIN dan jawaban pemulihan membuka satu kunci data (AES-GCM).
// Isi catatan terkunci disimpan dalam bentuk terenkripsi.
const te = new TextEncoder();
const td = new TextDecoder();

export function b64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function ub64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export const normAnswer = (a) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function derive(secret, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function wrap(secret, raw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await derive(secret, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, raw);
  return { salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

// Buat (atau perbarui) keyring. Jika raw diberikan, kunci data lama dipakai ulang.
export async function makeKeyring({ pin, question, answer, raw = null, id = null }) {
  const key = raw || crypto.getRandomValues(new Uint8Array(32));
  return {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    pin: await wrap(pin, key),
    rec: await wrap(normAnswer(answer), key),
    question,
    raw: key
  };
}

export async function unwrap(keyring, secret, which = 'pin') {
  const w = keyring && keyring[which];
  if (!w) return null;
  try {
    const k = await derive(which === 'rec' ? normAnswer(secret) : secret, ub64(w.salt));
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(w.iv) }, k, ub64(w.ct));
    return new Uint8Array(raw);
  } catch (e) {
    return null;
  }
}

export function importKey(raw) {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptJSON(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptJSON(key, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(box.iv) }, key, ub64(box.ct));
  return JSON.parse(td.decode(pt));
}
