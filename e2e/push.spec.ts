import { test, expect, type Request } from "@playwright/test";

// Headless Chromium nie ma usługi push — subskrypcję podstawiamy, a serwer `push-server/` udaje `page.route`.
const SERVER = "https://push.test";
// Klucz publiczny P-256 (65 bajtów, base64url) — wystarczy do porównania w `enablePush`.
const TOKEN = "e2e-token-0123456789-abcdefghij";
const VAPID = "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

test("powiadomienia przy zamkniętej aplikacji: włączenie wysyła harmonogram, próbne i wyłączenie idą do serwera", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    let sub: object | null = null;
    const fake = (key: BufferSource) => ({
      endpoint: "https://fcm.googleapis.com/fcm/send/e2e",
      options: { applicationServerKey: key },
      toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/e2e", keys: { p256dh: "BPk", auth: "xyz" } }),
      unsubscribe: async () => { sub = null; return true; },
    });
    PushManager.prototype.getSubscription = async function () { return sub as PushSubscription | null; };
    PushManager.prototype.subscribe = async function (o?: PushSubscriptionOptionsInit) {
      sub = fake(o!.applicationServerKey as BufferSource);
      return sub as unknown as PushSubscription;
    };
  });

  const calls: Request[] = [];
  await page.route(`${SERVER}/**`, async (route) => {
    calls.push(route.request());
    const path = new URL(route.request().url()).pathname;
    if (path === "/vapid") return route.fulfill({ json: { publicKey: VAPID } });
    // Jak prawdziwy serwer: ścieżki zmieniające dane wymagają tokenu.
    if (route.request().headers().authorization !== `Bearer ${TOKEN}`) return route.fulfill({ status: 401, json: { error: "unauthorized" } });
    if (path === "/schedule") return route.fulfill({ json: { ok: true, items: 0 } });
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Ogólne" }).click();

  await page.getByLabel("Adres serwera powiadomień").fill("push.test/");
  // Bez tokenu nie da się włączyć.
  await expect(page.getByRole("button", { name: "Włącz", exact: true })).toBeDisabled();
  // Zły token: serwer odpowiada 401, a aplikacja mówi, co poprawić, i zostaje wyłączona.
  await page.getByLabel("Token serwera powiadomień").fill("zly-token");
  await page.getByRole("button", { name: "Włącz", exact: true }).click();
  await expect(page.getByText("Serwer odrzucił token")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Wyłączone" })).toBeVisible();

  await page.getByLabel("Token serwera powiadomień").fill(TOKEN);
  await page.getByRole("button", { name: "Włącz", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "zaplanowane terminy" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Adres serwera powiadomień")).toHaveValue(SERVER);

  // Każde żądanie do serwera (poza jawnym /vapid) niesie token, a token nie trafia do kopii zapasowej.
  for (const r of calls.filter((c) => new URL(c.url()).pathname !== "/vapid")) expect(r.headers().authorization, r.url()).toMatch(/^Bearer /);
  const stored = await page.evaluate(() => ({ token: localStorage.getItem("kaczy.push.token.v1"), prefs: localStorage.getItem("kaczy.push.v1") }));
  expect(stored.token).toContain(TOKEN);
  expect(stored.prefs).not.toContain(TOKEN);

  const put = calls.find((r) => r.method() === "PUT");
  expect(put?.url()).toBe(`${SERVER}/schedule`);
  const body = put!.postDataJSON() as { subscription: { endpoint: string }; items: unknown[] };
  expect(body.subscription.endpoint).toContain("fcm.googleapis.com");
  expect(Array.isArray(body.items)).toBe(true);

  await page.getByRole("button", { name: "Wyślij próbne" }).click();
  await expect.poll(() => calls.some((r) => r.url() === `${SERVER}/test`)).toBe(true);

  await page.getByRole("button", { name: "Wyłącz", exact: true }).click();
  await expect.poll(() => calls.some((r) => r.url() === `${SERVER}/unsubscribe`)).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "Wyłączone" })).toBeVisible();
});

test("błędny adres serwera nie włącza powiadomień", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Ogólne" }).click();
  await page.getByLabel("Adres serwera powiadomień").fill("http://serwer.pl");
  await page.getByLabel("Token serwera powiadomień").fill(TOKEN);
  await page.getByRole("button", { name: "Włącz", exact: true }).click();
  await expect(page.getByText("Wpisz adres serwera zaczynający się od https://")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Wyłączone" })).toBeVisible();
});
