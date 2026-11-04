// Statistik sesi live (untuk jendela "Laporan penonton").
// Satu sesi = rentang waktu sejak data pertama masuk sampai pengguna menekan "Sesi baru", aplikasi ditutup,
// atau 30 menit tidak ada data penonton sama sekali. Sesi lama disimpan di analytics.json (maks 20).
// "Penonton" di sini SELALU penonton yang sedang menonton saat itu (bukan kumulatif); puncak = nilai tertinggi dari sampel.
const fs=require('fs');
const MAXS=20,IDLE=30*60e3,MAXSAMP=5000;

function parseAmount(a){
  a=String(a==null?'':a).trim();
  const m=a.match(/\d[\d.,\s]*/);if(!m)return{cur:a||'?',val:0};
  const num=m[0].replace(/\s/g,'').replace(/[.,]+$/,'');
  const cur=a.replace(m[0],'').replace(/\s+/g,' ').trim()||'?';
  const dots=(num.match(/\./g)||[]).length,commas=(num.match(/,/g)||[]).length;let v;
  if(dots&&commas){const dec=num.lastIndexOf('.')>num.lastIndexOf(',')?'.':',',th=dec==='.'?',':'.';v=parseFloat(num.split(th).join('').replace(dec,'.'));}
  else if(dots||commas){const sep=dots?'.':',',parts=num.split(sep);
    v=(dots+commas>1||(parts[1]&&parts[1].length===3))?parseFloat(parts.join('')):parseFloat(parts.join('.'));}
  else v=parseFloat(num);
  return{cur,val:isFinite(v)?v:0};
}
const topN=(map,n,f)=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,n).map(f);

