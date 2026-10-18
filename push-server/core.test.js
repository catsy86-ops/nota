import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanItems, cleanStore, cleanSubscription, dueItems, LIMITS, payloadOf, removeItems, subKey } from "./core.js";

const NOW = Date.UTC(2026, 9, 16, 12);
const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BPk", auth: "xyz" } };

test("subskrypcja: tylko https i z kluczami", () => {
  assert.deepEqual(cleanSubscription(sub), sub);
  assert.equal(cleanSubscription({ ...sub, endpoint: "http://x" }), null);
  assert.equal(cleanSubscription({ endpoint: sub.endpoint }), null);
  assert.equal(cleanSubscription(null), null);
});

test("terminy: przeszłe, odległe i bez tytułu odpadają, adres tylko w aplikacji", () => {
  const items = cleanItems([
    { key: "b", at: NOW + 2000, title: "Drugi", url: "//zly.pl" },
    { key: "a", at: NOW + 1000, title: "Pierwszy", body: "treść", url: "/notatka/1" },
    { key: "a", at: NOW + 3000, title: "Dubel" },
    { key: "c", at: NOW - 1, title: "Przeszły" },
    { key: "d", at: NOW + LIMITS.horizonMs + 1, title: "Za daleko" },
    { key: "e", at: NOW + 1000, title: "  " },
  ], NOW);
  assert.deepEqual(items.map((i) => i.key), ["a", "b"]);
  assert.equal(items[0].url, "/notatka/1");
  assert.equal(items[1].url, "/");
});

test("terminy: limit liczby i długości tekstu", () => {
  const raw = Array.from({ length: LIMITS.items + 5 }, (_, i) => ({ key: `k${i}`, at: NOW + 1000 + i, title: "x".repeat(500) }));
  const items = cleanItems(raw, NOW);
  assert.equal(items.length, LIMITS.items);
  assert.equal(items[0].title.length, LIMITS.title);
});

test("do wysłania: należne teraz, mocno spóźnione przepadają", () => {
  const store = { subs: { s: { subscription: sub, items: [
    { key: "teraz", at: NOW - 1000 },
    { key: "stare", at: NOW - LIMITS.lateMs - 1 },
    { key: "potem", at: NOW + 1000 },
  ] } } };
  const { send, drop } = dueItems(store, NOW);
  assert.deepEqual(send.map((x) => x.item.key), ["teraz"]);
  assert.deepEqual(drop.map((x) => x.item.key), ["stare"]);
  removeItems(store, "s", ["teraz", "stare"]);
  assert.deepEqual(store.subs.s.items.map((i) => i.key), ["potem"]);
});

test("plik: uszkodzone wpisy wypadają, klucz liczony z endpointu", () => {
  const store = cleanStore({ subs: {
    x: { subscription: sub, items: [{ key: "a", at: NOW + 1000, title: "A" }] },
    y: { subscription: { endpoint: "ftp://x" }, items: [] },
  } }, NOW);
  assert.deepEqual(Object.keys(store.subs), [subKey(sub.endpoint)]);
  assert.equal(store.subs[subKey(sub.endpoint)].items.length, 1);
  assert.deepEqual(cleanStore("śmieci", NOW), { subs: {} });
});

test("terminy: „Odłóż” tylko dla przypomnień jednorazowych (`snooze: true`), trafia do treści push", () => {
  const [once, series] = cleanItems([
    { key: "n:a:1", at: NOW + 1000, title: "Raz", url: "/notatka/a", snooze: true },
    { key: "n:b:1", at: NOW + 2000, title: "Seria", url: "/notatka/b", snooze: "tak" },
  ], NOW);
  assert.equal(once.snooze, true);
  assert.equal(series.snooze, false);
  assert.equal(JSON.parse(payloadOf(once)).snooze, true);
  assert.equal(JSON.parse(payloadOf(series)).snooze, false);
});
