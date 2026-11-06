# ChatStream Labs

**Pusat kendali live streaming untuk Windows.** ChatStream Labs menggabungkan chat dari beberapa platform live ke satu tempat, menampilkannya sebagai overlay di OBS, dan menyediakan dock melayang untuk chat serta widget donasi di atas game, semuanya dari satu aplikasi desktop.


---

## Untuk siapa?

Streamer yang live di **YouTube, TikTok, Twitch, dan Kick** (sendiri-sendiri atau bersamaan) dan ingin:

- membaca semua chat di satu jendela, bukan berpindah-pindah tab,
- menampilkan chat yang rapi dan bisa diatur gayanya di layar stream,
- memasang widget donasi (alert / media share) di layar tanpa mengganggu game.

---

## Fitur utama

### Dashboard
Halaman pertama yang terbuka setelah splash. Dari sini kamu bisa:

- membuka, menutup, memuat ulang, dan mengunci **jendela chat** serta tiap **Donate Dock**,
- mengatur koneksi tiap platform, tampilan, overlay, dan hotkey,
- melihat status koneksi dan jumlah penonton,
- membuka **Laporan penonton**.

### Chat gabungan
- Chat YouTube, TikTok, Twitch, dan Kick dalam satu jendela.
- Filter per platform, label BOT/MOD, dan riwayat yang bisa di-scroll.
- Notifikasi aktivitas: penonton bergabung, hadiah, Super Chat, subscribe, gift sub, raid, follow, dan lainnya, sesuai platform.
- Super Chat YouTube tampil menonjol (nominal dan warna).
- Kolom kirim chat (lewat ekstensi Chrome) yang bisa dimatikan.

### Overlay OBS
- Banyak gaya bawaan (Default, Kartu, Persona 5, Neon, Retro) dan **CSS buatan sendiri** dengan pratinjau langsung.
- Pengaturan ukuran huruf, jarak, posisi kiri/kanan, arah muncul, animasi masuk, dan latar chat.
- Pengaturan terpisah untuk tampilan pribadi dan overlay, serta per platform dan jenis aktivitas.
- Tambah overlay ke OBS dengan satu klik (lewat obs-websocket).

### Dock melayang: Chat dan Donate Dock
- Jendela tanpa bingkai yang selalu bisa ditaruh di atas game.
- **Mode gembok:** transparan, tembus klik, tidak mencuri fokus. Isi widget tidak bisa diklik saat terkunci.
- **Kotak tombol terpisah di luar jendela** (mata, gembok, pindah, tutup), tanpa bingkai dan transparan rendah. Posisinya bisa diatur: atas atau bawah, kiri, tengah, atau kanan.
- Posisi dan ukuran tersimpan.
- Saat belum dikunci, dock berperilaku seperti jendela biasa, jadi Dashboard tetap bisa naik ke depan saat diklik.

### Donate Dock
- Tempel URL widget donasi (alert / media share, misalnya Saweria) dan widget tampil di jendelanya sendiri.
- **Bisa lebih dari satu dock** (sampai 5), masing-masing dengan pengaturan sendiri: nama, opacity, bisukan suara, dan ukuran acuan.
- Isi widget otomatis diskalakan mengikuti ukuran jendela.
- Memuat ulang otomatis kalau halaman gagal dimuat.
- Tidak butuh integrasi API; aplikasi hanya menampilkan halaman widget.

### Sembunyikan dari OBS
Jendela aplikasi (dock chat, Donate Dock, dan kotak tombolnya) bisa disembunyikan dari tangkapan layar OBS, jadi hanya kamu yang melihatnya. Saklarnya ada pada tombol **mata**.

### Laporan penonton
Grafik jumlah penonton, puncak, rata-rata, jumlah chat, hadiah, Super Chat, dan riwayat sesi.

### Lainnya
- **Hotkey global** yang bisa diatur (kunci, sembunyikan, OBS, scroll, bersihkan, filter, pengaturan, laporan, Donate Dock).
- **Ikon tray**: akses cepat ke Dashboard, Chat, Donate Dock, kunci, laporan, dan keluar.
- **Enam tema tampilan** aplikasi.
- **Splash screen** saat aplikasi dibuka.
- Pengaturan dan data tersimpan lokal.

---

## Memulai

1. Instal dan buka aplikasi.
2. Di Dashboard, buka **Pengaturan → Koneksi**, isi username YouTube (`@nama`), TikTok, Twitch, atau Kick, lalu **Sambungkan**.
3. Buka **Chat** dari Dashboard, atau tambahkan **Donate Dock** dengan tombol **+**.
4. Tambahkan overlay ke OBS dari menu Overlay.
5. Kunci jendela dengan tombol gembok (atau `Ctrl+Alt+L`) saat mulai bermain.

---

## Catatan penting

- Pengambilan chat YouTube dan TikTok **tidak resmi** dan bisa berhenti bekerja kapan saja; memakainya bisa melanggar ketentuan layanan platform. Pakai dengan risiko sendiri.
- Dukungan Twitch dan Kick belum diuji dengan live sungguhan.
- Aplikasi belum bertanda tangan digital, jadi Windows SmartScreen bisa memberi peringatan saat instal.
- Hanya untuk Windows.
