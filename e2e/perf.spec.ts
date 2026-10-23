import { test, expect, type Page } from "@playwright/test";
import { makeBigVault } from "../src/test/fixtures/bigVault";
import { seedNotes } from "./helpers";

/**
 * Punkt odniesienia wydajności (plan rozbudowy, Faza 0). Nie blokuje zwykłego e2e:
 * uruchamiany tylko z `PERF=1`, np. `PERF=1 PERF_N=5000 npx playwright test perf.spec.ts`.
 * Siatka renderuje notatki partiami (`useProgressiveCount`), więc czas „ustabilizowania”
 * to moment, gdy liczba nagłówków przestaje rosnąć — nie pierwsza notatka.
 */
const N = Number(process.env.PERF_N ?? 1000);

/** Czeka, aż liczba nagłówków przestanie się zmieniać przez `quietMs`; zwraca ją. */
async function settle(page: Page, quietMs = 400, timeout = 60_000): Promise<number> {
  const count = () => page.getByRole("heading").count();
  let last = -1;
  let stableSince = Date.now();
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const now = await count();
    if (now !== last) {
      last = now;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= quietMs) {
      return now;
    }
    await page.waitForTimeout(50);
  }
  throw new Error("lista nie ustabilizowała się w czasie");
}

test.describe("wydajność przy dużej liczbie notatek", () => {
  test.skip(!process.env.PERF, "ustaw PERF=1, żeby uruchomić pomiary");
  test.setTimeout(180_000);

  test(`start, wyszukiwanie i otwarcie przy ${N} notatkach`, async ({ page }, testInfo) => {
    const notes = makeBigVault(N);
    await seedNotes(page, notes);

    const t0 = Date.now();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: notes[N - 1].title })).toBeVisible({ timeout: 60_000 });
    const firstMs = Date.now() - t0;
    const unfiltered = await settle(page);
    const settleMs = Date.now() - t0;

    const search = page.locator('input[aria-label="Szukaj w notatkach"]:visible');
    const t1 = Date.now();
    await search.fill("faktura");
    await settle(page);
    const searchMs = Date.now() - t1;

    await search.fill("");
    await expect.poll(async () => page.getByRole("heading").count(), { timeout: 60_000 }).toBeGreaterThan(unfiltered - 1);
    await settle(page);

    // Czytnik otwiera się z klawiatury (jak w reader.spec.ts): fokus na siatkę, Home, Spacja.
    const t2 = Date.now();
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Home");
    await page.keyboard.press(" ");
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 60_000 });
    const openMs = Date.now() - t2;

    const metrics = { notes: N, firstMs, settleMs, searchMs, openMs, headingsUnfiltered: unfiltered };
    console.log("PERF", JSON.stringify(metrics));
    await testInfo.attach("perf.json", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  });
});
