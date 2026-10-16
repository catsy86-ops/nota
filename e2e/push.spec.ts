import { test, expect, type Request } from "@playwright/test";

// Headless Chromium nie ma usługi push — subskrypcję podstawiamy, a serwer `push-server/` udaje `page.route`.
const SERVER = "https://push.test";
// Klucz publiczny P-256 (65 bajtów, base64url) — wystarczy do porównania w `enablePush`.
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
    if (path === "/schedule") return route.fulfill({ json: { ok: true, items: 0 } });
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Ogólne" }).click();

  await page.getByLabel("Adres serwera powiadomień").fill("push.test/");
  await page.getByRole("button", { name: "Włącz", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "zaplanowane terminy" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Adres serwera powiadomień")).toHaveValue(SERVER);

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
  await page.getByRole("button", { name: "Włącz", exact: true }).click();
  await expect(page.getByText("Wpisz adres serwera zaczynający się od https://")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Wyłączone" })).toBeVisible();
});
