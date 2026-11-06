// Service worker (MV3) ChatStream Labs: membuka halaman chat platform sebagai TAB LATAR atas perintah aplikasi.
//  - Tersambung ke ws://127.0.0.1:<port>/ext (port tersimpan di chrome.storage.local.port, lalu 3000-3010; logika sama dengan content script)
//    dan memperkenalkan diri dengan {type:'bg'} (bukan content script platform).
//  - Aplikasi mengirim {type:'open',platform,url}. Sebelum membuat tab, tab yang sudah ada dicari dulu (tidak ada tab ganda).
//  - Service worker MV3 bisa tidur: koneksi dijaga dengan ping WebSocket tiap 20 dtk (aktivitas WebSocket memperpanjang umur worker di Chrome 116+)
//    dan chrome.alarms tiap 30 dtk yang membangunkan worker lalu menyambung ulang kalau putus.
let ws=null,pi=0,timer=null,pinger=null;
const recent={}; // platform -> waktu terakhir tab dibuat/dimuat ulang (cegah muat ulang beruntun)
const OK_URL=/^https:\/\/(www\.)?(youtube\.com|tiktok\.com|twitch\.tv|kick\.com)\//;

// Kunci "halaman yang sama" untuk mencocokkan tab yang sudah terbuka dengan alamat yang diminta aplikasi.
function key(u){try{const x=new URL(u),h=x.hostname.replace(/^www\./,''),p=x.pathname.toLowerCase();
  if(h==='youtube.com'){const v=x.searchParams.get('v');return v&&/^\/(live_chat|watch)/.test(p)?'yt:'+v:'';}
  if(h==='tiktok.com'){const m=p.match(/^\/(@[^/]+)\/live/);return m?'tt:'+m[1]:'';}
  if(h==='twitch.tv'){const m=p.match(/^\/(?:popout\/)?([a-z0-9_]+)/);return m?'tw:'+m[1]:'';}
  if(h==='kick.com'){const m=p.match(/^\/(?:popout\/)?([a-z0-9_-]+)/);return m?'kk:'+m[1]:'';}
}catch{}return '';}

async function openBg(url){
  const wins=await chrome.windows.getAll({windowTypes:['normal']});
  // Ada jendela Chrome: tambah tab LATAR (active:false) tanpa merebut fokus.
  if(wins.length){const w=wins.find(x=>x.focused)||wins[0];return chrome.tabs.create({url,active:false,windowId:w.id});}
  // Chrome jalan tanpa jendela: buat jendela yang diperkecil supaya tidak merebut fokus dari game.
  try{return await chrome.windows.create({url,focused:false,state:'minimized'});}
  catch{return chrome.windows.create({url,focused:false});}
}

async function handleOpen(m){
  const p=String(m.platform||''),url=String(m.url||''),want=key(url);
  if(!OK_URL.test(url)||!want)return;
  const now=Date.now();
  const tabs=await chrome.tabs.query({url:['https://www.youtube.com/*','https://www.tiktok.com/*','https://www.twitch.tv/*','https://kick.com/*','https://www.kick.com/*']});
  const same=tabs.find(t=>key(t.url||'')===want);
  if(same){
    // Tab sudah ada tetapi content script-nya tidak terhubung ke aplikasi (tab di-discard Chrome, atau tab dibuka sebelum ekstensi dimuat ulang):
    // muat ulang supaya hidup lagi. Tidak membuat tab baru dan tidak mengubah fokus.
    if(now-(recent[p]||0)>20000){recent[p]=now;try{await chrome.tabs.reload(same.id);}catch{}}
    return;
  }
  recent[p]=now;
  await openBg(url);
}

function schedule(ms){clearTimeout(timer);timer=setTimeout(connect,ms);}
function stopPing(){clearInterval(pinger);pinger=null;}
async function connect(){
  if(ws&&(ws.readyState===0||ws.readyState===1))return;
  let cport=0;try{const r=await chrome.storage.local.get('port');cport=+(r&&r.port)||0;}catch{}
  const L=[];if(cport>=1024&&cport<=65535)L.push(cport);for(let p=3000;p<=3010;p++)if(p!==cport)L.push(p);
  const port=L[pi%L.length];let w,opened=false;
  try{w=new WebSocket('ws://127.0.0.1:'+port+'/ext');}catch{pi++;return schedule(1500);}
  ws=w;
  w.onopen=()=>{opened=true;try{w.send(JSON.stringify({type:'bg'}));}catch{}stopPing();pinger=setInterval(()=>{try{w.send('{"type":"ping"}');}catch{}},20000);};
  w.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}if(m&&m.type==='open')handleOpen(m).catch(()=>{});};
  w.onclose=()=>{stopPing();if(ws===w)ws=null;if(!opened)pi++;schedule(opened?2000:500);};
  w.onerror=()=>{try{w.close();}catch{}};
}

chrome.alarms.create('cs-keepalive',{periodInMinutes:0.5});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='cs-keepalive')connect();});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
chrome.storage.onChanged.addListener(c=>{if(c.port){pi=0;if(ws){try{ws.close();}catch{}}else connect();}});
connect();
