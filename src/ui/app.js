const Q=new URLSearchParams(location.search),V=Q.get('view'),view=V==='overlay'?'overlay':'dock',isDash=V==='dashboard',isSet=V==='settings'||isDash,isTpl=V==='tpl',isAdd=V==='tpladd',isCtl=V==='ctl',isRep=V==='report',isDB=V==='donatebar',isGA=V==='galert',isAdmin=isSet||isTpl||isAdd||isCtl||isRep||isDB||isGA,isPrev=!!Q.get('preview'),isStatic=!!Q.get('static'),isLocked=!!Q.get('locked'),forceId=Q.get('force');
const COMMON={fsName:16,fsText:16,gap:12,bg:90,max:300,fade:0,time:false,viewers:true,botTag:true,hideBots:false,preset:'polos',anim:'slide',order:'bottom',chatBg:false,chatBgColor:'#000000',chatBgOp:60};
// registri platform: nama penuh -> huruf kelas (y/t/w/k), akhiran kelas (yt/tt/tw/kk), logo
const PK={youtube:'y',tiktok:'t',twitch:'w',kick:'k'},PC={y:'yt',t:'tt',w:'tw',k:'kk'},PN={y:'youtube',t:'tiktok',w:'twitch',k:'kick'},PL={youtube:'/yt.png',tiktok:'/tt.png',twitch:'/tw.png',kick:'/kick.png'};
const PNAME={youtube:'YouTube',tiktok:'TikTok',twitch:'Twitch',kick:'Kick'};
// aktivitas per platform: [kunci, label, ikon, warna font bawaan, nyala bawaan: 'd' = hanya Pribadi, 'b' = Pribadi & Overlay, '' = mati]
const TT_ACTS=[['Join','Penonton bergabung','\u{1F44B}','#ffffff','d'],['Gift','Hadiah (gift)','\u{1F381}','#ffd166','b'],['Like','Suka (like)','\u2764\uFE0F','#ff9bb3',''],['Follow','Mulai mengikuti','\u2795','#8be9a8','b'],['Share','Membagikan live','\u2197\uFE0F','#9fd3ff',''],['Sub','Berlangganan','\u2B50','#ffe08a','b']];
const TW_ACTS=[['Sub','Subscribe / resub','\u2B50','#ffe08a','b'],['Gift','Gift sub','\u{1F381}','#ffd166','b'],['Raid','Raid masuk','\u{1F680}','#9fd3ff','b'],['Announce','Pengumuman moderator','\u{1F4E2}','#ffffff','b'],['First','Chatter baru pertama kali chat','\u{1F44B}','#ffffff','d']];
const KK_ACTS=[['Sub','Subscribe','\u2B50','#ffe08a','b'],['Gift','Gift sub','\u{1F381}','#ffd166','b'],['Follow','Mulai mengikuti','\u2795','#8be9a8','b'],['Raid','Raid / host masuk','\u{1F680}','#9fd3ff','b'],['Reward','Hadiah poin (reward)','\u{1F3C6}','#ffffff','b']];
const ACT={tiktok:{pre:'tt',list:TT_ACTS,logo:'/tt.png'},twitch:{pre:'tw',list:TW_ACTS,logo:'/tw.png'},kick:{pre:'kk',list:KK_ACTS,logo:'/kick.png'}};
// chat berbayar yang disorot (Super Chat / Bits / Kicks): awalan kunci pengaturan; badge member/subscriber; label VIP
const SCK={youtube:'ytSc',twitch:'twBits',kick:'kkKicks'},MEMK={youtube:'ytMem',twitch:'twMem',kick:'kkMem'},VIPK={twitch:'twVipBadge',kick:'kkVipBadge'};
const platDef=dock=>{const o={ytSc:true,ytScBg:'auto',ytScBgC:'#ffca28',ytScBgOp:38,ytScFcOn:false,ytScFc:'#ffffff',ytScAmt:true,ytScHold:3,ytSticker:true,ytMemBadge:true,ytMemNameOn:false,ytMemC:'#2ba640',
    twBits:true,twBitsBg:'auto',twBitsBgC:'#9c3ee8',twBitsBgOp:38,twBitsFcOn:false,twBitsFc:'#ffffff',twBitsAmt:true,twBitsHold:3,twHl:true,twMemBadge:true,twMemNameOn:false,twMemC:'#b794ff',twVipBadge:true,
    kkKicks:true,kkKicksBg:'auto',kkKicksBgC:'#53fc18',kkKicksBgOp:38,kkKicksFcOn:false,kkKicksFc:'#ffffff',kkKicksAmt:true,kkKicksHold:3,kkMemBadge:true,kkMemNameOn:false,kkMemC:'#53fc18',kkVipBadge:true};
  for(const pf in ACT){const {pre,list}=ACT[pf];o[pre+'Act']=true;o[pre+'GiftMin']=0;
    list.forEach(([k,,,fc,on])=>{o[pre+k]=on==='b'||(on==='d'&&dock);o[pre+k+'Bg']=true;o[pre+k+'BgC']='#000000';o[pre+k+'BgOp']=60;o[pre+k+'Fc']=fc;});}
  return o;};
