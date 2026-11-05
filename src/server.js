const http=require('http'),fs=require('fs'),path=require('path');
const SEEDS=require('./seeds.json');
const base=process.env.CG_DATA||__dirname;
const CF=path.join(base,'config.json'),SF=path.join(base,'settings.json');
const stats=require('./stats.js')(path.join(base,'analytics.json'));
const read=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return d}};
let cfg=read(CF,{port:3000,youtube:'',tiktok:'',twitch:'',kick:'',kickRoom:''});
// Platform yang dinyalakan (switch di Koneksi). Pertama kali: YouTube & TikTok nyala; Twitch/Kick nyala hanya kalau username-nya sudah pernah diisi.
const PF4=['youtube','tiktok','twitch','kick'];
{const e=cfg.enabled||{};cfg.enabled={};PF4.forEach(p=>{cfg.enabled[p]=e[p]!=null?!!e[p]:(p==='youtube'||p==='tiktok'||!!cfg[p]);});}
const isEn=p=>cfg.enabled[p]!==false;
const saveCfg=()=>{try{fs.writeFileSync(CF,JSON.stringify(cfg,null,1));}catch{}};
let settings=read(SF,{});settings.dock=settings.dock||{};settings.overlay=settings.overlay||{};settings.global=settings.global||{};
if(!settings.global.tplSeeded){settings.global.templates=[...SEEDS,...(settings.global.templates||[]).filter(t=>!SEEDS.some(x=>x.id===t.id))];settings.global.tplSeeded=true;try{fs.writeFileSync(SF,JSON.stringify(settings));}catch{}}
{const MARK='/* twitch-kick */';let ch=false;
  (settings.global.templates||[]).forEach(t=>{const sd=SEEDS.find(x=>x.id===t.id);if(!sd||String(t.css||'').includes(MARK))return;const i=sd.css.indexOf(MARK);if(i>=0){t.css=String(t.css||'')+'\n'+sd.css.slice(i);ch=true;}});
  if(ch)try{fs.writeFileSync(SF,JSON.stringify(settings));}catch{}}
const P=require('./platforms.js');
let PORT=cfg.port||3000;const clients=new Set(),history=[],status={youtube:'',tiktok:'',twitch:'',kick:''},viewers={youtube:null,tiktok:null,twitch:null,kick:null};
let seq=0;const crypto=require('crypto');const hooks={};let ytLive='';let _ready;const ready=new Promise(r=>_ready=r);let autoStarted=false;
function autoStart(){if(autoStarted)return;autoStarted=true;setTimeout(()=>{startYT();setTimeout(startTT,600);setTimeout(startTW,1000);setTimeout(startKK,1400);},2500);}
function chatUrl(p){
  if(p==='youtube'){const t=ytTarget(cfg.youtube);if(!t)return '';if(t.liveId)return 'https://www.youtube.com/watch?v='+t.liveId;if(t.handle)return 'https://www.youtube.com/'+t.handle+'/live';if(t.channelId)return 'https://www.youtube.com/channel/'+t.channelId+'/live';return '';}
  if(p==='twitch'){const u=twTarget(cfg.twitch);return u?'https://www.twitch.tv/popout/'+u+'/chat?popout=':'';}
  if(p==='kick'){const u=kkTarget(cfg.kick);return u?'https://kick.com/'+u:'';}
  const u=ttTarget(cfg.tiktok);return u?'https://www.tiktok.com/@'+u+'/live':'';}
function cmd(name){if(name==='clear')history.length=0;emit('cmd',{name});}
// URL widget Donate Dock: kosong = fitur diam (''), hanya http/https yang diterima, selain itu null (ditolak)
function cleanDonateUrl(u){const v=String(u==null?'':u).trim();if(!v)return '';let x;try{x=new URL(v);}catch{return null;}return(x.protocol==='http:'||x.protocol==='https:')?x.href:null;}
function setGlobal(v){settings.global={...settings.global,...v};fs.writeFileSync(SF,JSON.stringify(settings));emit('settings',settings);if(v.protect!==undefined&&hooks.protect)hooks.protect(settings.global.protect!==false);if(hooks.global)hooks.global(settings.global);}
module.exports={hooks,ready,cmd,setGlobal,cleanDonateUrl,flush:()=>stats.flush(),get port(){return PORT;}};
process.on('exit',()=>{try{stats.flush();}catch{}});
const AVOID=[[3306,'MySQL'],[3389,'Remote Desktop Windows'],[4200,'Angular'],[4455,'OBS WebSocket (dipakai tombol Tambahkan overlay ke OBS)'],[5000,'Flask / AirPlay'],[5173,'Vite'],[5432,'PostgreSQL'],[5500,'Live Server VS Code'],[5900,'VNC'],[6379,'Redis'],[8000,'server web lokal'],[8080,'server web / proxy'],[8888,'Jupyter'],[27017,'MongoDB']].map(([port,name])=>({port,name}));
const BOTS=['nightbot','streamelements','streamlabs','moobot','fossabot','wizebot','soundalerts','restreambot','botrix','sery_bot','pretzelrocks','coebot','deepbot','phantombot','ankhbot','vivbot'];
const isBot=n=>{n=(n||'').toLowerCase().trim();const c=(settings.global.botNames||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);return BOTS.includes(n)||c.includes(n);};
function emit(type,data){const s=`data: ${JSON.stringify({type,data})}\n\n`;clients.forEach(r=>r.write(s));}
function push(m){m.t=Date.now();m.id=++seq;if(!m.kind)m.bot=isBot(m.name);history.push(m);if(history.length>300)history.shift();emit('msg',m);if(m.kind!=='like'){try{stats.add(m);}catch{}}}
function setStatus(k,v){status[k]=v;console.log(`[${k}] ${v}`);emit('status',status);}
function setViewers(k,n){viewers[k]=n;emit('viewers',viewers);if(n!=null&&!stats.active())stats.tick(viewers.youtube,viewers.tiktok,viewers.twitch,viewers.kick);}
setInterval(()=>{try{stats.tick(viewers.youtube,viewers.tiktok,viewers.twitch,viewers.kick);}catch{}},15000).unref();
const first=u=>{if(!u)return'';for(const k of['avatarThumb','avatarMedium','avatarLarge','profilePicture']){const i=u[k];if(i){const x=(i.urlList&&i.urlList[0])||(i.urls&&i.urls[0])||i.url;if(x)return x;}}return'';};

