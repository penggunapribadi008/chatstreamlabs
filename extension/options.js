const p=document.getElementById('p'),m=document.getElementById('m');
chrome.storage.local.get('port',r=>{if(r&&r.port)p.value=r.port;});
document.getElementById('s').onclick=()=>{const v=p.value.trim();
  if(v===''){chrome.storage.local.remove('port',()=>{m.textContent='Tersimpan (kembali ke 3000-3010).';});return;}
  const n=Number(v);if(!Number.isInteger(n)||n<1024||n>65535){m.textContent='Port harus 1024 sampai 65535.';return;}
  chrome.storage.local.set({port:n},()=>{m.textContent='Tersimpan.';});};
