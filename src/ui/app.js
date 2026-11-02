const Q=new URLSearchParams(location.search),V=Q.get('view'),view=V==='overlay'?'overlay':'dock',isSet=V==='settings',isTpl=V==='tpl',isAdd=V==='tpladd',isCtl=V==='ctl',isAdmin=isSet||isTpl||isAdd||isCtl,isPrev=!!Q.get('preview'),isStatic=!!Q.get('static'),isLocked=!!Q.get('locked'),forceId=Q.get('force');
const COMMON={fsName:16,fsText:16,gap:12,bg:90,max:300,fade:0,time:false,viewers:true,botTag:true,hideBots:false,preset:'polos',anim:'slide',order:'bottom',chatBg:false,chatBgColor:'#000000',chatBgOp:60};
const DEF={dock:{...COMMON,joins:true,avatar:false,theme:'standar'},overlay:{...COMMON,anim:'auto',align:'left',fsName:20,fsText:20,bg:0,max:8,fade:45,viewers:false,avatar:true,joins:false}};
const PRE=[['polos','Default']];
const BUILT=PRE.map(x=>x[0]);
const THEMES=[['standar','Standar'],['neo','Neumorfisme'],['glass','Glassmorphism'],['clay','Claymorphism'],['liquid','Liquid Glass'],['spatial','Spatial UI']];
const ANI=[['none','Tanpa animasi'],['slide','Geser'],['fade','Muncul pelan'],['bounce','Memantul'],['zoom','Zoom'],['flip','Putar 3D'],['type','Mengetik'],['glitch','Glitch']];
const ORD=[['bottom','Dari bawah (chat baru di bawah)'],['top','Dari atas (chat baru di atas)']];
let S={dock:{},overlay:{},global:{}},saved=JSON.parse(JSON.stringify(S)),conf={},viewers={},status={},curTab='k',draftTpl=null,curStruct='std',curPid='polos',msgsData=[],accState={};
let filt='all';try{filt=localStorage.getItem('flt')||'all';}catch{}
const $=id=>document.getElementById(id),list=$('list');
const cur=v=>{const s=S[v]||{},o={...DEF[v],...s};if(s.fs!=null&&s.fsName==null&&s.fsText==null){o.fsName=s.fs;o.fsText=s.fs;}return o;};
const fmt=n=>n==null?'-':n.toLocaleString('id-ID');
const hhmm=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const hexA=(h,p)=>{const n=parseInt((h||'#000000').slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+p/100+')';};
const copy=o=>JSON.parse(JSON.stringify(o));
const post=(u,b)=>fetch(u,{method:'POST',body:JSON.stringify(b||{})});
document.addEventListener('dragstart',e=>e.preventDefault());
const wrap=$('msgs');
const BASECLS=isSet?'settings':isTpl?'tplwin':isAdd?'addwin':isCtl?'ctlwin':'';
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
const UIVARS=['--winbg','--card-bg','--ctl-bg','--ctl-line','--line','--muted','--text','--acc','--acc-t','--btn2','--base','--yc','--tcl'];
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
  if(view==='dock'){st.setProperty('--yc',L<.55?'#ff8f8a':'#b3262c');st.setProperty('--tcl',L<.55?'#6fe3ee':'#0a7f88');}
}
// ---- judul jendela tanpa bingkai ----
const WHICH=isSet?'settings':isTpl?'tpl':isAdd?'tpladd':'main';
if(!isPrev&&!isCtl&&view==='dock'||isSet||isTpl||isAdd){
  $('tbt').textContent=isSet?'Pengaturan':isTpl?'Kelola gaya overlay':isAdd?'Gaya overlay':'ChatLivestream Labs';
  $('wmin').onclick=()=>post('/win',{which:WHICH,act:'min'});$('wclose').onclick=()=>post('/win',{which:WHICH,act:'close'});
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
  r.setProperty('--fsn',s.fsName+'px');r.setProperty('--fst',s.fsText+'px');r.setProperty('--fs',s.fsText+'px');r.setProperty('--gap',s.gap+'px');r.setProperty('--bg',s.bg/100);
  r.setProperty('--cbg',s.chatBg?hexA(s.chatBgColor,s.chatBgOp):'transparent');r.setProperty('--p5-scale',(s.fsText/17.5).toFixed(3));r.setProperty('--nr',(s.fsName/s.fsText).toFixed(3));
  let pid=view==='overlay'?(forceId||s.preset):'polos',tpl=tplOf(pid);if(!tpl){pid='polos';tpl=tplOf('polos');}
  const oldStruct=curStruct;curStruct=tpl.struct;curPid=pid;
  let an=s.anim;if(an==='auto'||!an)an=(view==='overlay'&&tpl.custom)?'tpl':'slide';
  const usesVars=!!(tpl.custom&&/--fs[nt]\b|--p5-scale|--nr\b/.test(tpl.css||'')),zm=view==='overlay'&&tpl.custom&&!usesVars&&tpl.struct!=='p5'&&/font(-size)?\s*:[^;}]*\d+(\.\d+)?px/.test(tpl.css||'');
  r.setProperty('--zn',(s.fsName/20).toFixed(3));r.setProperty('--zt',(s.fsText/20).toFixed(3));
  $('usercss').textContent=tpl.custom?tpl.css:'';
  b.className=[view,isPrev?'preview':'',isLocked?'locked':'',s.chatBg?'cb':'',s.order==='top'?'ot':'',(view==='overlay'&&s.align==='right')?'al-right':'',(view==='overlay'&&tpl.struct==='rv')?'s-rv':'','p-'+(tpl.custom?'custom':pid),'an-'+an,zm?'zm':'',(view==='overlay'&&s.gap!==DEF.overlay.gap)?'gap-set':'',booting?'noanim':'',s.viewers?'sv':'',s.time?'st':'',s.avatar?'':'na',s.botTag?'':'nobt',s.hideBots?'hb':'',(view==='dock'&&filt!=='all')?'f-'+filt:''].filter(Boolean).join(' ');
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
function showViewers(){$('vy').textContent=fmt(viewers.youtube);$('vt').textContent=fmt(viewers.tiktok);
  const a=[viewers.youtube,viewers.tiktok].filter(x=>x!=null);$('vs').textContent=a.length?fmt(a.reduce((x,y)=>x+y,0)):'-';}
