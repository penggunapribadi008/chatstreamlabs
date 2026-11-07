// Menyamakan folder ekstensi TETAP (di data pengguna) dengan extension/ milik aplikasi. Fungsi murni (tanpa electron) supaya bisa diuji di test/smoke.js.
// - Hanya berkas yang isinya berbeda yang ditulis (tulis ke .tmp lalu rename, jadi tidak ada berkas setengah jadi).
// - manifest.json ditulis PALING AKHIR: folder tidak pernah berisi manifest baru dengan skrip lama.
// - Berkas di folder tujuan yang sudah tidak ada di sumber dihapus. extension/ itu datar (tanpa subfolder); subfolder di sumber dilewati.
// Mengembalikan daftar yang berubah (awalan "-" = dihapus). Melempar error kalau sumber tidak punya manifest.json.
const fs=require('fs'),path=require('path');
function syncDir(src,dst){
  const files=fs.readdirSync(src).filter(f=>fs.statSync(path.join(src,f)).isFile());
  if(!files.includes('manifest.json'))throw new Error('manifest.json tidak ada di '+src);
  fs.mkdirSync(dst,{recursive:true});
  const same=(a,b)=>{try{return fs.readFileSync(a).equals(fs.readFileSync(b));}catch{return false;}};
  const changed=[];
  for(const f of files.filter(x=>x!=='manifest.json').concat('manifest.json')){
    const s=path.join(src,f),d=path.join(dst,f);if(same(s,d))continue;
    const t=d+'.tmp';fs.copyFileSync(s,t);fs.renameSync(t,d);changed.push(f);
  }
  for(const f of fs.readdirSync(dst)){if(!files.includes(f)){try{fs.rmSync(path.join(dst,f),{recursive:true,force:true});changed.push('-'+f);}catch{}}}
  return changed;
}
module.exports={syncDir};
