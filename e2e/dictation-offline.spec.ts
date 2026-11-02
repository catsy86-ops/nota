import { test, expect, type Page } from "@playwright/test";

// H6.1 dyktowanie na urządzeniu (bez internetu; przeglądarka pytana tylko po stuknięciu w Ustawieniach) i H6.2 tekst na żywo podczas nagrania — udawane Web Speech API
// z `available`/`install` i `processLocally`. Na prawdziwym telefonie nie sprawdzone (polecenie 2026-11-02).

test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

async function setup(page: Page, opts: { avail: string; local?: boolean; consent?: boolean; error?: string }) {
  await page.addInitScript((o) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (o.consent) localStorage.setItem("kaczy.dictation.consent", "1");
    if (o.local) localStorage.setItem("kaczy.dictation.local.v1", "1");
    const w = window as unknown as Record<string, unknown>;
    w.__avail = o.avail;
    w.__speech = ["próba na zimno"];
    w.__local = [] as boolean[];
    w.__availCalls = 0;
    class FakeRecognition {
      static available() { w.__availCalls = (w.__availCalls as number) + 1; return Promise.resolve(w.__avail); }
      static install() { w.__avail = "available"; return Promise.resolve(true); }
      lang = ""; continuous = false; interimResults = false; processLocally = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (w.__local as boolean[]).push(this.processLocally);
        if (o.error) { setTimeout(() => { this.onerror?.({ error: o.error }); this.onend?.(); }, 50); return; }
        const text = (w.__speech as string[]).shift();
        // Bez kolejnych zdań sesja słucha dalej (bez `onend`), jak przy ciszy przed limitem.
        if (text) setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] }), 50);
      }
      stop() { this.onend?.(); }
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
  }, opts);
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function openSheet(page: Page) {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis|Dodaj wpis)$/ }).first().click();
  return page.getByTestId("journal-entry-sheet");
}

test("H6.1: aplikacja sama nie pyta o rozpoznawanie na urządzeniu (w części Chromium wywraca kartę)", async ({ page }) => {
  await setup(page, { avail: "available", consent: true });
  const calls = () => page.evaluate(() => (window as unknown as { __availCalls: number }).__availCalls);
  await page.goto("/");
  expect(await calls()).toBe(0);
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Dyktuj", exact: true }).click();
  // Bez potwierdzonego polskiego dyktowanie idzie przez usługę przeglądarki.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __local: boolean[] }).__local)).toEqual([false]);
  expect(await calls()).toBe(0);
  await page.goto("/praca");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Ogólne" }).click();
  await expect(page.getByTestId("local-dictation")).toBeVisible();
  expect(await calls()).toBe(0);
});

test("H6.1: polski na urządzeniu — dyktowanie lokalnie, bez pytania o usługę Google", async ({ page }) => {
  await setup(page, { avail: "available", local: true });
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Dyktuj", exact: true }).click();
  await expect(page.getByText("Dyktowanie używa usługi przeglądarki")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __local: boolean[] }).__local)).toEqual([true]);
});

test("H6.1: bez internetu i bez pobranego polskiego — komunikat zamiast błędu sieci", async ({ page, context }) => {
  await setup(page, { avail: "downloadable", consent: true });
  const sheet = await openSheet(page);
  await context.setOffline(true);
  await sheet.getByRole("button", { name: "Dyktuj", exact: true }).click();
  await expect(page.getByText("Bez internetu dyktowanie wymaga pobranego polskiego")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __local: boolean[] }).__local)).toEqual([]);
  await context.setOffline(false);
});

test("H6.1: Ustawienia → Ogólne pobierają polski do dyktowania bez internetu", async ({ page }) => {
  await setup(page, { avail: "downloadable" });
  await page.goto("/praca");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Ogólne" }).click();
  const row = page.getByTestId("local-dictation");
  await row.getByRole("button", { name: "Sprawdź i pobierz polski" }).click();
  await expect(page.getByText("Polski jest na urządzeniu — dyktowanie działa bez internetu")).toBeVisible();
  await expect(row).toContainText("Polski na urządzeniu");
  expect(await page.evaluate(() => localStorage.getItem("kaczy.dictation.local.v1"))).toBe("1");
  await row.getByRole("button", { name: "Wyłącz" }).click();
  expect(await page.evaluate(() => localStorage.getItem("kaczy.dictation.local.v1"))).toBeNull();
});

test("H6.2: tekst na żywo podczas nagrania dopisuje zdanie do wpisu", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "sztuczny mikrofon tylko w Chromium");
  await setup(page, { avail: "available", local: true });
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Nagraj" }).click();
  const bar = page.getByTestId("voice-recording");
  const live = bar.getByTestId("voice-live-text");
  await expect(live).toHaveAttribute("aria-pressed", "false");
  await live.click();
  await expect(live).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("textbox").first()).toHaveValue("próba na zimno");
  await bar.getByRole("button", { name: "Zatrzymaj" }).click();
  await expect(bar).toHaveCount(0);
  // Wybór zapamiętany na następne nagranie.
  expect(await page.evaluate(() => localStorage.getItem("kaczy.voice.liveText.v1"))).toBe("1");
});

test("H6.2: mikrofon zajęty — tekst się wyłącza, nagranie trwa", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "sztuczny mikrofon tylko w Chromium");
  await setup(page, { avail: "available", local: true, error: "audio-capture" });
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Nagraj" }).click();
  const bar = page.getByTestId("voice-recording");
  await bar.getByTestId("voice-live-text").click();
  await expect(page.getByText("Tekst na żywo nie działa razem z nagraniem na tym urządzeniu")).toBeVisible();
  await expect(bar.getByTestId("voice-live-text")).toHaveAttribute("aria-pressed", "false");
  await expect(bar).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kaczy.voice.liveText.v1"))).toBeNull();
});
