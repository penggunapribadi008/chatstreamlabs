# Cara membuat aplikasi lewat GitHub (tanpa perlu membangun di komputermu)

GitHub akan membangun installer Windows untukmu secara otomatis. Kamu hanya perlu mengunggah kode ini dan menekan satu tombol.

## Yang kamu butuhkan
1. **Akun GitHub** (gratis) di github.com.
2. **Isi folder ini** (semua berkas dan folder di dalam zip, termasuk folder `.github`).
3. Tidak ada kunci rahasia, tidak ada biaya. Repositori boleh **Private**.

## Langkah singkat (lewat browser)
1. Masuk ke GitHub, klik **+** di kanan atas, pilih **New repository**. Beri nama (contoh: `chatlivestream-labs`), pilih **Private**, lalu **Create repository**.
2. Di halaman repositori yang kosong, klik **uploading an existing file**.
3. Ekstrak zip ini di komputermu, lalu **seret semua isi folder** (bukan folder induknya) ke halaman GitHub itu, termasuk folder `.github`.
   Kalau folder `.github` tidak ikut terunggah (kadang folder yang namanya diawali titik tersembunyi di Windows), nyalakan
   *File Explorer > View > Show > Hidden items*, atau pakai cara GitHub Desktop di bawah.
4. Di bawah, klik **Commit changes**.
5. Buka tab **Actions**. Kalau ada tombol hijau untuk mengizinkan workflow, klik. Pilih **Build installer Windows** di sisi kiri,
   lalu klik **Run workflow** > **Run workflow**.
6. Tunggu sekitar 5 sampai 10 menit sampai ada tanda centang hijau. Klik proses yang selesai itu, lalu turun ke bagian **Artifacts**
   dan unduh **installer-windows**. Di dalamnya ada file `.exe` installer-nya.

## Cara alternatif: GitHub Desktop (lebih mudah untuk folder tersembunyi)
1. Pasang **GitHub Desktop**, masuk dengan akunmu.
2. *File > Add local repository*, pilih folder hasil ekstrak (kalau diminta, klik **create a repository**).
3. **Commit to main**, lalu **Publish repository** (centang **Keep this code private**).
4. Lanjut ke langkah 5 di atas.

## Membuat halaman Releases (opsional)
Kalau kamu ingin installer muncul rapi di halaman **Releases** (mudah dibagikan ke teman):
di GitHub Desktop pilih *Repository > ...* atau lewat terminal:
```
git tag v14.0.0
git push origin v14.0.0
```
Setelah proses selesai, installer otomatis terlampir di **Releases**.

## Setelah installer jadi
- Windows SmartScreen akan memberi peringatan karena aplikasi belum bertanda tangan digital. Klik **More info > Run anyway**.
- Kalau sebelumnya kamu sudah memasang "Chatstream Labs", pengaturannya otomatis ikut terbawa. Aplikasi lama bisa di-uninstall.
- Ekstensi Chrome (untuk kirim chat) ada di folder `extension` di dalam folder instalasi, atau di zip ini.

## Kalau proses gagal
Klik proses yang berwarna merah, buka langkah yang gagal, salin tulisan error-nya, lalu berikan ke AI-mu bersama berkas `AGENTS.md`.

## Mengganti nama aplikasi
Satu perintah mengganti nama di seluruh proyek (butuh Node.js): `node scripts/rename.js "Nama Baru"`, lalu unggah ulang.
