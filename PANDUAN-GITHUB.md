# Cara membuat aplikasi lewat GitHub (tanpa perlu membangun di komputermu)

GitHub akan membangun installer Windows untukmu secara otomatis. Kamu hanya perlu mengunggah kode ini dan menekan satu tombol.

## Yang kamu butuhkan
1. **Akun GitHub** (gratis) di github.com.
2. **Isi folder ini** (semua berkas dan folder di dalam zip, termasuk folder `.github`).
3. Tidak ada kunci rahasia, tidak ada biaya. Repositori boleh **Private**.

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
   `chatstreamlab-v<versi>.exe` (versi mengikuti `package.json`), tanpa zip. Ada dua tempat mengambilnya:
   - **Releases** (paling mudah): di halaman utama repositori, lihat kolom kanan **Releases**, buka yang paling atas, lalu klik berkas `.exe`.
   - **Actions**: klik proses yang selesai, turun ke **Artifacts**, klik `chatstreamlab-v<versi>.exe` (langsung terunduh sebagai `.exe`).

## Cara alternatif: GitHub Desktop (lebih mudah untuk folder tersembunyi)
1. Pasang **GitHub Desktop**, masuk dengan akunmu.
2. *File > Add local repository*, pilih folder hasil ekstrak (kalau diminta, klik **create a repository**).
3. **Commit to main**, lalu **Publish repository** (centang **Keep this code private**).
4. Lanjut ke langkah 5 di atas.

## Halaman Releases
Halaman Releases dibuat otomatis oleh workflow setiap proses selesai, dengan nama `v<versi>` (misalnya `v14.2.1`).
Untuk rilis baru, naikkan angka `"version"` di `package.json` sebelum commit; nama file dan nama rilis ikut berubah sendiri.
Kalau versinya tidak dinaikkan, rilis dengan versi yang sama hanya diperbarui `.exe`-nya.
Mau membuat rilis dengan tag sendiri juga bisa: `git tag v14.2.1` lalu `git push origin v14.2.1`.

## Setelah installer jadi
- Windows SmartScreen akan memberi peringatan karena aplikasi belum bertanda tangan digital. Klik **More info > Run anyway**.
- Kalau sebelumnya kamu sudah memasang versi lama ("ChatLivestream Labs" atau "Chatstream Labs"), pengaturan dan gaya buatanmu otomatis ikut terbawa saat pertama kali membuka ChatStream Labs. Aplikasi lama bisa di-uninstall.
- Ekstensi Chrome (untuk kirim chat) ada di folder `extension` di dalam folder instalasi, atau di zip ini.

## Kalau proses gagal
Klik proses yang berwarna merah, buka langkah yang gagal, salin tulisan error-nya, lalu berikan ke AI-mu bersama berkas `AGENTS.md`.

## Mengganti nama aplikasi
Satu perintah mengganti nama di seluruh proyek (butuh Node.js): `node scripts/rename.js "Nama Baru"`, lalu unggah ulang.
