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
- **Hooks**: `server.hooks.*` diisi `main.js` (protect, open, window, lock, drag, shape, setHotkeys, global, winCtl, openSettings).
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
| `src/main.js` | jendela, mode kunci, tray, hotkey global, konfirmasi keluar, single-instance, watchdog muat halaman |
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
- Cek update otomatis lewat GitHub Releases (`electron-updater`), dengan banner "Versi baru tersedia".
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
