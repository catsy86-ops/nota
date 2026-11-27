// Testy całego serwera: uruchamiamy prawdziwy proces na wolnym porcie i pytamy go przez HTTP.
// Nie wysyłamy nic na zewnątrz (żaden test nie przechodzi walidacji subskrypcji do `web-push`).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, connect as netConnect } from "node:net";

const TOKEN = "test-token-0123456789-abcdefghij";
const ORIGIN = "https://notki.example";
const VALID_SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BPkey", auth: "authkey" } };

const freePort = () => new Promise((resolve) => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

/** Uruchamia serwer z podanym środowiskiem; zwraca adres i funkcję zatrzymania. */
async function start(env, { expectExit = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "notki-push-"));
  const port = await freePort();
  const child = spawn(process.execPath, ["server.js"], { cwd: import.meta.dirname, env: { PATH: process.env.PATH, PORT: String(port), DATA_DIR: dir, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });
  const stop = () => new Promise((resolve) => { if (child.exitCode !== null) { rmSync(dir, { recursive: true, force: true }); resolve(); return; } child.once("exit", () => { rmSync(dir, { recursive: true, force: true }); resolve(); }); child.kill(); });
  if (expectExit) {
    const code = await new Promise((resolve) => child.once("exit", resolve));
    rmSync(dir, { recursive: true, force: true });
    return { code, out };
  }
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/health`)).ok) return { base, stop, dir, log: () => out }; } catch { /* jeszcze się uruchamia */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  await stop();
  throw new Error(`serwer nie wystartował: ${out}`);
}

const json = (body, headers = {}) => ({ method: "PUT", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const auth = { Authorization: `Bearer ${TOKEN}` };

test("bez PUSH_TOKEN serwer nie startuje, chyba że ALLOW_NO_AUTH=1", async () => {
  const r = await start({}, { expectExit: true });
  assert.equal(r.code, 1);
  assert.match(r.out, /PUSH_TOKEN/);
});

test("za krótki PUSH_TOKEN jest odrzucony", async () => {
  const r = await start({ PUSH_TOKEN: "krotki" }, { expectExit: true });
  assert.equal(r.code, 1);
  assert.match(r.out, /za krótki/);
});

let srv;
before(async () => { srv = await start({ PUSH_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN, RATE_IP_PER_MIN: "10000", RATE_AUTH_FAILS: "1000" }); });
after(async () => { await srv.stop(); });

test("uwierzytelnianie: bez tokenu i ze złym tokenem 401, z dobrym przechodzi", async () => {
  const none = await fetch(`${srv.base}/schedule`, json({ subscription: VALID_SUB, items: [] }));
  assert.equal(none.status, 401);
  const bad = await fetch(`${srv.base}/schedule`, json({ subscription: VALID_SUB, items: [] }, { Authorization: "Bearer zly-token" }));
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get("www-authenticate"), "Bearer");
  const ok = await fetch(`${srv.base}/schedule`, json({ subscription: VALID_SUB, items: [] }, auth));
  assert.equal(ok.status, 200);
});

test("każda ścieżka zmieniająca dane wymaga tokenu: /unsubscribe i /test też", async () => {
  const un = await fetch(`${srv.base}/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: VALID_SUB.endpoint }) });
  assert.equal(un.status, 401);
  const t = await fetch(`${srv.base}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: VALID_SUB }) });
  assert.equal(t.status, 401);
});

test("/health jest jawny, /vapid wymaga tokenu (nie zdradza, że to serwer powiadomień)", async () => {
  assert.equal((await fetch(`${srv.base}/health`)).status, 200);
  assert.equal((await fetch(`${srv.base}/vapid`)).status, 401);
  const v = await fetch(`${srv.base}/vapid`, { headers: auth });
  assert.equal(v.status, 200);
  const vj = await v.json();
  assert.equal(typeof vj.publicKey, "string");
  assert.equal(vj.enc, 1, "serwer ogłasza format zaszyfrowany (S3.1)");
});

/** Surowe żądanie HTTP przez gniazdo — `fetch` nie pozwoli wysłać ścieżki typu `//[`. */
function raw(base, requestLine) {
  const { port } = new URL(base);
  return new Promise((resolve, reject) => {
    const sock = netConnect(Number(port), "127.0.0.1", () => sock.write(`${requestLine}\r\nHost: x\r\nConnection: close\r\n\r\n`));
    let data = "";
    sock.on("data", (d) => { data += d; });
    sock.on("close", () => resolve(data));
    sock.on("error", reject);
  });
}

test("ścieżki, przy których `new URL` rzuca, dają 400 i nie zabijają procesu (anonimowy DoS)", async () => {
  for (const line of ["GET //[ HTTP/1.1", "GET // HTTP/1.1", "GET /// HTTP/1.1", "GET //a:b HTTP/1.1", "GET //%25 HTTP/1.1"]) {
    const res = await raw(srv.base, line);
    assert.match(res, /^HTTP\/1\.1 (400|404)/, `${line} → ${res.slice(0, 40)}`);
  }
  // Serwer wciąż żyje.
  assert.equal((await fetch(`${srv.base}/health`)).status, 200);
});

test("przekaźnik: adresy z rozbieżnością parserów (`;`, `!`, `$`…) są odrzucane (400)", async () => {
  for (const endpoint of ["https://127.0.0.1;x.notify.windows.com/p", "https://169.254.169.254;a.push.apple.com/x", "https://10.0.0.5!x.push.services.mozilla.com/"]) {
    const sched = await fetch(`${srv.base}/schedule`, json({ subscription: { ...VALID_SUB, endpoint }, items: [] }, auth));
    assert.equal(sched.status, 400, endpoint);
    const t = await fetch(`${srv.base}/test`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ subscription: { ...VALID_SUB, endpoint } }) });
    assert.equal(t.status, 400, endpoint);
  }
});