const DEF={dock:{...COMMON,...platDef(true),avatar:false,theme:'standar'},overlay:{...COMMON,...platDef(false),anim:'auto',align:'left',fsName:20,fsText:20,bg:0,max:8,fade:45,viewers:false,avatar:true}};
const PRE=[['polos','Default']];
const BUILT=PRE.map(x=>x[0]);
const THEMES=[['standar','Standar'],['neo','Neumorfisme'],['glass','Glassmorphism'],['clay','Claymorphism'],['liquid','Liquid Glass'],['spatial','Spatial UI']];
const ANI=[['none','Tanpa animasi'],['slide','Geser'],['fade','Muncul pelan'],['bounce','Memantul'],['zoom','Zoom'],['flip','Putar 3D'],['type','Mengetik'],['glitch','Glitch']];
const ORD=[['bottom','Dari bawah (chat baru di bawah)'],['top','Dari atas (chat baru di atas)']];
// platform yang dinyalakan di Koneksi: menentukan header, filter, kirim chat, pengaturan, dan pratinjau
const PF4=['youtube','tiktok','twitch','kick'];
let EN={youtube:true,tiktok:true,twitch:false,kick:false};
const setEN=e=>{if(e)PF4.forEach(p=>{if(e[p]!=null)EN[p]=!!e[p];});};
let S={dock:{},overlay:{},global:{}},saved=JSON.parse(JSON.stringify(S)),conf={},viewers={},status={},curTab='k',draftTpl=null,curStruct='std',curPid='polos',msgsData=[],accState={};
let filt='all';try{filt=localStorage.getItem('flt')||'all';}catch{}
const $=id=>document.getElementById(id),list=$('list');
const cur=v=>{const s=S[v]||{},o={...DEF[v],...s};if(s.fs!=null&&s.fsName==null&&s.fsText==null){o.fsName=s.fs;o.fsText=s.fs;}if(s.ttJoin==null&&s.joins!=null)o.ttJoin=!!s.joins;return o;};
const fmt=n=>n==null?'-':n.toLocaleString('id-ID');
const hhmm=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const hexA=(h,p)=>{const n=parseInt((h||'#000000').slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+p/100+')';};
const copy=o=>JSON.parse(JSON.stringify(o));
const post=(u,b)=>fetch(u,{method:'POST',body:JSON.stringify(b||{})});
document.addEventListener('dragstart',e=>e.preventDefault());
const wrap=$('msgs');
const BASECLS=isDash?'settings dashboard':isSet?'settings':isTpl?'tplwin':isAdd?'addwin':isCtl?'ctlwin':isRep?'reportwin':isDB?'donatewin':isGA?'galertwin':'';
const BOOTTH=[...document.body.classList].find(c=>c.startsWith('th-'))||'';
if(BASECLS)document.body.className=BASECLS+(BOOTTH?' '+BOOTTH:'');
let booting=true;
function bootDone(){window.__ready=true;const b=$('boot');if(b)b.style.display='none';setTimeout(()=>{booting=false;document.body.classList.remove('noanim');},900);if((!isAdmin&&!isPrev)||isSet)try{post('/ready');}catch{}}
function bootFail(m){const b=$('boot');if(b){b.style.display='flex';b.textContent='Terjadi kesalahan saat memuat tampilan:\n'+m+'\n\nTutup lalu buka aplikasi lagi. Kalau berulang, kirim pesan ini ke pengembang.';}try{post('/log',{msg:String(m)});}catch{}}
addEventListener('error',e=>bootFail((e&&e.message)||'error'));addEventListener('unhandledrejection',e=>bootFail(String(e&&e.reason&&e.reason.message||e.reason||'promise')));
// ---- tema aplikasi (bukan overlay) ----
const lum=h=>{const n=parseInt((h||'#000000').slice(1),16);return(0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255;};
const rgbOf=h=>{const n=parseInt((h||'#000000').slice(1),16);return[n>>16&255,n>>8&255,n&255];};
const ink=h=>lum(h)>0.55?'#14110f':'#ffffff';
const UIVARS=['--winbg','--card-bg','--ctl-bg','--ctl-line','--line','--muted','--text','--acc','--acc-t','--btn2','--base','--yc','--tcl','--wc','--kc'];
function applyUi(s){
  const b=document.body,st=b.style;
  [...b.classList].forEach(c=>{if(c.startsWith('th-'))b.classList.remove(c);});UIVARS.forEach(k=>st.removeProperty(k));
  const t=s.theme||'standar';
  if(t!=='standar'&&t!=='kustom')b.classList.add('th-'+t);

}
// warna chat yang terbaca di atas latar chat pilihan pengguna
function chatColors(s,pid){
  const st=document.body.style;['--ctext'].forEach(k=>st.removeProperty(k));
  if(!s.chatBg||(view==='overlay'&&pid!=='polos'))return;
  const c=rgbOf(s.chatBgColor),a=s.chatBgOp/100;
  const base=(view==='dock'&&!isLocked)?(getComputedStyle(document.body).getPropertyValue('--base')||'14,18,20').split(',').map(Number):[20,20,26];
  const e=c.map((v,i)=>v*a+(base[i]||0)*(1-a)),L=(0.299*e[0]+0.587*e[1]+0.114*e[2])/255;
  st.setProperty('--ctext',L<.55?'#ffffff':'#14110f');
  if(view==='dock'){st.setProperty('--yc',L<.55?'#ff8f8a':'#b3262c');st.setProperty('--tcl',L<.55?'#6fe3ee':'#0a7f88');st.setProperty('--wc',L<.55?'#b794ff':'#5b21b6');st.setProperty('--kc',L<.55?'#53fc18':'#2a8a0c');}
}
// ---- judul jendela tanpa bingkai ----
const WHICH=isDash?'dash':isSet?'settings':isTpl?'tpl':isAdd?'tpladd':isRep?'report':isDB?'donate':'main';
if(!isPrev&&!isCtl&&!isGA&&view==='dock'||isSet||isTpl||isAdd||isDB){
  $('tbt').textContent=isDB?'Donate Dock':isRep?'Laporan penonton':isDash?'ChatStream Labs - Dashboard':isSet?'Pengaturan':isTpl?'Kelola gaya overlay':isAdd?'Gaya overlay':'ChatStream Labs';
  $('wmin').onclick=()=>post('/win',{which:WHICH,act:'min'});$('wclose').onclick=()=>post('/win',{which:WHICH,act:'close'});
}
if(view==='dock'&&!isPrev&&!isAdmin&&$('weye')){
  $('wlock').onclick=()=>post('/lock',{on:true});
  $('weye').onclick=async()=>{await post('/protect-toggle');eyeW();};
  const eyeW=async()=>{try{const r=await(await fetch('/state')).json();document.documentElement.classList.toggle('prot',!!r.protect);$('weye').title=r.protect?'Tersembunyi dari OBS (klik untuk menampilkan)':'Terlihat di OBS (klik untuk menyembunyikan)';}catch{}};
  eyeW();setInterval(()=>{if(!document.hidden)eyeW();},4000);
}
const detectStruct=css=>/data-color\s*=|data-mode\s*=/.test(css||'')?'cozy':/\.p5-msg/.test(css||'')?'p5':(/\.badge\b/.test(css||'')&&/\.p-(yt|tt)\b/.test(css||''))?'rv':'std';
const customs=()=>((S.global&&S.global.templates)||[]);
function tplOf(id){
  if(id==='__draft')return draftTpl?{custom:true,struct:detectStruct(draftTpl.css),css:draftTpl.css||''}:null;
  if(BUILT.includes(id))return{builtin:true,struct:id==='persona'?'p5':'std'};
  const t=customs().find(x=>x.id===id);return t?{custom:true,struct:detectStruct(t.css),css:t.css||''}:null;
}
function applyStyle(){
  const s=cur(view),b=document.body,r=document.documentElement.style;
  b.classList.toggle('nosend',!!(S.global&&S.global.sendOn===false));
  r.setProperty('--fsn',s.fsName+'px');r.setProperty('--fst',s.fsText+'px');r.setProperty('--fs',s.fsText+'px');r.setProperty('--gap',s.gap+'px');r.setProperty('--bg',s.bg/100);
  r.setProperty('--cbg',s.chatBg?hexA(s.chatBgColor,s.chatBgOp):'transparent');r.setProperty('--p5-scale',(s.fsText/17.5).toFixed(3));r.setProperty('--nr',(s.fsName/s.fsText).toFixed(3));
  let pid=view==='overlay'?(forceId||s.preset):'polos',tpl=tplOf(pid);if(!tpl){pid='polos';tpl=tplOf('polos');}
  const oldStruct=curStruct;curStruct=tpl.struct;curPid=pid;
  let an=s.anim;if(an==='auto'||!an)an=(view==='overlay'&&tpl.custom)?'tpl':'slide';
  const usesVars=!!(tpl.custom&&/--fs[nt]\b|--p5-scale|--nr\b/.test(tpl.css||'')),zm=view==='overlay'&&tpl.custom&&!usesVars&&tpl.struct!=='p5'&&tpl.struct!=='cozy'&&/font(-size)?\s*:[^;}]*\d+(\.\d+)?px/.test(tpl.css||'');
  r.setProperty('--zn',(s.fsName/20).toFixed(3));r.setProperty('--zt',(s.fsText/20).toFixed(3));
  $('usercss').textContent=tpl.custom?tpl.css:'';
  b.className=[view,isPrev?'preview':'',isLocked?'locked':'',s.chatBg?'cb':'',s.order==='top'?'ot':'',(view==='overlay'&&s.align==='right')?'al-right':'',(view==='overlay'&&tpl.struct==='rv')?'s-rv':'','p-'+(tpl.custom?'custom':pid),'an-'+an,zm?'zm':'',(view==='overlay'&&s.gap!==DEF.overlay.gap)?'gap-set':'',booting?'noanim':'',s.viewers?'sv':'',s.time?'st':'',s.avatar?'':'na',s.botTag?'':'nobt',s.hideBots?'hb':'',(view==='dock'&&filt!=='all')?'f-'+filt:'',(S.global&&S.global.sendOn===false)?'nosend':''].filter(Boolean).join(' ');
  if(view==='dock'&&!isLocked)applyUi(s);
  chatColors(s,pid);
  if(view==='overlay'){wrap.id=curStruct==='rv'?'log':curStruct==='cozy'?'chat':'msgs';if(curStruct==='cozy')wrap.dataset.mode='person';else delete wrap.dataset.mode;}
  if(oldStruct!==curStruct&&view==='overlay')rebuild();
  trim();updBtn();
}
const isTop=()=>cur(view).order==='top';
function trim(){const s=cur(view);while(wrap.children.length>s.max)(isTop()?wrap.lastChild:wrap.firstChild).remove();}
function put(d){if(isTop())wrap.prepend(d);else wrap.appendChild(d);}
function atLatest(){return isTop()?list.scrollTop<70:list.scrollHeight-list.scrollTop-list.clientHeight<70;}
function toLatest(){list.scrollTop=isTop()?0:list.scrollHeight;updBtn();}
function updBtn(){const b=$('tobottom');b.textContent=isTop()?'↑ Chat terbaru':'↓ Chat terbaru';b.style.display=(view==='dock'&&!isLocked&&!isAdmin&&!atLatest())?'block':'none';}
list.addEventListener('scroll',updBtn);$('tobottom').onclick=toLatest;
// kotak Twitch / Kick di header hanya muncul kalau platformnya dipakai (ada username / sedang tersambung)
// kotak di header hanya untuk platform yang dinyalakan
function showViewers(){$('vy').textContent=fmt(viewers.youtube);$('vt').textContent=fmt(viewers.tiktok);$('vw').textContent=fmt(viewers.twitch);$('vk').textContent=fmt(viewers.kick);
  [['chy','youtube'],['cht','tiktok'],['cw','twitch'],['ck','kick']].forEach(([i,p])=>$(i).classList.toggle('off',!EN[p]));
  const a=PF4.filter(p=>EN[p]).map(k=>viewers[k]).filter(x=>x!=null);$('vs').textContent=a.length?fmt(a.reduce((x,y)=>x+y,0)):'-';}
function stView(v){v=String(v||'-');if(/^terhubung/i.test(v))return['ok','Terhubung'];if(/not found|not online|isn't online|tidak ditemukan|offline/i.test(v))return['wait','Belum live, mencoba lagi'];if(/gagal|coba lagi/i.test(v))return['bad','Gagal tersambung, mencoba lagi'];return['',v.charAt(0).toUpperCase()+v.slice(1)];}
function showSt(s){status=s;PF4.forEach(k=>{const b=$('st_'+k);if(!b)return;b.textContent='';if(!EN[k])return;const [c,t]=stView(s[k]),v=document.createElement('span');v.className='sv'+(c?' '+c:'');v.textContent=t;b.appendChild(v);});showViewers();if(isDash)dashRender();}
// dipanggil saat switch platform berubah (dan saat pertama dimuat)
function fltBuild(){const f=$('flt');if(!f)return;const on=PF4.filter(p=>EN[p]);
  if(filt!=='all'&&!on.includes(filt)){filt='all';try{localStorage.setItem('flt',filt)}catch{}}
  f.innerHTML='<option value="all">Semua</option>'+on.map(p=>'<option value="'+p+'">'+PNAME[p]+'</option>').join('');f.value=filt;}
function syncPlats(){
  document.querySelectorAll('[data-pf]').forEach(e=>{e.style.display=EN[e.dataset.pf]?'':'none';});
  document.querySelectorAll('.nop').forEach(e=>{e.style.display=PF4.some(p=>EN[p])?'none':'';});
  const UIN={youtube:'yt',tiktok:'tk',twitch:'twu',kick:'kku'};
  PF4.forEach(p=>{const sw=$('en_'+p);if(sw)sw.checked=!!EN[p];const row=$('cn_'+p);if(row)row.classList.toggle('off',!EN[p]);const ip=$(UIN[p]);if(ip)ip.disabled=!EN[p];});}
function applyEnabled(){
  showViewers();
  if(isAdmin){if(isSet){syncPlats();if(isDash){dashRender();pvSend();}}return;}
  fltBuild();
  [...wrap.querySelectorAll('[data-platform]')].forEach(e=>{if(EN[e.dataset.platform]===false)e.remove();});
  msgsData=msgsData.filter(m=>EN[m.p]!==false);
  applyStyle();}
const FLAGS=m=>(m.bot?' isbot':'')+(m.mod?' ismod':'')+(m.owner?' isown':'')+(m.vip?' isvip':'')+(m.me?' isme':'')+(m.sample?' sample':'')+(m.sc?' sc':'')+(m.member?' ismem':'');
const memOn=(m,s)=>m.member&&s[(MEMK[m.p]||'ytMem')+'Badge'];
// isi teks chat; emote (m.emo = [[mulai,akhir,url],...] dalam hitungan karakter) dirender sebagai gambar kecil, kalau gagal dimuat tampil sebagai namanya
function fillText(el,m){const t=String(m.text==null?'':m.text);if(!m.emo||!m.emo.length){el.textContent=t;return;}
  const cp=Array.from(t);let pos=0;el.textContent='';
  m.emo.forEach(([a,b,u])=>{if(a<pos||b>cp.length||!/^https:\/\//.test(u))return;if(a>pos)el.appendChild(document.createTextNode(cp.slice(pos,a).join('')));
    const im=document.createElement('img');im.className='cs-emo';im.alt=cp.slice(a,b).join('');im.referrerPolicy='no-referrer';im.onerror=()=>im.replaceWith(document.createTextNode(im.alt));im.src=u;el.appendChild(im);pos=b;});
  if(pos<cp.length)el.appendChild(document.createTextNode(cp.slice(pos).join('')));}
const scColor=m=>(m.sc&&/^#[0-9a-f]{6}$/i.test(m.sc.color||''))?m.sc.color:'#ffca28';
const BADGES='<span class="bd bot">BOT</span><span class="bd mod">MOD</span><span class="bd own">OWNER</span><span class="bd vip">VIP</span><span class="bd mem">MEMBER</span>';
function buildStd(m,src,pf){
  const d=document.createElement('div');d.className='m msg '+pf+' '+PC[pf]+FLAGS(m);d.dataset.platform=PN[pf];
  d.innerHTML='<span class="pl logo"><img src="'+src+'" alt=""></span><div class="av avatar"></div><div class="body"><div class="hd head"><span class="tag"><img class="pi" src="'+src+'" alt=""><b class="nm name"></b></span><span class="tm time"></span><span class="amt"></span>'+BADGES+'</div><div class="tx text message"><span></span></div></div>';
  const nmEl=d.querySelector('.nm');for(const ch of [...(m.name||'')]){const i=document.createElement('i');i.textContent=ch===' '?'\u00a0':ch;if(ch===' ')i.className='sp';nmEl.appendChild(i);}
  fillText(d.querySelector('.tx>span'),m);d.querySelector('.tm').textContent=hhmm(m.t);
  if(m.sc){d.style.setProperty('--sc',scColor(m));d.querySelector('.amt').textContent=m.sc.amount;}
  const av=d.querySelector('.av');if(m.avatar)av.style.backgroundImage='url("'+m.avatar.replace(/"/g,'')+'")';else av.textContent=(m.name||'?')[0].toUpperCase();
  return d;}
function buildP5(m,src,pf){
  const d=document.createElement('div');d.className='m p5-msg '+pf+' p5-'+PC[pf]+FLAGS(m);d.dataset.platform=PN[pf];
  d.innerHTML='<div class="p5-head"><span class="p5-logo"><span class="p5-logo-in"><img src="'+src+'" alt=""></span></span><span class="p5-name"></span><span class="tm"></span><span class="p5-amt"></span>'+BADGES+'</div><div class="p5-bub"><div class="p5-l1"><div class="p5-l2"><div class="p5-text"></div></div></div></div>';
  const nm=d.querySelector('.p5-name');let nw=true;
  for(const ch of [...(m.name||'')]){if(ch===' '){const s=document.createElement('span');s.className='sp';nm.appendChild(s);nw=true;continue;}const c=document.createElement('span');c.className='ch'+(nw?' i':'');c.textContent=ch;nm.appendChild(c);nw=false;}
  fillText(d.querySelector('.p5-text'),m);d.querySelector('.tm').textContent=hhmm(m.t);
  if(m.sc){d.style.setProperty('--sc',scColor(m));d.querySelector('.p5-amt').textContent=m.sc.amount;}
  return d;}
const SVG_YT='<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>';
const SVG_TT='<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>';
const SVG_TW='<svg viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>';
const SVG_KK='<svg viewBox="0 0 24 24"><path d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z"/></svg>';
const SVG_PF={y:SVG_YT,t:SVG_TT,w:SVG_TW,k:SVG_KK};
function buildRV(m,src,pf){
  const d=document.createElement('div');d.className='msg p-'+PC[pf]+FLAGS(m)+(m.sc?' hl':'');d.dataset.platform=PN[pf];
  d.innerHTML='<div class="badge">'+SVG_PF[pf]+'</div><div class="body"><div class="name"><span class="n"></span></div><div class="text"></div></div>';
  d.querySelector('.n').textContent=m.name;fillText(d.querySelector('.text'),m);
  const nm=d.querySelector('.name'),tag=t=>{const s=document.createElement('span');s.className='tag';s.textContent=t;nm.appendChild(s);};
  if(m.sc)tag(m.sc.amount);if(m.owner)tag('OWNER');else if(m.mod)tag('MOD');if(m.bot)tag('BOT');if(m.vip&&cur(view)[VIPK[m.p]||'x']!==false)tag('VIP');if(memOn(m,cur(view)))tag('MEMBER');
  if(m.sc)d.style.setProperty('--sc',scColor(m));
  return d;}
const cozyN=()=>{const css=(tplOf(forceId||cur(view).preset)||{}).css||'';const n=[...css.matchAll(/data-color\s*=\s*["']?(\d+)/g)].map(x=>+x[1]);return Math.max(5,...n);};
// foto cadangan = huruf inisial tanpa latar; warna latarnya ditentukan CSS gaya (mis. .avatar img{background:...})
const avFallback=name=>{const ch=([...String(name||'?')][0]||'?').toUpperCase().replace(/[<>&"']/g,'?');
  return 'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="32" y="43" font-size="30" font-family="Segoe UI,Arial,sans-serif" font-weight="700" text-anchor="middle" fill="#fff">'+ch+'</text></svg>');};
function buildCozy(m,src,pf){
  const d=document.createElement('div');d.className='msg'+FLAGS(m);d.dataset.platform=PN[pf];
  let h=0;for(const ch of String(m.name||''))h=(h*31+ch.charCodeAt(0))>>>0;const col=h%cozyN()+1;d.dataset.color=String(col);
  d.dataset.type=m.sc?'event':'chat';d.dataset.role=m.owner?'streamer':m.mod?'mod':m.vip?'vip':m.bot?'bot':'';
  d.innerHTML='<div class="avatar"><img alt=""></div><div class="body"><div class="row"><span class="name"></span></div><span class="text"></span></div>';
  const row=d.querySelector('.row'),tag=(t,k)=>{const s=document.createElement('span');s.className='tag';s.dataset.tag=k;s.textContent=t;row.appendChild(s);};
  d.querySelector('.name').textContent=m.name||'';fillText(d.querySelector('.text'),m);
  if(m.sc){tag(m.sc.amount,'superchat');d.style.setProperty('--sc',scColor(m));}if(m.owner)tag('streamer','streamer');else if(m.mod)tag('mod','mod');if(m.bot)tag('bot','bot');if(m.vip&&cur(view)[VIPK[m.p]||'x']!==false)tag('vip','vip');if(memOn(m,cur(view)))tag('member','member');
  const img=d.querySelector('.avatar img'),fb=avFallback(m.name);img.referrerPolicy='no-referrer';img.onerror=()=>{img.onerror=null;img.src=fb;};img.src=m.avatar||fb;
  return d;}
function rebuild(){[...wrap.children].forEach(x=>x.remove());const s=cur(view);msgsData.slice(-s.max).forEach(m=>add(m,true));}
const ICON={join:'\u{1F44B}',gift:'\u{1F381}',like:'\u2764\uFE0F',follow:'\u2795',share:'\u2197\uFE0F',sub:'\u2B50',raid:'\u{1F680}',announce:'\u{1F4E2}',first:'\u{1F44B}',reward:'\u{1F3C6}'};
const cap=k=>k[0].toUpperCase()+k.slice(1);
const PLAN={Prime:'Prime','1000':'Tier 1','2000':'Tier 2','3000':'Tier 3'},planTx=p=>PLAN[p]?' ('+PLAN[p]+')':'';
// teks baris aktivitas: [nama tebal, keterangan]
function actText(m){const n=m.name||'?',q=m.text?': \u201c'+m.text+'\u201d':'';
  if(m.p==='twitch'){
    if(m.kind==='sub')return[n,(m.months>1?' resub'+planTx(m.plan)+' \u00b7 '+m.months+' bulan':' berlangganan'+planTx(m.plan))+q];
    if(m.kind==='gift')return[n,m.n>1?' membagikan '+fmt(m.n)+' gift sub'+planTx(m.plan):' memberi gift sub ke '+(m.to||'seseorang')+planTx(m.plan)];
    if(m.kind==='raid')return[n,' me-raid dengan '+fmt(m.n||0)+' penonton'];
    if(m.kind==='announce')return[n,': '+(m.text||'')];
    if(m.kind==='first')return[n,' chat untuk pertama kalinya'];
  }
  if(m.p==='kick'){
    if(m.kind==='sub')return[n,m.months>1?' berlangganan \u00b7 '+m.months+' bulan':' berlangganan'];
    if(m.kind==='gift')return[n,' membagikan '+fmt(m.n||1)+' gift sub'];
    if(m.kind==='follow')return[n,' mulai mengikuti'];
    if(m.kind==='raid')return[n,m.n?' me-raid dengan '+fmt(m.n)+' penonton':' me-raid channel ini'];
    if(m.kind==='reward')return[n,' menukar \u201c'+(m.title||'hadiah')+'\u201d'+q];
  }
  if(m.kind==='gift')return[n,' mengirim '+(m.gift||'hadiah')+(m.n>1?' \u00d7'+m.n:'')+(m.coins?' ('+fmt(m.coins)+' koin)':'')];
  if(m.kind==='like')return[m.others?n+' +'+m.others+' lainnya':n,' menyukai live \u00d7'+fmt(m.n||1)];
  return[n,{join:' bergabung',follow:' mulai mengikuti',share:' membagikan live',sub:' berlangganan'}[m.kind]||''];}
// baris aktivitas (bergabung, hadiah, raid, dst.): latar dan warna font datang dari pengaturan platformnya
function actEl(m,s){
  const A=ACT[m.p]||ACT.tiktok,k=cap(m.kind),pre=A.pre,d=document.createElement('div'),[who,what]=actText(m);
  d.className='cs-act cs-'+PC[PK[m.p]||'t']+' cs-'+m.kind+(m.sample?' sample':'');d.dataset.platform=m.p||'tiktok';
  d.style.color=s[pre+k+'Fc'];
  if(s[pre+k+'Bg'])d.style.background=hexA(s[pre+k+'BgC'],s[pre+k+'BgOp']);else d.style.textShadow='0 1px 4px #000,0 0 2px #000';
  d.innerHTML='<img class="lg" src="'+A.logo+'" alt=""><span class="ai"></span><span class="at"><b></b><span></span></span>';
  d.querySelector('.ai').textContent=ICON[m.kind]||'\u2022';d.querySelector('b').textContent=who;d.querySelector('.at>span').textContent=what;
  return d;}
// gaya Super Chat / Bits / Kicks & member (berlaku penuh di gaya Default; gaya buatan sendiri mengikuti variabel --sc)
function styleMsg(d,m,s){
  const pre=SCK[m.p]||'ytSc',mk=MEMK[m.p]||'ytMem';
  if(m.sc){
    if(s[pre+'Bg']==='none')d.classList.add('sc-nobg');
    if(s[pre+'Bg']==='custom')d.style.setProperty('--sc',s[pre+'BgC']);
    d.style.setProperty('--sco',s[pre+'BgOp']+'%');d.style.setProperty('--sco2',Math.round(s[pre+'BgOp']*.21)+'%');
    if(s[pre+'FcOn']){d.classList.add('hasfc');d.style.setProperty('--scf',s[pre+'Fc']);d.style.color=s[pre+'Fc'];}
    if(!s[pre+'Amt'])d.classList.add('noamt');}
  if(m.member&&s[mk+'NameOn']){d.classList.add('hasmc');d.style.setProperty('--mc',s[mk+'C']);}
  if(m.member&&!s[mk+'Badge'])d.classList.add('nomem1');
  if(m.vip&&VIPK[m.p]&&!s[VIPK[m.p]])d.classList.add('novip1');
  if(m.hl&&s.twHl)d.classList.add('ishl');}
// alert hadiah TikTok: muncul beberapa detik di jendela kecil terpisah di LUAR jendela chat (kiri; pindah ke kanan kalau kiri mepet ujung layar).
// Halaman dock hanya meneruskan datanya (POST /galert -> main.js); yang menggambar adalah halaman ?view=galert (giftAlert di bawah).
function galertSend(m){
  if(Date.now()-(m.t||0)>8000)return;
  post('/galert',{m:{name:m.name,gift:m.gift,n:m.n,img:m.img,t:m.t}}).catch(()=>{});}
function giftAlert(m){
  if(Date.now()-(m.t||0)>8000)return;
  const box=$('galert');if(!box)return;
  const d=document.createElement('div'),t=document.createElement('span'),b=document.createElement('b');d.className='ga';t.className='gt';
  const fb=()=>{const e=document.createElement('span');e.className='gi';e.textContent='\u{1F381}';return e;};
  let im;if(m.img){im=document.createElement('img');im.alt='';im.onerror=()=>im.replaceWith(fb());im.src=m.img;}else im=fb();
  b.textContent=m.name||'?';t.append(b,' mengirim '+(m.gift||'hadiah')+((m.n||1)>1?' \u00d7'+m.n:''));
  d.append(im,t);box.appendChild(d);while(box.children.length>3)box.firstChild.remove();
  setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),450);},6000);}
function addAct(m,re,s,stick){
  const A=ACT[m.p];if(!A||!s[A.pre+'Act']||!s[A.pre+cap(m.kind)])return;
  if(m.kind==='gift'&&(m.p==='tiktok'?(m.coins||0):(m.n||1))<(s[A.pre+'GiftMin']||0))return;
  if(!re&&view==='overlay'){msgsData.push(m);if(msgsData.length>80)msgsData.shift();}
  if(view==='dock'&&!isPrev&&m.p==='tiktok'&&m.kind==='gift')galertSend(m);
  const d=actEl(m,s);put(d);trim();if(stick)toLatest();
  if(s.fade>0&&!isPrev&&!m.sample&&!re)setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),450);},s.fade*1000);}
function add(m,re){
  if(EN[m.p]===false)return;
  const s=cur(view),stick=view!=='dock'||atLatest();
  if(m.kind)return addAct(m,re,s,stick);
  if(m.sticker){if(!s.ytSticker)return;}else if(m.sc&&!s[SCK[m.p]||'ytSc'])return;
  if(!re&&view==='overlay'){msgsData.push(m);if(msgsData.length>80)msgsData.shift();}
  const pf=PK[m.p]||'t',src=PL[m.p]||'/tt.png';
  const d=view!=='overlay'?buildStd(m,src,pf):curStruct==='p5'?buildP5(m,src,pf):curStruct==='rv'?buildRV(m,src,pf):curStruct==='cozy'?buildCozy(m,src,pf):buildStd(m,src,pf);
  styleMsg(d,m,s);put(d);trim();if(stick)toLatest();
  if(s.fade>0&&!isPrev&&!m.sample&&!re)setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),450);},s.fade*(m.sc?(s[(SCK[m.p]||'ytSc')+'Hold']||3):1)*1000);
}
// ---- contoh pesan untuk pratinjau ----
// Dock: sekali muncul beberapa contoh (saat pengaturan pribadi diubah dan belum ada chat).
const SAMP=[['tiktok','dewi.anggraini','kak main game apa hari ini?'],['youtube','Budi Santoso','mantap bang, gas terus!'],['youtube','Nightbot','Jangan lupa subscribe dan follow ya!',{bot:true}],['youtube','Andi Pratama','selamat datang semuanya',{mod:true}],['tiktok','rizkyy_','seru banget live-nya!!'],['youtube','Sinta_Rahma','Terima kasih banyak kak, semangat terus!',{sc:{amount:'Rp50.000',color:'#ffca28'}}]];
// Pratinjau overlay: pesan acak TERUS-MENERUS dari keempat platform, supaya semua fitur (badge, aktivitas, Super Chat / Bits / Kicks,
// emote, nama dan teks panjang) tampil bergantian dan terlihat mana yang kurang cocok dengan gaya yang dipilih.
const rnd=a=>a[Math.floor(Math.random()*a.length)],rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const FN=['dewi.anggraini','Budi Santoso','Andi Pratama','rizkyy_','Sinta_Rahma','Joko','Putri Ayu','gamer_jaya','Rina_K','Dimas','Wulan','Bayu_88','kak Nanda','Tono','Lia','Fajar','Citra Lestari','xX_NaufalPro_Xx','Dian','Agus','Maya','Eko','Nadia','Hendra','Salsa','Reza','Bagas','Ayu_Lestari'];
const FLONGN=['Muhammad Abdurrahman Al-Fatih Hidayatullah','SuperDuperLongUsername_123456','\u0414\u043c\u0438\u0442\u0440\u0438\u0439','\u7530\u4e2d\u3055\u3093','Kiki\u{1F60E}'];
const FT=['kak main game apa hari ini?','mantap bang, gas terus!','seru banget live-nya!!','halo dari Bekasi \u{1F44B}','lanjut kak, jangan berhenti','wkwkwk lucu banget','nonton dari tadi gak kerasa udah 2 jam','minta lagu dong kak','GG!','pertama kali nonton, langsung suka','bisa tolong ulangi yang tadi?','semangat terus ya kak, sehat selalu','ini map apa namanya?','audionya agak kecil kak','keren!!','sapa aku dong kak'];
const FLONGT=['Kak, aku mau tanya soal setup streaming kamu, pakai kamera apa dan mic apa ya? Soalnya kualitasnya bagus banget dan aku lagi mau mulai live juga minggu depan','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','https://contoh.com/halaman/yang/sangat/panjang/sekali/dan/tidak/ada/spasinya/sama/sekali'];
const TWEMO=[['Kappa',25],['LUL',425618],['Kreygasm',41],['4Head',354],['BibleThump',86]];
const emoTx=()=>{const [w,id]=rnd(TWEMO),pre=rnd(['gas ','hahaha ','mantap ','']);return{text:pre+w,emo:[[Array.from(pre).length,Array.from(pre).length+w.length,'https://static-cdn.jtvnw.net/emoticons/v2/'+id+'/default/dark/2.0']]};};
const bitCol=n=>n>=10000?'#f43021':n>=5000?'#0099fe':n>=1000?'#1db2a5':n>=100?'#9c3ee8':'#979797';
const YTSC=[['Rp5.000','#1e88e5'],['Rp20.000','#00bfa5'],['Rp50.000','#ffca28'],['Rp100.000','#ff7043'],['Rp500.000','#e91e63'],['Rp1.000.000','#e62117']];
const fNm=()=>rnd(FN),fTx=()=>rnd(FT),fY=x=>({p:'youtube',name:fNm(),text:fTx(),...(x||{})}),fT=x=>({p:'tiktok',name:fNm(),text:fTx(),...(x||{})}),fW=x=>({p:'twitch',name:fNm(),text:fTx(),...(x||{})}),fK=x=>({p:'kick',name:fNm(),text:fTx(),...(x||{})});
const fAct=(p,kind,x)=>({p,kind,name:fNm(),...(x||{})});
const fBits=n=>({sc:{amount:fmt(n)+' bits',color:bitCol(n),bits:n}});
const SCEN=[
  ()=>fY(),()=>fY(),()=>fY({mod:true}),()=>fY({owner:true,name:'Si Streamer',text:'makasih semuanya yang udah mampir!'}),()=>fY({bot:true,name:'Nightbot',text:'Jangan lupa subscribe dan follow ya!'}),()=>fY({member:true}),
  ()=>{const [a,c]=rnd(YTSC);return fY({sc:{amount:a,color:c},text:'Terima kasih banyak kak, semangat terus!'});},()=>fY({sc:{amount:'Rp1.000.000',color:'#e62117'},text:'Sukses terus kontennya, ini buat jajan kopi \u2615'}),()=>fY({sticker:true,sc:{amount:'Rp20.000',color:'#00bfa5'},text:'[Super Sticker]'}),
  ()=>fT(),()=>fT(),()=>fT({mod:true}),()=>fAct('tiktok','join'),()=>fAct('tiktok','gift',{gift:rnd(['Rose','Heart Me','GG','Finger Heart']),n:rint(1,10),coins:rint(1,99)}),()=>fAct('tiktok','gift',{gift:'Lion',n:1,coins:29999}),
  ()=>fAct('tiktok','like',{others:rint(0,6),n:rint(10,200)}),()=>fAct('tiktok','follow'),()=>fAct('tiktok','share'),()=>fAct('tiktok','sub'),
  ()=>fW(),()=>fW(emoTx()),()=>fW(emoTx()),()=>fW({owner:true,name:'Si Streamer',text:'ayo kita mulai ronde berikutnya'}),()=>fW({mod:true}),()=>fW({vip:true}),()=>fW({member:true}),
  ()=>fW({...fBits(100),text:'mantap kontennya'}),()=>fW({...fBits(rnd([500,1000,5000,10000])),text:'ini buat kamu kak'}),()=>fW({hl:true,text:'Pesan sorotan dari poin channel!'}),()=>fW({me:true,text:'lagi ngopi sambil nonton'}),
  ()=>({...fAct('twitch','first'),name:fNm()}),()=>fAct('twitch','sub',{plan:rnd(['Prime','1000','2000','3000']),months:1}),()=>fAct('twitch','sub',{plan:'1000',months:rint(2,36),text:'udah lama banget di sini, makasih kak!'}),
  ()=>fAct('twitch','gift',{plan:'1000',n:1,to:fNm()}),()=>fAct('twitch','gift',{plan:'1000',n:rnd([5,10,20,50])}),()=>fAct('twitch','raid',{n:rint(8,900)}),()=>fAct('twitch','announce',{text:'Giveaway dimulai jam 8 malam, jangan lupa ikut!'}),
  ()=>fK(),()=>fK(),()=>fK({mod:true}),()=>fK({owner:true,name:'Si Streamer',text:'halo Kick, makasih udah nongol!'}),()=>fK({vip:true}),()=>fK({member:true}),
  ()=>fK({sc:{amount:fmt(rnd([50,100,500,1000]))+' Kicks',color:'#53fc18',kicks:100},text:'gas terus bang!'}),()=>fAct('kick','sub',{months:rint(1,12)}),()=>fAct('kick','gift',{n:rint(1,25)}),()=>fAct('kick','follow'),()=>fAct('kick','raid',{n:rint(5,400)}),()=>fAct('kick','reward',{title:rnd(['Pilih lagu','Minum air','Salam untuk teman']),text:rnd(['Dewa 19 - Pupus','','buat Sinta ya'])||undefined}),
  ()=>fY({name:rnd(FLONGN),text:rnd(FLONGT)}),()=>fW({name:rnd(FLONGN),text:rnd(FLONGT)}),()=>fK({text:FLONGT[1]}),()=>fT({name:rnd(FLONGN),text:rnd(FLONGT)}),()=>fW({text:'\u{1F602}\u{1F602}\u{1F602}\u{1F525}\u{1F525}'}),()=>fY({name:'\u7530\u4e2d\u3055\u3093',text:'\u3053\u3093\u306b\u3061\u306f\uff01'})];
