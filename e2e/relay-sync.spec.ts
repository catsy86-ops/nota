import { test, expect } from "@playwright/test";

// Przekaźnik z prawdziwym serwerem (webServer w playwright.config.ts, port 4466).
// Urządzenie A zapisuje notatkę i zamyka się; B z tym samym kodem dostaje ją przez przekaźnik.
// Signaling P2P wskazuje na zamknięty port, więc jedyną drogą jest przekaźnik.

const RELAY = "http://127.0.0.1:4466";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  return Array.from({ length: 12 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
}

async function init(page: import("@playwright/test").Page, code: string) {
  await page.addInitScript(
    ([c, relay]) => {
      localStorage.setItem("kaczy.tour.seen.v1", "1");
      localStorage.setItem("kaczy.relay.v1", relay);
      localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code: c, signaling: ["ws://127.0.0.1:9"] }));
    },
    [code, RELAY],
  );
}

test("notatka z A trafia na B przez przekaźnik, gdy A jest już wyłączone", async ({ browser }) => {
  const code = randomCode();
  const title = `Z przekaźnika ${code.slice(0, 4)}`;

  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await init(a, code);
  await a.goto("/");
  await a.getByText("Zapisz notatkę...").click();
  await a.getByPlaceholder("Tytuł").fill(title);
  // Czekamy na POST wywołany PO zapisie notatki (pierwszy POST po starcie niesie stan początkowy).
  const posted = a.waitForResponse(
    (r) => r.url().startsWith(RELAY) && r.url().includes("/updates") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await a.getByRole("button", { name: "Zapisz", exact: true }).click();
  expect((await posted).ok()).toBe(true);
  await ctxA.close();

  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await init(b, code);
  await b.goto("/");
  await expect(b.getByText(title).first()).toBeVisible({ timeout: 30_000 });
  await ctxB.close();
});

test("kod z innym pokojem nie widzi notatki z przekaźnika", async ({ browser }) => {
  const code = randomCode();
  const other = randomCode();
  const title = `Tajne ${code.slice(0, 4)}`;

  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await init(a, code);
  await a.goto("/");
  await a.getByText("Zapisz notatkę...").click();
  await a.getByPlaceholder("Tytuł").fill(title);
  const posted = a.waitForResponse(
    (r) => r.url().startsWith(RELAY) && r.url().includes("/updates") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await a.getByRole("button", { name: "Zapisz", exact: true }).click();
  await posted;
  await ctxA.close();

  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await init(b, other);
  await b.goto("/");
  // Dajemy czas na pobranie (drugi pokój jest pusty) — notatki obcego kodu nie ma.
  await b.waitForTimeout(3_000);
  await expect(b.getByText(title)).toHaveCount(0);
  await ctxB.close();
});
