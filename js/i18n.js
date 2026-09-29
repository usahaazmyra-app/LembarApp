// Lembar · terjemahan. Teks sumber ditulis dalam Bahasa Indonesia;
// kamus bahasa lain memetakan teks Indonesia -> terjemahan.
import EN from './lang/en.js';

export const LANGS = [
  { code: 'id', native: 'Bahasa Indonesia', name: 'Indonesia', locale: 'id-ID' },
  { code: 'en', native: 'English', name: 'Inggris', locale: 'en-US' },
];
const DICTS = { en: EN };
let lang = 'id';

export function detectLang() {
  const l = (navigator.language || 'id').slice(0, 2).toLowerCase();
  return LANGS.some(x => x.code === l) ? l : 'id';
}
export function setLang(code) {
  lang = LANGS.some(x => x.code === code) ? code : 'id';
  document.documentElement.lang = lang;
}
export function getLang() { return lang; }
export function locale() { return (LANGS.find(l => l.code === lang) || LANGS[0]).locale; }

export function t(s, vars) {
  const d = DICTS[lang];
  let out = (d && d[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return out;
}

// ---- date & time ----
const f = (o) => new Intl.DateTimeFormat(locale(), o);
export function fmtTime(ts) { return f({ hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); }
export function fmtDay(ts) { return f({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ts)); }
export function fmtDayYear(ts) { return f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts)); }
export function fmtDate(ts) { return f({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts)); }
export function fmtMonth(ts) { return f({ month: 'long', year: 'numeric' }).format(new Date(ts)); }
export function fmtWeekdayShort(dayIdx) {
  // 0 = Minggu
  const d = new Date(2024, 0, 7 + dayIdx);
  return f({ weekday: 'short' }).format(d);
}
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
export function fmtRelative(ts) {
  const d = new Date(ts); const now = new Date();
  const y = new Date(Date.now() - 86400000);
  if (sameDay(d, now)) return t('Hari ini, {t}', { t: fmtTime(ts) });
  if (sameDay(d, y)) return t('Kemarin');
  if (d.getFullYear() === now.getFullYear()) return f({ day: 'numeric', month: 'short' }).format(d);
  return fmtDate(ts);
}
export function fmtWhen(ts) {
  const d = new Date(ts); const now = new Date();
  const tm = new Date(Date.now() + 86400000);
  if (sameDay(d, now)) return t('Hari ini, {t}', { t: fmtTime(ts) });
  if (sameDay(d, tm)) return t('Besok, {t}', { t: fmtTime(ts) });
  return f({ weekday: 'short', day: 'numeric', month: 'short' }).format(d) + ', ' + fmtTime(ts);
}
export function greeting() {
  const h = new Date().getHours();
  if (h < 11) return t('Selamat pagi');
  if (h < 15) return t('Selamat siang');
  if (h < 18) return t('Selamat sore');
  return t('Selamat malam');
}
export function fmtNum(n) { return new Intl.NumberFormat(locale()).format(n); }
export function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(1).replace('.', lang === 'id' ? ',' : '.') + ' MB';
}
export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
