// Mengganti nama aplikasi di seluruh proyek dengan satu perintah.
//   node scripts/rename.js "Nama Baru"
// Data pengguna dari nama lama tetap ikut (nama lama dicatat di package.json -> previousNames).
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),pkgPath=path.join(root,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
const NEW=(process.argv[2]||'').trim();if(!NEW){console.log('Pemakaian: node scripts/rename.js "Nama Baru"');process.exit(1);}
const OLD=pkg.build.productName;if(OLD===NEW){console.log('Nama sudah '+NEW);process.exit(0);}
const hy=s=>s.replace(/\s+/g,'-'),slug=s=>hy(s).toLowerCase(),first=s=>s.split(/\s+/)[0];
const pairs=[[OLD,NEW],[hy(OLD),hy(NEW)],[first(OLD)+' Overlay',first(NEW)+' Overlay'],[slug(OLD),slug(NEW)]];
const skip=new Set(['node_modules','build','dist','.git']);
function walk(d,fn){for(const f of fs.readdirSync(d)){if(skip.has(f))continue;const p=path.join(d,f),s=fs.statSync(p);if(s.isDirectory())walk(p,fn);else fn(p);}}
let n=0;
walk(root,p=>{if(!/\.(js|json|html|css|md|yml|yaml|txt)$/i.test(p)||/package-lock\.json$/.test(p)||/seeds\.json$/.test(p))return;
  let t=fs.readFileSync(p,'utf8'),o=t;
  if(path.resolve(p)===pkgPath){const j=JSON.parse(t);j.previousNames=[...new Set([...(j.previousNames||[]),OLD])].filter(x=>x!==NEW);t=JSON.stringify(j,null,2);}
  for(const [a,b] of pairs)t=t.split(a).join(b);
  if(path.resolve(p)===pkgPath){const j=JSON.parse(t);j.previousNames=[...new Set([...(j.previousNames||[]),OLD])].filter(x=>x!==NEW);t=JSON.stringify(j,null,2);}
  if(t!==o){fs.writeFileSync(p,t);n++;}});
console.log('Selesai: '+n+' berkas diperbarui. Nama aplikasi sekarang "'+NEW+'". Jalankan: npm run build');