function showSt(s){status=s;$('st').textContent='YouTube: '+(s.youtube||'-')+'\nTikTok: '+(s.tiktok||'-');}
const FLAGS=m=>(m.bot?' isbot':'')+(m.mod?' ismod':'')+(m.owner?' isown':'')+(m.sample?' sample':'')+(m.sc?' sc':'');
const scColor=m=>(m.sc&&/^#[0-9a-f]{6}$/i.test(m.sc.color||''))?m.sc.color:'#ffca28';
const BADGES='<span class="bd bot">BOT</span><span class="bd mod">MOD</span><span class="bd own">OWNER</span>';
function buildStd(m,src,pf){
  const d=document.createElement('div');d.className='m msg '+pf+(pf==='y'?' yt':' tt')+FLAGS(m);d.dataset.platform=pf==='y'?'youtube':'tiktok';
  d.innerHTML='<span class="pl logo"><img src="'+src+'" alt=""></span><div class="av avatar"></div><div class="body"><div class="hd head"><span class="tag"><img class="pi" src="'+src+'" alt=""><b class="nm name"></b></span><span class="tm time"></span><span class="amt"></span>'+BADGES+'</div><div class="tx text message"><span></span></div></div>';
  const nmEl=d.querySelector('.nm');for(const ch of [...(m.name||'')]){const i=document.createElement('i');i.textContent=ch===' '?'\u00a0':ch;if(ch===' ')i.className='sp';nmEl.appendChild(i);}
  d.querySelector('.tx>span').textContent=m.text;d.querySelector('.tm').textContent=hhmm(m.t);
  if(m.sc){d.style.setProperty('--sc',scColor(m));d.querySelector('.amt').textContent=m.sc.amount;}
  const av=d.querySelector('.av');if(m.avatar)av.style.backgroundImage='url("'+m.avatar.replace(/"/g,'')+'")';else av.textContent=(m.name||'?')[0].toUpperCase();
  return d;}
function buildP5(m,src,pf){
  const d=document.createElement('div');d.className='m p5-msg '+(pf==='y'?'y p5-yt':'t p5-tt')+FLAGS(m);
  d.innerHTML='<div class="p5-head"><span class="p5-logo"><span class="p5-logo-in"><img src="'+src+'" alt=""></span></span><span class="p5-name"></span><span class="tm"></span><span class="p5-amt"></span>'+BADGES+'</div><div class="p5-bub"><div class="p5-l1"><div class="p5-l2"><div class="p5-text"></div></div></div></div>';
  const nm=d.querySelector('.p5-name');let nw=true;
  for(const ch of [...(m.name||'')]){if(ch===' '){const s=document.createElement('span');s.className='sp';nm.appendChild(s);nw=true;continue;}const c=document.createElement('span');c.className='ch'+(nw?' i':'');c.textContent=ch;nm.appendChild(c);nw=false;}
  d.querySelector('.p5-text').textContent=m.text;d.querySelector('.tm').textContent=hhmm(m.t);
  if(m.sc){d.style.setProperty('--sc',scColor(m));d.querySelector('.p5-amt').textContent=m.sc.amount;}
  return d;}
const SVG_YT='<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>';
const SVG_TT='<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>';
function buildRV(m,src,pf){
  const d=document.createElement('div');d.className='msg '+(pf==='y'?'p-yt':'p-tt')+FLAGS(m)+(m.sc?' hl':'');
  d.innerHTML='<div class="badge">'+(pf==='y'?SVG_YT:SVG_TT)+'</div><div class="body"><div class="name"><span class="n"></span></div><div class="text"></div></div>';
  d.querySelector('.n').textContent=m.name;d.querySelector('.text').textContent=m.text;
  const nm=d.querySelector('.name'),tag=t=>{const s=document.createElement('span');s.className='tag';s.textContent=t;nm.appendChild(s);};
  if(m.sc)tag(m.sc.amount);if(m.owner)tag('OWNER');else if(m.mod)tag('MOD');if(m.bot)tag('BOT');
  if(m.sc)d.style.setProperty('--sc',scColor(m));
  return d;}
const cozyN=()=>{const css=(tplOf(forceId||cur(view).preset)||{}).css||'';const n=[...css.matchAll(/data-color\s*=\s*["']?(\d+)/g)].map(x=>+x[1]);return Math.max(5,...n);};
function buildCozy(m,src,pf){
  const d=document.createElement('div');d.className='msg'+FLAGS(m);d.dataset.platform=pf==='y'?'youtube':'tiktok';
  let h=0;for(const ch of String(m.name||''))h=(h*31+ch.charCodeAt(0))>>>0;d.dataset.color=String(h%cozyN()+1);
  d.innerHTML='<div class="avatar"></div><div class="body"><div class="row"><span class="name"></span></div><span class="text"></span></div>';
  const row=d.querySelector('.row'),tag=(t,c)=>{const s=document.createElement('span');s.className='tag'+(c?' '+c:'');s.textContent=t;row.appendChild(s);};
  d.querySelector('.name').textContent=m.name||'';d.querySelector('.text').textContent=m.text;
  if(m.sc){tag(m.sc.amount,'sc');d.style.setProperty('--sc',scColor(m));}if(m.owner)tag('streamer','own');else if(m.mod)tag('mod');if(m.bot)tag('bot');
  const av=d.querySelector('.avatar');if(m.avatar){const i=document.createElement('img');i.alt='';i.src=m.avatar;av.appendChild(i);}else av.textContent=(m.name||'?')[0].toUpperCase();
  return d;}
function rebuild(){[...wrap.children].forEach(x=>x.remove());const s=cur(view);msgsData.slice(-s.max).forEach(m=>add(m,true));}
function add(m,re){
  const s=cur(view),stick=view!=='dock'||atLatest();
  if(m.kind==='join'){ if(view==='overlay'||!s.joins)return;
    const j=document.createElement('div');j.className='j';j.innerHTML='<span class="pl"><img src="/tt.png" alt=""></span><span></span>';j.lastChild.textContent=m.name+' baru saja bergabung';
    put(j);trim();if(stick)toLatest();return; }
  if(!re&&view==='overlay'){msgsData.push(m);if(msgsData.length>80)msgsData.shift();}
  const pf=m.p==='youtube'?'y':'t',src=m.p==='youtube'?'/yt.png':'/tt.png';
  const d=view!=='overlay'?buildStd(m,src,pf):curStruct==='p5'?buildP5(m,src,pf):curStruct==='rv'?buildRV(m,src,pf):curStruct==='cozy'?buildCozy(m,src,pf):buildStd(m,src,pf);
  put(d);trim();if(stick)toLatest();
  if(s.fade>0&&!isPrev&&!m.sample&&!re)setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),450);},s.fade*(m.sc?3:1)*1000);
}
const SAMP=[['tiktok','dewi.anggraini','kak main game apa hari ini?'],['youtube','Budi Santoso','mantap bang, gas terus!'],['youtube','Nightbot','Jangan lupa subscribe dan follow ya!',{bot:true}],['youtube','Andi Pratama','selamat datang semuanya',{mod:true}],['tiktok','rizkyy_','seru banget live-nya!!'],['youtube','Sinta_Rahma','Terima kasih banyak kak, semangat terus!',{sc:{amount:'Rp50.000',color:'#ffca28'}}]];
function samples(clear){if(clear){wrap.innerHTML='';msgsData=[];applyStyle();}SAMP.forEach((x,i)=>setTimeout(()=>add({p:x[0],name:x[1],text:x[2],t:Date.now(),sample:true,...(x[3]||{})}),i*450));}
let tmS=null;function resample(){clearTimeout(tmS);tmS=setTimeout(()=>samples(true),250);}
const live=!isAdmin&&(view==='dock'||isPrev)&&!isStatic;
function doCmd(n){
  if(n==='up')list.scrollBy({top:-list.clientHeight*.8,behavior:'smooth'});
  else if(n==='down')list.scrollBy({top:list.clientHeight*.8,behavior:'smooth'});
  else if(n==='clear'){[...wrap.children].forEach(x=>x.remove());msgsData=[];updBtn();}
  else if(n==='filter'){const o=['all','youtube','tiktok'];filt=o[(o.indexOf(filt)+1)%3];$('flt').value=filt;try{localStorage.setItem('flt',filt)}catch{};applyStyle();toLatest();}
}
// ---- pratinjau statis (dalam iframe): tanpa koneksi SSE, data dikirim induknya ----
if(isStatic){
  applyStyle();
  addEventListener('message',e=>{const d=e.data||{};
    if(d.type==='cfg'){S=copy(d.settings);S.global=S.global||{};applyStyle();resample();}
    else if(d.type==='tpldraft'){draftTpl={css:d.css};applyStyle();resample();}});
  setInterval(()=>samples(true),9000);
  parent.postMessage({type:'ready'},'*');bootDone();
}else if(!isCtl){
  if(isPrev)applyStyle();
  const es=new EventSource('/events');
  es.onmessage=e=>{const {type,data}=JSON.parse(e.data);
    if(type==='init'){S=data.settings;S.global=S.global||{};saved=copy(S);conf=data.cfg;viewers=data.viewers||{};showSt(data.status);
      if(isSet){initSettings();bootDone();return;}if(isTpl){initTpl();bootDone();return;}if(isAdd){initAdd();bootDone();return;}
      applyStyle();showViewers();
      if(isPrev){samples(true);setInterval(()=>samples(true),9000);bootDone();return;}
      const s=cur(view),lim=Date.now()-(s.fade>0?s.fade*1000:1e12);
      data.history.filter(m=>m.t>lim).slice(view==='overlay'?-s.max:-300).forEach(m=>add(m));if(view==='dock')toLatest();bootDone();}
    else if(type==='settings'){saved=copy(data);S=copy(data);S.global=S.global||{};
      if(isSet){refreshPresets();}else if(isTpl)tplOnSettings();else if(isAdd){applyUi(cur('dock'));}else{applyStyle();if(isPrev)resample();}}
    else if(type==='draft'){if(live&&data.view===view){S[view]=data.values;applyStyle();if(isPrev)resample();else if(!document.querySelector('.m'))samples(false);}
      else if((isTpl||isAdd)&&data.view==='dock')applyUi({...cur('dock'),...data.values});}
    else if(type==='draftclear'){if(live){S=copy(saved);document.querySelectorAll('.sample').forEach(x=>x.remove());applyStyle();if(isPrev)resample();}else if(isTpl||isAdd)applyUi(cur('dock'));}
    else if(type==='cmd'){if(!isAdmin&&!isPrev){if(view==='dock')doCmd(data.name);else if(data.name==='clear')doCmd('clear');}}
    else if(type==='status')showSt(data);
    else if(type==='viewers'){if(!isAdmin){viewers=data;showViewers();}}
    else if(type==='msg'){if(!isAdmin&&!isPrev)add(data);}};
}
// ---- jendela terkunci: laporkan area gelembung chat supaya hanya itu yang menerima klik saat disembunyikan dari OBS ----
if(isLocked&&!isAdmin){
  let st=null;const send=()=>{const pad=8,rs=[...document.querySelectorAll('#msgs>*,#top')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return{x:r.left-pad,y:r.top-pad,width:r.width+pad*2,height:r.height+pad*2};});post('/shape',{rects:rs});};
  const q=()=>{if(st)return;st=setTimeout(()=>{st=null;send();},120);};
  new MutationObserver(q).observe($('msgs'),{childList:true,subtree:true,characterData:true});
  addEventListener('resize',q);addEventListener('animationend',q);setInterval(send,1500);setTimeout(send,300);
}
// ---- dua kotak saat terkunci (jendela kecil terpisah) ----
if(isCtl){
  bootDone();
  const mv=$('mover');
  mv.addEventListener('pointerdown',e=>{try{mv.setPointerCapture(e.pointerId);}catch{}post('/drag',{on:true});});
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>mv.addEventListener(ev,()=>post('/drag',{on:false})));
  $('unlock').onclick=()=>post('/lock',{on:false});
  const eyeSt=async()=>{try{const r=await(await fetch('/state')).json();document.body.classList.toggle('prot',!!r.protect);$('eye').title=r.protect?'Tersembunyi dari OBS (klik untuk menampilkan)':'Terlihat di OBS (klik untuk menyembunyikan)';}catch{}};
  $('eye').onclick=async()=>{await post('/protect-toggle');eyeSt();};eyeSt();setInterval(eyeSt,1000);
}
// ---- pengaturan ----
const T=(k,l,o)=>['sel',k,l,o],C=(k,l)=>['chk',k,l],K=(k,l)=>['col',k,l],R=(k,l,a,b,u)=>['sl',k,l,a,b,u||''];
const FIELDS={
 dock:[['Tema aplikasi',[T('theme','Tampilan aplikasi',THEMES)]],
  ['Chat',[T('anim','Animasi chat masuk',ANI),T('order','Arah chat muncul',ORD)]],
  ['Ukuran & jarak',[R('fsName','Ukuran nama',10,48,'px'),R('fsText','Ukuran chat',10,48,'px'),R('gap','Jarak antar chat',0,48,'px'),R('max','Jumlah chat tersimpan (bisa di-scroll)',50,1000)]],
  ['Latar',[R('bg','Gelap latar jendela',0,100,'%'),C('chatBg','Beri latar di tiap chat'),K('chatBgColor','Warna latar chat'),R('chatBgOp','Transparansi latar chat',0,100,'%')]],
  ['Isi chat',[C('viewers','Tampilkan jumlah penonton'),C('time','Tampilkan jam'),C('joins','Notifikasi penonton bergabung'),C('botTag','Label BOT pada chat bot'),C('hideBots','Sembunyikan chat bot')]]],
 overlay:[['Gaya',[T('preset','Gaya overlay',PRE),T('align','Posisi chat di overlay',[['left','Kiri'],['right','Kanan']]),T('anim','Animasi chat masuk',[['auto','Otomatis (ikuti gaya)'],...ANI]),T('order','Arah chat muncul',ORD)]],
  ['Ukuran & jarak',[R('fsName','Ukuran nama',10,60,'px'),R('fsText','Ukuran chat',10,60,'px'),R('gap','Jarak antar chat',0,48,'px'),R('max','Jumlah pesan maksimal',3,30),R('fade','Pesan hilang setelah (0 = tidak hilang)',0,120,'detik')]],
  ['Latar',[R('bg','Gelap latar',0,100,'%'),C('chatBg','Beri latar di tiap chat (gaya Polos/Retro/buatanmu)'),K('chatBgColor','Warna latar chat'),R('chatBgOp','Transparansi latar chat',0,100,'%')]],
  ['Isi chat',[C('viewers','Tampilkan jumlah penonton'),C('time','Tampilkan jam'),C('avatar','Foto profil (gaya Kartu)'),C('botTag','Label BOT pada chat bot'),C('hideBots','Sembunyikan chat bot')]]]};
