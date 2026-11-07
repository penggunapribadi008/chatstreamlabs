// Tes asap (smoke test) tanpa Electron dan tanpa internet:
//  1) server hasil build dijalankan dan endpoint pentingnya dicek
//  2) halaman build/index.html dimuat di jsdom untuk tiap ?view= dan perilaku utamanya dicek
// Jalankan: npm test   (otomatis membangun dulu)
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'..'),build=path.join(root,'build');
let fail=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  GAGAL ')+m);if(!c)fail++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PKG=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

async function serverTests(){
  console.log('\n[server]');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cgs-'));
  fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({dock:{theme:'spatial'},overlay:{},global:{}}));
  const p=spawn(process.execPath,[path.join(build,'server.js')],{env:{...process.env,CG_DATA:dir,CG_VERSION:PKG.version},stdio:process.env.CG_DEBUG?'inherit':'ignore'});
  await sleep(2500);
  try{
    const base='http://localhost:3000',raw=async(u,b)=>(await fetch(base+u,{method:'POST',body:JSON.stringify(b||{})})).text(),j=async(u,b)=>(await fetch(base+u,{method:'POST',body:JSON.stringify(b||{})})).json();
    const html=await(await fetch(base+'/?view=dock')).text();
    ok(/<body class="dock p-polos th-spatial">/.test(html),'halaman dock sudah memakai tema tersimpan sejak render pertama');
    ok(!/th-spatial/.test(await(await fetch(base+'/?view=overlay')).text().then(t=>t.match(/<body[^>]*>/)[0])),'overlay tidak ikut tema aplikasi');
    const st=JSON.parse(fs.readFileSync(path.join(dir,'settings.json'),'utf8'));
    ok((st.global.templates||[]).map(t=>t.id).join()==='kartu,persona,neon,retro,cozy','gaya bawaan di-seed saat pertama jalan');
    await raw('/settings',{view:'global',values:{templates:[]}});await raw('/templates-restore',{});await sleep(250);
    ok(JSON.parse(fs.readFileSync(path.join(dir,'settings.json'),'utf8')).global.templates.length===5,'Pulihkan gaya bawaan bekerja');
    const pl=await j('/platform',{platform:'kick',on:true,user:'abc'});
    ok(pl.enabled&&pl.enabled.kick===true&&JSON.parse(fs.readFileSync(path.join(dir,'config.json'),'utf8')).kick==='abc','switch platform tersimpan (/platform)');
    await raw('/sample',{m:{p:'youtube',name:'a',text:'b'},target:'dock'});
    const s=await j('/send',{text:'halo',targets:['youtube','tiktok']});
    ok(/ekstensi/i.test(s.youtube)&&/ekstensi/i.test(s.tiktok),'kirim chat tanpa ekstensi memberi pesan jelas');
    await sendDefaultOffTests(base,dir,j,raw);
    await extTests(base,dir,j,raw);
    const o=await j('/obs-add',{});ok(/OBS/.test(o.error||''),'tambah ke OBS memberi pesan jelas bila OBS tidak aktif');
    const forbidden=await fetch(base+'/send',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'});
    ok(forbidden.status===403,'POST dari origin asing ditolak');
    // Donate Dock (multi-dock): pengaturan lewat /donate-docks (tanpa Electron, jadi hooks.donate kosong)
    const rd=()=>JSON.parse(fs.readFileSync(path.join(dir,'settings.json'),'utf8')).global;
    const dd=(url,extra)=>j('/donate-docks',{docks:[{id:'a',name:'Widget',url,...(extra||{})}]});
    ok(/tidak valid/i.test((await dd('javascript:alert(1)')).error||''),'Donate Dock menolak URL javascript:');
    ok(/tidak valid/i.test((await dd('file:///C:/rahasia.txt')).error||'')&&/tidak valid/i.test((await dd('bukan url')).error||''),'Donate Dock menolak file: dan teks biasa');
    const d3=await dd('  https://saweria.co/widgets/alert?streamKey=abc  ');await sleep(250);
    ok(d3.ok&&rd().donateDocks[0].url==='https://saweria.co/widgets/alert?streamKey=abc','Donate Dock menyimpan URL https (spasi dipangkas) di settings.global.donateDocks');
    await dd('http://localhost:9999/w');await sleep(150);
    ok(rd().donateDocks[0].url==='http://localhost:9999/w','Donate Dock menerima http');
    await dd('http://localhost:9999/w',{mute:true});await sleep(250);ok(rd().donateDocks[0].mute===true,'saklar bisu Donate Dock tersimpan (mute)');
    ok(/desktop/i.test((await j('/donate',{act:'open'})).error||''),'/donate di luar aplikasi desktop memberi pesan jelas');
    const d6=await dd('');await sleep(150);ok(d6.ok&&rd().donateDocks[0].url==='','URL kosong diterima (fitur diam)');
    ok((rd().templates||[]).length>0&&rd().autoOpen===true,'menyimpan pengaturan Donate Dock tidak menghapus pengaturan global lain');
    await extOnlyTests(base,dir,j,raw);
  }catch(e){ok(false,'server error: '+e.message);}
  p.kill();
}

