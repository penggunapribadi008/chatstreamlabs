// Membangun folder build/ (dijalankan otomatis oleh npm start / npm run dist).
//   src/ui/{style.css,body.html,app.js} -> build/index.html   (satu berkas, dilayani server lokal)
//   src/server.js (+ ws, youtube-chat, tiktok-live-connector, seeds.json) -> build/server.js   (satu bundel CommonJS)
//   src/main.js + aset -> build/
const fs=require('fs'),path=require('path'),esbuild=require('esbuild');
const root=path.join(__dirname,'..'),out=path.join(root,'build'),VER=require('./version').check(true),ui=f=>fs.readFileSync(path.join(root,'src/ui',f),'utf8').split('{{VERSION}}').join(VER); // {{VERSION}} = versi dari package.json (tidak boleh ditulis manual)
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'index.html'),
  '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>ChatStream Labs</title>\n<style>'+ui('style.css')+'</style><style id="usercss"></style></head>\n'+ui('body.html')+'<script>\n'+ui('app.js')+'</script></body></html>\n');
esbuild.buildSync({entryPoints:[path.join(root,'src/server.js')],bundle:true,platform:'node',target:'node22',format:'cjs',outfile:path.join(out,'server.js'),
  external:['bufferutil','utf-8-validate'],minifyWhitespace:true,minifySyntax:true,logLevel:'error'});
fs.copyFileSync(path.join(root,'src/main.js'),path.join(out,'main.js'));
for(const f of['yt.png','tt.png','tw.png','kick.png','icon.png'])fs.copyFileSync(path.join(root,'assets',f),path.join(out,f));
fs.copyFileSync(path.join(root,'src/splash.html'),path.join(out,'splash.html'));
for(const f of['splash-bg.webp','splash-logo.png'])fs.copyFileSync(path.join(root,'assets',f),path.join(out,f));
console.log('build/ siap');
