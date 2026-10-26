import { test, expect } from "@playwright/test";

// K-3 (plan Kalendarza 3.4): na telefonie „Lista” pokazuje agendę miesiąca zamiast siatki; „Miesiąc” wraca.
test.use({ viewport: { width: 390, height: 844 } });

test("kalendarz na telefonie: Lista zamienia siatkę na agendę i wraca do Miesiąca", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/kalendarz");
  const group = page.getByRole("group", { name: "Widok na telefonie" });
  await group.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(group.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Agenda miesiąca")).toBeVisible();
  await expect(page.getByText("Brak terminów i zmian w tym miesiącu.")).toBeVisible();
  await group.getByRole("button", { name: "Miesiąc", exact: true }).click();
  await expect(page.getByLabel("Agenda miesiąca")).toBeHidden();
});
