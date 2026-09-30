// Lembar · Bantuan & FAQ
import { h, clear, debounce } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { header } from '../components.js';

const FAQ = () => [
  [t('Mulai'), [
    [t('Apa itu Lembar?'), t('Lembar adalah aplikasi catatan yang bekerja sepenuhnya di HP. Kamu bisa menulis teks, membuat checklist, menggambar sketsa, merekam suara, menyimpan foto, dan menulis jurnal harian.')],
    [t('Apakah Lembar butuh internet?'), t('Tidak. Setelah dibuka pertama kali, semua fitur berjalan tanpa internet. Internet hanya dipakai kalau kamu sendiri membagikan catatan ke aplikasi lain.')],
    [t('Apakah saya perlu membuat akun?'), t('Tidak perlu. Lembar tidak memakai akun, login, atau email. Buka aplikasinya dan langsung menulis.')],
    [t('Bagaimana memasang Lembar di layar utama?'), t('Buka Lembar di Chrome, lalu ketuk menu ⋮ dan pilih “Instal aplikasi” atau “Tambahkan ke layar utama”. Jika tersedia, tombol “Pasang Lembar di layar utama” juga muncul di Pengaturan.')],
    [t('Apakah Lembar bisa dipakai di tablet?'), t('Bisa. Di layar lebar, Lembar otomatis memakai tampilan 3 kolom: menu di kiri, daftar catatan di tengah, dan isi catatan di kanan.')],
  ]],
  [t('Catatan'), [
    [t('Bagaimana cara membuat catatan baru?'), t('Ketuk tombol + di bagian bawah, lalu pilih jenisnya: Teks, Checklist, Sketsa, Rekam suara, Foto, Jurnal hari ini, atau Dari template.')],
    [t('Bisakah mencampur teks, checklist, dan foto dalam satu catatan?'), t('Bisa. Di editor, gunakan toolbar bawah untuk menyisipkan checklist, foto, rekaman suara, atau sketsa di posisi kursor.')],
    [t('Apakah catatan tersimpan otomatis?'), t('Ya. Setiap perubahan langsung tersimpan, ditandai tulisan “Tersimpan” di bagian atas. Catatan yang benar-benar kosong otomatis dibuang saat kamu keluar.')],
    [t('Bagaimana membuat judul, subjudul, dan daftar bernomor?'), t('Di toolbar editor, ketuk H lalu pilih Judul, Subjudul, atau Teks biasa. Ketuk ikon daftar lalu pilih Poin, Angka (1, 2, 3), atau Huruf (a, b, c). Saat kursor ada di daftar, pilih “Jadikan sub-poin” untuk membuat poin bertingkat. Cara cepat: ketik # atau ## di awal baris untuk judul dan subjudul, atau - , 1. , a. untuk daftar, lalu tekan spasi. Tekan Enter dua kali untuk keluar dari daftar.')],
    [t('Bagaimana mencatat dengan cepat?'), t('Di Beranda, tarik layar ke bawah sampai muncul kolom Catat kilat. Ketik, lalu tekan Simpan atau Enter.')],
    [t('Bagaimana menautkan satu catatan ke catatan lain?'), t('Ketik [[ di editor, lalu pilih judul catatan yang muncul. Catatan tujuan akan menampilkan “Disebut di” supaya kamu bisa kembali ke catatan asal.')],
    [t('Bagaimana memakai atau membuat template?'), t('Ketuk + lalu Dari template untuk memakai template bawaan seperti Jurnal harian, Daftar belanja, atau Catatan rapat. Untuk membuat template sendiri, buka catatan, ketuk menu ⋯, lalu Simpan sebagai template.')],
    [t('Apakah foto memenuhi memori HP?'), t('Foto dikompres otomatis saat ditambahkan, biasanya dari beberapa MB menjadi ratusan KB, tanpa mengurangi keterbacaan.')],
    [t('Apa fungsi Pindai dokumen?'), t('Pindai dokumen memotret kertas atau papan tulis lalu otomatis membuatnya hitam-putih dengan kontras tinggi supaya tulisan lebih jelas dibaca.')],
    [t('Bagaimana membagikan catatan?'), t('Buka catatan, ketuk ikon bagikan, lalu pilih formatnya: Teks, Gambar kartu, atau PDF. Setelah itu kirim lewat aplikasi apa pun.')],
  ]],
  [t('Organisasi'), [
    [t('Apa bedanya Buku dan Tag?'), t('Buku seperti map: satu catatan ada di satu buku, misalnya Kerja atau Kuliah. Tag adalah label bebas: satu catatan bisa punya banyak tag, misalnya #skripsi dan #ide.')],
    [t('Bagaimana memindahkan catatan ke buku lain?'), t('Ketuk nama buku di bagian atas editor. Untuk beberapa catatan sekaligus, tekan lama salah satu catatan, pilih yang lain, lalu ketuk Pindah.')],
    [t('Bagaimana menambah tag?'), t('Ketik # diikuti nama tag di dalam catatan, misalnya #resep, atau ketuk “+ tag” di bawah judul. Tag baru langsung muncul di halaman Tag dan bisa dipakai sebagai filter.')],
    [t('Bagaimana mengganti nama atau menggabungkan tag?'), t('Buka tab Buku, ketuk ikon #, lalu Kelola. Perubahan berlaku di semua catatan yang memakai tag itu.')],
    [t('Bagaimana menyematkan catatan penting?'), t('Buka catatan, ketuk menu ⋯, lalu Sematkan. Catatan tersemat selalu tampil paling atas di Beranda.')],
    [t('Apa fungsi mengusap kartu catatan?'), t('Di tampilan daftar, usap ke kanan untuk mengarsipkan dan usap ke kiri untuk menghapus. Kalau salah, ketuk Urungkan yang muncul beberapa detik di bawah layar.')],
    [t('Bagaimana memilih banyak catatan sekaligus?'), t('Tekan lama satu catatan, lalu ketuk catatan lain. Setelah itu kamu bisa memindahkan, memberi warna, memberi tag, menyematkan, mengarsipkan, atau menghapus sekaligus.')],
    [t('Apa bedanya Arsip dan Sampah?'), t('Arsip menyembunyikan catatan dari Beranda tapi tetap aman dan bisa dicari. Sampah menampung catatan yang dihapus, lalu menghapusnya permanen setelah 30 hari.')],
    [t('Bagaimana mencari catatan?'), t('Buka tab Cari. Pencarian mencakup judul, isi, tag, dan item checklist. Ketuk ikon filter untuk menyaring berdasarkan buku, warna, waktu, atau isi catatan.')],
  ]],
  [t('Jurnal'), [
    [t('Bagaimana menulis jurnal harian?'), t('Ketuk + lalu Jurnal hari ini, atau buka tab Kalender dan ketuk “Tulis jurnal hari ini”. Pilih mood, lalu jawab pertanyaan pemandu atau tulis bebas.')],
    [t('Apa arti titik berwarna di Kalender?'), t('Titik menunjukkan mood yang kamu pilih di jurnal hari itu, dari merah (Buruk) sampai hijau tua (Luar biasa). Lingkaran kosong berarti ada catatan lain di tanggal itu.')],
    [t('Bagaimana streak menulis dihitung?'), t('Streak bertambah setiap hari kamu membuat atau mengubah minimal satu catatan. Kalau terlewat satu hari, streak mulai lagi dari awal. Lihat detailnya di Statistik menulis.')],
  ]],
  [t('Pengingat'), [
    [t('Bagaimana memasang pengingat?'), t('Buka catatan, ketuk menu ⋯, lalu Pengingat. Pilih waktu cepat atau tanggal sendiri, dan atur pengulangan harian, mingguan, atau bulanan.')],
    [t('Apakah pengingat bekerja tanpa internet?'), t('Ya. Pengingat dijadwalkan di HP. Selama Lembar terbuka atau berjalan di latar, pengingat berbunyi tepat waktu. Kalau aplikasi ditutup penuh, pengingat yang terlewat langsung muncul saat Lembar dibuka lagi.')],
    [t('Bagaimana menunda pengingat?'), t('Saat pengingat muncul, pilih Tunda 10 menit, 1 jam, atau Besok. Bisa juga langsung ketuk Tandai selesai.')],
    [t('Pengingat saya tidak muncul, kenapa?'), t('Pastikan izin notifikasi untuk Lembar aktif di pengaturan HP dan penghemat baterai tidak membatasi Lembar. Cek juga apakah pengingatnya masih aktif di halaman Pengingat.')],
  ]],
  [t('Keamanan'), [
    [t('Bagaimana mengunci buku atau catatan?'), t('Untuk buku, buka bukunya lalu ketuk ⋯ dan pilih Kunci buku ini. Untuk satu catatan, buka menu ⋯ lalu ketuk Kunci. Isi catatan terkunci disamarkan di daftar.')],
    [t('Bisakah membuka kunci dengan sidik jari?'), t('Bisa, kalau HP-mu punya sensor sidik jari. Aktifkan di Pengaturan, bagian PIN & kunci, lalu Buka dengan sidik jari.')],
    [t('Saya lupa PIN, bagaimana?'), t('Di layar kunci, ketuk “Lupa PIN? Gunakan pertanyaan pemulihan” dan jawab pertanyaan yang kamu buat saat mengatur PIN. Setelah itu kamu bisa membuat PIN baru.')],
    [t('Bagaimana kalau saya juga lupa jawaban pemulihan?'), t('Demi privasi, catatan terkunci tidak bisa dibuka lewat Lembar tanpa PIN atau jawaban pemulihan. Catatan lain yang tidak terkunci tetap bisa diakses.')],
    [t('Apakah orang lain bisa membaca catatan saya?'), t('Catatanmu hanya tersimpan di HP ini dan tidak pernah dikirim ke server mana pun. Catatan hanya keluar dari HP kalau kamu sendiri membagikannya atau membuat backup. Aktifkan juga kunci layar HP untuk perlindungan tambahan.')],
  ]],
  [t('Data & backup'), [
    [t('Di mana catatan saya disimpan?'), t('Di penyimpanan internal HP-mu. Karena itu Lembar bisa dipakai tanpa internet, tapi pastikan kamu rutin membuat backup.')],
    [t('Bagaimana membuat backup?'), t('Buka Pengaturan, lalu Backup & pulihkan, dan ketuk Buat backup sekarang. File .lembar tersimpan di folder Download. Kamu juga bisa mengaktifkan pengingat backup mingguan.')],
    [t('Bagaimana memindahkan catatan ke HP baru?'), t('Buat backup di HP lama, kirim file .lembar ke HP baru (lewat WhatsApp, Drive, atau kabel), lalu di HP baru buka Backup & pulihkan dan pilih file tersebut.')],
    [t('Apa bedanya Gabungkan dan Ganti semua saat memulihkan?'), t('Gabungkan menambahkan isi backup tanpa menghapus catatan yang sudah ada; kalau ada yang sama, versi terbaru yang dipakai. Ganti semua menghapus catatan di HP lalu menggantinya dengan isi backup.')],
    [t('Apa yang terjadi kalau aplikasi dihapus?'), t('Semua catatan ikut terhapus dari HP. Buat backup terlebih dahulu supaya catatanmu bisa dipulihkan setelah aplikasi dipasang lagi.')],
    [t('Saya tidak sengaja menghapus catatan, bisa kembali?'), t('Bisa. Ketuk Urungkan tepat setelah menghapus, atau buka Sampah, pilih catatannya, lalu ketuk Pulihkan. Catatan di Sampah bisa dipulihkan selama 30 hari.')],
    [t('Bisakah catatan diekspor ke PDF atau Markdown?'), t('Bisa, lewat Pengaturan, Backup & pulihkan, lalu Ekspor. Pilih formatnya dan buku yang ingin diekspor. Catatan terkunci tidak ikut diekspor.')],
  ]],
  [t('Tampilan'), [
    [t('Bagaimana mengganti tema terang atau gelap?'), t('Buka Pengaturan, bagian Tampilan, lalu pilih Terang, Kertas, Gelap, atau Ikuti HP. Kamu juga bisa mengganti warna aksen.')],
    [t('Bagaimana mengganti bahasa aplikasi?'), t('Buka Pengaturan, lalu Bahasa. Pilih Bahasa Indonesia atau English, atau aktifkan Ikuti bahasa HP. Isi catatanmu tidak ikut diterjemahkan.')],
    [t('Bagaimana memperbesar ukuran huruf?'), t('Buka Pengaturan, bagian Tampilan, lalu ketuk tombol A besar di Ukuran huruf. Pratinjaunya langsung terlihat.')],
    [t('Bagaimana mengganti tampilan grid atau daftar?'), t('Di Beranda, ketuk ikon grid atau ikon daftar di samping label Tersemat & terbaru.')],
  ]],
];

