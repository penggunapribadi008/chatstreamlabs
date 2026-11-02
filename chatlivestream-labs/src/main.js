const {app,BrowserWindow,dialog,Menu,shell,Tray,globalShortcut,nativeImage,screen}=require('electron');
const path=require('path'),fs=require('fs');
const ICON=path.join(__dirname,'icon.png');
const gotLock=app.requestSingleInstanceLock();
if(!gotLock)app.exit(0);
try{
  const nu=app.getPath('userData');fs.mkdirSync(nu,{recursive:true});
  let prevNames=[];try{prevNames=require('../package.json').previousNames||[];}catch{}
  for(const oldName of prevNames){
    const old=path.join(app.getPath('appData'),oldName);if(old===nu)continue;
    for(const f of['config.json','settings.json','window.json'])if(!fs.existsSync(path.join(nu,f))&&fs.existsSync(path.join(old,f)))fs.copyFileSync(path.join(old,f),path.join(nu,f));
  }
}catch{}
process.env.CG_DATA=app.getPath('userData');
process.on('uncaughtException',e=>{try{dialog.showErrorBox('ChatLivestream Labs - error',String(e&&e.message&&/^Port /.test(e.message)?e.message:(e&&e.stack)||e));}catch{}});
const BF=path.join(app.getPath('userData'),'window.json'),SFILE=path.join(app.getPath('userData'),'settings.json');
const readJ=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return{};}};
const saveB=b=>{try{fs.writeFileSync(BF,JSON.stringify({...readJ(BF),...b}));}catch{}};
const G=()=>readJ(SFILE).global||{};
let protect=G().protect!==false,ctrlPos=G().ctrlPos||'top-right';
function prot(w){const f=()=>{try{if(w&&!w.isDestroyed())w.setContentProtection(protect);}catch{}};f();[150,600,2000].forEach(t=>setTimeout(f,t));}
app.on('browser-window-created',(e,w)=>{prot(w);w.on('show',()=>prot(w));w.webContents.on('did-finish-load',()=>prot(w));});
let srv=null,main=null,ctlWin=null,locked=false,switching=false,tray=null,dragT=null,quitting=false,asking=false;
let outerAtLock=null,lockStart=null,lastRects=[];
let srvReady;const srvP=new Promise(r=>srvReady=r);
const base=()=>'http://localhost:'+(srv&&srv.port||3000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const THEME_BG={standar:'#0e1214',neo:'#e3e8ef',glass:'#08101d',clay:'#f4e6d8',liquid:'#071a2e',spatial:'#0d0e12'};
const themeBg=()=>THEME_BG[(readJ(SFILE).dock||{}).theme]||'#0e1214';
const isLight=c=>{const n=parseInt(c.slice(1),16);return(0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255>.6;};
const splash=()=>{const bg=themeBg();return 'data:text/html;charset=utf-8,'+encodeURIComponent('<body style="margin:0;background:'+bg+';color:'+(isLight(bg)?'#4a4a55':'#c9c9dd')+';font:14px Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">Memuat ChatLivestream Labs…</body>');};
const LOGF=()=>path.join(app.getPath('userData'),'log.txt');
const log=t=>{try{fs.appendFileSync(LOGF(),new Date().toISOString()+' '+t+'\n');}catch{}};
app.on('second-instance',()=>{
  if(main&&!main.isDestroyed()){if(main.isMinimized())main.restore();if(!main.isVisible())main.show();if(!locked)main.focus();}
});
// ===== dua kotak (gembok + pindah) = jendela kecil di LUAR jendela chat =====
const CW=120,CH=36,CG=6;
function ctlPlace(){
  if(!main||main.isDestroyed())return null;
  const b=main.getBounds(),wa=screen.getDisplayMatching(b).workArea,P=ctrlPos,top=P.startsWith('top');
  let x=P.endsWith('left')?b.x:P.endsWith('right')?b.x+b.width-CW:b.x+Math.round((b.width-CW)/2);
  let y=top?b.y-CH-CG:b.y+b.height+CG;
  const fits=yy=>yy>=wa.y&&yy+CH<=wa.y+wa.height;
  if(!fits(y)){const alt=top?b.y+b.height+CG:b.y-CH-CG;y=fits(alt)?alt:(top?b.y+CG:b.y+b.height-CH-CG);}
  x=Math.min(Math.max(x,wa.x),wa.x+wa.width-CW);
  return{x,y,width:CW,height:CH};
}
function showCtl(){
  const pl=ctlPlace();if(!pl)return;
  if(ctlWin&&!ctlWin.isDestroyed()){ctlWin.setBounds(pl);return;}
  ctlWin=new BrowserWindow({...pl,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,alwaysOnTop:true,resizable:false,skipTaskbar:true,focusable:false,show:false,thickFrame:false,useContentSize:true});
  ctlWin.setAlwaysOnTop(true,'screen-saver');
  ctlWin.loadURL(base()+'/?view=ctl');
  ctlWin.once('ready-to-show',()=>{if(ctlWin&&!ctlWin.isDestroyed())ctlWin.showInactive();});
  ctlWin.on('closed',()=>{ctlWin=null;});
}
function hideCtl(){if(dragT){clearInterval(dragT);dragT=null;}if(ctlWin&&!ctlWin.isDestroyed())ctlWin.destroy();ctlWin=null;}
function dragOn(on){
  if(!on){if(dragT){clearInterval(dragT);dragT=null;ctlPlace()&&showCtl();}return;}
  if(dragT||!main||main.isDestroyed()||!locked)return;
  const c0=screen.getCursorScreenPoint(),m0=main.getBounds(),k0=(ctlWin&&!ctlWin.isDestroyed())?ctlWin.getBounds():null,t0=Date.now();
  dragT=setInterval(()=>{
    if(!main||main.isDestroyed()){clearInterval(dragT);dragT=null;return;}
    const c=screen.getCursorScreenPoint(),dx=c.x-c0.x,dy=c.y-c0.y;
    main.setPosition(m0.x+dx,m0.y+dy);
    if(k0&&ctlWin&&!ctlWin.isDestroyed())ctlWin.setPosition(k0.x+dx,k0.y+dy);
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
    if(protect){
      main.setIgnoreMouseEvents(false);
      const b=main.getBounds(),r=(lastRects&&lastRects.length?lastRects:[{x:0,y:0,width:1,height:1}]).map(q=>({x:Math.max(0,Math.round(q.x)),y:Math.max(0,Math.round(q.y)),width:Math.max(1,Math.round(q.width)),height:Math.max(1,Math.round(q.height))}));
      main.setShape(r);
    }else{
      main.setShape([{x:0,y:0,width:main.getBounds().width,height:main.getBounds().height}]);
      main.setIgnoreMouseEvents(true);
    }
  }catch{}
}
function applyLockedInputSoon(w){[0,300,1200].forEach(t=>setTimeout(()=>{if(main===w)applyLockedInput();},t));}
const showWin=(w,asLocked)=>{if(!w||w.isDestroyed())return;if(asLocked)w.showInactive();else w.show();};
// pengaman: kalau halaman belum siap (blank), muat ulang sampai 4 kali
function watchLoad(w,go){
  let tries=0;const t=setInterval(async()=>{
    if(w.isDestroyed()){clearInterval(t);return;}
    let ok=false;try{ok=await w.webContents.executeJavaScript('window.__ready===true');}catch{}
    if(ok){clearInterval(t);return;}
    if(++tries>4){clearInterval(t);log('halaman tidak siap setelah 4 kali percobaan');return;}
    log('halaman belum siap, muat ulang ('+tries+')');go();
  },6000);
}
function makeMain(bounds){
  const L=locked;
  const b=bounds||readJ(BF).outer||{};
  const o={x:b.x,y:b.y,width:b.width||460,height:b.height||800,title:'ChatLivestream Labs',icon:ICON,minWidth:300,minHeight:300,show:false};
  if(L)Object.assign(o,{frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,alwaysOnTop:true,resizable:false,skipTaskbar:true,focusable:false,thickFrame:false});
  else Object.assign(o,{frame:false,backgroundColor:themeBg()});
  const w=new BrowserWindow(o);
  if(L)w.setAlwaysOnTop(true,'screen-saver');
  const go=()=>{if(!w.isDestroyed())w.loadURL(base()+'/?view=dock'+(L?'&locked=1':''));};
  showWin(w,L);if(L)applyLockedInputSoon(w);else w.loadURL(splash());
  srvP.then(()=>{go();watchLoad(w,go);});
  w.webContents.on('did-fail-load',(e,c,d,u)=>{if(c!==-3&&u&&u.startsWith('http://localhost'))setTimeout(go,1000);});
  w.webContents.on('render-process-gone',()=>{log('proses tampilan berhenti, memuat ulang');setTimeout(go,500);});
  w.webContents.on('console-message',(...a)=>{const e=a[0],lv=(e&&e.level!==undefined)?e.level:a[1],msg=(e&&e.message)||a[2];if(lv===3||lv==='error')log('tampilan: '+msg);});
  const keep=()=>{if(!L&&!w.isDestroyed()&&!w.isMinimized())saveB({outer:w.getBounds()});};
  w.on('moved',keep);w.on('resized',keep);
  w.on('close',e=>{if(!quitting&&!switching){e.preventDefault();askQuit();}});
  w.on('closed',()=>{if(main===w&&!switching)app.quit();});
  main=w;
  return w;
}
function setLock(on){
  if(on===locked&&main)return;
  const old=main;let bounds;
  if(old&&old.isMinimized())old.restore();
  if(on){outerAtLock=old.getBounds();lockStart=old.getContentBounds();saveB({outer:outerAtLock});bounds=lockStart;}
  else{const nb=old.getBounds(),ls=lockStart||nb,oa=outerAtLock||nb;bounds={x:oa.x+(nb.x-ls.x),y:oa.y+(nb.y-ls.y),width:oa.width,height:oa.height};saveB({outer:bounds});}
  locked=on;switching=true;
  makeMain(bounds);
  if(old&&!old.isDestroyed())old.destroy();
  switching=false;
  if(on)showCtl();else hideCtl();
  if(tray)tray.setContextMenu(trayMenu());
}
async function askQuit(){
  if(quitting||asking)return;asking=true;
  try{
    const parent=(main&&!main.isDestroyed()&&main.isVisible()&&!locked)?main:undefined;
    const r=await dialog.showMessageBox(parent,{type:'question',buttons:['Keluar','Batal'],defaultId:1,cancelId:1,noLink:true,title:'Keluar',message:'Keluar dari ChatLivestream Labs?',detail:'Koneksi ke live YouTube dan TikTok akan terputus, dan overlay di OBS berhenti menampilkan chat.'});
    if(r.response===0){quitting=true;app.quit();}
  }finally{asking=false;}
}
const trayMenu=()=>Menu.buildFromTemplate([
  {label:locked?'Buka kunci':'Kunci jendela',click:()=>setLock(!locked)},
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
  const w=which==='main'?main:wins[which];if(!w||w.isDestroyed())return;
  if(act==='min')w.minimize();
  else if(act==='close'){if(which==='main')askQuit();else w.close();}
}
function openSettings(){
  if(wins.settings&&!wins.settings.isDestroyed()){wins.settings.show();wins.settings.focus();return;}
  openWin('/?view=settings',{width:540,height:860,title:'Pengaturan - ChatLivestream Labs'});
}
// ===== hotkey =====
const HK_DEF={lock:'Ctrl+Alt+L',hide:'Ctrl+Alt+H',obs:'Ctrl+Alt+O',up:'Ctrl+Alt+PageUp',down:'Ctrl+Alt+PageDown',clear:'Ctrl+Alt+C',filter:'Ctrl+Alt+F',settings:'Ctrl+Alt+S'};
const ACTIONS={
  lock:()=>setLock(!locked),
  hide:()=>{if(!main||main.isDestroyed())return;
    if(main.isVisible()){main.hide();if(ctlWin&&!ctlWin.isDestroyed())ctlWin.hide();}
    else{if(locked){main.showInactive();if(ctlWin&&!ctlWin.isDestroyed())ctlWin.showInactive();}else main.show();}},
  obs:()=>{if(srv){protect=!protect;srv.setGlobal({protect});}},
  up:()=>srv&&srv.cmd('up'),down:()=>srv&&srv.cmd('down'),clear:()=>srv&&srv.cmd('clear'),filter:()=>srv&&srv.cmd('filter'),
  settings:()=>openSettings()
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
  protect:on=>{protect=on;BrowserWindow.getAllWindows().forEach(w=>prot(w));applyLockedInput();},
  open:what=>{if(what==='ext')shell.openPath(app.isPackaged?path.join(process.resourcesPath,'extension'):path.join(__dirname,'..','extension'));else shell.openExternal(what);},
  window:(url,opt)=>openWin(url,opt||{}),
  lock:on=>setLock(on),
  drag:on=>dragOn(on),
  openSettings,
  setHotkeys,
  winCtl,
  shape:rects=>{lastRects=rects;applyLockedInput();},
  global:g=>{ctrlPos=(g&&g.ctrlPos)||'top-right';if(locked)showCtl();}
};
app.whenReady().then(()=>{
  if(!gotLock)return;
  Menu.setApplicationMenu(null);
  makeMain();
  try{tray=new Tray(nativeImage.createFromPath(ICON).resize({width:16,height:16}));tray.setToolTip('ChatLivestream Labs');tray.setContextMenu(trayMenu());tray.on('click',()=>setLock(!locked));}catch{}
  setTimeout(()=>{
    srv=require('./server.js');Object.assign(srv.hooks,hooks);
    setHotkeys(G().hotkeys);
    srv.ready.then(srvReady);
  },30);
});
app.on('before-quit',()=>{quitting=true;});
app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('window-all-closed',()=>{if(!switching)app.quit();});