// "dek acak": tiap putaran semua skenario keluar tepat sekali dalam urutan acak, jadi tidak ada fitur yang terlewat
const SHOW=[6,5,13,26,35,31,43,48,24,46];
let deck=[];
const nextScen=()=>{if(!deck.length){deck=SCEN.map((_,i)=>i);for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}}return SCEN[deck.pop()]();};
let feedT=null,feedOn=true; // feedOn=false: pratinjau dikosongkan karena chat contoh sedang dikirim ke Dock / Overlay
const feedStop=()=>{clearTimeout(feedT);feedT=null;};
const pickScen=()=>{for(let i=0;i<60;i++){const m=nextScen();if(EN[m.p]!==false)return m;}return null;};
const feedOne=()=>{if(draftEmpty()||!feedOn)return;const m=pickScen();if(m)add({...m,t:Date.now(),sample:true});};
function feedLoop(){feedStop();const [a,b]=isStatic?[2200,3600]:[800,1500];const go=()=>{feedOne();feedT=setTimeout(go,rint(a,b));};feedT=setTimeout(go,rint(a,b));}
// jendela "Gaya baru": CSS masih kosong = pratinjau dibiarkan kosong (tidak menampilkan tampilan bawaan aplikasi)
const draftEmpty=()=>forceId==='__draft'&&!(draftTpl&&String(draftTpl.css||'').trim());
function samples(clear){if(clear){wrap.innerHTML='';msgsData=[];applyStyle();}feedStop();if(draftEmpty()||!feedOn)return;
  if(view==='overlay'&&isPrev){
    // beberapa contoh langsung (satu dari tiap jenis utama) supaya pratinjau tidak kosong, lalu dilanjutkan pesan acak terus-menerus
    SHOW.slice().sort(()=>Math.random()-.5).slice(0,isStatic?4:7).forEach((i,k)=>setTimeout(()=>{if(!draftEmpty())add({...SCEN[i](),t:Date.now(),sample:true});},k*(isStatic?450:380)));
    if(!isStatic||forceId)setTimeout(feedLoop,(isStatic?4:7)*(isStatic?450:380)+300);return;}
  SAMP.forEach((x,i)=>setTimeout(()=>{if(!draftEmpty())add({p:x[0],name:x[1],text:x[2],t:Date.now(),sample:true,...(x[3]||{})});},i*450));}