const FILES={'/yt.png':'image/png','/tt.png':'image/png','/tw.png':'image/png','/kick.png':'image/png','/icon.png':'image/png'};
const srv=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(req.method==='POST'){const o=req.headers.origin;if(o&&o!==`http://localhost:${PORT}`&&o!==`http://127.0.0.1:${PORT}`){res.writeHead(403);return res.end('forbidden');}}
  const body=cb=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{cb(b?JSON.parse(b):{})}catch(e){console.log(e)}res.end('ok')});};
  if(u.pathname==='/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});
    res.write(`data: ${JSON.stringify({type:'init',data:{history:history.filter(m=>isEn(m.p)),settings,cfg:{enabled:cfg.enabled,youtube:cfg.youtube,tiktok:cfg.tiktok,twitch:cfg.twitch||'',kick:cfg.kick||'',kickRoom:cfg.kickRoom||'',port:PORT,wanted:cfg.port||3000,avoid:AVOID},status,viewers}})}\n\n`);
    clients.add(res);req.on('close',()=>clients.delete(res));return;
  }
  if(req.method==='POST'){
    const json=async fn=>{let b='';await new Promise(r=>{req.on('data',c=>b+=c);req.on('end',r);});let out;try{out=await fn(b?JSON.parse(b):{});}catch(e){out={error:String(e&&e.message||e)};}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(out));};
    if(u.pathname==='/port-set')return json(async({port})=>{const p=Number(port);
      if(!Number.isInteger(p)||p<1024||p>65535)return{error:'Port harus angka bulat antara 1024 dan 65535.'};
      if(p!==PORT){const av=AVOID.find(x=>x.port===p);if(av)return{error:'localhost:'+p+' telah digunakan oleh '+av.name+'. Pilih port lain (tombol Hindari menampilkan daftarnya).'};
        const free=await new Promise(r=>{const t=require('net').createServer();t.once('error',()=>r(false));t.once('listening',()=>t.close(()=>r(true)));t.listen(p);});
        if(!free)return{error:'localhost:'+p+' telah digunakan oleh program lain. Pilih port lain.'};}
      cfg.port=p;fs.writeFileSync(CF,JSON.stringify(cfg,null,1));return{ok:true,restart:p!==PORT};});
    if(u.pathname==='/export-css')return json(async({name,css})=>{if(!hooks.saveCss)return{error:'hanya di aplikasi desktop'};const n=String(name||'gaya-overlay').replace(/[\\/:*?"<>|]+/g,'-').slice(0,80)||'gaya-overlay';return await hooks.saveCss(n,String(css||'').slice(0,400000));});
    if(u.pathname==='/platform')return json(async({platform,on,user})=>{
      if(!PF4.includes(platform))return{error:'platform tidak dikenal'};
      cfg.enabled[platform]=!!on;if(on&&typeof user==='string'&&user.trim())cfg[platform]=user.trim();
      saveCfg();({youtube:startYT,tiktok:startTT,twitch:startTW,kick:startKK})[platform]();
      emit('cfg',{enabled:cfg.enabled});return{ok:true,enabled:cfg.enabled};});
    // chat contoh dari Dashboard (tombol "Kirim Chat ke Dock / Overlay"): hanya ditampilkan di tujuannya, tidak masuk riwayat dan tidak masuk statistik
    if(u.pathname==='/sample')return body(({m,target})=>{if(!m||typeof m!=='object'||!PF4.includes(m.p)||!isEn(m.p)||(target!=='dock'&&target!=='overlay'))return;
      emit('msg',{...m,t:Date.now(),id:++seq,sample:true,target});});
    if(u.pathname==='/sample-clear')return body(()=>emit('sampleclear',{}));
    if(u.pathname==='/analytics-new')return body(()=>stats.end());
    if(u.pathname==='/analytics-del')return body(({id})=>stats.remove(String(id||'')));
    if(u.pathname==='/restart')return body(()=>{if(hooks.relaunch)setTimeout(()=>hooks.relaunch(),300);});
    if(u.pathname==='/send')return json(async({text,targets})=>{const out={},tx=String(text||'').slice(0,190);for(const t of targets||[])out[t]=await extSend(t,tx);return out;});
    if(u.pathname==='/win')return body(({which,act})=>{if(hooks.winCtl)hooks.winCtl(which,act);});
    if(u.pathname==='/draft')return body(d=>emit('draft',d));
    if(u.pathname==='/draft-clear')return body(()=>emit('draftclear',{}));
    if(u.pathname==='/hotkeys')return json(async({hotkeys})=>{settings.global={...settings.global,hotkeys};fs.writeFileSync(SF,JSON.stringify(settings));emit('settings',settings);return hooks.setHotkeys?hooks.setHotkeys(hotkeys||{}):{};});
    if(u.pathname==='/templates-restore')return body(()=>{const have=new Set((settings.global.templates||[]).map(t=>t.id));settings.global.templates=[...SEEDS.filter(x=>!have.has(x.id)),...(settings.global.templates||[])];fs.writeFileSync(SF,JSON.stringify(settings));emit('settings',settings);});
    if(u.pathname==='/send-set')return body(({on})=>setGlobal({sendOn:on!==false}));
    if(u.pathname==='/donate-set')return json(async({url})=>{const v=cleanDonateUrl(url);if(v===null)return{error:'URL tidak valid. Pakai alamat widget yang diawali http:// atau https://, contoh https://saweria.co/widgets/...'};setGlobal({donateUrl:v});return{ok:true,url:v};});
    if(u.pathname==='/donate-mute')return body(({on})=>setGlobal({donateMute:!!on}));
    if(u.pathname==='/donate')return json(async({act})=>{if(!hooks.donate)return{error:'hanya di aplikasi desktop'};return(await hooks.donate(String(act||'')))||{ok:true};});
    if(u.pathname==='/protect-toggle')return body(()=>setGlobal({protect:settings.global.protect===false}));
    if(u.pathname==='/shape')return body(({rects})=>{if(hooks.shape)hooks.shape(Array.isArray(rects)?rects:[]);});
    if(u.pathname==='/ready')return body(()=>autoStart());
    if(u.pathname==='/log')return body(({msg})=>{try{fs.appendFileSync(path.join(base,'log.txt'),new Date().toISOString()+' '+String(msg).slice(0,800)+'\n');}catch{}});
    if(u.pathname==='/drag')return body(({on})=>{if(hooks.drag)hooks.drag(!!on);});
    if(u.pathname==='/lock')return body(({on})=>{if(hooks.lock)hooks.lock(!!on);});
    if(u.pathname==='/settings-window')return body(()=>{if(hooks.openSettings)hooks.openSettings();});
    if(u.pathname==='/open')return json(async({what,id})=>{if(!hooks.open)return{error:'hanya di aplikasi desktop'};
      if(what==='chat'){if(hooks.openChat)hooks.openChat();return{ok:true};}
      if(what==='ext'){hooks.open('ext');return{ok:true};}
      if(what==='tpladd'){hooks.window('/?view=tpladd'+(id?'&id='+encodeURIComponent(id):''),{width:980,height:600,title:'Gaya baru'});return{ok:true};}
      if(what==='templates'){hooks.window('/?view=tpl',{width:980,height:820,title:'Kelola gaya overlay'});return{ok:true};}
      if(what==='report'){if(hooks.openReport)hooks.openReport();else hooks.window('/?view=report',{width:1040,height:840,title:'Laporan penonton'});return{ok:true};}
      if(what==='preview'){hooks.window('/?view=overlay&preview=1',{width:480,height:760,title:'Pratinjau overlay OBS'});return{ok:true};}
      if(['youtube','tiktok','twitch','kick'].includes(what)){const u2=chatUrl(what);if(!u2)return{error:'Isi username '+({youtube:'YouTube',tiktok:'TikTok',twitch:'Twitch',kick:'Kick'})[what]+' dulu di Koneksi.'};hooks.open(u2);return{ok:true};}
      return{error:'tidak dikenal'};});
    if(u.pathname==='/obs-add')return json(async o=>{await obsAdd({...o,url:`http://localhost:${PORT}/?view=overlay`});return{ok:true};});
    if(u.pathname==='/settings')return body(({view,values})=>{settings[view]=view==='global'?{...settings.global,...values}:values;fs.writeFileSync(SF,JSON.stringify(settings));emit('settings',settings);if(view==='global'){if(hooks.protect)hooks.protect(settings.global.protect!==false);if(hooks.global)hooks.global(settings.global);}});
    if(u.pathname==='/connect')return body(({youtube,tiktok,twitch,kick,kickRoom})=>{cfg.youtube=youtube||'';cfg.tiktok=tiktok||'';cfg.twitch=twitch||'';cfg.kick=kick||'';cfg.kickRoom=String(kickRoom||'').replace(/\D/g,'');fs.writeFileSync(CF,JSON.stringify(cfg,null,1));startYT();startTT();startTW();startKK();});
    if(u.pathname==='/disconnect')return body(()=>stopAll());
    if(u.pathname==='/test')return body(()=>{
      [['tiktok','dewi.anggraini','kak main game apa hari ini?'],['youtube','Budi Santoso','mantap bang, gas terus!'],['youtube','Nightbot','Jangan lupa subscribe dan follow ya!'],['youtube','Andi Pratama','selamat datang semuanya',{mod:true}],['tiktok','rizkyy_','seru banget live-nya!!'],['youtube','Sinta_Rahma','Terima kasih banyak kak, semangat terus!',{sc:{amount:'Rp50.000',color:'#ffca28'}}],
        ['tiktok','rizkyy_',undefined,{kind:'join'}],['tiktok','Budi',undefined,{kind:'gift',gift:'Rose',n:5,coins:5}],['tiktok','dewi.anggraini',undefined,{kind:'follow'}],['tiktok','Sinta_Rahma',undefined,{kind:'like',others:3,n:48}],['tiktok','Andi',undefined,{kind:'share'}],['tiktok','Rina',undefined,{kind:'sub'}],
        ['twitch','gamer_jaya','gas terus bang Kappa',{emo:[[19,24,'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0']],vip:true}],['twitch','Rina_K','nonton dari tadi, seru!',{member:true}],['twitch','BudiBits','mantap kontennya',{sc:{amount:'500 bits',color:'#9c3ee8',bits:500}}],
        ['twitch','Joko',undefined,{kind:'sub',plan:'1000',months:12,text:'makasih bang!'}],['twitch','Sari',undefined,{kind:'gift',n:5,plan:'1000'}],['twitch','StreamerBesar',undefined,{kind:'raid',n:120}],['twitch','Mod1','Giveaway mulai jam 8 malam!',{kind:'announce'}],
        ['kick','kick_fans','halo semuanya dari Kick!',{owner:false,mod:true}],['kick','Dimas','sini kak, GG',{member:true}],['kick','Putri','semangat live-nya',{sc:{amount:'100 Kicks',color:'#53fc18',kicks:100}}],
        ['kick','Andre',undefined,{kind:'follow'}],['kick','Wulan',undefined,{kind:'sub',months:3}],['kick','Bayu',undefined,{kind:'gift',n:3}],['kick','Tono',undefined,{kind:'raid',n:80}],['kick','Lia',undefined,{kind:'reward',title:'Pilih lagu',text:'Dewa 19 - Pupus'}]]
        .forEach(([p,name,text,x],i)=>setTimeout(()=>push({p,name,text,test:true,...(x||{})}),i*400));
    });
  }
  if(u.pathname==='/analytics'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(stats.get(u.searchParams.get('id')||'cur',viewers)));}
  if(u.pathname==='/state'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({protect:settings.global.protect!==false}));}
  if(u.pathname==='/account'){res.writeHead(200,{'Content-Type':'application/json'});const has=p=>[...ext].some(c=>c.platform===p&&c.ws.readyState===1);return res.end(JSON.stringify({youtube:has('youtube'),tiktok:has('tiktok'),twitch:has('twitch'),kick:has('kick')}));}
  if(u.pathname==='/urls'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({youtube:chatUrl('youtube'),tiktok:chatUrl('tiktok'),twitch:chatUrl('twitch'),kick:chatUrl('kick')}));}
  if(FILES[u.pathname]){res.writeHead(200,{'Content-Type':FILES[u.pathname],'Cache-Control':'max-age=3600'});return res.end(fs.readFileSync(path.join(__dirname,u.pathname)));}
  if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    let h=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
    const v=u.searchParams.get('view'),th=(settings.dock&&settings.dock.theme)||'standar';
    if(['neo','glass','clay','liquid','spatial'].includes(th)&&v!=='overlay'&&v!=='ctl'&&!u.searchParams.get('locked')&&!u.searchParams.get('preview'))h=h.replace('<body class="dock p-polos">','<body class="dock p-polos th-'+th+'">');
    return res.end(h);}
  res.writeHead(404);res.end();
});
function tryListen(p,left){
  const onErr=e=>{srv.removeListener('listening',onOk);
    if(e.code==='EADDRINUSE'&&left>0)return tryListen(p+1,left-1);
    throw new Error(e.code==='EADDRINUSE'?'Port 3000 sampai 3010 sedang dipakai program lain. Tutup program itu lalu buka ulang ChatStream Labs.':String(e&&e.message||e));};
  const onOk=()=>{srv.removeListener('error',onErr);PORT=p;console.log(`ChatStream Labs jalan di http://localhost:${PORT}`);_ready();setTimeout(autoStart,12000);};
  srv.once('error',onErr);srv.once('listening',onOk);srv.listen(p);
}
tryListen(PORT,10);


