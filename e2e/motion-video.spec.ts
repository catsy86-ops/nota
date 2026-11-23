import { test, expect, type CDPSession, type Page } from "@playwright/test";
import { copyFileSync, mkdirSync } from "node:fs";
import { seedNotes } from "./helpers";

// Plan ruchu M5.5: film z telefonu (Pixel 7, zwykłe tempo procesora) na ścieżkach z M2.1 — dowód dla właściciela,
// jak wygląda ruch po etapach M2–M4. Na żądanie: `VIDEO=1 npx playwright test e2e/motion-video.spec.ts --project=pixel-7`.
// Plik trafia do `test-results/motion-video.webm` (poza repozytorium).

test.skip(!process.env.VIDEO, "film tylko na żądanie (VIDEO=1)");
test.use({ video: { mode: "on", size: { width: 412, height: 839 } } });

const NOW = new Date(2026, 10, 23, 12, 0).getTime();
const NOTES = Array.from({ length: 60 }, (_, i) => ({
  id: `n${i}`, title: `Notatka ${i}`,
  content: `Treść notatki numer ${i}. ${"Kilka słów, żeby kafel miał dwie, trzy linijki. ".repeat(1 + (i % 3))}`,
  color: i % 5 ? "default" : "yellow", pinned: false, archived: false, labels: [],
  order: i, createdAt: NOW - i * 60_000, updatedAt: NOW - i * 60_000,
}));

async function touchDrag(cdp: CDPSession, page: Page, x: number, y: number, dx: number, dy: number, steps: number) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("ruch: film ścieżek M2.1 po etapach M2–M4 @mobile", async ({ page, browserName, isMobile }, testInfo) => {
  test.skip(browserName !== "chromium" || !isMobile, "dotyk przez CDP tylko w Chromium (pixel-7)");
  test.setTimeout(120_000);
  await seedNotes(page, NOTES);
  await page.goto("/");
  const cards = page.locator("[data-note-id-wrap]");
  await expect(cards.first()).toBeVisible();
  await page.waitForTimeout(1200);
  const cdp = await page.context().newCDPSession(page);

  // 1. Otwarcie notatki z kafla i powrót.
  await cards.nth(2).getByRole("heading").tap({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(1200);
  await page.goBack();
  await page.waitForTimeout(1000);

  // 2. Zmiana działu: przenikanie z dryfem, nagłówek i dolny pasek stoją.
  await page.getByRole("button", { name: "Dziś", exact: true }).first().tap();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Notatki", exact: true }).first().tap();
  await page.waitForTimeout(1200);

  // 3. Arkusz „Widok”: otwarcie i zsunięcie palcem (odjazd z prędkością palca).
  await page.getByRole("button", { name: "Widok i kolumny" }).tap();
  const sheet = page.getByRole("dialog", { name: "Widok" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(900);
  const handle = (await sheet.locator("[data-sheet-handle]").boundingBox())!;
  await touchDrag(cdp, page, handle.x + handle.width / 2, handle.y + handle.height / 2, 0, 260, 8);
  await expect(sheet).toBeHidden();
  await page.waitForTimeout(900);

  // 4. Przewijanie listy w dół i z powrotem.
  const vw = await page.evaluate(() => window.innerWidth);
  for (let i = 0; i < 4; i++) { await touchDrag(cdp, page, vw / 2, 650, 0, -450, 10); await page.waitForTimeout(250); }
  for (let i = 0; i < 4; i++) { await touchDrag(cdp, page, vw / 2, 250, 0, 450, 10); await page.waitForTimeout(250); }
  await page.waitForTimeout(800);

  const video = page.video();
  await page.close();
  if (video) {
    mkdirSync("test-results", { recursive: true });
    copyFileSync(await video.path(), "test-results/motion-video.webm");
    testInfo.annotations.push({ type: "film", description: "test-results/motion-video.webm" });
  }
});