let tmS=null;function resample(){clearTimeout(tmS);tmS=setTimeout(()=>samples(true),250);}
const live=!isAdmin&&(view==='dock'||isPrev)&&!isStatic;
function doCmd(n){
  if(n==='up')list.scrollBy({top:-list.clientHeight*.8,behavior:'smooth'});
  else if(n==='down')list.scrollBy({top:list.clientHeight*.8,behavior:'smooth'});
  else if(n==='clear'){[...wrap.children].forEach(x=>x.remove());msgsData=[];updBtn();}
  else if(n==='filter'){const o=['all',...PF4.filter(p=>EN[p])];filt=o[(o.indexOf(filt)+1)%o.length];$('flt').value=filt;try{localStorage.setItem('flt',filt)}catch{};applyStyle();toLatest();}
}
// ---- pratinjau statis (dalam iframe): tanpa koneksi SSE, data dikirim induknya ----
if(isStatic){
  applyStyle();
  addEventListener('message',e=>{const d=e.data||{};
    if(d.type==='cfg'){S=copy(d.settings);S.global=S.global||{};setEN(d.enabled);if(d.feed!=null)feedOn=!!d.feed;applyStyle();resample();}
    else if(d.type==='one'){if(!draftEmpty()){const m=pickScen();if(m)add({...m,t:Date.now(),sample:true});}}
    else if(d.type==='add'&&d.m&&typeof d.m==='object'){if(!draftEmpty())add({...d.m,t:Date.now(),sample:true});}
    else if(d.type==='tpldraft'){draftTpl={css:d.css};applyStyle();resample();}});
  setTimeout(()=>{if(!wrap.children.length&&!feedT)resample();},1500);
  parent.postMessage({type:'ready'},'*');bootDone();
}else if(isDB||isGA){
  bootDone(); // bilah judul Donate Dock / jendela alert hadiah: halaman statis, tanpa SSE
}else if(!isCtl&&!isRep){
  if(isPrev)applyStyle();
  const es=new EventSource('/events');
  es.onmessage=e=>{const {type,data}=JSON.parse(e.data);
    if(type==='init'){S=data.settings;S.global=S.global||{};saved=copy(S);conf=data.cfg;setEN(conf.enabled);viewers=data.viewers||{};showSt(data.status);
      if(isSet){initSettings();bootDone();return;}if(isTpl){initTpl();bootDone();return;}if(isAdd){initAdd();bootDone();return;}
      fltBuild();applyStyle();showViewers();
      if(isPrev){samples(true);bootDone();return;}
      const s=cur(view),lim=Date.now()-(s.fade>0?s.fade*1000:1e12);
      data.history.filter(m=>m.t>lim).slice(view==='overlay'?-s.max:-300).forEach(m=>add(m));if(view==='dock')toLatest();bootDone();}
    else if(type==='settings'){saved=copy(data);S=copy(data);S.global=S.global||{};
      if(isSet){refreshPresets();if(isDash){pvSend();dashDocks();}}else if(isTpl)tplOnSettings();else if(isAdd){applyUi(cur('dock'));}else{applyStyle();if(isPrev)resample();}}
    else if(type==='draft'){if(live&&data.view===view){S[view]=data.values;applyStyle();if(isPrev)resample();else if(isPrev&&!document.querySelector('.m'))samples(false);}
      else if((isTpl||isAdd)&&data.view==='dock')applyUi({...cur('dock'),...data.values});}
    else if(type==='draftclear'){if(live){S=copy(saved);document.querySelectorAll('.sample').forEach(x=>x.remove());applyStyle();if(isPrev)resample();}else if(isTpl||isAdd)applyUi(cur('dock'));}
    else if(type==='cmd'){if(!isAdmin&&!isPrev){if(view==='dock')doCmd(data.name);else if(data.name==='clear')doCmd('clear');}}
    else if(type==='status')showSt(data);
    else if(type==='cfg'){conf.enabled=data.enabled;setEN(data.enabled);applyEnabled();}
    else if(type==='sampleclear'){if(!isAdmin&&!isPrev&&!isStatic){document.querySelectorAll('.sample').forEach(x=>x.remove());msgsData=msgsData.filter(m=>!m.sample);updBtn();}}
    else if(type==='viewers'){if(!isAdmin){viewers=data;showViewers();}else if(isDash){viewers=data;dashRender();}}
    else if(type==='msg'){if(!isAdmin&&!isPrev&&(!data.target||data.target===view))add(data);}};
}
// ---- jendela terkunci: laporkan area gelembung chat supaya hanya itu yang menerima klik saat disembunyikan dari OBS ----
if(isLocked&&!isAdmin){
  // Hanya kotak yang benar-benar terlihat (tiap gelembung chat, dan tiap kotak YouTube / TikTok / Total) yang menerima klik.
  // Ruang kosong di antara kotak tidak masuk daftar, jadi klik menembus ke jendela di belakangnya.
  let st=null,lastSg='';const send=()=>{const rs=[];[['#msgs>*',8],['#top>*',1]].forEach(([sel,pad])=>document.querySelectorAll(sel).forEach(e=>{const r=e.getBoundingClientRect();if(r.width>0&&r.height>0)rs.push({x:r.left-pad,y:r.top-pad,width:r.width+pad*2,height:r.height+pad*2});}));const sg=JSON.stringify(rs);if(sg===lastSg)return;lastSg=sg;post('/shape',{rects:rs});};
  const q=()=>{if(st)return;st=setTimeout(()=>{st=null;send();},120);};
  [$('msgs'),$('top')].forEach(n=>new MutationObserver(q).observe(n,{childList:true,subtree:true,characterData:true}));
  addEventListener('resize',q);addEventListener('animationend',q);setInterval(send,4000);setTimeout(send,300);
}
// ---- jendela alert hadiah TikTok: jendela kecil di LUAR jendela chat; main.js mengisinya lewat window.__ga dan membaca area kotaknya lewat window.__garects ----
if(isGA){
  window.__ga=giftAlert;
  window.__gaside=s=>{document.body.dataset.side=s;};
  window.__garects=()=>[...document.querySelectorAll('#galert>.ga')].map(e=>{const r=e.getBoundingClientRect();return{x:Math.max(0,Math.floor(r.left)-1),y:Math.max(0,Math.floor(r.top)-1),width:Math.ceil(r.width)+2,height:Math.ceil(r.height)+2};}).filter(r=>r.width>2&&r.height>2);
}
// ---- kotak tombol (mata, gembok, pindah, tutup): jendela kecil tanpa bingkai di LUAR jendela chat / Donate Dock ----
if(isCtl){
  bootDone();
  const T=Q.get('t')||'chat',isChat=T==='chat',mv=$('mover'),idb=isChat?{}:{id:T};let lk=false;
  mv.addEventListener('pointerdown',e=>{try{mv.setPointerCapture(e.pointerId);}catch{}post('/drag',{on:true,...idb});});
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>mv.addEventListener(ev,()=>post('/drag',{on:false,...idb})));
  $('unlock').onclick=()=>post('/lock',{on:!lk,...idb});
  $('cclose').onclick=()=>post('/win',{which:isChat?'main':'donate:'+T,act:'close'});
  const eyeSt=async()=>{try{const r=await(await fetch('/dash-state')).json();
    document.body.classList.toggle('prot',!!r.protect);document.documentElement.classList.toggle('prot',!!r.protect);$('eye').title=r.protect?'Tersembunyi dari OBS (klik untuk menampilkan)':'Terlihat di OBS (klik untuk menyembunyikan)';
    const d=isChat?r.chat:(r.docks&&r.docks[T]);if(d)lk=!!d.locked;
    document.body.classList.toggle('islocked',lk);$('unlock').title=lk?'Buka kunci':'Kunci jendela';}catch{}};
  $('eye').onclick=async()=>{await post('/protect-toggle');eyeSt();};eyeSt();setInterval(()=>{if(!document.hidden)eyeSt();},2000);
}
// ---- pengaturan ----
const T=(k,l,o)=>['sel',k,l,o],C=(k,l)=>['chk',k,l],K=(k,l)=>['col',k,l],R=(k,l,a,b,u)=>['sl',k,l,a,b,u||''];
const FIELDS={
 dock:[['Tema aplikasi',[T('theme','Tampilan aplikasi',THEMES)]],
  ['Chat',[T('anim','Animasi chat masuk',ANI),T('order','Arah chat muncul',ORD)]],
  ['Ukuran & jarak',[R('fsName','Ukuran nama',10,48,'px'),R('fsText','Ukuran chat',10,48,'px'),R('gap','Jarak antar chat',0,48,'px'),R('max','Jumlah chat tersimpan (bisa di-scroll)',50,1000)]],
  ['Latar',[R('bg','Gelap latar jendela',0,100,'%'),C('chatBg','Beri latar di tiap chat'),K('chatBgColor','Warna latar chat'),R('chatBgOp','Transparansi latar chat',0,100,'%')]],
  ['Isi chat',[C('viewers','Tampilkan jumlah penonton'),C('time','Tampilkan jam'),C('botTag','Label BOT pada chat bot'),C('hideBots','Sembunyikan chat bot')]]],
 overlay:[['Gaya',[T('preset','Gaya overlay',PRE),T('align','Posisi chat di overlay',[['left','Kiri'],['right','Kanan']]),T('anim','Animasi chat masuk',[['auto','Otomatis (ikuti gaya)'],...ANI]),T('order','Arah chat muncul',ORD)]],
  ['Ukuran & jarak',[R('fsName','Ukuran nama',10,60,'px'),R('fsText','Ukuran chat',10,60,'px'),R('gap','Jarak antar chat',0,48,'px'),R('max','Jumlah pesan maksimal',3,30),R('fade','Pesan hilang setelah (0 = tidak hilang)',0,120,'detik')]],
  ['Latar',[R('bg','Gelap latar',0,100,'%'),C('chatBg','Beri latar di tiap chat (gaya Polos/Retro/buatanmu)'),K('chatBgColor','Warna latar chat'),R('chatBgOp','Transparansi latar chat',0,100,'%')]],
  ['Isi chat',[C('viewers','Tampilkan jumlah penonton'),C('time','Tampilkan jam'),C('avatar','Foto profil (gaya Kartu)'),C('botTag','Label BOT pada chat bot'),C('hideBots','Sembunyikan chat bot')]]]};
const BOX={dock:'pp_b',overlay:'po_b'};
// ---- DSL kecil untuk halaman pengaturan per platform: ['chk'|'col'|'sl'|'sel',...] , ['dep',kunci,nilai|null,[anak]] (tampil bila dicentang / bernilai itu), ['box',[..]], ['hint',teks], ['pv',jenis,kunci]
const ACTDSL=pre=>([k,l,ic])=>['box',[['chk',pre+k,ic+' '+l],['dep',pre+k,null,[
  ...(k==='Gift'?[pre==='tt'?['sl','ttGiftMin','Tampilkan hadiah minimal',0,500,'koin']:['sl',pre+'GiftMin','Tampilkan gift sub minimal',0,100,'sub']]:[]),
  ['chk',pre+k+'Bg','Beri latar'],['dep',pre+k+'Bg',null,[['col',pre+k+'BgC','Warna latar'],['sl',pre+k+'BgOp','Kepekatan latar',10,100,'%']]],
  ['col',pre+k+'Fc','Warna font'],['pv','act',pre+k]]]]];
// halaman "chat berbayar yang disorot": Super Chat (YouTube), Bits (Twitch), Kicks (Kick)
const SCDSL=(pre,pf,what)=>[['chk',pre,'Tampilkan '+what],['dep',pre,null,[
  ['sel',pre+'Bg','Latar sorotan',[['auto','Ikut warna '+what],['custom','Warna sendiri'],['none','Tanpa latar']]],
  ['dep',pre+'Bg','custom',[['col',pre+'BgC','Warna latar']]],
  ['dep',pre+'Bg','auto,custom',[['sl',pre+'BgOp','Kepekatan latar',10,100,'%']]],
  ['chk',pre+'FcOn','Atur warna font'],['dep',pre+'FcOn',null,[['col',pre+'Fc','Warna font']]],
  ['chk',pre+'Amt','Tampilkan nominal'],['sl',pre+'Hold','Tahan lebih lama di overlay',1,10,'\u00d7'],
  ['pv','sc',pf],['hint','Latar, warna font dan nominal berlaku penuh di gaya Default. Gaya buatan sendiri mengikuti warna sorotan lewat variabel --sc.']]]];
