# Cara membuat aplikasi lewat GitHub (tanpa perlu membangun di komputermu)

GitHub akan membangun installer Windows untukmu secara otomatis. Kamu hanya perlu mengunggah kode ini dan menekan satu tombol.

## Yang kamu butuhkan
1. **Akun GitHub** (gratis) di github.com.
2. **Isi folder ini** (semua berkas dan folder di dalam zip, termasuk folder `.github`).
3. Tidak ada kunci rahasia, tidak ada biaya. Repositori boleh **Private** kalau kamu hanya ingin membuat installer. Kalau ingin **auto-update** jalan, repositori harus **Public** (lihat bagian "Auto-update" di bawah).

## Langkah singkat (lewat browser)
1. Masuk ke GitHub, klik **+** di kanan atas, pilih **New repository**. Beri nama (contoh: `chatstream-labs`), pilih **Private**, lalu **Create repository**.
2. Di halaman repositori yang kosong, klik **uploading an existing file**.
3. Ekstrak zip ini di komputermu, lalu **seret semua isi folder** (bukan folder induknya) ke halaman GitHub itu, termasuk folder `.github`.
   Kalau folder `.github` tidak ikut terunggah (kadang folder yang namanya diawali titik tersembunyi di Windows), nyalakan
   *File Explorer > View > Show > Hidden items*, atau pakai cara GitHub Desktop di bawah.
4. Di bawah, klik **Commit changes**.
5. Buka tab **Actions**. Kalau ada tombol hijau untuk mengizinkan workflow, klik. Pilih **Build installer Windows** di sisi kiri,
   lalu klik **Run workflow** > **Run workflow**.
6. Tunggu sekitar 5 sampai 10 menit sampai ada tanda centang hijau. Installer-nya berupa **satu file `.exe`** bernama
   `chatstreamlab-v<versi>.exe` (versi mengikuti `package.json`), tanpa zip. Mulai v15.1.1, hasilnya **tidak otomatis masuk Releases**,
   jadi bisa kamu uji dulu: klik proses yang selesai, turun ke **Artifacts**, klik `chatstreamlab-v<versi>.exe` (langsung terunduh sebagai `.exe`).
   Kalau sudah yakin bagus, baru dirilis (lihat bagian "Menguji dulu, baru rilis" di bawah).

## Satu versi untuk semuanya
Versi aplikasi cuma ada satu angka, misalnya `15.1.1`, dan harus sama di semua tempat:
- Nama zip: `chatstream-labs v15.1.1.zip`
- `package.json`, `package-lock.json`, dan `extension/manifest.json`
- Tulisan versi di sidebar aplikasi (ikut otomatis dari `package.json` saat build)
- Nama installer `chatstreamlab-v15.1.1.exe`, serta tag dan nama rilis `v15.1.1` di GitHub (ikut otomatis)
- Pesan commit saat unggah ke GitHub: tulis `v15.1.1`

Mengganti versi: `node scripts/version.js set 15.1.2` (menyamakan tiga berkas di atas sekaligus). Kalau ada yang beda, `npm run build` dan workflow GitHub berhenti
dengan pesan yang menunjuk berkas mana yang beda, jadi versi tidak mungkin berbeda-beda tanpa ketahuan.

## Menguji dulu, baru rilis
- **Push biasa** (unggah/commit ke `main`) hanya membangun installer dan menaruhnya di **Actions > Artifacts**. Tidak ada Release, dan pengguna lama tidak menerima update.
- Setelah installer diuji dan bagus, rilis dengan salah satu cara:
  1. **Actions > Build installer Windows > Run workflow**, centang **Rilis ke Releases**, lalu **Run workflow**; atau
  2. buat tag sesuai versi: `git tag v15.1.1` lalu `git push origin v15.1.1` (workflow berhenti kalau nama tag beda dengan versi aplikasi).
- Kalau hasil uji jelek, perbaiki lalu unggah lagi dengan versi berikutnya; tidak ada yang perlu ditarik dari Releases karena belum pernah dirilis.

## Cara alternatif: GitHub Desktop (lebih mudah untuk folder tersembunyi)
1. Pasang **GitHub Desktop**, masuk dengan akunmu.
2. *File > Add local repository*, pilih folder hasil ekstrak (kalau diminta, klik **create a repository**).
3. **Commit to main**, lalu **Publish repository** (centang **Keep this code private**).
4. Lanjut ke langkah 5 di atas.

## Halaman Releases
Halaman Releases dibuat oleh workflow **hanya saat kamu memintanya** (lihat "Menguji dulu, baru rilis"), dengan nama `v<versi>` (misalnya `v15.1.1`).
Untuk rilis baru, ganti versi lewat `node scripts/version.js set <versi>` sebelum commit; nama file dan nama rilis ikut berubah sendiri.
Kalau versinya tidak dinaikkan, rilis dengan versi yang sama hanya diperbarui `.exe`-nya.
Mau membuat rilis dengan tag sendiri juga bisa: `git tag v15.1.1` lalu `git push origin v15.1.1`.

## Setelah installer jadi
- Windows SmartScreen akan memberi peringatan karena aplikasi belum bertanda tangan digital. Klik **More info > Run anyway**.
- Kalau sebelumnya kamu sudah memasang versi lama ("ChatLivestream Labs" atau "Chatstream Labs"), pengaturan dan gaya buatanmu otomatis ikut terbawa saat pertama kali membuka ChatStream Labs. Aplikasi lama bisa di-uninstall.
- Ekstensi Chrome (untuk kirim chat) ada di folder `extension` di dalam folder instalasi, atau di zip ini.

## Kalau proses gagal
Klik proses yang berwarna merah, buka langkah yang gagal, salin tulisan error-nya, lalu berikan ke AI-mu bersama berkas `AGENTS.md`.

## Mengganti nama aplikasi
Satu perintah mengganti nama di seluruh proyek (butuh Node.js): `node scripts/rename.js "Nama Baru"`, lalu unggah ulang.

## Auto-update
Mulai v15.1.0 aplikasi mengecek Releases di splash, mengunduh versi baru, lalu memasangnya sendiri.
- Repositori harus **Public**. Aplikasi membaca Releases tanpa login, jadi kalau Private, hasilnya "tidak ada update" selamanya.
- Tiap rilis baru: **naikkan versi** (`node scripts/version.js set <versi>`), uji installer dari Artifacts, lalu rilis lewat Run workflow atau tag. Workflow melampirkan `.exe`, `.blockmap`, dan `latest.yml` ke Releases. Pengguna baru mendapat update setelah Release dibuat, bukan saat push.
- Versi pertama yang punya fitur ini dipasang manual sekali. Setelah itu semua versi berikutnya terpasang sendiri saat aplikasi dibuka.
- Kalau tidak ada update atau cek gagal (offline), aplikasi lanjut seperti biasa; alasannya tercatat di `log.txt` (baris berawalan `update:`).
