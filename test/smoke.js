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
  const fw=await fakeTwitchServer(3991);
  const p=spawn(process.execPath,[path.join(build,'server.js')],{env:{...process.env,CG_DATA:dir,CG_VERSION:PKG.version,CG_TWITCH_CLIENT_ID:'cid123',CG_TWITCH_OAUTH:'http://127.0.0.1:3991/oauth2',CG_TWITCH_API:'http://127.0.0.1:3991/helix'},stdio:process.env.CG_DEBUG?'inherit':'ignore'});
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
    await officialTests(base,dir,j,raw,fw.tw);
  }catch(e){ok(false,'server error: '+e.message);}
  p.kill();fw.close();
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
  async function runCs(file,mode){
    const c=CFG[file],box={textContent:'',tagName:'DIV',focus(){},dispatchEvent(){return true;},getBoundingClientRect:()=>({width:10})};
    const btn={disabled:mode==='late',clicks:0,getAttribute:()=>null,getBoundingClientRect:()=>({width:10}),click(){this.clicks++;if(mode==='ok'||mode==='late')setTimeout(()=>{box.textContent='';},120);}};
    if(mode==='late')setTimeout(()=>{btn.disabled=false;},150);
    const map={[c.i]:box,[c.b]:btn},sent=[];
    class WS{constructor(){this.readyState=1;setTimeout(()=>{WSI=this;this.onopen&&this.onopen();},0);}send(x){sent.push(JSON.parse(x));}close(){}}let WSI=null;
    const document={querySelector:q=>map[q]||null,querySelectorAll:q=>map[q]?[map[q]]:[],execCommand:(cmd,_,t)=>{if(cmd==='insertText'&&mode!=='noinsert')box.textContent=t;else if(cmd==='selectAll'){}return true;}};
    const chrome={storage:{local:{get:(k,cb)=>cb({})},onChanged:{addListener(){}}}};
    const ctx={document,location:{href:'https://www.twitch.tv/popout/streamer/chat?popout='},chrome,WebSocket:WS,MutationObserver:class{observe(){}disconnect(){}},Event:class{},KeyboardEvent:class{},HTMLTextAreaElement:{prototype:{}},setTimeout,clearTimeout,setInterval,clearInterval,JSON,String,Object,Promise,console};
    vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(extDir,file),'utf8'),ctx);await sleep(30);
    const t0=Date.now();WSI.onmessage({data:JSON.stringify({type:'send',id:'1',text:'halo dunia'})});
    let r=null;for(let n=0;n<150&&!r;n++){await sleep(20);r=sent.find(x=>x.type==='result');}
    return{r,ms:Date.now()-t0,clicks:btn.clicks,hello:sent.find(x=>x.type==='hello')};
  }
  const location_fake='https://www.twitch.tv/popout/streamer/chat?popout=';
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
// ---- v15.2.1: login resmi Twitch (Device Code Grant + Helix Send Chat Message). Tanpa Twitch asli: fetch/HTTP dipalsukan. ----
const DEVT='urn:ietf:params:oauth:grant-type:device_code';
function mockTw(){
  const m={calls:[],pend:0,tokens:0,sendMode:'ok',refreshMode:'ok',expired:'',throwOn:'',throwName:'TypeError',deny:false,uri:'',refreshUsed:[]};
  const res=(status,j)=>({ok:status>=200&&status<300,status,json:async()=>j});
  m.fetch=async(url,o)=>{o=o||{};const u=new URL(url),p=u.pathname,body=o.body?String(o.body):'',f=p.startsWith('/oauth2')&&o.method==='POST'?Object.fromEntries(new URLSearchParams(body)):null;
    m.calls.push({method:o.method||'GET',path:p,search:u.search,form:f,json:p==='/helix/chat/messages'?JSON.parse(body):null,h:o.headers||{}});
    if(m.throwOn&&p.includes(m.throwOn)){const e=new Error('x');e.name=m.throwName;throw e;}
    if(p==='/oauth2/device')return res(200,{device_code:'DC1',user_code:'ABCD1234',verification_uri:m.uri||'https://www.twitch.tv/activate?device-code=ABCD1234',expires_in:1800,interval:1});
    if(p==='/oauth2/token'){
      if(f.grant_type===DEVT){if(m.pend>0){m.pend--;return res(400,{status:400,message:'authorization_pending'});}if(m.deny)return res(400,{status:400,message:'access_denied'});
        return res(200,{access_token:'AT'+(++m.tokens),refresh_token:'RT'+m.tokens,expires_in:14400,scope:['user:write:chat'],token_type:'bearer'});}
      if(f.grant_type==='refresh_token'){if(m.refreshMode==='bad')return res(400,{status:400,message:'Invalid refresh token'});m.refreshUsed.push(f.refresh_token);
        return res(200,{access_token:'AT'+(++m.tokens),refresh_token:'RT'+m.tokens,expires_in:14400});}}
    if(p==='/oauth2/revoke')return res(200,{});
    if(p==='/helix/users')return u.searchParams.get('login')?res(200,{data:[{id:'555',login:u.searchParams.get('login')}]}):res(200,{data:[{id:'222',login:'streamerx',display_name:'StreamerX'}]});
    if(p==='/helix/chat/messages'){
      if(m.expired&&(o.headers||{}).Authorization==='Bearer '+m.expired)return res(401,{status:401,message:'Invalid OAuth token'});
      if(m.sendMode==='dropped')return res(200,{data:[{message_id:'',is_sent:false,drop_reason:{code:'msg_duplicate',message:'Pesan duplikat'}}]});
      if(m.sendMode==='err')return res(400,{status:400,message:'bad'});
      return res(200,{data:[{message_id:'m1',is_sent:true}]});}
    return res(404,{});};
  return m;}