const MEMDSL=(pre,pf,vip,who,vipKey)=>[['chk',pre+'Badge','Label MEMBER pada chat '+who],['chk',pre+'NameOn','Warnai nama '+who],['dep',pre+'NameOn',null,[['col',pre+'C','Warna nama '+who]]],['chk',vipKey,'Label VIP pada chat VIP'],['pv','mem',pf],['hint','Warna nama berlaku di gaya Default.']];
const PLAT={
 tt:[['Aktivitas TikTok',[['chk','ttAct','Tampilkan aktivitas'],['hint','Aktivitas muncul di sela chat. Centang jenis yang mau ditampilkan; kalau terlalu menyatu dengan latar, beri latar atau ganti warna font (ada pratinjaunya).'],['dep','ttAct',null,TT_ACTS.map(ACTDSL('tt'))]]]],
 tw:[['Aktivitas Twitch',[['chk','twAct','Tampilkan aktivitas'],['hint','Subscribe, gift sub, raid, dan pengumuman moderator muncul sebagai baris di sela chat. Centang jenis yang mau ditampilkan; beri latar atau ganti warna font kalau terlalu menyatu (ada pratinjaunya).'],['dep','twAct',null,TW_ACTS.map(ACTDSL('tw'))]]],
  ['Bits',SCDSL('twBits','twitch','chat Bits')],
  ['Pesan sorotan',[['chk','twHl','Beri latar pada pesan sorotan (Highlight My Message)']]],
  ['Subscriber & VIP',MEMDSL('twMem','twitch',true,'subscriber','twVipBadge')],
  ['Belum bisa ditampilkan',[['hint','Follow baru, hype train, polling/prediksi, dan penukaran poin channel tanpa pesan tidak terbaca tanpa login Twitch, jadi belum ada pengaturannya. Jumlah penonton Twitch diambil dari data publik tiap 30 detik.']]]],
 kk:[['Aktivitas Kick',[['chk','kkAct','Tampilkan aktivitas'],['hint','Subscribe, gift sub, follow, raid/host, dan hadiah poin (reward) muncul sebagai baris di sela chat. Centang jenis yang mau ditampilkan; beri latar atau ganti warna font kalau terlalu menyatu (ada pratinjaunya).'],['dep','kkAct',null,KK_ACTS.map(ACTDSL('kk'))]]],
  ['Kicks',SCDSL('kkKicks','kick','chat Kicks')],
  ['Subscriber & VIP',MEMDSL('kkMem','kick',true,'subscriber','kkVipBadge')],
  ['Catatan',[['hint','Kick belum punya API chat resmi untuk umum, jadi cara baca chatnya tidak resmi dan bisa berhenti bekerja kapan saja. Nama event Kicks, follow, dan reward belum diuji dengan live Kick sungguhan.']]]],
 yt:[['Super Chat',SCDSL('ytSc','youtube','Super Chat')],
  ['Super Sticker',[['chk','ytSticker','Tampilkan Super Sticker'],['hint','Stiker berbayar muncul sebagai chat bertanda [Super Sticker] lengkap dengan nominalnya.']]],
  ['Member',[['chk','ytMemBadge','Label MEMBER pada chat anggota'],['chk','ytMemNameOn','Warnai nama anggota'],['dep','ytMemNameOn',null,[['col','ytMemC','Warna nama anggota']]],['pv','mem','youtube'],['hint','Warna nama anggota berlaku di gaya Default.']]],
  ['Belum bisa ditampilkan',[['hint','Jumlah like, subscriber baru, Jewels/gift, dan polling YouTube tidak ikut terbaca oleh cara pengambilan chat tanpa API key yang dipakai aplikasi ini, jadi belum ada pengaturannya.']]]]};
const dflat=l=>l.flatMap(it=>it[0]==='box'?dflat(it[1]):it[0]==='dep'?dflat(it[3]):['hint','pv'].includes(it[0])?[]:[it]);
const PKEYS={},PITEMS=[];['tt','tw','kk','yt'].forEach(p=>{PKEYS[p]=PLAT[p].flatMap(g=>dflat(g[1]));PITEMS.push(...PKEYS[p]);});
const items=v=>[...FIELDS[v].flatMap(g=>g[1]),...PITEMS];
function ctlHtml(v,it){const [ty,k,l,a,b,u]=it,id=v+'_'+k;
  if(ty==='sel'){const opts='<select id="'+id+'">'+a.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select>';
    return '<label><span>'+l+'</span></label>'+(k==='preset'?'<div class="selrow">'+opts+'<button class="btn b3 sm" id="tplMng">Kelola</button></div>':opts);}
  if(ty==='chk')return '<div class="row"><span>'+l+'</span><input type="checkbox" id="'+id+'"></div>';
  if(ty==='col')return '<div class="row"><span>'+l+'</span><input type="color" id="'+id+'" style="width:44px;height:28px;padding:0;border:0;background:none"></div>';
  return '<label><span>'+l+'</span><b id="'+v+'_v_'+k+'"></b></label><input type="range" id="'+id+'" min="'+a+'" max="'+b+'">';}
function dslHtml(v,l){return l.map(it=>{const t=it[0];
  if(t==='box')return '<div class="actbox">'+dslHtml(v,it[1])+'</div>';
  if(t==='dep')return '<div class="dep" data-dep="'+v+'_'+it[1]+'"'+(it[2]?' data-val="'+it[2]+'"':'')+'>'+dslHtml(v,it[3])+'</div>';
  if(t==='hint')return '<div class="hint">'+it[1]+'</div>';
  if(t==='pv')return '<div class="pv" data-v="'+v+'" data-pv="'+it[1]+'" data-k="'+(it[2]||'')+'"></div>';
  return ctlHtml(v,it);}).join('');}
if(isSet){for(const v in FIELDS){let h='';
  FIELDS[v].forEach(([t,its])=>{h+='<div class="card"><h3>'+t+'</h3>'+its.map(it=>ctlHtml(v,it)).join('')+'</div>';});
  $(BOX[v]).innerHTML=h;
  ['yt','tt','tw','kk'].forEach(p=>{$('pgb_'+v+'_'+p).innerHTML=PLAT[p].map(([t,its])=>'<div class="card"><h3>'+t+'</h3>'+dslHtml(v,its)+'</div>').join('');});}}
// bagian yang tampil hanya kalau kotak pengaturannya dicentang / bernilai tertentu
function syncDeps(v){document.querySelectorAll('[data-dep^="'+v+'_"]').forEach(d=>{const e=$(d.dataset.dep);if(!e)return;const val=e.type==='checkbox'?e.checked:e.value;
  d.style.display=d.dataset.val?(d.dataset.val.split(',').includes(val)?'':'none'):(val?'':'none');});}
// pratinjau hidup di halaman pengaturan platform
function pvAll(v){const s=collect(v);document.querySelectorAll('.pv[data-v="'+v+'"]').forEach(box=>{box.innerHTML='';const t=box.dataset.pv,k=box.dataset.k;
  if(t==='act'){const pf=({tt:'tiktok',tw:'twitch',kk:'kick'})[k.slice(0,2)],kind=k.slice(2).toLowerCase();
    box.appendChild(actEl({p:pf,kind,name:'Budi',gift:'Rose',n:5,coins:5,others:3,plan:'1000',months:3,to:'Sari',title:'Pilih lagu',text:'Terima kasih kak!'},s));}
  else{const p=k||'youtube',sc=t==='sc',m={p,name:sc?'Sinta_Rahma':'Andi_Member',text:sc?'Terima kasih kak, semangat terus!':'halo kak, salam dari subscriber',t:Date.now()};
    if(sc)m.sc=({youtube:{amount:'Rp50.000',color:'#ffca28'},twitch:{amount:'500 bits',color:'#9c3ee8',bits:500},kick:{amount:'100 Kicks',color:'#53fc18',kicks:100}})[p];else m.member=true;
    const d=buildStd(m,PL[p],PK[p]);d.classList.add('ismem');styleMsg(d,m,s);if(sc)d.classList.remove('ismem');box.appendChild(d);}});}
function lbl(v,it){const e=$(v+'_'+it[1]),el=$(v+'_v_'+it[1]);if(!e)return;if(el)el.textContent=e.value+(it[5]?' '+it[5]:'');e.style.setProperty('--pct',((e.value-e.min)/(e.max-e.min)*100)+'%');}
function refreshPresets(){const sel=$('overlay_preset');if(!sel)return;const keep=sel.value;
  const all=[...PRE,...customs().map(t=>[t.id,t.name])];
  sel.innerHTML=all.map(x=>'<option value="'+x[0]+'">'+x[1].replace(/</g,'&lt;')+'</option>').join('');
  sel.value=all.some(x=>x[0]===keep)?keep:(all.some(x=>x[0]===cur('overlay').preset)?cur('overlay').preset:'polos');}
function fill(v,src){const s=src||cur(v);if(v==='overlay')refreshPresets();
  items(v).forEach(it=>{const e=$(v+'_'+it[1]);if(!e)return;if(it[0]==='chk')e.checked=!!s[it[1]];else e.value=s[it[1]];if(it[0]==='sl')lbl(v,it);});syncDeps(v);pvAll(v);}
function fillGlobal(){const g=S.global||{};$('sendOn').checked=g.sendOn!==false;$('autoOpen').checked=g.autoOpen!==false;$('protect').checked=g.protect!==false;$('ctrlPos').value=g.ctrlPos||'top-right';$('obsW').value=g.obsW||500;$('obsH').value=g.obsH||900;$('obsPass').value=g.obsPass||'';$('botNames').value=g.botNames||'';}
function collect(v){const o={};items(v).forEach(it=>{const e=$(v+'_'+it[1]);if(!e)return;o[it[1]]=it[0]==='chk'?e.checked:(it[0]==='sl'?+e.value:e.value);});return o;}
let dt=null;
function draftChange(v){items(v).filter(i=>i[0]==='sl').forEach(i=>lbl(v,i));syncDeps(v);pvAll(v);if(v==='dock')applyUi(collect('dock'));if(isDash)pvSend();clearTimeout(dt);dt=setTimeout(()=>post('/draft',{view:v,values:collect(v)}),40);}
if(isSet)$('panes').addEventListener('input',e=>{const id=(e.target&&e.target.id)||'',v=id.startsWith('dock_')?'dock':id.startsWith('overlay_')?'overlay':null;if(v)draftChange(v);});
function showPane(id,tab){curTab=tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.dataset.t===tab));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id===id));const pn=$('panes');if(pn)pn.scrollTop=0;if(isDash)dashPane(tab);}
function setTab(t){showPane('p'+t,t);}
document.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{const [v,p]=b.dataset.pg.split('_');showPane('pg'+v+'_'+p,v==='dock'?'p':'o');pvAll(v);});
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>setTab(b.dataset.back));
document.querySelectorAll('[data-resetp]').forEach(b=>b.onclick=()=>{const [v,p]=b.dataset.resetp.split(':');PKEYS[p].forEach(it=>{const e=$(v+'_'+it[1]);if(!e)return;if(it[0]==='chk')e.checked=!!DEF[v][it[1]];else e.value=DEF[v][it[1]];if(it[0]==='sl')lbl(v,it);});draftChange(v);});
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>setTab(t.dataset.t));
document.querySelectorAll('[data-apply]').forEach(b=>b.onclick=async()=>{const v=b.dataset.apply;await post('/settings',{view:v,values:collect(v)});
  if(v==='dock')await post('/settings',{view:'global',values:{protect:$('protect').checked,ctrlPos:$('ctrlPos').value}});
  else await post('/settings',{view:'global',values:{obsW:+$('obsW').value||500,obsH:+$('obsH').value||900,obsPass:$('obsPass').value}});});
document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{const v=b.dataset.reset;fill(v,DEF[v]);if(v==='dock'){$('protect').checked=true;$('ctrlPos').value='top-right';}draftChange(v);});
// akun
async function acct(){if(document.hidden)return;try{const a=await(await fetch('/account')).json();accState=a;
  [['ay',a.youtube],['at',a.tiktok],['aw',a.twitch],['ak',a.kick]].forEach(([i,ok])=>{$(i).textContent=ok?'terhubung':'belum terhubung';$(i).className=ok?'ok':'no';});}catch{}}
