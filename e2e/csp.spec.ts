import { test, expect, type Page } from "@playwright/test";
import { seedNotes } from "./helpers";

// Plan-nowy 1.11: CSP jest egzekwowane. `vite preview` wysyła nagłówki z vercel.json (vite.config.ts,
// `previewSecurityHeaders`), więc cały zestaw e2e biegnie pod tą polityką. Ten plik dodatkowo przechodzi
// po działach i sprawdza, że przeglądarka nie zgłosiła żadnego naruszenia (`securitypolicyviolation`).

const ROUTES = ["/", "/dzis", "/skrzynka", "/przypomnienia", "/kalendarz", "/grafik", "/praca", "/plany", "/dlugi", "/cwiczenia", "/tydzien", "/archiwum", "/kosz"];

async function collectViolations(page: Page) {
  await page.addInitScript(() => {
    const w = window as Window & { __csp?: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => w.__csp!.push(`${e.violatedDirective} ${e.blockedURI || "inline"}`));
  });
  return () => page.evaluate(() => (window as Window & { __csp?: string[] }).__csp ?? []);
}

test("nagłówek CSP jest egzekwowany, a Permissions-Policy pozwala tej stronie na kamerę i lokalizację", async ({ page }) => {
  const res = await page.goto("/");
  const headers = res!.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy-report-only"]).toBeUndefined();
  expect(headers["permissions-policy"]).toContain("camera=(self)");
  expect(headers["permissions-policy"]).toContain("geolocation=(self)");
});

async function seed(page: Page) {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await seedNotes(page, [
    { id: "c1", title: "Rewizja", content: "Pion w [[Łazienka]] i **pogrubienie**", color: "sky", pinned: true, archived: false, labels: ["dom"], createdAt: 1, updatedAt: 1 },
    { id: "c2", title: "Łazienka", content: "- [ ] klej", color: "default", pinned: false, archived: false, labels: [], createdAt: 2, updatedAt: 2 },
  ]);
}

for (const route of ROUTES) {
  test(`${route} nie łamie CSP`, async ({ page }) => {
    await seed(page);
    const violations = await collectViolations(page);
    await page.goto(route);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.locator(".view-skeleton")).toHaveCount(0);
    expect(await violations()).toEqual([]);
  });
}

test("kafle z Markdownem, edycja notatki i paleta poleceń nie łamią CSP", async ({ page }) => {
  await seed(page);
  const violations = await collectViolations(page);
  await page.goto("/");
  await page.locator('[data-note-id-wrap="c1"]').getByText("Rewizja", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Treść notatki..." })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await violations()).toEqual([]);
});

test("Matryca (kanwa) i Plany (obraz planu na kanwie) nie łamią CSP", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("matrix"));
  });
  const violations = await collectViolations(page);
  await page.goto("/plany");
  await page.getByTestId("plans-list").getByRole("button", { name: "Nowa analiza" }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400; c.height = 300;
    const x = c.getContext("2d")!;
    x.fillStyle = "#000"; x.fillRect(0, 0, 400, 300);
    x.strokeStyle = "#fff"; x.strokeRect(20, 20, 360, 260);
    return c.toDataURL("image/png").split(",")[1];
  });
  const dialog = page.getByTestId("plan-new");
  await dialog.getByTestId("plan-file").setInputFiles({ name: "Parter.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await dialog.getByRole("button", { name: "Utwórz analizę" }).click();
  await expect(page.getByTestId("plan-canvas")).toHaveAttribute("data-tx", /\d/);
  expect(await violations()).toEqual([]);
});
