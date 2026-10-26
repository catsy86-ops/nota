import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("długi: termin zwrotu tworzy notatkę z przypomnieniem w Terminach", async ({ page }) => {
  const person = `Dłużnik ${Date.now()}`;
  const tomorrow = new Date(Date.now() + 86_400_000);
  const due = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  await page.goto("/dlugi");
  const form = page.getByRole("form", { name: "Nowy wpis" });
  await form.getByRole("radio", { name: "Pożyczyłem", exact: true }).click();
  await form.getByLabel("Kto").fill(person);
  await form.getByLabel("Kwota (zł)").fill("120");
  await form.getByLabel(/Termin zwrotu/).fill(due);
  await form.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.getByText(/Pożyczyłem: /).first()).toBeVisible();

  await page.goto("/przypomnienia");
  await expect(page.getByText(`Zwrot od ${person}: 120,00 zł`).first()).toBeVisible();
});

test("długi: termin w przeszłości jest odrzucany", async ({ page }) => {
  await page.goto("/dlugi");
  const form = page.getByRole("form", { name: "Nowy wpis" });
  await form.getByRole("radio", { name: "Pożyczyłem", exact: true }).click();
  await form.getByLabel("Kto").fill("Przeszły");
  await form.getByLabel("Kwota (zł)").fill("10");
  await form.getByLabel(/Termin zwrotu/).fill("2020-01-01");
  await form.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.getByRole("alert")).toContainText("Termin zwrotu nie może być w przeszłości.");
});

async function addLentWithDue(page: import("@playwright/test").Page, person: string) {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const due = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await page.goto("/dlugi");
  const form = page.getByRole("form", { name: "Nowy wpis" });
  await form.getByRole("radio", { name: "Pożyczyłem", exact: true }).click();
  await form.getByLabel("Kto").fill(person);
  await form.getByLabel("Kwota (zł)").fill("120");
  await form.getByLabel(/Termin zwrotu/).fill(due);
  await form.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.getByText(/Pożyczyłem: /).first()).toBeVisible();
}

test("długi: oddanie w całości zdejmuje termin zwrotu z notatki (1.1)", async ({ page }) => {
  const person = `Spłacający ${Date.now()}`;
  await addLentWithDue(page, person);
  await page.goto("/przypomnienia");
  await expect(page.getByText(`Zwrot od ${person}: 120,00 zł`).first()).toBeVisible();

  await page.goto("/dlugi");
  await page.getByRole("button", { name: new RegExp(person) }).click();
  await page.getByRole("button", { name: /Oddał całość/ }).click();

  await page.goto("/przypomnienia");
  await expect(page.getByText(`Zwrot od ${person}: 120,00 zł`)).toHaveCount(0);
});

test("długi: usunięcie wpisu z terminem pyta o przypomnienie; „Zostaw” je zachowuje (D-4)", async ({ page }) => {
  const person = `Pytający ${Date.now()}`;
  await addLentWithDue(page, person);

  await page.goto("/dlugi");
  await page.getByRole("button", { name: new RegExp(person) }).click();
  await page.getByRole("button", { name: /^Usuń wpis: / }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Usunąć też przypomnienie o zwrocie?");
  await dialog.getByRole("button", { name: "Zostaw przypomnienie" }).click();

  await page.goto("/przypomnienia");
  await expect(page.getByText(`Zwrot od ${person}: 120,00 zł`).first()).toBeVisible();
});
