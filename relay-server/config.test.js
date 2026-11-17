// Konfiguracja bez pułapek (S4.3) i limity ze zmiennych środowiska (S4.4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIpOf, normIp, readConfig } from "./config.js";

test("domyślnie (nie produkcja): wszystkie źródła, bez pośrednika, bez błędów", () => {
  const c = readConfig({});
  assert.deepEqual(c.errors, []);
  assert.deepEqual(c.origins, ["*"]);
  assert.equal(c.trustProxy, false);
  assert.equal(c.port, 4466);
  assert.deepEqual(c.limits, {});
});

test("produkcja bez ALLOWED_ORIGINS albo z „*” — błąd; z listą adresów — w porządku", () => {
  assert.equal(readConfig({ NODE_ENV: "production" }).errors.length, 1);
  assert.equal(readConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "*" }).errors.length, 1);
  assert.equal(readConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://a.pl, *" }).errors.length, 1);
  assert.equal(readConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: " , " }).errors.length, 1);
  const ok = readConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://notatnik.example, https://b.example" });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.origins, ["https://notatnik.example", "https://b.example"]);
});

test("TRUST_PROXY=1 wymaga TRUSTED_PROXY", () => {
  assert.match(readConfig({ TRUST_PROXY: "1" }).errors[0], /TRUSTED_PROXY/);
  assert.deepEqual(readConfig({ TRUST_PROXY: "1", TRUSTED_PROXY: "10.0.0.2" }).errors, []);
});

test("limity ze zmiennych: dodatnie liczby całkowite, inaczej błąd (nie cicha wartość domyślna)", () => {
  const c = readConfig({ MAX_ROOMS: "50", MAX_ROOM_BLOB_BYTES: "1048576", MAX_TOTAL_BYTES: "1000", MIN_FREE_BYTES: "5" });
  assert.deepEqual(c.errors, []);
  assert.deepEqual(c.limits, { MAX_ROOMS: 50, MAX_ROOM_BLOB_BYTES: 1048576 });
  assert.equal(c.maxTotalBytes, 1000);
  assert.equal(c.minFreeBytes, 5);
  for (const bad of ["0", "-3", "1.5", "dużo"]) assert.equal(readConfig({ MAX_ROOMS: bad }).errors.length, 1, bad);
});

test("adres klienta: X-Forwarded-For tylko od zaufanego pośrednika, ostatni wpis", () => {
  const plain = readConfig({});
  assert.deepEqual(clientIpOf(plain, "::ffff:1.2.3.4", undefined), { ip: "1.2.3.4", forwardedIgnored: false });
  // Bez TRUST_PROXY nagłówek jest ignorowany i zgłaszany (ostrzeżenie w logu).
  assert.deepEqual(clientIpOf(plain, "1.2.3.4", "6.6.6.6"), { ip: "1.2.3.4", forwardedIgnored: true });

  const proxied = readConfig({ TRUST_PROXY: "1", TRUSTED_PROXY: "10.0.0.2" });
  assert.equal(clientIpOf(proxied, "::ffff:10.0.0.2", "6.6.6.6, 5.5.5.5").ip, "5.5.5.5");
  // Klient łączący się z pominięciem pośrednika nie poda sobie adresu.
  assert.equal(clientIpOf(proxied, "7.7.7.7", "5.5.5.5").ip, "7.7.7.7");
  assert.equal(normIp(undefined), "");
});

test("klucz limitów: IPv4 bez zmian, IPv6 jako prefiks /64", async () => {
  const { limitKey } = await import("./config.js");
  assert.equal(limitKey("1.2.3.4"), "1.2.3.4");
  assert.equal(limitKey("::ffff:1.2.3.4"), "1.2.3.4");
  assert.equal(limitKey("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(limitKey("2001:0db8:0001:0002:ffff:ffff:ffff:ffff"), "2001:db8:1:2::/64");
  assert.equal(limitKey("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(limitKey("fe80::1%eth0"), "fe80:0:0:0::/64");
  assert.equal(limitKey("2001:db8:1:2::5"), limitKey("2001:db8:1:2:9::"));
});
