import { test, expect, type Page } from "@playwright/test";

/** Nauka zapisuje się do IndexedDB (Yjs) asynchronicznie — przeładowanie dopiero po „Zapisano”. */
async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("dział Nauka: adres /nauka, pozycja w pasku bocznym i cztery zakładki @smoke", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nauka" }).first().click();
  await expect(page).toHaveURL(/\/nauka$/);
  await expect(page.getByTestId("study-view")).toBeVisible();
  await expect(page.getByTestId("mastery-count")).toHaveText("0");
  for (const name of ["Quiz", "Tablica", "Lista do nauki", "Dziennik"]) {
    await expect(page.getByRole("tab", { name })).toBeVisible();
  }
});

test("tablica: temat przechodzi między kolumnami i postęp przeżywa odświeżenie @smoke", async ({ page }) => {
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Tablica" }).click();
  await expect(page.getByTestId("count-todo")).toHaveText("18");

  await page.getByRole("button", { name: /Spadki kanalizacji: przenieś do „W trakcie”/ }).click();
  await page.getByRole("button", { name: /Spadki kanalizacji: przenieś do „Umiem”/ }).click();
  await expect(page.getByTestId("count-todo")).toHaveText("17");
  await expect(page.getByTestId("count-done")).toHaveText("1");
  await expect(page.getByTestId("mastery-count")).toHaveText("1");

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Tablica" }).click();
  await expect(page.getByTestId("count-done")).toHaveText("1");
});

test("lista do nauki: odhaczanie, filtr krytycznych i ściąga wysokości", async ({ page }) => {
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Lista do nauki" }).click();
  const progress = page.getByTestId("checklist-progress");
  await expect(progress).toContainText("0");

  await page.getByLabel(/Zdjęcia tras i punktów PRZED zakryciem/).check();
  await expect(progress).toContainText("1");

  await page.getByRole("button", { name: /Tylko punkty krytyczne/ }).click();
  await expect(page.getByText("Nasza rura to PERTAL²")).toHaveCount(0);
  await expect(page.getByText(/Tuleja nasunięta DO OPORU/)).toBeVisible();

  await page.getByText(/Ściąga: wysokości/).click();
  await expect(page.getByRole("cell", { name: "Prysznic" })).toBeVisible();
});

test("quiz: runda z 10 pytań kończy się wynikiem i zapisuje rundę", async ({ page }) => {
  await page.goto("/nauka");
  await page.getByRole("button", { name: "Zacznij rundę" }).click();

  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`Pytanie ${i} z 10`)).toBeVisible();
    await page.getByRole("group", { name: "Odpowiedzi" }).getByRole("button").first().click();
    await page.getByRole("button", { name: i < 10 ? "Dalej" : "Zobacz wynik" }).click();
  }

  await expect(page.getByRole("region", { name: "Wynik rundy" })).toBeVisible();
  await page.getByRole("button", { name: "Jeszcze raz" }).click();
  await expect(page.getByText("Pytanie 1 z 10")).toBeVisible();

  // Runda jest w dokumencie Yjs — przeżywa przeładowanie.
  await reloadWhenSaved(page);
  await expect(page.getByText(/Najlepszy wynik: \d+% · rund: 1/)).toBeVisible();
});

test("tablica: „Ćwicz” startuje rundę z jednego tematu, a „Zrób notatkę” dodaje notatkę", async ({ page }) => {
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Tablica" }).click();
  await page.getByRole("button", { name: "Spadki kanalizacji: ćwicz pytania" }).click();

  // Temat „Spadki” ma jedno pytanie — runda ma 1 pytanie i wraca do quizu.
  await expect(page.getByRole("tab", { name: "Quiz" })).toHaveAttribute("data-state", "active");
  await expect(page.getByText("Pytanie 1 z 1")).toBeVisible();
  await expect(page.getByText("Jaki typowy spadek zachowujemy")).toBeVisible();

  // Błędna odpowiedź trafia do „Powtórki błędów”.
  const options = page.getByRole("group", { name: "Odpowiedzi" }).getByRole("button");
  const wrong = options.filter({ hasNotText: "Ok. 2–3%" }).first();
  await wrong.click();
  await page.getByRole("button", { name: "Zobacz wynik" }).click();
  await page.getByRole("button", { name: "Wróć do wszystkich" }).click();
  await expect(page.getByRole("button", { name: /Powtórka błędów \(1\)/ })).toBeVisible();

  // Zakładki nie kasują stanu; notatka z tematu pojawia się na liście notatek.
  await page.getByRole("tab", { name: "Tablica" }).click();
  await page.getByRole("button", { name: "Spadki kanalizacji: zrób z tego notatkę" }).click();
  await expect(page.getByText("Dodano notatkę „Nauka: Spadki kanalizacji”")).toBeVisible();
  await page.getByRole("button", { name: "Notatki" }).first().click();
  await expect(page.getByRole("heading", { name: "Nauka: Spadki kanalizacji" })).toBeVisible();
});

