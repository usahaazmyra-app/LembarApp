// Tema, warna aksen, dan ukuran huruf.
import { setting } from './store.js';
import { ACCENTS, FONT_SIZES } from './data.js';
import { lang } from './i18n.js';

export function applyTheme() {
  const root = document.documentElement;
  const theme = setting('theme');
  root.dataset.theme = theme;
  const a = ACCENTS[setting('accent')] || ACCENTS.terakota;
  const dark = theme === 'gelap';
  root.style.setProperty('--accent', dark ? a.dark : a.light);
  root.style.setProperty('--accent-soft', dark ? a.softD : a.softL);
  root.style.setProperty('--on-accent', dark ? '#1B1A18' : '#FFFFFF');
  root.style.setProperty('--fs', FONT_SIZES[setting('fontSize')] || 1);
  root.lang = lang();
  const bg = getComputedStyle(root).getPropertyValue('--paper').trim() || '#FAF7F2';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
}
