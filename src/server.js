const http=require('http'),fs=require('fs'),path=require('path');
const SEEDS=require('./seeds.json');
const base=process.env.CG_DATA||__dirname;
const CF=path.join(base,'config.json'),SF=path.join(base,'settings.json');
const read=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return d}};
let cfg=read(CF,{port:3000,youtube:'',tiktok:''});
let settings=read(SF,{});settings.dock=settings.dock||{};settings.overlay=settings.overlay||{};settings.global=settings.global||{};
if(!settings.global.tplSeeded){settings.global.templates=[...SEEDS,...(settings.global.templates||[]).filter(t=>!SEEDS.some(x=>x.id===t.id))];settings.global.tplSeeded=true;try{fs.writeFileSync(SF,JSON.stringify(settings));}catch{}}
let PORT=cfg.port||3000;const clients=new Set(),history=[],status={youtube:'',tiktok:''},viewers={youtube:null,tiktok:null};
let seq=0;const crypto=require('crypto');const hooks={};let ytLive='';let _ready;const ready=new Promise(r=>_ready=r);let autoStarted=false;
function autoStart(){if(autoStarted)return;autoStarted=true;setTimeout(()=>{startYT();setTimeout(startTT,600);},2500);}
function chatUrl(p){
  if(p==='youtube'){const t=ytTarget(cfg.youtube);if(!t)return '';if(t.liveId)return 'https://www.youtube.com/watch?v='+t.liveId;if(t.handle)return 'https://www.youtube.com/'+t.handle+'/live';if(t.channelId)return 'https://www.youtube.com/channel/'+t.channelId+'/live';return '';}
  const u=ttTarget(cfg.tiktok);return u?'https://www.tiktok.com/@'+u+'/live':'';}
function cmd(name){if(name==='clear')history.length=0;emit('cmd',{name});}
function setGlobal(v){settings.global={...settings.global,...v};fs.writeFileSync(SF,JSON.stringify(settings));emit('settings',settings);if(v.protect!==undefined&&hooks.protect)hooks.protect(settings.global.protect!==false);if(hooks.global)hooks.global(settings.global);}
module.exports={hooks,ready,cmd,setGlobal,get port(){return PORT;}};
const AVOID=[[3306,'MySQL'],[3389,'Remote Desktop Windows'],[4200,'Angular'],[4455,'OBS WebSocket (dipakai tombol Tambahkan overlay ke OBS)'],[5000,'Flask / AirPlay'],[5173,'Vite'],[5432,'PostgreSQL'],[5500,'Live Server VS Code'],[5900,'VNC'],[6379,'Redis'],[8000,'server web lokal'],[8080,'server web / proxy'],[8888,'Jupyter'],[27017,'MongoDB']].map(([port,name])=>({port,name}));
const BOTS=['nightbot','streamelements','streamlabs','moobot','fossabot','wizebot','soundalerts','restreambot','botrix','sery_bot','pretzelrocks','coebot','deepbot','phantombot','ankhbot','vivbot'];
const isBot=n=>{n=(n||'').toLowerCase().trim();const c=(settings.global.botNames||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);return BOTS.includes(n)||c.includes(n);};
function emit(type,data){const s=`data: ${JSON.stringify({type,data})}\n\n`;clients.forEach(r=>r.write(s));}
function push(m){m.t=Date.now();m.id=++seq;if(m.kind!=='join')m.bot=isBot(m.name);history.push(m);if(history.length>300)history.shift();emit('msg',m);}
function setStatus(k,v){status[k]=v;console.log(`[${k}] ${v}`);emit('status',status);}
function setViewers(k,n){viewers[k]=n;emit('viewers',viewers);}
const first=u=>{if(!u)return'';for(const k of['avatarThumb','avatarMedium','avatarLarge','profilePicture']){const i=u[k];if(i){const x=(i.urlList&&i.urlList[0])||(i.urls&&i.urls[0])||i.url;if(x)return x;}}return'';};

