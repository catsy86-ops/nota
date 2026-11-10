import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { inCard, inPapiery } from "./helpers";

// Protokół odbioru z karty budowy: wydruk z danymi budowy, etapami, próbą szczelności, uwagami i podpisami.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 16, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    // Zamiast okna drukowania: zapamiętaj, co poszłoby na papier.
    window.print = () => {
      w.__printed = document.documentElement.classList.contains("printing-report") ? document.getElementById("report-print")?.textContent : null;
    };
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const entry = (id: string, d: number, extra: Record<string, unknown>) => ({
      id, at: new Date(2026, 9, d, 9).getTime(), kind: "ok", topic: null, text: "Montaż", site: "Lipowa 5", checked: [], images: [], ...extra,
    });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        entry("a", 10, { text: "Próba pionów", test: { medium: "water", bar: 9, minutes: 30, drop: 0, ok: true } }),
        entry("b", 12, { kind: "problem", text: "Brak rewizji w łazience" }),
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("protokół odbioru: dane z karty, etap, próba szczelności, uwagi i podpisy na wydruku", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  // Wpisy z dwóch dni — nagłówek budowy jest w każdym dniu.
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");

  await (await inPapiery(card)).getByRole("button", { name: /^Edytuj dane/ }).click();
  await card.getByLabel("Adres").fill("ul. Lipowa 5, Kraków");
  await card.getByLabel("Inwestor", { exact: true }).fill("Jan Kowalski");
  await card.getByRole("button", { name: "Zapisz kartę" }).click();
  await (await inCard(card, "site-stages")).getByRole("checkbox", { name: /Próba szczelności/ }).click();

  await (await inPapiery(card)).getByRole("button", { name: "Protokół odbioru" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: string }).__printed)).toBeTruthy();
  const printed = await page.evaluate(() => (window as unknown as { __printed: string }).__printed);
  expect(printed).toContain("Protokół odbioru instalacji wodno-kanalizacyjnej");
  expect(printed).toContain("ul. Lipowa 5, Kraków");
  expect(printed).toContain("Jan Kowalski");
  expect(printed).toContain("Okres prac10–12 października 2026");
  expect(printed).toContain("Próba szczelności16.10.2026");
  expect(printed).toContain("Próba szczelności (woda, 9 bar, 30 min, spadek 0 bar): szczelna");
  expect(printed).toContain("Brak rewizji w łazience");
  expect(printed).toContain("Wykonawca — data i podpis");
  expect(printed).toContain("Inwestor — data i podpis");
});

test("tekst protokołu: bez udostępniania systemowego kopiuje się do schowka", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
  });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");
  await (await inPapiery(card)).getByRole("button", { name: "Tekst protokołu" }).click();
  await expect(page.getByText("Skopiowano tekst protokołu")).toBeVisible();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(copied.startsWith("# Protokół odbioru instalacji wod-kan — Lipowa 5")).toBe(true);
  expect(copied).toContain("Próba szczelności (woda, 9 bar, 30 min, spadek 0 bar): szczelna");
  expect(copied).toContain("## Uwagi\n- 12.10.2026 Brak rewizji w łazience");
});

async function png(page: Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 160; c.height = 120;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "hsl(200, 70%, 50%)";
    ctx.fillRect(0, 0, 160, 120);
    return c.toDataURL("image/png").split(",")[1];
  });
  return { name: "pod-posadzka.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") };
}

test("zdjęcia wpisu, który odhaczył etap, idą do protokołu przy tym etapie (po przeładowaniu)", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("radio", { name: "Zrobione" }).click();
  await sheet.getByTestId("journal-photo-input").setInputFiles([await png(page)]);
  await expect(sheet.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(1);
  await sheet.getByRole("button", { name: "Odhacz etap: Kanalizacja podposadzkowa" }).click();
  await expect(sheet.getByTestId("journal-entry-stage")).toContainText("Etap: Kanalizacja podposadzkowa");
  await expect(sheet.getByTestId("journal-stage-chips")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);

  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");
  await (await inPapiery(card)).getByRole("button", { name: "Protokół odbioru" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: string }).__printed)).toBeTruthy();
  await expect(page.locator("#report-print [data-handover-photo-group='Kanalizacja podposadzkowa'] img")).toHaveCount(1);
});

