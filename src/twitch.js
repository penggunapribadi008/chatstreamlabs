// Login resmi Twitch (Device Code Grant: aplikasi publik, TANPA client secret) + kirim chat lewat Helix "Send Chat Message".
// Dokumen: dev.twitch.tv/docs/authentication/getting-tokens-oauth (device code grant flow) dan dev.twitch.tv/docs/api/reference#send-chat-message
// Murni (tanpa electron/fs): fetch, penyimpan token, pembuka browser, dan jam disuntik dari luar supaya bisa diuji dengan mock.
const SCOPE='user:write:chat',DEV='urn:ietf:params:oauth:grant-type:device_code';
exports.create=function(o){
  const F=o.fetch||globalThis.fetch,OAUTH=o.oauth||'https://id.twitch.tv/oauth2',API=o.api||'https://api.twitch.tv/helix',store=o.store,
    channel=o.channel||(()=>''),open=o.open||(()=>{}),log=o.log||(()=>{}),now=o.now||Date.now,
    sleep=o.sleep||(ms=>new Promise(r=>setTimeout(r,ms).unref())),clientId=()=>String(o.clientId||'');
  const configured=()=>!!clientId()&&!/^ISI_/.test(clientId());
  let tok,loaded=false,pending=null,err='',gen=0,refreshing=null;const bids={};
  const load=()=>{if(!loaded){loaded=true;tok=store.get('twitch')||null;}return tok;};
  const save=t=>{tok=t;loaded=true;return store.set('twitch',t);};
  const drop=msg=>{tok=null;loaded=true;store.del('twitch');if(msg)err=msg;};
  // POST form (OAuth); hasil {ok,status,j}. Melempar kalau jaringan gagal / timeout.
  const form=async(path,p)=>{const r=await F(OAUTH+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(p),signal:AbortSignal.timeout(10000)});let j={};try{j=await r.json();}catch{}return{ok:r.ok,status:r.status,j};};
  const api=async(method,path,access,body)=>{const r=await F(API+path,{method,headers:{Authorization:'Bearer '+access,'Client-Id':clientId(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});let j={};try{j=await r.json();}catch{}return{ok:r.ok,status:r.status,j};};
  const apply=(j,prev)=>({access:j.access_token,refresh:j.refresh_token||(prev&&prev.refresh)||'',exp:now()+(Number(j.expires_in)||14400)*1000,id:prev&&prev.id,login:prev&&prev.login,name:prev&&prev.name});
  const state=()=>{const t=load();return{configured:configured(),loggedIn:!!t,name:t?(t.name||t.login||''):'',pending:pending?{code:pending.code}:null,error:err,memOnly:!!t&&!store.can()};};
  // Token access 4 jam; refresh token SEKALI PAKAI (yang baru wajib langsung disimpan) dan mati 30 hari tanpa pemakaian. Satu proses refresh saja pada satu waktu.
  function refresh(){
    if(refreshing)return refreshing;
    return refreshing=(async()=>{try{
      const t=load();if(!t||!t.refresh)return false;
      const r=await form('/token',{client_id:clientId(),grant_type:'refresh_token',refresh_token:t.refresh});
      if(r.ok&&r.j.access_token){save(apply(r.j,t));return true;}
      if(r.status===400||r.status===401){log('twitch: refresh ditolak ('+(r.j.message||r.status)+')');drop('Sesi Twitch habis. Tekan Masuk lagi ya.');}
      return false;}catch{return false;}finally{refreshing=null;}})();}
  async function access(){const t=load();if(!t)return '';if(t.exp-now()<60000&&!await refresh())return '';return(load()||{}).access||'';}
  async function finish(j){
    const u=await api('GET','/users',j.access_token);const d=u.ok&&u.j.data&&u.j.data[0];
    if(!d){err='Berhasil masuk, tapi gagal membaca nama akun Twitch. Coba lagi.';return;}
    const saved=save({...apply(j),id:d.id,login:d.login,name:d.display_name||d.login});
    err='';log('twitch: masuk'+(saved?'':' (token tidak disimpan: penyimpanan aman tidak tersedia)'));}
  async function poll(my,dc,iv,until){
    while(my===gen&&now()<until){
      await sleep(iv*1000);if(my!==gen)return;
      let r;try{r=await form('/token',{client_id:clientId(),scopes:SCOPE,device_code:dc,grant_type:DEV});}catch{continue;}
      if(my!==gen)return;
      if(r.ok&&r.j.access_token){pending=null;try{await finish(r.j);}catch{err='Gagal menyelesaikan login Twitch. Coba lagi.';}return;}
      const m=String(r.j.message||r.j.error||'');
      if(m==='authorization_pending')continue;
      if(/slow_down/i.test(m)){iv+=5;continue;}
      pending=null;err=/denied/i.test(m)?'Izin dibatalkan di Twitch. Tekan Masuk lagi kalau mau coba lagi.':'Gagal masuk ke Twitch ('+m+'). Tekan Masuk lagi.';return;}
    if(my===gen){pending=null;err='Kodenya kedaluwarsa. Tekan Masuk lagi.';}}
  async function login(){
    if(!configured())return{error:'Login Twitch belum disiapkan di aplikasi ini (Client ID belum diisi oleh pembuatnya).'};
    if(pending)return state();
    err='';let r;
    try{r=await form('/device',{client_id:clientId(),scopes:SCOPE});}catch{return{error:'Tidak bisa menghubungi Twitch. Cek koneksi internetmu lalu coba lagi.'};}
    if(!r.ok||!r.j.device_code||!r.j.user_code)return{error:'Twitch menolak permintaan masuk'+(r.j.message?' ('+r.j.message+')':'')+'. Pastikan aplikasi Twitch-nya didaftarkan sebagai tipe Public.'};
    const my=++gen,iv=Math.max(1,Number(r.j.interval)||5);
    pending={code:String(r.j.user_code)};
    // hanya buka halaman milik Twitch (alamat datang dari jaringan, jangan dibuka sembarangan)
    if(/^https:\/\/([\w-]+\.)?twitch\.tv\//i.test(String(r.j.verification_uri||'')))try{open(String(r.j.verification_uri));}catch{}
    poll(my,String(r.j.device_code),iv,now()+(Number(r.j.expires_in)||1800)*1000);
    return state();}
  async function logout(){
    gen++;pending=null;err='';const t=load();
    if(t&&t.access)try{await form('/revoke',{client_id:clientId(),token:t.access});}catch{} // best-effort
    drop('');return state();}
  async function bid(login){
    if(bids[login])return bids[login];
    const t=await access();const r=await api('GET','/users?login='+encodeURIComponent(login),t);
    const d=r.ok&&r.j.data&&r.j.data[0];return d?(bids[login]=d.id):'';}
  // Hasil: {ok:true} | {skip:true} (tidak dicoba: belum masuk / username belum diisi) | {fail:'pesan'} (boleh jatuh ke ekstensi)
  //        | {fail,final:true} (tidak diketahui apakah terkirim: JANGAN kirim ulang lewat ekstensi, nanti dobel)
  async function send(text){
    const ch=channel();if(!ch||!load())return{skip:true};
    try{
      let a=await access();if(!a)return{fail:(err||'Sesi Twitch habis')};
      const b=await bid(ch);if(!b)return{fail:'channel Twitch "'+ch+'" tidak ditemukan'};
      const post=tk=>api('POST','/chat/messages',tk,{broadcaster_id:b,sender_id:load().id,message:text});
      let r=await post(a);
      if(r.status===401){const t=load();if(t){t.exp=0;}a=await access();if(!a)return{fail:err||'Sesi Twitch habis'};r=await post(a);}
      const d=r.ok&&r.j.data&&r.j.data[0];
      if(d&&d.is_sent)return{ok:true};
      if(d)return{fail:(d.drop_reason&&d.drop_reason.message)||'Twitch menolak pesan'};
      return{fail:'Twitch: '+(r.j.message||('error '+r.status))};
    }catch(e){
      if(e&&e.name==='TimeoutError')return{fail:'Twitch tidak merespons',final:true};
      return{fail:'tidak bisa menghubungi Twitch'};}}
  return{state,login,logout,send,configured};
};
