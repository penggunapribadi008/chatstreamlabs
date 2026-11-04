// Pengurai pesan Twitch (IRC) dan Kick (Pusher) menjadi pesan ChatStream.
// Semua fungsi di sini MURNI (tanpa jaringan), supaya bisa diuji tanpa koneksi sungguhan (lihat test/smoke.js).
// Hasilnya adalah array objek yang langsung bisa dikirim ke push() di server.js.

// ---------- Twitch (IRC lewat WebSocket, tanpa login) ----------
const unesc = v => String(v == null ? '' : v).replace(/\\(.)/g, (_, c) => ({ s: ' ', ':': ';', r: '\r', n: '\n', '\\': '\\' }[c] ?? c));

// "@tag=nilai;... :nick!nick@nick.tmi.twitch.tv PRIVMSG #kanal :isi pesan"
function parseIrc(line) {
  line = String(line || '').replace(/[\r\n]+$/, '');
  if (!line) return null;
  const o = { tags: {}, prefix: '', cmd: '', params: [], trailing: '' };
  let i = 0;
  if (line[0] === '@') {
    const e = line.indexOf(' ');
    line.slice(1, e).split(';').forEach(t => { const k = t.indexOf('='); if (k < 0) o.tags[t] = ''; else o.tags[t.slice(0, k)] = unesc(t.slice(k + 1)); });
    i = e + 1;
  }
  if (line[i] === ':') { const e = line.indexOf(' ', i); o.prefix = line.slice(i + 1, e); i = e + 1; }
  const t = line.indexOf(' :', i);
  const head = t < 0 ? line.slice(i) : line.slice(i, t);
  if (t >= 0) o.trailing = line.slice(t + 2);
  const p = head.split(' ').filter(Boolean);
  o.cmd = p.shift() || '';
  o.params = p;
  return o;
}

// warna sorotan Bits mengikuti tingkatan resmi Twitch
const bitColor = n => n >= 10000 ? '#f43021' : n >= 5000 ? '#0099fe' : n >= 1000 ? '#1db2a5' : n >= 100 ? '#9c3ee8' : '#979797';
const TW_EMOTE = id => 'https://static-cdn.jtvnw.net/emoticons/v2/' + id + '/default/dark/2.0';

// Hapus token cheermote ("Cheer100", "Kappa50") dari teks, tapi HANYA kalau jumlah angkanya sama persis dengan Bits
// yang dikirim (supaya kata biasa seperti "gg2" tidak ikut terhapus). Posisi emote ikut digeser.
// text: string; ranges: [[mulai,akhir,url]] dalam hitungan code point; hasil: {text, emo}
function cleanText(text, ranges, bits) {
  const cps = Array.from(text), keep = cps.map(() => true);
  if (bits > 0) {
    const toks = []; let s = -1;
    for (let k = 0; k <= cps.length; k++) {
      const sp = k === cps.length || cps[k] === ' ';
      if (!sp && s < 0) s = k;
      if (sp && s >= 0) { toks.push([s, k]); s = -1; }
    }
    const cand = toks.filter(([a, b]) => /^[A-Za-z]+\d+$/.test(cps.slice(a, b).join('')));
    const sum = cand.reduce((t, [a, b]) => t + parseInt(cps.slice(a, b).join('').match(/\d+$/)[0], 10), 0);
    if (cand.length && sum === bits) cand.forEach(([a, b]) => { for (let k = a; k < Math.min(cps.length, b + 1); k++) keep[k] = false; });
  }
  const map = []; let n = 0;
  cps.forEach((_, k) => { map[k] = n; if (keep[k]) n++; });
  map[cps.length] = n;
  const emo = [];
  (ranges || []).forEach(([a, b, u]) => { if (keep[a]) emo.push([map[a], map[a] + (b - a + 1), u]); });
  return { text: cps.filter((_, k) => keep[k]).join('').replace(/\s+$/, ''), emo };
}

// tags.emotes = "25:0-4,6-10/1902:12-16"
function twEmotes(tag) {
  const out = [];
  String(tag || '').split('/').forEach(g => {
    const [id, pos] = g.split(':'); if (!id || !pos) return;
    pos.split(',').forEach(r => { const [a, b] = r.split('-').map(Number); if (Number.isFinite(a) && Number.isFinite(b)) out.push([a, b, TW_EMOTE(id)]); });
  });
  return out.sort((x, y) => x[0] - y[0]);
}

const badgeSet = tag => new Set(String(tag || '').split(',').map(b => b.split('/')[0]).filter(Boolean));

