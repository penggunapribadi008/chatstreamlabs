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
| `extension/` | ekstensi Chrome MV3 (pengirim chat) |
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

## 18. Lubang berbentuk anak tangga di bawah panah kursor (v15.1.6)
- **Laporan**: titik masih terlihat dan tertinggal dari kursor, padahal "Sembunyikan dari OBS" harus tetap nyala.
- **Penyebab tertinggal (tidak bisa dihapus dari kode aplikasi)**: kursor digambar langsung oleh Windows, sedangkan lubang harus lewat timer `holeTick` -> `setShape` -> DWM (sekitar 2-3 frame). Lubang yang bisa bergerak secepat kursor tidak mungkin selama memakai `setShape`.
- **Perbaikan**: lubang tidak lagi persegi, tetapi anak tangga `HOLE_RECTS` yang mengikuti badan panah (`HOLE_ARROW=true`), ujung kursor di (`HOLE_BACK`,`HOLE_BACK`)=(1,1) dari pojok lubang, sehingga hampir seluruhnya tertutup gambar kursor. `carve` memotong tiap persegi berurutan (`carve1`); `holeFor` menjaga lubang selama ujung kursor dan titik (+1,+1) masih di dalam lubang (`HOLE_PROBE`).
- **Kompromi**: toleransi geser lebih kecil, jadi lubang dipindah lebih sering (risiko kedip seperti v15.1.2 muncul lagi, belum teruji); hanya cocok untuk kursor panah standar (kursor tangan/custom tidak pas). `HOLE_ARROW=false` mengembalikan lubang persegi v15.1.5. Logika `carve`/`holeFor` diuji dengan stub di Node; **belum teruji di Windows**.
