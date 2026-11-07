# AGENTS.md — panduan untuk AI yang mengembangkan ChatStream Labs

Baca file ini dulu sebelum mengubah apa pun. Proyek ini dibuat bersama AI lewat banyak putaran perbaikan; di bawah ini
ada konteks, arsitektur, aturan, dan semua jebakan yang sudah pernah kejadian, supaya tidak diulang.
(Pengguna dan UI berbahasa Indonesia. Teks yang tampil ke pengguna HARUS bahasa Indonesia yang santai dan jelas.)

## 1. Produk
Aplikasi desktop Windows untuk streamer multi-platform (YouTube + TikTok + Twitch + Kick):
- Menggabungkan chat kedua platform dalam satu jendela ("dock") yang hanya dilihat streamer, dengan jumlah penonton,
  label BOT/MOD, notifikasi "bergabung" (TikTok), filter platform, riwayat yang bisa di-scroll.
- Menyajikan **overlay** untuk OBS (Browser Source) dengan banyak gaya yang bisa diedit/ditambah pengguna lewat CSS.
- Kolom kirim chat: mengirim pesan ke YouTube/TikTok sekaligus atau salah satu (lewat ekstensi Chrome).
- **Mode kunci**: jendela jadi tanpa bingkai, transparan, selalu di atas, tembus-klik; dikendalikan dua/tiga kotak kecil
  di jendela terpisah di luar jendela chat. Jendela aplikasi dapat disembunyikan dari tangkapan layar OBS.
- Hotkey global yang bisa diatur, tema aplikasi (Standar, Neumorfisme, Glassmorphism, Claymorphism, Liquid Glass, Spatial UI).

## 2. Arsitektur
```
Electron main (src/main.js)  ──require──▶  server lokal in-process (src/server.js, HTTP + SSE + WebSocket)
        │  hooks (fungsi)                          │  /events (SSE) dan POST /...
        ▼                                          ▼
  BrowserWindow (frameless)  ◀──────────  satu halaman web: build/index.html  (dilayani server di http://localhost:3000)
  window lain: settings, tpl, tpladd, ctl, preview            dipilih lewat ?view=
```
- **Satu `index.html`, banyak tampilan** (query `?view=`): `dock` (default), `overlay` (OBS & pratinjau), `settings`,
  `tpl` (kelola gaya), `tpladd` (tambah/edit gaya), `ctl` (kotak gembok/mata/pindah), `report` (laporan penonton). Parameter lain: `locked=1`,
  `preview=1`, `static=1` (pratinjau tanpa SSE, data dikirim induk lewat postMessage), `force=<idGaya>`, `id=`.
- **Server** menyimpan semua keadaan: `settings.json` (`{dock, overlay, global}`), `config.json` (username YT/TikTok),
  `log.txt`. Lokasinya `CG_DATA` (= folder userData Electron). Semua halaman sinkron lewat SSE `/events`
  (`init`, `msg`, `settings`, `draft`, `draftclear`, `status`, `viewers`, `cmd`).
- **Hooks**: `server.hooks.*` diisi `main.js` (protect, open, window, lock, drag, shape, setHotkeys, global, winCtl, openSettings, donate).
  Server tidak boleh mengimpor `electron`; semua hal OS lewat hooks.
- **Konektor chat** (di server): YouTube = `youtube-chat` (scrape, tanpa API key), TikTok = `tiktok-live-connector` v2.
  Setiap pesan masuk lewat `push()` → disimpan di riwayat (300) → `emit('msg')`.
- **Kirim chat**: UI → `POST /send` → `extSend()` → WebSocket `/ext` → ekstensi Chrome (`extension/yt.js`, `tt.js`) yang
  mengetik di halaman chat milik Chrome yang sudah login. Ekstensi mencari server di port 3000–3010.
- **OBS**: `POST /obs-add` memakai obs-websocket v5 (handshake + auth SHA256 ditulis manual di `obsAdd()`), membuat
  browser source "ChatStream Overlay" di scene aktif.

## 3. Peta berkas
| Berkas | Isi |
|---|---|
| `src/main.js` | jendela, mode kunci, tray, hotkey global, konfirmasi keluar, single-instance, watchdog muat halaman, Donate Dock |
| `src/stats.js` | statistik sesi live (sampel penonton, chat, hadiah, Super Chat) + `analytics.json` |
| `src/server.js` | HTTP/SSE/WebSocket, konektor YT/TikTok, jembatan ekstensi, OBS, seeding gaya, deteksi bot |
| `src/seeds.json` | gaya overlay bawaan yang bisa diedit (Kartu, Persona 5, Neon, Retro) — CSS biasa |
| `src/ui/style.css` | semua CSS (variabel tema, jendela, struktur standar "Default", animasi, jendela pengaturan) |
| `src/ui/body.html` | kerangka HTML semua tampilan |
| `src/ui/app.js` | seluruh logika klien |
| `extension/` | ekstensi Chrome MV3 (pengirim chat + `bg.js` pembuka tab & pembaru diri) |
| `src/twitch.js`, `src/tokenstore.js`, `src/oauth-config.js` | login resmi Twitch (device code + Helix), penyimpan token terenkripsi, Client ID (v15.2.1, lihat bagian 21) |
| `src/extsync.js` | menyalin `extension/` ke folder ekstensi tetap di data pengguna (v15.2.0; dibawa ke `build/` oleh `scripts/build.js`) |
| `scripts/build.js` | merakit `build/index.html` dan membundel `build/server.js` (esbuild) |
| `test/smoke.js` | tes asap server + jsdom (tanpa Electron) |
| `examples/` | contoh CSS gaya buatan sendiri |

## 4. Struktur DOM chat dan gaya (PENTING)
Overlay mendukung **tiga struktur HTML**; struktur dipilih otomatis dari CSS gaya (`detectStruct` di `app.js`):
1. **std** (Default + Kartu/Neon/Retro + CSS buatan sendiri biasa):
   `.m.msg.y|t.yt|tt [.isbot .ismod .isown]` › `span.pl.logo>img`, `.av.avatar`, `.body` › (`.hd.head` › `.tag`›(`img.pi`, `b.nm.name`›`i` per huruf), `.tm.time`, `.bd.bot|mod|own`) + `.tx.text.message>span`.
2. **p5** (CSS yang mengandung `.p5-msg`): `.p5-msg.p5-yt|p5-tt` › `.p5-head`(`.p5-logo>.p5-logo-in>img`, `.p5-name`›`.ch`/`.ch.i`/`.sp`) + `.p5-bub>.p5-l1>.p5-l2>.p5-text`.
3. **rv** (CSS yang mengandung `.badge` dan `.p-yt`/`.p-tt`): `.msg.p-yt|p-tt` › `.badge>svg` + `.body` › `.name`(`span.n` + `.tag`) + `.text`; wadahnya diberi id `log` (bukan `msgs`).
Wadah semua chat: `#list` (area penuh) › `#msgs` (atau `#log` untuk rv).
- Gaya = `{id, name, css, struct}` di `settings.global.templates`. Hanya **Default** (`polos`) yang tertanam & terkunci; sisanya
  di-seed dari `seeds.json` saat pertama jalan (`tplSeeded`) sehingga bisa diedit/dihapus; ada tombol "Pulihkan gaya bawaan".
- CSS gaya disuntik **tanpa scoping** ke `<style id="usercss">` hanya di tampilan overlay. Tulis aturan yang cukup spesifik.
- Pengaturan overlay yang HARUS tetap bekerja untuk gaya apa pun: ukuran nama (`--fsn`), ukuran chat (`--fst`), jarak (`--gap`),
  arah muncul (`body.ot`), posisi kiri/kanan (`body.al-right`), animasi masuk (`body.an-*`; "otomatis" = ikuti animasi bawaan CSS).
  Mekanisme: gaya yang memakai `--fsn/--fst/--p5-scale` mengurus ukurannya sendiri; gaya yang memakai font px tetap diskalakan
  lewat `zoom` (`body.zm`, `--zn`, `--zt`, baseline 20px); jarak yang diubah pengguna menimpa lewat `body.gap-set`; kanan = `scale:-1 1`
  untuk rv (lewat variabel `--sx`, lihat jebakan 16). Jangan memecahkan ini saat menambah struktur/gaya baru.
- Bot dikenali dari daftar nama (Nightbot, StreamElements, …) + daftar tambahan pengguna (`global.botNames`).

### Super Chat
`youtube-chat` mengirim `item.superchat = {amount, color}`; server meneruskannya sebagai `m.sc = {amount, color}`.
UI memberi kelas `sc` dan variabel CSS `--sc` pada pesan, serta elemen nominal: std `.amt`, p5 `.p5-amt`, rv memakai kelas `hl` + `.tag` berisi nominal.
Pratinjau overlay selalu menyertakan satu contoh Super Chat (`SAMP` di `app.js`) dan tombol "Kirim pesan tes" mengirim satu juga.
Gaya bawaan yang sudah tersimpan di komputer pengguna tidak otomatis menerima CSS Super Chat baru (seed hanya diisi sekali):
hapus lalu "Pulihkan gaya bawaan" untuk mendapat versi terbaru.

## 5. Protokol pengaturan
- `settings.dock` = tampilan dock pribadi (+ `theme`), `settings.overlay` = overlay OBS, `settings.global` = hal lintas-jendela
  (protect, ctrlPos, templates, hotkeys, obs*, botNames, tplSeeded).
- Perubahan di jendela pengaturan dikirim sebagai **draft** (`POST /draft` → SSE `draft`) supaya dock dan jendela pratinjau berubah
  langsung; baru disimpan saat tombol Terapkan (`POST /settings`). Menutup jendela pengaturan mengirim `draftclear`.
- `window.__ready=true` (fungsi `bootDone()` di `app.js`) menandai halaman siap. `main.js` memakainya untuk watchdog dan untuk
  menukar jendela saat kunci tanpa berkedip. Jangan menghapusnya. Error JS ditampilkan di `#boot` dan dicatat ke `log.txt`.

## 6. Jebakan yang sudah pernah terjadi (jangan diulang)
1. **Payload TikTok memakai proto v3**: isi chat ada di `content` (bukan `comment`), foto di `avatarThumb.urlList[0]`,
   jumlah penonton di event `roomUser` field `total`. Sempat membuat chat TikTok "hanya nama" dan penonton selalu "-".
2. **Batas 6 koneksi per host**: tiap `EventSource` (SSE) menahan satu koneksi; semua jendela Electron berbagi batasnya.
   Pratinjau banyak (iframe) HARUS memakai `static=1` + postMessage, bukan SSE masing-masing.
3. **Login Google di jendela Electron ditolak** ("browser tidak aman") dan memunculkan prompt security key. Jangan membuat login
   Google dalam aplikasi. Ekstensi Chrome (browser pengguna yang sudah login) adalah jalur yang dipilih. (Pernah dicoba: OAuth
   Google Cloud + YouTube Data API — berfungsi tapi terlalu rumit bagi pengguna; samaran Firefox-UA tidak dijamin.)
