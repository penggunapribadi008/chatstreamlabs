// Tes asap (smoke test) tanpa Electron dan tanpa internet:
//  1) server hasil build dijalankan dan endpoint pentingnya dicek
//  2) halaman build/index.html dimuat di jsdom untuk tiap ?view= dan perilaku utamanya dicek
// Jalankan: npm test   (otomatis membangun dulu)
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'..'),build=path.join(root,'build');
let fail=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  GAGAL ')+m);if(!c)fail++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function serverTests(){
  console.log('\n[server]');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cgs-'));
  fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({dock:{theme:'spatial'},overlay:{},global:{}}));
  const p=spawn(process.execPath,[path.join(build,'server.js')],{env:{...process.env,CG_DATA:dir},stdio:'ignore'});
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
    const s=await j('/send',{text:'halo',targets:['youtube','tiktok']});
    ok(/ekstensi/i.test(s.youtube)&&/ekstensi/i.test(s.tiktok),'kirim chat tanpa ekstensi memberi pesan jelas');
    const o=await j('/obs-add',{});ok(/OBS/.test(o.error||''),'tambah ke OBS memberi pesan jelas bila OBS tidak aktif');
    const forbidden=await fetch(base+'/send',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'});
    ok(forbidden.status===403,'POST dari origin asing ditolak');
  }catch(e){ok(false,'server error: '+e.message);}
  p.kill();
}

const html=()=>fs.readFileSync(path.join(build,'index.html'),'utf8');
const seeds=JSON.parse(fs.readFileSync(path.join(root,'src/seeds.json'),'utf8'));
const rivals=fs.readFileSync(path.join(root,'examples/rivals-chat-kiri.css'),'utf8');
const cozy=fs.readFileSync(path.join(root,'examples/cozy-multichat-earthy.css'),'utf8');
const TPL=[...seeds,{id:'c_riv',name:'rivals',css:rivals,struct:'std'},{id:'c_cozy',name:'cozy-multichat-earthy',css:cozy,struct:'cozy'}];
const mk=(ov,dock)=>({settings:{dock:{...(dock||{})},overlay:{...ov},global:{templates:TPL,hotkeys:{}}},cfg:{youtube:'@a',tiktok:'@b'},status:{},viewers:{},
  history:[{p:'tiktok',name:'dewi anggraini',text:'halo teman',t:Date.now(),id:1},{p:'youtube',name:'Andi',text:'hai semua',mod:true,t:Date.now(),id:2},{p:'youtube',name:'Sinta_Rahma',text:'Terima kasih kak!',sc:{amount:'Rp50.000',color:'#ffca28'},t:Date.now(),id:3},
  {p:'tiktok',kind:'join',name:'rizkyy_',t:Date.now(),id:4},{p:'tiktok',kind:'gift',name:'Budi',gift:'Rose',n:5,coins:5,t:Date.now(),id:5},{p:'tiktok',kind:'like',name:'Sinta',others:3,n:48,t:Date.now(),id:6}]});
async function page(q,ov,dock,after){
  const errs=[],posts=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
  const dom=new JSDOM(html(),{url:'http://localhost:3000/'+q,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.fetch=(u,o)=>{posts.push([u,o&&o.body]);return Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});};
    w.confirm=()=>true;w.alert=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.EventSource=class{constructor(){setTimeout(()=>this.onmessage&&this.onmessage({data:JSON.stringify({type:'init',data:mk(ov,dock)})}),20);}};}});
  await sleep(350);const d=dom.window.document;
  await after(d,dom,posts);ok(errs.length===0,q+' tanpa error JavaScript'+(errs.length?': '+errs[0]:''));
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
    ok(!!d.querySelector('#top #tot.vchip')&&!!d.getElementById('anBtn'),'Total penonton berkotak seperti YouTube/TikTok + tombol laporan');});
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
    ok(['dock','overlay'].every(v=>['yt','tt'].every(p=>d.getElementById('pg'+v+'_'+p)&&d.getElementById('pgb_'+v+'_'+p).children.length>0)),'pengaturan: halaman YouTube & TikTok ada di Pribadi dan Overlay');
    d.querySelector('[data-pg="overlay_tt"]').click();ok(d.getElementById('pgoverlay_tt').classList.contains('on')&&d.querySelector('.tab[data-t="o"]').classList.contains('on'),'tombol platform membuka halamannya, tab Overlay tetap menyala');
    const dep=d.querySelector('[data-dep="overlay_ttJoin"]'),cb=d.getElementById('overlay_ttJoin');ok(dep.style.display==='none','pilihan latar/warna font tersembunyi sebelum dicentang');
    cb.checked=true;cb.dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));ok(dep.style.display==='','pilihan muncul setelah dicentang');
    d.querySelector('[data-back="o"]').click();ok(d.getElementById('po').classList.contains('on'),'tombol Kembali');});
  await page('?view=report',{},{},async(d,dom)=>{await sleep(200);ok(/reportwin/.test(d.body.className)&&!!d.getElementById('rbody'),'jendela laporan dimuat');});
  await page('?view=ctl',{},{},(d)=>{ok(!!d.getElementById('eye')&&!!d.getElementById('unlock')&&!!d.getElementById('mover'),'jendela kecil gembok punya 3 kotak');});
}
(async()=>{await serverTests();await uiTests();console.log(fail?'\n'+fail+' pemeriksaan GAGAL':'\nsemua pemeriksaan lulus');process.exit(fail?1:0);})();