// ---- v15.2.0: ekstensi memperbarui dirinya + kirim chat instan (tanpa Chrome asli: chrome.* dan DOM dipalsukan, kode asli extension/*.js dijalankan di vm) ----
async function extensionTests(){
  console.log('\n[ekstensi v15.2.0: salin folder tetap, muat ulang sendiri, kirim instan]');
  const vm=require('vm'),extDir=path.join(root,'extension');
  // -- extsync: salin folder ekstensi tetap
  const {syncDir}=require(path.join(root,'src/extsync.js')),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cgx-')),src=path.join(tmp,'src'),dst=path.join(tmp,'dst');
  fs.mkdirSync(src);fs.writeFileSync(path.join(src,'manifest.json'),'{"v":1}');fs.writeFileSync(path.join(src,'a.js'),'A1');fs.writeFileSync(path.join(src,'b.js'),'B1');
  let ch=syncDir(src,dst);
  ok(ch.length===3&&ch[ch.length-1]==='manifest.json'&&fs.readFileSync(path.join(dst,'a.js'),'utf8')==='A1','extsync: salinan pertama menyalin semua berkas, manifest.json PALING AKHIR');
  ok(syncDir(src,dst).length===0,'extsync: tidak ada yang berubah = tidak ada yang ditulis');
  fs.writeFileSync(path.join(src,'a.js'),'A2');fs.rmSync(path.join(src,'b.js'));fs.writeFileSync(path.join(dst,'sisa.tmp'),'x');
  ch=syncDir(src,dst);
  ok(ch.includes('a.js')&&ch.includes('-b.js')&&ch.includes('-sisa.tmp')&&!ch.includes('manifest.json')&&fs.readFileSync(path.join(dst,'a.js'),'utf8')==='A2'&&!fs.existsSync(path.join(dst,'b.js')),'extsync: hanya berkas yang beda ditulis, berkas usang dihapus');
  fs.rmSync(path.join(src,'manifest.json'));let thrown=false;try{syncDir(src,dst);}catch{thrown=true;}
  ok(thrown&&fs.existsSync(path.join(dst,'manifest.json')),'extsync: sumber tanpa manifest.json = error dan folder tujuan tidak dirusak');
  const real=path.join(tmp,'real');syncDir(extDir,real);
  ok(JSON.parse(fs.readFileSync(path.join(real,'manifest.json'),'utf8')).version===PKG.version&&fs.existsSync(path.join(real,'bg.js')),'extsync: extension/ asli tersalin lengkap, versi manifest = package.json');
  ok(JSON.stringify(JSON.parse(fs.readFileSync(path.join(extDir,'manifest.json'),'utf8')).permissions)==='["storage","tabs","alarms"]','izin ekstensi tidak bertambah (menambah izin pada update bisa meminta persetujuan Chrome)');
  fs.rmSync(tmp,{recursive:true,force:true});

  // -- bg.js: pesan ver -> chrome.runtime.reload() sekali per versi
  const glob=p=>new RegExp('^'+p.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*')+'$');
  async function loadBg({mine,store,failSet,tabs}){
    const st={...(store||{})},calls={reload:0,tabs:[]},socks=[];let onInst=null;
    class WS{constructor(u){this.url=u;this.readyState=0;socks.push(this);}send(){}close(){}}
    const chrome={runtime:{getManifest:()=>({version:mine}),reload:()=>{calls.reload++;},onStartup:{addListener(){}},onInstalled:{addListener:f=>{onInst=f;}}},
      storage:{local:{get:async k=>{const o={};[].concat(k).forEach(x=>{if(x in st)o[x]=st[x];});return o;},set:async o=>{if(failSet)throw new Error('gagal');Object.assign(st,o);}},onChanged:{addListener(){}}},
      alarms:{create(){},onAlarm:{addListener(){}}},
      tabs:{query:async q=>(tabs||[]).filter(t=>q.url.some(u=>glob(u).test(t.url))),reload:async id=>{calls.tabs.push(id);},create:async()=>({})},windows:{getAll:async()=>[],create:async()=>({})}};
    const ctx={chrome,WebSocket:WS,console:{info(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},URL,JSON,Date};
    vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(extDir,'bg.js'),'utf8'),ctx);await sleep(20);
    const w=socks[0];w.onopen();
    return{st,calls,msg:async m=>{w.onmessage({data:typeof m==='string'?m:JSON.stringify(m)});await sleep(20);},inst:async d=>{onInst&&onInst(d);await sleep(20);},bgHello:()=>true};
  }
  let B=await loadBg({mine:'15.2.0'});await B.msg({type:'ver',version:'15.2.0'});
  ok(B.calls.reload===0&&!('reloadedFor' in B.st),'bg: versi aplikasi = versi ekstensi -> tidak memuat ulang');
  B=await loadBg({mine:'15.1.7'});await B.msg({type:'ver',version:'15.2.0'});
  ok(B.calls.reload===1&&B.st.reloadedFor==='15.2.0'&&/15\.2\.0/.test(B.st.lastReload.reason)&&/15\.1\.7/.test(B.st.lastReload.reason),'bg: versi beda -> chrome.runtime.reload() sekali, penanda reloadedFor + alasan (lastReload) tersimpan');
  await B.msg({type:'ver',version:'15.2.0'});ok(B.calls.reload===1,'bg: pesan ver kedua untuk versi yang sama di sesi yang sama tidak memuat ulang lagi');
  B=await loadBg({mine:'15.1.7',store:{reloadedFor:'15.2.0'}});await B.msg({type:'ver',version:'15.2.0'});
  ok(B.calls.reload===0,'bg: sudah pernah reload untuk versi ini tetapi versi manifest tetap beda (dipasang dari folder lain) -> TIDAK loop');
  await B.msg({type:'ver',version:'15.2.1'});ok(B.calls.reload===1&&B.st.reloadedFor==='15.2.1','bg: versi aplikasi baru lagi (15.2.1) -> reload sekali lagi untuk versi itu');
  B=await loadBg({mine:'15.1.7',failSet:true});await B.msg({type:'ver',version:'15.2.0'});
  ok(B.calls.reload===0,'bg: penanda gagal disimpan -> tidak reload (mencegah loop)');
  B=await loadBg({mine:'15.1.7'});await B.msg({type:'ver',version:'bukan versi'});await B.msg({type:'ver'});await B.msg({type:'tidak-dikenal',x:1});await B.msg('bukan json');await B.msg({type:'open',platform:'tiktok',url:'https://evil.example/'});
  ok(B.calls.reload===0&&B.calls.tabs.length===0,'bg: versi tidak valid, tipe tidak dikenal, bukan JSON, dan open ke alamat asing diabaikan tanpa error');
  const T=[{id:1,url:'https://www.youtube.com/live_chat?is_popout=1&v=abc',active:false},{id:2,url:'https://www.youtube.com/live_chat?is_popout=1&v=abc',active:true},{id:3,url:'https://www.twitch.tv/directory',active:false},{id:4,url:'https://www.twitch.tv/popout/abc/chat?popout=',active:false},{id:5,url:'https://www.tiktok.com/@u/live',active:false}];
  B=await loadBg({mine:'15.2.0',tabs:T});await B.inst({reason:'update'});
  ok(JSON.stringify(B.calls.tabs)==='[1,4,5]','bg: sesudah ekstensi diperbarui, tab chat di latar dimuat ulang (content script lama yatim); tab aktif dan halaman biasa (twitch.tv/directory) dilewati');
  B=await loadBg({mine:'15.2.0',tabs:T});await B.inst({reason:'install'});await B.inst({reason:'chrome_update'});
  ok(B.calls.tabs.length===0,'bg: pasang baru / pembaruan Chrome tidak memuat ulang tab');

  // -- content script: tanpa jeda tetap, polling sampai kolom kosong, satu klik
  const CFG={'yt.js':{i:'yt-live-chat-text-input-field-renderer #input',b:'yt-live-chat-message-input-renderer #send-button button',plat:'youtube'},
    'tt.js':{i:'[data-e2e="comment-input"] [contenteditable]',b:'[data-e2e="comment-post"]',plat:'tiktok'},
    'tw.js':{i:'[data-a-target="chat-input"]',b:'[data-a-target="chat-send-button"]',plat:'twitch'},
    'kk.js':{i:'[data-testid="chat-input"]',b:'#send-message-button',plat:'kick'}};
  async function runCs(file,mode,opt){opt=opt||{};
    const c=CFG[file],box={textContent:'',tagName:'DIV',focus(){},dispatchEvent(){return true;},getBoundingClientRect:()=>({width:10})};
    const btn={disabled:mode==='late',clicks:0,getAttribute:()=>null,getBoundingClientRect:()=>({width:10}),click(){this.clicks++;if(mode==='ok'||mode==='late')setTimeout(()=>{box.textContent='';},120);}};
    if(mode==='late')setTimeout(()=>{btn.disabled=false;},150);
    const map={[c.i]:box,[c.b]:btn},sent=[];if(opt.href)map['[data-e2e="profile-icon"]']={getAttribute:()=>opt.href,closest:()=>null};
    class WS{constructor(){this.readyState=1;setTimeout(()=>{WSI=this;this.onopen&&this.onopen();},0);}send(x){sent.push(JSON.parse(x));}close(){}}let WSI=null;
    const document={querySelector:q=>map[q]||null,querySelectorAll:q=>map[q]?[map[q]]:[],execCommand:(cmd,_,t)=>{if(cmd==='insertText'&&mode!=='noinsert')box.textContent=t;else if(cmd==='selectAll'){}return true;}};
    const chrome={storage:{local:{get:(k,cb)=>cb({})},onChanged:{addListener(){}}}};
    const ctx={document,location:{href:'https://www.twitch.tv/popout/streamer/chat?popout='},chrome,WebSocket:WS,MutationObserver:class{observe(){}disconnect(){}},Event:class{},KeyboardEvent:class{},HTMLTextAreaElement:{prototype:{}},setTimeout,clearTimeout,setInterval,clearInterval,JSON,String,Object,Promise,console};
    vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(extDir,file),'utf8'),ctx);await sleep(30);
    const t0=Date.now();WSI.onmessage({data:JSON.stringify({type:'send',id:'1',text:'halo dunia',as:opt.as})});
    let r=null;for(let n=0;n<150&&!r;n++){await sleep(20);r=sent.find(x=>x.type==='result');}
    return{r,ms:Date.now()-t0,clicks:btn.clicks,hello:sent.find(x=>x.type==='hello')};
  }
  const location_fake='https://www.twitch.tv/popout/streamer/chat?popout=';
  // v15.3.2: TikTok membandingkan akun yang login di Chrome dengan username di aplikasi (hanya memblokir kalau nama TERBACA dan BEDA)
  {const a=await runCs('tt.js','ok',{href:'/@tono',as:'dewi'});
   ok(a.r&&a.r.ok===false&&/@tono/.test(a.r.error)&&/@dewi/.test(a.r.error)&&a.clicks===0,'tt.js: akun login (tono) beda dengan username (dewi): ditolak dengan pesan jelas, tombol kirim TIDAK diklik');
   const b=await runCs('tt.js','ok',{href:'/@Tono',as:'tono'});ok(b.r&&b.r.ok===true&&b.clicks===1,'tt.js: akun login sama dengan username (beda huruf besar/kecil): terkirim');
   const c=await runCs('tt.js','ok',{as:'dewi'});ok(c.r&&c.r.ok===true&&c.clicks===1,'tt.js: nama akun login tidak terbaca: pengiriman tetap berjalan (tidak memblokir karena tebakan)');
   const d=await runCs('yt.js','ok',{href:'/@tono',as:'dewi'});ok(d.r&&d.r.ok===true,'platform lain mengabaikan pemeriksaan akun');}
  for(const f of Object.keys(CFG)){
    let o=await runCs(f,'ok');
    ok(o.hello&&o.hello.platform===CFG[f].plat&&o.r&&o.r.ok===true&&o.clicks===1&&o.ms<500,f+': kolom kosong 120 ms setelah klik -> hasil ok dilaporkan segera ('+o.ms+' ms, jeda lama minimal 1000 ms), tepat 1 klik');
    ok(o.hello&&o.hello.page===location_fake,f+': hello membawa alamat halaman (location.href) supaya server bisa mencocokkan tab dengan username (v15.3.1)');
    o=await runCs(f,'late');
    ok(o.r&&o.r.ok===true&&o.clicks===1&&o.ms>=140&&o.ms<700,f+': menunggu tombol kirim aktif lalu klik SEKALI ('+o.ms+' ms), tidak mengklik tombol yang masih nonaktif');
    o=await runCs(f,'stuck');
    ok(o.r&&o.r.ok===false&&/tidak terkirim/.test(o.r.error)&&o.clicks===1&&o.ms>=600&&o.ms<1500,f+': kolom tidak pernah kosong -> gagal setelah batas pengaman (~0,7-0,9 dtk, '+o.ms+' ms), tetap 1 klik (tidak ada pesan ganda)');
    o=await runCs(f,'noinsert');
    ok(o.r&&o.r.ok===false&&/tidak bisa dimasukkan/.test(o.r.error)&&o.clicks===0&&o.ms<300,f+': teks gagal masuk ke kolom -> error jelas, tidak mengklik, tidak lapor ok palsu');
  }
}