test("przekaźnik: subskrypcja z obcym adresem jest odrzucona (400) i nic nie jest wysyłane", async () => {
  for (const endpoint of ["https://example.com/hook", "https://169.254.169.254/latest", "https://localhost:9/x", "http://fcm.googleapis.com/x", "https://user:p@fcm.googleapis.com/x"]) {
    const sched = await fetch(`${srv.base}/schedule`, json({ subscription: { ...VALID_SUB, endpoint }, items: [] }, auth));
    assert.equal(sched.status, 400, endpoint);
    const test_ = await fetch(`${srv.base}/test`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ subscription: { ...VALID_SUB, endpoint } }) });
    assert.equal(test_.status, 400, endpoint);
  }
});

test("CORS: wymieniona strona dostaje nagłówek, obca nie; preflight pozwala na Authorization", async () => {
  const good = await fetch(`${srv.base}/health`, { headers: { Origin: ORIGIN } });
  assert.equal(good.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(good.headers.get("vary"), "Origin");
  const evil = await fetch(`${srv.base}/health`, { headers: { Origin: "https://evil.example" } });
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  const pre = await fetch(`${srv.base}/schedule`, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "PUT" } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("access-control-allow-headers") ?? "", /Authorization/);
});

test("nagłówki bezpieczeństwa i brak wycieku treści błędów", async () => {
  const r = await fetch(`${srv.base}/schedule`, { method: "PUT", headers: { "Content-Type": "application/json", ...auth }, body: "{nie json" });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "bad-json" });
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("cache-control"), "no-store");
  const nf = await fetch(`${srv.base}/nie-ma`);
  assert.equal(nf.status, 404);
});

test("za duże ciało: 413 zanim zostanie wczytane", async () => {
  const r = await fetch(`${srv.base}/schedule`, { method: "PUT", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ subscription: VALID_SUB, items: [], pad: "x".repeat(520 * 1024) }) });
  assert.equal(r.status, 413);
});

test("limit błędnych tokenów: seria złych odpowiedzi kończy się 429, ale właściciel z dobrym tokenem nie jest blokowany", async () => {
  const lim = await start({ PUSH_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN, RATE_AUTH_FAILS: "3" });
  try {
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(`${lim.base}/schedule`, json({ subscription: VALID_SUB, items: [] }, { Authorization: `Bearer zly-${i}` }))).status);
    assert.deepEqual(codes, [401, 401, 401, 429, 429]);
    // Ktoś za tym samym adresem (wspólne proxy, sieć komórkowa) nie odcina właściciela serią złych tokenów.
    assert.equal((await fetch(`${lim.base}/schedule`, json({ subscription: VALID_SUB, items: [] }, auth))).status, 200);
  } finally { await lim.stop(); }
});

