// Foto (kompres & mode dokumen) dan rekaman suara.
export async function compressImage(file, { max = 1600, quality = 0.82, doc = false } = {}) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await loadImg(file); }
  const w0 = bmp.width, h0 = bmp.height;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(bmp, 0, 0, w, h);
  if (doc) enhanceDocument(g, w, h);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  return { blob, w, h, original: file.size };
}

function loadImg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Mode dokumen/papan tulis: abu-abu, kontras tinggi, latar diputihkan
function enhanceDocument(g, w, h) {
  const d = g.getImageData(0, 0, w, h);
  const p = d.data;
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) sum += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  const mean = sum / (p.length / 4);
  const white = Math.min(255, mean * 1.08);
  for (let i = 0; i < p.length; i += 4) {
    let y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    y = (y / white) * 255;
    y = y > 235 ? 255 : Math.max(0, (y - 40) * 1.25);
    p[i] = p[i + 1] = p[i + 2] = Math.min(255, y);
  }
  g.putImageData(d, 0, 0);
}

export class Recorder {
  constructor() { this.chunks = []; this.levels = []; }
  static supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
  async start(onLevel) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const mime = types.find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.rec.start(250);
    this.t0 = Date.now();
    this.paused = 0;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.an = this.ctx.createAnalyser();
      this.an.fftSize = 512;
      src.connect(this.an);
      const buf = new Uint8Array(this.an.fftSize);
      const loop = () => {
        if (!this.an) return;
        this.an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
        const lv = Math.min(1, peak / 64);
        if (this.rec.state === 'recording') this.levels.push(lv);
        onLevel && onLevel(lv, this.levels);
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { /* tanpa visual gelombang */ }
  }
  pause() { if (this.rec.state === 'recording') { this.rec.pause(); this.pausedAt = Date.now(); } }
  resume() { if (this.rec.state === 'paused') { this.rec.resume(); this.paused += Date.now() - this.pausedAt; } }
  get state() { return this.rec ? this.rec.state : 'inactive'; }
  elapsed() { return ((this.rec && this.rec.state === 'paused' ? this.pausedAt : Date.now()) - this.t0 - this.paused) / 1000; }
  stop() {
    return new Promise((resolve) => {
      const done = () => {
        cancelAnimationFrame(this.raf);
        this.an = null;
        if (this.ctx) this.ctx.close();
        this.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' });
        resolve({ blob, duration: this.elapsed(), peaks: downsample(this.levels, 48) });
      };
      this.rec.onstop = done;
      if (this.rec.state !== 'inactive') this.rec.stop(); else done();
    });
  }
  cancel() {
    try { this.rec.stop(); } catch (e) { /* abaikan */ }
    cancelAnimationFrame(this.raf);
    this.an = null;
    if (this.ctx) this.ctx.close();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
  }
}

export function downsample(arr, n) {
  if (!arr.length) return new Array(n).fill(0.15);
  const out = [];
  const step = arr.length / n;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step));
    let m = 0;
    for (let j = a; j < b && j < arr.length; j++) m = Math.max(m, arr[j]);
    out.push(Math.max(0.12, Math.min(1, m)));
  }
  return out;
}