const BOX={dock:'pp_b',overlay:'po_b'};
const items=v=>FIELDS[v].flatMap(g=>g[1]);
if(isSet)for(const v in FIELDS){let h='';
  FIELDS[v].forEach(([t,its])=>{h+='<div class="card"><h3>'+t+'</h3>';
    its.forEach(([ty,k,l,a,b,u])=>{const id=v+'_'+k;
      if(ty==='sel'){const opts='<select id="'+id+'">'+a.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select>';
        h+='<label><span>'+l+'</span></label>'+(k==='preset'?'<div class="selrow">'+opts+'<button class="btn b3 sm" id="tplMng">Kelola</button></div>':opts);}
      else if(ty==='chk')h+='<div class="row"><span>'+l+'</span><input type="checkbox" id="'+id+'"></div>';
      else if(ty==='col')h+='<div class="row"><span>'+l+'</span><input type="color" id="'+id+'" style="width:44px;height:28px;padding:0;border:0;background:none"></div>';
      else h+='<label><span>'+l+'</span><b id="'+v+'_v_'+k+'"></b></label><input type="range" id="'+id+'" min="'+a+'" max="'+b+'">';});
    h+='</div>';});
  $(BOX[v]).innerHTML=h;}
function lbl(v,it){const e=$(v+'_'+it[1]),el=$(v+'_v_'+it[1]);if(!e)return;if(el)el.textContent=e.value+(it[5]?' '+it[5]:'');e.style.setProperty('--pct',((e.value-e.min)/(e.max-e.min)*100)+'%');}
function refreshPresets(){const sel=$('overlay_preset');if(!sel)return;const keep=sel.value;
  const all=[...PRE,...customs().map(t=>[t.id,t.name])];
  sel.innerHTML=all.map(x=>'<option value="'+x[0]+'">'+x[1].replace(/</g,'&lt;')+'</option>').join('');
  sel.value=all.some(x=>x[0]===keep)?keep:(all.some(x=>x[0]===cur('overlay').preset)?cur('overlay').preset:'polos');}
