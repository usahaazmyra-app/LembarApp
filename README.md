# Lembar: Catatan Offline

Lembar adalah aplikasi catatan offline berbentuk PWA (Progressive Web App). Semua data tersimpan di perangkat pengguna (IndexedDB). Tidak ada akun, tidak ada server, tidak ada pelacakan.

Fitur: catatan teks, checklist, sketsa, rekaman suara, foto dan pindai dokumen, jurnal harian dengan mood, buku (folder), tag, tautan antar catatan `[[...]]`, pencarian dengan filter, kalender, pengingat, template, arsip, sampah (30 hari), kunci PIN dan sidik jari, backup dan pulihkan, ekspor PDF/Markdown/Teks, bagikan sebagai teks/gambar/PDF, statistik dan streak, tema terang/kertas/gelap, 5 warna aksen, ukuran huruf, bahasa Indonesia dan Inggris, tata letak tablet 3 kolom, serta Bantuan (FAQ).

## Struktur proyek

```
index.html              Halaman utama
manifest.webmanifest    Manifest PWA (ikon, shortcut, share target, screenshot)
sw.js                   Service worker (HASIL GENERATE, jangan diedit manual)
sw.template.js          Sumber service worker
tools-build-sw.py       Skrip pembuat sw.js
vercel.json             Header untuk Vercel
.well-known/            assetlinks.json untuk APK (TWA)
css/app.css             Semua gaya
js/                     Kode aplikasi (ES modules, tanpa build step)
  app.js                Router, layout, menu buat
  store.js, db.js       Data dan IndexedDB
  i18n.js, lang/en.js   Bahasa
  views/                Setiap halaman
  lib/                  Template, rekam suara, gambar, bagikan, pengingat, zip
icons/, screenshots/    Aset ikon dan screenshot toko
```

Tidak perlu `npm install` atau build. Ini situs statis murni.

## Menjalankan di komputer

```bash
cd lembar-app
python3 -m http.server 8080
```

Buka `http://localhost:8080`. Service worker hanya aktif di `localhost` atau `https`.

## Penting: setiap kali mengubah file

Jalankan ini sebelum commit, supaya pengguna mendapat versi baru:

```bash
python3 tools-build-sw.py
```

Skrip ini menghitung ulang daftar file dan nomor versi di `sw.js`. Pengguna akan melihat pesan "Versi baru tersedia" dan bisa memuat ulang. Untuk versi yang terlihat di Pengaturan, ubah `APP_VERSION` di `js/views/settings.js`.

## Deploy: GitHub lalu Vercel

1. Buat repositori baru di GitHub, misalnya `lembar-app`, lalu unggah semua isi folder ini (atau `git push`).
2. Masuk ke vercel.com dengan akun GitHub, pilih **Add New > Project**, lalu impor repositori `lembar-app`.
3. Framework Preset: **Other**. Build Command: kosongkan. Output Directory: kosongkan (root). Klik **Deploy**.
4. Setelah selesai, kamu dapat alamat seperti `https://lembar-app.vercel.app`. Setiap `git push` ke branch utama akan otomatis dideploy ulang.
5. (Opsional) Tambahkan domain sendiri di **Settings > Domains**.

## Memasang sebagai aplikasi (PWA)

- **Android (Chrome):** buka alamat Vercel, ketuk menu titik tiga, pilih **Instal aplikasi**. Bisa juga dari tombol "Pasang Lembar" di Pengaturan.
- **iPhone (Safari):** ketuk tombol Bagikan, pilih **Tambahkan ke Layar Utama**.
- **Laptop (Chrome/Edge):** klik ikon instal di bilah alamat.

## Membuat APK dengan PWABuilder

1. Buka pwabuilder.com, masukkan alamat Vercel kamu, lalu klik **Start**. Skor manifest dan service worker seharusnya sudah hijau.
2. Pilih **Package For Stores > Android**. Isi Package ID, misalnya `com.azmy.lembar`. Klik **Generate**.
3. Unduh ZIP hasilnya. Di dalamnya ada file `.aab` (untuk Play Store), `.apk` (untuk dicoba langsung), **signing key**, dan `assetlinks.json`.
4. **Simpan signing key dan kata sandinya di tempat aman.** Tanpa key yang sama, kamu tidak bisa merilis pembaruan aplikasi di Play Store.
5. Salin isi `assetlinks.json` dari PWABuilder ke file `.well-known/assetlinks.json` di proyek ini (ganti `[]`), jalankan `python3 tools-build-sw.py`, lalu push. Ini membuat APK tampil penuh tanpa bilah alamat browser.
6. Cek di `https://ALAMATMU/.well-known/assetlinks.json` bahwa isinya sudah terbaru.
7. Pasang `.apk` di HP untuk mencoba, atau unggah `.aab` ke Google Play Console (akun developer, biaya sekali bayar).

Isi aplikasi di APK tetap diambil dari situs Vercel, jadi pembaruan cukup lewat `git push` tanpa membuat APK baru (kecuali mengubah ikon, nama, atau package).

## Batasan yang perlu diketahui

- **Pengingat** hanya berbunyi saat aplikasi terbuka atau masih berjalan di latar belakang. Jika aplikasi ditutup penuh, pengingat baru muncul saat aplikasi dibuka kembali (ditandai "Terlewat"). Untuk pengingat yang pasti berbunyi, tahap berikutnya adalah membungkus dengan Capacitor dan memakai Local Notifications.
- **Kunci PIN** menutup akses tampilan, tetapi data di IndexedDB tidak dienkripsi. Siapa pun yang punya akses teknis ke perangkat yang tidak terkunci tetap bisa membacanya.
- **Sidik jari** memakai WebAuthn. Tersedia di sebagian besar Android dan iPhone modern, dan bisa tidak tersedia di beberapa browser atau di dalam APK tertentu.
- **Data** hanya ada di satu perangkat. Menghapus data browser atau mencopot aplikasi akan menghapus catatan. Ingatkan pengguna untuk rutin backup (aplikasi menampilkan pengingat backup).
- **Font** diambil dari Google Fonts saat pertama kali online, lalu disimpan untuk offline. Saat benar-benar pertama dibuka tanpa internet, aplikasi memakai font sistem.
- **Bahasa** yang tersedia: Indonesia dan Inggris. Untuk menambah bahasa, buat `js/lang/xx.js` dengan format yang sama seperti `en.js` dan daftarkan di `LANGS` pada `js/i18n.js`.

## Privasi

Lembar tidak mengirim data ke mana pun. Satu-satunya permintaan jaringan adalah file aplikasi itu sendiri dan Google Fonts.