// ---- v15.1.7: buka tab chat otomatis lewat service worker (bg), kirim paralel, saklar ----
// Memakai klien WebSocket palsu: "bg" = service worker ekstensi, "cs" = content script platform. Perilaku Chrome asli TIDAK diuji di sini.
async function extTests(base,dir,j,raw){
  console.log('\n[ekstensi: buka tab otomatis & kirim paralel]');
  const WS=require('ws'),conn=(hello,onMsg)=>new Promise((res,rej)=>{const w=new WS('ws://127.0.0.1:3000/ext');w.on('open',()=>{w.send(JSON.stringify(hello));res(w);});w.on('message',d=>onMsg&&onMsg(JSON.parse(String(d)),w));w.on('error',rej);});
  const opens=[],vers=[],bg=await conn({type:'bg'},m=>{if(m.type==='open')opens.push(m);if(m.type==='ver')vers.push(m);});
  // v15.2.0: setelah koneksi 'bg', server memberi tahu versi aplikasi (ekstensi yang beda versi memuat ulang dirinya). Content script tidak menerimanya.
  await sleep(150);
  ok(vers.length===1&&vers[0].version===PKG.version,'server mengirim {type:\'ver\',version} = versi package.json ke service worker ('+PKG.version+') segera setelah koneksi bg');
  const csGot=[],csV=await conn({type:'hello',platform:'kick'},m=>csGot.push(m.type));await sleep(150);
  ok(!csGot.includes('ver'),'content script (hello platform) tidak menerima pesan ver');csV.close();
  const cs=(platform,delay)=>conn({type:'hello',platform},(m,w)=>{if(m.type==='send')setTimeout(()=>w.send(JSON.stringify({type:'result',id:m.id,ok:true})),delay||0);});
  const rdG=()=>JSON.parse(fs.readFileSync(path.join(dir,'settings.json'),'utf8')).global;
  await raw('/send-set',{on:true});await sleep(150); // v15.3.2: Kirim Chat bawaannya MATI; buka-tab otomatis butuh sendOn=true
  await j('/platform',{platform:'tiktok',on:true,user:'@abc.def'});
  await j('/platform',{platform:'youtube',on:true,user:'https://www.youtube.com/watch?v=abcdefghijk'});
  await sleep(200);
  // ekstensi platform belum terhubung -> server minta service worker membuka tab; content script terhubung -> pesan terkirim
  let csT=null;const pr=j('/send',{text:'halo',targets:['tiktok']});
  await sleep(700);csT=await cs('tiktok');
  const r1=await pr;
  ok(r1.tiktok==='ok','kirim: ekstensi belum terhubung -> tab dibuka otomatis -> lalu terkirim (ok)');
  ok(opens.length===1&&opens[0].platform==='tiktok'&&opens[0].url==='https://www.tiktok.com/@abc.def/live','server mengirim {type:open} ke service worker dengan alamat live TikTok');
  // sudah terhubung: tidak membuka tab lagi
  const r2=await j('/send',{text:'lagi',targets:['tiktok']});
  ok(r2.tiktok==='ok'&&opens.length===1,'ekstensi sudah terhubung: tidak ada perintah buka tab lagi');
  // YouTube: alamat live_chat popout dari ID video
  const pY=j('/send',{text:'yt',targets:['youtube']});await sleep(500);
  ok(opens.length===2&&opens[1].url==='https://www.youtube.com/live_chat?is_popout=1&v=abcdefghijk','YouTube: alamat live_chat?is_popout=1&v=<id> (cocok dengan pola content script)');
  const csY=await cs('youtube');ok((await pY).youtube==='ok','YouTube: terkirim setelah content script terhubung');
  // paralel: dua platform lambat (1,2 dtk) selesai ~1,2 dtk, bukan 2,4 dtk
  const csW=await cs('twitch',1200);csT.close();await sleep(150);const csT2=await cs('tiktok',1200);
  await j('/platform',{platform:'twitch',on:true,user:'streamer'});
  const t0=Date.now(),r3=await j('/send',{text:'p',targets:['tiktok','twitch']}),dt=Date.now()-t0;
  ok(r3.tiktok==='ok'&&r3.twitch==='ok'&&dt<2100,'/send paralel: dua platform lambat selesai bersamaan ('+dt+' ms, bukan berurutan)');
  // saklar mati: tidak membuka tab, pesan lama dipertahankan
  csT2.close();csY.close();await sleep(200);
  await raw('/autoopen-set',{on:false});await sleep(250);
  ok(rdG().autoOpen===false,'saklar "Buka halaman chat otomatis" tersimpan di settings.global.autoOpen');
  const n=opens.length,r4=await j('/send',{text:'x',targets:['tiktok']});
  ok(/ekstensi Chrome belum terhubung/.test(r4.tiktok)&&opens.length===n,'saklar mati: tidak membuka tab, pesan error lama dipertahankan');
  await raw('/autoopen-set',{on:true});await sleep(250);
  // service worker tidak ada: pesan jelas (setelah menunggu singkat), tidak menggantung
  bg.close();await sleep(250);const t1=Date.now(),r5=await j('/send',{text:'x',targets:['tiktok']});
  ok(/Chrome terbuka/.test(r5.tiktok)&&Date.now()-t1<5000,'tanpa service worker: pesan jelas "pastikan Chrome terbuka..." dan tidak menggantung');
  // ping bg dijawab pong (jaga service worker tetap hidup)
  const got=[];const bg2=await conn({type:'bg'},m=>got.push(m.type));bg2.send(JSON.stringify({type:'ping'}));await sleep(150);ok(got.includes('pong'),'ping dari service worker dijawab pong');
  // v15.3.1: tab chat yang terhubung HARUS milik username yang diisi (dulu cukup platform yang sama -> pesan bisa terkirim ke channel lain)
  csW.close();await sleep(150);
  const opens3=[],bg3=await conn({type:'bg'},m=>{if(m.type==='open')opens3.push(m);});
  const pg=(platform,page,hit)=>conn({type:'hello',platform,page},(m,w)=>{if(m.type==='send'){hit.n++;w.send(JSON.stringify({type:'result',id:m.id,ok:true}));}});
  const hitW={n:0},hitR={n:0},acc=async()=>(await fetch(base+'/account')).json();
  const wrongTw=await pg('twitch','https://www.twitch.tv/popout/orang_lain/chat?popout=',hitW);
  ok((await acc()).twitch===false,'tab Twitch milik channel lain: status \"belum terhubung\" (bukan terhubung)');
  const rW=await j('/send',{text:'x',targets:['twitch']});
  ok(/bukan milik username/.test(rW.twitch)&&hitW.n===0,'tab Twitch milik channel lain TIDAK dipakai: pesan tidak dikirim ke sana, error jelas ('+rW.twitch+')');
  ok(opens3.some(o=>o.platform==='twitch'&&o.url==='https://www.twitch.tv/popout/streamer/chat?popout='),'... dan halaman channel yang benar diminta dibuka lewat service worker');
  const rightTw=await pg('twitch','https://www.twitch.tv/popout/Streamer/chat?popout=',hitR);
  ok((await acc()).twitch===true,'tab milik username yang benar (beda huruf besar/kecil): status terhubung');
  const rR=await j('/send',{text:'y',targets:['twitch']});
  ok(rR.twitch==='ok'&&hitR.n===1&&hitW.n===0,'dua tab Twitch terbuka: pesan hanya ke tab username yang benar');
  // YouTube: dicocokkan lewat ID video (username yang diisi = link video abcdefghijk)
  const wrongYt=await pg('youtube','https://www.youtube.com/live_chat?is_popout=1&v=zzzzzzzzzzz',{n:0});
  ok((await acc()).youtube===false,'tab YouTube milik video lain: status belum terhubung');
  const rightYt=await pg('youtube','https://www.youtube.com/live_chat?is_popout=1&v=abcdefghijk',{n:0});
  ok((await acc()).youtube===true,'tab YouTube dengan video yang benar: status terhubung');
  const gotT=[],ttc=await conn({type:'hello',platform:'tiktok',page:'https://www.tiktok.com/@abc.def/live'},(m,w)=>{if(m.type==='send'){gotT.push(m);w.send(JSON.stringify({type:'result',id:m.id,ok:true}));}});
  await j('/send',{text:'z',targets:['tiktok']});
  ok(gotT.length===1&&gotT[0].as==='abc.def','server: pesan ke TikTok membawa akun yang diharapkan (as=abc.def)');
  const gotY=[];wrongYt.close();rightYt.close();await sleep(100);const ytc=await conn({type:'hello',platform:'youtube',page:'https://www.youtube.com/live_chat?is_popout=1&v=abcdefghijk'},(m,w)=>{if(m.type==='send'){gotY.push(m);w.send(JSON.stringify({type:'result',id:m.id,ok:true}));}});
  await j('/send',{text:'z',targets:['youtube']});ok(gotY.length===1&&!('as' in gotY[0]),'server: pesan ke YouTube tidak membawa as');
  [ttc,ytc].forEach(w=>{try{w.close();}catch{}});
  [wrongTw,rightTw,wrongYt,rightYt,bg3].forEach(w=>{try{w.close();}catch{}});
  [bg2,csW].forEach(w=>{try{w.close();}catch{}});
}

