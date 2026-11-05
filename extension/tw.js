(function(){
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // Pemilih kolom chat Twitch (bisa berubah kalau Twitch mengubah tampilannya; dicoba berurutan).
  const SEL=['[data-a-target="chat-input"]','div[data-test-selector="chat-input"]','.chat-wysiwyg-input__editor','div[contenteditable="true"][role="textbox"]','textarea[data-a-target="chat-input"]'];
  const BTN=['[data-a-target="chat-send-button"]','button[data-test-selector="chat-send-button"]'];
  const vis=e=>e&&e.getBoundingClientRect().width>0;
  const key=(el,t)=>el.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  async function send(text){
    let el=null;for(const s of SEL){el=[...document.querySelectorAll(s)].find(vis);if(el)break;}
    if(!el)return{ok:false,error:'kolom chat Twitch tidak ditemukan (belum login di Chrome, chat dibatasi, atau halaman bukan halaman chat live)'};
    el.focus();
    if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'){Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));}
    else{document.execCommand('selectAll');document.execCommand('insertText',false,text);}
    await sleep(350);
    let b=null;for(const s of BTN){b=[...document.querySelectorAll(s)].find(x=>vis(x)&&!x.disabled);if(b)break;}
    if(b)b.click();else{key(el,'keydown');key(el,'keypress');key(el,'keyup');}
    await sleep(900);
    const left=(el.tagName==='TEXTAREA'||el.tagName==='INPUT')?el.value:(el.textContent||'');
    return left.includes(text)?{ok:false,error:'pesan tidak terkirim (Twitch menolak, mode lambat/slow mode, atau perlu verifikasi)'}:{ok:true};
  }
  let cport=0;
  try{chrome.storage.local.get('port',r=>{cport=+(r&&r.port)||0;});chrome.storage.onChanged.addListener(c=>{if(c.port)cport=+c.port.newValue||0;});}catch{}
  const ports=()=>{const a=[];if(cport>=1024&&cport<=65535)a.push(cport);for(let p=3000;p<=3010;p++)if(p!==cport)a.push(p);return a;};
  let pi=0;
  function connect(){
    const L=ports(),port=L[pi%L.length];let ws,opened=false;
    try{ws=new WebSocket('ws://127.0.0.1:'+port+'/ext');}catch{pi++;return setTimeout(connect,1500);}
    ws.onopen=()=>{opened=true;ws.send(JSON.stringify({type:'hello',platform:'twitch'}));};
    ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.type!=='send')return;let r;try{r=await send(m.text);}catch(err){r={ok:false,error:String(err)};}ws.send(JSON.stringify({type:'result',id:m.id,...r}));};
    ws.onclose=()=>{if(!opened)pi++;setTimeout(connect,opened?3000:400);};ws.onerror=()=>{try{ws.close();}catch{}};
  }
  connect();
})();
