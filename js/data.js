// Data tetap: warna, ikon, template bawaan, mood, aksen.
export const CARD_COLORS = [
  { id: 'k0', name: 'Polos', hex: '#FFFFFF', dark: '#252320' },
  { id: 'k1', name: 'Kuning', hex: '#FBEFC7', dark: '#40371F' },
  { id: 'k2', name: 'Hijau', hex: '#DDEEDB', dark: '#27372A' },
  { id: 'k3', name: 'Biru', hex: '#DCE8F5', dark: '#233246' },
  { id: 'k4', name: 'Merah muda', hex: '#F7DFE0', dark: '#432A2D' },
  { id: 'k5', name: 'Ungu', hex: '#E8E0F3', dark: '#332A44' },
  { id: 'k6', name: 'Jingga', hex: '#FBE3CF', dark: '#45311F' },
  { id: 'k7', name: 'Toska', hex: '#D5EDEA', dark: '#1F3935' },
  { id: 'k8', name: 'Abu', hex: '#EFEBE4', dark: '#2E2B27' }
];

// Warna buku: warna sampul (k) dan warna titik (dot)
export const BOOK_COLORS = [
  { id: 'k1', name: 'Kuning', dot: '#B8931C' },
  { id: 'k2', name: 'Hijau', dot: '#2F6F62' },
  { id: 'k3', name: 'Biru', dot: '#3E6DB5' },
  { id: 'k4', name: 'Merah muda', dot: '#C2566A' },
  { id: 'k5', name: 'Ungu', dot: '#6A55A6' },
  { id: 'k6', name: 'Jingga', dot: '#D07A3A' },
  { id: 'k7', name: 'Toska', dot: '#2F8A80' },
  { id: 'k8', name: 'Abu', dot: '#6B665E' }
];
export const dotOf = (k) => (BOOK_COLORS.find((c) => c.id === k) || BOOK_COLORS[7]).dot;

export const BOOK_ICONS = ['brief', 'cap', 'heart', 'pen', 'cup', 'map', 'spark', 'star', 'home', 'book'];

export const MOODS = [
  { n: 'Buruk', c: '#B3261E', mouth: 'M8 16.5c2.5-2.5 5.5-2.5 8 0' },
  { n: 'Lesu', c: '#C9692C', mouth: 'M8.5 15.5c2-1.2 5-1.2 7 0' },
  { n: 'Biasa', c: '#A8902F', mouth: 'M8.5 15h7' },
  { n: 'Senang', c: '#3F8A63', mouth: 'M8.5 14.5c2 1.8 5 1.8 7 0' },
  { n: 'Luar biasa', c: '#2F6F62', mouth: 'M8 14c2.5 3 5.5 3 8 0' }
];

export const ACCENTS = {
  terakota: { name: 'Terakota', light: '#C24E2E', dark: '#E8795A', softL: '#F6E1D8', softD: '#3D2A22' },
  biru: { name: 'Biru', light: '#3E6DB5', dark: '#86A8E3', softL: '#DDE7F6', softD: '#223047' },
  hijau: { name: 'Hijau', light: '#2F6F62', dark: '#74BCAA', softL: '#DCEDE8', softD: '#1E3531' },
  ungu: { name: 'Ungu', light: '#6A55A6', dark: '#AD9CE3', softL: '#E7E1F4', softD: '#2E2840' },
  arang: { name: 'Arang', light: '#2B2A28', dark: '#F0EBE3', softL: '#ECE8E1', softD: '#2E2B27' }
};

export const FONT_SIZES = [0.92, 1, 1.1, 1.22];

export const TYPE_ICON = { text: 'text', checklist: 'checksq', sketch: 'pen', voice: 'mic', photo: 'image', journal: 'smile' };
export const TYPE_NAME = { text: 'Teks', checklist: 'Checklist', sketch: 'Sketsa', voice: 'Suara', photo: 'Foto', journal: 'Jurnal' };

export const BUILTIN_TEMPLATES = [
  { id: 'tpl-jurnal', builtin: true, special: 'journal', name: 'Jurnal harian', desc: 'Mood, hal yang disyukuri, dan refleksi', color: 'k2', cat: 'Pribadi' },
  { id: 'tpl-belanja', builtin: true, name: 'Daftar belanja', desc: 'Checklist belanja per kebutuhan', color: 'k1', cat: 'Pribadi', type: 'checklist', title: 'Daftar belanja', html: '', items: ['Beras', 'Telur', 'Minyak goreng', 'Sayur', 'Buah', 'Sabun'] },
  { id: 'tpl-rapat', builtin: true, name: 'Catatan rapat', desc: 'Peserta, agenda, keputusan, tindak lanjut', color: 'k3', cat: 'Kerja', type: 'text', title: 'Rapat: ', html: '<h2>Peserta</h2><ul><li><br></li></ul><h2>Agenda</h2><ul><li><br></li></ul><h2>Keputusan</h2><ul><li><br></li></ul>', items: ['Tindak lanjut pertama'] },
  { id: 'tpl-kuliah', builtin: true, name: 'Catatan kuliah', desc: 'Metode Cornell: kata kunci dan ringkasan', color: 'k5', cat: 'Kuliah', type: 'text', title: 'Kuliah: ', html: '<h2>Kata kunci &amp; pertanyaan</h2><ul><li><br></li></ul><h2>Catatan</h2><p><br></p><h2>Ringkasan</h2><p><br></p>', items: [] },
  { id: 'tpl-resep', builtin: true, name: 'Resep', desc: 'Bahan, langkah, dan foto hasil', color: 'k6', cat: 'Pribadi', type: 'text', title: 'Resep: ', html: '<h2>Bahan</h2><ul><li><br></li></ul><h2>Langkah</h2><ol><li><br></li></ol>', items: [] },
  { id: 'tpl-jalan', builtin: true, name: 'Rencana perjalanan', desc: 'Jadwal per hari dan barang bawaan', color: 'k7', cat: 'Pribadi', type: 'text', title: 'Perjalanan ke ', html: '<h2>Hari 1</h2><ul><li><br></li></ul><h2>Hari 2</h2><ul><li><br></li></ul>', items: ['KTP', 'Charger', 'Obat-obatan', 'Baju ganti'] },
  { id: 'tpl-ujian', builtin: true, name: 'Rencana belajar ujian', desc: 'Materi, target, dan tenggat', color: 'k4', cat: 'Kuliah', type: 'checklist', title: 'Persiapan ujian', html: '<h2>Target</h2><p><br></p>', items: ['Materi 1', 'Materi 2', 'Latihan soal'] },
  { id: 'tpl-mingguan', builtin: true, name: 'To-do mingguan', desc: 'Tugas utama untuk minggu ini', color: 'k8', cat: 'Kerja', type: 'checklist', title: 'Minggu ini', html: '', items: ['Tugas utama', 'Balas email penting', 'Rapat mingguan'] }
];

export const LANGS = [
  { code: 'id', native: 'Bahasa Indonesia', name: 'Indonesia' },
  { code: 'en', native: 'English', name: 'Inggris' }
];
