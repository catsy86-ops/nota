import { test, expect } from "@playwright/test";

// Bez przeładowań: po `goto` karta i tak wczytałaby wszystko z IndexedDB,
// a sprawdzamy, że zmiana dociera do już otwartej karty.
test("notatka i grafik z jednej karty pojawiają się w drugiej bez odświeżania @smoke", async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/");
  await b.goto("/");
  await expect(b.getByText("Zapisz notatkę...")).toBeVisible();

  const title = `Z innej karty ${Date.now()}`;
  await a.getByText("Zapisz notatkę...").click();
  await a.getByPlaceholder("Tytuł").fill(title);
  await a.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(a.getByText(title)).toBeVisible();
  await expect(b.getByText(title)).toBeVisible();

  // Grafik otwarty w obu kartach (nawigacja w aplikacji), dzień naniesiony w drugiej.
  await a.getByRole("button", { name: "Grafik", exact: true }).click();
  await b.getByRole("button", { name: "Grafik", exact: true }).click();
  await b.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await expect(a.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień/ }).first()).toBeVisible();
});
