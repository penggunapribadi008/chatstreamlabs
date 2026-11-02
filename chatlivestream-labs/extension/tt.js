(function(){
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const SEL=['[data-e2e="comment-input"] [contenteditable]','[data-e2e="comment-input"]','div[contenteditable="plaintext-only"]','div[contenteditable="true"]','textarea'];
  const vis=e=>e&&e.getBoundingClientRect().width>0;
  const key=(el,t)=>el.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  async function send(text){
    let el=null;for(const s of SEL){el=[...document.querySelectorAll(s)].find(vis);if(el)break;}
    if(!el)return{ok:false,error:'kolom chat TikTok tidak ditemukan (belum login di Chrome, atau live belum berjalan)'};
    el.focus();
    if(el.tagName==='TEXTAREA'){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));}
    else{document.execCommand('selectAll');document.execCommand('insertText',false,text);}
    await sleep(350);
    const post=document.querySelector('[data-e2e="comment-post"]');
    if(post)post.click();else{key(el,'keydown');key(el,'keypress');key(el,'keyup');}
    await sleep(800);
    const left=el.tagName==='TEXTAREA'?el.value:(el.textContent||'');
    return left.trim()===''?{ok:true}:{ok:false,error:'pesan tidak terkirim (TikTok menolak atau perlu verifikasi)'};
  }
  let pi=0;
  function connect(){
    const port=3000+(pi%11);let ws,opened=false;
    try{ws=new WebSocket('ws://127.0.0.1:'+port+'/ext');}catch{pi++;return setTimeout(connect,1500);}
    ws.onopen=()=>{opened=true;ws.send(JSON.stringify({type:'hello',platform:'tiktok'}));};
    ws.onmessage=async e=>{const m=JSON.parse(e.data);if(m.type!=='send')return;let r;try{r=await send(m.text);}catch(err){r={ok:false,error:String(err)};}ws.send(JSON.stringify({type:'result',id:m.id,...r}));};
    ws.onclose=()=>{if(!opened)pi++;setTimeout(connect,opened?3000:400);};ws.onerror=()=>{try{ws.close();}catch{}};
  }
  connect();
})();
