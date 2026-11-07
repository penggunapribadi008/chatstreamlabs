// Penyimpan token login resmi, satu berkas terenkripsi untuk semua platform ({platform: base64-terenkripsi}).
// Server tidak boleh mengimpor electron, jadi enkripsi dipinjam dari main.js lewat hooks.cryptOk/encrypt/decrypt (Electron safeStorage).
// Kalau enkripsi tidak tersedia, token TIDAK ditulis ke disk sama sekali (hanya di memori sampai aplikasi ditutup); set() mengembalikan false
// supaya UI memberi tahu pengguna. Token tidak pernah masuk config.json / settings.json / log.txt.
const fs=require('fs');
module.exports=function(file,hooks){
  const mem={};
  const can=()=>{try{return !!(hooks.cryptOk&&hooks.cryptOk()&&hooks.encrypt&&hooks.decrypt);}catch{return false;}};
  const rd=()=>{try{const j=JSON.parse(fs.readFileSync(file,'utf8'));return j&&typeof j==='object'?j:{};}catch{return {};}};
  const wr=o=>{const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(o),{mode:0o600});fs.renameSync(t,file);};
  return{
    can,
    get(k){
      if(mem[k])return mem[k];
      try{const b=rd()[k];if(!b||!can())return null;const s=hooks.decrypt(b);return s?(mem[k]=JSON.parse(s)):null;}catch{return null;}},
    // true = tersimpan terenkripsi di disk; false = hanya di memori
    set(k,v){
      mem[k]=v;if(!can())return false;
      try{const e=hooks.encrypt(JSON.stringify(v));if(!e)return false;const o=rd();o[k]=e;wr(o);return true;}catch{return false;}},
    del(k){delete mem[k];try{const o=rd();if(k in o){delete o[k];wr(o);}}catch{}}
  };
};