test("dziennik z budowy: lista kontrolna tematu, wpis liczy praktykę, problem cofa temat z „Umiem”", async ({ page }) => {
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Tablica" }).click();
  await page.getByRole("button", { name: /Spadki kanalizacji: przenieś do „W trakcie”/ }).click();
  await page.getByRole("button", { name: /Spadki kanalizacji: przenieś do „Umiem”/ }).click();
  await expect(page.getByTestId("count-done")).toHaveText("1");

  // Z karty tematu prosto do dziennika, z już wybranym tematem.
  await page.getByRole("button", { name: "Spadki kanalizacji: wpis z budowy" }).click();
  await expect(page.getByRole("tab", { name: "Dziennik" })).toHaveAttribute("data-state", "active");
  await expect(page.getByLabel("Czego dotyczy")).toHaveValue("spadki");
  await expect(page.getByTestId("journal-topic-panel")).toContainText("Sprawdź przed przejściem dalej");

  await page.getByLabel("Inwestycja / adres").fill("Dom testowy");
  await page.getByLabel(/Zachowaj wymagany spadek/).check();
  await page.getByRole("radio", { name: "Problem" }).click();
  await page.getByLabel("Co się dzieje?").fill("Na odcinku do pionu spadek za mały");
  await page.getByRole("button", { name: "Dodaj wpis" }).click();

  const entry = page.locator('[data-journal-entry="problem"]');
  await expect(entry).toContainText("Na odcinku do pionu spadek za mały");
  await expect(entry).toContainText("punkty 1/1");
  await expect(entry).toContainText("Dom testowy");
  await expect(page.getByTestId("journal-week")).toContainText("1 wpis, 1 problem");

  // Problem na budowie cofnął temat z „Umiem” do „W trakcie” i widać go na karcie.
  await page.getByRole("tab", { name: "Tablica" }).click();
  await expect(page.getByTestId("count-done")).toHaveText("0");
  await expect(page.getByTestId("count-doing")).toHaveText("1");
  await expect(page.locator('[data-topic="spadki"]')).toContainText("budowa 0×, problemów 1");

  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.locator('[data-journal-entry="problem"]')).toHaveCount(1);
});

test("dziennik: niezapisany wpis ze zdjęciem przeżywa zmianę zakładki, „Wpis z budowy” i odświeżenie", async ({ page }) => {
  // 1×1 px PNG.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByLabel("Co się dzieje?").fill("Próba ciśnieniowa na 9 bar");
  await page.getByTestId("journal-photo-input").setInputFiles({ name: "budowa.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Dodaj wpis" })).toBeEnabled();

  // Wcześniej przejście na inną zakładkę albo „Wpis z budowy” z karty kasowało tekst i zdjęcia.
  await page.getByRole("tab", { name: "Tablica" }).click();
  await page.getByRole("button", { name: "Spadki kanalizacji: wpis z budowy" }).click();
  await expect(page.getByLabel("Czego dotyczy")).toHaveValue("spadki");
  await expect(page.getByLabel("Co się dzieje?")).toHaveValue("Próba ciśnieniowa na 9 bar");

  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.getByLabel("Co się dzieje?")).toHaveValue("Próba ciśnieniowa na 9 bar");
  await expect(page.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(1);

  await page.getByRole("button", { name: "Dodaj wpis" }).click();
  await expect(page.locator("[data-journal-entry]")).toContainText("Próba ciśnieniowa na 9 bar");
  await expect(page.getByRole("list", { name: "Zdjęcia wpisu" })).toHaveCount(1);
  // Po zapisie szkic pusty, temat zostaje.
  await expect(page.getByLabel("Co się dzieje?")).toHaveValue("");
  await expect(page.getByLabel("Czego dotyczy")).toHaveValue("spadki");
  await expect(page.getByRole("list", { name: "Zdjęcia we wpisie" })).toHaveCount(0);
});

test("dziennik: usunięcie wpisu ma Cofnij", async ({ page }) => {
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByLabel("Co się dzieje?").fill("Przejście przez ścianę w tulei");
  await page.getByRole("button", { name: "Dodaj wpis" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(1);

  await page.getByRole("button", { name: "Usuń wpis" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(0);
  await page.getByRole("listitem").filter({ hasText: "Usunięto wpis" }).getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(1);
});

test("dziennik: dyktowanie dopisuje rozpoznany tekst do wpisu", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.dictation.consent", "1");
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "trójniki rozsunięte trzydzieści centymetrów" } }] }), 30);
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Dziennik" }).click();

  await page.getByRole("button", { name: "Dyktuj" }).click();
  await expect(page.getByLabel("Co się dzieje?")).toHaveValue("trójniki rozsunięte trzydzieści centymetrów");
  await page.getByRole("button", { name: "Zakończ dyktowanie" }).click();

  await page.getByRole("button", { name: "Dodaj wpis" }).click();
  await expect(page.locator("[data-journal-entry]")).toContainText("trzydzieści centymetrów");
});

test("dawny zapis Nauki z localStorage przechodzi do dokumentu raz i bez strat", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      board: { spadki: "done" }, rounds: 2, bestPercent: 70,
      journal: [{ id: "stary-1", at: Date.now() - 3600_000, kind: "ok", topic: null, text: "Wpis sprzed migracji", site: "", checked: [], images: [] }],
    }));
  });
  await page.goto("/nauka");
  await expect(page.getByTestId("mastery-count")).toHaveText("1");
  await expect(page.getByText(/Najlepszy wynik: 70% · rund: 2/)).toBeVisible();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(1);

  // Usunięty po migracji wpis nie wraca z kopii w localStorage po przeładowaniu.
  await page.getByRole("button", { name: "Usuń wpis" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(0);
  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.getByText("Wpis sprzed migracji")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("kaczy.study.v1"))).toContain("stary-1");
});