module.exports=function makeStats(file){
  let sessions=[],cur=null,lastData=0,dirty=false,saveT=null;
  try{const j=JSON.parse(fs.readFileSync(file,'utf8'));sessions=Array.isArray(j.sessions)?j.sessions:[];
    if(j.live)sessions.unshift(j.live);}catch{}
  sessions.forEach(s=>{if(!s.end){const l=s.s&&s.s.length?s.s[s.s.length-1][0]:s.start;s.end=Math.max(l,s.start);}});

  const fresh=()=>({id:String(Date.now()),start:Date.now(),end:null,s:[],c:{y:0,t:0,w:0,k:0},cpm:{},
    users:{y:new Map(),t:new Map(),w:new Map(),k:new Map()},gm:new Map(),o:{},
    sc:{n:0,tot:{},list:[],stk:0},g:{n:0,coins:0},l:0,f:0,sh:0,j:0,sb:0,mem:0});
  const ensure=()=>{if(!cur){cur=fresh();dirty=true;}lastData=Date.now();return cur;};

  // salinan JSON murni (tanpa Map) untuk disimpan / dibuat laporan
  function snap(s){
    return{id:s.id,start:s.start,end:s.end,s:s.s,c:s.c,cpm:s.cpm,
      u:s.users?{y:s.users.y.size,t:s.users.t.size,w:s.users.w.size,k:s.users.k.size}:s.u,
      top:s.users?['y','t','w','k'].flatMap(k=>topN(s.users[k],15,x=>[x[0],k,x[1]])):s.top,
      gt:s.gm?[...s.gm].sort((a,b)=>b[1].c-a[1].c).slice(0,10).map(x=>[x[0],x[1].c,x[1].n]):s.gt,
      sc:{n:s.sc.n,tot:s.sc.tot,list:s.sc.list.slice(0,200),stk:s.sc.stk},g:s.g,l:s.l,f:s.f,sh:s.sh,j:s.j,sb:s.sb,mem:s.mem,o:s.o};
  }
  function save(){
    dirty=false;
    try{fs.writeFileSync(file,JSON.stringify({sessions,live:cur?snap(cur):null}));}catch{}
  }
  const touch=()=>{dirty=true;if(!saveT){saveT=setTimeout(()=>{saveT=null;if(dirty)save();},60000);}};

  function end(){
    if(!cur)return;
    cur.end=Date.now();sessions.unshift(snap(cur));sessions.length=Math.min(sessions.length,MAXS);cur=null;save();
  }
  const nn=x=>x==null?null:x;
  function tick(yt,tt,tw,kk){
    const now=Date.now();
    if(yt==null&&tt==null&&tw==null&&kk==null){if(cur&&now-lastData>IDLE)end();return;}
    const s=ensure();
    s.s.push([now,nn(yt),nn(tt),nn(tw),nn(kk)]);
    if(s.s.length>MAXSAMP)s.s=s.s.filter((_,i)=>i%2===0);
    touch();
  }
  // pesan chat / aktivitas yang sudah lewat push() di server
  function add(m){
    if(m.test)return;
    const s=ensure(),k=({youtube:'y',tiktok:'t',twitch:'w',kick:'k'})[m.p]||'t';
    if(!s.o)s.o={};if(s.c.w==null){s.c.w=0;s.c.k=0;s.users.w=s.users.w||new Map();s.users.k=s.users.k||new Map();}
    const oc=(key,n)=>{s.o[key]=(s.o[key]||0)+(n==null?1:n);};
    if(m.p==='twitch'||m.p==='kick'){
      const q=k;
      if(!m.kind){
        s.c[q]++;const u=s.users[q];u.set(m.name,(u.get(m.name)||0)+1);
        const mi=Math.floor((Date.now()-s.start)/60000);s.cpm[mi]=(s.cpm[mi]||0)+1;
        if(m.member)oc(q+'.mem');
        if(m.sc){oc(q+'.sc');oc(q+'.scN',m.sc.bits||m.sc.kicks||0);}
      }else{oc(q+'.'+m.kind);if(m.kind==='gift'||m.kind==='raid')oc(q+'.'+m.kind+'N',m.n||1);}
      touch();return;
    }
    if(!m.kind){
      s.c[k]++;const u=s.users[k];u.set(m.name,(u.get(m.name)||0)+1);
      const mi=Math.floor((Date.now()-s.start)/60000);s.cpm[mi]=(s.cpm[mi]||0)+1;
      if(m.member)s.mem++;
      if(m.sticker)s.sc.stk++;
      if(m.sc){
        const a=parseAmount(m.sc.amount);s.sc.n++;s.sc.tot[a.cur]=(s.sc.tot[a.cur]||0)+a.val;
        s.sc.list.push({name:m.name,amount:m.sc.amount,cur:a.cur,val:a.val,t:Date.now(),stk:!!m.sticker});
        s.sc.list.sort((x,y)=>y.val-x.val);if(s.sc.list.length>200)s.sc.list.length=200;
      }
    }else if(m.kind==='join')s.j++;
    else if(m.kind==='follow')s.f++;
    else if(m.kind==='share')s.sh++;
    else if(m.kind==='sub')s.sb++;
    else if(m.kind==='gift'){const n=m.n||1,c=m.coins||0;s.g.n+=n;s.g.coins+=c;
      const o=s.gm.get(m.name)||{c:0,n:0};o.c+=c;o.n+=n;s.gm.set(m.name,o);}
    touch();
  }
  const like=n=>{ensure().l+=n;touch();};

  const totOf=r=>(r[1]==null&&r[2]==null&&r[3]==null&&r[4]==null)?null:(r[1]||0)+(r[2]||0)+(r[3]||0)+(r[4]||0);
  function build(sn,live,now){
    const t0=sn.start,t1=sn.end||now,dur=Math.max(0,t1-t0),S=sn.s||[];
    const stat=idx=>{
      let sum=0,n=0,mx=null,mn=null,first=null,last=null;
      for(const r of S){const v=idx===0?totOf(r):r[idx];if(v==null)continue;
        sum+=v;n++;if(!mx||v>mx.v)mx={v,t:r[0],min:Math.round((r[0]-t0)/60000)};
        if(!mn||v<mn.v)mn={v,t:r[0],min:Math.round((r[0]-t0)/60000)};
        if(first==null)first=r[0];last=r[0];}
      return{avg:n?Math.round(sum/n):null,peak:mx,low:mn,online:first==null?0:last-first,n};
    };
    // seri untuk grafik (maks ~400 titik, rata-rata per kelompok)
    const step=Math.max(1,Math.ceil(S.length/400)),series=[];
    for(let i=0;i<S.length;i+=step){const g=S.slice(i,i+step);
      const av=j=>{const a=g.map(r=>r[j]).filter(x=>x!=null);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;};
      series.push([g[0][0],av(1),av(2),av(3),av(4)]);}
    // tabel per interval
    const mins=dur/60000,size=[1,2,5,10,15,30,60,120].find(b=>mins/b<=12)||240,blocks=[];
    for(let b=0;b*size<=mins&&blocks.length<40;b++){
      const a=t0+b*size*60000,z=a+size*60000,rows=S.filter(r=>r[0]>=a&&r[0]<z).map(totOf).filter(x=>x!=null);
      let chat=0;for(let m=b*size;m<(b+1)*size;m++)chat+=sn.cpm[m]||0;
      blocks.push({from:b*size,to:(b+1)*size,at:a,avg:rows.length?Math.round(rows.reduce((x,y)=>x+y,0)/rows.length):null,peak:rows.length?Math.max(...rows):null,chat});
    }
    let pc=null;for(const k in sn.cpm)if(!pc||sn.cpm[k]>pc.v)pc={v:sn.cpm[k],min:+k,t:t0+k*60000};
    const c=sn.c,u=sn.u,chatTot=c.y+c.t+(c.w||0)+(c.k||0),o=sn.o||{};
    const per=p=>sn.top.filter(x=>x[1]===p).sort((a,b)=>b[2]-a[2]).slice(0,10).map(x=>({name:x[0],n:x[2]}));
    return{id:sn.id,start:t0,end:sn.end,live,dur,now:live?live:null,series,blocks,block:size,
      total:stat(0),yt:stat(1),tt:stat(2),tw:stat(3),kk:stat(4),
      chat:{total:chatTot,y:c.y,t:c.t,w:c.w||0,k:c.k||0,uy:u.y,ut:u.t,uw:u.w||0,uk:u.k||0,perMin:mins>=1?+(chatTot/mins).toFixed(1):chatTot,peak:pc,topY:per('y'),topT:per('t'),topW:per('w'),topK:per('k')},
      twitch:{subs:o['w.sub']||0,gifts:o['w.gift']||0,giftSubs:o['w.giftN']||0,raids:o['w.raid']||0,raiders:o['w.raidN']||0,bits:o['w.scN']||0,bitMsgs:o['w.sc']||0,announces:o['w.announce']||0,firsts:o['w.first']||0,subChat:o['w.mem']||0},
      kick:{subs:o['k.sub']||0,gifts:o['k.gift']||0,giftSubs:o['k.giftN']||0,follows:o['k.follow']||0,raids:o['k.raid']||0,raiders:o['k.raidN']||0,rewards:o['k.reward']||0,kicks:o['k.scN']||0,kickMsgs:o['k.sc']||0,subChat:o['k.mem']||0},
      tiktok:{gifts:sn.g.n,coins:sn.g.coins,likes:sn.l,follows:sn.f,shares:sn.sh,joins:sn.j,subs:sn.sb,gifters:(sn.gt||[]).map(x=>({name:x[0],coins:x[1],n:x[2]}))},
      youtube:{sc:sn.sc.n,totals:Object.entries(sn.sc.tot).map(([cur,sum])=>({cur,sum})),top:sn.sc.list.slice(0,5),stickers:sn.sc.stk,members:sn.mem}};
  }
  function list(){
    const out=[];
    if(cur)out.push({id:cur.id,start:cur.start,end:null,live:true,peak:build(snap(cur),null,Date.now()).total.peak});
    for(const s of sessions)out.push({id:s.id,start:s.start,end:s.end,live:false,peak:build(s,null,s.end).total.peak});
    return out;
  }
  function get(id,nowV){
    const now=Date.now();let rep=null;
    if(cur&&(id==='cur'||id===cur.id))rep=build(snap(cur),{yt:nowV.youtube,tt:nowV.tiktok,tw:nowV.twitch,kk:nowV.kick},now);
    else{const s=sessions.find(x=>x.id===id)||(id==='cur'?sessions[0]:null);if(s)rep=build(s,null,s.end);}
    return{list:list(),report:rep};
  }
  const remove=id=>{const i=sessions.findIndex(x=>x.id===id);if(i>=0){sessions.splice(i,1);save();}};
  return{add,like,tick,end,get,remove,flush:save,active:()=>!!cur,parseAmount};
};