function ytTarget(s){s=(s||'').trim();let m;
  if(m=s.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/))return{liveId:m[1]};
  if(m=s.match(/youtube\.com\/(@[\w.\-]+)/)||s.match(/^(@[\w.\-]+)$/))return{handle:m[1]};
  if(m=s.match(/youtube\.com\/channel\/(UC[\w-]+)/))return{channelId:m[1]};
  if(/^[\w.\-]{3,30}$/.test(s))return{handle:'@'+s};return null;}
function ttTarget(s){const m=(s||'').trim().match(/tiktok\.com\/@([\w.]+)/)||(s||'').trim().match(/^@?([\w.]+)$/);return m?m[1]:null;}

function twTarget(s){s=(s||'').trim();const m=s.match(/twitch\.tv\/([A-Za-z0-9_]{3,25})/)||s.match(/^@?([A-Za-z0-9_]{3,25})$/);return m?m[1].toLowerCase():null;}
// slug Kick = nama pengguna huruf kecil dengan garis bawah diganti tanda hubung
function kkTarget(s){s=(s||'').trim();const m=s.match(/kick\.com\/([A-Za-z0-9_\-]{3,25})/)||s.match(/^@?([A-Za-z0-9_\-]{3,25})$/);return m?m[1].toLowerCase().replace(/_/g,'-'):null;}

