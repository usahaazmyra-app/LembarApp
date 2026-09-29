// Lembar · perekam suara (MediaRecorder + visual gelombang)
import * as store from '../store.js';
import { h, sheet, snack } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtDur } from '../i18n.js';

function pickMime() {
  const c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const m of c) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

// Resolve: { att, dur, peaks } atau null jika dibatalkan
export function recordAudio() {
  return new Promise(async resolve => {
    if (!navigator.mediaDevices || !window.MediaRecorder) { snack(t('Perekaman suara tidak didukung di perangkat ini')); return resolve(null); }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { snack(e.name === 'NotAllowedError' ? t('Izin mikrofon ditolak. Aktifkan di pengaturan HP.') : t('Mikrofon tidak bisa dipakai')); return resolve(null); }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = []; const peaks = [];
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaStreamSource(stream);
    const an = actx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let elapsed = 0, lastTick = performance.now(), paused = false, cancelled = false, raf, peakAcc = 0, peakT = 0;
    const timeEl = h('span', { class: 'muted', style: 'margin-left:auto;font-variant-numeric:tabular-nums;font-weight:700' }, '0:00');
    const statusEl = h('span', {}, t('Merekam'));
    const dot = h('i', { class: 'recdot' });
    const waveEl = h('div', { class: 'rec-wave', 'aria-hidden': 'true' });
    const live = Array(48).fill(0.05);
    const drawWave = () => waveEl.replaceChildren(...live.map(v => h('i', { style: `height:${Math.max(4, Math.round(v * 50))}px` })));
    const loop = (now) => {
      const dt = now - lastTick; lastTick = now;
      if (!paused) {
        elapsed += dt;
        an.getByteTimeDomainData(buf);
        let m = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > m) m = v; }
        const lvl = Math.min(1, m * 1.8);
        peakAcc = Math.max(peakAcc, lvl); peakT += dt;
        if (peakT >= 100) { peaks.push(+peakAcc.toFixed(2)); live.push(peakAcc); live.shift(); peakAcc = 0; peakT = 0; drawWave(); }
        timeEl.textContent = fmtDur(elapsed / 1000);
        if (elapsed > 60 * 60 * 1000) stop();
      }
      raf = requestAnimationFrame(loop);
    };
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const cleanup = () => { cancelAnimationFrame(raf); stream.getTracks().forEach(tr => tr.stop()); actx.close().catch(() => {}); };
    rec.onstop = async () => {
      cleanup();
      if (cancelled || !chunks.length) return resolve(null);
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      const att = await store.putAttachment(blob);
      resolve({ att, dur: Math.round(elapsed / 1000), peaks: compact(peaks) });
    };
    const stop = () => { if (rec.state !== 'inactive') { rec.stop(); } s.close(); };
    const pauseBtn = h('button', { class: 'ib soft', type: 'button', 'aria-label': t('Jeda') }, icon('pause'));
    pauseBtn.addEventListener('click', () => {
      if (!paused) { rec.pause(); paused = true; statusEl.textContent = t('Dijeda'); dot.style.animation = 'none'; dot.style.opacity = '.4'; pauseBtn.replaceChildren(icon('play')); pauseBtn.setAttribute('aria-label', t('Lanjutkan')); }
      else { rec.resume(); paused = false; statusEl.textContent = t('Merekam'); dot.style.animation = ''; dot.style.opacity = ''; pauseBtn.replaceChildren(icon('pause')); pauseBtn.setAttribute('aria-label', t('Jeda')); }
    });
    drawWave();
    const s = sheet(null, h('div', { class: 'stack' },
      h('div', { class: 'row-flex', style: 'font-weight:700' }, dot, statusEl, timeEl),
      waveEl,
      h('div', { class: 'row-flex', style: 'justify-content:space-between' },
        h('button', { class: 'btn t sm', type: 'button', onClick: () => { cancelled = true; stop(); } }, t('Batal')),
        h('button', { class: 'rec-stop', type: 'button', 'aria-label': t('Selesai merekam'), onClick: stop }, h('span')),
        pauseBtn)), { dismissable: false, onClose: () => { if (rec.state !== 'inactive') { cancelled = cancelled || false; rec.stop(); } } });
    rec.start(1000);
    raf = requestAnimationFrame(loop);
  });
}

function compact(peaks) {
  if (peaks.length <= 200) return peaks;
  const out = []; const step = peaks.length / 200;
  for (let i = 0; i < 200; i++) { let m = 0; for (let j = Math.floor(i * step); j < Math.floor((i + 1) * step); j++) m = Math.max(m, peaks[j]); out.push(m); }
  return out;
}
