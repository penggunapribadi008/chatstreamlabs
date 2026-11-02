(function(){
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function send(text){
    const i=document.querySelector('yt-live-chat-text-input-field-renderer #input');
    if(!i)return{ok:false,error:'kolom chat YouTube tidak ditemukan (belum login di Chrome, atau chat live ini dimatikan)'};
    i.focus();document.execCommand('selectAll');document.execCommand('insertText',false,text);
    i.dispatchEvent(new Event('input',{bubbles:true}));await sleep(300);
    const b=document.querySelector('yt-live-chat-message-input-renderer #send-button button')||document.querySelector('#send-button button');
    if(b)b.click();else i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));
    await sleep(700);
    return(i.textContent||'').trim()===''?{ok:true}:{ok:false,error:'pesan tidak terkirim (YouTube menolak, mungkin mode lambat/slow mode)'};
  }
  let pi=0;
  function connect(){
    const port=3000+(pi%11);let ws,opened=false;
    try{ws=new WebSocket('ws://127.0.0.1:'+port+'/ext');}catch{pi++;return setTimeout(connect,1500);}
    ws.onopen=()=>{opened=true;ws.send(JSON.stringify({type:'hello',platform:'youtube'}));};
    ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.type!=='send')return;let r;try{r=await send(m.text);}catch(err){r={ok:false,error:String(err)};}ws.send(JSON.stringify({type:'result',id:m.id,...r}));};
    ws.onclose=()=>{if(!opened)pi++;setTimeout(connect,opened?3000:400);};ws.onerror=()=>{try{ws.close();}catch{}};
  }
  connect();
})();