const html=()=>fs.readFileSync(path.join(build,'index.html'),'utf8');
const seeds=JSON.parse(fs.readFileSync(path.join(root,'src/seeds.json'),'utf8'));
const rivals=fs.readFileSync(path.join(root,'examples/rivals-chat-kiri.css'),'utf8');
const cozy=fs.readFileSync(path.join(root,'examples/cozy-multichat-earthy.css'),'utf8');
const TPL=[...seeds,{id:'c_riv',name:'rivals',css:rivals,struct:'std'},{id:'c_cozy',name:'cozy-multichat-earthy',css:cozy,struct:'cozy'}];
const mk=(ov,dock)=>({settings:{dock:{...(dock||{})},overlay:{...ov},global:{templates:TPL,hotkeys:{}}},cfg:{youtube:'@a',tiktok:'@b',enabled:{youtube:true,tiktok:true,twitch:true,kick:true}},status:{},viewers:{},
  history:[{p:'tiktok',name:'dewi anggraini',text:'halo teman',t:Date.now(),id:1},{p:'youtube',name:'Andi',text:'hai semua',mod:true,t:Date.now(),id:2},{p:'youtube',name:'Sinta_Rahma',text:'Terima kasih kak!',sc:{amount:'Rp50.000',color:'#ffca28'},t:Date.now(),id:3},
  {p:'tiktok',kind:'join',name:'rizkyy_',t:Date.now(),id:4},{p:'tiktok',kind:'gift',name:'Budi',gift:'Rose',n:5,coins:5,t:Date.now(),id:5},{p:'tiktok',kind:'like',name:'Sinta',others:3,n:48,t:Date.now(),id:6}]});
