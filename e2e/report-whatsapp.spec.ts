import { test, expect } from "@playwright/test";

// Raport z budowy do szefa i do grupy przez WhatsApp (bez serwera):
// szef — czat `wa.me` z gotowym tekstem; grupa — systemowe „Udostępnij”,
// a bez niego tekst do schowka i otwarcie grupy z linku zaproszenia.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const w = window as unknown as Record<string, unknown>;
    w.open = (url: string) => { w.__opened = url; return null; };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => { w.__shared = data; } });
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const at = (h: number) => new Date(2026, 9, 14, h).getTime();
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        { id: "a", at: at(8), kind: "ok", topic: null, text: "Próba szczelności pionu", site: "Lipowa 5", checked: [], images: [] },
        { id: "b", at: at(10), kind: "problem", topic: null, text: "Żółta rura przecieka", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
});

async function openReport(page: import("@playwright/test").Page) {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Raport" }).click();
  return page.getByTestId("journal-report");
}

test("raport: szef i grupa WhatsApp — zapis odbiorców, czat z szefem, udostępnienie do grupy", async ({ page }) => {
  const dialog = await openReport(page);
  await dialog.getByRole("button", { name: "WhatsApp: dodaj szefa lub grupę" }).click();
  const form = dialog.getByRole("form", { name: "Odbiorcy raportu w WhatsApp" });
  await form.getByLabel("Imię").fill("Marek");
  await form.getByLabel("Numer WhatsApp").fill("12");
  await form.getByLabel("Nazwa grupy").fill("Brygada Lipowa");
  await form.getByLabel("Link zaproszenia (opcjonalnie)").fill("evil.com/abc");
  await form.getByRole("button", { name: "Zapisz" }).click();
  await expect(form.getByLabel("Numer WhatsApp")).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByLabel("Link zaproszenia (opcjonalnie)")).toHaveAttribute("aria-invalid", "true");

  await form.getByLabel("Numer WhatsApp").fill("600 100 200");
  await form.getByLabel("Link zaproszenia (opcjonalnie)").fill("chat.whatsapp.com/AbCdEf1234567890xyZ");
  await form.getByRole("button", { name: "Zapisz" }).click();
  await expect(form).toHaveCount(0);

  await dialog.getByRole("button", { name: "Szefowi (Marek)" }).click();
  const opened = await page.evaluate(() => (window as unknown as { __opened: string }).__opened);
  expect(opened).toMatch(/^https:\/\/wa\.me\/48600100200\?text=/);
  const text = decodeURIComponent(opened.split("?text=")[1]);
  expect(text.startsWith("*Raport: Lipowa 5")).toBe(true);
  expect(text).toContain("Problem otwarty: Żółta rura przecieka");
  expect(text).not.toMatch(/^#/m);

  await dialog.getByRole("button", { name: "Do grupy „Brygada Lipowa”" }).click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: ShareData }).__shared);
  expect(shared.text).toContain("*Raport: Lipowa 5");

  // Odbiorcy są w danych Pracy — przeżywają odświeżenie.
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
  const again = await openReport(page);
  await expect(again.getByRole("button", { name: "Szefowi (Marek)" })).toBeVisible();
});

test("raport do grupy bez udostępniania: tekst do schowka i otwarcie grupy z linku", async ({ page }) => {
  const dialog = await openReport(page);
  // Przeglądarka bez udostępniania (komputer) — przed otwarciem formularza, żeby okno przeliczyło `canShare`.
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await dialog.getByRole("button", { name: "WhatsApp: dodaj szefa lub grupę" }).click();
  const form = dialog.getByRole("form", { name: "Odbiorcy raportu w WhatsApp" });
  await form.getByLabel("Nazwa grupy").fill("Brygada");
  await form.getByLabel("Link zaproszenia (opcjonalnie)").fill("https://chat.whatsapp.com/AbCdEf1234567890xyZ");
  await form.getByRole("button", { name: "Zapisz" }).click();

  await dialog.getByRole("button", { name: "Do grupy „Brygada”" }).click();
  await expect(page.getByText("Skopiowano raport — wklej w grupie „Brygada”")).toBeVisible();
  const r = await page.evaluate(() => { const w = window as unknown as { __opened: string; __copied: string }; return { opened: w.__opened, copied: w.__copied }; });
  expect(r.opened).toBe("https://chat.whatsapp.com/AbCdEf1234567890xyZ");
  expect(r.copied).toContain("*Raport: Lipowa 5");
});
