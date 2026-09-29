// Lembar · template bawaan
import { uid } from '../store.js';
import { t } from '../i18n.js';

const P = (label, html = '') => ({ id: uid(), t: 'prompt', label, html });
const C = (label, items = ['']) => ({ id: uid(), t: 'check', label, items: items.map(text => ({ id: uid(), text, done: false })) });
const T = (html = '') => ({ id: uid(), t: 'text', html });

export function builtinTemplates() {
  return [
    { id: 'journal', cat: 'Pribadi', name: t('Jurnal harian'), desc: t('Mood, syukur hari ini, dan refleksi'), color: 'k2', type: 'journal',
      blocks: () => [P(t('Bagaimana harimu?')), P(t('3 hal yang kusyukuri'), '<ol><li></li><li></li><li></li></ol>'), P(t('Satu hal untuk besok'))] },
    { id: 'shopping', cat: 'Pribadi', name: t('Daftar belanja'), desc: t('Checklist per tempat belanja'), color: 'k1', type: 'checklist',
      blocks: () => [C(t('Pasar / sayur')), C(t('Minimarket'))] },
    { id: 'meeting', cat: 'Kerja', name: t('Catatan rapat'), desc: t('Peserta, agenda, keputusan, tindak lanjut'), color: 'k3', type: 'text',
      blocks: () => [P(t('Peserta')), P(t('Agenda'), '<ol><li></li></ol>'), P(t('Keputusan'), '<ul><li></li></ul>'), C(t('Tindak lanjut'))] },
    { id: 'cornell', cat: 'Kuliah', name: t('Catatan kuliah'), desc: t('Metode Cornell: kata kunci + ringkasan'), color: 'k5', type: 'text',
      blocks: () => [P(t('Mata kuliah & tanggal')), P(t('Kata kunci / pertanyaan'), '<ul><li></li></ul>'), P(t('Catatan')), P(t('Ringkasan'))] },
    { id: 'exam', cat: 'Kuliah', name: t('Rencana belajar ujian'), desc: t('Materi, target, dan tenggat'), color: 'k4', type: 'checklist',
      blocks: () => [P(t('Mata kuliah & tanggal ujian')), C(t('Materi yang dipelajari')), C(t('Latihan soal')), P(t('Target'))] },
    { id: 'recipe', cat: 'Pribadi', name: t('Resep'), desc: t('Bahan, langkah, dan foto hasil'), color: 'k6', type: 'text',
      blocks: () => [P(t('Porsi & waktu memasak')), C(t('Bahan')), P(t('Langkah'), '<ol><li></li></ol>')] },
    { id: 'trip', cat: 'Pribadi', name: t('Rencana perjalanan'), desc: t('Jadwal per hari dan barang bawaan'), color: 'k7', type: 'text',
      blocks: () => [P(t('Tujuan & tanggal')), P(t('Jadwal'), '<h3>' + t('Hari 1') + '</h3><ul><li></li></ul>'), C(t('Barang bawaan'), [t('KTP / kartu identitas'), t('Charger & power bank'), t('Obat pribadi')])] },
    { id: 'todo', cat: 'Kerja', name: t('Tugas harian'), desc: t('Prioritas, tugas, dan catatan'), color: 'k8', type: 'checklist',
      blocks: () => [C(t('Prioritas utama')), C(t('Tugas lain')), P(t('Catatan'))] },
  ];
}

// salin blok template dengan id baru (dipakai untuk template buatan pengguna)
export function cloneBlocks(blocks) {
  return JSON.parse(JSON.stringify(blocks)).map(b => {
    b.id = uid();
    if (b.items) b.items = b.items.map(i => ({ ...i, id: uid(), done: false }));
    return b;
  }).filter(b => !b.att);
}
export { P as promptBlock, C as checkBlock, T as textBlock };