let genY=0,genT=0,genW=0,genK=0,stopY=null,stopT=null,stopW=null,stopK=null,vyTimer=null,vwTimer=null,vkTimer=null;
function stopAll(){
  genY++;genT++;genW++;genK++;
  if(stopY){stopY();stopY=null;} if(stopT){stopT();stopT=null;} if(stopW){stopW();stopW=null;} if(stopK){stopK();stopK=null;}
  ytLive='';clearTimeout(vyTimer);clearTimeout(vwTimer);clearTimeout(vkTimer);['youtube','tiktok','twitch','kick'].forEach(k=>setViewers(k,null));
  ['youtube','tiktok','twitch','kick'].forEach(k=>setStatus(k,isEn(k)?'terputus':'nonaktif'));
}
function pollYT(id,my){
  clearTimeout(vyTimer);
  const run=async()=>{
    if(my!==genY)return;
    try{const t=(await(await fetch('https://www.youtube.com/live_stats?v='+id)).text()).trim();const n=parseInt(t,10);setViewers('youtube',isNaN(n)?null:n);}catch{setViewers('youtube',null);}
    vyTimer=setTimeout(run,20000);
  };run();
}
function startYT(){
  const my=++genY;if(stopY){stopY();stopY=null;}clearTimeout(vyTimer);setViewers('youtube',null);
  if(!isEn('youtube'))return setStatus('youtube','nonaktif');
  if(!cfg.youtube)return setStatus('youtube','belum diisi');
  const t=ytTarget(cfg.youtube);if(!t)return setStatus('youtube','username tidak dikenali');
  let LiveChat;try{({LiveChat}=require('youtube-chat'));}catch(e){return setStatus('youtube','modul gagal dimuat: '+String(e&&e.message||e).split('\n')[0]);}
  const attempt=()=>{
    if(my!==genY)return;
    const lc=new LiveChat(t);let dead=false;
    const retry=msg=>{if(dead)return;dead=true;try{lc.stop()}catch{}if(my!==genY)return;setStatus('youtube',msg+' - coba lagi 15 detik');setTimeout(attempt,15000);};
    stopY=()=>{dead=true;try{lc.stop()}catch{}};
    lc.on('start',id=>{setStatus('youtube','terhubung');if(id){ytLive=id;pollYT(id,my);}});
    lc.on('chat',c=>push({p:'youtube',member:!!c.isMembership,sticker:!!(c.superchat&&c.superchat.sticker),sc:c.superchat?{amount:String(c.superchat.amount||''),color:/^#?[0-9a-f]{6}$/i.test(c.superchat.color||'')?('#'+String(c.superchat.color).replace('#','')):'#ffca28'}:undefined,name:c.author.name,avatar:(c.author.thumbnail&&c.author.thumbnail.url)||'',mod:!!c.isModerator,owner:!!c.isOwner,text:(c.message||[]).map(x=>x.text||x.emojiText||x.alt||'').join('')||((c.superchat&&c.superchat.sticker)?'[Super Sticker]':'')}));
    lc.on('error',e=>retry('gagal: '+(e&&e.message||e)));
    lc.on('end',()=>retry('live berakhir/terputus'));
    setStatus('youtube','menyambung...');
    lc.start().then(ok=>{if(!ok)retry('live tidak ditemukan (sudah mulai?)');}).catch(e=>retry('gagal: '+(e&&e.message||e)));
  };attempt();
}
let likeBuf=new Map(),likeT=null;
function likeAdd(name,n){likeBuf.set(name,(likeBuf.get(name)||0)+n);if(!likeT)likeT=setTimeout(()=>{likeT=null;const a=[...likeBuf].sort((x,y)=>y[1]-x[1]);likeBuf=new Map();if(!a.length)return;push({p:'tiktok',kind:'like',name:a[0][0],others:a.length-1,n:a.reduce((s,x)=>s+x[1],0)});},5000);}
function startTT(){
  const my=++genT;if(stopT){stopT();stopT=null;}setViewers('tiktok',null);
  if(!isEn('tiktok'))return setStatus('tiktok','nonaktif');
  if(!cfg.tiktok)return setStatus('tiktok','belum diisi');
  const user=ttTarget(cfg.tiktok);if(!user)return setStatus('tiktok','username tidak dikenali');
  let lib;try{lib=require('tiktok-live-connector');}catch(e){return setStatus('tiktok','modul gagal dimuat: '+String(e&&e.message||e).split('\n')[0]);}
  const {TikTokLiveConnection,WebcastEvent,ControlEvent}=lib;
  const attempt=()=>{
    if(my!==genT)return;
    const c=new TikTokLiveConnection(user,{});let dead=false;
    const retry=msg=>{if(dead)return;dead=true;try{c.disconnect()}catch{}if(my!==genT)return;setViewers('tiktok',null);setStatus('tiktok',msg+' - coba lagi 15 detik');setTimeout(attempt,15000);};
    stopT=()=>{dead=true;try{c.disconnect()}catch{}};
    c.on(WebcastEvent.CHAT,d=>{const u=d.user||{};push({p:'tiktok',name:u.nickname||u.displayId||u.uniqueId||'?',avatar:first(u),mod:!!(u.isModerator||u.isModeratorOfAnchor||(u.userAttr&&u.userAttr.isAdmin)),text:String(d.content??d.comment??'')});});
    // Semua handler aktivitas dibungkus safe(): bentuk payload bisa beda antar versi, dan tidak boleh sampai menjatuhkan aplikasi.
    const E=WebcastEvent||{},safe=f=>(...a)=>{try{f(...a);}catch(e){console.log('[tiktok] '+(e&&e.message||e));}},nm=u=>(u&&(u.nickname||u.displayId||u.uniqueId))||'?';
    c.on(E.MEMBER||'member',safe(d=>push({p:'tiktok',kind:'join',name:nm(d.user)})));
    c.on(E.FOLLOW||'follow',safe(d=>push({p:'tiktok',kind:'follow',name:nm(d.user)})));
    c.on(E.SHARE||'share',safe(d=>push({p:'tiktok',kind:'share',name:nm(d.user)})));
    c.on(E.SUBSCRIBE||'subscribe',safe(d=>push({p:'tiktok',kind:'sub',name:nm(d.user)})));
    c.on(E.GIFT||'gift',safe(d=>{
      const gd=d.giftDetails||d.gift||{},type=gd.giftType!=null?gd.giftType:d.giftType;
      if(type===1&&!d.repeatEnd)return; // streak masih berjalan: tunggu event akhir supaya tidak terhitung berkali-kali
      const n=Number(d.repeatCount)||1,dia=Number(gd.diamondCount!=null?gd.diamondCount:d.diamondCount)||0;
      const gi=gd.giftImage||gd.image||d.giftImage||{},img=gd.giftPictureUrl||d.giftPictureUrl||gi.giftPictureUrl||(gi.urlList&&gi.urlList[0])||(gd.icon&&gd.icon.urlList&&gd.icon.urlList[0])||'';
      push({p:'tiktok',kind:'gift',name:nm(d.user),gift:String(gd.giftName||gd.name||d.giftName||'hadiah'),n,coins:dia*n,img:/^https?:\/\//.test(img)?img:undefined});}));
    // like datang bertubi-tubi: dihitung semua untuk statistik, tapi ditampilkan sebagai satu baris per 5 detik
    c.on(E.LIKE||'like',safe(d=>{const n=Number(d.likeCount)||1;stats.like(n);likeAdd(nm(d.user),n);}));
    c.on(E.ROOM_USER||'roomUser',safe(d=>{
      // hanya penonton yang sedang menonton (viewerCount/total); popularity & totalUser bersifat kumulatif, sengaja tidak dipakai
      const a=[d.viewerCount,d.total].map(x=>x==null?NaN:Number(x)).filter(x=>Number.isFinite(x)&&x>=0);
      const n=a.find(x=>x>0);if(n!==undefined)setViewers('tiktok',n);else if(a.length)setViewers('tiktok',0);}));
    c.on(ControlEvent.DISCONNECTED,()=>retry('terputus'));
    setStatus('tiktok','menyambung...');
    c.connect().then(()=>setStatus('tiktok','terhubung')).catch(e=>retry('gagal: '+(e&&e.message||e)));
  };attempt();
}

// ===== Twitch: IRC lewat WebSocket tanpa login (akun anonim "justinfan", hanya bisa membaca) =====
function pollTW(login,my){
  clearTimeout(vwTimer);
  const run=async()=>{
    if(my!==genW)return;
    try{
      const r=await fetch('https://gql.twitch.tv/gql',{method:'POST',headers:{'Client-ID':'kimne78kx3ncx6brgo4mv6wki5h1ko','Content-Type':'application/json'},body:JSON.stringify({query:'query{user(login:"'+login+'"){stream{viewersCount}}}'})});
      const j=await r.json(),st=j&&j.data&&j.data.user&&j.data.user.stream;setViewers('twitch',st?Number(st.viewersCount)||0:null);
    }catch{setViewers('twitch',null);}
    vwTimer=setTimeout(run,30000);
  };run();
}
function startTW(){
  const my=++genW;if(stopW){stopW();stopW=null;}clearTimeout(vwTimer);setViewers('twitch',null);
  if(!isEn('twitch'))return setStatus('twitch','nonaktif');
  if(!cfg.twitch)return setStatus('twitch','belum diisi');
  const login=twTarget(cfg.twitch);if(!login)return setStatus('twitch','username tidak dikenali');
  let WS;try{WS=require('ws');}catch(e){return setStatus('twitch','modul gagal dimuat: '+String(e&&e.message||e).split('\n')[0]);}
  const attempt=()=>{
    if(my!==genW)return;
    let ws=null,dead=false;
    const retry=msg=>{if(dead)return;dead=true;try{ws&&ws.close()}catch{}if(my!==genW)return;setViewers('twitch',null);setStatus('twitch',msg+' - coba lagi 10 detik');setTimeout(attempt,10000);};
    stopW=()=>{dead=true;try{ws&&ws.close()}catch{}};
    setStatus('twitch','menyambung...');
    try{ws=new WS('wss://irc-ws.chat.twitch.tv:443');}catch(e){return retry('gagal: '+(e&&e.message||e));}
    ws.on('open',()=>{ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');ws.send('PASS SCHMOOPIIE');ws.send('NICK justinfan'+(10000+Math.floor(Math.random()*80000)));ws.send('JOIN #'+login);});
    ws.on('message',raw=>{
      for(const line of String(raw).split('\r\n')){
        if(!line)continue;
        if(line.startsWith('PING')){try{ws.send('PONG'+line.slice(4));}catch{}continue;}
        const m=P.parseIrc(line);if(!m)continue;
        if(m.cmd==='JOIN'){setStatus('twitch','terhubung');pollTW(login,my);continue;}
        if(m.cmd==='RECONNECT'){retry('Twitch meminta sambung ulang');return;}
        try{P.twitchLine(m).forEach(push);}catch(e){console.log('[twitch] '+(e&&e.message||e));}
      }
    });
    ws.on('error',e=>retry('gagal: '+(e&&e.message||e)));
    ws.on('close',()=>retry('terputus'));
  };attempt();
}

// ===== Kick: Pusher WebSocket (resmi dipakai situs Kick). Butuh ID chatroom, yang diambil dari API publik Kick =====
const KUA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function kickGet(url){
  let err='';
  try{const r=await fetch(url,{headers:{'User-Agent':KUA,Accept:'application/json','Accept-Language':'en-US,en;q=0.9'}});if(r.ok)return await r.json();err='HTTP '+r.status;}catch(e){err=String(e&&e.message||e);}
  // Kick dilindungi Cloudflare: cadangan lewat mesin jaringan Chromium milik Electron (lebih sering lolos daripada fetch Node)
  if(hooks.netFetch){try{const r=await hooks.netFetch(url);if(r.status===200)return JSON.parse(r.text);err='HTTP '+r.status;}catch(e){err=String(e&&e.message||e);}}
  throw new Error(err);
}
async function kickInfo(slug){
  let j;try{j=await kickGet('https://kick.com/api/v2/channels/'+slug);}catch{j=await kickGet('https://kick.com/api/v1/channels/'+slug);}
  return{room:j&&j.chatroom&&Number(j.chatroom.id)||0,channel:Number(j&&(j.id||(j.user&&j.user.id)))||0,viewers:j&&j.livestream?(Number(j.livestream.viewer_count)||0):null};
}
function pollKK(slug,my){
  clearTimeout(vkTimer);
  const run=async()=>{if(my!==genK)return;try{setViewers('kick',(await kickInfo(slug)).viewers);}catch{setViewers('kick',null);}vkTimer=setTimeout(run,30000);};
  vkTimer=setTimeout(run,3000);
}
function startKK(){
  const my=++genK;if(stopK){stopK();stopK=null;}clearTimeout(vkTimer);setViewers('kick',null);
  if(!isEn('kick'))return setStatus('kick','nonaktif');
  if(!cfg.kick)return setStatus('kick','belum diisi');
  const slug=kkTarget(cfg.kick);if(!slug)return setStatus('kick','username tidak dikenali');
  let WS;try{WS=require('ws');}catch(e){return setStatus('kick','modul gagal dimuat: '+String(e&&e.message||e).split('\n')[0]);}
  const attempt=async()=>{
    if(my!==genK)return;
    let ws=null,dead=false,room=Number(cfg.kickRoom)||0,chan=0;
    const retry=msg=>{if(dead)return;dead=true;try{ws&&ws.close()}catch{}if(my!==genK)return;setViewers('kick',null);setStatus('kick',msg+' - coba lagi 15 detik');setTimeout(attempt,15000);};
    stopK=()=>{dead=true;try{ws&&ws.close()}catch{}};
    setStatus('kick','menyambung...');
    try{const i=await kickInfo(slug);if(!room)room=i.room;chan=i.channel;}
    catch(e){if(!room)return retry('gagal ambil info channel ('+(e&&e.message||e)+'); isi "ID chatroom Kick" manual di Koneksi bila terus begini');}
    if(my!==genK||dead)return;
    if(!room)return retry('channel Kick tidak ditemukan');
    try{ws=new WS('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false');}catch(e){return retry('gagal: '+(e&&e.message||e));}
    const seen=new Set();
    ws.on('message',raw=>{
      let f;try{f=JSON.parse(String(raw));}catch{return;}
      const ev=String(f.event||'');
      if(ev==='pusher:connection_established'){
        ['chatrooms.'+room+'.v2',...(chan?['channel.'+chan,'channel_'+chan]:[])].forEach(c=>ws.send(JSON.stringify({event:'pusher:subscribe',data:{auth:'',channel:c}})));
      }else if(ev==='pusher_internal:subscription_succeeded'){if(/^chatrooms\.\d+\.v2$/.test(f.channel||'')){setStatus('kick','terhubung');pollKK(slug,my);}}
      else if(ev==='pusher:ping'){try{ws.send(JSON.stringify({event:'pusher:pong',data:{}}));}catch{}}
      else if(ev&&!ev.startsWith('pusher')){
        const key=ev+'|'+f.data;if(seen.has(key))return;seen.add(key);if(seen.size>200)seen.delete(seen.values().next().value);
        try{P.kickEvent(ev,f.data).forEach(push);}catch(e){console.log('[kick] '+(e&&e.message||e));}
      }
    });
    ws.on('error',e=>retry('gagal: '+(e&&e.message||e)));
    ws.on('close',()=>retry('terputus'));
  };attempt();
}

function obsAdd({password,port,width,height,url}){
  return new Promise((resolve,reject)=>{
    const WS=require('ws');let ws;try{ws=new WS('ws://127.0.0.1:'+(port||4455));}catch(e){return reject(e);}
    let n=0,done=false;const pend={};
    const fin=(f,v)=>{if(done)return;done=true;clearTimeout(timer);try{ws.close()}catch{}f(v);};
    const timer=setTimeout(()=>fin(reject,new Error('OBS tidak merespons. Pastikan OBS sedang terbuka.')),9000);
    const req=(type,data)=>new Promise((res,rej)=>{const id='r'+(++n);pend[id]={res,rej};ws.send(JSON.stringify({op:6,d:{requestType:type,requestId:id,requestData:data||{}}}));});
    ws.on('error',()=>fin(reject,new Error('Tidak bisa terhubung ke OBS. Di OBS buka Tools > WebSocket Server Settings, lalu centang Enable WebSocket server.')));
    ws.on('close',c=>{if(c===4009)fin(reject,new Error('Password WebSocket OBS salah.'));});
    ws.on('message',async raw=>{
      const m=JSON.parse(raw);
      if(m.op===0){
        const a=m.d.authentication,idt={rpcVersion:1,eventSubscriptions:0};
        if(a){if(!password)return fin(reject,new Error('OBS meminta password WebSocket. Isi kolom password OBS.'));
          const s1=crypto.createHash('sha256').update(password+a.salt).digest('base64');idt.authentication=crypto.createHash('sha256').update(s1+a.challenge).digest('base64');}
        ws.send(JSON.stringify({op:1,d:idt}));
      }else if(m.op===2){
        try{
          const sc=await req('GetCurrentProgramScene');const scene=sc.currentProgramSceneName||sc.sceneName;
          const NAME='ChatStream Overlay',st={url,width:+width||500,height:+height||900,fps:30,css:'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }'};
          try{await req('CreateInput',{sceneName:scene,inputName:NAME,inputKind:'browser_source',inputSettings:st,sceneItemEnabled:true});}
          catch(e){if(e.code!==601)throw e;await req('SetInputSettings',{inputName:NAME,inputSettings:st,overlay:true});try{await req('CreateSceneItem',{sceneName:scene,sourceName:NAME,sceneItemEnabled:true});}catch{}}
          fin(resolve,{scene});
        }catch(e){fin(reject,e);}
      }else if(m.op===7){
        const p=pend[m.d.requestId];if(!p)return;delete pend[m.d.requestId];
        m.d.requestStatus.result?p.res(m.d.responseData||{}):p.rej(Object.assign(new Error(m.d.requestStatus.comment||'permintaan ke OBS gagal'),{code:m.d.requestStatus.code}));
      }
    });
  });
}

// ===== jembatan ke ekstensi Chrome (kirim chat) =====
const {WebSocketServer}=require('ws');
const wss=new WebSocketServer({noServer:true}),ext=new Set(),pendingExt={};
srv.on('upgrade',(req,sock,head)=>{
  const u=new URL(req.url,'http://x'),o=req.headers.origin||'';
  const okO=!o||/^https:\/\/(www\.)?(youtube\.com|tiktok\.com|twitch\.tv|kick\.com)$/.test(o)||o.startsWith('chrome-extension://');
  if(u.pathname!=='/ext'||!okO){sock.destroy();return;}
  wss.handleUpgrade(req,sock,head,w=>wss.emit('connection',w,req));
});
wss.on('connection',ws=>{
  const c={ws,platform:''};ext.add(c);
  ws.on('message',raw=>{try{const m=JSON.parse(raw);
    if(m.type==='hello'&&PF4.includes(m.platform))c.platform=m.platform;
    else if(m.type==='result'&&pendingExt[m.id]){pendingExt[m.id](m);delete pendingExt[m.id];}}catch{}});
  ws.on('close',()=>ext.delete(c));ws.on('error',()=>ext.delete(c));
});
function extSend(platform,text){return new Promise(resolve=>{
  const c=[...ext].find(x=>x.platform===platform&&x.ws.readyState===1);
  if(!c)return resolve('ekstensi Chrome belum terhubung. Buka halaman chat '+({youtube:'YouTube',tiktok:'TikTok',twitch:'Twitch',kick:'Kick'})[platform]+' di Chrome (lihat Dashboard > Koneksi).');
  const id=String(++seq),t=setTimeout(()=>{delete pendingExt[id];resolve('halaman chat tidak merespons');},9000);
  pendingExt[id]=m=>{clearTimeout(t);resolve(m.ok?'ok':(m.error||'gagal'));};
  c.ws.send(JSON.stringify({type:'send',id,text}));});}