function fill(v,src){const s=src||cur(v);if(v==='overlay')refreshPresets();
  items(v).forEach(it=>{const e=$(v+'_'+it[1]);if(it[0]==='chk')e.checked=!!s[it[1]];else e.value=s[it[1]];if(it[0]==='sl')lbl(v,it);});}
function fillGlobal(){const g=S.global||{};$('protect').checked=g.protect!==false;$('ctrlPos').value=g.ctrlPos||'top-right';$('obsW').value=g.obsW||500;$('obsH').value=g.obsH||900;$('obsPass').value=g.obsPass||'';$('botNames').value=g.botNames||'';}
function collect(v){const o={};items(v).forEach(it=>{const e=$(v+'_'+it[1]);o[it[1]]=it[0]==='chk'?e.checked:(it[0]==='sl'?+e.value:e.value);});return o;}
let dt=null;
function draftChange(v){items(v).filter(i=>i[0]==='sl').forEach(i=>lbl(v,i));if(v==='dock')applyUi(collect('dock'));clearTimeout(dt);dt=setTimeout(()=>post('/draft',{view:v,values:collect(v)}),40);}
if(isSet)['dock','overlay'].forEach(v=>{$(BOX[v]).addEventListener('input',()=>draftChange(v));});
function setTab(t){curTab=t;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.dataset.t===t));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id==='p'+t));}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>setTab(t.dataset.t));
document.querySelectorAll('[data-apply]').forEach(b=>b.onclick=async()=>{const v=b.dataset.apply;await post('/settings',{view:v,values:collect(v)});
  if(v==='dock')await post('/settings',{view:'global',values:{protect:$('protect').checked,ctrlPos:$('ctrlPos').value}});
  else await post('/settings',{view:'global',values:{obsW:+$('obsW').value||500,obsH:+$('obsH').value||900,obsPass:$('obsPass').value}});});