async function twitchTests(){
  console.log('\n[login resmi Twitch (mock)]');
  const T=require(path.join(root,'src/twitch.js')),Store=require(path.join(root,'src/tokenstore.js'));
  const until=async(fn,ms=2000)=>{const e=Date.now()+ms;while(Date.now()<e){if(fn())return true;await sleep(5);}return !!fn();};
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cgt-')),file=path.join(dir,'auth.dat');
  const hk={cryptOk:()=>true,encrypt:t=>Buffer.from('ENC:'+t.split('').reverse().join('')).toString('base64'),decrypt:b=>String(Buffer.from(b,'base64')).slice(4).split('').reverse().join('')};
  const mk=(m,extra)=>{const opened=[];const t=T.create({clientId:'cid123',fetch:m.fetch,store:Store(file,hk),channel:()=>'streamerx',open:u=>opened.push(u),sleep:()=>Promise.resolve(),...(extra||{})});t.opened=opened;return t;};
  const loginOk=async(t)=>{await t.login();await until(()=>t.state().loggedIn);};
  // tanpa Client ID
  {const m=mockTw(),t=mk(m,{clientId:'ISI_TWITCH_CLIENT_ID_DI_SINI'});const r=await t.login();
   ok(/Client ID/.test(r.error||'')&&m.calls.length===0&&t.state().configured===false,'tanpa Client ID (placeholder): pesan jelas, tidak ada permintaan jaringan');
   const t2=mk(mockTw(),{clientId:''});ok(/Client ID/.test((await t2.login()).error||''),'Client ID kosong: pesan jelas');}
  // alur device code
  fs.rmSync(file,{force:true});
  const m=mockTw();m.pend=2;const t=mk(m);
  const r=await t.login();
  ok(r.pending&&r.pending.code==='ABCD1234'&&t.opened.length===1&&/^https:\/\/www\.twitch\.tv\/activate/.test(t.opened[0]),'login: kode pengguna ditampilkan dan halaman verifikasi Twitch dibuka');
  const dv=m.calls.find(c=>c.path==='/oauth2/device');ok(dv.form.client_id==='cid123'&&dv.form.scopes==='user:write:chat'&&!('client_secret' in dv.form),'permintaan device: client_id + scope user:write:chat, tanpa client secret');
  await until(()=>t.state().loggedIn);
  const polls=m.calls.filter(c=>c.path==='/oauth2/token'&&c.form.grant_type===DEVT);
  ok(polls.length===3&&polls.every(c=>c.form.device_code==='DC1'),'polling: authorization_pending ditunggu 2x, lalu berhasil di percobaan ke-3');
  ok(t.state().loggedIn&&t.state().name==='StreamerX'&&!t.state().pending&&t.state().memOnly===false,'sesudah masuk: nama akun terbaca (Get Users), tidak lagi pending');
  const disk=fs.readFileSync(file,'utf8');ok(!/AT1|RT1/.test(disk)&&!/AT1|RT1/.test(Buffer.from(JSON.parse(disk).twitch,'base64').toString()),'berkas token berisi data terenkripsi, bukan teks biasa');
  ok(mk(m).state().loggedIn&&mk(m).state().name==='StreamerX','token terenkripsi dibaca lagi saat aplikasi dibuka ulang (tetap masuk)');
  // kirim
  let s=await t.send('halo dunia');const pc=m.calls.filter(c=>c.path==='/helix/chat/messages').pop();
  ok(s.ok&&pc.json.message==='halo dunia'&&pc.json.broadcaster_id==='555'&&pc.json.sender_id==='222'&&pc.h.Authorization==='Bearer AT1'&&pc.h['Client-Id']==='cid123','kirim: Helix chat/messages dengan broadcaster_id (Get Users login), sender_id, Bearer, Client-Id');
  await t.send('lagi');ok(m.calls.filter(c=>c.path==='/helix/users'&&c.search.includes('login=')).length===1,'broadcaster_id dicache (Get Users login hanya sekali)');
  m.sendMode='dropped';s=await t.send('x');ok(!s.ok&&!s.final&&/duplikat/.test(s.fail),'is_sent=false: gagal dengan alasan dari Twitch, boleh jatuh ke ekstensi');
  m.sendMode='err';s=await t.send('x');ok(!s.ok&&!s.final&&/bad/.test(s.fail),'HTTP error Helix: gagal, boleh jatuh ke ekstensi');
  m.sendMode='ok';
  m.throwOn='/helix/chat';m.throwName='TypeError';s=await t.send('x');ok(!s.ok&&!s.final&&/tidak bisa menghubungi/.test(s.fail),'jaringan gagal: gagal, boleh jatuh ke ekstensi');
  m.throwName='TimeoutError';s=await t.send('x');ok(!s.ok&&s.final===true,'timeout: tidak pasti terkirim, TIDAK jatuh ke ekstensi (cegah pesan dobel)');m.throwOn='';
  // refresh: 401 -> refresh -> ulang
  m.expired='AT1';s=await t.send('setelah 401');
  ok(s.ok&&m.refreshUsed.join()==='RT1'&&t.state().loggedIn,'401: token di-refresh sekali (refresh token lama dipakai) lalu kirim diulang berhasil');
  const rf=m.calls.filter(c=>c.path==='/oauth2/token'&&c.form.grant_type==='refresh_token').pop();ok(rf.form.client_id==='cid123'&&!('client_secret' in rf.form),'refresh memakai client_id saja (aplikasi publik)');
  m.expired='AT2';s=await t.send('401 lagi');ok(s.ok&&m.refreshUsed.join()==='RT1,RT2','refresh token sekali-pakai: refresh kedua memakai refresh token BARU (RT2), bukan RT1');
  ok(mk(m).state().loggedIn,'token hasil refresh langsung tersimpan');
  // refresh proaktif + satu proses refresh
  {const m2=mockTw(),t2=mk(m2);await loginOk(t2);const st=Store(file,hk),tk=st.get('twitch');tk.exp=Date.now()-1000;st.set('twitch',tk);
   const t3=mk(m2);const [a,b]=await Promise.all([t3.send('1'),t3.send('2')]);
   ok(a.ok&&b.ok&&m2.refreshUsed.length===1,'token hampir habis: di-refresh dulu, dan dua kirim bersamaan hanya memicu SATU refresh');}
  // refresh ditolak (30 hari tanpa pemakaian / dicabut)
  {const m3=mockTw(),t3=mk(m3);await loginOk(t3);m3.refreshMode='bad';m3.expired='AT'+m3.tokens;const s3=await t3.send('x');
   ok(!s3.ok&&!t3.state().loggedIn&&/Masuk lagi/.test(t3.state().error)&&!mk(m3).state().loggedIn,'refresh ditolak: dianggap keluar, token dibuang, pesan "Masuk lagi" muncul');
   ok((await t3.send('x')).skip===true,'sesudah keluar: kirim dilewati (jatuh ke ekstensi)');}
  // belum masuk / username kosong
  {const t4=mk(mockTw());await t4.logout();const s4=await t4.send('x');ok(s4.skip===true,'belum masuk: send dilewati (jatuh ke ekstensi)');
   const m5=mockTw(),t5=mk(m5,{channel:()=>''});await loginOk(t5);ok((await t5.send('x')).skip===true&&!m5.calls.some(c=>c.path==='/helix/chat/messages'),'username Twitch belum diisi: dilewati, tidak ada permintaan kirim');}
  // keluar
  {const m6=mockTw(),t6=mk(m6);await loginOk(t6);await t6.logout();
   ok(!t6.state().loggedIn&&m6.calls.some(c=>c.path==='/oauth2/revoke')&&!JSON.parse(fs.readFileSync(file,'utf8')).twitch,'Keluar: token dicabut di Twitch dan dihapus dari disk');}
  // ditolak / batal / kedaluwarsa / alamat asing
  {const m7=mockTw();m7.pend=1;m7.deny=true;const t7=mk(m7);await t7.login();await until(()=>t7.state().error);
   ok(!t7.state().loggedIn&&!t7.state().pending&&/dibatalkan/.test(t7.state().error),'pengguna menolak izin di Twitch: pesan jelas, tidak pending');
   const m8=mockTw();m8.uri='https://evil.example/activate';const t8=mk(m8);await t8.login();ok(t8.opened.length===0,'alamat verifikasi bukan twitch.tv: tidak dibuka di browser');await t8.logout();
   const m9=mockTw();m9.pend=1e9;const t9=mk(m9,{sleep:()=>new Promise(r=>setTimeout(r,2))});await t9.login();ok(!!t9.state().pending,'menunggu: status pending selama pengguna belum menyetujui');await t9.logout();await sleep(20);ok(!t9.state().pending&&!t9.state().loggedIn,'Batal: polling berhenti');
   const m10=mockTw();m10.throwOn='/oauth2/device';const t10=mk(m10);ok(/menghubungi Twitch/.test((await t10.login()).error||''),'login tanpa internet: pesan jelas');}
  // safeStorage tidak tersedia: tidak menulis teks biasa ke disk, pengguna diberi tahu (memOnly)
  {const f2=path.join(dir,'auth2.dat'),m11=mockTw(),t11=T.create({clientId:'cid123',fetch:m11.fetch,store:Store(f2,{}),channel:()=>'streamerx',sleep:()=>Promise.resolve()});
   await t11.login();await until(()=>t11.state().loggedIn);
   ok(t11.state().loggedIn&&t11.state().memOnly===true&&!fs.existsSync(f2),'safeStorage tidak tersedia: tetap bisa masuk di sesi ini, memOnly=true, TIDAK ada berkas token di disk');
   ok((await t11.send('x')).ok,'safeStorage tidak tersedia: kirim tetap jalan di sesi itu');
   const t12=T.create({clientId:'cid123',fetch:m11.fetch,store:Store(f2,{cryptOk:()=>false,encrypt:()=>{throw new Error('x')},decrypt:()=>'x'}),channel:()=>'streamerx'});ok(!t12.state().loggedIn,'sesi baru tanpa safeStorage: harus masuk lagi (tidak ada token tersimpan)');}
  fs.rmSync(dir,{recursive:true,force:true});
}
// ---- v15.2.1: /send memilih jalur resmi Twitch, ekstensi sebagai cadangan (server sungguhan + mock Twitch HTTP + klien WebSocket palsu) ----
async function officialTests(base,dir,j,raw,tw){
  console.log('\n[server: jalur kirim resmi Twitch dan cadangan ekstensi]');
  const WS=require('ws'),gj=async u=>(await fetch(base+u)).json();
  const conn=(platform,got,reply)=>new Promise((res,rej)=>{const w=new WS('ws://127.0.0.1:3000/ext');w.on('open',()=>{w.send(JSON.stringify({type:'hello',platform}));res(w);});w.on('message',d=>{const m=JSON.parse(String(d));if(m.type==='send'){got.push(platform+':'+m.text);w.send(JSON.stringify({type:'result',id:m.id,ok:reply!==false,error:'ekstensi gagal'}));}});w.on('error',rej);});
  await raw('/autoopen-set',{on:false}); // tidak ada service worker palsu di tes ini: jangan menunggu buka-tab
  await j('/platform',{platform:'twitch',on:true,user:'streamerx'});await j('/platform',{platform:'kick',on:true,user:'kickerx'});
  const got=[],csT=await conn('twitch',got),csK=await conn('kick',got);await sleep(150);
  let st=(await gj('/auth-state')).twitch;
  ok(st&&st.configured===true&&st.loggedIn===false&&!st.pending,'/auth-state: Twitch tersedia, Client ID terisi, belum masuk');
  ok(!(await gj('/auth-state')).kick,'Kick belum punya baris login (sesi berikutnya)');
  let r=await j('/send',{text:'sebelum masuk',targets:['twitch']});
  ok(r.twitch==='ok'&&got.join()==='twitch:sebelum masuk'&&tw.chat.length===0,'belum masuk: Twitch jatuh ke ekstensi (perilaku lama), Helix tidak dipanggil');
  const l=await j('/auth-login',{platform:'twitch'});ok(l.pending&&l.pending.code==='ABCD1234','/auth-login: kode ditampilkan');
  ok(await(async()=>{for(let i=0;i<60;i++){if((await gj('/auth-state')).twitch.loggedIn)return true;await sleep(100);}return false;})(),'polling server menyelesaikan login sesudah authorization_pending');
  st=(await gj('/auth-state')).twitch;ok(st.name==='StreamerX'&&st.memOnly===true&&!JSON.stringify(st).match(/AT\d|RT\d/),'status: "StreamerX", memOnly (tanpa safeStorage di tes), token tidak pernah dikirim ke UI');
  got.length=0;r=await j('/send',{text:'lewat resmi',targets:['twitch']});
  ok(r.twitch==='ok'&&tw.chat.length===1&&tw.chat[0].message==='lewat resmi'&&got.length===0,'sudah masuk: kirim lewat Helix, ekstensi TIDAK dipakai, hasil tetap "ok" per platform');
  r=await j('/send',{text:'campur',targets:['twitch','kick']});
  ok(r.twitch==='ok'&&r.kick==='ok'&&tw.chat.length===2&&got.join()==='kick:campur','paralel: Twitch lewat resmi, Kick tetap lewat ekstensi, hasil per platform dilaporkan seperti biasa');
  tw.mode='dropped';got.length=0;r=await j('/send',{text:'ditolak',targets:['twitch']});
  ok(r.twitch==='ok'&&got.join()==='twitch:ditolak','resmi gagal (is_sent=false): jatuh ke ekstensi dan berhasil');
  csT.close();await sleep(150);
  r=await j('/send',{text:'dua-duanya gagal',targets:['twitch']});
  ok(/duplikat/.test(r.twitch)&&/cadangan lewat Chrome juga gagal/.test(r.twitch),'resmi DAN ekstensi gagal: pesan menyebut keduanya');
  tw.mode='ok';
  const log=()=>fs.existsSync(path.join(dir,'log.txt'))?fs.readFileSync(path.join(dir,'log.txt'),'utf8'):'';
  const files=['config.json','settings.json'].map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n')+log();
  ok(!/AT\d|RT\d|DC1/.test(files)&&!fs.existsSync(path.join(dir,'auth.dat')),'token tidak ada di config.json / settings.json / log.txt, dan tidak ada berkas token teks biasa');
  await j('/auth-logout',{platform:'twitch'});st=(await gj('/auth-state')).twitch;
  ok(!st.loggedIn&&tw.revoked===true,'/auth-logout: keluar dan token dicabut di Twitch');
  const csT2=await conn('twitch',got);await sleep(100);got.length=0;tw.chat.length=0;r=await j('/send',{text:'setelah keluar',targets:['twitch']});
  ok(r.twitch==='ok'&&got.join()==='twitch:setelah keluar'&&tw.chat.length===0,'sesudah keluar: kembali ke ekstensi');
  ok(/belum diisi|platform/i.test((await j('/auth-login',{platform:'youtube'})).error||''),'/auth-login untuk platform tanpa penyedia: pesan jelas');
  csT2.close();csK.close();
}
// Twitch palsu (HTTP) untuk tes server: /oauth2/device, /oauth2/token (pending sekali), /oauth2/revoke, /helix/users, /helix/chat/messages
function fakeTwitchServer(port){
  const tw={chat:[],mode:'ok',revoked:false,pend:1};
  const srv=require('http').createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{const u=new URL(req.url,'http://x'),send=(s,o)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(o));};
    if(u.pathname==='/oauth2/device')return send(200,{device_code:'DC1',user_code:'ABCD1234',verification_uri:'https://www.twitch.tv/activate?device-code=ABCD1234',expires_in:1800,interval:1});
    if(u.pathname==='/oauth2/token'){if(tw.pend>0){tw.pend--;return send(400,{status:400,message:'authorization_pending'});}return send(200,{access_token:'AT1',refresh_token:'RT1',expires_in:14400});}
    if(u.pathname==='/oauth2/revoke'){tw.revoked=true;return send(200,{});}
    if(u.pathname==='/helix/users')return send(200,{data:[u.searchParams.get('login')?{id:'555',login:u.searchParams.get('login')}:{id:'222',login:'streamerx',display_name:'StreamerX'}]});
    if(u.pathname==='/helix/chat/messages'){const m=JSON.parse(b);if(tw.mode==='dropped')return send(200,{data:[{is_sent:false,drop_reason:{code:'x',message:'Pesan duplikat'}}]});tw.chat.push(m);return send(200,{data:[{message_id:'m',is_sent:true}]});}
    send(404,{});});});
  return new Promise(r=>srv.listen(port,'127.0.0.1',()=>r({tw,close:()=>srv.close()})));}
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
  // ---- v15.2.1: baris login resmi Twitch di Dashboard > Koneksi ----
  await page('?view=dashboard',{},{},async(d,dom,posts)=>{
    const w=dom.window,row=d.getElementById('au_twitch'),txt=()=>d.getElementById('aus_twitch').textContent,btn=d.getElementById('aub_twitch');
    ok(!!row&&!d.getElementById('au_kick'),'Koneksi: baris login ada untuk Twitch saja (Kick belum)');
    w.eval("AUS={twitch:{configured:true,loggedIn:false,name:'',pending:null,error:'',memOnly:false}};auRender();");
    ok(!row.hidden&&/tanpa Chrome/.test(txt())&&btn.textContent==='Masuk dengan Twitch','belum masuk: ajakan masuk + tombol \"Masuk dengan Twitch\"');
    w.eval("AUS={twitch:{configured:true,loggedIn:false,name:'',pending:{code:'ABCD1234'},error:'',memOnly:false}};auRender();");
    ok(/ABCD1234/.test(txt())&&d.querySelector('#aus_twitch b').textContent==='ABCD1234'&&btn.textContent==='Batal','menunggu: kode tampil dan tombol berubah jadi Batal');
    w.eval("AUS={twitch:{configured:true,loggedIn:true,name:'<img src=x onerror=alert(1)>',pending:null,error:'',memOnly:true}};auRender();");
    ok(/Masuk sebagai/.test(txt())&&btn.textContent==='Keluar'&&!d.querySelector('#aus_twitch img')&&/hanya berlaku sampai aplikasi ditutup/.test(txt()),'sudah masuk: \"Masuk sebagai <nama>\" (nama sebagai teks, bukan HTML), tombol Keluar, peringatan bila token tidak bisa disimpan');
    btn.click();await sleep(40);ok(posts.some(x=>x[0]==='/auth-logout'&&/twitch/.test(x[1]||'')),'tombol Keluar memanggil /auth-logout');
    w.eval("AUS={twitch:{configured:false,loggedIn:false,name:'',pending:null,error:'',memOnly:false}};auRender();");
    w.fetch=(u,o)=>{posts.push([u,o&&o.body]);return Promise.resolve({json:()=>Promise.resolve({error:'Login Twitch belum disiapkan di aplikasi ini (Client ID belum diisi oleh pembuatnya).'})});};
    btn.click();await sleep(60);
    ok(posts.some(x=>x[0]==='/auth-login')&&/Client ID belum diisi/.test(txt()),'tanpa Client ID: tombol Masuk menampilkan pesan jelas di barisnya');});
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
(async()=>{parserTests();await twitchTests();await serverTests();await extensionTests();await uiTests();console.log(fail?'\n'+fail+' pemeriksaan GAGAL':'\nsemua pemeriksaan lulus');process.exit(fail?1:0);})();
