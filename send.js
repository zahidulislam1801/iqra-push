/* IQRA Vocab push sender - runs every ~5 minutes on GitHub Actions (free).
   1. Admin NOTICES (push ticked) and published ARTICLES -> every registered device.
   2. Daily words / verse / hadith -> only devices whose owner switched that one on (Bangladesh time). */
const admin = require('firebase-admin');
const { SLOTS, dayNum } = require('./daily');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

async function sendTo(docs, data) {
  const rows = docs.map((x) => ({ ref: x.ref, token: x.get('token') })).filter((r) => r.token);
  const dead = []; let ok = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: part.map((r) => r.token), data,
      webpush: { headers: { Urgency: 'high', TTL: '86400' } }
    });
    ok += res.successCount;
    res.responses.forEach((r, k) => {
      const c = r.error && r.error.code;
      if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') dead.push(part[k].ref);
    });
  }
  await Promise.all(dead.map((r) => r.delete()));
  console.log('sent', ok, 'of', rows.length, '|', data.title);
}

(async () => {
  const now = Date.now();
  /* 1 - admin notices and articles waiting to be pushed */
  const q = await db.collection('notices').where('pushed', '==', false).get();
  for (const x of q.docs) {
    const d = x.data(), art = d.kind === 'article';
    if (x.id === 'current' || d.on === false || !(art || d.push === true)) { await x.ref.update({ pushed: true }); continue; }
    if (d.start && d.start > now) continue;                       // scheduled: wait for its time
    const tokens = await db.collection('pushTokens').get();
    await sendTo(tokens.docs, {
      id: String(d.id || x.id),
      title: String(art ? (d.title || 'New article') : (d.title || 'IQRA Vocab')).slice(0, 80),
      body: String(art ? (d.summary || d.title || '') : (d.text || '')).slice(0, 200),
      url: './'
    });
    await x.ref.update({ pushed: true });
  }
  /* 2 - daily words / verse / hadith (each slot is sent once per day, up to 3 hours late) */
  const dm = (Math.floor(now / 6e4) + 360) % 1440, n = dayNum(now);
  for (const s of SLOTS) {
    if (dm < s.at || dm >= s.at + 180) continue;
    try { await db.collection('pushLog').doc(s.at + '_' + s.flag + '_' + n).create({ t: now }); } catch (e) { continue; }   // already sent
    const tokens = await db.collection('pushTokens').where(s.flag, '==', true).get();
    const m = s.make(n);
    await sendTo(tokens.docs, { id: 'daily-' + s.at + '-' + n, title: m.title, body: m.body.slice(0, 200), url: './' });
  }
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
