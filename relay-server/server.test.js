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
after(() => { child?.kill(); rmSync(dir, { recursive: true, force: true }); });

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
