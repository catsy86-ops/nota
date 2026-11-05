import { test, expect } from "@playwright/test";
import { seedNotes } from "./helpers";
import { editorBody } from "./helpers/editor";

// Terminy 3.4 (Plan-nowy 2.5): data w treści notatki jako podpowiedź w edytorze — nic nie ustawia się samo.
const NOW = new Date(2026, 10, 5, 12, 0); // czwartek
const T = NOW.getTime();

test("edytor: „w piątek o 10” w treści podpowiada termin, przycisk go ustawia, Cofnij zdejmuje", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedNotes(page, [{ id: "a", title: "Kuchnia", content: "Treść", color: "default", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T }]);
  await page.goto("/");
  const card = page.locator("[data-note-id]").filter({ hasText: "Kuchnia" });
  await card.getByText("Kuchnia", { exact: true }).click();
  await editorBody(card).fill("Odbiór kuchni w piątek o 10, zabrać klucze");

  const hint = page.getByTestId("date-hint");
  await expect(hint).toContainText("„w piątek o 10”");
  // Samo pojawienie się podpowiedzi niczego nie ustawia.
  await expect(card.getByRole("button", { name: "Ustaw przypomnienie" })).toBeVisible();

  await hint.getByRole("button", { name: "Ustaw przypomnienie" }).click();
  await expect(page.getByText(/Ustawiono przypomnienie:/)).toBeVisible();
  await expect(hint).toHaveCount(0);

  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByTestId("date-hint")).toBeVisible();
});

test("edytor: zwykłe liczby w treści nie dają podpowiedzi, a „×” ją chowa", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedNotes(page, [{ id: "a", title: "Zakupy", content: "Treść", color: "default", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T }]);
  await page.goto("/");
  const card = page.locator("[data-note-id]").filter({ hasText: "Zakupy" });
  await card.getByText("Zakupy", { exact: true }).click();
  await editorBody(card).fill("Kupić 3 worki cementu i 10 rur");
  await expect(page.getByTestId("date-hint")).toHaveCount(0);

  await editorBody(card).fill("Kupić cement jutro rano");
  await expect(page.getByTestId("date-hint")).toBeVisible();
  await page.getByRole("button", { name: "Ukryj podpowiedź terminu" }).click();
  await expect(page.getByTestId("date-hint")).toHaveCount(0);
});
