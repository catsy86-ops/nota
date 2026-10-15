import { test, expect, type Page } from "@playwright/test";

/** Nauka zapisuje się do IndexedDB (Yjs) asynchronicznie — przeładowanie dopiero po „Zapisano”. */
async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

/** Zakładka Dziennik i arkusz nowego wpisu (albo szkicu). */
async function openEntry(page: Page) {
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  await expect(page.getByTestId("journal-entry-sheet")).toBeVisible();
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
  for (const name of ["Quiz", "Tablica", "Lista", "Dziennik"]) {
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
  // Pasek opanowania: odcinek modułu z licznikiem, komórka podpisuje temat.
  await expect(page.locator('[data-mastery-module="kan"]')).toContainText(/Kanalizacja\s*1\//);
  await page.getByRole("button", { name: "Spadki kanalizacji: umiem" }).click();
  await expect(page.getByTestId("mastery-picked")).toHaveText("Spadki kanalizacji · umiem");

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Tablica" }).click();
  await expect(page.getByTestId("count-done")).toHaveText("1");
});

test("lista do nauki: odhaczanie, filtr krytycznych i ściąga wysokości", async ({ page }) => {
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Lista" }).click();
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
  await page.getByRole("button", { name: "Spadki kanalizacji: do notatki" }).click();
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

  // Z karty tematu prosto do arkusza wpisu, z już wybranym i rozwiniętym tematem.
  await page.getByRole("button", { name: "Spadki kanalizacji: wpis z budowy" }).click();
  await expect(page.getByRole("tab", { name: "Dziennik", includeHidden: true })).toHaveAttribute("data-state", "active");
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByLabel("Czego dotyczy")).toHaveValue("spadki");
  await expect(sheet.getByTestId("journal-topic-panel")).toContainText("Sprawdź przed przejściem dalej");

  await sheet.getByRole("button", { name: "Dodaj budowę" }).click();
  await sheet.getByLabel("Inwestycja / adres").fill("Dom testowy");
  await sheet.getByLabel("Inwestycja / adres").press("Enter");
  await expect(sheet.getByRole("button", { name: "Budowa: Dom testowy. Zmień" })).toBeVisible();
  await sheet.getByLabel(/Zachowaj wymagany spadek/).check();
  await expect(sheet.getByRole("button", { name: /Temat:/ })).toContainText("1/1");
  await sheet.getByRole("radio", { name: "Problem" }).click();
  await sheet.getByLabel("Co się dzieje?").fill("Na odcinku do pionu spadek za mały");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);

  const entry = page.locator('[data-journal-entry="problem"]');
  await expect(entry).toContainText("Na odcinku do pionu spadek za mały");
  await expect(entry).toContainText("punkty 1/1");
  await expect(page.locator("[data-journal-site]")).toHaveText(["Dom testowy"]);
  await expect(page.getByTestId("journal-week")).toContainText("1 wpis, 1 problem");

  // Problem na budowie cofnął temat z „Umiem” do „W trakcie” i widać go na karcie.
  await page.getByRole("tab", { name: "Tablica" }).click();
  await expect(page.getByTestId("count-done")).toHaveText("0");
  await expect(page.getByTestId("count-doing")).toHaveText("1");
  await expect(page.locator('[data-topic="spadki"]')).toContainText("budowa 0×, problemów 1");

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.locator('[data-journal-entry="problem"]')).toHaveCount(1);
});

