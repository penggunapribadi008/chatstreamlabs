# ChatStream Labs

Satu aplikasi untuk streamer YouTube + TikTok + Twitch + Kick: gabungkan chat dua platform, tampilkan sebagai overlay di OBS dengan banyak gaya
(bisa tambah CSS sendiri), lihat jumlah penonton, dan balas chat dari satu kolom. Dibuat dengan Electron.

> Proyek ini dikembangkan bersama AI. Kalau kamu ingin melanjutkannya dengan AI-mu sendiri, minta AI itu membaca
> **`AGENTS.md`** lebih dulu: isinya arsitektur, aturan, dan jebakan yang sudah pernah terjadi.

## Fitur
- Chat YouTube + TikTok + Twitch + Kick dalam satu jendela, filter platform, label BOT/MOD, notifikasi penonton bergabung, riwayat bisa di-scroll
- Overlay OBS: gaya Default, Kartu, Persona 5, Neon, Retro, dan CSS buatan sendiri (tambah/edit/hapus, pratinjau langsung)
- Pengaturan ukuran nama/chat, jarak, kiri/kanan, arah muncul, animasi masuk, latar chat
- Tambah overlay ke OBS satu klik (lewat obs-websocket)
- Mode kunci (tanpa bingkai, transparan, tembus-klik) + hotkey global yang bisa diatur
- Sembunyikan jendela dari tangkapan layar OBS
- Super Chat YouTube tampil menonjol (nominal + warna) di dock dan overlay
- Kirim chat ke YouTube/TikTok lewat ekstensi Chrome
- Enam tema tampilan aplikasi
- Pengaturan per platform (Pribadi dan Overlay): TikTok (bergabung, hadiah, suka, ikuti, bagikan, langganan; masing-masing bisa diberi latar dan warna font) dan YouTube (Super Chat, Super Sticker, Member)
- Twitch (Bits, subscribe, gift sub, raid, pengumuman, chatter baru, emote) dan Kick (Kicks, subscribe, gift sub, follow, raid, hadiah poin, emote), masing-masing punya halaman pengaturan di Pribadi dan Overlay (belum diuji dengan live sungguhan; kirim chat baru untuk YouTube dan TikTok)
- Pratinjau overlay menampilkan pesan acak terus-menerus dari semua platform dan jenis aktivitas
- Kotak Total penonton (penonton yang sedang menonton, bukan puncak) dan tombol Laporan penonton: grafik, puncak, rata-rata, chat, hadiah, Super Chat, riwayat sesi

## Membuat installer lewat GitHub (tanpa Node.js di komputermu)
Baca **`PANDUAN-GITHUB.md`**: unggah kode ke repositori, jalankan workflow *Build installer Windows*, unduh installer-nya.

## Menjalankan dari kode sumber
Butuh Node.js 20+ dan Windows (untuk membuat installer).
```bash
npm install
npm start        # mode pengembangan
npm test         # tes asap
npm run dist     # buat installer di folder dist/
```
Pertama kali jalan, buka **Pengaturan → Koneksi**, isi username YouTube (`@nama`) dan TikTok, lalu Sambungkan.
Untuk kirim chat, pasang ekstensi dari folder `extension/` (Chrome → `chrome://extensions` → Developer mode → Load unpacked).

## Struktur singkat
`src/main.js` (Electron) · `src/server.js` (server lokal + konektor) · `src/ui/*` (tampilan) · `extension/` (ekstensi Chrome) ·
`scripts/build.js` · `test/smoke.js` · `examples/` (contoh CSS gaya). Rinciannya ada di `AGENTS.md`.

## Catatan penting
- Cara mengambil chat YouTube/TikTok **tidak resmi** dan bisa berhenti bekerja kapan saja; memakainya bisa melanggar ketentuan layanan
  platform. Pakai dengan risiko sendiri.
- `tiktok-live-proto` (dipakai oleh `tiktok-live-connector`) berlisensi **AGPL-3.0**. Kalau kamu membagikan aplikasi hasil build,
  baca ketentuannya dan sediakan kode sumbernya.
- Belum ada lisensi untuk kode proyek ini sendiri. Pemiliknya perlu memilih lisensi sebelum dipublikasikan.
- Aplikasi belum bertanda tangan digital, jadi Windows SmartScreen akan memberi peringatan saat instal.
