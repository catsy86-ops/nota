import { test } from "node:test";
import assert from "node:assert/strict";
import { parse as legacyParse } from "node:url";
import { bearerOf, cleanSubscription, clientIp, corsOrigin, createRateLimiter, isPushServiceUrl, LIMITS, normalizeEndpoint, parseOrigins, staleSubs, tokenOk } from "./core.js";

test("isPushServiceUrl: tylko https, port 443, bez danych logowania i obcych hostów", () => {
  assert.equal(isPushServiceUrl("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isPushServiceUrl("https://fcm.googleapis.com:443/fcm/send/abc"), true);
  // Próby skierowania serwera gdzie indziej (SSRF / otwarty przekaźnik).
  assert.equal(isPushServiceUrl("https://fcm.googleapis.com:8443/x"), false);
  assert.equal(isPushServiceUrl("https://user:pass@fcm.googleapis.com/x"), false);
  assert.equal(isPushServiceUrl("https://attacker@evil.example/@fcm.googleapis.com/x"), false);
  assert.equal(isPushServiceUrl("https://fcm.googleapis.com.evil.example/x"), false);
  assert.equal(isPushServiceUrl("https://evil.example/fcm.googleapis.com"), false);
  assert.equal(isPushServiceUrl("https://127.0.0.1/x"), false);
  assert.equal(isPushServiceUrl("https://localhost/x"), false);
  assert.equal(isPushServiceUrl("https://169.254.169.254/latest/meta-data"), false);
  assert.equal(isPushServiceUrl("https://[::1]/x"), false);
  assert.equal(isPushServiceUrl("https://fcm.googleapis.com./x"), false);
  assert.equal(isPushServiceUrl("ftp://fcm.googleapis.com/x"), false);
  assert.equal(isPushServiceUrl(""), false);
});

test("tokenOk: zgodny token tak, reszta nie (także puste i nie-teksty)", () => {
  assert.equal(tokenOk("sekret-0123456789abcdef-xyz", "sekret-0123456789abcdef-xyz"), true);
  assert.equal(tokenOk("sekret-0123456789abcdef-xyZ", "sekret-0123456789abcdef-xyz"), false);
  assert.equal(tokenOk("", "sekret"), false);
  assert.equal(tokenOk("sekret", ""), false);
  assert.equal(tokenOk(undefined, "sekret"), false);
  assert.equal(tokenOk("sekret", null), false);
});

test("bearerOf: wyciąga token tylko z poprawnego nagłówka", () => {
  assert.equal(bearerOf("Bearer abc123"), "abc123");
  assert.equal(bearerOf("bearer abc123"), "abc123");
  assert.equal(bearerOf("Basic abc123"), "");
  assert.equal(bearerOf("Bearer"), "");
  assert.equal(bearerOf("Bearer a b"), "");
  assert.equal(bearerOf(undefined), "");
  assert.equal(bearerOf(`Bearer ${"x".repeat(600)}`), "");
});

test("CORS: domyślnie nic nie przepuszcza; tylko wymienione adresy; * tylko wprost", () => {
  assert.deepEqual(parseOrigins(undefined), []);
  assert.deepEqual(parseOrigins(" https://a.pl , https://b.pl,, "), ["https://a.pl", "https://b.pl"]);
  assert.equal(corsOrigin("https://a.pl", []), null);
  assert.equal(corsOrigin(undefined, []), null);
  assert.equal(corsOrigin("https://a.pl", ["https://a.pl"]), "https://a.pl");
  assert.equal(corsOrigin("https://evil.pl", ["https://a.pl"]), null);
  assert.equal(corsOrigin("https://a.pl.evil.pl", ["https://a.pl"]), null);
  assert.equal(corsOrigin("https://evil.pl", ["*"]), "*");
});

test("clientIp: bez zaufanego proxy liczy się adres połączenia; za proxy ostatni wpis X-Forwarded-For", () => {
  assert.equal(clientIp("10.0.0.5", "1.2.3.4", false), "10.0.0.5");
  assert.equal(clientIp("10.0.0.5", "1.2.3.4", true), "1.2.3.4");
  // Podrobiony pierwszy wpis nie daje obejścia limitu: liczy się ten dopisany przez nasze proxy.
  assert.equal(clientIp("10.0.0.5", "9.9.9.9, 1.2.3.4", true), "1.2.3.4");
  assert.equal(clientIp("10.0.0.5", undefined, true), "10.0.0.5");
  assert.equal(clientIp(undefined, undefined, false), "unknown");
});

test("createRateLimiter: okno przesuwne, osobne klucze, Retry-After", () => {
  const l = createRateLimiter({ windowMs: 1000, max: 3 });
  assert.equal(l.hit("a", 0).ok, true);
  assert.equal(l.hit("a", 100).ok, true);
  assert.equal(l.hit("a", 200).ok, true);
  const blocked = l.hit("a", 300);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfterSec, 1);
  assert.equal(l.hit("b", 300).ok, true); // inny klucz
  assert.equal(l.hit("a", 1001).ok, true); // pierwsze zdarzenie wypadło z okna
});

test("createRateLimiter: check nie zużywa limitu, record zużywa", () => {
  const l = createRateLimiter({ windowMs: 1000, max: 2 });
  for (let i = 0; i < 5; i++) assert.equal(l.check("k", 0).ok, true);
  l.record("k", 0);
  l.record("k", 1);
  assert.equal(l.check("k", 2).ok, false);
});

test("createRateLimiter: liczba kluczy jest ograniczona, a sweep czyści wygasłe", () => {
  const l = createRateLimiter({ windowMs: 1000, max: 5, maxKeys: 10 });
  for (let i = 0; i < 50; i++) l.hit(`ip-${i}`, i);
  assert.ok(l.size() <= 10, `za dużo kluczy: ${l.size()}`);
  l.sweep(10_000);
  assert.equal(l.size(), 0);
});

test("normalizeEndpoint: rozbieżność parserów (WHATWG vs url.parse w web-push) nie daje SSRF", () => {
  // `url.parse` kończy hosta na `;`, `!`, `$`, `&`, `'`, `"` itd.; WHATWG zostawia je w nazwie hosta.
  const attacks = [
    "https://127.0.0.1;x.notify.windows.com/p",
    "https://169.254.169.254;a.push.apple.com/x",
    "https://10.0.0.5!x.push.services.mozilla.com/",
    "https://localhost$x.notify.windows.com/",
    "https://evil.com&a.push.apple.com/",
    "https://evil.com,a.notify.windows.com/",
    "https://evil.com'a.push.apple.com/",
    "https://evil.com_a.notify.windows.com/",
    "https://evil.com~a.push.apple.com/",
    "https://evil.com=a.notify.windows.com/",
    "https://fcm.googleapis.com\\x",
    "https:\tfcm.googleapis.com/x",
    "https://fcm.googleapis.com/x y",
    "https://fcm.googleapis.com/x\ny",
    "https://fcm.googleapis.com/\u00e9",
    "https://\u00e9.notify.windows.com/",
    "https://.notify.windows.com/",
    "https://-a.notify.windows.com/",
  ];
  for (const e of attacks) assert.equal(normalizeEndpoint(e), null, e);
  // Każdy przyjęty adres ma ten sam host i port w obu parserach (to, co faktycznie wykona web-push).
  for (const e of ["https://fcm.googleapis.com/fcm/send/abc-DEF_123:xyz", "https://updates.push.services.mozilla.com/wpush/v2/AbC", "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA%2BCw%3D%3D", "https://web.push.apple.com/QAB"]) {
    const href = normalizeEndpoint(e);
    assert.ok(href, e);
    const legacy = legacyParse(href);
    assert.equal(legacy.hostname, new URL(href).hostname);
    assert.ok(legacy.port === null || legacy.port === "443");
  }
});

test("cleanSubscription: zapisuje znormalizowany adres (wielkość liter hosta), a odrzuca obejścia", () => {
  const keys = { p256dh: "BPk", auth: "xyz" };
  assert.equal(cleanSubscription({ endpoint: "https://FCM.googleapis.com/fcm/send/abc", keys }).endpoint, "https://fcm.googleapis.com/fcm/send/abc");
  assert.equal(cleanSubscription({ endpoint: "https://127.0.0.1;x.notify.windows.com/p", keys }), null);
});

test("staleSubs: martwe subskrypcje (bez aktywności ponad 60 dni) do sprzątnięcia", () => {
  const now = 10 * LIMITS.staleMs;
  const store = { subs: { stara: { updated: now - LIMITS.staleMs - 1, items: [] }, swieza: { updated: now - 1000, items: [] }, bez: { items: [] } } };
  assert.deepEqual(staleSubs(store, now).sort(), ["bez", "stara"]);
});