// ---- v15.3.2: login resmi Twitch DIHAPUS. Semua kirim chat lewat ekstensi Chrome; Kirim Chat bawaannya MATI. ----
async function extOnlyTests(base,dir,j,raw){
  console.log('\n[server: tanpa login Twitch, kirim chat hanya lewat ekstensi]');
  const WS=require('ws'),has=f=>fs.existsSync(path.join(root,f));
  ok(!has('src/twitch.js')&&!has('src/tokenstore.js')&&!has('src/oauth-config.js'),'berkas login resmi Twitch (twitch.js, tokenstore.js, oauth-config.js) sudah dihapus');
  const bundle=fs.readFileSync(path.join(build,'server.js'),'utf8');
  ok(!/id\.twitch\.tv|helix\/chat\/messages|auth\.dat|device_code/.test(bundle),'bundel server tidak lagi memuat kode login/Helix Twitch');
  for(const r of ['/auth-state','/auth-login','/auth-logout']){const x=await fetch(base+r,r==='/auth-state'?{}:{method:'POST',body:'{}'});const t=await x.text();ok(!/loggedIn|pending|configured/.test(t),r+' sudah tidak ada (tidak membalas status login)');}
  const conn=(platform,got,reply)=>new Promise((res,rej)=>{const w=new WS('ws://127.0.0.1:3000/ext');w.on('open',()=>{w.send(JSON.stringify({type:'hello',platform}));res(w);});w.on('message',d=>{const m=JSON.parse(String(d));if(m.type==='send'){got.push(platform+':'+m.text);w.send(JSON.stringify({type:'result',id:m.id,ok:reply!==false,error:'ekstensi gagal'}));}});w.on('error',rej);});
  await raw('/autoopen-set',{on:false}); // tidak ada service worker palsu di tes ini: jangan menunggu buka-tab
  await j('/platform',{platform:'twitch',on:true,user:'streamerx'});await j('/platform',{platform:'kick',on:true,user:'kickerx'});
  const got=[],csT=await conn('twitch',got),csK=await conn('kick',got);await sleep(150);
  let r=await j('/send',{text:'halo tw',targets:['twitch']});
  ok(r.twitch==='ok'&&got.join()==='twitch:halo tw','Twitch: pesan dikirim lewat ekstensi Chrome');
  got.length=0;r=await j('/send',{text:'campur',targets:['twitch','kick']});
  ok(r.twitch==='ok'&&r.kick==='ok'&&got.sort().join()==='kick:campur,twitch:campur','Twitch dan Kick: dua-duanya lewat ekstensi, paralel, hasil per platform seperti biasa');
  csT.close();await sleep(150);
  r=await j('/send',{text:'tanpa ekstensi',targets:['twitch']});
  ok(/ekstensi Chrome belum terhubung/.test(r.twitch)&&!/cadangan/.test(r.twitch),'Twitch tanpa ekstensi: pesan error ekstensi yang jelas (tidak ada lagi \"cadangan\")');
  csK.close();
  ok(!fs.existsSync(path.join(dir,'auth.dat')),'tidak ada berkas token (auth.dat) di folder data');
}
// ---- v15.3.2: Kirim Chat bawaannya MATI ----
async function sendDefaultOffTests(base,dir,j,raw){
  console.log('\n[server: Kirim Chat bawaan mati (eksperimental)]');
  const rdG=()=>JSON.parse(fs.readFileSync(path.join(dir,'settings.json'),'utf8')).global;
  const WS=require('ws');
  const opens=[],bg=await new Promise((res,rej)=>{const w=new WS('ws://127.0.0.1:3000/ext');w.on('open',()=>{w.send(JSON.stringify({type:'bg'}));res(w);});w.on('message',d=>{const m=JSON.parse(String(d));if(m.type==='open')opens.push(m);});w.on('error',rej);});
  await j('/platform',{platform:'kick',on:true,user:'kickerx'});await sleep(150);
  ok(rdG().sendOn===undefined,'pengaturan baru: sendOn belum ada (dianggap MATI)');
  await raw('/autoopen-set',{on:true});await sleep(250);
  const r1=await j('/send',{text:'x',targets:['kick']});
  ok(/ekstensi Chrome belum terhubung/.test(r1.kick)&&opens.length===0,'Kirim Chat belum dinyalakan: tab chat TIDAK dibuka otomatis walau saklar "Buka halaman chat otomatis" nyala');
  await raw('/send-set',{on:true});await sleep(250);
  ok(rdG().sendOn===true,'/send-set on:true menyimpan sendOn=true');
  const pr=j('/send',{text:'y',targets:['kick']});await sleep(600);
  ok(opens.length===1&&opens[0].platform==='kick'&&opens[0].url==='https://kick.com/kickerx','Kirim Chat dinyalakan: tab chat dibuka otomatis lagi');
  const cs=await new Promise((res,rej)=>{const w=new WS('ws://127.0.0.1:3000/ext');w.on('open',()=>{w.send(JSON.stringify({type:'hello',platform:'kick'}));res(w);});w.on('message',d=>{const m=JSON.parse(String(d));if(m.type==='send')w.send(JSON.stringify({type:'result',id:m.id,ok:true}));});w.on('error',rej);});
  ok((await pr).kick==='ok','... lalu pesan terkirim lewat ekstensi');cs.close();
  await raw('/send-set',{on:false});await sleep(250);ok(rdG().sendOn===false,'/send-set on:false menyimpan sendOn=false');
  await raw('/send-set',{});await sleep(250);ok(rdG().sendOn===false,'/send-set tanpa nilai = mati (bukan nyala)');
  bg.close();await sleep(150);
}
async function page(q,ov,dock,after){
  const errs=[],posts=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
  const dom=new JSDOM(html(),{url:'http://localhost:3000/'+q,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.fetch=(u,o)=>{posts.push([u,o&&o.body]);return Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});};
    w.confirm=()=>true;w.alert=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.EventSource=class{constructor(){setTimeout(()=>this.onmessage&&this.onmessage({data:JSON.stringify({type:'init',data:mk(ov,dock)})}),20);}};}});
  await sleep(350);const d=dom.window.document;
  await after(d,dom,posts);ok(errs.length===0,q+' tanpa error JavaScript'+(errs.length?': '+errs[0]:''));
}
function parserTests(){
  console.log('\n[Twitch & Kick: pengurai pesan]');
  const P=require(path.join(root,'src/platforms.js'));
  const a=P.twitchLine('@badges=moderator/1,subscriber/6;bits=100;display-name=Rina\\sK;emotes=25:0-4;first-msg=1 :r!r@r.tmi.twitch.tv PRIVMSG #k :Kappa Cheer100 mantap');
  ok(a.length===2&&a[0].kind==='first'&&a[1].text==='Kappa mantap'&&a[1].mod&&a[1].member&&a[1].sc.amount==='100 bits'&&a[1].emo[0][2].includes('/25/'),'Twitch: chat, badge, emote, Bits (cheermote dibuang), chatter baru');
  ok(P.twitchLine('@msg-id=subgift;display-name=J;msg-param-community-gift-id=1 :tmi.twitch.tv USERNOTICE #k').length===0,'Twitch: subgift bagian hadiah massal tidak membanjiri baris');
  const g=P.twitchLine('@msg-id=submysterygift;display-name=J;msg-param-mass-gift-count=10 :tmi.twitch.tv USERNOTICE #k')[0];ok(g.kind==='gift'&&g.n===10,'Twitch: hadiah massal = satu baris');
  const r=P.twitchLine('@msg-id=raid;msg-param-displayName=Besar;msg-param-viewerCount=250 :tmi.twitch.tv USERNOTICE #k')[0];ok(r.kind==='raid'&&r.n===250&&r.name==='Besar','Twitch: raid');
  const k=P.kickEvent('App\\Events\\ChatMessageEvent',JSON.stringify({content:'halo [emote:37226:KEKW] ya',sender:{username:'b',identity:{badges:[{type:'moderator'}]}}}))[0];
  ok(k.text==='halo KEKW ya'&&k.mod&&k.emo[0][0]===5&&/37226/.test(k.emo[0][2]),'Kick: chat, badge, emote');
  ok(P.kickEvent('KicksGifted',JSON.stringify({sender:{username:'z'},gift:{amount:100}}))[0].sc.amount==='100 Kicks','Kick: Kicks disorot seperti Super Chat');
  ok(['GiftedSubscriptionsEvent','SubscriptionEvent','StreamHostEvent','RewardRedeemedEvent','FollowersUpdated'].every(n=>P.kickEvent('App\\Events\\'+n,JSON.stringify({username:'u',gifter_username:'u',gifted_usernames:['a'],host_username:'u',followed:true})).length===1),'Kick: sub, gift sub, raid, reward, follow dikenali');
}
async function uiTests(){
  console.log('\n[tampilan]');
  await page('?view=dock',{},{theme:'neo'},(d,dom)=>{
    const m=d.querySelector('#msgs .m');ok(m&&m.querySelector('.tx').textContent==='halo teman','isi chat tampil (bukan hanya nama)');
    ok(/th-neo/.test(d.body.className),'tema dock diterapkan');ok(dom.window.__ready===true,'halaman menandai siap (window.__ready)');});
  await page('?view=overlay',{preset:'persona'},{},(d)=>{ok(!!d.querySelector('.p5-head')&&!!d.querySelector('.p5-text'),'Persona 5 memakai struktur .p5-msg');});
  await page('?view=overlay',{preset:'c_riv',fsName:30,fsText:26,gap:30,align:'right',order:'top'},{},(d)=>{
    ok(!!d.querySelector('#log .msg .badge svg'),'CSS bergaya rivals dikenali (struktur #log/.msg/.badge)');
    ok(/\bzm\b/.test(d.body.className)&&/gap-set/.test(d.body.className)&&/al-right/.test(d.body.className)&&/\bot\b/.test(d.body.className),'ukuran nama/teks, jarak, kanan dan arah-atas ikut berlaku untuk CSS buatan sendiri');
    ok(/an-tpl/.test(d.body.className),'animasi "otomatis" mengikuti animasi bawaan CSS');});
  { const h=html();
    ok(/body\.al-right\.s-rv \.msg\{[^}]*scale:var\(--sx\) 1/.test(h)&&/@keyframes aBounce\{[^@]*--sx/.test(h)&&/@keyframes aZoom\{[^@]*--sx/.test(h),'mirror kanan (rv) tidak tertimpa animasi masuk bounce/zoom (keyframes ikut --sx)'); }
  await page('?view=overlay',{},{},(d)=>{const sc=d.querySelector('#msgs .m.sc');ok(!!sc&&sc.querySelector('.amt').textContent==='Rp50.000'&&/ffca28/i.test(sc.style.getPropertyValue('--sc')),'Super Chat contoh tampil di pratinjau overlay (nominal + warna)');});
  await page('?view=overlay',{preset:'persona'},{},(d)=>{ok(d.querySelector('.p5-msg.sc .p5-amt')&&d.querySelector('.p5-msg.sc .p5-amt').textContent==='Rp50.000','Super Chat di gaya Persona 5');});
  await page('?view=overlay',{preset:'c_riv'},{},(d)=>{const h=d.querySelector('#log .msg.hl');ok(!!h&&/Rp50\.000/.test(h.querySelector('.tag').textContent),'Super Chat di gaya rivals memakai kelas .hl dan label nominal');});
  await page('?view=overlay',{preset:'kartu'},{},(d)=>{ok(!/\bzm\b/.test(d.body.className),'gaya yang sudah memakai variabel ukuran tidak digandakan skalanya');});
  await page('?view=settings',{},{theme:'clay'},(d)=>{
    ok(!!d.querySelector('#panes')&&!!d.querySelector('#ph .bar'),'pengaturan: tombol aksi tab Hotkey berada di bar bawah');
    ok(d.querySelectorAll('#hkl .hk').length===9,'9 aksi hotkey tampil');ok(/th-clay/.test(d.body.className),'tema tetap di jendela pengaturan');});
  await page('?view=tpl',{},{},(d)=>{ok(d.querySelectorAll('.tcard').length===8,'kelola gaya: Default + 5 bawaan + 2 buatan');});
  await page('?view=tpladd&id=persona',{},{},(d)=>{ok(d.getElementById('tn').value==='Persona 5','edit gaya bawaan terisi otomatis');});
  // ---- perbaikan: CSS buatan pengguna harus tampil apa adanya di overlay ----
  {const css=html(),bad=(css.match(/[^{}]*\{[^{}]*outline:\s*none\s*!important[^{}]*\}/g)||[]).filter(r=>!/body:not\(\.overlay\)/.test(r));
   ok(bad.length===0,'outline:none!important hanya untuk jendela aplikasi (overlay tidak boleh, supaya jahitan/outline CSS pengguna tampil)');
   ok(!/:is\(#msgs,#chat\)\{[^}]*gap:/.test(css),'wadah #chat (struktur cozy) tidak diberi gap bawaan');}
  await page('?view=overlay',{preset:'c_cozy'},{},(d)=>{
    ok(!!d.querySelector('#chat[data-mode="person"] .msg[data-color][data-platform]'),'CSS bergaya cozy dikenali (struktur #chat/.msg[data-color])');
    ok(d.querySelectorAll('#chat .msg').length===3,'riwayat tampil sebagai pesan cozy');
    const tg=d.querySelector('#chat .msg[data-type="event"] .tag');ok(!!tg&&tg.textContent==='Rp50.000','Super Chat di gaya cozy: data-type=event + label nominal');
    const im=d.querySelector('#chat .avatar img');im.onerror&&im.onerror();ok(!/<rect/.test(decodeURIComponent(im.src)),'foto cadangan (inisial) tanpa latar, warna latar ditentukan CSS gaya');});
  // ---- perbaikan: jendela "Gaya baru" dengan CSS kosong = pratinjau kosong ----
  await page('?view=overlay&preview=1&static=1&force=__draft',{},{},async(d,dom)=>{
    dom.window.postMessage({type:'tpldraft',css:''},'*');await sleep(1000);
    ok(d.querySelectorAll('.msg,.m').length===0,'Gaya baru: CSS kosong, pratinjau tidak menampilkan tampilan bawaan');
    dom.window.postMessage({type:'tpldraft',css:cozy},'*');await sleep(1600);
    ok(d.querySelectorAll('#chat .msg').length>=2,'Gaya baru: setelah CSS diisi, pratinjau muncul');
    dom.window.postMessage({type:'tpldraft',css:'  \n '},'*');await sleep(1000);
    ok(d.querySelectorAll('.msg,.m').length===0,'Gaya baru: CSS dikosongkan lagi, pratinjau ikut kosong');});
  // ---- aktivitas per platform, Total penonton, laporan ----
  await page('?view=dock',{},{},(d)=>{
    ok(d.querySelectorAll('#msgs .cs-act').length===2,'dock: join & gift tampil sebagai baris aktivitas, like (bawaan mati) tidak');
    ok(d.querySelectorAll('#msgs .m').length===3,'aktivitas tidak dihitung sebagai chat (.m)');
    ok(!!d.querySelector('#top #tot.vchip')&&!d.getElementById('anBtn')&&!d.getElementById('gear'),'Total penonton ada; tombol laporan dan pengaturan sudah dihapus dari dock');});
  await page('?view=dock',{},{},(d,dom)=>{dom.window.eval("EN.twitch=false;applyEnabled();add({p:'twitch',name:'x',text:'y',t:Date.now()})");
    ok(!d.querySelector('#msgs .m.tw')&&d.getElementById('cw').classList.contains('off'),'platform yang dimatikan: chat dan kotak header tidak tampil');});
  await page('?view=dock',{},{ttJoin:true,ttJoinBg:true,ttJoinBgC:'#112233',ttJoinBgOp:100,ttJoinFc:'#ff0000',ttLike:true},(d)=>{
    const j=d.querySelector('.cs-act.cs-join');ok(j&&/17, 34, 51/.test(j.style.background)&&/255, 0, 0/.test(j.style.color),'latar & warna font aktivitas mengikuti pengaturan');
    ok(!!d.querySelector('.cs-act.cs-like'),'jenis aktivitas yang dicentang (like) ikut tampil');});
  await page('?view=dock',{},{ttAct:false},(d)=>{ok(d.querySelectorAll('.cs-act').length===0,'"Tampilkan aktivitas" dimatikan = tidak ada baris aktivitas');});
  await page('?view=dock',{},{joins:false},(d)=>{ok(!d.querySelector('.cs-join'),'pengaturan lama joins:false tetap dihormati');});
  await page('?view=dock',{},{ytSc:false},(d)=>{ok(!d.querySelector('.m.sc'),'Super Chat bisa disembunyikan');});
  await page('?view=dock',{},{ytScBg:'custom',ytScBgC:'#00ff00',ytScFcOn:true,ytScFc:'#123456',ytScAmt:false},(d)=>{const m=d.querySelector('.m.sc');
    ok(m&&m.style.getPropertyValue('--sc')==='#00ff00'&&/hasfc/.test(m.className)&&/noamt/.test(m.className),'gaya Super Chat (latar, font, nominal) diterapkan');});
  await page('?view=overlay',{},{},(d)=>{ok(!d.querySelector('.cs-join')&&!!d.querySelector('.cs-gift'),'overlay: join mati bawaan, gift hidup bawaan');});
  await page('?view=settings',{},{},(d)=>{
    ok(['dock','overlay'].every(v=>['yt','tt','tw','kk'].every(p=>d.getElementById('pg'+v+'_'+p)&&d.getElementById('pgb_'+v+'_'+p).children.length>0)),'pengaturan: halaman YouTube, TikTok, Twitch & Kick ada di Pribadi dan Overlay');
    d.querySelector('[data-pg="overlay_tt"]').click();ok(d.getElementById('pgoverlay_tt').classList.contains('on')&&d.querySelector('.tab[data-t="o"]').classList.contains('on'),'tombol platform membuka halamannya, tab Overlay tetap menyala');
    const dep=d.querySelector('[data-dep="overlay_ttJoin"]'),cb=d.getElementById('overlay_ttJoin');ok(dep.style.display==='none','pilihan latar/warna font tersembunyi sebelum dicentang');
    cb.checked=true;cb.dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));ok(dep.style.display==='','pilihan muncul setelah dicentang');
    d.querySelector('[data-back="o"]').click();ok(d.getElementById('po').classList.contains('on'),'tombol Kembali');});
  // ---- Twitch & Kick ----
  await page('?view=dock',{},{},(d,dom)=>{
    dom.window.eval("add({p:'twitch',name:'a',text:'x',t:Date.now(),vip:true});add({p:'kick',name:'b',text:'y',t:Date.now(),member:true});add({p:'twitch',kind:'raid',name:'c',n:5,t:Date.now()});add({p:'kick',kind:'follow',name:'d',t:Date.now()})");
    ok(!!d.querySelector('#msgs .m.w.tw[data-platform="twitch"].isvip')&&!!d.querySelector('#msgs .m.k.kk[data-platform="kick"].ismem'),'dock: chat Twitch (.w) dan Kick (.k) punya kelas, data-platform dan badge sendiri');
    ok(!!d.querySelector('.cs-act.cs-tw.cs-raid')&&!!d.querySelector('.cs-act.cs-kk.cs-follow'),'aktivitas Twitch (raid) dan Kick (follow) tampil');
    ok(!!d.querySelector('#top #cw')&&!!d.querySelector('#top #ck'),'header penonton punya kotak Twitch dan Kick');});
  await page('?view=overlay&preview=1&static=1&force=kartu',{},{},async(d)=>{await sleep(5200);
    ok(d.querySelectorAll('#msgs .m,#msgs .cs-act').length>=4,'pratinjau overlay terus menerima pesan acak');
    const pf=new Set([...d.querySelectorAll('#msgs [data-platform]')].map(x=>x.dataset.platform));ok(pf.size>=2,'pesan acak berasal dari beberapa platform');});
  await page('?view=report',{},{},async(d,dom)=>{await sleep(200);ok(/reportwin/.test(d.body.className)&&!!d.getElementById('rbody'),'jendela laporan dimuat');});
  // ---- v15.3.2: Kirim Chat bawaan MATI (sendOn belum ada = mati); baru tampil kalau sendOn===true ----
  await page('?view=dock',{},{},(d,dom)=>{
    ok(/\bnosend\b/.test(d.body.className),'bawaan (sendOn belum ada): body punya kelas nosend, kotak isi chat tersembunyi');
    dom.window.eval("S.global.sendOn=true;applyStyle()");
    ok(!/\bnosend\b/.test(d.body.className),'sendOn=true: kelas nosend hilang, kotak isi chat tampil');
    dom.window.eval("delete S.global.sendOn;applyStyle()");
    ok(/\bnosend\b/.test(d.body.className),'sendOn dihapus lagi: kembali tersembunyi');});
  // ---- Kirim Chat dimatikan: hanya kotak isi chat dan tombol kirim yang hilang ----
  await page('?view=dock',{},{},(d,dom)=>{
    dom.window.eval("S.global.sendOn=false;applyStyle()");
    ok(/\bnosend\b/.test(d.body.className),'Kirim Chat mati: body diberi kelas nosend');
    const css=fs.readFileSync(path.join(root,'src/ui/style.css'),'utf8');
    ok(/body\.nosend #msg,body\.nosend #send\{display:none!important\}/.test(css)&&!/body\.nosend #foot/.test(css),'Kirim Chat mati: CSS hanya menyembunyikan #msg dan #send (bukan seluruh #foot)');
    ok(!!d.querySelector('#foot #flt')&&!!d.querySelector('#foot #lock'),'filter platform dan gembok tetap ada di kolom bawah');});
  // ---- v15.1.7: filter "Semua" hanya mengirim ke platform yang dinyalakan DAN terhubung ----
  await page('?view=dock',{},{},async(d,dom,posts)=>{
    const w=dom.window,T=(f,en,st)=>JSON.stringify(w.eval('sendTargets')(f,en,st));
    const EN4={youtube:true,tiktok:true,twitch:false,kick:true};
    ok(T('all',EN4,{youtube:'gagal: x',tiktok:'terhubung',twitch:'terhubung',kick:'Terhubung'})==='["tiktok","kick"]','Semua: hanya yang dinyalakan + Terhubung (Twitch mati dilewati, YouTube gagal dilewati)');
    ok(T('all',EN4,{})==='[]'&&T('all',EN4,{youtube:'belum diisi',tiktok:'terputus'})==='[]','Semua: tidak ada yang tersambung -> daftar kosong');
    ok(T('youtube',EN4,{})==='["youtube"]','filter satu platform yang belum tersambung: tetap dipakai apa adanya (error eksplisit dari server)');
    // doSend end-to-end (fetch palsu mencatat POST)
    w.eval("filt='all';status={youtube:'gagal: x',tiktok:'terhubung',twitch:'',kick:''};");
    d.getElementById('msg').value='halo';d.getElementById('send').click();await sleep(80);
    const sent=posts.filter(x=>x[0]==='/send').map(x=>JSON.parse(x[1]));
    ok(sent.length===1&&JSON.stringify(sent[0].targets)==='["tiktok"]','doSend "Semua": POST /send hanya berisi platform yang tersambung');
    w.eval("status={youtube:'terputus'};");d.getElementById('msg').value='halo';d.getElementById('send').click();
    ok(posts.filter(x=>x[0]==='/send').length===1&&d.getElementById('msg').placeholder==='Belum ada platform yang tersambung.','doSend "Semua" tanpa yang tersambung: flash "Belum ada platform yang tersambung." dan tidak ada POST');
    w.eval("filt='youtube'");d.getElementById('send').click();
    ok(posts.filter(x=>x[0]==='/send').length===2&&JSON.parse(posts.filter(x=>x[0]==='/send')[1][1]).targets[0]==='youtube','filter YouTube yang belum tersambung tetap mengirim (perilaku lama)');
    ok(!!d.getElementById('autoOpen'),'Koneksi punya saklar "Buka halaman chat otomatis di Chrome"');});
  // ---- v15.2.0: kirim optimistis (kolom langsung kosong; kembali kalau SEMUA target gagal) ----
  await page('?view=dock',{},{},async(d,dom)=>{
    const w=dom.window,msg=d.getElementById('msg');let res=null,calls=[];
    const hold=()=>{calls=[];w.fetch=(u,o)=>{calls.push([u,o&&o.body]);return new Promise((ok2,no)=>{res={yes:v=>ok2({json:()=>Promise.resolve(v)}),no};});};};
    const send=t=>{msg.value=t;d.getElementById('send').click();};
    w.eval("filt='all';status={tiktok:'terhubung'};");
    hold();send('halo');
    ok(msg.value===''&&calls.length===1,'optimistis: kolom pesan kosong LANGSUNG saat kirim, sebelum server menjawab');
    res.yes({tiktok:'ekstensi Chrome belum terhubung'});await sleep(30);
    ok(msg.value==='halo'&&/TikTok: ekstensi Chrome belum terhubung/.test(msg.placeholder),'semua target gagal: teks kembali ke kolom dan error tampil');
    hold();send('halo');res.yes({tiktok:'ok'});await sleep(30);
    ok(msg.value==='','berhasil: kolom tetap kosong');
    w.eval("status={youtube:'terhubung',tiktok:'terhubung'};");
    hold();send('halo');res.yes({youtube:'gagal x',tiktok:'ok'});await sleep(30);
    ok(msg.value===''&&/YouTube: gagal x/.test(msg.placeholder),'minimal satu berhasil: tetap kosong, error platform yang gagal tetap tampil');
    hold();send('a');msg.value='b';res.yes({youtube:'gagal x',tiktok:'gagal y'});await sleep(30);
    ok(msg.value==='a b','gagal total saat pengguna sudah mengetik pesan baru: teks yang gagal ditaruh di depan, tidak menimpa pesan baru');
    hold();send('halo');res.no(new Error('jaringan putus'));await sleep(30);
    ok(msg.value==='halo'&&/Gagal: jaringan putus/.test(msg.placeholder),'request gagal (jaringan): teks kembali dan error tampil');
    hold();send('satu');send('dua');ok(calls.length===2&&msg.value==='','beberapa pesan beruntun boleh berjalan bersamaan (tombol kirim tidak dikunci)');
  });
  // ---- v15.3.2: tanpa login Twitch; Twitch/Kick dan Kirim Chat berlabel (eksperimental); Kirim Chat bawaan MATI ----
  await page('?view=dashboard',{},{},async(d,dom,posts)=>{
    const w=dom.window,exp=el=>!!el&&/\(eksperimental\)/.test(el.textContent);
    ok(!d.getElementById('au_twitch')&&!d.getElementById('aus_twitch')&&!d.getElementById('aub_twitch')&&!d.querySelector('.cau')&&!/Masuk dengan Twitch/.test(d.body.textContent),'Koneksi: tidak ada lagi baris/tombol login Twitch');
    ok(w.eval('typeof auRender')==='undefined'&&w.eval('typeof authRefresh')==='undefined','kode login Twitch di app.js sudah dihapus (auRender/authRefresh)');
    await sleep(80);ok(!posts.some(x=>/auth-/.test(x[0])),'halaman tidak lagi memanggil /auth-state, /auth-login, atau /auth-logout');
    ok(exp(d.querySelector('#cn_twitch .cnh b'))&&exp(d.querySelector('#cn_kick .cnh b')),'kartu Koneksi Twitch dan Kick berlabel (eksperimental)');
    ok(!exp(d.querySelector('#cn_youtube .cnh b'))&&!exp(d.querySelector('#cn_tiktok .cnh b')),'YouTube dan TikTok TIDAK berlabel eksperimental');
    ok(exp(d.querySelector('h3.h3sw'))&&/Kirim Chat/.test(d.querySelector('h3.h3sw').textContent),'judul kartu Kirim Chat berlabel (eksperimental)');
    ok(exp(d.querySelector('.chip2[data-pf="twitch"]'))&&exp(d.querySelector('.chip2[data-pf="kick"]'))&&!exp(d.querySelector('.chip2[data-pf="youtube"]')),'status Kirim Chat: Twitch dan Kick berlabel (eksperimental), YouTube tidak');
    ok(['dock_tw','dock_kk','overlay_tw','overlay_kk'].every(g=>exp(d.querySelector('.plat[data-pg="'+g+'"] b')))&&!['dock_yt','dock_tt','overlay_yt','overlay_tt'].some(g=>exp(d.querySelector('.plat[data-pg="'+g+'"] b'))),'tombol pengaturan Twitch & Kick (Pribadi dan Overlay) berlabel (eksperimental)');
    ok(d.getElementById('sendOn').checked===false,'saklar Kirim Chat bawaan MATI (sendOn belum ada di pengaturan)');
    w.eval("S.global.sendOn=true;fillGlobal()");ok(d.getElementById('sendOn').checked===true,'sendOn=true: saklar menyala');
    w.eval("S.global.sendOn=false;fillGlobal()");ok(d.getElementById('sendOn').checked===false,'sendOn=false: saklar mati');
    d.getElementById('sendOn').checked=true;d.getElementById('sendOn').dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(40);
    ok(posts.some(x=>x[0]==='/send-set'&&/"on":true/.test(x[1]||'')),'menyalakan saklar memanggil /send-set on:true');});
  // ---- Donate Dock ----
  await page('?view=donatebar',{},{},(d,dom,posts)=>{
    ok(/donatewin/.test(d.body.className)&&d.getElementById('tbt').textContent==='Donate Dock'&&dom.window.__ready===true,'bilah judul Donate Dock dimuat dan menandai siap');
    d.getElementById('wclose').click();ok(posts.some(x=>x[0]==='/win'&&/"which":"donate"/.test(x[1])&&/"act":"close"/.test(x[1])),'tombol tutup bilah judul memanggil /win which=donate');});
  await page('?view=dashboard',{},{},async(d,dom,posts)=>{
    ok(!!d.getElementById('pn')&&!!d.querySelector('.sbi[data-t="n"]'),'Dashboard punya tab Donate Dock');
    d.getElementById('dDockAdd').click();ok(!d.getElementById('dnModal').hidden,'tombol Tambah Donate Dock membuka dialog');
    d.getElementById('dnmUrl').value='https://saweria.co/widgets/alert?streamKey=x';d.getElementById('dnmMute').checked=true;d.getElementById('dnmSave').click();await sleep(80);
    ok(posts.some(x=>x[0]==='/donate-docks'&&/saweria/.test(x[1]||'')&&/"mute":true/.test(x[1]||'')),'tombol Simpan di dialog memanggil /donate-docks dengan URL dan pilihan bisu');
    ok(/Donate Dock/.test(d.getElementById('hkl').textContent),'hotkey Buka / tutup Donate Dock muncul di tab Hotkey');});
  await page('?view=ctl',{},{},(d)=>{ok(!!d.getElementById('eye')&&!!d.getElementById('unlock')&&!!d.getElementById('mover'),'jendela kecil gembok punya 3 kotak');});
}
(async()=>{parserTests();await serverTests();await extensionTests();await uiTests();console.log(fail?'\n'+fail+' pemeriksaan GAGAL':'\nsemua pemeriksaan lulus');process.exit(fail?1:0);})();
