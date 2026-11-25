// Testy odporności całego przekaźnika: prawdziwy proces, anonimowe złośliwe żądania nie mogą go zabić (audyt 2026-11-11).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, connect as netConnect } from "node:net";
import { WebSocket } from "ws";

const freePort = () => new Promise((resolve) => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

let child, dir, port, base, log = "";
before(async () => {
  dir = mkdtempSync(join(tmpdir(), "notki-relay-"));
  port = await freePort();
  child = spawn(process.execPath, ["server.js"], { cwd: import.meta.dirname, env: { PATH: process.env.PATH, PORT: String(port), DATA_DIR: dir, RATE_PER_MIN: "10000" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (d) => { log += d; });
  child.stderr.on("data", (d) => { log += d; });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* startuje */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`przekaźnik nie wystartował: ${log}`);
});
// Sprzątanie po zakończeniu procesu: kill() nie czeka, a serwer mógł jeszcze dopisywać pliki pokoju (ENOTEMPTY w CI).
const stop = async (c) => { if (c && c.exitCode === null) { const gone = new Promise((r) => c.once("exit", r)); c.kill(); await gone; } };
const clean = (d) => rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
after(async () => { await stop(child); clean(dir); });

const alive = async () => (await fetch(`${base}/health`)).status === 200 && child.exitCode === null;

function raw(requestText) {
  return new Promise((resolve, reject) => {
    const sock = netConnect(port, "127.0.0.1", () => sock.write(requestText));
    let data = "";
    sock.on("data", (d) => { data += d; });
    sock.on("close", () => resolve(data));
    sock.on("error", reject);
    setTimeout(() => sock.destroy(), 1500);
  });
}

test("ramka WebSocket ponad limit (4096 B) nie zabija procesu", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise((resolve) => { ws.on("open", resolve); ws.on("error", resolve); });
  ws.on("error", () => undefined);
  ws.send("x".repeat(10_000));
  await new Promise((r) => setTimeout(r, 400));
  ws.terminate();
  assert.equal(await alive(), true, log);
});

test("żądanie Upgrade z nieparsowalną ścieżką (`//`, `//[`) nie zabija procesu", async () => {
  for (const path of ["//", "///", "//[", "//a:b", "//%25"]) {
    await raw(`GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`);
  }
  assert.equal(await alive(), true, log);
});

test("zwykłe żądanie HTTP z dziwną ścieżką też nie zabija procesu", async () => {
  for (const path of ["//", "//[", "//%25"]) await raw(`GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
  assert.equal(await alive(), true, log);
});

test("subskrypcja z nieistniejącym pokojem kończy się zamknięciem gniazda, a serwer żyje", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const closed = new Promise((resolve) => ws.on("close", (code) => resolve(code)));
  ws.on("open", () => ws.send(JSON.stringify({ type: "subscribe", room: "a".repeat(64), token: "b".repeat(43) })));
  ws.on("error", () => undefined);
  const code = await Promise.race([closed, new Promise((r) => setTimeout(() => r("timeout"), 3000))]);
  assert.notEqual(code, "timeout");
  assert.equal(await alive(), true, log);
});

test("DELETE /rooms/:id: bez tokenu i ze złym tokenem odmowa, z dobrym kasuje pokój (S13)", async () => {
  const room = "ab".repeat(32);
  const token = "t".repeat(43);
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const created = await fetch(`${base}/rooms/${room}/updates`, { method: "POST", headers: auth, body: JSON.stringify({ data: "AAAA" }) });
  assert.equal(created.status, 200, await created.text());

  assert.equal((await fetch(`${base}/rooms/${room}`, { method: "DELETE" })).status, 401);
  assert.equal((await fetch(`${base}/rooms/${room}`, { method: "DELETE", headers: { Authorization: `Bearer ${"x".repeat(43)}` } })).status, 403);
  assert.equal((await fetch(`${base}/rooms/${room}/updates?since=0`, { headers: auth })).status, 200); // nadal jest

  assert.equal((await fetch(`${base}/rooms/${room}`, { method: "DELETE", headers: auth })).status, 200);
  assert.equal((await fetch(`${base}/rooms/${room}/updates?since=0`, { headers: auth })).status, 404);
  assert.equal((await fetch(`${base}/rooms/${room}`, { method: "DELETE", headers: auth })).status, 404); // drugi raz: nie ma
  assert.equal(await alive(), true, log);
});

test("treść do 22 MB nie jest czytana przed sprawdzeniem pokoju i tokenu (H3): odpowiedź przychodzi bez wysłania treści", async () => {
  const room = "cd".repeat(32);
  const token = "u".repeat(43);
  const created = await fetch(`${base}/rooms/${room}/updates`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: "AAAA" }) });
  assert.equal(created.status, 200);
  const head = (path, auth, length, method = "POST") => raw(`${method} ${path} HTTP/1.1\r\nHost: x\r\n${auth ? `Authorization: Bearer ${auth}\r\n` : ""}Content-Type: application/json\r\nContent-Length: ${length}\r\nConnection: close\r\n\r\n`);
  // Same nagłówki (treść nigdy nie przychodzi) — serwer odpowiada od razu, zamiast czekać na 20 MB.
  assert.match(await head(`/rooms/${room}/updates`, "x".repeat(43), 20_000_000), /^HTTP\/1\.1 403/);
  assert.match(await head(`/rooms/${"ef".repeat(32)}/updates`, undefined, 20_000_000), /^HTTP\/1\.1 401/);
  assert.match(await head(`/rooms/${room}/updates`, token, 30_000_000), /^HTTP\/1\.1 413/);
  assert.match(await head(`/rooms/${room}/snapshot`, "x".repeat(43), 20_000_000, "PUT"), /^HTTP\/1\.1 403/);
  assert.equal(await alive(), true, log);
});

test("błędna konfiguracja (produkcja bez ALLOWED_ORIGINS, TRUST_PROXY bez pośrednika) zatrzymuje start (S4.3)", async () => {
  for (const env of [{ NODE_ENV: "production" }, { TRUST_PROXY: "1" }, { MAX_ROOMS: "zero" }]) {
    const d = mkdtempSync(join(tmpdir(), "notki-relay-cfg-"));
    try {
      const c = spawn(process.execPath, ["server.js"], { cwd: import.meta.dirname, env: { PATH: process.env.PATH, PORT: String(await freePort()), DATA_DIR: d, ...env }, stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      c.stderr.on("data", (x) => { err += x; });
      const code = await new Promise((resolve) => c.on("exit", resolve));
      assert.equal(code, 1, JSON.stringify(env));
      assert.match(err, /Konfiguracja:/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }
});

test("limit nowych pokoi na adres na dobę: trzeci nowy pokój dostaje 429, zapis do istniejącego nie jest liczony (S4)", async () => {
  const dir2 = mkdtempSync(join(tmpdir(), "notki-relay-lim-"));
  const port2 = await freePort();
  const child2 = spawn(process.execPath, ["server.js"], { cwd: import.meta.dirname, env: { PATH: process.env.PATH, PORT: String(port2), DATA_DIR: dir2, RATE_PER_MIN: "10000", ROOMS_PER_IP_PER_DAY: "2" }, stdio: "ignore" });
  const b = `http://127.0.0.1:${port2}`;
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${b}/health`)).ok) break; } catch { /* startuje */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    const token = "t".repeat(43);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const post = (room) => fetch(`${b}/rooms/${room}/updates`, { method: "POST", headers, body: JSON.stringify({ data: "AAAA" }) });
    const ids = ["a1", "b2", "c3"].map((x) => x.repeat(32));
    assert.equal((await post(ids[0])).status, 200);
    assert.equal((await post(ids[1])).status, 200);
    assert.equal((await post(ids[2])).status, 429);
    assert.equal((await post(ids[0])).status, 200); // istniejący pokój: bez limitu
    assert.equal((await post(ids[1])).status, 200);
  } finally {
    await stop(child2);
    clean(dir2);
  }
});


test("dziennik przekaźnika bez tokenu, nagłówków, treści i adresu IP (S4.5)", async () => {
  const token = "L".repeat(43);
  const room = "ef".repeat(32);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "UA-przekaznik-xyz", "X-Forwarded-For": "198.51.100.44" };
  await fetch(`${base}/rooms/${room}/updates`, { method: "POST", headers, body: JSON.stringify({ data: "VFJFU0MtVEFKTkE" }) });
  await fetch(`${base}/rooms/${room}/updates`, { method: "POST", headers, body: "{zly json" });
  await fetch(`${base}/rooms/${room}`, { method: "DELETE", headers: { Authorization: `Bearer ${"Z".repeat(43)}` } });
  await fetch(`${base}/rooms/nie-pokoj/updates`, { headers });
  for (const leak of [token, "Z".repeat(43), "Bearer", "Authorization", "UA-przekaznik-xyz", "198.51.100.44", "VFJFU0MtVEFKTkE", room]) assert.ok(!log.includes(leak), leak);
});

test("/health zwraca tylko { ok: true } (S4.6)", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});