const FILES={'/yt.png':'image/png','/tt.png':'image/png','/icon.png':'image/png'};
const srv=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(req.method==='POST'){const o=req.headers.origin;if(o&&o!==`http://localhost:${PORT}`&&o!==`http://127.0.0.1:${PORT}`){res.writeHead(403);return res.end('forbidden');}}
  const body=cb=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{cb(b?JSON.parse(b):{})}catch(e){console.log(e)}res.end('ok')});};
  if(u.pathname==='/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});
    res.write(`data: ${JSON.stringify({type:'init',data:{history,settings,cfg:{youtube:cfg.youtube,tiktok:cfg.tiktok,port:PORT,wanted:cfg.port||3000,avoid:AVOID},status,viewers}})}\n\n`);
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
    if(u.pathname==='/restart')return body(()=>{if(hooks.relaunch)setTimeout(()=>hooks.relaunch(),300);});
    if(u.pathname==='/send')return json(async({text,targets})=>{const out={},tx=String(text||'').slice(0,190);for(const t of targets||[])out[t]=await extSend(t,tx);return out;});
    if(u.pathname==='/win')return body(({which,act})=>{if(hooks.winCtl)hooks.winCtl(which,act);});
    if(u.pathname==='/draft')return body(d=>emit('draft',d));
    if(u.pathname==='/draft-clear')return body(()=>emit('draftclear',{}));
    if(u.pathname==='/hotkeys')return json(async({hotkeys})=>{settings.global={...settings.global,hotkeys};fs.writeFileSync(SF,JSON.stringify(settings));emit('settings',settings);return hooks.setHotkeys?hooks.setHotkeys(hotkeys||{}):{};});
    if(u.pathname==='/templates-restore')return body(()=>{const have=new Set((settings.global.templates||[]).map(t=>t.id));settings.global.templates=[...SEEDS.filter(x=>!have.has(x.id)),...(settings.global.templates||[])];fs.writeFileSync(SF,JSON.stringify(settings));emit('settings',settings);});
    if(u.pathname==='/protect-toggle')return body(()=>setGlobal({protect:settings.global.protect===false}));
    if(u.pathname==='/shape')return body(({rects})=>{if(hooks.shape)hooks.shape(Array.isArray(rects)?rects:[]);});
    if(u.pathname==='/ready')return body(()=>autoStart());
    if(u.pathname==='/log')return body(({msg})=>{try{fs.appendFileSync(path.join(base,'log.txt'),new Date().toISOString()+' '+String(msg).slice(0,800)+'\n');}catch{}});
    if(u.pathname==='/drag')return body(({on})=>{if(hooks.drag)hooks.drag(!!on);});
    if(u.pathname==='/lock')return body(({on})=>{if(hooks.lock)hooks.lock(!!on);});
    if(u.pathname==='/settings-window')return body(()=>{if(hooks.openSettings)hooks.openSettings();});
    if(u.pathname==='/open')return json(async({what,id})=>{if(!hooks.open)return{error:'hanya di aplikasi desktop'};
      if(what==='ext'){hooks.open('ext');return{ok:true};}
      if(what==='tpladd'){hooks.window('/?view=tpladd'+(id?'&id='+encodeURIComponent(id):''),{width:980,height:600,title:'Gaya baru'});return{ok:true};}
      if(what==='templates'){hooks.window('/?view=tpl',{width:980,height:820,title:'Kelola gaya overlay'});return{ok:true};}
      if(what==='preview'){hooks.window('/?view=overlay&preview=1',{width:480,height:760,title:'Pratinjau overlay OBS'});return{ok:true};}
      if(what==='youtube'||what==='tiktok'){const u2=chatUrl(what);if(!u2)return{error:what==='youtube'?'Isi username YouTube dulu di Koneksi.':'Isi username TikTok dulu di Koneksi.'};hooks.open(u2);return{ok:true};}
      return{error:'tidak dikenal'};});
    if(u.pathname==='/obs-add')return json(async o=>{await obsAdd({...o,url:`http://localhost:${PORT}/?view=overlay`});return{ok:true};});
    if(u.pathname==='/settings')return body(({view,values})=>{settings[view]=view==='global'?{...settings.global,...values}:values;fs.writeFileSync(SF,JSON.stringify(settings));emit('settings',settings);if(view==='global'){if(hooks.protect)hooks.protect(settings.global.protect!==false);if(hooks.global)hooks.global(settings.global);}});
    if(u.pathname==='/connect')return body(({youtube,tiktok})=>{cfg.youtube=youtube||'';cfg.tiktok=tiktok||'';fs.writeFileSync(CF,JSON.stringify(cfg,null,1));startYT();startTT();});
    if(u.pathname==='/disconnect')return body(()=>stopAll());
    if(u.pathname==='/test')return body(()=>{
      [['tiktok','dewi.anggraini','kak main game apa hari ini?'],['youtube','Budi Santoso','mantap bang, gas terus!'],['youtube','Nightbot','Jangan lupa subscribe dan follow ya!'],['youtube','Andi Pratama','selamat datang semuanya',{mod:true}],['tiktok','rizkyy_','seru banget live-nya!!'],['youtube','Sinta_Rahma','Terima kasih banyak kak, semangat terus!',{sc:{amount:'Rp50.000',color:'#ffca28'}}]]
        .forEach(([p,name,text,x],i)=>setTimeout(()=>push({p,name,text,test:true,...(x||{})}),i*400));
    });
  }
  if(u.pathname==='/state'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({protect:settings.global.protect!==false}));}
  if(u.pathname==='/account'){res.writeHead(200,{'Content-Type':'application/json'});const has=p=>[...ext].some(c=>c.platform===p&&c.ws.readyState===1);return res.end(JSON.stringify({youtube:has('youtube'),tiktok:has('tiktok')}));}
  if(u.pathname==='/urls'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({youtube:chatUrl('youtube'),tiktok:chatUrl('tiktok')}));}
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
    throw new Error(e.code==='EADDRINUSE'?'Port 3000 sampai 3010 sedang dipakai program lain. Tutup program itu lalu buka ulang ChatLivestream Labs.':String(e&&e.message||e));};
  const onOk=()=>{srv.removeListener('error',onErr);PORT=p;console.log(`ChatLivestream Labs jalan di http://localhost:${PORT}`);_ready();setTimeout(autoStart,12000);};
  srv.once('error',onErr);srv.once('listening',onOk);srv.listen(p);
}
tryListen(PORT,10);


