/* Same picks the app makes on each device. Daily times are fixed to Bangladesh time (UTC+6). */
const D = require('./daily.json');
const DAY = 864e5;
function hs(n){n=Math.imul(n^(n>>>16),2246822507);n=Math.imul(n^(n>>>13),3266489909);return(n^(n>>>16))>>>0;}
function prng(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const L = D.words.length;
let cache = { c: null, p: null };
function perm(c){
  if (cache.c === c) return cache.p;
  const p = Array.from({ length: L }, (_, i) => i), r = prng(hs(c * 7919 + 20241));
  for (let i = L - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  cache = { c, p }; return p;
}
const TZ = -360;   // Date.getTimezoneOffset() of Bangladesh
const dayNum = (nowMs) => Math.floor((nowMs - TZ * 6e4) / DAY);
function word(n, k){ const q = n * 3 + k; const w = D.words[perm(Math.floor(q / L))[q % L]]; return { title: 'Word of the day: ' + w[0], body: [w[1], w[2]].filter(Boolean).join(' — ') }; }
function verse(n){ const o = D.verses[hs(n * 53 + 5) % D.verses.length]; return { title: 'Verse of the day', body: (o.e || '') + (o.r ? ' — ' + o.r : '') }; }
function hadith(n){ const o = D.hadith[n % D.hadith.length]; return { title: 'Hadith of the day', body: (o.t || '') + (o.r ? ' ' + o.r : '') }; }
const SLOTS = [
  { at: 330,  flag: 'pv', make: verse },                    // 5:30
  { at: 480,  flag: 'pw', make: (n) => word(n, 0) },        // 8:00
  { at: 750,  flag: 'ph', make: hadith },                   // 12:30
  { at: 900,  flag: 'pw', make: (n) => word(n, 1) },        // 15:00
  { at: 1200, flag: 'pw', make: (n) => word(n, 2) }         // 20:00
];
module.exports = { SLOTS, dayNum, word, verse, hadith };
