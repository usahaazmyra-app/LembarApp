// Lembar · menyesuaikan tampilan saat keyboard HP muncul.
// Android Chrome: meta viewport "interactive-widget=resizes-content" sudah mengecilkan halaman.
// iPhone (Safari) dan browser lain: keyboard menutupi halaman, jadi ukuran area yang terlihat
// (visualViewport) dipakai untuk menaruh aplikasi tepat di atas keyboard.
const vv = window.visualViewport;
const root = document.documentElement;
let raf = 0;

function sync() {
  raf = 0;
  if (!vv) return;
  const top = Math.max(0, vv.offsetTop);
  const covered = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
  root.style.setProperty('--vv-top', top + 'px');
  root.style.setProperty('--kb', covered + 'px');
  root.style.setProperty('--vvh', vv.height + 'px');
  // keyboard dianggap terbuka bila area terlihat jauh lebih pendek dari layar
  const open = covered > 80 || (screen.height && vv.height < screen.height * 0.62 && isTyping());
  root.classList.toggle('kb-open', !!open);
  if (open) keepCaretVisible();
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(sync); };

function isTyping() {
  const a = document.activeElement;
  return !!a && (a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'range', 'file'].includes(a.type)));
}

// jaga baris yang sedang diketik tetap terlihat di atas keyboard/toolbar
export function keepCaretVisible() {
  const a = document.activeElement;
  if (!a || !isTyping()) return;
  const box = a.closest('.scroll, .sheet-body, .sheet, .dlg');
  if (!box || box.scrollHeight <= box.clientHeight) return;
  let rect = null;
  const sel = window.getSelection();
  if (a.isContentEditable && sel && sel.rangeCount) {
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(false);
    rect = r.getClientRects()[0] || null;
    if (!rect || (!rect.height && !rect.top)) {
      const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      rect = n && n.getBoundingClientRect();
    }
  }
  if (!rect) rect = a.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const margin = 28;
  if (rect.bottom > b.bottom - margin) box.scrollTop += rect.bottom - b.bottom + margin + 12;
  else if (rect.top < b.top + 8) box.scrollTop -= b.top - rect.top + 24;
}

if (vv) {
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  window.addEventListener('orientationchange', () => setTimeout(schedule, 300));
  // iOS kadang menggeser halaman saat input difokuskan; kembalikan agar tampilan tidak "loncat"
  window.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); schedule(); }, { passive: true });
  document.addEventListener('focusin', () => setTimeout(schedule, 60));
  document.addEventListener('focusout', () => setTimeout(schedule, 120));
  let selRaf = 0;
  document.addEventListener('selectionchange', () => {
    if (!root.classList.contains('kb-open') || selRaf) return;
    selRaf = requestAnimationFrame(() => { selRaf = 0; keepCaretVisible(); });
  });
  document.addEventListener('input', () => { if (root.classList.contains('kb-open')) requestAnimationFrame(keepCaretVisible); }, true);
  sync();
}