test("zapisany wpis ze zdjęciem można przypiąć do etapu w edycji — zdjęcie idzie do protokołu przy etapie", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Pion przed zakryciem");
  await sheet.getByTestId("journal-photo-input").setInputFiles([await png(page)]);
  await expect(sheet.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(1);
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);

  await page.locator("[data-journal-entry]").filter({ hasText: "Pion przed zakryciem" }).getByRole("button", { name: "Opcje wpisu" }).click();

  await page.getByRole("menuitem", { name: "Edytuj wpis" }).click();
  await sheet.getByLabel("Przypnij wpis do etapu").selectOption({ label: "Piony i podejścia kanalizacji" });
  await expect(sheet.getByTestId("journal-entry-stage")).toContainText("Piony i podejścia kanalizacji");
  await sheet.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(sheet).toHaveCount(0);

  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");
  // Przypięcie nie odhacza etapu w karcie.
  await expect((await inCard(card, "site-stages")).getByRole("checkbox", { name: /Piony i podejścia/ })).toHaveAttribute("aria-checked", "false");
  await (await inPapiery(card)).getByRole("button", { name: "Protokół odbioru" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: string }).__printed)).toBeTruthy();
  await expect(page.locator("#report-print [data-handover-photo-group='Piony i podejścia kanalizacji'] img")).toHaveCount(1);
});

test("punkty w protokole i w karcie „Przed wejściem” (H2.4, H2.2)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
  });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");
  const panel = (await inCard(card, "site-points"));
  await panel.getByRole("button", { name: /^\+ Kuchnia/ }).click();
  await panel.getByRole("checkbox", { name: "Zlew: próba" }).click();

  await (await inPapiery(card)).getByRole("button", { name: "Tekst protokołu" }).click();
  await expect(page.getByText("Skopiowano tekst protokołu")).toBeVisible();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(copied).toContain("## Punkty (0/2 gotowe)\n### Kuchnia\n- Zlew · Z C K · 48 cm — podejście 16.10.2026, próba 16.10.2026\n- Zmywarka · Z K — do zrobienia");

  await (await inPapiery(card)).getByRole("button", { name: "Protokół odbioru" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: string }).__printed)).toBeTruthy();
  const printed = await page.evaluate(() => (window as unknown as { __printed: string }).__printed);
  expect(printed).toContain("Punkty (0/2 gotowe)");
  expect(printed).toContain("Zmywarka");

  // Karta „Przed wejściem” mówi, co zostało na punktach tej budowy.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("entry-check-points")).toHaveText("Punkty: 1 do podejścia · 1 do montażu");
});

test("podpis klienta (P2.4): palcem w polu, na wydruku protokołu, usunięcie z „Cofnij”", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    // Oprócz tekstu zapamiętaj, czy na kartce stoi obraz podpisu (wczytany z magazynu).
    window.print = () => {
      const box = document.querySelector("[data-handover-signature]");
      w.__printed = document.getElementById("report-print")?.textContent;
      w.__signature = box?.getAttribute("data-handover-signature");
      w.__signatureImg = !!box?.querySelector("img[src^='blob:']");
    };
  });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");

  await (await inPapiery(card)).getByRole("button", { name: "Podpis klienta" }).click();
  const dialog = page.getByTestId("site-signature");
  await expect(dialog.getByRole("button", { name: "Zapisz podpis" })).toBeDisabled();
  const axe = await new AxeBuilder({ page }).include("[data-testid='site-signature']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await dialog.getByLabel("Imię i nazwisko podpisującego").fill("Jan Kowalski");
  const pad = await dialog.getByTestId("signature-pad").boundingBox();
  if (!pad) throw new Error("brak pola podpisu");
  await page.mouse.move(pad.x + 30, pad.y + 100);
  await page.mouse.down();
  for (const [dx, dy] of [[60, -40], [100, 10], [150, -30], [220, 5]]) await page.mouse.move(pad.x + dx, pad.y + 100 + dy, { steps: 4 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Zapisz podpis" }).click();
  await expect(page.getByText("Zapisano podpis — jest na protokole")).toBeVisible();
  await expect((await inCard(card, "site-signature-open"))).toHaveText("Podpisany");

  await (await inPapiery(card)).getByRole("button", { name: "Protokół odbioru" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: string }).__printed)).toBeTruthy();
  const out = await page.evaluate(() => {
    const w = window as unknown as { __printed: string; __signature: string; __signatureImg: boolean };
    return { __printed: w.__printed, __signature: w.__signature, __signatureImg: w.__signatureImg };
  });
  expect(out.__printed).toContain("Inwestor — Jan Kowalski, 16.10.2026");
  expect(out.__signature).toBe("signed");
  expect(out.__signatureImg).toBe(true);

  // Usunięcie: pole wraca do pustego, „Cofnij” przywraca ten sam podpis.
  await (await inCard(card, "site-signature-open")).click();
  await expect(page.getByTestId("site-signature-current").getByRole("img", { name: "Podpis: Jan Kowalski" })).toBeVisible();
  await page.getByTestId("site-signature").getByRole("button", { name: "Usuń podpis" }).click();
  await expect((await inCard(card, "site-signature-open"))).toHaveText("Podpis klienta");
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect((await inCard(card, "site-signature-open"))).toHaveText("Podpisany");
});