document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{const v=b.dataset.reset;fill(v,DEF[v]);if(v==='dock'){$('protect').checked=true;$('ctrlPos').value='top-right';}draftChange(v);});
// akun
async function acct(){try{const a=await(await fetch('/account')).json();accState=a;
  [['ay',a.youtube],['at',a.tiktok]].forEach(([i,ok])=>{$(i).textContent=ok?'terhubung':'belum terhubung';$(i).className=ok?'ok':'no';});}catch{}}
const copyText=async t=>{try{await navigator.clipboard.writeText(t);}catch{try{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}catch{}}};
// hotkey
const HK_DEF={lock:'Ctrl+Alt+L',hide:'Ctrl+Alt+H',obs:'Ctrl+Alt+O',up:'Ctrl+Alt+PageUp',down:'Ctrl+Alt+PageDown',clear:'Ctrl+Alt+C',filter:'Ctrl+Alt+F',settings:'Ctrl+Alt+S'};
const HK_LBL={lock:'Kunci / buka kunci jendela',hide:'Sembunyikan / tampilkan jendela',obs:'Sembunyikan dari OBS (on/off)',up:'Gulir chat ke atas',down:'Gulir chat ke bawah',clear:'Bersihkan chat',filter:'Ganti filter (Semua / YouTube / TikTok)',settings:'Buka pengaturan'};
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
$('conn').onclick=()=>post('/connect',{youtube:$('yt').value,tiktok:$('tk').value});
$('disc').onclick=()=>post('/disconnect');
$('sbot').onclick=()=>post('/settings',{view:'global',values:{botNames:$('botNames').value}});
$('oe').onclick=()=>openC('ext');$('oy').onclick=()=>openC('youtube');$('ot').onclick=()=>openC('tiktok');
$('cx').onclick=()=>{copyText('chrome://extensions');$('cx').textContent='Disalin';setTimeout(()=>$('cx').textContent='Salin alamat chrome://extensions',1500);};
$('cy').onclick=async()=>{const u=(await(await fetch('/urls')).json()).youtube;if(!u)return alert('Isi username YouTube dulu di bagian Sambungkan live.');copyText(u);$('cy').textContent='Disalin';setTimeout(()=>$('cy').textContent='Salin alamat YouTube',1500);};
$('ct').onclick=async()=>{const u=(await(await fetch('/urls')).json()).tiktok;if(!u)return alert('Isi username TikTok dulu di bagian Sambungkan live.');copyText(u);$('ct').textContent='Disalin';setTimeout(()=>$('ct').textContent='Salin alamat TikTok',1500);};
$('prev').onclick=()=>openC('preview');$('tplMng').onclick=()=>openC('templates');
$('test').onclick=()=>post('/test');
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
$('u2').onclick=()=>{$('u2').select();try{document.execCommand('copy')}catch{}};
$('obsadd').onclick=async()=>{const m=$('obsmsg');m.className='hint';m.textContent='Menghubungi OBS...';
  const r=await(await post('/obs-add',{width:+$('obsW').value||500,height:+$('obsH').value||900,password:$('obsPass').value})).json();
  if(r.error){m.className='hint no';m.textContent='Gagal: '+r.error;}else{m.className='hint ok';m.textContent='Berhasil. Overlay sudah ada di scene OBS yang sedang aktif (nama sumber: ChatLivestream Overlay).';}};
}
function initSettings(){fill('dock');fill('overlay');fillGlobal();applyUi(cur('dock'));$('yt').value=conf.youtube||'';$('tk').value=conf.tiktok||'';$('u2').value=location.origin+'/?view=overlay';showPort();
  hk={...HK_DEF,...((S.global&&S.global.hotkeys)||{})};hkRender();setTab('k');acct();setInterval(acct,3000);
  addEventListener('beforeunload',()=>{fetch('/draft-clear',{method:'POST',body:'{}',keepalive:true});});}
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