test("limit żądań na adres: zalewanie kończy się 429 z Retry-After", async () => {
  const lim = await start({ PUSH_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN, RATE_IP_PER_MIN: "20" });
  try {
    let last;
    for (let i = 0; i < 40; i++) { last = await fetch(`${lim.base}/health`); if (last.status === 429) break; }
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get("retry-after")) >= 1);
  } finally { await lim.stop(); }
});

test("limit /schedule na subskrypcję i /test: kolejne żądania dostają 429", async () => {
  const lim = await start({ PUSH_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN, RATE_SCHEDULE_PER_HOUR: "3", RATE_IP_PER_MIN: "1000" });
  try {
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(`${lim.base}/schedule`, json({ subscription: VALID_SUB, items: [] }, auth))).status);
    assert.deepEqual(codes, [200, 200, 200, 429, 429]);
    // Inna subskrypcja ma własny licznik.
    const other = { ...VALID_SUB, endpoint: "https://fcm.googleapis.com/fcm/send/inna" };
    assert.equal((await fetch(`${lim.base}/schedule`, json({ subscription: other, items: [] }, auth))).status, 200);
  } finally { await lim.stop(); }
});

test("/unsubscribe z tokenem usuwa subskrypcję, także gdy adres ma inną wielkość liter w hoście", async () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/unsub-happy";
  const put = await fetch(`${srv.base}/schedule`, json({ subscription: { ...VALID_SUB, endpoint }, items: [] }, auth));
  assert.equal(put.status, 200);
  const un = await fetch(`${srv.base}/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ endpoint: "https://FCM.googleapis.com/fcm/send/unsub-happy" }) });
  assert.equal(un.status, 200);
  // Ponowny zapis działa jak świeża subskrypcja (limit na subskrypcję nie jest „zajęty” starym wpisem).
  const again = await fetch(`${srv.base}/schedule`, json({ subscription: { ...VALID_SUB, endpoint }, items: [] }, auth));
  assert.equal(again.status, 200);
});

test("produkcja: ALLOW_NO_AUTH i brak kluczy VAPID ze zmiennych zatrzymują start (S3.3, S3.4)", async () => {
  const noAuth = await start({ NODE_ENV: "production", ALLOW_NO_AUTH: "1", VAPID_PUBLIC_KEY: "x", VAPID_PRIVATE_KEY: "y" }, { expectExit: true });
  assert.equal(noAuth.code, 1);
  assert.match(noAuth.out, /Konfiguracja:.*ALLOW_NO_AUTH/);
  const noKeys = await start({ NODE_ENV: "production", PUSH_TOKEN: TOKEN }, { expectExit: true });
  assert.equal(noKeys.code, 1);
  assert.match(noKeys.out, /Konfiguracja:.*VAPID_PUBLIC_KEY/);
});

test("zapis na dysku bez adresu IP, nagłówków i tokenu (S3.3)", async () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/minimal";
  const headers = { ...auth, "User-Agent": "Pixel-7-Unikalny-UA", "X-Forwarded-For": "203.0.113.77" };
  assert.equal((await fetch(`${srv.base}/schedule`, json({ subscription: { ...VALID_SUB, endpoint }, items: [] }, headers))).status, 200);
  const saved = readFileSync(join(srv.dir, "store.json"), "utf8");
  assert.ok(saved.includes("send/minimal"));
  for (const leak of ["127.0.0.1", "::1", "203.0.113.77", "Pixel-7-Unikalny-UA", TOKEN, "Bearer"]) assert.ok(!saved.includes(leak), leak);
});

test("dziennik serwera bez tokenu, nagłówków i adresu IP (S4.5)", async () => {
  const headers = { ...auth, "User-Agent": "UA-do-dziennika-xyz", "X-Forwarded-For": "198.51.100.23" };
  await fetch(`${srv.base}/schedule`, json({ subscription: { ...VALID_SUB, endpoint: "https://fcm.googleapis.com/fcm/send/log" }, items: [] }, headers));
  await fetch(`${srv.base}/schedule`, json({ subscription: { endpoint: "nie-adres" }, items: [] }, headers));
  await fetch(`${srv.base}/schedule`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: "{zly json" });
  await fetch(`${srv.base}/vapid`, { headers: { Authorization: "Bearer zly-token-do-dziennika-0000000" } });
  const out = srv.log();
  for (const leak of [TOKEN, "zly-token-do-dziennika", "Bearer", "Authorization", "UA-do-dziennika-xyz", "198.51.100.23", "127.0.0.1"]) assert.ok(!out.includes(leak), leak);
});

test("/health zwraca tylko { ok: true } (S4.6)", async () => {
  const r = await fetch(`${srv.base}/health`);
  assert.deepEqual(await r.json(), { ok: true });
});

// ── S3.2: token urządzenia ──────────────────────────────────────────────────────────────────────────
const post = (path, body, headers = {}) => fetch(`${srv.base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const subAt = (name) => ({ ...VALID_SUB, endpoint: `https://fcm.googleapis.com/fcm/send/${name}` });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

async function register(name) {
  const r = await post("/register", { subscription: subAt(name) }, auth);
  assert.equal(r.status, 200);
  const { token } = await r.json();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  return token;
}

test("S3.2: /register wydaje token urządzenia, który obsługuje tylko swoją subskrypcję", async () => {
  const dev = await register("dev-own");
  assert.deepEqual(await (await fetch(`${srv.base}/vapid`, { headers: bearer(dev) })).json().then((b) => [b.enc, b.reg]), [1, 1]);
  assert.equal((await fetch(`${srv.base}/schedule`, json({ subscription: subAt("dev-own"), items: [] }, bearer(dev)))).status, 200);
  // Cudza subskrypcja: ani harmonogram, ani próbne, ani wypisanie.
  assert.equal((await fetch(`${srv.base}/schedule`, json({ subscription: subAt("dev-other"), items: [] }, auth))).status, 200);
  assert.equal((await fetch(`${srv.base}/schedule`, json({ subscription: subAt("dev-other"), items: [] }, bearer(dev)))).status, 403);
  assert.equal((await post("/test", { subscription: subAt("dev-other") }, bearer(dev))).status, 403);
  assert.equal((await post("/unsubscribe", { endpoint: subAt("dev-other").endpoint }, bearer(dev))).status, 403);
  // Nowych tokenów nie wydaje.
  assert.equal((await post("/register", { subscription: subAt("dev-new") }, bearer(dev))).status, 403);
  // Na dysku tylko skrót.
  const saved = readFileSync(join(srv.dir, "store.json"), "utf8");
  assert.ok(!saved.includes(dev));
  assert.match(saved, /"tokenHash":"[a-f0-9]{64}"/);
  // Wypisanie własnej kończy token.
  assert.equal((await post("/unsubscribe", { endpoint: subAt("dev-own").endpoint }, bearer(dev))).status, 200);
  assert.equal((await fetch(`${srv.base}/vapid`, { headers: bearer(dev) })).status, 401);
});

test("S3.2: nowa subskrypcja przeglądarki przejmuje token, ponowna rejestracja unieważnia stary", async () => {
  const dev = await register("dev-rot-a");
  assert.equal((await fetch(`${srv.base}/schedule`, json({ subscription: subAt("dev-rot-b"), items: [] }, bearer(dev)))).status, 200);
  const saved = JSON.parse(readFileSync(join(srv.dir, "store.json"), "utf8"));
  const endpoints = Object.values(saved.subs).map((s) => s.subscription.endpoint);
  assert.ok(endpoints.includes(subAt("dev-rot-b").endpoint));
  assert.ok(!endpoints.includes(subAt("dev-rot-a").endpoint));
  // Zapis z PUSH_TOKEN nie zdejmuje tokenu urządzenia.
  assert.equal((await fetch(`${srv.base}/schedule`, json({ subscription: subAt("dev-rot-b"), items: [] }, auth))).status, 200);
  assert.equal((await fetch(`${srv.base}/vapid`, { headers: bearer(dev) })).status, 200);
  const next = await register("dev-rot-b");
  assert.equal((await fetch(`${srv.base}/vapid`, { headers: bearer(dev) })).status, 401);
  assert.equal((await fetch(`${srv.base}/vapid`, { headers: bearer(next) })).status, 200);
});