4. **`setContentProtection` (sembunyikan dari OBS) tidak bekerja pada jendela `WS_EX_LAYERED`**, dan `setIgnoreMouseEvents(true)`
   membuat jendela layered. Solusi: saat "Sembunyikan dari OBS" aktif, jendela terkunci TIDAK memakai `setIgnoreMouseEvents`; hanya
   area gelembung chat yang menerima klik (`setShape`, dilaporkan halaman lewat `POST /shape`). Jika tidak disembunyikan: tembus-klik penuh.
   **Catatan v15.1.6**: klaim ini tidak terbukti. Electron sendiri menambahkan `WS_EX_LAYERED` waktu `setContentProtection(true)` dipasang (PR electron/electron#47856), jadi layered + proteksi seharusnya jalan. Sejak v15.1.6 jalur ini hanya dipakai kalau `PROTECT_PASSTHRU=false` (lihat bagian 18).
5. **Jendela `transparent` tidak bisa di-resize di Windows** dan tidak bisa berubah dari/ke transparan setelah dibuat. Karena itu
   mode kunci = membuat jendela baru (`setLock` menutup yang lama lalu membuat yang baru). Pernah dicoba menukar tanpa kedip
   (buat tersembunyi dulu, tunggu `__ready`, baru tukar), tapi pengguna meminta kembali ke cara sederhana ini. Jangan ulangi tanpa diminta.
6. **Posisi bergeser** saat kunci/buka kunci terjadi karena membandingkan bounds luar vs isi jendela. Simpan `outer` dan geseran saja.
7. **Memuat pustaka TikTok memblokir event loop** (≈1 detik di dev, jauh lebih lama di laptop biasa) karena server berjalan di
   proses utama. Sambungan live sengaja ditunda sampai halaman siap (`POST /ready`, +2,5 dtk). Perbaikan ideal: pindahkan server ke
   `utilityProcess` (lihat roadmap).
8. **Animasi saat render awal** terlihat seperti berkedip → body diberi `noanim` selama boot (900 ms).
9. **Tema harus ada di HTML pertama** (server menyisipkan `th-<tema>` di `<body>`), kalau tidak tampil Standar dulu lalu berganti.
10. **`nth-child` pada nama per huruf**: `.sp` (spasi) ikut terhitung; itu disengaja pada gaya Persona 5.
11. Library `tiktok-live-proto` berlisensi **AGPL-3.0**; kedua konektor memakai cara tidak resmi (bisa rusak kapan saja, dan
    mungkin melanggar ketentuan layanan platform). Catat ini kalau aplikasi dibagikan.
12. `build/` dan `dist/` adalah hasil build; JANGAN diedit manual. Edit di `src/`.
13. **Aturan global di `style.css` bocor ke CSS buatan pengguna.** Dulu `*{outline:none!important}` berlaku juga di overlay, sehingga jahitan putus-putus
    yang dibuat pengguna lewat `outline` tidak pernah tampil di aplikasi (padahal tampil di browser biasa). Sekarang aturan itu hanya
    `body:not(.overlay) *`. Prinsip: di tampilan overlay, aturan bawaan aplikasi tidak boleh menimpa properti visual yang lazim dipakai CSS
    pengguna (`outline`, `gap`, `margin`, `opacity`, dst.) dan harus diberi batas selektor (`#msgs`, `.m`, `body:not(.overlay)`).
    Cara mengecek: pasang CSS pengguna di halaman polos dan di pratinjau aplikasi, bandingkan tangkapan layarnya; harus identik.
14. **Pratinjau jendela "Gaya baru"** (`force=__draft`) harus kosong selagi CSS kosong. Dulu tampil tampilan bawaan aplikasi sehingga
    menyesatkan (terlihat seperti gaya yang sudah ada). Lihat `draftEmpty()` di `app.js`; pesan contoh yang sudah dijadwalkan ikut dibatalkan.
15. **Pindahan data dari nama lama** (`main.js`) berjalan sekali (berkas `.migrasi-nama` di folder data) dan memakai berkas TERBARU. Di Windows nama
    folder tidak peka huruf besar/kecil: "Chatstream Labs" dan "ChatStream Labs" adalah folder yang sama, jadi cara lama (salin hanya kalau
    berkas belum ada) membuat pengaturan terbaru tidak ikut terbawa setelah penggantian nama.

16. **Animasi masuk yang memakai `scale` menghapus mirror kanan struktur rv.** Posisi kanan untuk rv dibuat dengan `scale:-1 1` pada `.msg`
    (anak `.badge` dan `.body` dibalik lagi supaya teks terbaca). Keyframes `aBounce` dan `aZoom` berakhir di `scale:1` dengan `animation-fill-mode:both`,
    jadi setelah animasi selesai mirror `.msg` hilang: lapisan jadi kiri tapi teks (yang masih dibalik anak-anaknya) tampil terbalik. Gejalanya: sepersekian
    detik benar, lalu salah; hanya terjadi saat animasi masuk = Bounce/Zoom (Slide, Fade, Flip aman karena memakai `translate`/`rotate`). Perbaikan: `.msg` rv
    memakai `--sx:-1; scale:var(--sx) 1`, dan keyframes yang menyentuh `scale` mengalikan dengan `var(--sx,1)`. Aturan: keyframes bawaan yang menganimasikan
    `scale` WAJIB ikut `--sx`. Gaya struktur std tidak kena karena rata kanannya memakai `flex-direction:row-reverse`, bukan `scale`.

## 7. Cara kerja sehari-hari
Build installer Windows: lewat GitHub Actions (`.github/workflows/build.yml`, lihat `PANDUAN-GITHUB.md`) atau `npm run dist` di Windows.
Ganti nama aplikasi: `node scripts/rename.js "Nama Baru"` (nama lama dicatat di `package.json > previousNames` agar data pengguna ikut pindah).
```bash
npm install
npm start           # build + jalankan Electron (mode pengembangan)
npm test            # build + tes asap (server + jsdom); wajib lulus sebelum selesai
npm run dist        # Windows: installer NSIS di dist/
npm run dist:dir    # folder tanpa installer (untuk uji cepat)
```
- Dibangun & diuji awalnya di Linux (jsdom + server nyata + mock OBS/ekstensi), jadi **perilaku visual Windows tidak pernah diuji
  langsung** oleh AI sebelumnya: mode kunci/tembus-klik/sembunyi-dari-OBS, ikon exe, login & kirim chat ke platform asli.
  Minta pengguna mencoba dan menempel tangkapan layar/`log.txt` (`%APPDATA%/ChatStream Labs/log.txt`) kalau ada masalah.
- Di Linux/macOS ikon `.exe` tidak tertanam otomatis; jalankan `node scripts/patch-exe.js "dist/win-unpacked/ChatStream Labs.exe" assets/icon.ico`.
- Setiap perubahan UI: perbarui `test/smoke.js` bila perilaku penting berubah. Untuk fitur server, uji dengan mock (lihat `serverTests`).

## 8. Aturan gaya perubahan
- Satu berkas klien (`index.html` hasil rakitan). Jangan menambah framework; vanilla JS dan CSS saja.
- Semua teks UI bahasa Indonesia. Jangan menambah notifikasi yang tidak diminta (pengguna sengaja menghapus "terkirim ke…").
- Warna standar bukan ungu (pengguna menolak estetika ungu generik). Tema baru = kumpulan variabel CSS di `style.css` (`body.th-<id>`).
- Jangan mengubah struktur DOM chat tanpa memperbarui bagian 4 dan `seeds.json`.
- Jangan membuat jendela baru yang membuka SSE sendiri tanpa perlu (lihat jebakan 2).
- Ubah pelan-pelan dan jelaskan ke pengguna dengan bahasa awam; jujur soal apa yang belum teruji.

## 9. Ide pengembangan berikutnya
- Banner "Versi baru tersedia" di Dashboard + tombol "Cek pembaruan" manual (cek otomatis di splash sudah ada, bagian 14).
- Pindahkan server+konektor ke `utilityProcess` agar UI tidak pernah tersendat.
- Penandatanganan kode (hilangkan peringatan SmartScreen); pembaruan senyap.
- Dukungan platform lain (Twitch, Kick), pesan sorotan (sub/donasi), moderasi dasar, TTS, widget alert.
- Jalur kirim chat resmi untuk YouTube (YouTube Data API `liveChatMessages.insert`) sebagai opsi lanjutan.

## 10. Prompt awal yang disarankan untuk AI baru
"Baca AGENTS.md dan README.md. Jalankan `npm install` lalu `npm test` dan pastikan lulus. Setelah itu kerjakan: <tugasmu>.
Jangan mengubah hal lain, jalankan `npm test` lagi di akhir, dan laporkan apa yang sudah dan belum bisa kamu uji."

## 6. Port lokal (bisa diubah pengguna)
- Bawaan 3000. Pengguna mengubahnya di Pengaturan > Koneksi > "Port lokal" (hanya angka; awalan `http://localhost:` tetap). Disimpan di `config.json` (`port`), berlaku setelah mulai ulang (`POST /restart` memanggil `hooks.relaunch` di `main.js`).
- `POST /port-set` menolak port di luar 1024-65535, port di daftar `AVOID` (server.js; juga dikirim ke UI lewat `init.cfg.avoid` untuk dialog "Hindari"), dan port yang sedang dipakai program lain (dites dengan `net`). Pesan: `localhost:XXXX telah digunakan ...`.
- Kalau port pilihan bentrok saat startup, `tryListen` pindah ke port berikutnya; UI menampilkan peringatan (`cfg.port` = port berjalan, `cfg.wanted` = port pilihan).
- Ekstensi Chrome mencari server di port tersimpan (`chrome.storage.local.port`, diisi lewat halaman Opsi ekstensi) lalu 3000-3010. Jangan hapus izin `storage`.

## 7. Struktur "cozy" (struktur HTML keempat)
CSS yang memuat `data-color=` atau `data-mode=` dideteksi sebagai `cozy` (`detectStruct`). Atribut tambahan tiap pesan: `data-type` (`chat`, atau `event` untuk Super Chat) dan `data-role` (`mod`/`streamer`/`bot`/kosong); tiap `.tag` punya `data-tag`. Avatar selalu `<img>` (ada gambar inisial cadangan kalau foto kosong/gagal). Ukuran TIDAK diskalakan lewat `zoom` untuk struktur ini; pakai `var(--fsn)`/`var(--fst)` kalau ingin mengikuti pengaturan. Aturan CSS bawaan aplikasi tidak boleh memakai nama kelas generik (`.row`, `.name`, `.text`, `.tag`, `.avatar`, `.body`) tanpa dibatasi ke `body:not(.overlay)`, supaya tidak menimpa CSS buatan pengguna. Markup: wadah `#chat[data-mode=person]` > `.msg[data-platform=youtube|tiktok][data-color=1..N]` > `.avatar>img` + `.body` > `.row` (`.name`, `.tag`) + `.text`. `buildCozy` di `app.js`; N diambil dari angka terbesar `data-color` di CSS (minimal 5). Foto cadangan (inisial) berupa SVG tanpa latar; warna latarnya urusan CSS gaya. Wadah `#chat` tidak diberi `gap` bawaan (hanya `body.gap-set` saat slider jarak digeser), supaya `margin` buatan pengguna tidak ditambah jarak ekstra. `examples/cozy-multichat-earthy.css` = CSS pengguna yang dipakai sebagai bahan uji di `test/smoke.js`.

## 8. Ekspor gaya
Di jendela "Gaya baru/Edit gaya" ada tombol "Ekspor file .css" (di samping Impor). `POST /export-css` memanggil `hooks.saveCss` (dialog Simpan di `main.js`); kalau bukan di Electron, jatuh ke unduhan blob.

## 9. Aktivitas, pengaturan per platform, dan laporan (v14.3)
- **Pesan aktivitas** = `m.kind` (`join|gift|like|follow|share|sub`, semuanya TikTok). Dirender `addAct`/`actEl` sebagai `div.cs-act.cs-tt.cs-<kind>`
  (BUKAN `.m`/`.msg`, supaya CSS gaya buatan pengguna tidak ikut mengenainya). Latar/warna font = gaya inline dari pengaturan `tt<Kind>Bg|BgC|BgOp|Fc`;
  master `ttAct`; hadiah punya batas minimal koin `ttGiftMin`. `joins` lama dimigrasi ke `ttJoin` di `cur()`. Overlay: join mati bawaan.
- **Server TikTok**: semua handler dibungkus `safe()` (bentuk payload antar versi pustaka bisa beda; belum diuji dengan live sungguhan).
  Gift streak (`giftType===1 && !repeatEnd`) ditunda sampai akhir; like digabung per 5 dtk jadi satu baris (`likeAdd`) tapi dihitung penuh di statistik.
  Penonton TikTok HANYA dari `viewerCount`/`total` (yang sedang menonton); `popularity`/`totalUser` kumulatif dan sengaja tidak dipakai.
- **YouTube**: `m.member` (`isMembership`), `m.sticker` (`superchat.sticker`), pengaturan `ytSc*`, `ytSticker`, `ytMem*` (lihat `PLAT.yt`). `styleMsg()` menerapkan
  latar/warna font Super Chat lewat variabel `--sc/--sco/--scf` dan kelas `sc-nobg/hasfc/noamt`; penuh hanya di struktur std, struktur lain mengikuti `--sc`.
  Like/subscriber/Jewels/polling YouTube TIDAK tersedia dari `youtube-chat`.
- **Halaman pengaturan platform** dibangun dari DSL kecil `PLAT` (`chk/col/sl/sel`, `dep` = bagian yang muncul bila dicentang/bernilai tertentu, `pv` = pratinjau hidup).
  Kunci pengaturannya datar di `settings.dock` / `settings.overlay` (diisi `platDef()`), jadi `collect/fill/draft` yang lama tetap bekerja. Jendela pengaturan memakai `showPane(id,tab)`.
- **Mode kunci + Sembunyikan dari OBS**: area klik (`setShape`) kini hanya kotak yang terlihat: tiap gelembung `#msgs>*` dan tiap kotak `#top>*` (YouTube, TikTok, Total).
  Dulu seluruh bar `#top` ikut masuk sehingga ruang kosong di header memblokir klik. Kotak itu sendiri tetap menangkap klik (batasan jebakan 4); kalau mata OBS dimatikan jendela tembus-klik penuh.
  Di mode kunci `#top` transparan dan tiap kotak punya latar sendiri (supaya tidak menyatu dengan game).
- **Laporan** (`?view=report`, tanpa SSE: polling `GET /analytics?id=` tiap 5 dtk). `stats.js` mencatat sampel `[t,yt,tt]` tiap 15 dtk; puncak/rata-rata dihitung dari sampel itu.
  Sesi berakhir lewat "Mulai sesi baru", aplikasi ditutup, atau 30 menit tanpa data penonton; disimpan di `analytics.json` (maks 20 sesi). Hotkey `report` (Ctrl+Alt+R) dan menu tray juga membukanya.
  Durasi menonton per orang dan retensi TIDAK bisa dihitung (hanya jumlah penonton serentak yang terlihat).

## 10. Twitch & Kick (v14.4)
- **Konektor** ada di `server.js` (`startTW`, `startKK`), pengurai pesannya MURNI di `src/platforms.js` (`twitchLine`, `kickEvent`; diuji di `test/smoke.js`).
  Twitch = IRC lewat WebSocket anonim (`justinfanNNNN`, hanya baca; tag `bits`, `emotes`, `badges`, USERNOTICE sub/resub/subgift/submysterygift/raid/announcement/ritual).
  Penonton Twitch dari GQL publik (`gql.twitch.tv`, 30 dtk). Follow Twitch TIDAK tersedia tanpa login (EventSub).
  Kick = Pusher WebSocket; butuh `chatroom.id` dari `kick.com/api/v2/channels/<slug>` (Cloudflare bisa memblokir; cadangan `hooks.netFetch` = `net.fetch` Electron;
  cadangan terakhir kolom manual `kickRoom` di Koneksi). Event: ChatMessageEvent, KicksGifted, SubscriptionEvent, GiftedSubscriptionsEvent, StreamHostEvent, RewardRedeemedEvent, FollowersUpdated.
  **Belum pernah diuji dengan live Twitch/Kick sungguhan** (sandbox pengembangan tanpa internet); nama event Kick dan bentuk payload bisa meleset.
- **Pesan**: `m.p` = `youtube|tiktok|twitch|kick`. Kelas std: `.y/.yt`, `.t/.tt`, `.w/.tw`, `.k/.kk`; p5: `.p5-tw/.p5-kk`; rv: `.p-tw/.p-kk`; cozy: `data-platform=twitch|kick`.
  Registri di `app.js`: `PK/PC/PN/PL`, `ACT` (aktivitas per platform), `SCK` (Super Chat / Bits / Kicks), `MEMK`, `VIPK`. Bits dan Kicks memakai mekanisme `m.sc` yang sama dengan Super Chat.
  Bendera tambahan: `m.vip` (`.isvip`, `.bd.vip`), `m.me` (`.isme`), `m.hl` (`.ishl`), `m.emo=[[mulai,akhir,url]]` (emote, `fillText`, kelas `.cs-emo`). Member/VIP bisa dimatikan per pesan lewat kelas `nomem1`/`novip1` (bukan lagi `body.nomem`).
- **Aktivitas** per platform: tiktok `join gift like follow share sub`, twitch `sub gift raid announce first`, kick `sub gift follow raid reward`. Kunci pengaturan = awalan (`tt`/`tw`/`kk`) + Kind
  (`twRaid`, `twRaidBg`, `twRaidBgC`, `twRaidBgOp`, `twRaidFc`, master `twAct`, `twGiftMin`). Filter dock memakai `body.f-<platform>` + atribut `data-platform` (juga pada `.cs-act`).
- **Gaya bawaan**: aturan Twitch/Kick ada di akhir tiap seed setelah penanda `/* twitch-kick */`; server menambahkannya sekali ke gaya bawaan lama yang sudah tersimpan di komputer pengguna (tidak menimpa suntingan).
  CSS buatan pengguna sendiri tidak ikut diperbarui: warna nama Twitch/Kick jatuh ke `--wc`/`--kc` bawaan aplikasi, tapi struktur p5/rv/cozy perlu aturan platform baru.
- **Pratinjau overlay** (`isPrev`): bukan lagi 6 contoh tetap yang diulang, melainkan pesan acak terus-menerus dari "dek acak" `SCEN` (tiap putaran semua skenario keluar sekali: 4 platform, badge, aktivitas,
  Super Chat/Bits/Kicks, emote, nama & teks panjang). Tambah fitur baru = tambah skenario di `SCEN` (dan cek indeks `SHOW`, contoh langsung saat pratinjau dibuka).
- Kirim chat ke Twitch/Kick BELUM ada (ekstensi Chrome hanya YouTube & TikTok); dock menolak dengan pesan jelas. Laporan penonton mencakup keempat platform (`stats.js`, sampel `[t,yt,tt,tw,kk]`, hitungan `s.o`).
- Ikon aplikasi: `assets/icon.png|ico` + `extension/icon.png` dibuat dari logo ChatStream Labs (merah, gelembung chat). Logo platform: `assets/{yt,tt,tw,kick}.png`.

## 11. Splash + Dashboard (v14.5)
- Urutan buka aplikasi: `startUp()` (main.js) memunculkan **splash** (`src/splash.html`, latar `assets/splash-bg.webp`, logo `assets/splash-logo.png`; teks "Checking for updates..." lalu "Connecting your streaming universe..." dengan bar buatan sendiri) -> server siap -> **Dashboard** (`?view=dashboard`) dimuat tersembunyi -> setelah `__ready` splash memanggil `finish()` lalu ditutup dan Dashboard tampil. Splash minimal tampil ±3,8 dtk. Cek update di splash sekarang sungguhan (lihat bagian 14, v15.1.0).
- **Dashboard** memakai ulang seluruh kode jendela pengaturan (`isSet` ikut true bila `isDash`); sidebar `#sb`, beranda `#pd`, dan pratinjau kanan `#dpv` (dua iframe static: `pvD` dock, `pvO` overlay; data dikirim lewat `pvSend()` dari `draftChange`). Tab Pribadi/Overlay memberi body kelas `split` (kiri pengaturan, kanan pratinjau).
- Jendela chat (dock) sekarang dibuka dari tombol "Buka Chat" (`/open` what=`chat` -> `hooks.openChat`). Menutup jendela chat tidak menutup aplikasi; menutup Dashboard menanyakan keluar. Tombol gear, hotkey Pengaturan, dan menu tray membuka Dashboard (`openSettings` = `showDash`). `?view=settings` lama masih ada tetapi tidak dipakai.

## 12. Dashboard sebagai pusat kendali (v14.6)
- **Splash dikunci**: `movable/closable/minimizable:false`, tanpa `-webkit-app-region:drag` (hanya `destroy()` dari `startUp` yang menutupnya).
- **Switch platform** (`cfg.enabled` di `config.json`, `POST /platform`, SSE `cfg`, klien `EN`/`setEN`/`applyEnabled`/`syncPlats`): platform mati = konektor berhenti (status `nonaktif`),
  kotak header, opsi filter/kirim, tombol pengaturan Pribadi/Overlay, pratinjau, dan chat lamanya disembunyikan. `add()` membuang pesan platform mati. Default: YouTube & TikTok nyala; Twitch/Kick nyala bila username sudah pernah diisi.
- **Dock**: tanpa tombol perkecil, pengaturan, dan laporan. Saat belum dikunci kotak penonton datar; saat dikunci tetap berkotak. Pratinjau Pribadi (`body.dock.preview`) hanya daftar chat.
- **Dua tombol di pratinjau** (`pvm_prev`/`pvm_live`): `prev` = contoh acak hanya di iframe; `live` = Dashboard mengirim contoh lewat `POST /sample` (`target` dock|overlay, bertanda `sample`, tidak masuk riwayat/statistik)
  dan iframe dikosongkan (`feedOn=false`). `POST /sample-clear` (SSE `sampleclear`) membersihkan contoh saat kembali ke pratinjau, pindah tab, atau Dashboard ditutup.
- **Laporan penonton** = tab `r` di Dashboard (`#rep`, `body.rview`, `initReport(true)`), bukan jendela baru; `hooks.openReport` memunculkan Dashboard lalu `window.__goTab('r')`.
- **Kirim chat Twitch/Kick**: `extension/tw.js`, `kk.js` (v1.2). Pemilih kolom chat adalah tebakan terbaik dan BELUM diuji di situs asli; pengguna harus memuat ulang ekstensi di chrome://extensions.
- Pengujian: sandbox pengembangan ini memakai Chromium (Playwright) untuk uji perilaku; `test/smoke.js` (jsdom) sudah diperbarui tetapi belum dijalankan di sana.

## 13. Donate Dock dan perubahan kecil (v14.6.1)
- **Donate Dock** memuat URL widget donasi (alert / media share, mis. Saweria) di jendela sendiri. Tidak ada integrasi API; aplikasi hanya menampilkan halamannya.
  Pengaturan di `settings.global`: `donateUrl` (kosong = fitur diam) dan `donateMute`. Server: `POST /donate-set` (validasi lewat `cleanDonateUrl`, hanya http/https, selain itu pesan Indonesia),
  `/donate-mute`, `/donate` (`act` = open|close|toggle|reload, lewat `hooks.donate`). Server tidak mengimpor `electron`. Tab Dashboard = `#pn` (sidebar `data-t="n"`), hotkey `donate` (Ctrl+Alt+D), item menu tray.
- **Jendela** (`makeDonate`, `main.js`): BrowserWindow tanpa bingkai + `WebContentsView` berisi widget (partition `persist:donate`, `autoplayPolicy:'no-user-gesture-required'`, `backgroundThrottling:false`, sandbox, contextIsolation).
  Mode biasa: bilah judul = halaman lokal `?view=donatebar` (`isDB` di `app.js`, statis, tanpa SSE, `body.donatewin`), widget di bawahnya (tinggi bilah `DBAR`=34). Mode gembok: transparan, `screen-saver`, `focusable:false`, `skipTaskbar`, widget memenuhi jendela.
  CSS `html,body{background:transparent!important}` disuntik di `dom-ready` dan `did-finish-load`. Navigasi non-http(s) dan jendela popup ditolak; semua permintaan izin ditolak.
- **Gembok**: Donate Dock IKUT gembok chat (dipilih karena paling sederhana dan konsisten dengan satu tombol gembok). `setLock` memanggil `donRelock()` yang membuat ulang jendela Donate Dock (jendela transparan tidak bisa berubah mode, lihat jebakan 5);
  menutup jendela chat yang sedang terkunci juga mengembalikan Donate Dock ke mode biasa. Posisi dan ukuran di `window.json` kunci `donate` (hanya disimpan di mode biasa), terpisah dari `outer` (chat) dan `dash`.
- **Sembunyikan dari OBS**: isi widget tidak diketahui halaman kita, jadi tidak ada daftar area klik seperti chat. `applyDonateInput()`: protect aktif = `setIgnoreMouseEvents(false)` + `setShape` penuh (jendela menerima klik di areanya);
  protect mati = `setShape` penuh + `setIgnoreMouseEvents(true)` (tembus-klik penuh). Pakai `setShape` KECIL (mis. 1x1) akan membuat widget tidak terlihat: bentuk jendela memotong tampilannya.
- **Pemulihan**: `donRetry` (did-fail-load, render-process-gone, halaman menggantung >25 dtk) mencoba ulang dengan jeda 3/6/12/24/48 dtk, berhenti setelah `DON_MAX`=5 kali dan mencatat ke `log.txt`; hitungan baru di-reset kalau halaman bertahan 30 dtk,
  atau lewat tombol "Muat ulang widget". Jangan menghapus batas ini (URL salah / offline tidak boleh membuat loop tanpa ujung). Mengubah / mengosongkan URL saat jendela terbuka ditangani `donSync` (dipanggil `hooks.global`).
- **Hide**: tombol perkecil Donate Dock langsung `hide()` (lewat `winCtl`, sama seperti Dashboard/Chat), BUKAN minimize lalu hide; tombol tutup menutup jendela. Tray / hotkey toggle: tutup kalau terlihat, tampilkan kalau tersembunyi, buka kalau belum ada.
- **Kirim Chat dimatikan** (`body.nosend`): hanya `#msg` dan `#send` yang disembunyikan; filter platform (`#flt`) dan gembok (`#lock`) tetap tampil (sebelumnya seluruh `#foot` hilang, sehingga gembok ikut hilang).
- **Pratinjau Pribadi**: `body.dock.preview` dan `#app`-nya tidak punya latar sendiri lagi (transparan; yang terlihat latar panel pratinjau). Akibatnya slider "Gelap latar jendela" tidak terlihat efeknya di pratinjau Pribadi (tetap berlaku di jendela chat asli).
- **Belum teruji**: seluruh perilaku Donate Dock di Windows (pemutaran video/suara media share, gembok di atas game, tembus-klik, perilaku protect, simpan posisi). `npm test` belum dijalankan setelah perubahan ini (sandbox tanpa internet, `npm install` tidak bisa); tes baru ada di `test/smoke.js`.

## 14. Auto-update, splash, dan klik tembus (v15.1.0)
- **Auto-update** = `electron-updater` + GitHub Releases. `checkUpdates()` di `main.js` jalan di splash (hanya `app.isPackaged`): `checkForUpdates()` (batas 10 dtk) -> kalau ada versi lebih baru `downloadUpdate()` (bar splash = persen unduhan, `window.updProgress`) -> `window.updInstall` -> `quitAndInstall(true,true)` (senyap, jalan lagi otomatis).
  Gagal apa pun hanya dicatat di `log.txt` (awalan `update:`) dan aplikasi lanjut. Installer NSIS bukan oneClick, per-user (tanpa UAC), jadi pemasangan senyap berjalan.
  Syarat: (1) repositori GitHub harus **Public** (aplikasi membaca `latest.yml` tanpa token; repo Private = 404 = tidak pernah ada update), (2) `version` di `package.json` harus naik tiap rilis, (3) Release harus berisi `latest.yml` dan `.blockmap` selain `.exe` (workflow sudah melampirkannya dan gagal kalau `dist/latest.yml` tidak ada),
  (4) `build.publish` di `package.json` memakai provider github tanpa owner/repo: electron-builder mengambilnya dari git remote saat build di GitHub Actions. Versi pertama yang punya auto-update harus dipasang manual; setelah itu update jalan sendiri.
  **Belum teruji** di Windows: seluruh alur (sandbox tanpa Electron/Windows). Kalau update tidak jalan, baca `log.txt`.
  `build/main.js` hanya disalin (bukan dibundel), jadi `electron-updater` harus tetap di `dependencies` supaya ikut terpasang di aplikasi.
- **Splash**: `splash.html` sekarang dikendalikan `main.js` (`toConnect`, `updProgress`, `updInstall`, `finish`), tidak lagi memakai timer sendiri. Teks "Checking for updates..." tampil minimal 1,9 dtk.
- **`appReady`** (`main.js`): false selama splash tampil. `showDash`, `openChat`, `setLock`, `donateAct`, hotkey `hide` semuanya berhenti kalau belum siap, jadi tray, hotkey, atau membuka aplikasi kedua kali TIDAK bisa memunculkan Dashboard/Chat/Donate Dock sebelum splash selesai.
  Urutan akhir: `finish()` -> 700 ms -> splash di-`destroy()` -> `appReady=true` -> `showDash()`. Jangan menampilkan jendela apa pun dari tempat lain tanpa cek `appReady`.
- **Klik tembus gelembung** (mode gembok + Sembunyikan dari OBS, jebakan 4): jendela tidak tembus-klik, jadi gelembung/kotak penonton menangkap klik. `holeTick` (30 ms) membuat lubang `HOLE`=3 px di `setShape` tepat di bawah kursor selama kursor ada di atas area gelembung (`carve`, juga untuk Donate Dock), sehingga klik jatuh ke game di belakang.
  Gambar kursor menutupi lubang. **Belum teruji di Windows**; kalau malah menimbulkan kedip/lag, set `HOLE=0` untuk mematikan (kembali ke perilaku lama). Klik yang terjadi sebelum lubang sempat pindah (kursor digerakkan sangat cepat) masih bisa tertangkap.

## 15. Versi tunggal, rilis manual, dan lubang klik (v15.1.1, v15.1.2)
- **Aturan versi (WAJIB, permintaan pengguna)**: setiap update, versi harus SAMA di semua tempat: nama zip (`chatstream-labs v<versi>.zip`), `package.json`, `package-lock.json` (2 tempat), `extension/manifest.json`,
  tulisan versi di sidebar aplikasi, nama installer, tag/nama rilis GitHub, dan pesan commit (`v<versi>`). Jangan menulis versi manual di kode/UI: sidebar memakai `{{VERSION}}` di `src/ui/body.html` yang diganti `scripts/build.js` dari `package.json`.
  Ganti versi HANYA lewat `node scripts/version.js set <versi>`; `scripts/version.js check` dipanggil `npm run build` dan workflow, dan berhenti kalau ada yang beda. (Sebelum v15.1.1 sidebar tertulis v15.0.1, lock v15.0.0, ekstensi 1.2, padahal aplikasi 15.1.0.)
  Judul bagian AGENTS.md dan PANDUAN-GITHUB.md menyebut versi saat fitur itu dibuat (sejarah), itu bukan versi saat ini.
- **Release manual (WAJIB, permintaan pengguna)**: push biasa ke `main` hanya membangun installer ke Actions > Artifacts. Langkah "Lampirkan ke Releases" hanya jalan untuk tag `v*` atau Run workflow dengan `release` dicentang.
  Jangan mengembalikannya jadi otomatis: Release memicu auto-update ke semua pengguna, dan pengguna ingin menguji dulu. Tag harus sama dengan `v<versi>` atau workflow berhenti.
- **Lubang klik-tembus (perbaikan v15.1.0)**: laporan pengguna: klik di belakang chat dock sudah tembus, tetapi ada titik dan kedip tiap kursor bergerak. Penyebab (dari membaca kode, belum diuji di Windows): lubang 7x7 px simetris di sekitar kursor (sebagian di luar badan panah kursor, jadi terlihat sebagai titik)
  dan `setShape` dipanggil tiap kursor pindah. Sekarang: `HOLE=2` px memanjang ke kanan-bawah dari titik kursor (tertutup panah), dan lubang tidak mengikuti kursor: selama kursor bergerak bentuk jendela tidak disentuh, lubang dibuat setelah kursor diam `HOLE_WAIT`=2 tick (`HOLE_MS`=25 ms),
  dan dihapus sekali begitu kursor mulai bergerak lagi (`holeCut`). `applyLockedInput(light)` / `applyDockInput(D,light)` dipanggil dari `holeTick` tanpa mengulang `setIgn`/`holeStart`.
  Akibat: klik yang datang kurang dari ±50-75 ms setelah kursor berhenti masih tertangkap gelembung. Di layar dengan skala Windows pecahan (125%/150%) lubang 2 px bisa meleset; kalau klik kadang tidak tembus, naikkan `HOLE` ke 3. `HOLE=0` mematikan seluruh fitur.
  **Belum teruji di Windows** (sandbox tanpa Electron); logika `holeTick` diuji dengan stub di Node.
- **Revisi v15.1.2 (lubang klik-tembus)**: gaya v15.1.1 (lubang dibuat hanya setelah kursor diam) menghilangkan kedip tetapi pengguna menolaknya: klik tembus hilang selama kursor digerakkan, padahal maunya "seolah-olah tidak ada apa-apa di situ".
  Sekarang lubang IKUT kursor terus (`HOLE_WAIT=0`, tick `HOLE_MS`=16 ms, `HOLE`=3 px ke kanan-bawah titik kursor). Kedip ditangani di sumbernya: dugaan kuat (dari perilaku `setIgnoreMouseEvents` di Windows, belum diuji) `setIgnoreMouseEvents(false)` mencabut `WS_EX_LAYERED` dan dulu dipanggil tiap tick.
  Karena itu `setIgn` (cache per jendela) hanya menyentuh jendela kalau nilainya berubah, dan `setShp(w,rs,skipSame)` melewati `setShape` yang bentuknya sama (cache per jendela, kunci JSON). SEMUA perubahan ignore/shape jendela chat dan Donate Dock harus lewat dua helper itu, jangan memanggil `setIgnoreMouseEvents`/`setShape` langsung (jendela alert tetap langsung, terpisah).
  `HOLE_WAIT=2` mengembalikan gaya v15.1.1 (tanpa kedip, tembus-klik hanya saat kursor diam). Batas yang tidak bisa dihilangkan selama "Sembunyikan dari OBS" aktif: jendela tidak boleh tembus-klik penuh, jadi lubang selalu tertinggal satu tick dari kursor; klik yang bersamaan dengan gerakan kursor sangat cepat bisa tertangkap gelembung, dan lubang kecil di ujung kursor bisa terlihat sedikit.
  Tembus-klik yang sempurna hanya didapat kalau "Sembunyikan dari OBS" dimatikan (jendela tembus-klik penuh). **Belum teruji di Windows.**


## 16. Kedip di kotak penonton + hemat CPU/RAM (v15.1.4)
- **Laporan**: mode gembok + Sembunyikan dari OBS, kursor digerakkan pelan di atas kotak (mis. "Total penonton") = kotak/ikon di belakangnya berkedip.
  Penyebab (dari kode, belum diuji di Windows): lubang 3 px dipindah tiap kursor bergeser 1 px (`setShape` terus-menerus) dan kursor sering sempat keluar dari lubang (ikon di belakang kehilangan hover);
  `applyLockedInput(false)` juga memanggil `setShape` yang sama tiap 1,5 dtk (`/shape` dari halaman) karena `skipSame` tidak aktif.
- **Perbaikan**: lubang `HOLE`=6 px dengan kursor `HOLE_BACK`=2 px dari sisi kiri/atas (`holeFor`); lubang hanya dipindah kalau kursor mendekati tepinya (histeresis). `setShp` selalu `skipSame=true`.
  Polling `holeTick` adaptif (`setTimeout`, bukan `setInterval 0`): `HOLE_MS`=8 ms saat kursor di atas jendela, `HOLE_IDLE_MS`=60 ms di luar. Halaman tidak mengirim `/shape` kalau daftar kotak tidak berubah.
- **Hemat**: `dockScan` 700 -> 1500 ms; polling halaman (`eyeW`, `eyeSt`, `acct`, `dashPoll`) dilewati saat `document.hidden` dan dijarangkan; heap JS dibatasi `--max-old-space-size=256`.
- Kalau lubang terasa terlihat/mengganggu turunkan `HOLE`; kalau klik kadang tidak tembus naikkan `HOLE`/`HOLE_BACK`. **Belum teruji di Windows.**

## 17. Titik (lubang klik-tembus) tertinggal dari kursor (v15.1.5)
- **Laporan**: titik di ujung kursor tidak secepat kursor (tertinggal saat digerakkan). Pengguna minta lubang diperbesar dan opacity-nya dibuat 0.
- **Penjelasan**: "titik" itu bukan elemen halaman, tetapi potongan pada bentuk jendela (`setShape`), jadi tidak punya opacity; yang terlihat adalah isi layar di belakang jendela. Tidak bisa dibuat transparan lewat CSS.
- **Perubahan**: `HOLE`=10, `HOLE_BACK`=4, konstanta baru `HOLE_EDGE`=2 (lubang dipindah saat kursor tinggal 2 px dari tepi, dulu 1 px). Hanya `src/main.js` yang berubah.
- **Kompromi**: lubang lebih besar = sisi kiri/atas kursor lebih mungkin terlihat. Kalau titik terasa mengganggu, turunkan `HOLE` ke 8. Satu-satunya cara tanpa titik sama sekali: matikan "Sembunyikan dari OBS" (jendela tembus-klik penuh).
- **Belum teruji di Windows** (sandbox tanpa Electron); hanya diperiksa sintaks dan versi (`node scripts/version.js check`).

## 18. Tanpa dot: mode gembok + Sembunyikan dari OBS tembus-klik penuh (v15.1.6)
- **Permintaan**: mode gembok + "Sembunyikan dari OBS" aktif harus berperilaku sama seperti keduanya tidak aktif: klik tembus ke belakang dock, tanpa dot/lubang di kursor.
- **Perubahan** (hanya `src/main.js`): konstanta `PROTECT_PASSTHRU=true` dan helper `useHole()` (= `protect && !PROTECT_PASSTHRU`). Semua tempat yang dulu bercabang pada `protect` untuk input (jendela chat `applyLockedInput`, Donate Dock `applyDockInput`, `dockScan`, `holeTick`, jendela alert hadiah) sekarang bercabang pada `useHole()`.
  Dengan `PROTECT_PASSTHRU=true`, jendela terkunci selalu `setShape` penuh + `setIgnoreMouseEvents(true)`, sementara `setContentProtection(protect)` tetap dipasang apa adanya. Lubang, `holeTick`, dan pemindaian area widget tidak jalan sama sekali.
- **Dasar**: jebakan 4 (proteksi tidak jalan di jendela layered) tidak terbukti; Electron justru menambahkan `WS_EX_LAYERED` saat proteksi dipasang (PR #47856).
- **BELUM DIUJI di Windows.** Risiko: kalau di Windows pengguna chat ternyata masih tertangkap OBS, set `PROTECT_PASSTHRU=false` untuk kembali ke cara lama (lubang + dot). Minta pengguna mengetes di OBS (Window Capture dan Display Capture) sebelum live.

## 19. Buka halaman chat otomatis (tab latar) + filter "Semua" hanya platform aktif (v15.1.7)
**Tugas 1 — tab chat dibuka otomatis.** Dulu kirim chat hanya jalan kalau pengguna membuka sendiri halaman live di Chrome (content script `yt.js`/`tt.js`/`tw.js`/`kk.js` tidak hidup tanpa halaman itu).
- **Ekstensi** (`extension/bg.js`, baru; manifest: `background.service_worker`, izin `tabs` + `alarms` selain `storage`, `minimum_chrome_version` 116). Service worker menyambung ke `ws://127.0.0.1:<port>/ext` dengan logika port yang sama seperti content script (port tersimpan, lalu 3000-3010), memperkenalkan diri `{type:'bg'}`.
  Dijaga hidup dengan ping `{type:'ping'}` tiap 20 dtk (server membalas `pong`; aktivitas WebSocket memperpanjang umur worker di Chrome 116+) dan `chrome.alarms` tiap 30 dtk yang membangunkan worker + menyambung ulang. Content script TIDAK diubah.
  Pesan `{type:'open',platform,url}`: `chrome.tabs.query` dulu; kalau tab halaman yang sama sudah ada (dicocokkan lewat `key()`: id video YT, @user TikTok, user Twitch/Kick) TIDAK dibuat tab baru; tab itu hanya di-`reload` (maks sekali per 20 dtk) karena content script-nya jelas tidak terhubung (tab di-discard, atau dibuka sebelum ekstensi dimuat ulang).
  Kalau belum ada: `chrome.tabs.create({url,active:false})` di jendela Chrome yang ada. Kalau Chrome jalan tanpa satu pun jendela: `chrome.windows.create({focused:false,state:'minimized'})` supaya fokus game tidak direbut. Hanya URL platform (youtube/tiktok/twitch/kick https) yang diterima.
- **Server** (`src/server.js`, bagian "jembatan ke ekstensi"): `extUrl(p)` (alamat yang DIBUKA, harus cocok dengan pola content script), `ensureExt(p)` (buka tab + tunggu), `autoOpen(p)`, dan `extSend` yang baru.
  Alamat: YouTube `https://www.youtube.com/live_chat?is_popout=1&v=<id>` dengan id dari `cfg.youtube` (kalau link video) atau `ytLive` (diisi konektor YouTube begitu tersambung, jadi cukup mengisi @handle; `ytLive` kini diisi SEBELUM `setStatus('terhubung')`);
  TikTok `https://www.tiktok.com/@<user>/live`; Kick `https://kick.com/<slug>`; Twitch memakai chat popout `https://www.twitch.tv/popout/<user>/chat?popout=` (bukan `twitch.tv/<user>` seperti usulan awal) karena ringan: tidak memuat video stream di tab latar (hemat bandwidth/CPU) dan tetap cocok dengan pola `twitch.tv/*`.
  Kapan dibuka: (a) `setStatus(k,'terhubung')` (+600 ms) dan 4 dtk setelah `/connect` (Hubungkan) untuk platform yang sudah terhubung; (b) `extSend` menemukan content script platform belum terhubung -> `ensureExt`: tunggu service worker maks 3 dtk (`BG_WAIT`), kirim `open` (jeda ulang `OPEN_COOLDOWN` 15 dtk per platform), tunggu content script maks 10 dtk (`OPEN_WAIT`), lalu kirim. Kalau tab baru dibuka dan kolom chat belum tampil ("tidak ditemukan"), coba SEKALI lagi setelah 2,5 dtk, baru menyerah. Panggilan bersamaan untuk platform yang sama berbagi satu proses (`opening[p]`).
  Buka-otomatis hanya jalan kalau `settings.global.autoOpen!==false` DAN `sendOn!==false` (kalau Kirim Chat mati, tab tidak perlu dibuka). `/open` dan `/urls` untuk tombol "Buka chat ..." / "Salin alamat ..." kini memakai `extUrl(p)||chatUrl(p)` supaya jalur manual (fallback tanpa saklar / Chrome bukan browser utama, lewat `shell.openExternal`) membuka halaman yang cocok untuk ekstensi.
- **UI**: saklar "Buka halaman chat otomatis di Chrome" (Dashboard > Koneksi, kartu Kirim Chat, default nyala, `POST /autoopen-set` -> `settings.global.autoOpen`). Teks langkah ekstensi diperbarui: muat ulang ekstensi sekali di `chrome://extensions` (izin baru), Chrome harus terbuka dan sudah login, tab boleh di-pin. Tidak ada fitur khusus untuk tab yang di-throttle/discard selain saran pin (sengaja tidak dibuat rumit).
- **Jebakan baru**: koneksi `bg` ada di himpunan `ext` yang sama dengan content script tetapi `platform:''` (jadi tidak ikut `/account` dan tidak pernah jadi target `send`). Jangan mengirim `send` ke koneksi `bg`. Pola `matches` di manifest dan `extUrl()` HARUS tetap sinkron; kalau menambah platform, ubah keduanya plus `key()` di `bg.js`.

**Tugas 2 — filter "Semua".** Dari kode, penyebab keluhan: (1) `doSend` memasukkan SEMUA platform yang dinyalakan sebagai target, jadi platform yang belum tersambung ikut dan menampilkan error; (2) `/send` memanggil `extSend` berurutan (`await` dalam loop), jadi satu platform bermasalah menahan yang lain sampai timeout 9 dtk. (Bukan bug logika status; `flash()` menampilkan error semua platform gagal digabung sehingga terasa "kirim Semua gagal" walau sebagian terkirim.)
- `app.js`: fungsi murni `sendTargets(filter,EN,status)`: "Semua" = dinyalakan DAN `stView(status[k])[1]==='Terhubung'`; satu platform = apa adanya (error eksplisit tetap). Kalau "Semua" tidak punya target: `flash('Belum ada platform yang tersambung.')` (kalau tak ada yang menyala, pesan lama). Kolom pesan dikosongkan kalau minimal satu berhasil (tetap).
- `server.js` `/send`: `Promise.all` (paralel), target dibersihkan (hanya platform dikenal, tanpa duplikat). Platform "Terhubung" tetapi ekstensinya belum terhubung memicu buka-tab-otomatis (Tugas 1) di dalam `extSend` sebelum dianggap gagal.
- Catatan: status "Terhubung" di aplikasi = konektor baca-chat (youtube-chat, dst.), bukan ekstensi. Kalau pengguna masih melihat error di "Semua", baca pesannya: itu error platform yang tersambung (ekstensi/slow mode/halaman belum siap).

**Tes** (`test/smoke.js`): `extTests` (klien WebSocket palsu "bg" + "cs": buka tab, alamat tiap platform, tidak buka ulang bila sudah terhubung, paralel, saklar mati, tanpa service worker, ping/pong) dan tes UI `sendTargets`/`doSend`. Tes Donate Dock lama (`/donate-set`, `dnUrl`) sudah usang sejak multi-dock dan membuat `npm test` v15.1.6 gagal; diperbarui ke `/donate-docks` dan dialog `dnm*`.
**BELUM DIUJI**: Chrome asli (service worker benar-benar bertahan hidup, `tabs.create` latar tidak merebut fokus, tab latar tidak di-throttle/discard sampai content script mati, jendela minimized saat Chrome tanpa jendela), halaman live YouTube/TikTok/Twitch/Kick asli (kolom chat sempat belum tampil saat content script terhubung), Windows, dan pemicu `setStatus('terhubung')` -> `autoOpen` (butuh live sungguhan; hanya jalur `extSend` yang diuji dengan mock). Pengguna harus memuat ulang ekstensi di `chrome://extensions` dulu.

## 20. Kirim chat instan + ekstensi memperbarui dirinya (v15.2.0)
Rencana berikutnya (JANGAN dikerjakan di v15.2.0): **login resmi Twitch/Kick**, sesi terpisah. (Koreksi: dipecah dua. Twitch dikerjakan di v15.2.1, lihat bagian 21; Kick belum.) Protokol `'ver'` (di bawah) sudah tersedia untuk dipakai sesi itu.

**Pekerjaan A — kirim terasa instan**
- `src/ui/app.js` `doSend`: kolom pesan dikosongkan LANGSUNG saat Enter (optimistis). Semua target gagal (atau request gagal/jaringan putus) -> teks dikembalikan + `flash` error seperti dulu; minimal satu berhasil -> tetap kosong (error platform yang gagal tetap tampil lewat `flash`). Filter "Semua" (`sendTargets`) dan pesan flash v15.1.7 tidak berubah (tanpa target tidak ada POST dan teks tidak dikosongkan).
  Tombol kirim TIDAK lagi dikunci selama request (dulu `disabled`), jadi beberapa pesan beruntun boleh berjalan bersamaan. Kalau kegagalan datang saat kolom sudah berisi pesan baru, teks yang gagal ditaruh DI DEPAN pesan baru (`gagal + ' ' + baru`), tidak menimpa.
- Content script `yt.js/tt.js/tw.js/kk.js` (pemilih elemen TIDAK diubah): jeda tetap (300-350 ms sebelum klik, 700-900 ms sesudahnya) diganti `waitFor(fn,max)`: cek sekarang juga, lalu tiap perubahan DOM (`MutationObserver`) dan tiap 50 ms, selesai begitu kondisi benar; `max` = jeda lama (pengaman).
  Sebelum klik: tunggu tombol kirim ada dan tidak `disabled` (maks 350/300 ms; kalau tombol tidak pernah ada tetap jatuh ke cara lama: kirim tombol Enter). Sesudah klik: tunggu kolom kosong (yt/tt: `trim()===''`; tw/kk: teks tidak lagi ada di kolom). Hanya MEMBACA halaman, klik tetap tepat satu kali.
  Tambahan: kalau setelah mengisi kolom ternyata kosong (insertText gagal) langsung error "teks tidak bisa dimasukkan ..." dan tidak mengklik. Dulu itu dilaporkan "ok" (palsu); sekarang itu berbahaya karena kolom di dock sudah dikosongkan optimistis.
- **Kenapa `MutationObserver`, bukan hanya polling 50 ms**: dugaan (dari pengetahuan Chrome, BELUM diukur) tab latar (`active:false`, cara v15.1.7 membuka tab) membatasi `setTimeout/setInterval` sekitar 1x per detik. Kalau benar, polling saja malah tidak mempercepat di tab latar, sedangkan callback `MutationObserver` tidak ikut dibatasi. Kalau terukur kirim ke tab latar tetap lambat, itu penyebabnya; tab yang di-pin tidak menjamin lolos dari pembatasan itu.
- **Risiko yang sengaja diterima**: (1) klik lebih cepat daripada jeda 300-350 ms lama. Untuk YT/Twitch/Kick/TikTok tombol dianggap siap kalau tidak `disabled`; kalau suatu situs menandai tombol aktif sebelum state internal siap, pesan bisa kosong/tidak terkirim. Cadangan: kembalikan jeda kecil sebelum klik. (2) Kalau kolom baru kosong SETELAH batas pengaman (slow mode, jaringan lambat) hasilnya "tidak terkirim" dan teks kembali ke kolom padahal pesan akhirnya terkirim; kalau pengguna kirim ulang jadi ganda. Sama seperti sebelumnya, tapi sekarang lebih terlihat karena teks kembali. (3) Kapan pesan tampil di dock tetap tergantung konektor baca-chat platform (di luar tugas ini).

**Pekerjaan B — ekstensi memperbarui dirinya (tanpa Chrome Web Store)**
- **Folder tetap**: `main.js` `syncExtension()` (dipanggil sebelum server dimuat) menyalin `extension/` aplikasi ke `<userData>/extension` (Windows: `%APPDATA%/ChatStream Labs/extension`) lewat `src/extsync.js` `syncDir`: hanya berkas yang ISINYA beda ditulis (bukan hanya cek versi: di mode dev isi bisa berubah tanpa naik versi), tulis `.tmp` lalu rename, `manifest.json` paling akhir, berkas usang dihapus. Gagal -> dicatat di `log.txt` (awalan `ekstensi:`), `extOk=false`.
  Tombol "Buka folder ekstensi" (`hooks.open('ext')`) membuka folder tetap (kalau penyalinan gagal: folder bawaan aplikasi). Teks petunjuk di `body.html` diperbarui (jangan dipindah/dihapus; kalau sudah memasang dari folder lain, hapus yang lama).
- **Protokol `'ver'`**: setelah `{type:'bg'}`, server mengirim `{type:'ver',version}` ke koneksi bg itu saja (bukan content script). Versi dari `hooks.appVersion()` (diisi `main.js`: `app.getVersion()` = `package.json`; KOSONG kalau `extOk=false`, jadi ekstensi tidak diminta memuat ulang dari folder yang tidak diperbarui). `CG_VERSION` (env) hanya cadangan untuk menjalankan `build/server.js` sendirian di tes; `main.js` tidak memakainya.
  `bg.js` `handleVer`: versi tidak valid -> abaikan; sama dengan `chrome.runtime.getManifest().version` -> diam; beda -> simpan `reloadedFor=<versi aplikasi>` + `lastReload={at,from,to,reason}` di `chrome.storage.local`, LALU `chrome.runtime.reload()`. Penanda untuk versi itu sudah ada -> TIDAK reload lagi (mencegah loop kalau ekstensi dipasang dari folder lain); penanda gagal disimpan -> tidak reload. Alasan juga ke `console.info` service worker (chrome://extensions -> service worker -> Inspect).
- **Kompatibilitas mundur**: ekstensi lama (<= 15.1.7) hanya bereaksi pada `type==='open'`, jadi `ver` diabaikan; aplikasi lama tidak mengirim `ver` sehingga ekstensi baru diam. Tidak ada pesan lama yang diubah.
- **Perbaikan atas rancangan awal (alasan)**: rencana "tab chat lama ditangani jalur reload tab di bg.js" tidak cukup. Sesudah `chrome.runtime.reload()` content script lama di tab yang sudah terbuka tidak dihentikan: ia jadi yatim tetapi koneksi WebSocket-nya MASIH hidup (dugaan dari perilaku Chrome, belum diuji), sehingga server menganggap `hasExt(p)` benar, tidak pernah mengirim `open`, dan jalur "tab ada tapi tidak terhubung -> reload" tidak jalan; tab itu terus memakai skrip lama. Karena itu `bg.js` `onInstalled` dengan `reason==='update'` menjalankan `refreshTabs()`: memuat ulang tab chat di LATAR (`youtube.com/live_chat*`, `tiktok.com/*/live*`, `twitch.tv/popout/*`, `kick.com/*`); tab yang sedang aktif dilewati (tidak mengganggu pengguna; tab itu tetap bisa mengirim dengan skrip lama sampai dimuat ulang manual).
- **Jebakan baru**: (1) `extsync.js` harus ikut dibawa ke `build/` (`scripts/build.js` menyalinnya); `build/main.js` hanya disalin, bukan dibundel. (2) JANGAN menambah izin di `manifest.json` pada versi yang diharapkan memperbarui diri tanpa menguji dulu (lihat bawah); tes `izin ekstensi tidak bertambah` sengaja menjaga ini (`storage`, `tabs`, `alarms`). Kalau suatu saat harus menambah izin, ubah tesnya SADAR dan beri tahu pengguna. (3) Pengguna yang masih memuat ekstensi dari folder lama (instalasi aplikasi atau `extension/` proyek) tidak ikut terpasang ulang otomatis; mereka harus memasang dari folder tetap SEKALI (versi <= 15.1.7 tidak punya `ver`). Dua ekstensi sama aktif sekaligus tidak merusak (server memakai satu content script per platform), tapi sebaiknya yang lama dihapus. (4) Reload ekstensi memutus pengiriman yang sedang berjalan di detik itu; terjadi hanya saat versi baru pertama kali tersambung.
- **BELUM DIKETAHUI (tidak bisa diuji di sandbox, jangan dianggap beres)**: apakah Chrome memuat ulang ekstensi unpacked yang MENAMBAH izin tanpa konfirmasi pengguna. Untuk packed extension izin baru membuat ekstensi dinonaktifkan sampai pengguna menyetujui; untuk unpacked kami tidak tahu. v15.2.0 sengaja tidak menambah izin, jadi ini baru menjadi persoalan di versi yang menambah izin. Cara menguji: pasang 15.2.0 dari folder tetap, ganti `manifest.json` di folder itu dengan versi yang menambah satu izin, mulai ulang aplikasi, dan lihat apakah ekstensi aktif lagi atau muncul tombol "Aktifkan/Setujui" di chrome://extensions.

**Tes** (`test/smoke.js`): `extTests` ditambah pemeriksaan pesan `ver` (ke bg saja); fungsi baru `extensionTests` (tanpa Chrome asli): `extsync` (urutan manifest, tidak menulis kalau sama, berkas usang dihapus, sumber tanpa manifest), `bg.js` di `vm` dengan `chrome.*` palsu (tanpa reload bila sama, sekali per versi, tidak loop, penanda gagal tersimpan, input sampah, `refreshTabs`), dan keempat content script di `vm` dengan DOM palsu (hasil segera, menunggu tombol aktif, batas pengaman, tepat satu klik, insert gagal). Tes UI jsdom baru untuk `doSend` optimistis ada di `uiTests`.
**Pemeriksaan di sandbox ini**: jsdom tidak ada dan `npm install` tidak bisa memasang paket dengan benar, jadi `npm test` penuh TIDAK bisa dijalankan; yang dijalankan: seluruh tes non-UI (parser, server, ekstensi, `extensionTests`) lulus, dan pernyataan UI `doSend` yang sama diulang di Chromium (Playwright) lulus; `yt.js` juga diuji sekali di DOM Chromium sungguhan (contenteditable + `execCommand`). Tes `uiTests` versi jsdom (termasuk blok baru) belum pernah dijalankan; jalankan `npm install && npm test` di mesin dengan jaringan.
**BELUM DIUJI sama sekali**: Chrome asli (`chrome.runtime.reload()` pada ekstensi unpacked, `onInstalled` + `refreshTabs`, service worker bertahan hidup, pembatasan timer tab latar), halaman live asli YouTube/TikTok/Twitch/Kick (pemilih kolom tetap tebakan; kecepatan sebenarnya), Windows (`%APPDATA%`, `shell.openPath`, auto-update lalu penyalinan folder), dan `main.js` (Electron tidak jalan di sandbox; hanya diperiksa sintaks, logika salinan diuji lewat `extsync.js`).

## 21. Login resmi Twitch (v15.2.1); Kick BELUM
**Pekerjaan dibagi dua sesi.** Sesi ini (v15.2.1) = fondasi bersama + Twitch. **SISA PEKERJAAN: login Kick** (Tahap 0 SUDAH dikerjakan di sesi C2: ada penghalang (secret wajib) dan pemilik memilih menunda, Kick tetap lewat ekstensi. Lihat "TAHAP 0 KICK — HASIL" di bawah. Isi aslinya: Tahap 0 wajib dulu: baca docs.kick.com; cek apakah client secret wajib (kalau ya JANGAN menanam secret di repo, tanyakan pemilik), apakah redirect `http://localhost:<port>` boleh padahal port aplikasi bisa diubah pengguna, dan batas laju pesan). Jalur ekstensi (bagian 19-20) tetap sebagai CADANGAN dan tidak dihapus.
Catatan versi: pemilik meminta nomor **15.2.1** (bukan 15.3.0 seperti rencana awal). Versi tetap hanya diubah lewat `node scripts/version.js set`.
Catatan sesi C2 (7 Nov 2026): pemilik menyebut zip terlampir sebagai "v15.3.0", tetapi berkasnya `chatstream-labs_v15_2_1.zip` dan `package.json` = **15.2.1**. Versi TIDAK diubah di sesi itu (`node scripts/version.js check` = 15.2.1). Kalau pemilik memang ingin 15.3.0, jalankan `node scripts/version.js set 15.3.0` secara sadar.

**TAHAP 0 KICK — HASIL (sesi C2, 7 Nov 2026): ADA PENGHALANG, KICK TIDAK DIBANGUN.**
**KEPUTUSAN PEMILIK (7 Nov 2026): opsi (D). Kick tetap lewat ekstensi Chrome; login resmi Kick DITUNDA.** Kirim ke Kick = `extension/kk.js` (jalur bagian 19-20, apa adanya); baca chat = WebSocket Pusher dan jumlah penonton dipoll tiap 30 dtk di `server.js` (`startKK`/`pollKK`), keduanya tanpa login. Jangan membangun login Kick kecuali pemilik membukanya lagi; kalau dibuka, pilihan (A)/(B) di bawah dan temuan 1-3 tetap berlaku. Satu-satunya perubahan di sesi C2 selain catatan ini: komentar `KICK_CLIENT_ID` di `src/oauth-config.js`.
Tidak ada kode Kick yang ditulis; `KICK_CLIENT_ID` tetap placeholder; satu-satunya perubahan proyek di sesi itu adalah catatan ini.
- **Sumber dan batasnya**: `docs.kick.com` menolak akses otomatis (robots), jadi dokumen dibaca lewat repositori resmi Kick `github.com/KickEngineering/KickDevDocs` (`getting-started/generating-tokens-oauth2-flow.md` dan `getting-started/kick-apps-setup.md`; isinya sama dengan situs docs). Halaman Chat API resmi dan halaman batas laju TIDAK terbaca langsung: untuk keduanya hanya ada sumber pihak ketiga (ditandai [3P]) dan issue di repo dokumen. Cocokkan ulang dengan docs.kick.com sebelum membangun.
1. **Client secret WAJIB (PENGHALANG).** Endpoint token `POST https://id.kick.com/oauth/token` mencantumkan `client_secret` sebagai Required: Yes untuk grant `authorization_code` DAN `refresh_token` (PKCE `code_verifier` hanya tambahan, bukan pengganti secret). Membuat app di kick.com/settings/developer (wajib 2FA) menghasilkan ClientID + ClientSecret + satu redirect URL. Tidak ada mode public client / device code seperti Twitch, jadi fondasi tanpa-secret di bagian ini tidak cukup. Secret TIDAK boleh ditanam di repo (aturan pemilik), dan aplikasi desktop yang dibagikan tidak bisa menyimpan rahasia (isi installer bisa dibongkar).
2. **Redirect `http://localhost`**: dokumen menganjurkan `localhost` (contoh `http://localhost/auth/callback`) untuk aplikasi lokal; `127.0.0.1` kena bug NextJS (perlu parameter pengecoh `redirect=127.0.0.1` sebelum `redirect_uri`). Redirect harus SAMA PERSIS dengan yang didaftarkan di app. TIDAK terdokumentasi: apakah port bebas atau dicocokkan longgar. Panduan [3P] mendaftarkan `http://localhost:3000/...` dan `http://localhost:17890/...` (jadi URL berport tampaknya boleh bila didaftarkan persis), dan satu penulis [3P] mendaftarkan beberapa redirect sekaligus, tetapi dokumen resmi menyebut satu "redirectURL specified by you". Karena port aplikasi bisa diubah pengguna (bagian 6), callback harus di port TETAP yang terpisah dari port aplikasi (pendengar sementara sekali pakai, tangani port bentrok), atau pengguna mendaftarkan redirect sesuai port mereka sendiri.
3. **Batas laju kirim chat: angka resmi TIDAK ditemukan.** Yang ketemu hanya `content` maks 500 grapheme / 2048 byte [3P, Nov 2026] (batas 190 karakter `/send` lebih ketat, aman). Jangan menebak angka; kalau dibangun, perlakukan 429 sebagai kegagalan pasti (hormati `Retry-After` bila ada) -> jatuh ke ekstensi, tanpa mengulang otomatis.
- **Rincian lain** (untuk sesi berikutnya): authorize `GET https://id.kick.com/oauth/authorize` (`client_id`, `response_type=code`, `redirect_uri`, `state` [wajib "at the moment"], `scope`, `code_challenge`, `code_challenge_method=S256`); token memakai body form-urlencoded dan menjawab `{access_token, token_type, refresh_token, expires_in, scope}`; refresh token BERPUTAR [3P] (sama seperti jebakan 1 Twitch: simpan yang baru sebelum dipakai, satu refresh pada satu waktu); revoke `POST /oauth/revoke?token=&token_hint_type=`; kirim chat `POST https://api.kick.com/public/v1/chat` `{type:'user', content, broadcaster_user_id}` dengan scope `chat:write` (`type:'bot'` bukan jalur kita; issue #343 melapor 500). Mencari `broadcaster_user_id` dari slug lewat API publik (`GET /public/v1/channels?slug=`) kemungkinan butuh scope `channel:read` atau app token (yang juga butuh secret): BELUM terverifikasi, padahal permintaan awal hanya menyebut `chat:write`. Issue #281 (±1 tahun lalu) melaporkan `POST /public/v1/chat` diblokir Cloudflare (403) dari klien non-browser: tidak diketahui apakah sudah beres; harus diuji di live asli.
- **Pilihan untuk pemilik (belum diputuskan)**: (A) tiap streamer mendaftarkan app Kick sendiri dan menempel Client ID + Secret di Dashboard (secret terenkripsi lewat `tokenstore`/safeStorage, tidak di `config.json`/`log.txt`/repo): jujur dan aman, tetapi langkahnya banyak dan bertentangan dengan "pengaturan sesederhana mungkin"; (B) satu app milik pemilik + layanan kecil di server (mis. Cloudflare Worker) yang menyimpan secret dan hanya menukar/menyegarkan token: pengguna cukup klik Masuk, tetapi butuh hosting dan layanan harus dijaga; (C) menyuntik secret saat build (GitHub Actions secret): tidak ada di repo, tetapi tetap bisa diambil dari installer sehingga secret praktis publik: TIDAK disarankan; (D) Kick tetap lewat ekstensi Chrome saja (tanpa login resmi). Apa pun pilihannya, jalur ekstensi tetap CADANGAN. Kalau (A): `src/kick.js` murni seperti `twitch.js`, didaftarkan di `OFF.kick`, token dan secret di `tokenstore` kunci `kick`; pendaftaran (dari dokumen setup): aktifkan 2FA di akun Kick -> Settings > Developer -> Create app -> isi redirect URL -> salin Client ID dan Client Secret.

**Perubahan**
- `src/twitch.js` (murni, bisa diuji dengan mock): Device Code Grant (`POST id.twitch.tv/oauth2/device` dengan `client_id`+`scopes=user:write:chat`, tanpa client secret) -> tampilkan `user_code`, buka `verification_uri` -> polling `oauth2/token` (`400 authorization_pending` = tunggu, `slow_down` = jeda +5 dtk, selain itu berhenti dengan pesan) -> simpan access+refresh. Nama akun dan `sender_id` dari Helix Get Users (tanpa parameter); `broadcaster_id` dari Get Users `?login=` (dicache di memori). Kirim = `POST api.twitch.tv/helix/chat/messages` `{broadcaster_id,sender_id,message}` dengan header `Authorization: Bearer` + `Client-Id`; sukses kalau `data[0].is_sent`.
- Refresh otomatis: dijalankan kalau access tinggal <60 dtk atau Helix menjawab 401 (sekali, lalu kirim diulang). Refresh token Twitch SEKALI PAKAI, jadi hasil refresh langsung disimpan sebelum dipakai, dan hanya satu refresh berjalan pada satu waktu (dua kirim bersamaan tidak boleh sama-sama memakai refresh token lama). Refresh ditolak (400/401: dicabut / 30 hari tanpa pemakaian) -> dianggap keluar, token dibuang, UI berkata "Sesi Twitch habis. Tekan Masuk lagi ya."
- `src/tokenstore.js`: satu berkas `auth.dat` di folder data ({platform: base64 terenkripsi}), dibuat generik untuk Kick nanti. Server tidak mengimpor electron: `main.js` menambah hooks `cryptOk/encrypt/decrypt` (Electron `safeStorage`; di Linux backend `basic_text` dianggap TIDAK tersedia). Kalau enkripsi tidak tersedia, token TIDAK ditulis ke disk sama sekali: login hanya hidup di memori sampai aplikasi ditutup dan UI memberi tahu (`memOnly`). Token tidak ada di `config.json`/`settings.json`/`log.txt`, dan tidak pernah dikirim ke UI (`/auth-state` hanya memuat `{configured,loggedIn,name,pending:{code},error,memOnly}`). `log.txt` hanya menerima kalimat seperti "twitch: masuk" (awalan `twitch:`).
- `src/oauth-config.js`: `TWITCH_CLIENT_ID` dan `KICK_CLIENT_ID` berisi placeholder `ISI_..._DI_SINI`. Selama berawalan `ISI_` (atau kosong), tombol Masuk menjawab "Client ID belum diisi oleh pembuatnya" dan tidak ada permintaan jaringan. Client ID bukan rahasia, tapi JANGAN pernah menaruh client secret di sini. Env `CG_TWITCH_CLIENT_ID`, `CG_TWITCH_OAUTH`, `CG_TWITCH_API` hanya untuk tes (alamat/ID palsu).
- `src/server.js` (bagian paling bawah): registri `OFF` = `{state(),login(),logout(),send()}` per platform (Kick tinggal mendaftar di sini), endpoint `GET /auth-state`, `POST /auth-login`, `POST /auth-logout`, dan `sendVia(platform,teks)` yang dipanggil `/send` (tetap `Promise.all`, paralel). Urutan: resmi dulu kalau sudah masuk dan username Twitch terisi; belum masuk/gagal -> `extSend` seperti v15.2.0. Hasil per platform tetap `'ok'` atau teks error. Kalau resmi DAN ekstensi sama-sama gagal, pesannya memuat keduanya ("... (cadangan lewat Chrome juga gagal: ...)") supaya alasan asli (mis. akun diblokir) tidak tertutup "ekstensi belum terhubung".
- UI Dashboard > Koneksi (`body.html` `#au_twitch`, `app.js` `auRender/authRefresh`): "Masuk sebagai <nama>" + Keluar / "Masuk dengan Twitch" / kode + Batal. Status diambil dari `/auth-state` (tiap 5 dtk, tiap 1,5 dtk selama menunggu persetujuan). Nama dirender sebagai teks (bukan HTML). Tidak ada notifikasi baru. Baris login hanya ada untuk platform yang punya penyedia di server (Kick belum).
- Tidak berubah: `doSend` optimistis, `sendTargets` (filter "Semua"), ekstensi `extension/*`, `PROTECT_PASSTHRU`.

**Keputusan yang perlu diketahui (alasan)**
- Timeout permintaan Helix (8 dtk) TIDAK jatuh ke ekstensi: tidak diketahui apakah pesan sampai, dan mengirim ulang lewat Chrome bisa membuat pesan dobel. Hasilnya error "Twitch tidak merespons". Kegagalan pasti (HTTP error, `is_sent:false`, jaringan putus sebelum terkirim, belum masuk, sesi habis) jatuh ke ekstensi sesuai permintaan. Konsekuensi yang diterima: pesan yang ditolak Twitch karena aturan kanal (mis. followers-only, pesan duplikat) akan dicoba lagi lewat Chrome dan kemungkinan ditolak juga.
- Hanya halaman `https://*.twitch.tv/` yang dibuka otomatis dari `verification_uri` (alamat itu datang dari jaringan).
- Yang dikirim tetap dipotong 190 karakter oleh `/send` (batas lama); batas Helix lebih besar, tidak diubah.

**Jebakan baru**
1. Refresh token sekali pakai: jangan menulis ulang `refresh()` tanpa menyimpan token baru SEBELUM dipakai, dan jangan membuat dua refresh paralel (akan mencabut sesi sendiri).
2. Aplikasi Twitch HARUS didaftarkan sebagai **Client Type: Public** (device code tanpa secret). Kalau salah tipe, dugaan kami Twitch menolak permintaan device (belum diuji); UI lalu menampilkan pesan yang menyebut tipe Public.
3. Token disimpan di memori proses server (`mem` di `tokenstore.js`) selama aplikasi jalan; `Keluar` menghapus keduanya (memori + disk) dan mencoba mencabut token di Twitch (best-effort).
4. Mengganti Windows user/profil membuat `decrypt` gagal: dianggap belum masuk (pengguna masuk lagi), bukan error.
5. `scopes` hanya `user:write:chat`. Membaca chat/follow lewat EventSub (rencana berikutnya) butuh scope tambahan dan pengguna harus masuk ulang.

**Langkah pemilik: mendaftarkan Client ID Twitch** (dari pengetahuan, belum dicocokkan dengan halaman console terbaru)
1. Masuk ke https://dev.twitch.tv/console dengan akun Twitch (akun harus mengaktifkan 2FA).
2. Applications > Register Your Application. Name: unik (mis. "ChatStream Labs <namamu>"). OAuth Redirect URLs: `http://localhost` (kolom wajib diisi walau device code tidak memakainya). Category: Chat Bot atau Application Integration. **Client Type: Public.**
3. Create, lalu salin **Client ID** ke `TWITCH_CLIENT_ID` di `src/oauth-config.js`. Jangan membuat/memakai Client Secret. Build ulang dan rilis.
4. Kalau aplikasi dipakai banyak streamer, cek aturan/pembatasan jumlah pengguna Twitch Developer yang berlaku.

**Tes** (`test/smoke.js`): `twitchTests` (mock fetch: tanpa Client ID, device code, authorization_pending, token terenkripsi dan terbaca ulang, kirim sukses/`is_sent:false`/HTTP error/jaringan/timeout, 401 lalu refresh, refresh sekali pakai, refresh proaktif + satu proses, refresh ditolak, username kosong, Keluar+revoke, ditolak/kedaluwarsa/alamat asing, safeStorage tidak tersedia); `officialTests` (server sungguhan + Twitch palsu + klien WebSocket ekstensi palsu: jatuh ke ekstensi, jalur resmi, paralel dengan Kick, resmi gagal -> ekstensi, keduanya gagal, token tidak bocor ke berkas/log, keluar); tes UI jsdom baris login di `uiTests`.
**Pemeriksaan di sandbox ini**: `npm install` tidak bisa (tanpa jaringan). Dipakai symlink `esbuild` dan `ws` dari `/opt/npm-tools`, stub `youtube-chat` dan `tiktok-live-connector`. jsdom tidak ada, jadi `npm test` penuh TIDAK dijalankan: seluruh tes non-UI lulus lewat penjalan sementara yang melewati `uiTests`; tes UI jsdom baru (dan tes `uiTests` lama) TIDAK dijalankan. Gantinya, uji UI end-to-end di Chromium (Playwright) terhadap `build/server.js` dengan Twitch palsu: klik Masuk -> kode tampil -> login selesai -> Keluar, dan pesan tanpa Client ID; tanpa error JavaScript di halaman.
**BELUM DIUJI sama sekali**: Twitch asli (endpoint, bentuk respons, perilaku `is_sent`/`drop_reason`, apakah `verification_uri` sudah memuat kode, batas laju kirim, pendaftaran Client ID Public), `safeStorage` di Windows (`main.js` hanya diperiksa sintaksnya; Electron tidak jalan di sandbox), `shell.openExternal` untuk halaman verifikasi, pemulihan sesudah komputer tidur lama/ganti jaringan, dan seluruh perilaku Chrome/Windows/platform asli lainnya. Pengguna perlu: isi Client ID, build, masuk, kirim chat ke kanal sungguhan, lalu coba Keluar, mulai ulang aplikasi (cek tetap masuk), dan matikan internet saat kirim (cek jatuh ke ekstensi). Kalau ada masalah, minta `log.txt` (awalan `twitch:`).

**Pemeriksaan sesi C2 (7 Nov 2026, tanpa perubahan kode fungsi)**: `node scripts/version.js check` = 15.2.1. `npm install` tidak bisa dipakai di sandbox (jaringan putus; `npm error Exit handler never called`, hasilnya paket setengah terpasang, mis. `jsdom` dan `youtube-chat` kosong). Dipakai cara lama: symlink `esbuild` dan `ws` dari `/opt/npm-tools`, stub `youtube-chat` dan `tiktok-live-connector`. `node scripts/build.js` berhasil dan seluruh tes non-UI lulus lewat penjalan sementara (parser, Twitch, `officialTests`, server, `extTests`, `extensionTests` termasuk `kk.js`). `uiTests` (jsdom) TIDAK dijalankan karena jsdom tidak tersedia: jalankan `npm install && npm test` di mesin dengan jaringan. TIDAK teruji: Chrome asli, Windows, Kick live asli (pemilih kolom chat di `kk.js` masih tebakan; Cloudflare bisa memblokir `kick.com/api/v2/channels/<slug>` untuk jalur baca).

## 22. Rapikan Koneksi (v15.3.0)
- **Permintaan**: (1) kartu "Sambungkan live" jadi 2 kolom, status tiap platform sebaris dengan kotak username; (2) langkah "Kirim Chat" lebih singkat dan mudah; (3) "Buka folder ekstensi" membuka folder `...\ChatStream Labs\resources`, bukan folder ekstensinya.
- **Sambungkan live**: empat `.cn` dibungkus `.cng` (grid 2 kolom; 1 kolom di jendela <=760 px). Input + status dibungkus `.cnr` (flex, `flex-wrap`): status di kanan kotak username, turun ke bawah kalau kartu terlalu sempit. Id tidak berubah (`yt`, `tk`, `twu`, `kku`, `st_<platform>`), jadi `showSt`/`syncPlats` tetap bekerja. Teks status (`stView`) tidak diubah.
- **Kirim Chat**: tiga langkah satu kalimat (Buka folder, Pasang di Chrome, Selesai). Tombol "Buka chat ..."/"Salin alamat ..." dipindah ke `<details>` "Buka halaman chat manual" (id tombol sama, `data-pf` tetap dipakai `syncPlats` untuk menyembunyikan platform yang mati). Jangan memanjangkan teks langkah lagi: pengguna menilai versi lama terlalu rumit.
- **Folder**: `hooks.open('ext')` di `main.js` = `path.dirname(extSrc())`. Terpasang: `process.resourcesPath` (`<folder aplikasi>\resources`, berisi `extension` dari `extraResources`). Mode dev: folder proyek (berisi `extension/`). Teks langkah menyuruh memilih folder `extension` di dalamnya.
- **Yang TIDAK diubah (sengaja)**: `syncExtension()` tetap menyalin ke `<userData>/extension` dan `appVersion()` tetap kosong bila penyalinan gagal. Pengguna lama yang sudah memasang dari folder userData tetap jalan. Pengguna baru memasang dari `resources\extension`, yang diperbarui installer saat aplikasi di-update; pesan `ver` lalu membuat ekstensi memuat ulang dirinya dan membaca berkas baru di folder itu. Kalau suatu saat folder userData dibuang, ubah juga `appVersion()` (sekarang bergantung pada `extOk`).
- **BELUM DIUJI**: tampilan di Electron/Windows asli (hanya build + tes asap di Linux), lebar kartu 2 kolom dengan status panjang di berbagai ukuran jendela, `shell.openPath(resourcesPath)` di instalasi sungguhan, dan apakah Chrome memuat ulang ekstensi dari `resources\extension` sesudah installer menimpa berkasnya.

## 23. Tab chat harus milik username yang diisi (perubahan kecil, versi TIDAK dinaikkan)
- **Masalah**: `hello` dari content script hanya membawa `platform`, jadi `hasExt(p)`/`extSendRaw` memakai tab APA PUN di platform itu. `manifest.json` mencocokkan `twitch.tv/*` dan `kick.com/*`, jadi tab channel LAIN yang sedang dibuka pengguna ikut terhubung dan pesan bisa terkirim ke channel yang salah.
- **Perubahan**: keempat content script (`yt/tt/tw/kk.js`) mengirim `{type:'hello',platform,page:location.href}`. `src/server.js`: `pageKey()` (logikanya SAMA dengan `key()` di `extension/bg.js`: jangan diubah salah satu saja), `wantKey(p)` = kunci dari `extUrl(p)`, `okConn`, `hasExt` (kini hanya menghitung tab yang cocok), `wrongTab(p)` (pesan error jelas), dan `/account` memakai `hasExt` sehingga status \"terhubung\" hanya benar untuk tab yang benar. Halaman yang benar diminta dibuka lewat jalur `open` yang sudah ada (`bg.js` tidak berubah).
- **Kompatibilitas**: koneksi tanpa `page` (ekstensi lama) tetap diterima seperti dulu; alamat belum diketahui (mis. YouTube belum tersambung) juga tidak diblokir. `manifest.json` TIDAK diubah (izin tetap `storage`, `tabs`, `alarms`).
- **Yang TIDAK dilakukan (sengaja)**: membaca NAMA AKUN yang login di halaman platform (untuk memastikan akun Chrome = username). Itu bergantung pada DOM tiap platform dan belum bisa diuji tanpa platform asli. Yang dicocokkan hanya channel/video tujuan.
- **Tes**: `extTests` (blok v15.3.1: tab channel lain tidak dipakai + status, halaman benar diminta dibuka, huruf besar/kecil, dua tab terbuka, YouTube lewat ID video) dan `extensionTests` (hello membawa `page`). Sandbox: tes non-UI lulus (123 pemeriksaan); `uiTests` (jsdom) TIDAK dijalankan. Chrome/platform asli belum diuji.
