import { test, expect } from "@playwright/test";
import { addNote, seedNotes } from "./helpers";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, title: string) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
});

test.describe("odporność na uszkodzone dane i błędy zapisu", () => {
  test("uszkodzone ustawienia w localStorage nie wywracają aplikacji @smoke", async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("corrupted")) return;
      sessionStorage.setItem("corrupted", "1");
      localStorage.setItem("kaczy.tour.seen.v1", "1");
      // Poprawny JSON, ale zły kształt (string/tablica zamiast obiektu) oraz zupełne śmieci.
      localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify("nie-obiekt"));
      localStorage.setItem("kaczy.confirmPrefs.v1", JSON.stringify([1, 2, 3]));
      localStorage.setItem("kaczy.study.v1", "{to nie jest json");
      localStorage.setItem("kaczy.templates.v1", JSON.stringify({ a: 1 }));
    });
    await page.goto("/");
    await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

    await addNote(page, "Działa mimo uszkodzeń");

    await page.goto("/nauka");
    await expect(page.getByTestId("study-view")).toBeVisible();
    await expect(page.getByTestId("mastery-count")).toHaveText("0");
  });

  test("zapis, który kończy się błędem, jest widoczny i nie udaje sukcesu", async ({ page }) => {
    await seedNotes(page, [note("a", "Istniejąca")]);
    // Po załadowaniu każda nowa transakcja na magazynie „updates” kończy się błędem kwoty.
    await page.addInitScript(() => {
      const orig = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: Parameters<IDBDatabase["transaction"]>) {
        const tx = orig.apply(this, args);
        const stores = ([] as string[]).concat(args[0] as string | string[]);
        if ((window as unknown as { __failWrites?: boolean }).__failWrites && stores.includes("updates")) {
          Object.defineProperty(tx, "error", { get: () => new DOMException("brak miejsca", "QuotaExceededError") });
          Object.defineProperty(tx, "onerror", {
            set(fn: ((e: Event) => void) | null) { if (fn) setTimeout(() => fn.call(tx, new Event("error")), 0); },
            get: () => null,
          });
        }
        return tx;
      };
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Istniejąca" })).toBeVisible();

    await page.evaluate(() => { (window as unknown as { __failWrites?: boolean }).__failWrites = true; });
    await page.getByText("Zapisz notatkę...").click();
    await page.getByPlaceholder("Tytuł").fill("Nie zapisze się");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();

    await expect(page.getByText(/Nie zapisano/)).toBeVisible();
  });

  test("dwie karty: zmiana z jednej pojawia się w drugiej bez utraty lokalnych notatek", async ({ browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    for (const p of [a, b]) await p.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
    await a.goto("/");
    await b.goto("/");

    await addNote(a, "Z karty A");
    await expect(b.getByRole("heading", { name: "Z karty A" })).toBeVisible();
    await addNote(b, "Z karty B");
    await expect(a.getByRole("heading", { name: "Z karty B" })).toBeVisible();
    await expect(a.getByRole("heading", { name: "Z karty A" })).toBeVisible();
    await ctx.close();
  });
});
