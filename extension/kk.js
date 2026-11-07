(function(){
  // v15.2.0: tidak ada jeda tetap. waitFor memeriksa kondisi sekarang juga, lalu tiap perubahan DOM (MutationObserver; tidak ikut diperlambat Chrome pada tab latar) dan tiap ~50 ms,
  // dan berhenti begitu kondisi benar. Batas {max} ms = total jeda lama (pengaman). Hanya MEMBACA halaman: klik kirim tetap tepat satu kali.
  const waitFor=(fn,max)=>new Promise(res=>{
    let done=false,mo=null,iv=null,to=null;
    const fin=v=>{if(done)return;done=true;try{if(mo)mo.disconnect();}catch{}clearInterval(iv);clearTimeout(to);res(v);};
    const chk=()=>{let v=false;try{v=!!fn();}catch{}if(v)fin(true);return v;};
    if(chk())return;
    try{mo=new MutationObserver(chk);mo.observe(document,{subtree:true,childList:true,characterData:true,attributes:true});}catch{}
    iv=setInterval(chk,50);to=setTimeout(()=>{chk();fin(false);},max);
  });
  // Pemilih kolom chat Kick (bisa berubah kalau Kick mengubah tampilannya; dicoba berurutan).
  const SEL=['[data-testid="chat-input"]','div.editor-input[contenteditable="true"]','div[contenteditable="true"][data-lexical-editor]','div[contenteditable="true"]','textarea'];
  const BTN=['#send-message-button','button[data-testid="chat-send-button"]','button[data-testid="send-message-button"]'];
  const vis=e=>e&&e.getBoundingClientRect().width>0;
  const key=(el,t)=>el.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  async function send(text){
    let el=null;for(const s of SEL){el=[...document.querySelectorAll(s)].find(vis);if(el)break;}
    if(!el)return{ok:false,error:'kolom chat Kick tidak ditemukan (belum login di Chrome, chat dibatasi, atau halaman bukan halaman chat live)'};
    el.focus();
    if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'){Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));}
    else{document.execCommand('selectAll');document.execCommand('insertText',false,text);}
    const left=()=>(el.tagName==='TEXTAREA'||el.tagName==='INPUT')?el.value:(el.textContent||'');
    if(left().trim()==='')return{ok:false,error:'teks tidak bisa dimasukkan ke kolom chat Kick'}; // jangan lapor "ok" kalau memang tidak ada yang dikirim
    const getB=()=>{for(const s of BTN){const x=[...document.querySelectorAll(s)].find(y=>vis(y)&&!y.disabled);if(x)return x;}return null;};
    await waitFor(()=>!!getB(),350); // tombol kirim siap (dulu jeda tetap 350 ms)
    const b=getB();
    if(b)b.click();else{key(el,'keydown');key(el,'keypress');key(el,'keyup');}
    const sent=await waitFor(()=>!left().includes(text),900); // teks hilang dari kolom = terkirim (dulu jeda tetap 900 ms)
    return sent?{ok:true}:{ok:false,error:'pesan tidak terkirim (Kick menolak, mode lambat/slow mode, atau perlu verifikasi)'};
  }
  let cport=0;
  try{chrome.storage.local.get('port',r=>{cport=+(r&&r.port)||0;});chrome.storage.onChanged.addListener(c=>{if(c.port)cport=+c.port.newValue||0;});}catch{}
  const ports=()=>{const a=[];if(cport>=1024&&cport<=65535)a.push(cport);for(let p=3000;p<=3010;p++)if(p!==cport)a.push(p);return a;};
  let pi=0;
  function connect(){
    const L=ports(),port=L[pi%L.length];let ws,opened=false;
    try{ws=new WebSocket('ws://127.0.0.1:'+port+'/ext');}catch{pi++;return setTimeout(connect,1500);}
    ws.onopen=()=>{opened=true;ws.send(JSON.stringify({type:'hello',platform:'kick',page:location.href}));};
    ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.type!=='send')return;let r;try{r=await send(m.text);}catch(err){r={ok:false,error:String(err)};}ws.send(JSON.stringify({type:'result',id:m.id,...r}));};
    ws.onclose=()=>{if(!opened)pi++;setTimeout(connect,opened?3000:400);};ws.onerror=()=>{try{ws.close();}catch{}};
  }
  connect();
})();
