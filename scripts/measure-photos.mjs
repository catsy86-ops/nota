// Pomiar magazynu zdjęć (plan B5.5/B-7): ile trwa zapis i odczyt N zdjęć w IndexedDB przy dławieniu CPU.
// Użycie: node scripts/measure-photos.mjs [adres] [liczba=1200] [rozmiarKB=400] [dławienie=4]
import { chromium, devices } from "@playwright/test";
const [base = "http://127.0.0.1:4174", nArg = "1200", kbArg = "400", thr = "4"] = process.argv.slice(2);
const N = Number(nArg), KB = Number(kbArg);
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
const page = await ctx.newPage();
await page.goto(`${base}/praca`);
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(thr) });
const r = await page.evaluate(async ({ N, KB }) => {
  const DB = "bench-images", STORE = "images";
  await new Promise((res) => { const d = indexedDB.deleteDatabase(DB); d.onsuccess = d.onerror = d.onblocked = () => res(); });
  const db = await new Promise((res, rej) => { const q = indexedDB.open(DB, 1); q.onupgradeneeded = () => q.result.createObjectStore(STORE); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const tx = (mode) => db.transaction(STORE, mode).objectStore(STORE);
  const req = (rq) => new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
  const buf = () => { const b = new Uint8Array(KB * 1024); for (let i = 0; i < b.length; i += 65536) crypto.getRandomValues(b.subarray(i, Math.min(i + 65536, b.length))); return b.buffer; };
  const out = {};
  let t = performance.now(); let writeErr = null;
  try { for (let i = 0; i < N; i++) await req(tx("readwrite").put({ bytes: buf(), type: "image/jpeg", addedAt: i }, "k" + i)); } catch (e) { writeErr = String(e); }
  out.zapisMs = Math.round(performance.now() - t); out.blad = writeErr;
  t = performance.now(); const keys = await req(tx("readonly").getAllKeys()); out.listaKluczyMs = Math.round(performance.now() - t); out.kluczy = keys.length;
  // siatka zdjęć: 60 widocznych miniatur, każda: odczyt rekordu + Blob + object URL
  const t0 = performance.now(); const urls = [];
  for (let i = 0; i < 60 && i < keys.length; i++) { const rec = await req(tx("readonly").get(keys[i])); urls.push(URL.createObjectURL(new Blob([rec.bytes], { type: rec.type }))); }
  out.siatka60Ms = Math.round(performance.now() - t0);
  urls.forEach((u) => URL.revokeObjectURL(u));
  const est = await navigator.storage.estimate(); out.uzyteMB = Math.round((est.usage ?? 0) / 1048576); out.limitMB = Math.round((est.quota ?? 0) / 1048576);
  db.close(); await new Promise((res) => { const d = indexedDB.deleteDatabase(DB); d.onsuccess = d.onerror = () => res(); });
  return out;
}, { N, KB });
console.log(JSON.stringify({ zdjec: N, rozmiarKB: KB, dlawienie: Number(thr), ...r }, null, 1));
await browser.close();
