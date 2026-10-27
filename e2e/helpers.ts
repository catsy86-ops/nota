import { expect, type Locator, type Page } from "@playwright/test";

/** Ostatni dymek (sonner). Dymki układają się w stos — lokatory po samej nazwie przycisku bywają niejednoznaczne. */
export function lastToast(page: Page): Locator {
  return page.locator("[data-sonner-toast]").last();
}

/** Przycisk „Cofnij” w dymku zawierającym `text` (strict mode nie narzeka przy kilku dymkach naraz). */
export function undoIn(page: Page, text: string | RegExp): Locator {
  return page.getByRole("listitem").filter({ hasText: text }).getByRole("button", { name: "Cofnij" });
}

/** Dodaje notatkę z paska (wersja stołowa): tytuł i opcjonalnie treść, czeka na jej pojawienie się w siatce. */
export async function addNote(page: Page, title: string, content = ""): Promise<void> {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  if (content) await page.getByPlaceholder("Treść notatki...").fill(content);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

/**
 * Seeduje notatki przez `localStorage` (migracja przy starcie) tylko raz na kartę —
 * odświeżenie strony nie nadpisuje już zmian zrobionych w teście.
 */
export async function seedNotes(page: Page, notes: unknown[]): Promise<void> {
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("e2e-seeded")) return;
    sessionStorage.setItem("e2e-seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, notes);
}

/**
 * Włącza okno potwierdzenia przed kosza i archiwum (plan 3.1: domyślnie bez pytania, jest „Cofnij”).
 * Testy, które sprawdzają przepływ z pytaniem, wywołują to na początku i przeładowują stronę.
 */
export async function askBeforeTrashAndArchive(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.setItem("kaczy.confirmPrefs.v1", JSON.stringify({ trash: true, archive: true })));
  await page.reload();
}