<div class="m msg y yt" data-platform="youtube">   <!-- TikTok: class "t tt". Bot: .isbot, moderator: .ismod, pemilik: .isown -->
  <span class="pl logo"><img src="logo-platform.png"></span>   <!-- logo platform -->
  <div class="av avatar"></div>                                  <!-- foto profil (background-image) -->
  <div class="body">
    <div class="hd head">
      <span class="tag"><img class="pi" src="logo-platform.png"><b class="nm name"><i>R</i><i>I</i><i>O</i></b></span>  <!-- nama, tiap huruf dibungkus <i> -->
      <span class="tm time">20:45</span>
      <span class="bd bot">BOT</span><span class="bd mod">MOD</span><span class="bd own">OWNER</span>
    </div>
    <div class="tx text message"><span>isi chat</span></div>
  </div>
</div>

Wadah semua chat: <div id="msgs"> di dalam <div id="list"> (list = area overlay penuh). Chat terbaru ada di bawah.
Variabel yang boleh dipakai: --fsn (ukuran nama), --fst (ukuran chat), --gap (jarak antar chat).
Platform: .y / .yt = YouTube (merah), .t / .tt = TikTok (cyan dan pink).
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
$('gear').onclick=()=>post('/settings-window');
$('lock').onclick=()=>post('/lock',{on:true});
$('flt').value=filt;
$('flt').onchange=()=>{filt=$('flt').value;try{localStorage.setItem('flt',filt)}catch{};applyStyle();toLatest();};
function flash(m){const i=$('msg');if(!i.dataset.ph)i.dataset.ph=i.placeholder;i.classList.add('err');i.placeholder=m;clearTimeout(flash.t);flash.t=setTimeout(()=>{i.classList.remove('err');i.placeholder=i.dataset.ph;},4500);}
async function doSend(){
  const text=$('msg').value.trim();if(!text)return;
  const nm={youtube:'YouTube',tiktok:'TikTok'},targets=filt==='all'?['youtube','tiktok']:[filt];
  $('send').disabled=true;
  try{const r=await(await post('/send',{text,targets})).json();
    if(r.error)flash('Gagal: '+r.error);
    else{const okk=targets.filter(k=>r[k]==='ok'),bad=targets.filter(k=>r[k]!==undefined&&r[k]!=='ok'&&!/^belum login/.test(r[k]||'')),nolog=targets.filter(k=>/^belum login/.test(r[k]||''));
      if(okk.length)$('msg').value='';
      if(bad.length)flash(bad.map(k=>nm[k]+': '+r[k]).join(' | '));
      else if(!okk.length&&nolog.length)flash('Belum masuk akun. Buka Pengaturan > Koneksi > Akun.');}
  }catch(e){flash('Gagal: '+e.message);}
  $('send').disabled=false;$('msg').focus();}
$('send').onclick=doSend;$('msg').onkeydown=e=>{if(e.key==='Enter')doSend();};
}
