const {app,BrowserWindow,WebContentsView,session,dialog,Menu,shell,Tray,globalShortcut,nativeImage,screen}=require('electron');
const path=require('path'),fs=require('fs');
const ICON=path.join(__dirname,'icon.png');
const gotLock=app.requestSingleInstanceLock();
if(!gotLock)app.exit(0);
try{
  const nu=app.getPath('userData');fs.mkdirSync(nu,{recursive:true});
  // Pindahan data dari nama aplikasi lama: SEKALI saja (ditandai berkas .migrasi-nama), dan yang dipakai adalah berkas TERBARU.
  // (Di Windows nama folder tidak peka huruf besar/kecil, jadi folder nama lama bisa saja sama dengan folder nama baru dan berisi data lebih lama.)
  const mark=path.join(nu,'.migrasi-nama');
  if(!fs.existsSync(mark)){
    let prevNames=[];try{prevNames=require('../package.json').previousNames||[];}catch{}
    const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
    const mt=f=>{try{return fs.statSync(f).mtimeMs;}catch{return -1;}};
    for(const f of['config.json','settings.json','window.json']){
      const dst=path.join(nu,f);let best=null,bt=mt(dst);
      for(const oldName of prevNames){
        const old=path.join(app.getPath('appData'),oldName);if(same(old,nu))continue;
        const t=mt(path.join(old,f));if(t>bt){bt=t;best=path.join(old,f);}
      }
      if(best)fs.copyFileSync(best,dst);
    }
    fs.writeFileSync(mark,'1');
  }
}catch{}
process.env.CG_DATA=app.getPath('userData');
process.on('uncaughtException',e=>{try{dialog.showErrorBox('ChatStream Labs - error',String(e&&e.message&&/^Port /.test(e.message)?e.message:(e&&e.stack)||e));}catch{}});
const BF=path.join(app.getPath('userData'),'window.json'),SFILE=path.join(app.getPath('userData'),'settings.json');
const readJ=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return{};}};
const saveB=b=>{try{fs.writeFileSync(BF,JSON.stringify({...readJ(BF),...b}));}catch{}};
const G=()=>readJ(SFILE).global||{};
let protect=G().protect!==false,ctrlPos=G().ctrlPos||'top-right';
function prot(w){const f=()=>{try{if(w&&!w.isDestroyed())w.setContentProtection(protect);}catch{}};f();[150,600,2000].forEach(t=>setTimeout(f,t));}
app.on('browser-window-created',(e,w)=>{prot(w);w.on('show',()=>prot(w));w.webContents.on('did-finish-load',()=>prot(w));});
let srv=null,main=null,dash=null,splashWin=null,locked=false,switching=false,tray=null,dragT=null,quitting=false,asking=false;
let outerAtLock=null,lockStart=null,lastRects=[];
let srvReady;const srvP=new Promise(r=>srvReady=r);
const base=()=>'http://localhost:'+(srv&&srv.port||3000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const THEME_BG={standar:'#0e1214',neo:'#e3e8ef',glass:'#08101d',clay:'#f4e6d8',liquid:'#071a2e',spatial:'#0d0e12'};
const themeBg=()=>THEME_BG[(readJ(SFILE).dock||{}).theme]||'#0e1214';
const isLight=c=>{const n=parseInt(c.slice(1),16);return(0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255>.6;};
const splash=()=>{const bg=themeBg();return 'data:text/html;charset=utf-8,'+encodeURIComponent('<body style="margin:0;background:'+bg+';color:'+(isLight(bg)?'#4a4a55':'#c9c9dd')+';font:14px Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">Memuat ChatStream Labs…</body>');};
const LOGF=()=>path.join(app.getPath('userData'),'log.txt');
const log=t=>{try{fs.appendFileSync(LOGF(),new Date().toISOString()+' '+t+'\n');}catch{}};
app.on('second-instance',()=>{
  showDash();
});
// ===== kotak tombol (mata, gembok, pindah, tutup) = jendela kecil tanpa bingkai di LUAR jendela chat / Donate Dock =====
const CW=162,CH=36,CM=4;
// paksa jendela menggambar ulang isinya (dipakai setelah jendela tampil / dipulihkan dari minimize, supaya isinya tidak kosong)
const repaint=w=>{const f=()=>{try{if(w&&!w.isDestroyed()){const c=(w.__view||w).webContents;if(c&&!c.isDestroyed())c.invalidate();}}catch{}};f();setTimeout(f,120);};
function ctlBounds(wb,inside){ // Chat Dock: posisi kotak tombol di luar jendela: atas = tepat di atas jendela, bawah = tepat di bawah (mengikuti pengaturan "Posisi tombol"), dijaga tetap di dalam layar
  if(inside){ // Donate Dock: selalu di DALAM jendela, pojok kanan atas (tidak mengikuti pengaturan "Posisi tombol")
    let x=Math.max(wb.x,wb.x+wb.width-CW-CM),y=wb.y+CM;
    try{const wa=screen.getDisplayMatching(wb).workArea;x=Math.min(Math.max(x,wa.x),wa.x+wa.width-CW);y=Math.min(Math.max(y,wa.y),wa.y+wa.height-CH);}catch{}
    return{x,y};
  }
  const P=ctrlPos||'top-right',top=P.startsWith('top');
  let x=P.endsWith('left')?wb.x:P.endsWith('right')?wb.x+wb.width-CW:Math.round(wb.x+(wb.width-CW)/2),y=top?wb.y-CH-CM:wb.y+wb.height+CM;
  try{const wa=screen.getDisplayMatching(wb).workArea;x=Math.min(Math.max(x,wa.x),wa.x+wa.width-CW);y=Math.min(Math.max(y,wa.y),wa.y+wa.height-CH);}catch{}
  return{x,y};
}
// t = 'chat' atau id Donate Dock. Jendela tombol ikut bergerak, tampil, dan sembunyi bersama jendela induknya, dan ditutup saat induknya ditutup.
function attachCtl(w,t,L){
  const c=new BrowserWindow({width:CW,height:CH,useContentSize:true,title:'ChatStream Labs - kontrol',icon:ICON,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,maximizable:false,minimizable:false,fullscreenable:false,skipTaskbar:true,focusable:false,thickFrame:false,show:false,parent:w,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
  if(L)c.setAlwaysOnTop(true,'screen-saver');
  const pos=()=>{try{if(c.isDestroyed()||w.isDestroyed())return;const r=ctlBounds(w.getBounds(),t!=='chat'),b=c.getPosition();if(b[0]!==r.x||b[1]!==r.y)c.setPosition(r.x,r.y,false);}catch{}};
  w.__pos=pos;pos();
  const go=()=>{if(!c.isDestroyed())c.loadURL(base()+'/?view=ctl&t='+encodeURIComponent(t));};
  srvP.then(go);
  c.webContents.on('did-fail-load',(e,code,d,u)=>{if(code!==-3&&u&&u.startsWith('http://localhost'))setTimeout(go,1000);});
  w.on('move',pos);w.on('resize',pos);
  w.on('show',()=>{pos();try{if(!c.isDestroyed())c.showInactive();}catch{}});
  w.on('hide',()=>{try{if(!c.isDestroyed())c.hide();}catch{}});
  w.on('closed',()=>{try{if(!c.isDestroyed())c.destroy();}catch{}});
  return c;
}
const posAllCtl=()=>{[main,...[...docks.values()].map(D=>D.win)].forEach(x=>{try{if(x&&!x.isDestroyed()&&x.__pos)x.__pos();}catch{}});};
function dragOn(on){
  if(!on){if(dragT){clearInterval(dragT);dragT=null;if(!locked&&main&&!main.isDestroyed())saveB({outer:main.getBounds()});}return;}
  if(dragT||!main||main.isDestroyed())return;
  const c0=screen.getCursorScreenPoint(),m0=main.getBounds(),t0=Date.now();
  dragT=setInterval(()=>{
    if(!main||main.isDestroyed()){clearInterval(dragT);dragT=null;return;}
    const c=screen.getCursorScreenPoint();
    main.setPosition(m0.x+c.x-c0.x,m0.y+c.y-c0.y);if(main.__pos)main.__pos();
    if(Date.now()-t0>25000)dragOn(false);
  },16);
}
// ===== jendela utama =====
// Jendela transparan yang tembus-klik (setIgnoreMouseEvents) tidak bisa disembunyikan Windows dari tangkapan layar.
// Jadi saat "Sembunyikan dari OBS" aktif, jendela tidak dibuat tembus-klik; hanya area gelembung chat yang menerima klik
// (setShape), sisanya diteruskan ke game. Saat tidak disembunyikan, jendela tembus-klik penuh.
function applyLockedInput(){
  if(!locked||!main||main.isDestroyed())return;
  try{
    const b=main.getBounds();
    if(protect){
      setIgn(main,false);
      const r=(lastRects||[]).map(q=>({x:Math.max(0,Math.round(q.x)),y:Math.max(0,Math.round(q.y)),width:Math.max(1,Math.round(q.width)),height:Math.max(1,Math.round(q.height))}));
      main.setShape(r.length?r:[{x:0,y:0,width:1,height:1}]); // kotak tombol sudah jendela sendiri di luar, jadi tidak ikut di sini
    }else{
      main.setShape([{x:0,y:0,width:b.width,height:b.height}]);
      setIgn(main,true);
    }
  }catch{}
}
function applyLockedInputSoon(w){[0,300,1200].forEach(t=>setTimeout(()=>{if(main===w)applyLockedInput();},t));}
const showWin=(w,asLocked)=>{if(!w||w.isDestroyed())return;if(asLocked)w.showInactive();else w.show();};
// pengaman: kalau halaman belum siap (blank), muat ulang sampai 4 kali
function watchLoad(w,go,wc){ // wc = webContents yang dipantau (default: milik jendela itu sendiri)
  let tries=0;const t=setInterval(async()=>{
    if(w.isDestroyed()||(wc&&wc.isDestroyed())){clearInterval(t);return;}
    let ok=false;try{ok=await (wc||w.webContents).executeJavaScript('window.__ready===true');}catch{}
    if(ok){clearInterval(t);return;}
    if(++tries>4){clearInterval(t);log('halaman tidak siap setelah 4 kali percobaan');return;}
    log('halaman belum siap, muat ulang ('+tries+')');go();
  },6000);
}
function makeMain(bounds){
  const L=locked;
  const b=bounds||readJ(BF).outer||{};
  const o={x:b.x,y:b.y,width:b.width||460,height:b.height||800,title:'ChatStream Labs',icon:ICON,minWidth:300,minHeight:300,show:false,webPreferences:{spellcheck:false}};
  if(L)Object.assign(o,{frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,alwaysOnTop:true,resizable:false,skipTaskbar:true,focusable:false,thickFrame:false});
  else Object.assign(o,{frame:false,backgroundColor:themeBg()});
  const w=new BrowserWindow(o);
  if(L)w.setAlwaysOnTop(true,'screen-saver');
  // seperti Donate Dock: jendela hanya wadah, halaman chat ada di WebContentsView yang memenuhi isi jendela
  const v=new WebContentsView({webPreferences:{spellcheck:false}});
  v.setBackgroundColor(L?'#00000000':themeBg());
  w.contentView.addChildView(v);w.__view=v;
  const wc=v.webContents;
  const fit=()=>{if(w.isDestroyed())return;const [cw,ch]=w.getContentSize();v.setBounds({x:0,y:0,width:cw,height:ch});};
  fit();w.on('resize',fit);
  attachCtl(w,'chat',L);
  const go=()=>{if(!w.isDestroyed()&&!wc.isDestroyed())wc.loadURL(base()+'/?view=dock'+(L?'&locked=1':'')).catch(()=>{});};
  showWin(w,L);if(L)applyLockedInputSoon(w);else wc.loadURL(splash()).catch(()=>{});
  srvP.then(()=>{go();watchLoad(w,go,wc);});
  wc.on('did-finish-load',()=>prot(w));
  w.on('restore',()=>repaint(w));w.on('show',()=>repaint(w));
  wc.on('did-fail-load',(e,c,d,u)=>{if(c!==-3&&u&&u.startsWith('http://localhost'))setTimeout(go,1000);});
  wc.on('render-process-gone',()=>{log('proses tampilan berhenti, memuat ulang');setTimeout(go,500);});
  wc.on('console-message',(...a)=>{const e=a[0],lv=(e&&e.level!==undefined)?e.level:a[1],msg=(e&&e.message)||a[2];if(lv===3||lv==='error')log('tampilan: '+msg);});
  const keep=()=>{if(!L&&!w.isDestroyed()&&!w.isMinimized())saveB({outer:w.getBounds()});};
  w.on('moved',keep);w.on('resized',keep);
  // menutup jendela chat tidak menutup aplikasi (Dashboard tetap ada)
  w.on('closed',()=>{
    try{if(!wc.isDestroyed())wc.close();}catch{} // WebContentsView tidak ikut tertutup bersama jendelanya: tutup manual supaya prosesnya lepas
    if(main===w&&!switching){const was=locked;main=null;locked=false;if(tray)tray.setContextMenu(trayMenu());}});
  main=w;
  return w;
}
function setLock(on){
  if(on===locked&&main)return;
  if(!main||main.isDestroyed()){if(!on)return;openChat();}
  const old=main;let bounds;
  if(old&&old.isMinimized())old.restore();
  if(on){outerAtLock=old.getBounds();lockStart=old.getContentBounds();saveB({outer:outerAtLock});bounds=lockStart;}
  else{const nb=old.getBounds(),ls=lockStart||nb,oa=outerAtLock||nb;bounds={x:oa.x+(nb.x-ls.x),y:oa.y+(nb.y-ls.y),width:oa.width,height:oa.height};saveB({outer:bounds});}
  locked=on;lastRects=[];switching=true;
  makeMain(bounds);
  if(old&&!old.isDestroyed())old.destroy();
  switching=false;
  if(tray)tray.setContextMenu(trayMenu());
}
async function askQuit(){
  if(quitting||asking)return;asking=true;
  try{
    const parent=(dash&&!dash.isDestroyed()&&dash.isVisible())?dash:undefined;
    const r=await dialog.showMessageBox(parent,{type:'question',buttons:['Keluar','Batal'],defaultId:1,cancelId:1,noLink:true,title:'Keluar',message:'Keluar dari ChatStream Labs?',detail:'Koneksi ke live YouTube dan TikTok akan terputus, dan overlay di OBS berhenti menampilkan chat.'});
    if(r.response===0){quitting=true;app.quit();}
  }finally{asking=false;}
}
const trayMenu=()=>Menu.buildFromTemplate([
  {label:'Buka Dashboard',click:()=>showDash()},
  {label:'Buka Chat',click:()=>openChat()},
  {label:[...docks.values()].some(d=>donOpen(d)&&d.win.isVisible())?'Tutup Donate Dock':'Buka Donate Dock',click:()=>donateAct('toggle')},
  {label:locked?'Buka kunci':'Kunci jendela',click:()=>setLock(!locked)},
  {label:'Laporan penonton',click:()=>openReport()},
  {label:'Pengaturan',click:()=>openSettings()},
  {type:'separator'},{label:'Keluar',click:()=>askQuit()}]);
const wins={};
function openWin(url,opt){
  const isPrevWin=/preview=1/.test(url),vm=url.match(/view=(\w+)/),key=vm?vm[1]:'win';
  if(wins[key]&&!wins[key].isDestroyed()&&!isPrevWin)wins[key].destroy();
  const w=new BrowserWindow({width:520,height:820,autoHideMenuBar:true,backgroundColor:'#0e1214',icon:ICON,frame:isPrevWin,...opt});
  w.setMenuBarVisibility(false);w.loadURL(url.startsWith('http')?url:base()+url);
  if(!isPrevWin){wins[key]=w;w.on('closed',()=>{if(wins[key]===w)delete wins[key];});}
  return w;
}
function winCtl(which,act){
  const w=which==='main'?main:which==='dash'?dash:String(which).startsWith('donate:')?(docks.get(String(which).slice(7))||{}).win:wins[which];if(!w||w.isDestroyed())return;
  if(act==='min'){if(which==='dash'||which==='main')w.hide();else w.minimize();} // Dashboard/Chat: langsung sembunyi ke tray (tanpa status 'minimized', yang bikin jendela macet saat dibuka lagi)
  else if(act==='max'){if(w.isMaximized())w.unmaximize();else w.maximize();}
  else if(act==='close'){if(which==='dash')askQuit();else w.close();}
  else if(act==='reload'){try{(w.__view||w).webContents.reload();}catch{}}
}
// Laporan penonton = tab di dalam Dashboard (bukan jendela baru)
function openReport(){
  showDash();
  const w=dash,t0=Date.now();
  const tryGo=async()=>{
    if(!w||w.isDestroyed())return;
    let ok=false;try{ok=await w.webContents.executeJavaScript('window.__ready===true');}catch{}
    if(!ok){if(Date.now()-t0<10000)setTimeout(tryGo,250);return;}
    try{await w.webContents.executeJavaScript("window.__goTab&&window.__goTab('r')");}catch{}
  };
  tryGo();
}
// Pengaturan sekarang ada di Dashboard
function openSettings(){showDash();}
function showDash(){
  if(!dash||dash.isDestroyed())return;
  if(dash.__susp){dash.__susp=false;if(dash.__go)dash.__go();} // halaman sempat dikosongkan untuk hemat RAM: muat lagi
  if(dash.isMinimized())dash.restore();
  if(!dash.isVisible())dash.show();
  dash.focus();dash.moveTop();
  try{dash.webContents.focus();}catch{}
}
// jendela chat (dulu jendela utama), dibuka dari tombol di Dashboard
function openChat(){
  if(main&&!main.isDestroyed()){if(main.isMinimized())main.restore();if(!main.isVisible())showWin(main,locked);if(!locked){main.focus();try{main.__view.webContents.focus();}catch{}}return;}
  locked=false;makeMain();
}
// Dashboard = jendela pertama yang terbuka setelah splash
function makeDash(){
  const b=readJ(BF).dash||{};
  const w=new BrowserWindow({x:b.x,y:b.y,width:b.width||1100,height:b.height||700,minWidth:860,minHeight:540,title:'ChatStream Labs - Dashboard',icon:ICON,frame:false,autoHideMenuBar:true,backgroundColor:themeBg(),show:false,webPreferences:{spellcheck:false}});
  const go=()=>{if(!w.isDestroyed())w.loadURL(base()+'/?view=dashboard');};
  w.__go=go;go();watchLoad(w,go);
  w.webContents.on('did-fail-load',(e,c,d,u)=>{if(c!==-3&&u&&u.startsWith('http://localhost'))setTimeout(go,1000);});
  w.webContents.on('render-process-gone',()=>{log('proses tampilan Dashboard berhenti, memuat ulang');setTimeout(go,500);});
  const keep=()=>{if(!w.isDestroyed()&&!w.isMinimized()&&!w.isMaximized())saveB({dash:w.getBounds()});};
  w.on('moved',keep);w.on('resized',keep);
  // Hemat RAM: Dashboard yang disembunyikan ke tray > DASH_IDLE_MS dikosongkan halamannya (isi memori dilepas), lalu dimuat lagi saat dibuka.
  // Diperkecil lewat taskbar Windows = minimize biasa (tidak masuk tray, tidak dikosongkan).
  w.on('hide',()=>{clearTimeout(w.__idle);w.__idle=setTimeout(()=>suspendDash(w),DASH_IDLE_MS);});
  w.on('show',()=>{clearTimeout(w.__idle);repaint(w);});
  w.on('restore',()=>repaint(w));
  w.on('close',e=>{if(!quitting){e.preventDefault();askQuit();}});
  w.on('closed',()=>{clearTimeout(w.__idle);if(dash===w)dash=null;});
  dash=w;return w;
}
const DASH_IDLE_MS=120000;
function suspendDash(w){
  if(!w||w.isDestroyed()||w.isVisible()||w.isMinimized()||w.__susp||quitting)return;
  w.__susp=true;
  try{w.webContents.loadURL('about:blank').catch(()=>{});}catch{}
}
// splash: cek update -> menyambungkan; ditutup setelah Dashboard siap
function startUp(){
  const t0=Date.now();let finished=false;
  // Splash dikunci: tidak bisa digeser, diperkecil, atau ditutup sendiri (hanya aplikasi yang menutupnya lewat destroy()).
  const sp=new BrowserWindow({width:640,height:480,frame:false,resizable:false,movable:false,minimizable:false,maximizable:false,closable:false,fullscreenable:false,center:true,title:'ChatStream Labs',icon:ICON,backgroundColor:'#0a0a1c',show:false});
  splashWin=sp;sp.loadFile(path.join(__dirname,'splash.html'));
  sp.once('ready-to-show',()=>{if(!sp.isDestroyed())sp.show();});
  sp.on('closed',()=>{splashWin=null;if(!finished&&!quitting)app.quit();});
  srvP.then(()=>{
    const w=makeDash();
    const t=setInterval(async()=>{
      if(w.isDestroyed()){clearInterval(t);return;}
      let ok=false;try{ok=await w.webContents.executeJavaScript('window.__ready===true');}catch{}
      if(!ok&&Date.now()-t0<30000)return;
      if(Date.now()-t0<3800)return; // beri waktu tampil kedua teks splash
      clearInterval(t);finished=true;
      try{if(!sp.isDestroyed())await sp.webContents.executeJavaScript('window.finish&&window.finish()');}catch{}
      setTimeout(()=>{if(!w.isDestroyed())w.show();if(!sp.isDestroyed())sp.destroy();},500);
    },250);
  });
}
// ===== Donate Dock (bisa lebih dari satu) =====
// Tiap dock memuat satu URL widget donasi (alert / media share) di jendelanya sendiri. Tidak ada integrasi API: aplikasi hanya menampilkan halamannya.
// Jendela selalu tanpa bingkai dan tanpa bilah judul. Tombol (mata, gembok, pindah, tutup) = jendela kecil tanpa bingkai di LUAR jendela dock (?view=ctl&t=<id>, transparan rendah), lihat attachCtl.
// Mode biasa (belum dikunci): jendela berlatar, bisa diubah ukurannya, tidak selalu di atas (jadi Dashboard tetap bisa naik ke depan saat diklik). Mode gembok: transparan, selalu di atas, tidak mencuri fokus, isi widget tidak bisa diklik.
// Isi widget otomatis diskalakan (zoom) supaya muat di jendela: skala = min(lebar jendela / lebar acuan, tinggi jendela / tinggi acuan).
const DON_MAX=5,docks=new Map(); // id -> D
const donCfg=()=>Array.isArray(G().donateDocks)?G().donateDocks:[];
const donFind=id=>donCfg().find(d=>d.id===id)||null;
const donOpen=D=>!!(D&&D.win&&!D.win.isDestroyed());
const donCheck=c=>{
  const raw=String((c&&c.url)||'').trim();
  if(!raw)return{error:'Isi URL widget donasi dulu, lalu klik Simpan.'};
  const u=srv&&srv.cleanDonateUrl?srv.cleanDonateUrl(raw):null;
  return u?{url:u}:{error:'URL widget donasi tidak valid. Pakai alamat yang diawali http:// atau https://.'};
};
const refreshTray=()=>{if(tray)tray.setContextMenu(trayMenu());};
const donLockSaved=id=>!!(readJ(BF).donLocked||{})[id];
const donSaveLock=(id,on)=>saveB({donLocked:{...(readJ(BF).donLocked||{}),[id]:!!on}});
const donSavedBounds=id=>(readJ(BF).donates||{})[id]||readJ(BF).donate||{};
const donSaveBounds=D=>{try{if(donOpen(D))saveB({donates:{...(readJ(BF).donates||{}),[D.id]:D.win.getBounds()}});}catch{}};
// Jendela tembus-klik penuh tidak bisa disembunyikan Windows dari tangkapan layar (lihat komentar applyLockedInput).
// Saat terkunci + "Sembunyikan dari OBS" aktif: jendela tidak tembus-klik, tetapi bentuknya (setShape) hanya sebesar isi widget yang sedang terlihat
// (dibaca dari halaman widget tiap 0,7 dtk). Selama belum ada donasi masuk, bentuknya hanya kotak tombol jadi tidak menghalangi game.
// Saat tidak disembunyikan dari OBS: tembus-klik penuh.
function applyDockInput(D){
  if(!D||!D.locked||!donOpen(D))return;
  try{
    const b=D.win.getBounds();
    if(protect){setIgn(D.win,false);D.win.setShape((D.rects&&D.rects.length)?D.rects:[{x:0,y:0,width:1,height:1}]);} // kotak tombol sudah jendela sendiri di luar, jadi tidak ikut di sini
    else{D.win.setShape([{x:0,y:0,width:b.width,height:b.height}]);setIgn(D.win,true);}
  }catch{}
}
function applyDonateInput(){docks.forEach(applyDockInput);}
// dijalankan DI DALAM halaman widget: daftar kotak [x,y,lebar,tinggi] (px CSS) dari bagian yang benar-benar terlihat
function scanFn(){
  const out=[],PAINT=/^(IMG|VIDEO|CANVAS|IFRAME|SVG|OBJECT|EMBED|PICTURE)$/i,SKIP=/^(SCRIPT|STYLE|NOSCRIPT|META|LINK|HEAD|TEMPLATE)$/;
  let n=0,k=0;
  const walk=(doc,ox,oy,W,H)=>{
    const win=doc.defaultView;if(!win)return;
    const vis=e=>{for(let x=e;x&&x.nodeType===1;x=x.parentElement||(x.getRootNode&&x.getRootNode().host)){const c=win.getComputedStyle(x);if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)<0.02)return false;}return true;};
    const add=r=>{if(r.width>1&&r.height>1&&r.right>0&&r.bottom>0&&r.left<W&&r.top<H)out.push([r.left+ox,r.top+oy,r.width,r.height]);};
    const visit=root=>{
      for(const e of root.querySelectorAll('*')){
        if(++n>2500)return;
        if(SKIP.test(e.tagName))continue;
        if(e.shadowRoot)visit(e.shadowRoot);
        const c=win.getComputedStyle(e),bg=c.backgroundColor;
        const paint=PAINT.test(e.tagName)||c.backgroundImage!=='none'||(bg!=='transparent'&&!/,\s*0\)$/.test(bg))||(c.borderTopStyle!=='none'&&c.borderTopWidth!=='0px');
        if(paint&&vis(e)){const r=e.getBoundingClientRect();add(r);
          if(e.tagName==='IFRAME'){try{const d=e.contentDocument;if(d&&d.documentElement)walk(d,ox+r.left,oy+r.top,r.width,r.height);}catch{}}}
      }
    };
    const root=doc.body||doc.documentElement;visit(root);
    const tw=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    for(let t;(t=tw.nextNode())&&k<600;k++){
      if(!t.nodeValue.trim())continue;const p=t.parentElement;
      if(!p||/^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)||!vis(p))continue;
      const g=doc.createRange();g.selectNodeContents(t);add(g.getBoundingClientRect());
    }
  };
  walk(document,0,0,innerWidth,innerHeight);
  return out.slice(0,400);
}
async function dockScan(D){
  if(!D.locked||!protect||!donOpen(D)||!D.view||D.view.webContents.isDestroyed())return;
  let a;try{a=await D.view.webContents.executeJavaScript('('+scanFn.toString()+')()');}catch{return;}
  if(!Array.isArray(a)||!donOpen(D))return;
  const z=D.zoom||1,[cw,ch]=D.win.getContentSize();
  const r=a.map(q=>{const x=Math.max(0,Math.floor(q[0]*z)-4),y=Math.max(0,Math.floor(q[1]*z)-4);
    return{x,y,width:Math.max(1,Math.min(cw-x,Math.ceil(q[2]*z)+8)),height:Math.max(1,Math.min(ch-y,Math.ceil(q[3]*z)+8))};}).filter(q=>q.x<cw&&q.y<ch);
  const sig=JSON.stringify(r);if(sig===D.sig)return;
  D.sig=sig;D.rects=r;applyDockInput(D);
}
// skala isi widget supaya muat di jendela
function dockFit(D){
  if(!donOpen(D)||!D.view||D.view.webContents.isDestroyed())return;
  const c=D.cfg||{},[cw,ch]=D.win.getContentSize();
  const z=c.fit===false?1:Math.min(10,Math.max(.1,Math.min(cw/(c.refW||1280),ch/(c.refH||720))));
  D.zoom=z;try{D.view.webContents.setZoomFactor(z);}catch{}
}
// CSS yang disuntik ke halaman widget: latar transparan + Opacity dari pengaturan dock (hanya isi widget; tombol tidak ikut pudar) + saat terkunci isi widget tidak bisa diklik
function donCss(D){
  const wc=D.view&&D.view.webContents;if(!wc||wc.isDestroyed())return;
  const op=Math.min(100,Math.max(10,Math.round(+((D.cfg||{}).opacity))||100));D.opAp=op;
  const css='html,body{background:transparent!important}'+(D.locked?'*{pointer-events:none!important}':'')+(op<100?'html{opacity:'+(op/100)+'!important}':'');
  const old=D.cssKey;D.cssKey=null;if(old)wc.removeInsertedCSS(old).catch(()=>{});
  wc.insertCSS(css).then(k=>{if(wc.isDestroyed())return;if(D.cssKey)wc.removeInsertedCSS(D.cssKey).catch(()=>{});D.cssKey=k;}).catch(()=>{});
}
function donGo(D){
  if(!D.view||D.view.webContents.isDestroyed())return;
  const c=donCheck(D.cfg);if(!c.url)return;
  D.loaded=c.url;clearTimeout(D.T.hang);
  D.view.webContents.loadURL(c.url).catch(()=>{}); // kegagalan ditangani did-fail-load
  // pengaman halaman menggantung: kalau 25 detik masih memuat, hitung sebagai satu percobaan gagal
  D.T.hang=setTimeout(()=>{const wc=D.view&&!D.view.webContents.isDestroyed()&&D.view.webContents;if(wc&&wc.isLoading())donRetry(D,'halaman terlalu lama memuat');},25000);
}
// muat ulang otomatis dengan jeda makin lama (3, 6, 12, 24, 48 dtk), berhenti setelah DON_TRY kali supaya tidak berputar tanpa ujung
const DON_TRY=5;
function donRetry(D,why){
  if(!D.view)return;
  clearTimeout(D.T.hang);clearTimeout(D.T.stable);
  if(++D.tries>DON_TRY){log('Donate Dock "'+D.cfg.name+'": berhenti mencoba setelah '+DON_TRY+' kali ('+why+'). Cek URL dan internet, lalu klik "Muat ulang".');return;}
  const d=Math.min(60000,3000*Math.pow(2,D.tries-1));
  log('Donate Dock "'+D.cfg.name+'": '+why+', muat ulang dalam '+Math.round(d/1000)+' dtk ('+D.tries+'/'+DON_TRY+')');
  clearTimeout(D.T.retry);D.T.retry=setTimeout(()=>donGo(D),d);
}
// dipanggil tiap pengaturan berubah: nama, bisu, ukuran acuan, URL; dock yang dihapus / URL-nya kosong ditutup
function donSync(){
  docks.forEach(D=>{
    if(!donOpen(D))return;
    const cfg=donFind(D.id);
    if(!cfg||!donCheck(cfg).url){D.win.close();return;}
    D.cfg=cfg;try{D.win.setTitle(cfg.name);}catch{}
    try{D.view.webContents.setAudioMuted(!!cfg.mute);}catch{}
    if((cfg.opacity||100)!==D.opAp)donCss(D);
    if(cfg.url!==D.loaded){D.tries=0;donGo(D);}
    dockFit(D);
  });
}
function makeDock(id,L){
  const cfg=donFind(id);if(!cfg)return null;
  const old=docks.get(id),sv=donSavedBounds(id);
  const o={x:sv.x,y:sv.y,width:sv.width||420,height:sv.height||520,title:cfg.name,icon:ICON,minWidth:160,minHeight:100,show:false,frame:false,autoHideMenuBar:true,maximizable:false,minimizable:false,skipTaskbar:true,webPreferences:{spellcheck:false}};
  if(L)Object.assign(o,{transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,focusable:false,thickFrame:false});
  else o.backgroundColor=themeBg();
  const w=new BrowserWindow(o);
  if(L)w.setAlwaysOnTop(true,'screen-saver'); // hanya saat terkunci; saat belum dikunci jendela biasa supaya Dashboard bisa naik ke depan
  const part='persist:donate-'+id; // satu partisi per dock: zoom dan data halaman tidak bercampur antar dock
  try{session.fromPartition(part).setPermissionRequestHandler((wc,perm,cb)=>cb(false));}catch{}
  const v=new WebContentsView({webPreferences:{partition:part,autoplayPolicy:'no-user-gesture-required',backgroundThrottling:false,contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
  v.setBackgroundColor('#00000000');
  w.contentView.addChildView(v);
  // tombol (mata, gembok, pindah, tutup): jendela kecil di LUAR jendela dock
  attachCtl(w,id,!!L);
  const D={id,cfg,win:w,view:v,locked:!!L,loaded:'',tries:0,T:{},rects:[],sig:'',zoom:1,dragT:null,scanT:null,cssKey:null,opAp:0};
  const layout=()=>{if(w.isDestroyed())return;const [cw,ch]=w.getContentSize();v.setBounds({x:0,y:0,width:cw,height:ch});dockFit(D);if(D.locked)applyDockInput(D);};
  D.layout=layout;layout();w.on('resize',layout);
  const wc=v.webContents;
  wc.setAudioMuted(!!cfg.mute);
  wc.setWindowOpenHandler(()=>({action:'deny'}));
  const onlyHttp=(e,u)=>{if(!/^https?:\/\//i.test(u))e.preventDefault();};
  wc.on('will-navigate',onlyHttp);wc.on('will-redirect',onlyHttp);
  wc.on('dom-ready',()=>{try{wc.setAudioMuted(!!D.cfg.mute);}catch{}donCss(D);dockFit(D);});
  wc.on('did-navigate',()=>dockFit(D));
  wc.on('did-finish-load',()=>{
    clearTimeout(D.T.hang);donCss(D);dockFit(D);
    clearTimeout(D.T.stable);D.T.stable=setTimeout(()=>{D.tries=0;},30000); // dianggap sehat kalau bertahan 30 dtk
  });
  wc.on('did-fail-load',(e,c,d,u,isMain)=>{if(c===-3||isMain===false)return;donRetry(D,'gagal memuat ('+d+')');});
  wc.on('render-process-gone',()=>donRetry(D,'proses halaman berhenti'));
  const moved=()=>{if(!D.locked&&!w.isDestroyed())donSaveBounds(D);};
  w.on('moved',moved);w.on('resized',moved);
  w.on('show',refreshTray);w.on('hide',refreshTray);
  w.on('closed',()=>{
    clearTimeout(D.T.hang);clearTimeout(D.T.retry);clearTimeout(D.T.stable);clearInterval(D.scanT);clearInterval(D.dragT);
    if(docks.get(id)===D)docks.delete(id);
    // WebContentsView TIDAK ikut tertutup saat jendelanya ditutup: tanpa ini halaman widget lama tetap hidup dan suaranya terus bunyi (dobel)
    [v].forEach(x=>{try{const c=x.webContents;if(!c.isDestroyed()){c.setAudioMuted(true);c.close();}}catch{}});
    refreshTray();
  });
  docks.set(id,D);
  showWin(w,!!L);
  if(L){
    [0,300,1200].forEach(t=>setTimeout(()=>{if(docks.get(id)===D)applyDockInput(D);},t));
    D.scanT=setInterval(()=>dockScan(D),700);
  }
  donGo(D);
  if(old&&!old.win.isDestroyed()){try{old.view.webContents.setAudioMuted(true);}catch{}old.win.destroy();}
  refreshTray();
  return D;
}
// kunci / buka kunci satu dock (jendela transparan harus dibuat ulang, lihat jebakan 5)
function dockSetLock(id,on){
  on=!!on;donSaveLock(id,on);
  const D=docks.get(id);
  if(!donOpen(D)||D.locked===on)return;
  donSaveBounds(D);makeDock(id,on);
}
function dockDrag(id,on){
  const D=docks.get(id);if(!donOpen(D))return;
  if(!on){if(D.dragT){clearInterval(D.dragT);D.dragT=null;donSaveBounds(D);}return;}
  if(D.dragT)return;
  const c0=screen.getCursorScreenPoint(),m0=D.win.getBounds(),t0=Date.now();
  D.dragT=setInterval(()=>{
    if(!donOpen(D)){clearInterval(D.dragT);D.dragT=null;return;}
    const c=screen.getCursorScreenPoint(),dx=c.x-c0.x,dy=c.y-c0.y;
    D.win.setBounds({x:m0.x+dx,y:m0.y+dy,width:m0.width,height:m0.height});if(D.win.__pos)D.win.__pos();
    if(Date.now()-t0>25000)dockDrag(id,false);
  },16);
}
// act: open | close | reload | toggle. id kosong = semua dock
function donateAct(act,id){
  if(act==='toggle'){const any=[...docks.values()].some(d=>donOpen(d)&&d.win.isVisible());return donateAct(any?'close':'open',id);}
  if(!['open','close','reload'].includes(act))return{error:'Perintah tidak dikenal.'};
  const ids=id?[String(id)]:donCfg().map(d=>d.id);
  if(!ids.length)return{error:'Belum ada Donate Dock. Tambahkan dulu di menu Donate Dock.'};
  let err=null;
  for(const i of ids){
    const D=docks.get(i),open=donOpen(D);
    if(act==='close'){if(open)D.win.close();continue;}
    if(act==='reload'){if(open){D.tries=0;donGo(D);}else if(id)err='Donate Dock belum dibuka.';continue;}
    const cfg=donFind(i);
    if(!cfg){err='Donate Dock tidak ditemukan.';continue;}
    const c=donCheck(cfg);
    if(!c.url){err=c.error;continue;}
    if(open){if(!D.win.isVisible())showWin(D.win,D.locked);continue;}
    makeDock(i,donLockSaved(i));
  }
  return err?{error:err}:{ok:true};
}
function dashState(){
  const d={};
  donCfg().forEach(c=>{const D=docks.get(c.id),o=donOpen(D);d[c.id]={open:o,locked:o?D.locked:donLockSaved(c.id)};});
  return{chat:{open:!!(main&&!main.isDestroyed()),locked},docks:d};
}
// ===== hotkey =====
const HK_DEF={lock:'Ctrl+Alt+L',hide:'Ctrl+Alt+H',obs:'Ctrl+Alt+O',up:'Ctrl+Alt+PageUp',down:'Ctrl+Alt+PageDown',clear:'Ctrl+Alt+C',filter:'Ctrl+Alt+F',settings:'Ctrl+Alt+S',report:'Ctrl+Alt+R',donate:'Ctrl+Alt+D'};
const ACTIONS={
  lock:()=>setLock(!locked),
  hide:()=>{if(!main||main.isDestroyed())return;
    if(main.isVisible())main.hide();
    else{if(locked)main.showInactive();else main.show();}},
  obs:()=>{if(srv){protect=!protect;srv.setGlobal({protect});}},
  up:()=>srv&&srv.cmd('up'),down:()=>srv&&srv.cmd('down'),clear:()=>srv&&srv.cmd('clear'),filter:()=>srv&&srv.cmd('filter'),
  settings:()=>openSettings(),
  report:()=>openReport(),
  donate:()=>{donateAct('toggle');}
};
function setHotkeys(map){
  globalShortcut.unregisterAll();const res={};
  for(const [a,acc] of Object.entries({...HK_DEF,...(map||{})})){
    if(!acc||!ACTIONS[a]){res[a]=true;continue;}
    try{res[a]=globalShortcut.register(acc.replace(/Ctrl/g,'CommandOrControl'),ACTIONS[a]);}catch{res[a]=false;}
  }
  return res;
}
const hooks={
  protect:on=>{protect=on;BrowserWindow.getAllWindows().forEach(w=>prot(w));applyLockedInput();applyDonateInput();},
  open:what=>{if(what==='ext')shell.openPath(app.isPackaged?path.join(process.resourcesPath,'extension'):path.join(__dirname,'..','extension'));else shell.openExternal(what);},
  window:(url,opt)=>openWin(url,opt||{}),
  saveCss:async(name,css)=>{const w=BrowserWindow.getFocusedWindow();const r=await dialog.showSaveDialog(w||undefined,{title:'Ekspor gaya (.css)',defaultPath:path.join(app.getPath('documents'),name+'.css'),filters:[{name:'CSS',extensions:['css']}]});
    if(r.canceled||!r.filePath)return{canceled:true};fs.writeFileSync(r.filePath,css,'utf8');return{ok:true,path:r.filePath};},
  // dipakai konektor Kick: mesin jaringan Chromium lebih sering lolos Cloudflare daripada fetch Node biasa
  netFetch:async url=>{const {net}=require('electron');const r=await net.fetch(url,{headers:{Accept:'application/json'}});return{status:r.status,text:await r.text()};},
  relaunch:()=>{quitting=true;app.relaunch();app.exit(0);},
  lock:(on,id)=>(id&&id!=='chat')?dockSetLock(id,on):setLock(on),
  drag:(on,id)=>(id&&id!=='chat')?dockDrag(id,on):dragOn(on),
  openSettings,
  openReport,
  openChat,
  setHotkeys,
  winCtl,
  shape:rects=>{lastRects=rects;applyLockedInput();},
  global:g=>{ctrlPos=(g&&g.ctrlPos)||'top-right';applyLockedInput();docks.forEach(D=>D.layout&&D.layout());posAllCtl();donSync();},
  donate:(act,id)=>donateAct(act,id),
  dashState
};
app.whenReady().then(()=>{
  if(!gotLock)return;
  Menu.setApplicationMenu(null);
  startUp();
  try{tray=new Tray(nativeImage.createFromPath(ICON).resize({width:16,height:16}));tray.setToolTip('ChatStream Labs');tray.setContextMenu(trayMenu());tray.on('click',()=>showDash());}catch{}
  setTimeout(()=>{
    srv=require('./server.js');Object.assign(srv.hooks,hooks);
    setHotkeys(G().hotkeys);
    srv.ready.then(srvReady);
  },30);
});
app.on('before-quit',()=>{quitting=true;try{srv&&srv.flush&&srv.flush();}catch{}});
app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('window-all-closed',()=>{if(!switching)app.quit();});