const copyText=async t=>{try{await navigator.clipboard.writeText(t);}catch{try{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}catch{}}};
// hotkey
const HK_DEF={lock:'Ctrl+Alt+L',hide:'Ctrl+Alt+H',obs:'Ctrl+Alt+O',up:'Ctrl+Alt+PageUp',down:'Ctrl+Alt+PageDown',clear:'Ctrl+Alt+C',filter:'Ctrl+Alt+F',settings:'Ctrl+Alt+S',report:'Ctrl+Alt+R',donate:'Ctrl+Alt+D'};
const HK_LBL={lock:'Kunci / buka kunci jendela',hide:'Sembunyikan / tampilkan jendela',obs:'Sembunyikan dari OBS (on/off)',up:'Gulir chat ke atas',down:'Gulir chat ke bawah',clear:'Bersihkan chat',filter:'Ganti filter (Semua / YouTube / TikTok / Twitch / Kick)',settings:'Buka pengaturan',report:'Buka laporan penonton',donate:'Buka / tutup Donate Dock'};
let hk={},hkErr={};
const KEYMAP={ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',PageUp:'PageUp',PageDown:'PageDown',Home:'Home',End:'End',Space:'Space',Insert:'Insert',Delete:'Delete',Backquote:'`',Minus:'-',Equal:'=',Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Tab:'Tab',Enter:'Return',NumpadAdd:'numadd',NumpadSubtract:'numsub',NumpadMultiply:'nummult',NumpadDivide:'numdiv',NumpadDecimal:'numdec'};
function combo(e){
  if(['Control','Alt','Shift','Meta'].includes(e.key))return null;
  let k=null,m;if(m=e.code.match(/^Key([A-Z])$/))k=m[1];else if(m=e.code.match(/^Digit(\d)$/))k=m[1];else if(m=e.code.match(/^Numpad(\d)$/))k='num'+m[1];else if(/^F\d{1,2}$/.test(e.code))k=e.code;else if(KEYMAP[e.code])k=KEYMAP[e.code];
  if(!k)return null;const p=[];if(e.ctrlKey)p.push('Ctrl');if(e.altKey)p.push('Alt');if(e.shiftKey)p.push('Shift');if(e.metaKey)p.push('Super');
  return{p,k};}
const NUMN={numadd:'+',numsub:'-',nummult:'*',numdiv:'/',numdec:'.'};
const showHk=s=>s?s.split('+').filter(Boolean).map(x=>/^num\d$/.test(x)?'Num '+x[3]:(NUMN[x]?'Num '+NUMN[x]:x)).join(' + '):'(kosong)';
function hkRender(){const box=$('hkl');box.innerHTML='';
  Object.keys(HK_LBL).forEach(a=>{const r=document.createElement('div');r.className='hk';
    r.innerHTML='<span class="hkl"></span><input type="text" readonly>'+(hkErr[a]?'<div class="hks"></div>':'');
    r.querySelector('.hkl').textContent=HK_LBL[a];const inp=r.querySelector('input');inp.value=showHk(hk[a]);
    if(hkErr[a])r.querySelector('.hks').textContent=hkErr[a];
    inp.onfocus=()=>{inp.classList.add('cap');inp.value='Tekan tombol…';};
    inp.onblur=()=>{inp.classList.remove('cap');inp.value=showHk(hk[a]);};
    inp.onkeydown=e=>{e.preventDefault();if(e.key==='Escape'){inp.blur();return;}
      if(e.key==='Backspace'&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){hk[a]='';hkErr[a]='';inp.blur();hkRender();return;}
      const c=combo(e);if(!c)return;
      const str=[...c.p,c.k].join('+');const dup=Object.keys(hk).find(x=>x!==a&&hk[x]===str);
      hk[a]=str;hkErr[a]=dup?'Sama dengan "'+HK_LBL[dup]+'", pilih tombol lain':'';inp.blur();hkRender();};
    box.appendChild(r);});}
const openC=async(w,id)=>{const r=await(await post('/open',{what:w,id})).json();if(r.error)alert(r.error);};
if(isSet){
$('hkdef').onclick=()=>{hk={...HK_DEF};hkErr={};hkRender();};
$('hkapply').onclick=async()=>{const dups=Object.keys(hk).filter(a=>hk[a]&&Object.keys(hk).some(x=>x!==a&&hk[x]===hk[a]));
  if(dups.length){dups.forEach(a=>hkErr[a]='Kombinasi ini dipakai lebih dari satu aksi');hkRender();return;}
  const r=await(await post('/hotkeys',{hotkeys:hk})).json();hkErr={};Object.keys(r).forEach(a=>{if(r[a]===false)hkErr[a]='Tidak bisa dipakai (sudah dipakai program lain)';});hkRender();};
$('conn').onclick=()=>post('/connect',{youtube:$('yt').value,tiktok:$('tk').value,twitch:$('twu').value,kick:$('kku').value,kickRoom:$('kkroom').value});
$('disc').onclick=()=>post('/disconnect');
// tulisan Cek Update di sidebar (hanya Dashboard): cek update; kalau ada, main.js menampilkan pilihan Ignore / Remind Me Later / Update Now
if(isDash){const ub=$('sbupd'),t0=ub.textContent;let ut=null;
  const setU=(t,keep)=>{clearTimeout(ut);ub.textContent=t;if(!keep)ut=setTimeout(()=>{ub.textContent=t0;},3000);};
  window.updProgress=p=>{ub.disabled=true;setU('Mengunduh '+p+'%',true);};window.updInstall=()=>{setU('Memasang…',true);};
  ub.onclick=async()=>{if(ub.disabled)return;ub.disabled=true;setU('Mengecek…',true);
    let st='error';try{st=(await(await post('/update-check')).json()).status||'error';}catch{}
    ub.disabled=false;if(st==='installing')return;
    setU({none:'Sudah terbaru',error:'Gagal cek',dev:'Mode pengembang',busy:'Sedang mengecek'}[st]||t0);};
}
$('sbot').onclick=()=>post('/settings',{view:'global',values:{botNames:$('botNames').value}});
$('tplMng').onclick=()=>openC('templates');
$('oe').onclick=()=>openC('ext');
$('cx').onclick=()=>{copyText('chrome://extensions');$('cx').textContent='Disalin';setTimeout(()=>$('cx').textContent='Salin alamat chrome://extensions',1500);};
PF4.forEach(p=>{$('op_'+p).onclick=()=>openC(p);
  const b=$('cp_'+p),t0=b.textContent;
  b.onclick=async()=>{const u=(await(await fetch('/urls')).json())[p];if(!u)return alert('Isi username '+PNAME[p]+' dulu di bagian Sambungkan live.');copyText(u);b.textContent='Disalin';setTimeout(()=>b.textContent=t0,1500);};});
// switch platform: nyala = tersambung + muncul di pengaturan/pratinjau/header/kirim chat; mati = putus dan disembunyikan
const UINP={youtube:'yt',tiktok:'tk',twitch:'twu',kick:'kku'};
PF4.forEach(p=>{const sw=$('en_'+p);sw.onchange=async()=>{const on=sw.checked;sw.disabled=true;EN[p]=on;syncPlats();
  try{const r=await(await post('/platform',{platform:p,on,user:$(UINP[p]).value})).json();if(r&&r.enabled)setEN(r.enabled);}catch{}
  sw.disabled=false;syncPlats();applyEnabled();};});
function showPort(){const p=$('portIn');if(!p)return;if(document.activeElement!==p)p.value=conf.wanted||conf.port||'';const m=$('portmsg');
  if(conf.port&&conf.wanted&&conf.port!==conf.wanted){m.className='hint no';m.textContent='Port '+conf.wanted+' sedang dipakai program lain, jadi aplikasi sementara memakai '+conf.port+'.';}
  else{m.className='hint';m.textContent='Sedang berjalan di port '+(conf.port||location.port)+'.';}}
$('portsave').onclick=async()=>{const m=$('portmsg');const r=await(await post('/port-set',{port:$('portIn').value})).json();
  if(r.error){m.className='hint no';m.textContent=r.error;return;}
  conf.wanted=+$('portIn').value;
  if(r.restart){m.className='hint ok';m.textContent='Tersimpan. Mulai ulang aplikasi agar port baru berlaku.';$('portrestart').style.display='';}
  else{m.className='hint ok';m.textContent='Port ini sudah dipakai sekarang.';$('portrestart').style.display='none';}};
$('portrestart').onclick=()=>post('/restart');
$('portavoid').onclick=()=>{$('avlist').innerHTML='';(conf.avoid||[]).forEach(a=>{const r=document.createElement('div');r.className='avrow';const b=document.createElement('b'),n=document.createElement('span');b.textContent=a.port;n.textContent=a.name;r.append(b,n);$('avlist').appendChild(r);});$('avmodal').hidden=false;};
$('avclose').onclick=()=>{$('avmodal').hidden=true;};$('avmodal').onclick=e=>{if(e.target===$('avmodal'))$('avmodal').hidden=true;};
$('sendOn').onchange=()=>post('/send-set',{on:$('sendOn').checked}).catch(()=>{});
$('autoOpen').onchange=()=>post('/autoopen-set',{on:$('autoOpen').checked}).catch(()=>{});
$('u2').onclick=()=>{$('u2').select();try{document.execCommand('copy')}catch{}};
$('obsadd').onclick=async()=>{const m=$('obsmsg');m.className='hint';m.textContent='Menghubungi OBS...';
  const r=await(await post('/obs-add',{width:+$('obsW').value||500,height:+$('obsH').value||900,password:$('obsPass').value})).json();
  if(r.error){m.className='hint no';m.textContent='Gagal: '+r.error;}else{m.className='hint ok';m.textContent='Berhasil. Overlay sudah ada di scene OBS yang sedang aktif (nama sumber: ChatStream Overlay).';}};
}
function initSettings(){fill('dock');fill('overlay');fillGlobal();applyUi(cur('dock'));$('yt').value=conf.youtube||'';$('tk').value=conf.tiktok||'';$('twu').value=conf.twitch||'';$('kku').value=conf.kick||'';$('kkroom').value=conf.kickRoom||'';$('u2').value=location.origin+'/?view=overlay';showPort();syncPlats();
  hk={...HK_DEF,...((S.global&&S.global.hotkeys)||{})};hkRender();setTab(isDash?'d':'k');acct();setInterval(()=>{if(!document.hidden)acct();},5000);if(isDash)initDash();
  addEventListener('beforeunload',()=>{fetch('/draft-clear',{method:'POST',body:'{}',keepalive:true});});}
// ---- Dashboard: sidebar, halaman beranda, pratinjau kanan (Pribadi / Overlay), laporan ----
const PVSRC={pvD:'/?view=dock&preview=1&static=1',pvO:'/?view=overlay&preview=1&static=1'};
// mode pratinjau per tab: 'prev' = chat contoh hanya di pratinjau; 'live' = chat contoh dikirim ke Dock (Pribadi) / overlay OBS (Overlay), pratinjau dikosongkan
let pvTarget='',repLoad=null;
// bersihkan chat contoh yang pernah dikirim ke Dock / Overlay
function pvLiveStop(){if(pvTarget){pvTarget='';post('/sample-clear').catch(()=>{});}}
function pvUI(){const t=document.body.dataset.pv;if(t!=='p'&&t!=='o')return;$('pvm_live').textContent=t==='p'?'Kirim Chat ke Dock':'Kirim Chat ke Overlay';}
// tombol "Kirim Chat Pratinjau": tambah satu chat acak ke pratinjau
const PV_N=10,PV_GAP=300; // sekali tekan = 10 chat contoh, muncul berurutan tiap 0,3 dtk
function pvAddOne(){const t=document.body.dataset.pv;if(t!=='p'&&t!=='o')return;
  pvBatch().forEach((m,i)=>setTimeout(()=>{if(document.body.dataset.pv!==t)return;const f=$(t==='p'?'pvD':'pvO');if(f&&f.contentWindow&&f.getAttribute('src')===PVSRC[f.id])f.contentWindow.postMessage({type:'add',m},'*');},i*PV_GAP));}
// tombol "Kirim Chat ke Dock/Overlay": kirim satu chat acak ke sana
// 10 chat dibuat sekaligus dan semuanya berbeda (nama, isi, jenis, hadiah tidak ada yang kembar), lalu dikirim berurutan; dipakai kedua tombol (pratinjau dan ke Dock / Overlay)
function pvBatch(){const seen=new Set(),names=new Set(),out=[];for(let g=0;out.length<PV_N&&g<PV_N*10;g++){const m=pickScen();if(!m)break;const k=[m.p,m.kind,m.name,m.text,m.gift].join('|');if(seen.has(k)||(m.name&&names.has(m.name)))continue;seen.add(k);if(m.name)names.add(m.name);out.push(m);}return out;}
function pvSendLive(){const t=document.body.dataset.pv;if(t!=='p'&&t!=='o')return;const target=t==='p'?'dock':'overlay';
  pvBatch().forEach((m,i)=>setTimeout(()=>{if(document.body.dataset.pv!==t||EN[m.p]===false)return;pvTarget=target;post('/sample',{m:{...m},target}).catch(()=>{});},i*PV_GAP));}
// hanya pratinjau tab yang sedang dibuka yang dimuat (hemat RAM); yang lain dikosongkan
function pvLoadFrames(tab){const want=tab==='p'?'pvD':tab==='o'?'pvO':'';['pvD','pvO'].forEach(id=>{const f=$(id);if(!f)return;const cur=f.getAttribute('src');
  if(id===want){if(cur!==PVSRC[id])f.src=PVSRC[id];}else if(cur&&cur!=='about:blank')f.src='about:blank';});}
function dashPane(tab){
  document.querySelectorAll('.sbi[data-t]').forEach(x=>x.classList.toggle('on',x.dataset.t===tab));
  document.body.classList.toggle('split',tab==='p'||tab==='o');document.body.classList.toggle('rview',tab==='r');document.body.dataset.pv=tab;
  pvLiveStop();pvLoadFrames(tab);
  pvUI();if(tab==='r'&&repLoad)repLoad();}
function pvSend(){if(!isDash)return;const s=copy(S);s.global=s.global||{};s.dock={...(s.dock||{}),...collect('dock')};s.overlay={...(s.overlay||{}),...collect('overlay')};
  [['pvD','p'],['pvO','o']].forEach(([i,t])=>{const f=$(i);if(f&&f.getAttribute('src')===PVSRC[i]&&f.contentWindow)f.contentWindow.postMessage({type:'cfg',settings:s,enabled:EN},'*');});}
function dashRender(){const b=$('dst');if(!b)return;const on=PF4.filter(k=>EN[k]);
  b.textContent='';
  if(!on.length){b.innerHTML='<div class="hint">Belum ada platform yang menyala. Nyalakan di tab Koneksi.</div>';return;}
  on.forEach(k=>{const [c,t]=stView(status[k]),r=document.createElement('div'),l=document.createElement('span'),i=document.createElement('img'),v=document.createElement('span');
    r.className='dsr';i.src=PL[k];i.alt='';l.append(i,PNAME[k]);
    v.className='dsv'+(c?' '+c:'');v.textContent=t+(viewers[k]!=null?' \u00b7 '+fmt(viewers[k])+' penonton':'');
    r.append(l,v);b.appendChild(r);});}
let dashSt={chat:{},docks:{}};
const SV_RELOAD='<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',SV_X='<path d="M6 6l12 12M18 6L6 18"/>',SV_LK_OPEN='<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-1.5"/>',SV_LK_SHUT='<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
// kartu Chat di beranda Dashboard: tombolnya sama seperti kartu Donate Dock (Buka / muat ulang + tutup / gembok)
function dashChat(){const box=$('dChatBtns'),s2=$('dChatSt');if(!box)return;const c=dashSt.chat||{};
  if(s2){s2.className=c.open?(c.locked?'lk':'on'):'';s2.textContent=c.open?(c.locked?'Terbuka, terkunci':'Terbuka'):'Tertutup';}
  box.textContent='';
  const mk=(t,cls,fn)=>{const b=document.createElement('button');b.className='btn sm '+cls;b.textContent=t;b.onclick=fn;box.appendChild(b);return b;};
  const mkI=(svg,t,cls,fn)=>{const b=mk('',cls+' ic',fn);b.innerHTML='<svg viewBox="0 0 24 24">'+svg+'</svg>';b.title=t;b.setAttribute('aria-label',t);return b;};
  if(c.open){mkI(SV_RELOAD,'Muat ulang','b4',()=>{post('/win',{which:'main',act:'reload'});});mkI(SV_X,'Tutup','b2',()=>{post('/win',{which:'main',act:'close'});setTimeout(dashPoll,250);});}
  else mk('Buka','b1',()=>{openC('chat');setTimeout(dashPoll,250);});
  mkI(c.locked?SV_LK_SHUT:SV_LK_OPEN,c.locked?'Buka kunci':'Kunci jendela','b4'+(c.locked?' on':''),async()=>{await post('/lock',{on:!c.locked});setTimeout(dashPoll,500);}).disabled=!c.open;}
// Donate Dock di beranda Dashboard: 1 kotak = 1 dock. Pengaturannya (URL, Opacity, bisukan suara) ada di dialog "Atur Donate Dock".
const DN_MAX=5;
const dnList=()=>{const g=S.global||{};return Array.isArray(g.donateDocks)?g.donateDocks:[];};
function dashDocks(){const box=$('dDocks');if(!box)return;const L=dnList(),full=L.length>=DN_MAX;
  $('dDockHint').textContent=L.length?'':'Belum ada Donate Dock. Klik tombol + di kanan bawah untuk menambahkan widget donasi (alert / media share) di layar game.';
  $('dDockAdd').style.display=full?'none':'';
  box.textContent='';
  L.forEach(d=>{const st=(dashSt.docks||{})[d.id]||{},c=document.createElement('div');c.className='card dkc';
    const h=document.createElement('h3'),sm=document.createElement('small'),bt=document.createElement('div'),i=document.createElement('div');
    h.textContent=d.name||d.id;i.className='dki';sm.className=st.open?(st.locked?'lk':'on'):'';sm.textContent=!d.url?'URL belum diisi':st.open?(st.locked?'Terbuka, terkunci':'Terbuka'):'Tertutup';i.appendChild(sm);bt.className='dkb';
    const mk=(t,cls,fn)=>{const b=document.createElement('button');b.className='btn sm '+cls;b.textContent=t;b.onclick=fn;bt.appendChild(b);return b;};
    const act=async a=>{const x=await(await post('/donate',{act:a,id:d.id})).json();if(x&&x.error)sm.textContent=x.error;setTimeout(dashPoll,250);};
    const mkI=(svg,t,cls,fn)=>{const b=mk('',cls+' ic',fn);b.innerHTML='<svg viewBox="0 0 24 24">'+svg+'</svg>';b.title=t;b.setAttribute('aria-label',t);return b;};
    if(st.open){mkI(SV_RELOAD,'Muat ulang','b4',()=>act('reload'));mkI(SV_X,'Tutup','b2',()=>act('close'));}else mk('Buka','b1',()=>act('open')).disabled=!d.url;
    mkI(st.locked?SV_LK_SHUT:SV_LK_OPEN,st.locked?'Buka kunci':'Kunci jendela','b4'+(st.locked?' on':''),async()=>{await post('/lock',{on:!st.locked,id:d.id});setTimeout(dashPoll,500);});
    mkI('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>','Pengaturan','b3',()=>dnOpen(d,false));
    c.append(h,i,bt);box.appendChild(c);});}
let dnCur=null,dnDelArm=false;
const dnOpLbl=()=>{const e=$('dnmOp');$('dnmOpV').textContent=e.value+'%';e.style.setProperty('--pct',((e.value-e.min)/(e.max-e.min)*100)+'%');};
function dnOpen(d,isNew){dnCur={d:copy(d),isNew};dnDelArm=false;
  $('dnmT').textContent=isNew?'Tambah Donate Dock':'Atur '+(d.name||'Donate Dock');
  $('dnmName').value=d.name||'';$('dnmUrl').value=d.url||'';$('dnmOp').value=d.opacity||100;dnOpLbl();$('dnmMute').checked=isNew?true:!!d.mute;$('dnmFit').checked=d.fit!==false;
  $('dnmMsg').className='hint';$('dnmMsg').textContent='';$('dnmDel').textContent='Hapus';$('dnmDel').style.display=isNew?'none':'';
  $('dnModal').hidden=false;$('dnmUrl').focus();}
async function dnPost(L){const r=await(await post('/donate-docks',{docks:L})).json();if(r.error){$('dnmMsg').className='hint no';$('dnmMsg').textContent=r.error;return false;}
  S.global=S.global||{};S.global.donateDocks=r.docks;$('dnModal').hidden=true;dnCur=null;dashDocks();setTimeout(dashPoll,250);return true;}
function initDnModal(){
  $('dnmOp').oninput=dnOpLbl;
  $('dnmCancel').onclick=()=>{$('dnModal').hidden=true;dnCur=null;};
  $('dnModal').onclick=e=>{if(e.target===$('dnModal')){$('dnModal').hidden=true;dnCur=null;}};
  $('dnmSave').onclick=async()=>{if(!dnCur)return;const url=$('dnmUrl').value.trim();
    if(!url){$('dnmMsg').className='hint no';$('dnmMsg').textContent='Isi URL widget donasi dulu.';return;}
    const d={...dnCur.d,name:$('dnmName').value.trim()||dnCur.d.name,url,opacity:+$('dnmOp').value,mute:$('dnmMute').checked,fit:$('dnmFit').checked},L=copy(dnList()),i=L.findIndex(x=>x.id===d.id);
    if(i>=0)L[i]=d;else L.push(d);await dnPost(L);};
  $('dnmDel').onclick=async()=>{if(!dnCur||dnCur.isNew)return;
    if(!dnDelArm){dnDelArm=true;$('dnmDel').textContent='Yakin hapus?';return;}
    await dnPost(dnList().filter(x=>x.id!==dnCur.d.id));};
  $('dDockAdd').onclick=()=>{const L=dnList();if(L.length>=DN_MAX)return;let n=1;while(L.some(x=>x.name==='Donate Dock '+n))n++;
    dnOpen({id:'d'+Date.now().toString(36),name:'Donate Dock '+n,url:'',opacity:100,mute:true,fit:true,refW:1280,refH:720},true);};
}
async function dashPoll(){if(!isDash||document.hidden)return;try{dashSt=await(await fetch('/dash-state')).json();}catch{return;}
  dashChat();dashDocks();}
let dashInit=false;
function initDash(){if(dashInit)return;dashInit=true;
  document.querySelectorAll('.sbi[data-t]').forEach(b=>b.onclick=()=>setTab(b.dataset.t));
  initDnModal();dashPoll();setInterval(()=>{if(!document.hidden)dashPoll();},2500);
  $('pvm_prev').onclick=pvAddOne;$('pvm_live').onclick=pvSendLive;
  // Dashboard disembunyikan (tray): pratinjau dibongkar supaya tidak memakan RAM/CPU, dimuat lagi saat dibuka
  document.addEventListener('visibilitychange',()=>pvLoadFrames(document.hidden?'':document.body.dataset.pv));
  window.__goTab=t=>setTab(t);
  addEventListener('beforeunload',()=>{if(pvTarget)fetch('/sample-clear',{method:'POST',body:'{}',keepalive:true});});
  addEventListener('message',e=>{if(e.data&&e.data.type==='ready')pvSend();});repLoad=initReport(true);syncPlats();dashRender();}
// ---- kelola gaya overlay (daftar kartu + pratinjau) ----
let tplSig='';
const saveTpls=l=>post('/settings',{view:'global',values:{templates:l}});
const usingId=()=>cur('overlay').preset;
function sendCfg(f){if(f&&f.contentWindow)f.contentWindow.postMessage({type:'cfg',settings:S},'*');}
function tplOnSettings(){applyUi(cur('dock'));const sig=JSON.stringify(customs());if(sig!==tplSig)renderTpl();else document.querySelectorAll('.tcard iframe').forEach(sendCfg);}
function renderTpl(){
  tplSig=JSON.stringify(customs());const box=$('tplList');box.innerHTML='';
  const all=[...PRE.map(([id,name])=>({id,name,builtin:true})),...customs()];
  all.forEach(t=>{const c=document.createElement('div');c.className='tcard'+(t.builtin?'':' cu');c.dataset.id=t.id;
    c.innerHTML='<div class="pv"><iframe></iframe></div><div class="tf"><b></b></div>';
    c.querySelector('b').textContent=t.name;
    c.querySelector('iframe').src='/?view=overlay&preview=1&static=1&force='+encodeURIComponent(t.id);
    const tf=c.querySelector('.tf');
    if(t.builtin){const g=document.createElement('span');g.className='tag2';g.textContent='Bawaan';tf.appendChild(g);}
    else{c.onclick=()=>openC('tpladd',t.id);
      const d=document.createElement('button');d.className='del';d.textContent='Hapus';
      d.onclick=async ev=>{ev.stopPropagation();if(!confirm('Hapus gaya "'+t.name+'"?\n\nGaya ini akan hilang. Gaya bawaan bisa dipulihkan lewat tombol "Pulihkan gaya bawaan".'))return;
        if(usingId()===t.id)await post('/settings',{view:'overlay',values:{...(S.overlay||{}),preset:'polos'}});
        await saveTpls(customs().filter(x=>x.id!==t.id));};
      tf.appendChild(d);}
    box.appendChild(c);});}
function initTpl(){
  applyUi(cur('dock'));
  addEventListener('message',e=>{if(e.data&&e.data.type==='ready')sendCfg([...document.querySelectorAll('iframe')].find(f=>f.contentWindow===e.source));});
  $('tAdd').onclick=()=>openC('tpladd');$('tRestore').onclick=()=>post('/templates-restore');renderTpl();}
const GUIDE=`Buatkan CSS untuk overlay chat live streaming. CSS saja, tanpa JavaScript dan tanpa mengubah HTML.
Struktur HTML tiap chat (sudah tetap, jangan diubah):

<div class="m msg y yt" data-platform="youtube">   <!-- TikTok: class "t tt". Twitch: "w tw". Kick: "k kk". Bot: .isbot, moderator: .ismod, pemilik: .isown, VIP: .isvip, member/subscriber: .ismem, chat /me: .isme, Super Chat/Bits/Kicks: .sc (warna di variabel --sc) -->
  <span class="pl logo"><img src="logo-platform.png"></span>   <!-- logo platform -->
  <div class="av avatar"></div>                                  <!-- foto profil (background-image) -->
  <div class="body">
    <div class="hd head">
      <span class="tag"><img class="pi" src="logo-platform.png"><b class="nm name"><i>R</i><i>I</i><i>O</i></b></span>  <!-- nama, tiap huruf dibungkus <i> -->
      <span class="tm time">20:45</span>
      <span class="bd bot">BOT</span><span class="bd mod">MOD</span><span class="bd own">OWNER</span><span class="bd vip">VIP</span><span class="bd mem">MEMBER</span>
    </div>
    <div class="tx text message"><span>isi chat (bisa berisi <img class="cs-emo"> untuk emote Twitch/Kick)</span></div>
  </div>
</div>

Wadah semua chat: <div id="msgs"> di dalam <div id="list"> (list = area overlay penuh). Chat terbaru ada di bawah.
Variabel yang boleh dipakai: --fsn (ukuran nama), --fst (ukuran chat), --gap (jarak antar chat).
Platform: .y / .yt = YouTube (merah), .t / .tt = TikTok (cyan dan pink), .w / .tw = Twitch (ungu), .k / .kk = Kick (hijau). Beri tiap platform warnanya sendiri lewat --c, misalnya .w{--c:#b794ff} .k{--c:#53fc18}.
Kalau chat dibuat rata kanan, <body> mendapat class "al-right" (tulis versi kanan: body.al-right .m {...}).
Latar halaman transparan. Jangan beri background pada body.
Gaya yang saya mau: [JELASKAN DESAINNYA DI SINI]`;
// ---- jendela tambah / edit gaya (nama + CSS + pratinjau) ----
let editId=null;
function liveDraft(){const f=$('tlive');if(f.contentWindow)f.contentWindow.postMessage({type:'tpldraft',css:$('tc').value},'*');}
function initAdd(){
  applyUi(cur('dock'));editId=Q.get('id');const t=editId&&customs().find(x=>x.id===editId);
  if(t){$('tn').value=t.name;$('tc').value=t.css||'';$('tbt').textContent='Edit gaya: '+t.name;}else $('tbt').textContent='Gaya baru';
  $('tlive').src='/?view=overlay&preview=1&static=1&force=__draft';
  addEventListener('message',e=>{if(e.data&&e.data.type==='ready'){sendCfg($('tlive'));liveDraft();}});
  $('tc').addEventListener('input',liveDraft);
  $('timp').onclick=()=>$('tf').click();
  $('texp').onclick=async()=>{const css=$('tc').value;if(!css.trim())return alert('CSS masih kosong, belum ada yang bisa diekspor.');
    const name=($('tn').value||'gaya-overlay').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-')||'gaya-overlay';
    let r;try{r=await(await post('/export-css',{name,css})).json();}catch{r={error:'gagal'};}
    if(r.canceled)return;if(r.ok){const b=$('texp');b.textContent='Tersimpan';setTimeout(()=>b.textContent='Ekspor file .css',1500);return;}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([css],{type:'text/css'}));a.download=name+'.css';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);};
  $('tf').onchange=()=>{const f=$('tf').files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('tc').value=String(r.result||'').slice(0,400000);if(!$('tn').value)$('tn').value=f.name.replace(/\.css$/i,'');liveDraft();};r.readAsText(f);$('tf').value='';};
  $('tguide').onclick=async()=>{try{await navigator.clipboard.writeText(GUIDE);}catch{const ta=document.createElement('textarea');ta.value=GUIDE;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}alert('Panduan struktur disalin. Tempel ke AI bersama desain yang kamu mau, lalu minta dibuatkan CSS-nya.');};
  $('tcancel').onclick=()=>post('/win',{which:'tpladd',act:'close'});
  $('tsave').onclick=async()=>{const name=$('tn').value.trim(),css=$('tc').value;if(!name){alert('Isi nama gaya dulu.');return;}if(!css.trim()){alert('CSS-nya masih kosong.');return;}
    const struct=detectStruct(css);let l=customs().slice();
    if(editId&&t)l=l.map(x=>x.id===editId?{...x,name,css,struct}:x);else l.push({id:'c_'+Date.now().toString(36),name,css,struct});
    await saveTpls(l);post('/win',{which:'tpladd',act:'close'});};
}
// ---- filter + kirim chat ----
if(!isAdmin){
$('flt').value=filt;
$('flt').onchange=()=>{filt=$('flt').value;try{localStorage.setItem('flt',filt)}catch{};applyStyle();toLatest();};
function flash(m){const i=$('msg');if(!i.dataset.ph)i.dataset.ph=i.placeholder;i.classList.add('err');i.placeholder=m;clearTimeout(flash.t);flash.t=setTimeout(()=>{i.classList.remove('err');i.placeholder=i.dataset.ph;},4500);}
// Tujuan kirim. Filter "Semua" = hanya platform yang dinyalakan DAN berstatus "Terhubung" (yang belum tersambung dilewati tanpa error).
// Filter satu platform = platform itu apa adanya (kalau belum tersambung, error eksplisit dari server).
function sendTargets(f,en,st){return f==='all'?PF4.filter(p=>en[p]&&stView((st||{})[p])[1]==='Terhubung'):[f];}
async function doSend(){
  const text=$('msg').value.trim();if(!text)return;
  const targets=sendTargets(filt,EN,status);
  if(!targets.length){flash(PF4.some(p=>EN[p])?'Belum ada platform yang tersambung.':'Belum ada platform yang menyala. Nyalakan di Dashboard > Koneksi.');return;}
  $('send').disabled=true;
  try{const r=await(await post('/send',{text,targets})).json();
    if(r.error)flash('Gagal: '+r.error);
    else{const okk=targets.filter(k=>r[k]==='ok'),bad=targets.filter(k=>r[k]!==undefined&&r[k]!=='ok');
      if(okk.length)$('msg').value='';
      if(bad.length)flash(bad.map(k=>PNAME[k]+': '+r[k]).join(' | '));}
  }catch(e){flash('Gagal: '+e.message);}
  $('send').disabled=false;$('msg').focus();}
$('send').onclick=doSend;$('msg').onkeydown=e=>{if(e.key==='Enter')doSend();};
}

// ---- jendela laporan penonton ----
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fdur=ms=>{const m=Math.floor(ms/60000),h=Math.floor(m/60);return h?h+' j '+(m%60)+' m':m+' m '+Math.floor(ms/1000)%60+' d';};
const sumN=(...a)=>a.every(x=>x==null)?null:a.reduce((t,x)=>t+(x||0),0);
function chartHtml(r){
  const S=r.series;if(S.length<2)return '<div class="hint">Grafik muncul setelah ada beberapa sampel (dicatat tiap 15 detik selama ada data penonton).</div>';
  const W=900,H=260,L=50,R=14,TP=12,B=26,t0=S[0][0],t1=Math.max(S[S.length-1][0],t0+1),tot=S.map(x=>sumN(x[1],x[2],x[3],x[4]));
  const mx=Math.max(1,r.total.peak?r.total.peak.v:0,...tot.filter(x=>x!=null)),p=Math.pow(10,Math.floor(Math.log10(mx))),f=mx/p,ym=Math.max(4,(f<=1?1:f<=2?2:f<=5?5:10)*p);
  const X=t=>L+(t-t0)/(t1-t0)*(W-L-R),Y=v=>TP+(1-v/ym)*(H-TP-B);
  const path=a=>{let d='',on=false;a.forEach((v,i)=>{if(v==null){on=false;return;}d+=(on?'L':'M')+X(S[i][0]).toFixed(1)+' '+Y(v).toFixed(1);on=true;});return d;};
  let g='';for(let i=0;i<=4;i++){const v=ym*i/4,y=Y(v);g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" style="stroke:var(--line)"/><text x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end" font-size="11" style="fill:var(--muted)">'+fmt(Math.round(v))+'</text>';}
  for(let i=0;i<=5;i++){const t=t0+(t1-t0)*i/5;g+='<text x="'+X(t)+'" y="'+(H-6)+'" text-anchor="middle" font-size="11" style="fill:var(--muted)">'+hhmm(t)+'</text>';}
  const pk=r.total.peak;
  const ln=(a,c,w)=>'<path d="'+path(a)+'" fill="none" stroke-width="'+w+'" stroke-linejoin="round" style="stroke:var('+c+')"/>';
  return '<div class="chartbox"><svg viewBox="0 0 '+W+' '+H+'" id="rchart">'+g+ln(S.map(x=>x[1]),'--yc',1.6)+ln(S.map(x=>x[2]),'--tcl',1.6)+(r.tw.n?ln(S.map(x=>x[3]),'--wc',1.6):'')+(r.kk.n?ln(S.map(x=>x[4]),'--kc',1.6):'')+ln(tot,'--acc',2.4)
   +(pk?'<circle cx="'+X(pk.t)+'" cy="'+Y(pk.v)+'" r="5" style="fill:var(--acc);stroke:var(--winbg)" stroke-width="2"/>':'')
   +'<line id="rvl" y1="'+TP+'" y2="'+(H-B)+'" style="stroke:var(--muted);display:none" stroke-dasharray="3 3"/></svg><div class="tip" id="rtip"></div></div>'
   +'<div class="leg"><span><i style="background:var(--acc)"></i>Total</span><span><i style="background:var(--yc)"></i>YouTube</span><span><i style="background:var(--tcl)"></i>TikTok</span>'+(r.tw.n?'<span><i style="background:var(--wc)"></i>Twitch</span>':'')+(r.kk.n?'<span><i style="background:var(--kc)"></i>Kick</span>':'')+'<span style="margin-left:auto">Titik besar = puncak</span></div>';}
function chartHover(r){
  const svg=$('rchart');if(!svg)return;const S=r.series,tip=$('rtip'),vl=$('rvl'),W=900,L=50,R=14,t0=S[0][0],t1=Math.max(S[S.length-1][0],t0+1);
  svg.onmousemove=e=>{const rc=svg.getBoundingClientRect(),px=(e.clientX-rc.left)/rc.width*W,t=t0+(px-L)/(W-L-R)*(t1-t0);let b=0;
    S.forEach((x,i)=>{if(Math.abs(x[0]-t)<Math.abs(S[b][0]-t))b=i;});const x=S[b],xx=L+(x[0]-t0)/(t1-t0)*(W-L-R);
    vl.setAttribute('x1',xx);vl.setAttribute('x2',xx);vl.style.display='';
    tip.innerHTML='<b>'+hhmm(x[0])+'</b> &middot; menit ke-'+Math.round((x[0]-r.start)/60000)+'<br>Total: <b>'+fmt(sumN(x[1],x[2],x[3],x[4]))+'</b><br><span class="dy">YouTube: '+fmt(x[1])+'</span><br><span class="dt">TikTok: '+fmt(x[2])+'</span>'+(r.tw.n?'<br><span class="dw">Twitch: '+fmt(x[3])+'</span>':'')+(r.kk.n?'<br><span class="dk">Kick: '+fmt(x[4])+'</span>':'');
    tip.style.display='block';const bx=svg.parentNode.getBoundingClientRect();let lx=e.clientX-bx.left+14;if(lx>bx.width-150)lx=e.clientX-bx.left-150;tip.style.left=lx+'px';tip.style.top='8px';};
  svg.onmouseleave=()=>{tip.style.display='none';vl.style.display='none';};}
function drawRep(r){
  const box=$('rbody');
  if(!r){box.innerHTML='<div class="card"><h3>Belum ada data</h3><div class="hint">Laporan terisi otomatis begitu ada data penonton atau chat. Sambungkan live di Pengaturan &gt; Koneksi, lalu buka laporan ini lagi.</div></div>';return;}
  const T=r.total,Y=r.yt,K=r.tt,W=r.tw,KK=r.kk,last=r.series[r.series.length-1]||[0,null,null,null,null];
  const nY=r.now?r.now.yt:last[1],nK=r.now?r.now.tt:last[2],nW=r.now?r.now.tw:last[3],nKk=r.now?r.now.kk:last[4],nT=sumN(nY,nK,nW,nKk);
  const when=p=>p?hhmm(p.t)+' &middot; menit ke-'+p.min:'-';
  const rows=[['YouTube','dy',Y,nY],['TikTok','dt',K,nK],...(W.n||nW!=null?[['Twitch','dw',W,nW]]:[]),...(KK.n||nKk!=null?[['Kick','dk',KK,nKk]]:[]),['Total','',T,nT]].map(([n,c,x,nv])=>'<tr><td class="'+c+'"><b>'+n+'</b></td><td class="n">'+fmt(nv)+'</td><td class="n">'+(x.peak?fmt(x.peak.v):'-')+'</td><td class="n">'+when(x.peak)+'</td><td class="n">'+fmt(x.avg)+'</td><td class="n">'+(x.low?fmt(x.low.v):'-')+'</td><td class="n">'+(x.online?fdur(x.online):'-')+'</td></tr>').join('');
  const mxA=Math.max(1,...r.blocks.map(b=>b.avg||0));
  const blk=r.blocks.map(b=>'<tr><td>'+b.from+'&ndash;'+b.to+' menit</td><td>'+hhmm(b.at)+'</td><td class="n">'+fmt(b.avg)+'</td><td class="n">'+fmt(b.peak)+'</td><td class="n">'+fmt(b.chat)+'</td><td style="width:26%"><div class="rbar" style="width:'+Math.round((b.avg||0)/mxA*100)+'%"></div></td></tr>').join('');
  const C=r.chat,tt=r.tiktok,yt=r.youtube;
  const rl=(a,b)=>'<div class="rl"><span>'+a+'</span><b>'+b+'</b></div>';
  const top=l=>l.length?l.map((x,i)=>rl((i+1)+'. '+esc(x.name),fmt(x.n))).join(''):'<div class="hint">Belum ada.</div>';
  const kp=(lb,v,sb)=>'<div class="card kpi"><div class="lb">'+lb+'</div><div class="vl">'+v+'</div><div class="sb2">'+sb+'</div></div>';
  const split=(a,b,c,d)=>'<span class="dy">YouTube '+fmt(a)+'</span> &middot; <span class="dt">TikTok '+fmt(b)+'</span>'+(c!=null?' &middot; <span class="dw">Twitch '+fmt(c)+'</span>':'')+(d!=null?' &middot; <span class="dk">Kick '+fmt(d)+'</span>':'');
  const pk=x=>x.peak?x.peak.v:null,w0=W.n?1:0,k0=KK.n?1:0;
  box.innerHTML=
   '<div class="rg rg4">'+kp(r.live?'Penonton aktif sekarang':'Penonton terakhir',fmt(nT),split(nY,nK,w0||nW!=null?nW:null,k0||nKk!=null?nKk:null))
   +kp('Puncak penonton',T.peak?fmt(T.peak.v):'-',T.peak?'pukul '+when(T.peak)+'<br>'+split(pk(Y),pk(K),w0?pk(W):null,k0?pk(KK):null):'-')
   +kp('Rata-rata penonton',fmt(T.avg),split(Y.avg,K.avg,w0?W.avg:null,k0?KK.avg:null))
   +kp('Durasi sesi',fdur(r.dur),'mulai '+hhmm(r.start)+(r.end?' &middot; selesai '+hhmm(r.end):' &middot; masih berjalan'))+'</div>'
   +'<div class="card"><h3>Penonton dari waktu ke waktu</h3>'+chartHtml(r)+'</div>'
   +'<div class="card"><h3>Per platform</h3><table class="rt"><tr><th>Platform</th><th class="n">Sekarang</th><th class="n">Puncak</th><th class="n">Waktu puncak</th><th class="n">Rata-rata</th><th class="n">Terendah</th><th class="n">Lama terpantau</th></tr>'+rows+'</table></div>'
   +'<div class="card"><h3>Rata-rata penonton tiap '+r.block+' menit</h3><table class="rt"><tr><th>Menit ke</th><th>Pukul</th><th class="n">Rata-rata</th><th class="n">Puncak</th><th class="n">Chat</th><th></th></tr>'+blk+'</table></div>'
   +'<div class="rg rg2"><div class="card"><h3>Chat</h3>'+rl('Total pesan',fmt(C.total))+rl('<img src="/yt.png" alt="">YouTube',fmt(C.y)+' pesan &middot; '+fmt(C.uy)+' orang')+rl('<img src="/tt.png" alt="">TikTok',fmt(C.t)+' pesan &middot; '+fmt(C.ut)+' orang')
   +(C.w||W.n?rl('<img src="/tw.png" alt="">Twitch',fmt(C.w)+' pesan &middot; '+fmt(C.uw)+' orang'):'')+(C.k||KK.n?rl('<img src="/kick.png" alt="">Kick',fmt(C.k)+' pesan &middot; '+fmt(C.uk)+' orang'):'')
   +rl('Rata-rata per menit',fmt(C.perMin))+rl('Paling ramai',C.peak?fmt(C.peak.v)+' pesan/menit &middot; '+hhmm(C.peak.t):'-')
   +'<h3 style="margin-top:14px">Paling aktif chat &middot; YouTube</h3>'+top(C.topY)+'<h3 style="margin-top:14px">Paling aktif chat &middot; TikTok</h3>'+top(C.topT)+(C.w?'<h3 style="margin-top:14px">Paling aktif chat &middot; Twitch</h3>'+top(C.topW):'')+(C.k?'<h3 style="margin-top:14px">Paling aktif chat &middot; Kick</h3>'+top(C.topK):'')+'</div>'
   +'<div style="display:flex;flex-direction:column;gap:14px"><div class="card"><h3>Aktivitas TikTok</h3>'+rl('Hadiah diterima',fmt(tt.gifts))+rl('Total koin',fmt(tt.coins))+rl('Suka (like)',fmt(tt.likes))+rl('Pengikut baru',fmt(tt.follows))+rl('Live dibagikan',fmt(tt.shares))+rl('Penonton bergabung',fmt(tt.joins))+rl('Langganan',fmt(tt.subs))
   +(tt.gifters.length?'<h3 style="margin-top:14px">Pengirim hadiah terbanyak</h3>'+tt.gifters.slice(0,5).map((x,i)=>rl((i+1)+'. '+esc(x.name),fmt(x.coins)+' koin')).join(''):'')+'</div>'
   +(()=>{const q=r.twitch,any=Object.values(q).some(x=>x>0);return any?'<div class="card"><h3>Aktivitas Twitch</h3>'+rl('Subscribe / resub',fmt(q.subs))+rl('Chat subscriber',fmt(q.subChat))+rl('Gift sub (kali dibagikan)',fmt(q.gifts))+rl('Total gift sub',fmt(q.giftSubs))+rl('Raid masuk',fmt(q.raids)+' &middot; '+fmt(q.raiders)+' penonton')+rl('Chat Bits',fmt(q.bitMsgs)+' &middot; '+fmt(q.bits)+' bits')+rl('Pengumuman moderator',fmt(q.announces))+rl('Chatter baru',fmt(q.firsts))+'</div>':'';})()
   +(()=>{const q=r.kick,any=Object.values(q).some(x=>x>0);return any?'<div class="card"><h3>Aktivitas Kick</h3>'+rl('Subscribe',fmt(q.subs))+rl('Chat subscriber',fmt(q.subChat))+rl('Gift sub (kali dibagikan)',fmt(q.gifts))+rl('Total gift sub',fmt(q.giftSubs))+rl('Pengikut baru',fmt(q.follows))+rl('Raid / host masuk',fmt(q.raids)+' &middot; '+fmt(q.raiders)+' penonton')+rl('Chat Kicks',fmt(q.kickMsgs)+' &middot; '+fmt(q.kicks)+' Kicks')+rl('Hadiah poin (reward)',fmt(q.rewards))+'</div>':'';})()
   +'<div class="card"><h3>Aktivitas YouTube</h3>'+rl('Super Chat',fmt(yt.sc))+(yt.totals.length?yt.totals.map(x=>rl('Total '+esc(x.cur),fmt(Math.round(x.sum*100)/100))).join(''):'')+rl('Super Sticker',fmt(yt.stickers))+rl('Chat dari member',fmt(yt.members))
   +(yt.top.length?'<h3 style="margin-top:14px">Super Chat terbesar</h3>'+yt.top.map((x,i)=>rl((i+1)+'. '+esc(x.name),esc(x.amount))).join(''):'')+'</div></div></div>'
   +'<div class="hint">Penonton = yang sedang menonton saat sampel diambil (YouTube tiap 20 detik, TikTok tiap ada pembaruan, Twitch dan Kick tiap 30 detik; disimpan tiap 15 detik), bukan jumlah kumulatif. Puncak adalah nilai tertinggi dari sampel itu. Durasi menonton per orang dan data seperti subscriber/like YouTube tidak bisa dibaca aplikasi ini; untuk itu pakai YouTube Studio / TikTok LIVE Center. Total koin dihitung dari hadiah yang tertangkap aplikasi selama terhubung.</div>';
  chartHover(r);}
function initReport(emb){
  let sel='cur',busy=false;const dd=$('rsess');
  const lab=x=>new Date(x.start).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' \u00b7 '+fdur((x.end||Date.now())-x.start)+(x.peak?' \u00b7 puncak '+fmt(x.peak.v):'')+(x.live?' (berjalan)':'');
  async function load(){if(busy||document.hidden)return;busy=true;
    try{const r=await(await fetch('/analytics?id='+encodeURIComponent(sel))).json();
      if(document.activeElement!==dd){dd.innerHTML=r.list.map(x=>'<option value="'+x.id+'">'+esc(lab(x))+'</option>').join('');}
      const id=r.report?r.report.id:'';if(id){sel=id;dd.value=id;}
      $('rlive').hidden=!(r.report&&r.report.live);$('rdel').hidden=!(r.report&&!r.report.live);
      const ph=$('rbody').scrollTop;drawRep(r.report);$('rbody').scrollTop=ph;
    }catch{}busy=false;}
  dd.onchange=()=>{sel=dd.value;dd.blur();load();};
  $('rnew').onclick=async()=>{if(!confirm('Akhiri sesi sekarang dan mulai sesi baru dari nol?\n\nSesi yang diakhiri tetap tersimpan di daftar.'))return;await post('/analytics-new');sel='cur';load();};
  $('rdel').onclick=async()=>{if(!confirm('Hapus laporan sesi ini?'))return;await post('/analytics-del',{id:sel});sel='cur';load();};
  if(!emb){bootDone();load();}
  setInterval(()=>{if(!emb||curTab==='r')load();},5000);
  return load;}
if(isRep)initReport();
