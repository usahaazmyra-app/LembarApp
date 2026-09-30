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
    // warna bilah status/browser mengikuti tema sejak awal (sebelum aplikasi dimuat)
    var dark = theme === 'dark';
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', dark ? '#141312' : (theme === 'light' ? '#FFFFFF' : '#FAF7F2'));
    var sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (sb) sb.setAttribute('content', dark ? 'black-translucent' : 'default');
  } catch (e) { /* abaikan */ }
})();
