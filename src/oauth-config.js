// Client ID untuk login resmi. DIISI PEMILIK APLIKASI (bukan pengguna) lalu aplikasi di-build ulang.
// Client ID bukan rahasia (aplikasi publik, tanpa client secret), jadi aman ada di repo. JANGAN menaruh client secret di sini.
// Langkah pendaftaran: lihat AGENTS.md bagian 21. Selama masih berawalan ISI_, tombol Masuk hanya menampilkan pesan "belum disiapkan".
module.exports={
  TWITCH_CLIENT_ID:'ISI_TWITCH_CLIENT_ID_DI_SINI',
  KICK_CLIENT_ID:'ISI_KICK_CLIENT_ID_DI_SINI' // belum dipakai: login Kick ditunda karena Kick mewajibkan client secret (lihat AGENTS.md bagian 21); Kick tetap lewat ekstensi
};