export function render(view, args, ctx) {
  let cat = null, q = '';
  const open = new Set(['0-0']);
  view.appendChild(header(t('Bantuan & FAQ'), { backTo: 'settings' }, ctx));
  const input = h('input', { type: 'search', placeholder: t('Cari pertanyaan, misal “backup”'), 'aria-label': t('Cari pertanyaan') });
  const chips = h('div', { class: 'chips' });
  const count = h('span', { class: 'lbl' });
  const list = h('div', { class: 'stack' });
  view.appendChild(h('div', { class: 'scroll' }, h('div', { class: 'wrap stack pad-b' },
    h('label', { class: 'search' }, icon('search'), input), chips, count, list,
    h('div', { style: 'border-radius:18px;background:var(--accent-soft);padding:16px;display:flex;flex-direction:column;gap:10px' },
      h('b', {}, t('Masih bingung?')), h('span', { class: 'small', style: 'color:var(--ink2)' }, t('Lihat lagi panduan singkat untuk mengenal fitur-fitur utama Lembar.')),
      h('a', { class: 'btn p sm', href: '#/onboarding?again=1', style: 'align-self:flex-start' }, t('Lihat panduan awal'))))));
  input.addEventListener('input', debounce(() => { q = input.value.trim().toLowerCase(); draw(); }, 120));
  const draw = () => {
    const data = FAQ();
    chips.replaceChildren(h('button', { class: 'chip' + (cat === null ? ' on' : ''), type: 'button', onClick: () => { cat = null; draw(); } }, t('Semua')),
      ...data.map(([name], i) => h('button', { class: 'chip' + (cat === i ? ' on' : ''), type: 'button', onClick: () => { cat = i; draw(); } }, name)));
    clear(list); let total = 0;
    data.forEach(([name, items], gi) => {
      if (cat !== null && cat !== gi) return;
      const shown = items.map((it, ii) => [it, ii]).filter(([[qq, a]]) => !q || (qq + ' ' + a).toLowerCase().includes(q));
      if (!shown.length) return;
      total += shown.length;
      list.appendChild(h('span', { class: 'lbl', style: 'color:var(--accent-ink)' }, name));
      shown.forEach(([[qq, a], ii]) => {
        const id = gi + '-' + ii; const isOpen = open.has(id) || q.length > 1;
        list.appendChild(h('div', { class: 'fq-item' + (isOpen ? ' open' : '') },
          h('button', { class: 'fq-q', type: 'button', 'aria-expanded': isOpen ? 'true' : 'false', onClick: () => { open.has(id) ? open.delete(id) : open.add(id); draw(); } }, h('span', {}, qq), icon('down', 's')),
          isOpen ? h('p', { class: 'fq-a' }, a) : null));
      });
    });
    count.textContent = t('{n} pertanyaan', { n: total });
    if (!total) list.appendChild(h('div', { class: 'empty' }, h('b', {}, t('Belum ada jawaban untuk “{q}”', { q })), h('span', { class: 'small muted' }, t('Coba kata lain, misalnya “PIN”, “pindah HP”, atau “tema”.'))));
  };
  draw();
}