// Satu baris IRC -> daftar pesan ChatStream (biasanya 0 atau 1)
function twitchLine(line) {
  const m = typeof line === 'string' ? parseIrc(line) : line;
  if (!m) return [];
  const T = m.tags, who = T['display-name'] || (m.prefix.split('!')[0]) || '?';
  if (m.cmd === 'PRIVMSG') {
    let text = m.trailing, me = false;
    const a = text.match(/^\u0001ACTION ([\s\S]*?)\u0001?$/);
    if (a) { text = a[1]; me = true; }
    const bits = parseInt(T.bits, 10) || 0, b = badgeSet(T.badges);
    const c = cleanText(text, twEmotes(T.emotes), bits);
    const out = [];
    if (T['first-msg'] === '1') out.push({ p: 'twitch', kind: 'first', name: who });
    out.push({
      p: 'twitch', name: who, text: c.text, emo: c.emo.length ? c.emo : undefined, me: me || undefined,
      owner: b.has('broadcaster'), mod: b.has('moderator'), vip: b.has('vip'), member: b.has('subscriber') || b.has('founder'),
      sc: bits ? { amount: bits.toLocaleString('id-ID') + ' bits', color: bitColor(bits), bits } : undefined,
      hl: T['msg-id'] === 'highlighted-message' || undefined
    });
    return out;
  }
  if (m.cmd === 'USERNOTICE') {
    const id = T['msg-id'], plan = T['msg-param-sub-plan'] || '';
    if (id === 'sub' || id === 'resub') return [{ p: 'twitch', kind: 'sub', name: who, plan, months: parseInt(T['msg-param-cumulative-months'], 10) || 1, text: m.trailing || undefined }];
    // subgift yang bagian dari hadiah massal sudah dihitung oleh submysterygift (hindari banjir baris)
    if (id === 'subgift') return T['msg-param-community-gift-id'] ? [] : [{ p: 'twitch', kind: 'gift', name: who, n: 1, plan, to: T['msg-param-recipient-display-name'] || '' }];
    if (id === 'submysterygift') return [{ p: 'twitch', kind: 'gift', name: who, n: parseInt(T['msg-param-mass-gift-count'], 10) || 1, plan }];
    if (id === 'raid') return [{ p: 'twitch', kind: 'raid', name: T['msg-param-displayName'] || T['msg-param-login'] || who, n: parseInt(T['msg-param-viewerCount'], 10) || 0 }];
    if (id === 'announcement') return [{ p: 'twitch', kind: 'announce', name: who, text: m.trailing, color: T['msg-param-color'] || '' }];
    if (id === 'ritual' && T['msg-param-ritual-name'] === 'new_chatter') return [{ p: 'twitch', kind: 'first', name: who }];
  }
  return [];
}

// ---------- Kick (Pusher WebSocket) ----------
// konten chat Kick memuat emote sebagai "[emote:37226:KEKW]"; diubah jadi teks nama + daftar posisi gambar
function kickText(content) {
  const re = /\[emote:(\d+):([^\]]*)\]/g;
  let text = '', last = 0, m; const emo = [];
  content = String(content == null ? '' : content);
  while ((m = re.exec(content))) {
    text += content.slice(last, m.index);
    const a = Array.from(text).length;
    text += m[2];
    emo.push([a, a + Array.from(m[2]).length, 'https://files.kick.com/emotes/' + m[1] + '/fullsize']);
    last = m.index + m[0].length;
  }
  text += content.slice(last);
  return { text, emo };
}
const jp = d => { if (typeof d !== 'string') return d || {}; try { return JSON.parse(d); } catch { return {}; } };

// bingkai Pusher {event, data, channel} -> daftar pesan ChatStream
function kickEvent(ev, rawData) {
  const d = jp(rawData), name = String(ev || '');
  const sender = d.sender || {}, who = sender.username || d.username || '?';
  if (/ChatMessageEvent$/.test(name)) {
    const b = new Set(((sender.identity && sender.identity.badges) || []).map(x => x && x.type));
    const k = kickText(d.content);
    return [{ p: 'kick', name: who, text: k.text, emo: k.emo.length ? k.emo : undefined,
      owner: b.has('broadcaster'), mod: b.has('moderator'), vip: b.has('vip'), member: b.has('subscriber') || b.has('founder') || b.has('og') }];
  }
  if (/KicksGifted/i.test(name)) {
    const g = d.gift || {}, amt = Number(g.amount) || 0, k = kickText(d.message);
    return [{ p: 'kick', name: who, text: k.text, emo: k.emo.length ? k.emo : undefined, sc: { amount: amt.toLocaleString('id-ID') + ' Kicks', color: '#53fc18', kicks: amt, gift: g.name || '' } }];
  }
  if (/GiftedSubscriptionsEvent$/.test(name)) {
    const n = Array.isArray(d.gifted_usernames) ? d.gifted_usernames.length : (Number(d.gifted_count) || 1);
    return [{ p: 'kick', kind: 'gift', name: d.gifter_username || '?', n: n || 1 }];
  }
  if (/SubscriptionEvent$/.test(name)) return [{ p: 'kick', kind: 'sub', name: d.username || '?', months: Number(d.months) || 1 }];
  if (/StreamHostEvent$/.test(name)) return [{ p: 'kick', kind: 'raid', name: d.host_username || '?', n: Number(d.number_viewers) || 0, text: d.optional_message || undefined }];
  if (/RewardRedeemedEvent$/.test(name)) return [{ p: 'kick', kind: 'reward', name: d.username || '?', title: d.reward_title || 'hadiah', text: d.user_input || undefined }];
  if (/FollowersUpdated$/.test(name)) return (d.username && d.followed !== false) ? [{ p: 'kick', kind: 'follow', name: d.username }] : [];
  return [];
}

module.exports = { parseIrc, twitchLine, kickEvent, kickText, cleanText, twEmotes, bitColor };
