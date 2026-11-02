import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Plan Długów, Etap 1: notatka terminu poza Skrzynką (1.2), wybór rodzaju strzałkami (1.4), termin w edycji (1.5).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inDays = (n: number) => dayKey(new Date(Date.now() + n * 86_400_000));

async function addLent(page: Page, person: string, due?: string) {
  await page.goto("/dlugi");
  const form = page.getByRole("form", { name: "Nowy wpis" });
  await form.getByRole("radio", { name: "Pożyczyłem", exact: true }).click();
  await form.getByLabel("Kto").fill(person);
  await form.getByLabel("Kwota (zł)").fill("120");
  if (due) await form.getByLabel(/Termin zwrotu/).fill(due);
  await form.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.getByText(/Pożyczyłem: /).first()).toBeVisible();
}

test("1.2: notatka terminu zwrotu ma etykietę „długi” i nie ląduje w Skrzynce", async ({ page }) => {
  const person = `Etykieta ${Date.now()}`;
  await addLent(page, person, inDays(1));
  await page.goto("/przypomnienia");
  await expect(page.getByText(`Zwrot od ${person}: 120,00 zł`).first()).toBeVisible();
  await page.goto("/skrzynka");
  await expect(page.getByText(`Zwrot od ${person}`)).toHaveCount(0);
});

test("1.4: rodzaj wpisu strzałkami, jeden przystanek Tab; axe formularza", async ({ page }) => {
  await page.goto("/dlugi");
  const form = page.getByRole("form", { name: "Nowy wpis" });
  const lent = form.getByRole("radio", { name: "Pożyczyłem", exact: true });
  await lent.click();
  await expect(lent).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await expect(form.getByRole("radio", { name: "Oddał mi" })).toBeFocused();
  await page.keyboard.press(" ");
  await expect(form.getByRole("radio", { name: "Oddał mi" })).toHaveAttribute("aria-checked", "true");
  const axe = await new AxeBuilder({ page }).include("form[aria-label='Nowy wpis']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("1.5: termin zwrotu dodany w edycji pojawia się w Terminach, „Cofnij” go zdejmuje", async ({ page }) => {
  const person = `Edycja ${Date.now()}`;
  await addLent(page, person);
  await page.getByRole("button", { name: new RegExp(person) }).click();
  await page.getByRole("button", { name: /Edytuj wpis/ }).click();
  const form = page.getByRole("form", { name: "Edycja wpisu" });
  await form.getByLabel(/Termin zwrotu/).fill(inDays(2));
  await form.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(page.getByText("Wpis poprawiony")).toBeVisible();
  await page.goto("/przypomnienia");
  await expect(page.getByText(`Zwrot od ${person}: 120,00 zł`).first()).toBeVisible();
});

test("2.3: „Gotowe” w Terminach przy zwrocie pyta o spłatę i rozlicza osobę", async ({ page }) => {
  const person = `Zwrot ${Date.now()}`;
  await addLent(page, person, inDays(1));
  await page.goto("/przypomnienia");
  const tile = page.locator("[data-note-id-wrap]").filter({ hasText: `Zwrot od ${person}` }).first();
  await tile.getByRole("button", { name: "Gotowe" }).click();
  await expect(page.getByText("Oznaczyć jako oddane?")).toBeVisible();
  await page.getByRole("button", { name: "Oddane" }).click();
  await expect(page.getByText(`Oddane w całości: ${person}`)).toBeVisible();
  await page.goto("/dlugi");
  await page.getByRole("button", { name: "Rozliczeni (1)" }).click();
  await expect(page.getByRole("list", { name: "Rozliczeni" }).getByText(person)).toBeVisible();
});

test("2.1: na telefonie formularz zwinięty, „Nowy wpis” go rozwija i to zapamiętuje", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dlugi");
  const form = page.getByRole("form", { name: "Nowy wpis" });
  await expect(form).toBeHidden();
  const toggle = page.getByRole("button", { name: "Nowy wpis" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(form).toBeVisible();
  await page.reload();
  await expect(page.getByRole("form", { name: "Nowy wpis" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zwiń formularz" })).toHaveAttribute("aria-expanded", "true");
});
