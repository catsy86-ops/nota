import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanItems, cleanStore, cleanSubscription, dueItems, isPushServiceUrl, LIMITS, payloadOf, removeItems, subKey, tickStore } from "./core.js";

test("endpoint tylko z serwisu Web Push przeglądarki (bez otwartego przekaźnika)", () => {
  assert.equal(isPushServiceUrl("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isPushServiceUrl("https://updates.push.services.mozilla.com/wpush/v2/abc"), true);
  assert.equal(isPushServiceUrl("https://wns2-par02p.notify.windows.com/w/?token=abc"), true);
  assert.equal(isPushServiceUrl("https://web.push.apple.com/abc"), true);
  assert.equal(isPushServiceUrl("https://example.com/hook"), false);
  assert.equal(isPushServiceUrl("https://evil.notify.windows.com.attacker.example/x"), false);
  assert.equal(isPushServiceUrl("http://fcm.googleapis.com/x"), false);
  assert.equal(isPushServiceUrl("nie-url"), false);
});

const NOW = Date.UTC(2026, 9, 16, 12);
const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BPk", auth: "xyz" } };

test("subskrypcja: tylko https i z kluczami", () => {
  assert.deepEqual(cleanSubscription(sub), sub);
  assert.equal(cleanSubscription({ ...sub, endpoint: "http://x" }), null);
  assert.equal(cleanSubscription({ ...sub, endpoint: "https://fcm.googleapis.com.evil.example/x" }), null);
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

// ── tickStore: obieg wysyłki bez sieci (T20 audytu) ─────────────────────────────────────────────
const TICK_NOW = 1_800_000_000_000;
const storeWith = (items, updated = TICK_NOW) => ({ subs: { s1: { subscription: { endpoint: "https://fcm.googleapis.com/x", keys: {} }, items, updated } } });
const item = (key, at) => ({ key, at, title: key, body: "", url: "/", snooze: false });

test("tickStore: wysyła nadchodzące terminy raz i usuwa je z listy", async () => {
  const store = storeWith([item("a", TICK_NOW - 1000), item("później", TICK_NOW + 60_000)]);
  const sent = [];
  const dirty = await tickStore(store, TICK_NOW, async (id, _sub, payload) => { sent.push([id, JSON.parse(payload).key]); return "ok"; });
  assert.equal(dirty, true);
  assert.deepEqual(sent, [["s1", "a"]]);
  assert.deepEqual(store.subs.s1.items.map((i) => i.key), ["później"]);
  assert.equal(await tickStore(store, TICK_NOW, async () => "ok"), false); // nic więcej do zrobienia
});

test("tickStore: 410/404 usuwa subskrypcję, błąd 5xx tylko termin (bez ponawiania)", async () => {
  const gone = storeWith([item("a", TICK_NOW - 1000)]);
  await tickStore(gone, TICK_NOW, async () => "gone");
  assert.equal(gone.subs.s1, undefined);

  const failing = storeWith([item("a", TICK_NOW - 1000)]);
  await tickStore(failing, TICK_NOW, async () => "error");
  assert.ok(failing.subs.s1, "subskrypcja zostaje");
  assert.deepEqual(failing.subs.s1.items, [], "termin nie jest ponawiany");
});

test("tickStore: spóźnione terminy przepadają bez wysyłki, nieaktywne subskrypcje są usuwane", async () => {
  const late = storeWith([item("stary", TICK_NOW - LIMITS.lateMs - 1000)]);
  let calls = 0;
  assert.equal(await tickStore(late, TICK_NOW, async () => { calls++; return "ok"; }), true);
  assert.equal(calls, 0);
  assert.deepEqual(late.subs.s1.items, []);

  const stale = storeWith([item("a", TICK_NOW + 1000)], TICK_NOW - LIMITS.staleMs - 1000);
  assert.equal(await tickStore(stale, TICK_NOW, async () => "ok"), true);
  assert.equal(stale.subs.s1, undefined);
});