test("dziennik: niezapisany wpis ze zdjęciem przeżywa zamknięcie arkusza, „Wpis z budowy” i odświeżenie", async ({ page }) => {
  // 1×1 px PNG.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.goto("/nauka");
  await openEntry(page);
  const sheet = page.getByTestId("journal-entry-sheet");
  // Temat zwinięty: na budowie najpierw rodzaj, tekst i zdjęcie.
  await expect(sheet.getByRole("button", { name: /Temat:/ })).toHaveAttribute("aria-expanded", "false");
  await sheet.getByLabel("Co się dzieje?").fill("Próba ciśnieniowa na 9 bar");
  await sheet.getByTestId("journal-photo-input").setInputFiles({ name: "budowa.png", mimeType: "image/png", buffer: png });
  await expect(sheet.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(1);
  await expect(sheet.getByRole("button", { name: "Zapisz wpis" })).toBeEnabled();

  // Zamknięcie arkusza i „Wpis z budowy” z karty nie kasują tekstu ani zdjęć.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dokończ wpis" })).toBeVisible();
  await page.getByRole("tab", { name: "Tablica" }).click();
  await page.getByRole("button", { name: "Spadki kanalizacji: wpis z budowy" }).click();
  await expect(sheet.getByLabel("Czego dotyczy")).toHaveValue("spadki");
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("Próba ciśnieniowa na 9 bar");

  await page.reload();
  await openEntry(page);
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("Próba ciśnieniowa na 9 bar");
  await expect(sheet.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(1);

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.locator("[data-journal-entry]")).toContainText("Próba ciśnieniowa na 9 bar");
  await expect(page.getByRole("list", { name: "Zdjęcia wpisu" })).toHaveCount(1);
  // Po zapisie szkic pusty, temat zostaje.
  await openEntry(page);
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("");
  await expect(sheet.getByRole("button", { name: /Temat:/ })).toContainText("Spadki kanalizacji");
  await expect(sheet.getByRole("list", { name: "Zdjęcia we wpisie" })).toHaveCount(0);
});

test("dziennik: pusty wpis się nie zapisuje, usunięcie wpisu w arkuszu ma Cofnij", async ({ page }) => {
  await page.goto("/nauka");
  await openEntry(page);
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.getByText("Wpisz, co się dzieje, dodaj zdjęcie albo zaznacz sprawdzone punkty")).toBeVisible();
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Co się dzieje?").fill("Przejście przez ścianę w tulei");
  await sheet.getByLabel("Co się dzieje?").press("Control+Enter");
  await expect(page.locator("[data-journal-entry]")).toHaveCount(1);

  // Kosza na liście nie ma — usuwa się w arkuszu edycji.
  await expect(page.getByRole("button", { name: "Usuń wpis" })).toHaveCount(0);
  await page.getByRole("button", { name: "Edytuj wpis" }).click();
  await expect(sheet.getByRole("heading", { name: "Edytuj wpis" })).toBeVisible();
  await sheet.getByRole("button", { name: "Usuń" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator("[data-journal-entry]")).toHaveCount(0);
  await page.getByRole("listitem").filter({ hasText: "Usunięto wpis" }).getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(1);
});

test("dziennik: wpis „za wczoraj”, poprawka w arkuszu bez ruszania szkicu, problem rozwiązany", async ({ page }) => {
  await page.goto("/nauka");
  await openEntry(page);
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByRole("button", { name: "Kiedy: teraz. Zmień" })).toBeVisible();
  await sheet.getByRole("button", { name: "Kiedy: teraz. Zmień" }).click();
  const yesterday = await page.evaluate(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(16, 30, 0, 0);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T16:30`, label: d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" }) };
  });
  await sheet.getByLabel("Kiedy").fill(yesterday.value);
  await sheet.getByLabel("Kiedy").press("Enter");
  await expect(sheet.getByRole("button", { name: "Kiedy: wczoraj, 16:30. Zmień" })).toBeVisible();
  await sheet.getByRole("radio", { name: "Problem" }).click();
  await sheet.getByLabel("Co się dzieje?").fill("Przeciek na złączce");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();

  const entry = page.locator('[data-journal-entry="problem"]');
  await expect(entry).toContainText("16:30");
  await expect(page.getByRole("heading", { name: yesterday.label })).toBeVisible();
  await expect(page.getByTestId("journal-open-problems")).toContainText("Otwarte problemy: 1");

  // Niezapisany szkic nowego wpisu czeka, a edycja starego go nie dotyka.
  await openEntry(page);
  await expect(sheet.getByRole("button", { name: "Kiedy: teraz. Zmień" })).toBeVisible();
  await sheet.getByLabel("Co się dzieje?").fill("Szkic na później");
  await page.keyboard.press("Escape");
  await entry.getByRole("button", { name: "Edytuj wpis" }).click();
  await expect(sheet.getByRole("heading", { name: "Edytuj wpis" })).toBeVisible();
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("Przeciek na złączce");
  await expect(sheet.getByRole("button", { name: "Kiedy: wczoraj, 16:30. Zmień" })).toBeVisible();
  await sheet.getByLabel("Co się dzieje?").fill("Przeciek na złączce — dokręcona");
  await sheet.getByLabel("Problem rozwiązany").check();
  await sheet.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(entry).toContainText("Przeciek na złączce — dokręcona");
  await expect(entry).toContainText("Problem rozwiązany");
  await expect(page.getByTestId("journal-open-problems")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dokończ wpis" })).toBeVisible();

  // Z listy: problem wraca do otwartych i znów da się go zamknąć; stan przeżywa odświeżenie.
  await entry.getByRole("button", { name: "Otwórz ponownie" }).click();
  await expect(page.getByTestId("journal-open-problems")).toContainText("Otwarte problemy: 1");
  await entry.getByRole("button", { name: "Oznacz jako rozwiązany" }).click();
  await expect(page.getByTestId("journal-open-problems")).toHaveCount(0);
  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.locator('[data-journal-entry="problem"][data-resolved]')).toHaveCount(1);
  await openEntry(page);
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("Szkic na później");
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
  await openEntry(page);
  const sheet = page.getByTestId("journal-entry-sheet");

  await sheet.getByRole("button", { name: "Dyktuj" }).click();
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("trójniki rozsunięte trzydzieści centymetrów");
  await sheet.getByRole("button", { name: "Zakończ dyktowanie" }).click();

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.locator("[data-journal-entry]")).toContainText("trzydzieści centymetrów");
});

test.describe("dziennik na telefonie", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("„+” w dolnym pasku i skrót z ekranu głównego otwierają arkusz wpisu od dołu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/nauka?wpis=1");
    const sheet = page.getByTestId("journal-entry-sheet");
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/\/nauka$/);
    await expect(page.getByRole("tab", { name: "Dziennik", includeHidden: true })).toHaveAttribute("data-state", "active");
    // Na dotyku: aparat i galeria osobno, duże cele rodzaju wpisu.
    await expect(sheet.getByRole("button", { name: "Aparat" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Galeria" })).toBeVisible();
    await expect(sheet.getByTestId("journal-camera-input")).toHaveAttribute("capture", "environment");
    const box = await sheet.getByRole("radio", { name: "Problem" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(60);
    // Przycisk zapisu przy dolnej krawędzi arkusza, w zasięgu kciuka.
    const cta = await sheet.getByRole("button", { name: "Zapisz wpis" }).boundingBox();
    expect(cta!.y + cta!.height).toBeGreaterThan(844 - 90);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await page.getByRole("tab", { name: "Quiz" }).click();
    await page.getByRole("button", { name: "Nowy wpis z budowy" }).click();
    await expect(sheet).toBeVisible();
    await expect(page.getByRole("tab", { name: "Dziennik", includeHidden: true })).toHaveAttribute("data-state", "active");
  });

  test("bez internetu podpowiada mikrofon klawiatury", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/nauka?wpis=1");
    await expect(page.getByTestId("journal-entry-sheet")).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByTestId("dictation-hint")).toContainText("mikrofonem na klawiaturze");
    await context.setOffline(false);
  });
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
  await page.getByRole("button", { name: "Edytuj wpis" }).click();
  await page.getByTestId("journal-entry-sheet").getByRole("button", { name: "Usuń" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(0);
  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.getByText("Wpis sprzed migracji")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("kaczy.study.v1"))).toContain("stary-1");
});

test("dziennik: oś czasu dzień → budowa, szukanie bez ogonków, filtry i „Pokaż starsze”", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const h = 3600_000;
    const now = Date.now();
    const e = (id: string, at: number, kind: string, site: string, text: string) => ({ id, at, kind, topic: null, text, site, checked: [], images: [] });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        e("a", now - 60_000, "ok", "Lipowa 5", "Próba szczelności pionu"),
        e("b", now - 2 * 60_000, "problem", "Polna 2", "Żółta rura przecieka"),
        e("c", now - 45 * 24 * h, "note", "Lipowa 5", "Stary wpis z lata"),
      ],
    }));
  });
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const journal = page.getByTestId("study-journal");

  // Ostatnie 30 dni, w dniu grupy budów; starszy wpis za przyciskiem.
  await expect(journal.locator("[data-journal-entry]")).toHaveCount(2);
  await expect(journal.locator("[data-journal-site]")).toHaveText(["Lipowa 5", "Polna 2"]);
  await journal.getByRole("button", { name: "Pokaż starsze (1 wpis)" }).click();
  await expect(journal.getByText("Stary wpis z lata")).toBeVisible();

  // Szukanie bez ogonków przeszukuje cały dziennik.
  const search = journal.getByRole("searchbox", { name: "Szukaj w dzienniku" });
  await search.fill("zolta");
  await expect(journal.locator("[data-journal-entry]")).toHaveCount(1);
  await expect(journal.getByTestId("journal-results")).toContainText("Pasuje: 1 wpis");
  await search.fill("lata");
  await expect(journal.getByText("Stary wpis z lata")).toBeVisible();
  await journal.getByRole("button", { name: "Wyczyść filtry" }).click();

  // Budowa i rodzaj.
  await journal.getByRole("group", { name: "Budowa" }).getByRole("button", { name: "Lipowa 5" }).click();
  await expect(journal.locator("[data-journal-entry]")).toHaveCount(2);
  await journal.getByRole("button", { name: "Zrobione", exact: true }).click();
  await expect(journal.locator("[data-journal-entry]")).toHaveCount(1);
  await expect(journal.getByText("Próba szczelności pionu")).toBeVisible();
  await journal.getByRole("button", { name: "Wyczyść filtry" }).click();

  // Licznik otwartych problemów filtruje do nich.
  await journal.getByTestId("journal-open-problems").click();
  await expect(journal.locator("[data-journal-entry]")).toHaveCount(1);
  await expect(journal.getByText("Żółta rura przecieka")).toBeVisible();
  await journal.getByRole("button", { name: "Oznacz jako rozwiązany" }).click();
  await expect(journal.getByText("Nic nie pasuje. Zmień słowa albo wyczyść filtry.")).toBeVisible();

  // Nowy wpis: ostatnie budowy pigułkami, przy wpisywaniu tylko pasujące.
  await journal.getByRole("button", { name: "Wpis", exact: true }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  const chips = sheet.getByTestId("journal-site-chips");
  await expect(chips.getByRole("button")).toHaveText(["Lipowa 5", "Polna 2"]);
  await chips.getByRole("button", { name: "Polna 2" }).click();
  await expect(sheet.getByRole("button", { name: "Budowa: Polna 2. Zmień" })).toBeVisible();
  await sheet.getByRole("button", { name: "Budowa: Polna 2. Zmień" }).click();
  await expect(chips.getByRole("button")).toHaveText(["Lipowa 5"]);
  await sheet.getByLabel("Inwestycja / adres").fill("pol");
  await expect(chips.getByRole("button")).toHaveText(["Polna 2"]);
  await chips.getByRole("button", { name: "Polna 2" }).click();
  await expect(sheet.getByRole("button", { name: "Budowa: Polna 2. Zmień" })).toBeVisible();
});

test("dziennik: raport budowy z godzinami z Grafiku — udostępnij, kopiuj, do notatki, wydruk", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => { w.__shared = data; } });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
    window.print = () => {
      w.__printed = document.documentElement.classList.contains("printing-report") ? document.getElementById("report-print")?.textContent : null;
    };
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
    const e = (id: string, when: number, kind: string, site: string, text: string) => ({ id, at: when, kind, topic: null, text, site, checked: [], images: [] });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        e("a", at(14, 8, 15), "ok", "Lipowa 5", "Próba szczelności pionu"),
        e("b", at(14, 10, 20), "problem", "Lipowa 5", "Żółta rura przecieka"),
        e("c", at(14, 7), "note", "Polna 2", "Inwestor chce zmian"),
        e("d", at(13, 9), "note", "Lipowa 5", "Dostawa rur"),
      ],
    }));
    localStorage.setItem("kaczy:shifts", JSON.stringify({ version: 2, days: { "2026-10-14": { type: "b" } } }));
  });
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Raport" }).click();

  // Ostatnia budowa i dzień jej ostatniego wpisu; godziny z Grafiku.
  const dialog = page.getByTestId("journal-report");
  await expect(dialog.getByRole("combobox", { name: "Budowa raportu" }).locator("option:checked")).toHaveText("Lipowa 5");
  await expect(dialog.getByRole("button", { name: "Dziś" })).toHaveAttribute("aria-pressed", "true");
  const summary = dialog.getByTestId("report-summary");
  await expect(summary).toHaveText("2 wpisy · godziny pracy: 10 h · otwarte problemy: 1");
  await expect(dialog.locator("[data-report-work]")).toHaveText("Budowa 07:00–17:00 · 10 h");

  await dialog.getByRole("button", { name: "7 dni" }).click();
  await expect(summary).toHaveText("3 wpisy · godziny pracy: 10 h · otwarte problemy: 1");
  await expect(dialog.locator("[data-report-day]")).toHaveCount(2);
  await dialog.getByRole("combobox", { name: "Budowa raportu" }).selectOption("all");
  await expect(summary).toContainText("4 wpisy");
  await dialog.getByRole("combobox", { name: "Budowa raportu" }).selectOption({ label: "Lipowa 5" });

  await dialog.getByRole("button", { name: /Udostępnij/ }).click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: ShareData }).__shared);
  expect(shared.title).toBe("Raport: Lipowa 5 — 8–14 października 2026");
  expect(shared.text).toContain("- 10:20 Problem otwarty: Żółta rura przecieka");
  expect(shared.text).toContain("Praca: Budowa 07:00–17:00, 10 h");

  await dialog.getByRole("button", { name: "Kopiuj tekst" }).click();
  await expect(page.getByText("Skopiowano raport")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __copied: string }).__copied)).toContain("# Raport: Lipowa 5");

  await dialog.getByRole("button", { name: "Drukuj / PDF" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: string }).__printed)).toContain("Żółta rura przecieka");

  await dialog.getByRole("button", { name: "Do notatki" }).click();
  await expect(page.getByText("Dodano notatkę „Raport: Lipowa 5 — 8–14 października 2026”")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/");
  await expect(page.getByText("Raport: Lipowa 5 — 8–14 października 2026")).toBeVisible();
});

test("dziennik: karta budowy — nazwa, adres, inwestor, raport z karty i archiwum", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const now = Date.now();
    const e = (id: string, at: number, kind: string, site: string, text: string) => ({ id, at, kind, topic: null, text, site, checked: [], images: [] });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        e("a", now - 60_000, "ok", "Lipowa 5", "Próba szczelności pionu"),
        e("b", now - 120_000, "problem", "Lipowa 5", "Żółta rura przecieka"),
        e("c", now - 180_000, "note", "Polna 2", "Inwestor chce zmian"),
      ],
    }));
  });
  await page.goto("/nauka");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const journal = page.getByTestId("study-journal");

  // Stare wpisy z samą nazwą mają już kartę — z nagłówka budowy na osi czasu.
  await journal.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  await expect(card.getByTestId("site-card-stats")).toContainText("2 wpisy · otwarte: 1 problem");
  await card.getByLabel("Nazwa").fill("polna 2");
  await expect(card.getByRole("alert")).toHaveText("Jest już budowa „Polna 2”");
  await expect(card.getByRole("button", { name: "Zapisz kartę" })).toBeDisabled();
  await card.getByLabel("Nazwa").fill("Dom Nowaków");
  await card.getByLabel("Adres").fill("ul. Lipowa 5, Kraków");
  await card.getByLabel("Inwestor").fill("Jan Nowak");
  await card.getByRole("button", { name: "Zapisz kartę" }).click();
  await expect(page.getByText("Zapisano kartę budowy")).toBeVisible();
  await expect(journal.locator("[data-journal-site]")).toHaveText(["Dom Nowaków", "Polna 2"]);

  // Raport z karty: ta budowa, adres i inwestor w nagłówku.
  await card.getByRole("button", { name: "Raport" }).click();
  const report = page.getByTestId("journal-report");
  await expect(report.getByRole("combobox", { name: "Budowa raportu" }).locator("option:checked")).toHaveText("Dom Nowaków");
  await expect(report.getByTestId("report-site-card")).toHaveText("ul. Lipowa 5, Kraków · inwestor: Jan Nowak");
  await page.keyboard.press("Escape");
  await expect(report).toHaveCount(0);

  // Nowa nazwa w pigułkach arkusza i filtra.
  await journal.getByRole("button", { name: "Wpis", exact: true }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByTestId("journal-site-chips").getByRole("button")).toHaveText(["Dom Nowaków", "Polna 2"]);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  const sites = journal.getByRole("group", { name: "Budowa" });
  await sites.getByRole("button", { name: "Dom Nowaków" }).click();
  await expect(journal.locator("[data-journal-entry]")).toHaveCount(2);

  // Archiwum: znika z pigułek, wpisy zostają; „Archiwum (1)” ją pokazuje.
  await journal.getByRole("button", { name: "Karta budowy", exact: true }).click();
  await card.getByRole("button", { name: "Do archiwum" }).click();
  await expect(card).toHaveCount(0);
  await journal.getByRole("button", { name: "Wyczyść filtry" }).click();
  await expect(sites.getByRole("button", { name: "Dom Nowaków" })).toHaveCount(0);
  await expect(journal.locator("[data-journal-entry]")).toHaveCount(3);
  await sites.getByRole("button", { name: "Archiwum (1)" }).click();
  await expect(sites.getByRole("button", { name: "Dom Nowaków" })).toBeVisible();

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(journal.locator("[data-journal-site]")).toHaveText(["Dom Nowaków", "Polna 2"]);
  await journal.getByRole("button", { name: "Dom Nowaków: karta budowy" }).click();
  await expect(card.getByLabel("Inwestor")).toHaveValue("Jan Nowak");
  await expect(card.getByTestId("site-card-stats")).toContainText("w archiwum");
});
