// Lembar · kompres foto & mode pindai dokumen
export async function compressImage(file, { max = 1600, quality = 0.82, scan = false } = {}) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { bmp = await loadViaImg(file); }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), hgt = Math.round(bmp.height * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, hgt);
  if (bmp.close) bmp.close();
  if (scan) enhanceDocument(ctx, w, hgt);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', quality));
  return { blob, w, h: hgt, original: file.size };
}

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak bisa dibaca')); };
    img.src = url;
  });
}

// abu-abu + peregangan kontras otomatis agar tulisan lebih tegas
function enhanceDocument(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data; const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const y = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = y; hist[y]++;
  }
  const total = w * h; let acc = 0; let lo = 0; let hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.08) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    let v = ((d[i] - lo) * 255) / range;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    v = v > 200 ? 255 : v * 0.92;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}
