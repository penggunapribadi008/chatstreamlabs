// Hanya dipakai kalau membangun dari Linux/macOS (di Windows electron-builder sudah menanam ikon sendiri).
// Pemakaian: node scripts/patch-exe.js "dist/win-unpacked/ChatStream Labs.exe" assets/icon.ico
const fs=require('fs'),R=require('resedit');
const [,, exePath, icoPath]=process.argv;
const exe=R.NtExecutable.from(fs.readFileSync(exePath));
const res=R.NtExecutableResource.from(exe);
const ico=R.Data.IconFile.from(fs.readFileSync(icoPath));
const groups=R.Resource.IconGroupEntry.fromEntries(res.entries);
const gid=groups.length?groups[0].id:1,lang=groups.length?groups[0].lang:1033;
R.Resource.IconGroupEntry.replaceIconsForResource(res.entries,gid,lang,ico.icons.map(i=>i.data));
const vis=R.Resource.VersionInfo.fromEntries(res.entries);
if(vis.length){const vi=vis[0];
  vi.setStringValues({lang:vi.lang,codepage:1200},{FileDescription:'ChatStream Labs',ProductName:'ChatStream Labs',CompanyName:'ChatStream Labs',LegalCopyright:'ChatStream Labs',OriginalFilename:'ChatStream Labs.exe',InternalName:'ChatStream Labs'});
  vi.outputToResourceEntries(res.entries);}
res.outputResource(exe);
fs.writeFileSync(exePath,Buffer.from(exe.generate()));
const chk=R.NtExecutableResource.from(R.NtExecutable.from(fs.readFileSync(exePath)));
console.log('ikon diganti. grup ikon id',gid,'jumlah ukuran',ico.icons.length,'| grup di file hasil:',R.Resource.IconGroupEntry.fromEntries(chk.entries).length);
