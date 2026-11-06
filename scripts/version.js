// Satu sumber versi untuk SEMUA tempat. Angka versi sebenarnya ada di package.json; skrip ini menyamakan sisanya dan memeriksa kalau ada yang beda.
//   node scripts/version.js check            -> cek semua tempat sama dengan package.json (build & workflow memanggil ini)
//   node scripts/version.js set 15.1.3       -> ganti versi di semua tempat sekaligus
// Tempat yang disamakan: package.json, package-lock.json (2 tempat), extension/manifest.json.
// Yang ikut otomatis: tulisan versi di sidebar aplikasi (disuntik saat build), nama installer (chatstreamlab-v<versi>.exe),
// nama rilis/tag GitHub (v<versi>), dan versi auto-update. Nama zip dan pesan commit disamakan manual (lihat PANDUAN-GITHUB.md).
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),P={pkg:'package.json',lock:'package-lock.json',man:'extension/manifest.json'};
const rd=k=>JSON.parse(fs.readFileSync(path.join(root,P[k]),'utf8')),wr=(k,j)=>fs.writeFileSync(path.join(root,P[k]),JSON.stringify(j,null,2)+'\n');
const RE=/^\d+\.\d+\.\d+$/;
function found(){
  const pkg=rd('pkg'),lock=rd('lock'),man=rd('man');
  return {'package.json':pkg.version,'package-lock.json (atas)':lock.version,'package-lock.json (packages[""])':lock.packages&&lock.packages[''].version,'extension/manifest.json':man.version};
}
function check(quiet){
  const f=found(),want=f['package.json'],bad=Object.entries(f).filter(([,v])=>v!==want);
  if(!RE.test(want)){console.error('Versi di package.json tidak valid: "'+want+'" (harus seperti 15.1.1)');process.exit(1);}
  if(bad.length){console.error('Versi tidak sama di semua tempat (package.json = '+want+'):');bad.forEach(([k,v])=>console.error('  - '+k+' = '+v));console.error('Perbaiki dengan: node scripts/version.js set '+want);process.exit(1);}
  if(!quiet)console.log('Versi sama di semua tempat: '+want);
  return want;
}
function set(v){
  if(!RE.test(v||'')){console.error('Pemakaian: node scripts/version.js set 15.1.3');process.exit(1);}
  const pkg=rd('pkg');pkg.version=v;wr('pkg',pkg);
  const lock=rd('lock');lock.version=v;if(lock.packages&&lock.packages[''])lock.packages[''].version=v;wr('lock',lock);
  const man=rd('man');man.version=v;wr('man',man);
  console.log('Versi diganti ke '+v+' di package.json, package-lock.json, extension/manifest.json.');
  check();
}
if(require.main===module){
  const [cmd,arg]=process.argv.slice(2);
  if(cmd==='set')set(arg);else if(cmd==='check'||!cmd)check();else{console.error('Perintah: check | set <versi>');process.exit(1);}
}
module.exports={check};
