// Lembar · terapkan tema tersimpan sebelum aplikasi dimuat (mencegah kedip warna)
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('lembar-theme') || 'null');
    if (!s) return;
    var r = document.documentElement;
    var theme = s.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'paper') : s.theme;
    r.setAttribute('data-theme', theme || 'paper');
    if (s.accent) r.setAttribute('data-accent', s.accent);
    if (s.fz) r.style.setProperty('--fz', s.fz);
    if (s.lang) r.setAttribute('lang', s.lang);
  } catch (e) { /* abaikan */ }
})();