function ytTarget(s){s=(s||'').trim();let m;
  if(m=s.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/))return{liveId:m[1]};
  if(m=s.match(/youtube\.com\/(@[\w.\-]+)/)||s.match(/^(@[\w.\-]+)$/))return{handle:m[1]};
  if(m=s.match(/youtube\.com\/channel\/(UC[\w-]+)/))return{channelId:m[1]};
  if(/^[\w.\-]{3,30}$/.test(s))return{handle:'@'+s};return null;}
function ttTarget(s){const m=(s||'').trim().match(/tiktok\.com\/@([\w.]+)/)||(s||'').trim().match(/^@?([\w.]+)$/);return m?m[1]:null;}

let genY=0,genT=0,stopY=null,stopT=null,vyTimer=null;
function stopAll(){
  genY++;genT++;
  if(stopY){stopY();stopY=null;} if(stopT){stopT();stopT=null;}
  ytLive='';clearTimeout(vyTimer);setViewers('youtube',null);setViewers('tiktok',null);
  setStatus('youtube','terputus');setStatus('tiktok','terputus');
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
  if(!cfg.youtube)return setStatus('youtube','belum diisi');
  const t=ytTarget(cfg.youtube);if(!t)return setStatus('youtube','username tidak dikenali');
  let LiveChat;try{({LiveChat}=require('youtube-chat'));}catch(e){return setStatus('youtube','modul gagal dimuat: '+String(e&&e.message||e).split('\n')[0]);}
  const attempt=()=>{
    if(my!==genY)return;
    const lc=new LiveChat(t);let dead=false;
    const retry=msg=>{if(dead)return;dead=true;try{lc.stop()}catch{}if(my!==genY)return;setStatus('youtube',msg+' - coba lagi 15 detik');setTimeout(attempt,15000);};
    stopY=()=>{dead=true;try{lc.stop()}catch{}};
    lc.on('start',id=>{setStatus('youtube','terhubung');if(id){ytLive=id;pollYT(id,my);}});
    lc.on('chat',c=>push({p:'youtube',sc:c.superchat?{amount:String(c.superchat.amount||''),color:/^#?[0-9a-f]{6}$/i.test(c.superchat.color||'')?('#'+String(c.superchat.color).replace('#','')):'#ffca28'}:undefined,name:c.author.name,avatar:(c.author.thumbnail&&c.author.thumbnail.url)||'',mod:!!c.isModerator,owner:!!c.isOwner,text:(c.message||[]).map(x=>x.text||x.emojiText||x.alt||'').join('')}));
    lc.on('error',e=>retry('gagal: '+(e&&e.message||e)));
    lc.on('end',()=>retry('live berakhir/terputus'));
    setStatus('youtube','menyambung...');
    lc.start().then(ok=>{if(!ok)retry('live tidak ditemukan (sudah mulai?)');}).catch(e=>retry('gagal: '+(e&&e.message||e)));
  };attempt();
}
function startTT(){
  const my=++genT;if(stopT){stopT();stopT=null;}setViewers('tiktok',null);
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
    c.on(WebcastEvent.MEMBER,d=>{const u=d.user||{};push({p:'tiktok',kind:'join',name:u.nickname||u.displayId||u.uniqueId||'?'});});
    c.on(WebcastEvent.ROOM_USER,d=>{const n=[d.viewerCount,d.total,d.popularity,d.totalUser].map(Number).find(x=>Number.isFinite(x)&&x>=0);if(n!==undefined)setViewers('tiktok',n);});
    c.on(ControlEvent.DISCONNECTED,()=>retry('terputus'));
    setStatus('tiktok','menyambung...');
    c.connect().then(()=>setStatus('tiktok','terhubung')).catch(e=>retry('gagal: '+(e&&e.message||e)));
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
          const NAME='ChatLivestream Overlay',st={url,width:+width||500,height:+height||900,fps:30,css:'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }'};
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
  const okO=!o||/^https:\/\/(www\.)?(youtube|tiktok)\.com$/.test(o)||o.startsWith('chrome-extension://');
  if(u.pathname!=='/ext'||!okO){sock.destroy();return;}
  wss.handleUpgrade(req,sock,head,w=>wss.emit('connection',w,req));
});
wss.on('connection',ws=>{
  const c={ws,platform:''};ext.add(c);
  ws.on('message',raw=>{try{const m=JSON.parse(raw);
    if(m.type==='hello'&&(m.platform==='youtube'||m.platform==='tiktok'))c.platform=m.platform;
    else if(m.type==='result'&&pendingExt[m.id]){pendingExt[m.id](m);delete pendingExt[m.id];}}catch{}});
  ws.on('close',()=>ext.delete(c));ws.on('error',()=>ext.delete(c));
});
function extSend(platform,text){return new Promise(resolve=>{
  const c=[...ext].find(x=>x.platform===platform&&x.ws.readyState===1);
  if(!c)return resolve('ekstensi Chrome belum terhubung. Buka halaman chat '+(platform==='youtube'?'YouTube':'TikTok')+' di Chrome (lihat Pengaturan > Koneksi).');
  const id=String(++seq),t=setTimeout(()=>{delete pendingExt[id];resolve('halaman chat tidak merespons');},9000);
  pendingExt[id]=m=>{clearTimeout(t);resolve(m.ok?'ok':(m.error||'gagal'));};
  c.ws.send(JSON.stringify({type:'send',id,text}));});}
